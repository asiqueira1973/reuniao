// Gestão da reserva pelo convidado — épico 8.6 e seção 12 (máquina de estado).
// Ver, cancelar e remarcar pelo link /r/{token}. Cancelar e remarcar só valem para reserva
// 'confirmada' que ainda não começou. Princípio 2 também aqui: se o Google não confirmar a
// mudança, o app não muda o estado (o horário não pode ficar livre com o evento ainda lá).
import "server-only";
import { localDate } from "@/features/availability/group";
import { copy } from "@/lib/copy";
import { requireReservaPorToken, type ManagedReservation } from "@/server/auth/require-reserva";
import { AvailabilityLookupError, getAvailability } from "@/server/availability";
import { eventDescription, manageUrl, newManageToken } from "@/server/booking";
import { db } from "@/server/db/client";
import { cancelledToOwner, confirmationToGuest, rescheduledToOwner } from "@/server/email/templates";
import { CalendarError } from "@/server/google/calendar";
import { deleteEvent, patchEvent } from "@/server/google/events";
import { notifyReservation } from "@/server/notifications";
import { track } from "@/server/analytics/track";

export type ManageErrorCode = "dados_invalidos" | "nao_encontrado" | "transicao_invalida" | "reuniao_iniciada" | "horario_indisponivel" | "servico_indisponivel" | "agenda_indisponivel";

// Erro de gestão com o código da seção 13.
export class ManageError extends Error {
  constructor(public readonly code: ManageErrorCode) {
    super(code);
  }
}

export type ManageView =
  | { state: "invalid" }
  | { state: "active" | "past"; r: ManagedReservation }
  | { state: "cancelled"; r: ManagedReservation }
  | { state: "rescheduled"; r: ManagedReservation; newStart: string | null };

// Estado da tela /r/{token} (critérios 8.6): link inválido, ativa, já começou, cancelada ou
// remarcada (com a data nova — o link novo só existe no e-mail, porque o banco guarda só o hash).
export async function getManageView(token: string, now = new Date()): Promise<ManageView> {
  const r = await requireReservaPorToken(token);
  if (!r || r.status === "processando" || r.status === "falhou") return { state: "invalid" };
  if (r.status === "cancelada_convidado" || r.status === "cancelada_dono") return { state: "cancelled", r };
  if (r.status === "remarcada") {
    const { data } = await db()
      .from("ag_reservas")
      .select("inicio")
      .eq("remarcada_de_id", r.id)
      .in("status", ["confirmada", "remarcada", "cancelada_convidado", "cancelada_dono"])
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { state: "rescheduled", r, newStart: data?.inicio ?? null };
  }
  return { state: new Date(r.inicio) <= now ? "past" : "active", r };
}

// Confere que a reserva pode mudar (seção 12): confirmada e futura.
function assertChangeable(r: ManagedReservation | null, now: Date): asserts r is ManagedReservation {
  if (!r) throw new ManageError("nao_encontrado");
  if (r.status !== "confirmada") throw new ManageError("transicao_invalida");
  if (new Date(r.inicio) <= now) throw new ManageError("reuniao_iniciada");
}

// Cancelamento pelo convidado (critério 8.6): primeiro "toma" a reserva no banco (confirmada →
// cancelada_convidado, condicional), para uma remarcação simultânea não passar; depois apaga o
// evento no Google (sendUpdates=all; já apagado conta como apagado). Google com erro → volta a
// confirmada e servico_indisponivel. Enquanto isso o evento segue no Google, então o horário
// continua ocupado para a página pública (princípio 2). Avisa o dono.
export async function cancelByGuest(token: string, motivo: string | null, now = new Date()): Promise<{ ownerName: string }> {
  const r = await requireReservaPorToken(token);
  assertChangeable(r, now);
  const reason = motivo?.trim() ? motivo.trim().slice(0, 500) : null;
  const { data: claimed, error } = await db()
    .from("ag_reservas")
    .update({ status: "cancelada_convidado", cancelada_em: now.toISOString(), motivo_cancelamento: reason })
    .eq("id", r.id)
    .eq("status", "confirmada")
    .select("id");
  if (error) throw error;
  if (!claimed.length) throw new ManageError("transicao_invalida");
  if (r.google_evento_id) {
    try {
      await deleteEvent(r.conta_id, r.google_evento_id);
    } catch (e) {
      const { data: back, error: e3 } = await db()
        .from("ag_reservas")
        .update({ status: "confirmada", cancelada_em: null, motivo_cancelamento: null })
        .eq("id", r.id)
        .eq("status", "cancelada_convidado")
        .select("id");
      // Só o id da reserva no log (seção 20): o evento continua no Google e o app a mostra cancelada.
      if (e3 || !back?.length) console.error("reverter_cancelamento_falhou", { reservaId: r.id });
      if (e instanceof CalendarError) throw new ManageError(e.code === "agenda_indisponivel" ? "agenda_indisponivel" : "servico_indisponivel");
      throw e;
    }
  }

  const conta = r.ag_contas!;
  await notifyReservation(r.conta_id, r.id, "aviso_dono_cancelada", {
    to: conta.email,
    replyTo: r.email_convidado,
    fromName: conta.nome_exibicao,
    email: cancelledToOwner({
      ownerName: conta.nome_exibicao, typeName: r.ag_tipos_evento!.nome, guestName: r.nome_convidado, guestEmail: r.email_convidado,
      ownerTimeZone: conta.fuso, start: new Date(r.inicio).toISOString(), reason,
    }),
  }).catch(() => undefined);
  track({ nome: "reuniao_reserva_cancelada", contaId: r.conta_id, tela: "gerenciar_reuniao", descricao: "reunião cancelada", propriedades: { por: "convidado", com_motivo: !!reason } });
  return { ownerName: conta.nome_exibicao };
}

