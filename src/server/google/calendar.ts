// Google Calendar: access token e livre/ocupado — seções 4, 6, 11.10 e 17.
// O access token é obtido do refresh token cifrado a cada uso, com cache em memória até 5 min
// antes de expirar (11.10). freeBusy consulta só a agenda "primary", com timeout de 5 s por
// chamada e uma nova tentativa (17). invalid_grant marca a conexão como revogada (6).
// Nunca registra token nem dado da agenda em log (20).
import "server-only";
import { db } from "@/server/db/client";
import { decryptSecret } from "./crypto";
import { GOOGLE_TOKEN_URL } from "./oauth";

export const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
export const GOOGLE_TIMEOUT_MS = 5000;

// Erro de agenda com o código da seção 13: Google fora/lento ou conexão revogada.
export class CalendarError extends Error {
  constructor(public readonly code: "servico_indisponivel" | "agenda_indisponivel") {
    super(code);
  }
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// Limpa o cache de tokens (testes e reconexão).
export function clearTokenCache(contaId?: string) {
  if (contaId) tokenCache.delete(contaId);
  else tokenCache.clear();
}

// fetch com limite de tempo; estouro vira erro (AbortError).
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

// Marca a conexão como revogada (seção 6). O aviso por e-mail ao dono é disparado pelo 8.5,
// uma vez só, controlado por aviso_reconectar_enviado.
export async function markConnectionRevoked(contaId: string): Promise<void> {
  clearTokenCache(contaId);
  await db()
    .from("ag_conexoes_google")
    .update({ status: "revogada", revogada_em: new Date().toISOString() })
    .eq("conta_id", contaId)
    .eq("status", "ativa");
}

// Devolve um access token válido da conta. Lança agenda_indisponivel se a conexão não está
// ativa ou o Google recusou o refresh token; servico_indisponivel se o Google falhou.
export async function getAccessToken(contaId: string, timeoutMs = GOOGLE_TIMEOUT_MS): Promise<string> {
  const cached = tokenCache.get(contaId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const { data: conexao, error } = await db()
    .from("ag_conexoes_google")
    .select("status, refresh_token_cifrado")
    .eq("conta_id", contaId)
    .maybeSingle();
  if (error) throw error;
  if (!conexao || conexao.status !== "ativa") throw new CalendarError("agenda_indisponivel");

  let res: Response;
  try {
    res = await fetchWithTimeout(
      GOOGLE_TOKEN_URL,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID ?? "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          refresh_token: decryptSecret(conexao.refresh_token_cifrado),
          grant_type: "refresh_token",
        }),
      },
      timeoutMs,
    );
  } catch {
    throw new CalendarError("servico_indisponivel");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "invalid_grant") {
      await markConnectionRevoked(contaId);
      throw new CalendarError("agenda_indisponivel");
    }
    throw new CalendarError("servico_indisponivel");
  }
  const body = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache.set(contaId, {
    token: body.access_token,
    // Válido até 5 min antes de expirar (regra 11.10).
    expiresAt: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 300) * 1000,
  });
  return body.access_token;
}

// Períodos ocupados da agenda principal entre timeMin e timeMax (ISO). Uma nova tentativa em
// falha ou 401 (com token renovado). Qualquer falha final → servico_indisponivel (princípio 2:
// sem livre/ocupado, nenhum horário é oferecido).
export async function queryFreeBusy(
  contaId: string,
  timeMin: string,
  timeMax: string,
  timeoutMs = GOOGLE_TIMEOUT_MS,
): Promise<{ inicio: string; fim: string }[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(contaId, timeoutMs);
    let res: Response;
    try {
      res = await fetchWithTimeout(
        FREEBUSY_URL,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
        },
        timeoutMs,
      );
    } catch {
      continue;
    }
    if (res.status === 401) {
      clearTokenCache(contaId);
      continue;
    }
    if (!res.ok) continue;
    let body: { calendars?: { primary?: { busy?: { start: string; end: string }[]; errors?: unknown[] } } };
    try {
      body = await res.json();
    } catch {
      // Corpo ilegível ou cortado pelo timeout: tenta de novo e, no fim, servico_indisponivel.
      continue;
    }
    const primary = body.calendars?.primary;
    if (!primary || primary.errors?.length) continue;
    return (primary.busy ?? []).map((b) => ({ inicio: b.start, fim: b.end }));
  }
  throw new CalendarError("servico_indisponivel");
}
