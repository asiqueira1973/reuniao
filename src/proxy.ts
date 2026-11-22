// Proxy do Next 16 (antigo middleware) — seções 6 e 10.
// 1) Painel: checagem otimista; /painel sem cookie de sessão válido vai para /entrar e o cookie
//    com mais de 7 dias é renovado. A autorização de verdade é feita por requireConta() /
//    getCurrentAccount().
// 2) "/" (página inicial, v0.5): com sessão, vai para o painel.
// 3) Páginas públicas (/{slug}, /{slug}/{tipo}, /{slug}/{tipo}/confirmado): confere conta e tipo
//    antes de a página começar a ser enviada, porque página com streaming responde sempre 200;
//    endereço inexistente é reescrito para a página 404 com status 404 (critério 8.5).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, shouldRenew, signSession, verifySession } from "@/server/auth/session";
import { publicPathExists } from "@/server/db/public";
import { RESERVED_ACCOUNT_SLUGS } from "@/lib/slug";

const PUBLIC_PATH = /^\/([a-z0-9-]{1,40})(?:\/([a-z0-9-]{1,40})(?:\/confirmado)?)?\/?$/;

// Painel: exige cookie de sessão válido e renova se tiver mais de 7 dias.
async function guardPanel(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/entrar", request.url));
  const res = NextResponse.next();
  if (shouldRenew(session)) res.cookies.set(SESSION_COOKIE, await signSession(session.contaId), sessionCookieOptions());
  return res;
}

// Decide o que fazer com cada requisição que passa pelo matcher.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/painel" || path.startsWith("/painel/")) return guardPanel(request);
  // Página inicial (v0.5): quem já tem sessão vai direto para o painel.
  if (path === "/") {
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    return session ? NextResponse.redirect(new URL("/painel/tipos", request.url)) : NextResponse.next();
  }

  // MCP e OAuth (plano 9.6) são rotas do app, não endereços de agenda.
  if (path === "/mcp" || path.startsWith("/oauth/")) return NextResponse.next();
  const match = PUBLIC_PATH.exec(path);
  if (!match || (RESERVED_ACCOUNT_SLUGS as readonly string[]).includes(match[1])) return NextResponse.next();
  if (await publicPathExists(match[1], match[2])) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  // Painel e qualquer caminho que possa ser uma página pública (fora de api, _next, arquivos e
  // das rotas do app).
  matcher: ["/", "/painel", "/painel/:path*", "/((?!api|_next|entrar|sair|r/|.*\\..*).+)"],
};
