// Reserva pelo convidado — épico 8.5, regras 11.3, 11.5, 11.7, 11.8 e seção 12.
// Ordem: honeypot → conta/tipo/agenda → limite por e-mail → horário revalidado com o Google
// atual → INSERT 'processando' (a constraint de sobreposição decide corridas) → evento no Google
// → 'confirmada' → e-mails. Falha do Google deixa a reserva 'falhou' (libera o horário).
// O fim é sempre calculado aqui; do navegador só vêm tipo, início, nome, e-mail, observação, fuso.
import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { localDate } from "@/features/availability/group";
import { AvailabilityLookupError, getAvailability } from "@/server/availability";
import { db } from "@/server/db/client";
import { getPublicAccount } from "@/server/db/public";
import { CalendarError } from "@/server/google/calendar";
import { insertEvent, patchEvent } from "@/server/google/events";
import { confirmationToGuest, newBookingToOwner } from "@/server/email/templates";
import { notifyBookingConfirmed, notifyReservation } from "@/server/notifications";

export const MAX_FUTURE_BOOKINGS_PER_EMAIL = 3;

export type BookingInput = {
  conta: string;
  tipo: string;
  inicio: string; // ISO
  nome: string;
  email: string;
  observacao?: string | null;
  fuso: string;
  site?: string; // honeypot (regra 11.8)
};

export type BookingResult = { id: string; inicio: string; fim: string; link_meet: string | null };

// Erro de negócio da reserva com o código da seção 13.
export class BookingError extends Error {
  constructor(
    public readonly code: "nao_encontrado" | "tipo_indisponivel" | "agenda_indisponivel" | "horario_indisponivel" | "limite_excedido" | "servico_indisponivel",
  ) {
    super(code);
  }
}

// Token de gestão (regra 11.7): 32 bytes aleatórios em base64url no link; SHA-256 hex no banco.
export function newManageToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

// SHA-256 hex do token (o banco nunca vê o token em claro).
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Link da página de gestão da reserva.
export function manageUrl(token: string): string {
  return `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "")}/r/${token}`;
}

// Descrição do evento no Google (regra 11.5).
export function eventDescription(nome: string, email: string, observacao: string | null, token: string): string {
  return [`Agendado por ${nome} (${email}).`, observacao ?? "", `Para cancelar ou remarcar: ${manageUrl(token)}`].filter(Boolean).join("\n\n");
}

// Cria a reserva. Devolve os dados da reserva confirmada e o token (só para o e-mail/cookie).
// Lança BookingError com o código da seção 13.
export async function createBooking(input: BookingInput, now = new Date()): Promise<BookingResult & { token: string }> {
  // Regra 11.8: honeypot preenchido → resposta de sucesso falsa, nada gravado nem enviado.
  if (input.site) {
    const fake = new Date(input.inicio);
    return { id: randomUUID(), inicio: fake.toISOString(), fim: fake.toISOString(), link_meet: null, token: "" };
  }

  const email = input.email.trim().toLowerCase();
  const start = new Date(input.inicio);
  const startIso = start.toISOString();

  // Revalida o horário com o Google atual (regra 11.3) para o dia do início no fuso da conta.
  const account = await getPublicAccount(input.conta);
  if (!account) throw new BookingError("nao_encontrado");
  let availability;
  try {
    const day = localDate(startIso, account.fuso);
    availability = await getAvailability({ accountSlug: input.conta, typeSlug: input.tipo, from: day, to: day, now });
  } catch (e) {
    if (e instanceof AvailabilityLookupError) throw new BookingError(e.code);
    if (e instanceof CalendarError) throw new BookingError(e.code);
    throw e;
  }
  const { conta, tipo } = availability;

  // Regra 11.8: no máximo 3 reservas futuras confirmadas por e-mail, por conta.
  const { count } = await db()
    .from("ag_reservas")
    .select("id", { count: "exact", head: true })
    .eq("conta_id", conta.id)
    .eq("email_convidado", email)
    .eq("status", "confirmada")
    .gt("inicio", now.toISOString());
  if ((count ?? 0) >= MAX_FUTURE_BOOKINGS_PER_EMAIL) throw new BookingError("limite_excedido");

  const offered = availability.dias.flatMap((d) => d.horarios);
  if (!offered.includes(startIso)) throw new BookingError("horario_indisponivel");

  const end = new Date(start.getTime() + tipo.duracao_min * 60_000).toISOString();
  const { token, hash } = newManageToken();
  const observacao = input.observacao?.trim() ? input.observacao.trim() : null;

  const { data: reserva, error } = await db()
    .from("ag_reservas")
    .insert({
      conta_id: conta.id, tipo_evento_id: tipo.id, inicio: startIso, fim: end, nome_convidado: input.nome.trim(),
      email_convidado: email, observacao, fuso_convidado: input.fuso, status: "processando", token_hash: hash,
    })
    .select("id")
    .single();
  // Seção 7.3: outra reserva ativa cruzou o horário (corrida entre convidados).
  if (error?.code === "23P01") throw new BookingError("horario_indisponivel");
  if (error) throw error;

  let created;
  try {
    created = await insertEvent(conta.id, {
      reservaId: reserva.id,
      summary: `${tipo.nome} · ${input.nome.trim()}`,
      description: eventDescription(input.nome.trim(), email, observacao, token),
      start: startIso,
      end,
      attendee: { email, name: input.nome.trim() },
      withMeet: tipo.com_meet,
    });
  } catch (e) {
    // Seção 12: processando → falhou; o horário volta a ficar livre.
    await db().from("ag_reservas").update({ status: "falhou" }).eq("id", reserva.id);
    if (e instanceof CalendarError) throw new BookingError(e.code === "agenda_indisponivel" ? "agenda_indisponivel" : "servico_indisponivel");
    throw e;
  }

  // processando → confirmada. O evento já existe no Google: tenta de novo antes de desistir, para
  // a reserva não ficar presa em 'processando' (a faxina a soltaria com o convite já enviado).
  let confirmError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error: e } = await db()
      .from("ag_reservas")
      .update({ status: "confirmada", google_evento_id: created.eventId, link_meet: created.meetLink })
      .eq("id", reserva.id);
    confirmError = e;
    if (!e) break;
  }
  if (confirmError) {
    console.error("reserva_nao_confirmada", reserva.id);
    throw confirmError;
  }

  const { data: owner } = await db().from("ag_contas").select("email").eq("id", conta.id).single();
  await notifyBookingConfirmed({
    contaId: conta.id,
    reservaId: reserva.id,
    ownerName: conta.nome_exibicao,
    ownerEmail: owner?.email ?? "",
    ownerTimeZone: conta.fuso,
    typeName: tipo.nome,
    guestName: input.nome.trim(),
    guestEmail: email,
    guestTimeZone: input.fuso,
    notes: observacao,
    start: startIso,
    meetLink: created.meetLink,
    manageUrl: manageUrl(token),
  });

  return { id: reserva.id, inicio: startIso, fim: end, link_meet: created.meetLink, token };
}

