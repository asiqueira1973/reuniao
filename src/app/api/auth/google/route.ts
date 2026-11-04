// GET /api/auth/google — início do login com Google (seção 6, tabela 13).
// Gera o state aleatório, guarda em cookie curto HttpOnly (10 min) e redireciona ao Google.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_PATH } from "@/server/auth/oauth-state";
import { buildAuthUrl } from "@/server/google/oauth";

export async function GET() {
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(buildAuthUrl(state), 302);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_STATE_PATH,
    maxAge: 600,
  });
  return res;
}
