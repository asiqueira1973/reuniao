// POST /oauth/token — plano 9.6: troca o código pelo token, conferindo (numa transação) código
// existente, não usado, não vencido, do mesmo cliente, mesmo redirect_uri e PKCE S256. Aceita
// form-urlencoded (o padrão) ou JSON. Resposta {access_token, token_type}, sem expires_in.
// Código reutilizado (que também revoga o token já emitido com ele) ou PKCE errado → invalid_grant.
import { corsHeaders, exchangeCode, findClient, oauthError, oauthJson } from "@/server/oauth/server";

async function fields(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  }
  const form = await req.formData().catch(() => null);
  return form ? Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""])) : {};
}

// code_verifier do PKCE (RFC 7636): 43 a 128 caracteres sem reserva.
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

export async function POST(req: Request) {
  const f = await fields(req);
  if (f.grant_type !== "authorization_code") return oauthError("unsupported_grant_type", "Só authorization_code.");
  if (!f.code || !f.client_id || !f.redirect_uri || !VERIFIER.test(f.code_verifier ?? "")) {
    return oauthError("invalid_request", "Faltam code, client_id, redirect_uri ou code_verifier.");
  }
  try {
    if (!(await findClient(f.client_id))) return oauthError("invalid_client", "Cliente desconhecido.", 401);
    const token = await exchangeCode(f.code, f.client_id, f.redirect_uri, f.code_verifier);
    if (!token) return oauthError("invalid_grant", "Código inválido, vencido ou já usado.");
    return oauthJson({ access_token: token, token_type: "Bearer" });
  } catch {
    console.error("oauth_token_falhou");
    return oauthError("server_error", "Tente de novo.", 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