// Reenvia os e-mails de uma reserva confirmada que falharam (regra 11.6), com link de gestão novo.
// O banco só guarda o hash do token (11.7), então não há como reenviar o link antigo: gera um token
// novo, troca o hash, atualiza o link na descrição do evento do Google e reenvia as notificações
// que não estão 'enviada' (aprovado pelo Alexandre em 05/11/2026). O link antigo deixa de valer.
// Devolve o resultado de cada notificação.
export async function resendBookingEmails(reservaId: string): Promise<Record<string, string>> {
  const { data: r, error } = await db()
    .from("ag_reservas")
    .select("id, conta_id, inicio, fim, nome_convidado, email_convidado, observacao, fuso_convidado, google_evento_id, link_meet, status, ag_tipos_evento(nome), ag_contas(email, nome_exibicao, fuso)")
    .eq("id", reservaId)
    .single();
  if (error) throw error;
  if (r.status !== "confirmada" || !r.google_evento_id || !r.ag_contas || !r.ag_tipos_evento) throw new BookingError("nao_encontrado");

  const { token, hash } = newManageToken();
  const { error: e1 } = await db().from("ag_reservas").update({ token_hash: hash }).eq("id", r.id);
  if (e1) throw e1;
  await patchEvent(r.conta_id, r.google_evento_id, {
    start: new Date(r.inicio).toISOString(),
    end: new Date(r.fim).toISOString(),
    description: eventDescription(r.nome_convidado, r.email_convidado, r.observacao, token),
  });

  const data = {
    contaId: r.conta_id,
    reservaId: r.id,
    ownerName: r.ag_contas.nome_exibicao,
    ownerEmail: r.ag_contas.email,
    ownerTimeZone: r.ag_contas.fuso,
    typeName: r.ag_tipos_evento.nome,
    guestName: r.nome_convidado,
    guestEmail: r.email_convidado,
    guestTimeZone: r.fuso_convidado,
    notes: r.observacao,
    start: new Date(r.inicio).toISOString(),
    meetLink: r.link_meet,
    manageUrl: manageUrl(token),
  };
  const [guest, owner] = await Promise.all([
    notifyReservation(r.conta_id, r.id, "confirmacao_convidado", {
      to: data.guestEmail, replyTo: data.ownerEmail, fromName: data.ownerName, email: confirmationToGuest(data),
    }),
    notifyReservation(r.conta_id, r.id, "aviso_dono_nova", {
      to: data.ownerEmail, replyTo: data.guestEmail, fromName: data.ownerName, email: newBookingToOwner(data),
    }),
  ]);
  return { confirmacao_convidado: guest, aviso_dono_nova: owner };
}
