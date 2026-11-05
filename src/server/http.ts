// Utilidades das rotas de API — seção 13: erros sempre como { "erro": "<codigo>" }.
import "server-only";
import type { z } from "zod";

// Resposta de erro padrão da seção 13.
export function apiError(code: string, status: number): Response {
  return Response.json({ erro: code }, { status });
}

// Lê o corpo JSON e valida com o schema. Devolve os dados ou uma Response 422 dados_invalidos
// (corpo que não é JSON também é dados_invalidos).
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("dados_invalidos", 422);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return apiError("dados_invalidos", 422);
  return parsed.data;
}
