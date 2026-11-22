// Pedido de autorização (plano 9.6): o que a tela /oauth/autorizar e a rota que grava a decisão
// conferem do mesmo jeito. Nenhum erro redireciona: qualquer pessoa registra um cliente com o
// redirect_uri que quiser, então redirecionar um pedido malformado faria do reuniao.app.br um
// redirecionador aberto (RFC 9700 §4.11.2). Só "Permitir" e "Cancelar", com sessão, voltam.
import "server-only";
import { findClient, type OAuthClient } from "./server";

export type AuthorizeRequest = { client: OAuthClient; redirectUri: string; codeChallenge: string; state: string | null };
export type AuthorizeCheck = { ok: true; req: AuthorizeRequest } | { ok: false; error: string };
export const AUTHORIZE_PARAMS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"] as const;

// Confere os parâmetros. Devolve: o pedido válido ou o código do erro (a tela mostra a mensagem).
export async function checkAuthorizeParams(p: Record<string, string | undefined>): Promise<AuthorizeCheck> {
  const client = await findClient(p.client_id);
  const redirectUri = p.redirect_uri ?? "";
  if (!client || !client.redirect_uris.includes(redirectUri)) return { ok: false, error: "invalid_request" };
  if (p.response_type !== "code") return { ok: false, error: "unsupported_response_type" };
  if (p.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge ?? "")) return { ok: false, error: "invalid_request" };
  return { ok: true, req: { client, redirectUri, codeChallenge: p.code_challenge!, state: p.state ?? null } };
}

// Acrescenta parâmetros à URL de retorno do cliente (mantendo os que ela já tem).
export function withParams(uri: string, params: Record<string, string>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// Host para onde a pessoa volta (no consentimento: o nome o cliente escolhe; o endereço não mente).
export function redirectHost(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}
