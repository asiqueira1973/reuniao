// Guardas de acesso do painel — seções 5, 6 e 20.
// requireConta(): primeira linha de toda rota /api/painel/* (devolve 401 sem sessão válida e
// 403 em escrita com Origin estranho). getCurrentAccount(): para Server Components do painel.
import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getAccountById, type Account } from "@/server/db/accounts";
import { SESSION_COOKIE, verifySession } from "./session";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Seção 20 (CSRF): escrita do painel só com Origin = NEXT_PUBLIC_SITE_URL.
function originAllowed(req: NextRequest): boolean {
  if (!WRITE_METHODS.has(req.method)) return true;
  const origin = req.headers.get("origin");
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return !!origin && !!site && origin === new URL(site).origin;
}

// Guarda das rotas de API do painel. Recebe: a requisição.
// Devolve: a conta da sessão, ou uma Response 401/403 pronta para retornar.
export async function requireConta(req: NextRequest): Promise<Account | Response> {
  if (!originAllowed(req)) return Response.json({ erro: "origem_invalida" }, { status: 403 });
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ erro: "nao_autenticado" }, { status: 401 });
  const account = await getAccountById(session.contaId);
  if (!account) return Response.json({ erro: "nao_autenticado" }, { status: 401 });
  return account;
}

// Lê a conta da sessão em Server Components (sempre dentro de <Suspense>, Cache Components).
// Devolve: a conta ou null (a página redireciona para /entrar).
export async function getCurrentAccount(): Promise<Account | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return getAccountById(session.contaId);
}
