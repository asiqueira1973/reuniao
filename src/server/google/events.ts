// Eventos no Google Agenda do dono — regra 11.5 (insert, patch, delete na agenda "primary").
// Sempre sendUpdates=all (o convidado recebe o convite/atualização oficial do Google). O id do
// evento deriva da reserva, então repetir o insert não duplica (409 → lê o evento existente).
// Timeout de 5 s; escrita não tem nova tentativa automática (seção 17). Nunca loga token/dados.
import "server-only";
import { CalendarError, getAccessToken, GOOGLE_TIMEOUT_MS } from "./calendar";

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type EventInput = {
  reservaId: string;
  summary: string;
  description: string;
  start: string; // ISO
  end: string; // ISO
  attendee: { email: string; name: string };
  withMeet: boolean;
};

export type CreatedEvent = { eventId: string; meetLink: string | null };

type GoogleEvent = {
  id: string;
  hangoutLink?: string;
  conferenceData?: { createRequest?: { status?: { statusCode?: string } } };
};

// Id do evento a partir da reserva (11.5): "ag" + uuid sem hífens (base32hex válido, 34 chars).
export function eventIdFor(reservaId: string): string {
  return `ag${reservaId.replace(/-/g, "")}`;
}

// Chamada autenticada à API de eventos, com timeout. Falha de rede/tempo → servico_indisponivel.
async function call(contaId: string, url: string, init: RequestInit): Promise<Response> {
  const token = await getAccessToken(contaId);
  try {
    return await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch {
    throw new CalendarError("servico_indisponivel");
  }
}

// Lê um evento pelo id (para o 409 do insert e para esperar o Meet).
async function getEvent(contaId: string, eventId: string): Promise<GoogleEvent> {
  const res = await call(contaId, `${EVENTS_URL}/${eventId}?conferenceDataVersion=1`, { method: "GET" });
  if (!res.ok) throw new CalendarError("servico_indisponivel");
  return res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cria o evento da reserva (11.5) e devolve id e link do Meet. Se a conferência voltar
// "pending", busca o evento de novo até 3× com 1 s; sem link no fim, segue sem Meet.
export async function insertEvent(contaId: string, input: EventInput, pollDelayMs = 1000): Promise<CreatedEvent> {
  const eventId = eventIdFor(input.reservaId);
  const body = {
    id: eventId,
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start },
    end: { dateTime: input.end },
    attendees: [{ email: input.attendee.email, displayName: input.attendee.name }],
    ...(input.withMeet
      ? { conferenceData: { createRequest: { requestId: input.reservaId, conferenceSolutionKey: { type: "hangoutsMeet" } } } }
      : {}),
  };
  const res = await call(contaId, `${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  let event: GoogleEvent;
  if (res.status === 409) event = await getEvent(contaId, eventId);
  else if (!res.ok) throw new CalendarError("servico_indisponivel");
  else event = await res.json();

  let meetLink = event.hangoutLink ?? null;
  for (let i = 0; input.withMeet && !meetLink && i < 3; i++) {
    if (event.conferenceData?.createRequest?.status?.statusCode !== "pending") break;
    await sleep(pollDelayMs);
    event = await getEvent(contaId, eventId);
    meetLink = event.hangoutLink ?? null;
  }
  return { eventId: event.id, meetLink };
}

// Muda o horário (e, se vier, a descrição) do evento — remarcação (seção 12, épico 8.6).
export async function patchEvent(contaId: string, eventId: string, patch: { start: string; end: string; description?: string }): Promise<void> {
  const res = await call(contaId, `${EVENTS_URL}/${eventId}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify({
      start: { dateTime: patch.start },
      end: { dateTime: patch.end },
      ...(patch.description ? { description: patch.description } : {}),
    }),
  });
  if (!res.ok) throw new CalendarError("servico_indisponivel");
}

// Apaga o evento — cancelamento (seção 12). Evento que já não existe (404/410) conta como apagado.
export async function deleteEvent(contaId: string, eventId: string): Promise<void> {
  const res = await call(contaId, `${EVENTS_URL}/${eventId}?sendUpdates=all`, { method: "DELETE" });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new CalendarError("servico_indisponivel");
}
