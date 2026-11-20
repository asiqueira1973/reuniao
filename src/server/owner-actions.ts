// Ações do dono sobre as reuniões — épico 8.7, regra 11.6 e seção 12.
// cancelByOwner: cancela uma reunião confirmada e futura (toma a reserva no banco, apaga no
// Google; se o Google falhar, a reserva volta a confirmada). resendNotification: reenvia um e-mail
// que falhou, até 5 tentativas no total.
import "server-only";
import { db } from "@/server/db/client";
import { BookingError, resendBookingEmails } from "@/server/booking";
import { cancellationToGuest, cancelledToOwner, newBookingToOwner, reconnectToOwner, rescheduledToOwner } from "@/server/email/templates";
import { CalendarError } from "@/server/google/calendar";
import { deleteEvent } from "@/server/google/events";
import { MAX_ATTEMPTS, notifyReservation, redeliver } from "@/server/notifications";
import { track } from "@/server/analytics/track";

export type OwnerErrorCode = "nao_encontrado" | "transicao_invalida" | "reuniao_iniciada" | "servico_indisponivel" | "agenda_indisponivel" | "limite_tentativas";

// Erro das ações do dono com o código da seção 13.
export class OwnerActionError extends Error {
  constructor(public readonly code: OwnerErrorCode) {
    super(code);
  }
}

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

