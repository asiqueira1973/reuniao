// Faxina diária — épico 8.9, regras 11.12 e seção 12. Chamada 1×/dia pelo cron da Vercel
// (/api/cron/diario). Três tarefas, todas idempotentes:
// 1. Reservas novas em `processando` há mais de 10 min → `falhou` (apaga o evento que o Google
//    possa ter criado com o id previsível; 404 conta como apagado). Remarcação presa (tem
//    `remarcada_de_id`) não é mexida: o estado no Google é incerto; só fica no log.
// 2. Reenvia e-mails `falhou` e `pendente` (pendente só se tiver mais de 10 min, para não
//    correr com um envio em andamento) com menos de 5 tentativas, de reuniões que ainda não
//    terminaram (ou sem reunião, como o aviso de reconexão). Usa as mesmas regras do botão
//    "Reenviar" do painel; o que ele recusaria é pulado. Confirmação ao convidado `pendente` não
//    é reenviada: o e-mail pode ter saído, e o reenvio troca o token (quebraria o link).
// 3. Anonimiza reservas com `fim` há mais de 24 meses (regra 11.12).
// Devolve as contagens { reenviados, falhados, anonimizados } (seção 13).
import "server-only";
import { subMonths } from "date-fns";
import { db } from "@/server/db/client";
import { deleteEvent, eventIdFor } from "@/server/google/events";
import { MAX_ATTEMPTS } from "@/server/notifications";
import { OwnerActionError, resendNotification } from "@/server/owner-actions";

const STALE_MS = 10 * 60_000;
const BATCH = 200;

export type CleanupResult = { reenviados: number; falhados: number; anonimizados: number };

// Opções: `now` (relógio) e `contaIds` (só nos testes: limita a faxina às contas de teste, para
// não mexer nos dados de dev do banco local). A rota chama sem opções = todas as contas.
export type CleanupOptions = { now?: Date; contaIds?: string[] };

// Aplica o filtro de contas, quando houver.
function scoped<Q extends { in: (column: "conta_id", values: string[]) => Q }>(q: Q, contaIds?: string[]): Q {
  return contaIds ? q.in("conta_id", contaIds) : q;
}

// Tarefa 1: reservas presas em `processando`.
async function failStaleProcessing(now: Date, contaIds?: string[]): Promise<number> {
  const { data, error } = await scoped(
    db()
      .from("ag_reservas")
      .select("id, conta_id, remarcada_de_id")
      .eq("status", "processando")
      .lt("criado_em", new Date(now.getTime() - STALE_MS).toISOString()),
    contaIds,
  ).limit(BATCH);
  if (error) throw error;
  let failed = 0;
  for (const r of data) {
    if (r.remarcada_de_id) {
      console.error("remarcacao_presa", { reservaId: r.id });
      continue;
    }
    try {
      await deleteEvent(r.conta_id, eventIdFor(r.id));
    } catch {
      // Google fora: marca mesmo assim (o horário continua ocupado no Google pelo próprio evento).
      console.error("evento_orfao_possivel", { reservaId: r.id });
    }
    const { data: done } = await db().from("ag_reservas").update({ status: "falhou" }).eq("id", r.id).eq("status", "processando").select("id");
    failed += done?.length ?? 0;
  }
  return failed;
}

// Tarefa 2: e-mails que não saíram. Duas consultas, com o filtro no banco para o lote não
// encher de linhas que nunca serão reenviadas: (a) de reuniões confirmadas ou canceladas que
// ainda não terminaram; (b) sem reunião (aviso de reconexão).
async function resendPending(now: Date, contaIds?: string[]): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_MS).toISOString();
  const base = () =>
    scoped(db().from("ag_notificacoes").select("id, conta_id, tipo, status, criado_em, reserva_id, ag_reservas!inner(fim)"), contaIds)
      .in("status", ["falhou", "pendente"])
      .lt("tentativas", MAX_ATTEMPTS);
  const [withMeeting, withoutMeeting] = await Promise.all([
    base().gt("ag_reservas.fim", now.toISOString()).order("criado_em").limit(BATCH),
    scoped(db().from("ag_notificacoes").select("id, conta_id, tipo, status, criado_em, reserva_id"), contaIds)
      .in("status", ["falhou", "pendente"])
      .lt("tentativas", MAX_ATTEMPTS)
      .is("reserva_id", null)
      .order("criado_em")
      .limit(BATCH),
  ]);
  if (withMeeting.error) throw withMeeting.error;
  if (withoutMeeting.error) throw withoutMeeting.error;

  // A confirmação reenviada já tenta também o aviso ao dono da mesma reserva (resendBookingEmails):
  // não tentar o aviso de novo na mesma rodada.
  const rows = [...withMeeting.data, ...withoutMeeting.data].sort(
    (x, y) => Number(y.tipo === "confirmacao_convidado") - Number(x.tipo === "confirmacao_convidado"),
  );
  const confirmationDone = new Set<string>();
  let sent = 0;
  for (const n of rows) {
    if (n.status === "pendente" && n.criado_em > cutoff) continue;
    if (n.status === "pendente" && n.tipo === "confirmacao_convidado") continue;
    if (n.tipo === "aviso_dono_nova" && n.reserva_id && confirmationDone.has(n.reserva_id)) continue;
    try {
      const result = await resendNotification(n.conta_id, n.id);
      if (n.tipo === "confirmacao_convidado" && n.reserva_id) confirmationDone.add(n.reserva_id);
      if (result === "enviada") sent++;
    } catch (e) {
      // Recusado pelas regras do reenvio (reunião cancelada, conexão já ativa…) ou Google fora.
      if (!(e instanceof OwnerActionError)) console.error("reenvio_falhou", { notificacaoId: n.id });
    }
  }
  // O aviso ao dono reenviado junto com a confirmação conta como reenviado se saiu.
  if (confirmationDone.size) {
    const { data } = await db()
      .from("ag_notificacoes")
      .select("id")
      .eq("tipo", "aviso_dono_nova")
      .eq("status", "enviada")
      .in("reserva_id", [...confirmationDone])
      .in("id", rows.filter((n) => n.tipo === "aviso_dono_nova").map((n) => n.id));
    sent += data?.length ?? 0;
  }
  return sent;
}

// Tarefa 3: anonimização da regra 11.12.
async function anonymizeOld(now: Date, contaIds?: string[]): Promise<number> {
  const { data, error } = await scoped(
    db()
      .from("ag_reservas")
      .update({
        nome_convidado: "Convidado", email_convidado: "anonimo@invalid", observacao: null, motivo_cancelamento: null,
        dados_anonimizados_em: now.toISOString(),
      }),
    contaIds,
  )
    .lt("fim", subMonths(now, 24).toISOString())
    .is("dados_anonimizados_em", null)
    .select("id");
  if (error) throw error;
  return data.length;
}

// Roda as três tarefas em sequência (a falha de uma não impede as outras).
export async function runDailyCleanup({ now = new Date(), contaIds }: CleanupOptions = {}): Promise<CleanupResult> {
  const safe = async (name: string, task: () => Promise<number>) => {
    try {
      return await task();
    } catch {
      console.error("faxina_falhou", { tarefa: name });
      return 0;
    }
  };
  const falhados = await safe("processando", () => failStaleProcessing(now, contaIds));
  const reenviados = await safe("reenvio", () => resendPending(now, contaIds));
  const anonimizados = await safe("anonimizacao", () => anonymizeOld(now, contaIds));
  return { reenviados, falhados, anonimizados };
}
