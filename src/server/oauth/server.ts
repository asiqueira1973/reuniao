// Servidor de autorização OAuth 2.1 do MCP — plano 9.6 (mesmo desenho do Assina).
// Metadados (RFC 8414 e 9728), registro de cliente público (RFC 7591), código de autorização com
// PKCE S256 e troca pelo token `reuniao_mcp_…`. Só o hash do token fica no banco; ele vale até ser
// revogado em Conta (sem expires_in nem refresh token). Endereços sempre de NEXT_PUBLIC_SITE_URL.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db/client";
import { track } from "@/server/analytics/track";

export const MCP_TOKEN_PREFIX = "reuniao_mcp_";
export const CODE_SECONDS = 600;
const CLIENT_NAME_MAX = 100;
const REDIRECT_URIS_MAX = 5;
const REDIRECT_URI_MAX = 500;

// Origem pública do site (emissor e recurso).
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3020").replace(/\/+$/, "");
}
export const mcpResource = () => `${siteOrigin()}/mcp`;
export const resourceMetadataUrl = () => `${siteOrigin()}/.well-known/oauth-protected-resource/mcp`;

// SHA-256 hex de um segredo (código ou token): é o que vai para o banco.
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// S256 do PKCE. Recebe: o code_verifier. Devolve: base64url do SHA-256.
export function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// Diz se um redirect_uri pode ser registrado: https, ou http só em localhost/127.0.0.1 (cliente
// de desktop). Sem fragmento e sem credenciais na URL.
export function acceptableRedirectUri(uri: string): boolean {
  if (uri.length > REDIRECT_URI_MAX) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, mcp-method",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-expose-headers": "www-authenticate, mcp-session-id",
};
export function corsHeaders(): Record<string, string> {
  return CORS;
}

// Resposta JSON do fluxo OAuth (sem cache, com CORS).
export function oauthJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
}

// Erro no formato do OAuth 2.1 ({error, error_description}).
export function oauthError(error: string, description: string, status = 400): Response {
  return oauthJson({ error, error_description: description }, status);
}

export type OAuthClient = { id: string; nome: string; redirect_uris: string[] };

// Registra um cliente (RFC 7591). Recebe: nome e redirect_uris já conferidos. Devolve: o cliente.
export async function registerClient(nome: string, uris: string[]): Promise<OAuthClient> {
  const { data, error } = await db()
    .from("ag_oauth_clientes")
    .insert({ nome: nome.slice(0, CLIENT_NAME_MAX), redirect_uris: uris.slice(0, REDIRECT_URIS_MAX) })
    .select("id, nome, redirect_uris")
    .single();
  if (error) throw error;
  return data;
}

// Busca um cliente pelo client_id (o id da linha). Devolve: o cliente ou null.
export async function findClient(clientId: string | null | undefined): Promise<OAuthClient | null> {
  if (!clientId || !/^[0-9a-f-]{36}$/.test(clientId)) return null;
  const { data } = await db().from("ag_oauth_clientes").select("id, nome, redirect_uris").eq("id", clientId).maybeSingle();
  return data;
}

// "Permitir": grava o código (hash, 10 min) e devolve o valor em claro (vai só no redirect).
export async function createAuthorizationCode(client: OAuthClient, contaId: string, redirectUri: string, codeChallenge: string): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const { error } = await db().rpc("ag_fn_cria_codigo_oauth", {
    p_codigo_hash: hashSecret(code),
    p_cliente_id: client.id,
    p_conta_id: contaId,
    p_redirect_uri: redirectUri,
    p_code_challenge: codeChallenge,
    p_validade_s: CODE_SECONDS,
  });
  if (error) throw new Error(error.message === "invalid_request" || error.message === "invalid_client" ? error.message : "server_error");
  return code;
}

// Troca o código pelo token. Devolve: o token em claro ou null (invalid_grant).
export async function exchangeCode(code: string, clientId: string, redirectUri: string, verifier: string): Promise<string | null> {
  const token = MCP_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const { data, error } = await db().rpc("ag_fn_troca_codigo_oauth", {
    p_codigo_hash: hashSecret(code),
    p_cliente_id: clientId,
    p_redirect_uri: redirectUri,
    p_challenge_do_verifier: s256(verifier),
    p_token_hash: hashSecret(token),
    p_token_prefixo: token.slice(0, MCP_TOKEN_PREFIX.length + 4),
  });
  if (error) throw error;
  if (!data) return null;
  track({ nome: "reuniao_mcp_conectado", contaId: data, tela: "mcp", descricao: "dono conectou um assistente ao Reunião" });
  return token;
}