// Dados da reserva e da conta para cancelar e para remontar e-mails (sempre com conta_id).
async function loadReservation(contaId: string, id: string) {
  const { data, error } = await db()
    .from("ag_reservas")
    .select("id, conta_id, inicio, fim, status, nome_convidado, email_convidado, fuso_convidado, observacao, google_evento_id, link_meet, motivo_cancelamento, remarcada_de_id, ag_tipos_evento(nome), ag_contas(slug, email, nome_exibicao, fuso)")
    .eq("conta_id", contaId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data && data.ag_contas && data.ag_tipos_evento ? data : null;
}

// Cancelamento pelo dono (critério 8.7): toma a reserva no banco (confirmada → cancelada_dono,
// condicional, para não correr com uma remarcação) → apaga no Google (sendUpdates=all; erro →
// volta a confirmada) → e-mail cancelamento_convidado com o motivo e o link /{slug}.
export async function cancelByOwner(contaId: string, id: string, motivo: string | null, now = new Date()): Promise<void> {
  const r = await loadReservation(contaId, id);
  if (!r) throw new OwnerActionError("nao_encontrado");
  if (r.status !== "confirmada") throw new OwnerActionError("transicao_invalida");
  if (new Date(r.inicio) <= now) throw new OwnerActionError("reuniao_iniciada");
  const reason = motivo?.trim() ? motivo.trim().slice(0, 500) : null;
  const { data: claimed, error } = await db()
    .from("ag_reservas")
    .update({ status: "cancelada_dono", cancelada_em: now.toISOString(), motivo_cancelamento: reason })
    .eq("conta_id", contaId)
    .eq("id", id)
    .eq("status", "confirmada")
    .select("id");
  if (error) throw error;
  if (!claimed.length) throw new OwnerActionError("transicao_invalida");
  if (r.google_evento_id) {
    try {
      await deleteEvent(contaId, r.google_evento_id);
    } catch (e) {
      const { data: back, error: e3 } = await db()
        .from("ag_reservas")
        .update({ status: "confirmada", cancelada_em: null, motivo_cancelamento: null })
        .eq("conta_id", contaId)
        .eq("id", id)
        .eq("status", "cancelada_dono")
        .select("id");
      // Só o id da reserva no log (seção 20): o evento continua no Google e o app a mostra cancelada.
      if (e3 || !back?.length) console.error("reverter_cancelamento_falhou", { reservaId: id });
      if (e instanceof CalendarError) throw new OwnerActionError(e.code === "agenda_indisponivel" ? "agenda_indisponivel" : "servico_indisponivel");
      throw e;
    }
  }

  track({ nome: "reuniao_reserva_cancelada", contaId, tela: "reunioes", descricao: "reunião cancelada", propriedades: { por: "dono", com_motivo: !!reason } });
  const conta = r.ag_contas!;
  await notifyReservation(contaId, id, "cancelamento_convidado", {
    to: r.email_convidado,
    replyTo: conta.email,
    fromName: conta.nome_exibicao,
    email: cancellationToGuest({
      ownerName: conta.nome_exibicao, typeName: r.ag_tipos_evento!.nome, start: new Date(r.inicio).toISOString(),
      guestTimeZone: r.fuso_convidado, reason, publicUrl: `${SITE()}/${conta.slug}`,
    }),
  }).catch(() => undefined);
}

// Reenvio manual de um e-mail que falhou (critério 8.7 "Reenviar"). Só notificação da conta, que
// não esteja 'enviada' e com menos de 5 tentativas. Confirmação/aviso de reserva nova saem com
// link de gestão novo (resendBookingEmails); os demais são remontados a partir da reserva.
export async function resendNotification(contaId: string, notificationId: string): Promise<"enviada" | "falhou"> {
  const { data: n, error } = await db()
    .from("ag_notificacoes")
    .select("id, tipo, status, tentativas, reserva_id")
    .eq("conta_id", contaId)
    .eq("id", notificationId)
    .maybeSingle();
  if (error) throw error;
  if (!n) throw new OwnerActionError("nao_encontrado");
  if (n.status === "enviada") throw new OwnerActionError("transicao_invalida");
  if (n.tentativas >= MAX_ATTEMPTS) throw new OwnerActionError("limite_tentativas");

  if (n.tipo === "reconectar_google") {
    // Conexão já reconectada: o aviso não faz mais sentido.
    const { data: conexao } = await db().from("ag_conexoes_google").select("status").eq("conta_id", contaId).maybeSingle();
    if (conexao?.status !== "revogada") throw new OwnerActionError("transicao_invalida");
    const { data: conta } = await db().from("ag_contas").select("email, nome_exibicao").eq("id", contaId).single();
    return redeliver(n, { to: conta!.email, fromName: conta!.nome_exibicao, email: reconnectToOwner(SITE()) });
  }
  const r = n.reserva_id ? await loadReservation(contaId, n.reserva_id) : null;
  if (!r) throw new OwnerActionError("nao_encontrado");
  const conta = r.ag_contas!;
  const start = new Date(r.inicio).toISOString();

  if (n.tipo === "aviso_dono_nova") {
    // O aviso ao dono não leva link de gestão: é remontado sem trocar o token do convidado.
    // Reunião que já não está confirmada (cancelada, remarcada): o aviso perdeu o sentido.
    if (r.status !== "confirmada") throw new OwnerActionError("transicao_invalida");
    return redeliver(n, {
      to: conta.email, replyTo: r.email_convidado, fromName: conta.nome_exibicao,
      email: newBookingToOwner({
        ownerName: conta.nome_exibicao, ownerTimeZone: conta.fuso,
        typeName: r.ag_tipos_evento!.nome, guestName: r.nome_convidado, guestEmail: r.email_convidado, guestTimeZone: r.fuso_convidado,
        notes: r.observacao, start, meetLink: r.link_meet, manageUrl: "",
      }),
    });
  }
  if (n.tipo === "confirmacao_convidado") {
    // O link de gestão só existe no e-mail: a confirmação sai com link novo (aprovado em 05/11).
    if (r.status !== "confirmada") throw new OwnerActionError("transicao_invalida");
    try {
      const result = await resendBookingEmails(r.id);
      return result.confirmacao_convidado === "enviada" ? "enviada" : "falhou";
    } catch (e) {
      if (e instanceof CalendarError) throw new OwnerActionError(e.code === "agenda_indisponivel" ? "agenda_indisponivel" : "servico_indisponivel");
      if (e instanceof BookingError) throw new OwnerActionError("transicao_invalida");
      throw e;
    }
  }
  if (n.tipo === "cancelamento_convidado") {
    return redeliver(n, {
      to: r.email_convidado, replyTo: conta.email, fromName: conta.nome_exibicao,
      email: cancellationToGuest({
        ownerName: conta.nome_exibicao, typeName: r.ag_tipos_evento!.nome, start, guestTimeZone: r.fuso_convidado,
        reason: r.motivo_cancelamento, publicUrl: `${SITE()}/${conta.slug}`,
      }),
    });
  }
  const change = {
    ownerName: conta.nome_exibicao, typeName: r.ag_tipos_evento!.nome, guestName: r.nome_convidado, guestEmail: r.email_convidado,
    ownerTimeZone: conta.fuso, start, reason: r.motivo_cancelamento,
  };
  if (n.tipo === "aviso_dono_cancelada") {
    return redeliver(n, { to: conta.email, replyTo: r.email_convidado, fromName: conta.nome_exibicao, email: cancelledToOwner(change) });
  }
  // aviso_dono_remarcada: o horário anterior vem da reserva de origem.
  const { data: prev } = r.remarcada_de_id
    ? await db().from("ag_reservas").select("inicio").eq("conta_id", contaId).eq("id", r.remarcada_de_id).maybeSingle()
    : { data: null };
  return redeliver(n, {
    to: conta.email, replyTo: r.email_convidado, fromName: conta.nome_exibicao,
    email: rescheduledToOwner({ ...change, previousStart: prev ? new Date(prev.inicio).toISOString() : start, meetLink: r.link_meet }),
  });
}
