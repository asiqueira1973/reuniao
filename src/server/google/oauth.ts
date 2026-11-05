// OAuth do Google: login do dono e conexão da agenda num único consentimento — seções 4 e 6.
// Monta a URL de consentimento, troca o código por tokens, valida o id_token e revoga tokens.
import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

// Escopos de agenda exigidos (seção 4): livre/ocupado (não sensível) e eventos das próprias agendas.
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events.owned",
] as const;
export const LOGIN_SCOPES = ["openid", "email", "profile", ...CALENDAR_SCOPES] as const;

// Endereço de retorno registrado no Google Cloud (README).
export function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`;
}

// Lê o Client ID do OAuth (README, passo 7). Lança erro se faltar a variável.
function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID ausente");
  return id;
}

// Monta a URL de consentimento (seção 6): offline + consent para receber o refresh token,
// select_account para escolher entre as contas Google. Recebe: state aleatório.
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: LOGIN_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "false",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export type GoogleTokens = {
  refreshToken: string | null;
  idToken: string;
  scopes: string[];
};

// Troca o código de autorização por tokens. Recebe: code do callback.
// Devolve: refresh token (pode faltar), id_token e escopos concedidos. Lança erro se o Google recusar.
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`google_token_${res.status}`);
  const body = (await res.json()) as { refresh_token?: string; id_token?: string; scope?: string };
  if (!body.id_token) throw new Error("google_sem_id_token");
  return {
    refreshToken: body.refresh_token ?? null,
    idToken: body.id_token,
    scopes: (body.scope ?? "").split(" ").filter(Boolean),
  };
}

// Diz se o dono concedeu as duas permissões de agenda (seção 6: o Google deixa desmarcar).
export function hasCalendarScopes(scopes: string[]): boolean {
  return CALENDAR_SCOPES.every((s) => scopes.includes(s));
}

export type GoogleIdentity = { sub: string; email: string; name: string };

let remoteJwks: JWTVerifyGetKey | null = null;

// Valida o id_token (seção 20: assinatura, aud, iss, exp) e devolve a identidade.
// Recebe: id_token e, nos testes, um conjunto de chaves local. Lança erro se inválido ou
// se o e-mail não for verificado pelo Google.
export async function verifyIdToken(idToken: string, jwks?: JWTVerifyGetKey): Promise<GoogleIdentity> {
  remoteJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks ?? remoteJwks, {
    audience: clientId(),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("id_token_incompleto");
  if (payload.email_verified !== true) throw new Error("email_nao_verificado");
  const email = payload.email.toLowerCase();
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0];
  return { sub: payload.sub, email, name };
}

// Revoga um token no Google (excluir conta, épico 8.8). Erros são ignorados: a conta é apagada
// de qualquer forma. Recebe: refresh token em claro.
export async function revokeToken(token: string): Promise<void> {
  try {
    const res = await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(5000),
    });
    // 400 invalid_token = já revogado. Outro erro: a conta é apagada mesmo assim; o dono pode
    // remover o acesso em myaccount.google.com/permissions. Sem log do token (seção 20).
    if (!res.ok && res.status !== 400) console.error("revogacao_falhou", { status: res.status });
  } catch {
    console.error("revogacao_falhou", { status: 0 });
  }
}
