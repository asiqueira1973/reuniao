// Proxy do Next 16 (antigo middleware) — seção 6.
// Checagem otimista do painel: /painel sem cookie de sessão válido vai para /entrar. Renova o
// cookie quando a sessão tem mais de 7 dias. A autorização de verdade é feita por
// requireConta()/getCurrentAccount() (o proxy não consulta o banco).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, shouldRenew, signSession, verifySession } from "@/server/auth/session";

export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/entrar", request.url));

  const res = NextResponse.next();
  if (shouldRenew(session)) {
    res.cookies.set(SESSION_COOKIE, await signSession(session.contaId), sessionCookieOptions());
  }
  return res;
}

export const config = {
  matcher: ["/painel", "/painel/:path*"],
};
