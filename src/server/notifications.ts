// Notificações por e-mail — regra 11.6 e seção 6 (aviso de reconexão).
// Cada e-mail de reserva tem uma linha em ag_notificacoes, única por (reserva_id, tipo): o mesmo
// e-mail nunca sai duas vezes. Envio fora da transação da reserva: falha de e-mail não desfaz
// nada; a linha fica 'falhou' e a faxina diária (8.9) reenvia até 5 tentativas no total.
import "server-only";
import type { Database } from "@/server/db/types";
import { db } from "@/server/db/client";
import { sendEmail } from "@/server/email/resend";
import { confirmationToGuest, newBookingToOwner, reconnectToOwner, type RenderedEmail } from "@/server/email/templates";

type NotificationType = Database["public"]["Enums"]["ag_tipo_notificacao"];
export const MAX_ATTEMPTS = 5;

type Delivery = { to: string; replyTo?: string; fromName: string; email: RenderedEmail };

// Envia o e-mail de uma linha de notificação já existente e grava o resultado.
async function deliver(notification: { id: string; tentativas: number; status: string }, d: Delivery): Promise<"enviada" | "falhou" | "ignorada"> {
  if (notification.status === "enviada" || notification.tentativas >= MAX_ATTEMPTS) return "ignorada";
  const attempts = notification.tentativas + 1;
  try {
    // Chave por tentativa: o Resend não deve devolver a resposta guardada de uma tentativa que falhou.
    const resendId = await sendEmail({ fromName: d.fromName, to: d.to, replyTo: d.replyTo, ...d.email, idempotencyKey: `${notification.id}:${attempts}` });
    await db().from("ag_notificacoes").update({ status: "enviada", tentativas: attempts, resend_id: resendId, erro: null, enviada_em: new Date().toISOString() }).eq("id", notification.id);
    return "enviada";
  } catch (err) {
    // Só o código curto do erro (sem destinatário nem conteúdo, seção 20).
    const erro = err instanceof Error ? err.message.slice(0, 120) : "erro";
    await db().from("ag_notificacoes").update({ status: "falhou", tentativas: attempts, erro }).eq("id", notification.id);
    return "falhou";
  }
}

// Garante a linha (reserva_id, tipo) e envia, se ainda não foi enviada. Devolve o resultado.
export async function notifyReservation(contaId: string, reservaId: string, tipo: NotificationType, d: Delivery) {
  await db().from("ag_notificacoes").upsert({ conta_id: contaId, reserva_id: reservaId, tipo }, { onConflict: "reserva_id,tipo", ignoreDuplicates: true });
  const { data, error } = await db()
    .from("ag_notificacoes")
    .select("id, tentativas, status")
    .eq("reserva_id", reservaId)
    .eq("tipo", tipo)
    .single();
  if (error) throw error;
  return deliver(data, d);
}

// Dados que os e-mails de reserva usam (vêm da reserva confirmada, da conta e do tipo).
export type BookingEmailData = {
  contaId: string;
  reservaId: string;
  ownerName: string;
  ownerEmail: string;
  ownerTimeZone: string;
  typeName: string;
  guestName: string;
  guestEmail: string;
  guestTimeZone: string;
  notes: string | null;
  start: string;
  meetLink: string | null;
  manageUrl: string;
};

// E-mails de reserva nova confirmada (regra 11.6): confirmação ao convidado (reply-to = dono) e
// aviso ao dono (reply-to = convidado). Nunca lança: falha fica registrada na notificação.
export async function notifyBookingConfirmed(b: BookingEmailData): Promise<void> {
  const data = { ...b };
  await Promise.allSettled([
    notifyReservation(b.contaId, b.reservaId, "confirmacao_convidado", {
      to: b.guestEmail, replyTo: b.ownerEmail, fromName: b.ownerName, email: confirmationToGuest(data),
    }),
    notifyReservation(b.contaId, b.reservaId, "aviso_dono_nova", {
      to: b.ownerEmail, replyTo: b.guestEmail, fromName: b.ownerName, email: newBookingToOwner(data),
    }),
  ]);
}

// Aviso "Reconecte sua agenda" (seção 6): só uma vez enquanto a conexão continuar revogada.
// A troca de aviso_reconectar_enviado false → true é o que garante o "uma vez" (atômica no banco).
export async function ensureReconnectNotice(contaId: string): Promise<void> {
  const { data: claimed } = await db()
    .from("ag_conexoes_google")
    .update({ aviso_reconectar_enviado: true })
    .eq("conta_id", contaId)
    .eq("status", "revogada")
    .eq("aviso_reconectar_enviado", false)
    .select("conta_id");
  if (!claimed?.length) return;
  const { data: conta } = await db().from("ag_contas").select("email, nome_exibicao").eq("id", contaId).single();
  if (!conta) return;
  const { data: row } = await db().from("ag_notificacoes").insert({ conta_id: contaId, tipo: "reconectar_google" }).select("id, tentativas, status").single();
  if (!row) return;
  await deliver(row, { to: conta.email, fromName: conta.nome_exibicao, email: reconnectToOwner(process.env.NEXT_PUBLIC_SITE_URL ?? "") });
}