export type RescheduleResult = { id: string; inicio: string; fim: string; link_meet: string | null; slug: string; tipo: string };

// Remarcação pelo convidado (seção 12, passo a passo): revalida o horário novo com o Google atual
// ignorando o intervalo da própria reunião → ag_fn_remarcar_reservar (antiga remarcada, nova
// processando com token novo) → patch no MESMO evento (horário e link novos; Meet mantido) →
// nova confirmada → e-mails. Falha no patch → ag_fn_desfaz_remarcacao.
export async function rescheduleByGuest(token: string, inicio: string, fuso: string, now = new Date()): Promise<RescheduleResult> {
  const r = await requireReservaPorToken(token);
  assertChangeable(r, now);
  const conta = r.ag_contas!;
  const tipo = r.ag_tipos_evento!;
  const startIso = new Date(inicio).toISOString();
  const oldStart = new Date(r.inicio).toISOString();
  const oldEnd = new Date(r.fim).toISOString();
  // Mesmo horário não é remarcação (geraria reserva, link e e-mails à toa).
  if (startIso === oldStart) throw new ManageError("dados_invalidos");

  let offered: string[];
  try {
    const day = localDate(startIso, conta.fuso);
    const a = await getAvailability({ accountSlug: conta.slug, typeSlug: tipo.slug, from: day, to: day, now, ignore: { inicio: oldStart, fim: oldEnd } });
    offered = a.dias.flatMap((d) => d.horarios);
  } catch (e) {
    if (e instanceof AvailabilityLookupError) throw new ManageError(e.code === "agenda_indisponivel" ? "agenda_indisponivel" : "horario_indisponivel");
    if (e instanceof CalendarError) throw new ManageError(e.code);
    throw e;
  }
  if (!offered.includes(startIso)) throw new ManageError("horario_indisponivel");

  const end = new Date(Date.parse(startIso) + tipo.duracao_min * 60_000).toISOString();
  const { token: newToken, hash } = newManageToken();
  const { data: novaId, error } = await db().rpc("ag_fn_remarcar_reservar", {
    p_antiga_id: r.id, p_inicio: startIso, p_fim: end, p_token_hash: hash, p_fuso: fuso,
  });
  if (error?.code === "23P01") throw new ManageError("horario_indisponivel");
  if (error?.message === "transicao_invalida" || error?.message === "reuniao_iniciada") throw new ManageError(error.message);
  if (error) throw error;

  try {
    if (r.google_evento_id) {
      await patchEvent(r.conta_id, r.google_evento_id, {
        start: startIso,
        end,
        description: eventDescription(r.nome_convidado, r.email_convidado, r.observacao, newToken),
      });
    }
  } catch (e) {
    const { data: outcome } = await db().rpc("ag_fn_desfaz_remarcacao", { p_nova_id: novaId });
    if (outcome === "perdida") {
      // Raro: alguém pegou o horário antigo nesses segundos. Avisa o dono (seção 12).
      console.error("remarcacao_perdida", r.id);
      await notifyReservation(r.conta_id, r.id, "aviso_dono_cancelada", {
        to: conta.email, replyTo: r.email_convidado, fromName: conta.nome_exibicao,
        email: cancelledToOwner({
          ownerName: conta.nome_exibicao, typeName: tipo.nome, guestName: r.nome_convidado, guestEmail: r.email_convidado,
          ownerTimeZone: conta.fuso, start: oldStart, reason: copy.emails.lostReschedule,
        }),
      }).catch(() => undefined);
    }
    if (e instanceof CalendarError) throw new ManageError(e.code === "agenda_indisponivel" ? "agenda_indisponivel" : "servico_indisponivel");
    throw e;
  }

  // processando → confirmada; o evento já foi atualizado no Google, então tenta de novo antes de desistir.
  let e2: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    ({ error: e2 } = await db().from("ag_reservas").update({ status: "confirmada" }).eq("id", novaId));
    if (!e2) break;
  }
  if (e2) {
    console.error("remarcacao_nao_confirmada", novaId);
    throw e2;
  }

  const data = {
    contaId: r.conta_id, reservaId: novaId, ownerName: conta.nome_exibicao, ownerEmail: conta.email, ownerTimeZone: conta.fuso,
    typeName: tipo.nome, guestName: r.nome_convidado, guestEmail: r.email_convidado, guestTimeZone: fuso, notes: r.observacao,
    start: startIso, meetLink: r.link_meet, manageUrl: manageUrl(newToken),
  };
  await Promise.allSettled([
    notifyReservation(r.conta_id, novaId, "confirmacao_convidado", {
      to: r.email_convidado, replyTo: conta.email, fromName: conta.nome_exibicao, email: confirmationToGuest(data),
    }),
    notifyReservation(r.conta_id, novaId, "aviso_dono_remarcada", {
      to: conta.email, replyTo: r.email_convidado, fromName: conta.nome_exibicao,
      email: rescheduledToOwner({
        ownerName: conta.nome_exibicao, typeName: tipo.nome, guestName: r.nome_convidado, guestEmail: r.email_convidado,
        ownerTimeZone: conta.fuso, start: startIso, previousStart: oldStart, reason: null, meetLink: r.link_meet,
      }),
    }),
  ]);
  track({ nome: "reuniao_reserva_remarcada", contaId: r.conta_id, tela: "gerenciar_reuniao", descricao: "convidado remarcou a reunião" });
  return { id: novaId, inicio: startIso, fim: end, link_meet: r.link_meet, slug: conta.slug, tipo: tipo.slug };
}
