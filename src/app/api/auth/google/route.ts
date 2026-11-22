// GET /api/auth/google — início do login com Google (seção 6, tabela 13).
// Gera o state aleatório, guarda em cookie curto HttpOnly (10 min) e redireciona ao Google.
// ?volta= (plano 9.6): caminho para onde voltar depois do login, só a tela de autorização do MCP.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isSafeReturnPath, LOGIN_RETURN_COOKIE, OAUTH_STATE_COOKIE, OAUTH_STATE_PATH } from "@/server/auth/oauth-state";
import { buildAuthUrl } from "@/server/google/oauth";

export async function GET(req: NextRequest) {
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(buildAuthUrl(state), 302);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_STATE_PATH,
    maxAge: 600,
  });
  const volta = req.nextUrl.searchParams.get("volta");
  if (isSafeReturnPath(volta)) {
    res.cookies.set(LOGIN_RETURN_COOKIE, volta, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: OAUTH_STATE_PATH, maxAge: 600 });
  }
  return res;
}
