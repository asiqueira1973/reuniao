// Ajudantes dos testes de rota (seção 22): contas de teste no Supabase local e requisições com sessão.
// Cada conta tem slug e google_sub únicos; apague com deleteTestAccounts() no afterAll.
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { signSession } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const SITE = "http://localhost:3020";

// Cria uma conta de teste direto no banco. Devolve id, slug e o cookie de sessão pronto.
export async function createTestAccount(prefix = "teste") {
  const suffix = randomUUID().slice(0, 8);
  const slug = `${prefix}-${suffix}`;
  const { data, error } = await db()
    .from("ag_contas")
    .insert({ google_sub: `sub-${randomUUID()}`, email: `${slug}@teste.dev`, nome_exibicao: "Conta Teste", slug })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, slug, cookie: `ag_sessao=${await signSession(data.id)}` };
}

// Apaga as contas de teste (a cascata leva tipos, faixas e reservas).
export async function deleteTestAccounts(ids: string[]) {
  if (ids.length) await db().from("ag_contas").delete().in("id", ids);
}

// Monta uma requisição de API com cookie de sessão e Origin do site (seção 20).
export function apiRequest(path: string, opts: { method?: string; cookie?: string; body?: unknown; origin?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin !== null) headers.origin = opts.origin ?? SITE;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`${SITE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
  });
}

// Contexto de rota dinâmica do Next 16 (params é Promise).
export function routeCtx<P extends Record<string, string>>(params: P) {
  return { params: Promise.resolve(params) };
}
