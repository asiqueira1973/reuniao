// POST /sair — encerra a sessão (seção 6). É formulário POST; nunca <Link href="/sair">.
// Apaga o cookie ag_sessao e redireciona (303) para /entrar.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/entrar", req.url), 303);
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}
