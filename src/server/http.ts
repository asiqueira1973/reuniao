// Utilidades das rotas de API — seção 13: erros sempre como { "erro": "<codigo>" }.
import "server-only";
import { after } from "next/server";
import type { z } from "zod";

// Resposta de erro padrão da seção 13.
export function apiError(code: string, status: number): Response {
  return Response.json({ erro: code }, { status });
}

// Códigos de negócio que um schema pode marcar como mensagem do erro (ex.: faixa_sobreposta).
const ISSUE_CODES = new Set(["faixa_sobreposta", "slug_reservado"]);

// Lê o corpo JSON e valida com o schema. Devolve os dados ou uma Response 422 com o código de
// negócio marcado pelo schema, ou dados_invalidos (corpo que não é JSON também é dados_invalidos).
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("dados_invalidos", 422);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const marked = parsed.error.issues.find((i) => ISSUE_CODES.has(i.message));
    return apiError(marked ? marked.message : "dados_invalidos", 422);
  }
  return parsed.data;
}

// Agenda uma tarefa para depois da resposta (ex.: aviso por e-mail). Em requisição real usa o
// after() do Next; fora dela (scripts, testes), roda em segundo plano. Erros são engolidos: a
// tarefa nunca derruba a resposta já enviada.
export function runAfterResponse(task: () => Promise<void>): void {
  const safe = () => task().catch(() => undefined);
  try {
    after(safe);
  } catch {
    void safe();
  }
}
