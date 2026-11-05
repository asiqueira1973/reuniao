// Faxina diária — épico 8.9, regras 11.12 e seção 12. Chamada 1×/dia pelo cron da Vercel
// (/api/cron/diario). Três tarefas, todas idempotentes:
// 1. Reservas novas em `processando` há mais de 10 min → `falhou` (apaga o evento que o Google
//    possa ter criado com o id previsível; 404 conta como apagado). Remarcação presa (tem
//    `remarcada_de_id`) não é mexida: o estado no Google é incerto; só fica no log.
// 2. Reenvia e-mails `falhou` e `pendente` (pendente só se tiver mais de 10 min, para não
//    correr com um envio em andamento) com menos de 5 tentativas, de reuniões que ainda não
//    terminaram (ou sem reunião, como o aviso de reconexão). Usa as mesmas regras do botão
//    "Reenviar" do painel; o que ele recusaria é pulado.
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

// Tarefa 1: reservas presas em `processando`.
async function failStaleProcessing(now: Date): Promise<number> {
  const { data, error } = await db()
    .from("ag_reservas")
    .select("id, conta_id, remarcada_de_id")
    .eq("status", "processando")
    .lt("criado_em", new Date(now.getTime() - STALE_MS).toISOString())
    .limit(BATCH);
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

// Tarefa 2: e-mails que não saíram.
async function resendPending(now: Date): Promise<number> {
  const { data, error } = await db()
    .from("ag_notificacoes")
    .select("id, conta_id, status, criado_em, ag_reservas(fim)")
    .in("status", ["falhou", "pendente"])
    .lt("tentativas", MAX_ATTEMPTS)
    .order("criado_em")
    .limit(BATCH);
  if (error) throw error;
  let sent = 0;
  for (const n of data) {
    if (n.status === "pendente" && now.getTime() - new Date(n.criado_em).getTime() < STALE_MS) continue;
    if (n.ag_reservas && new Date(n.ag_reservas.fim) <= now) continue;
    try {
      if ((await resendNotification(n.conta_id, n.id)) === "enviada") sent++;
    } catch (e) {
      // Recusado pelas regras do reenvio (reunião cancelada, conexão já ativa…) ou Google fora.
      if (!(e instanceof OwnerActionError)) console.error("reenvio_falhou", { notificacaoId: n.id });
    }
  }
  return sent;
}

// Tarefa 3: anonimização da regra 11.12.
async function anonymizeOld(now: Date): Promise<number> {
  const { data, error } = await db()
    .from("ag_reservas")
    .update({
      nome_convidado: "Convidado", email_convidado: "anonimo@invalid", observacao: null, motivo_cancelamento: null,
      dados_anonimizados_em: now.toISOString(),
    })
    .lt("fim", subMonths(now, 24).toISOString())
    .is("dados_anonimizados_em", null)
    .select("id");
  if (error) throw error;
  return data.length;
}

// Roda as três tarefas em sequência (a falha de uma não impede as outras).
export async function runDailyCleanup(now = new Date()): Promise<CleanupResult> {
  const safe = async (name: string, task: () => Promise<number>) => {
    try {
      return await task();
    } catch {
      console.error("faxina_falhou", { tarefa: name });
      return 0;
    }
  };
  const falhados = await safe("processando", () => failStaleProcessing(now));
  const reenviados = await safe("reenvio", () => resendPending(now));
  const anonimizados = await safe("anonimizacao", () => anonymizeOld(now));
  return { reenviados, falhados, anonimizados };
}
