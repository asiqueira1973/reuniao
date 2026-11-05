// /api/painel/tipos — lista (GET) e cria (POST) tipos de evento da conta da sessão (seção 13, épico 8.2).
// Erros: 401 nao_autenticado, 403 origem_invalida, 422 dados_invalidos/slug_invalido, 409 slug_em_uso.
import type { NextRequest } from "next/server";
import { createEventTypeSchema } from "@/features/event-types/schema";
import { requireConta } from "@/server/auth/require-conta";
import { createEventType, EventTypeError, listEventTypes } from "@/server/db/event-types";
import { apiError, parseBody } from "@/server/http";

// GET: tipos não excluídos da conta, na ordem do painel.
export async function GET(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  return Response.json({ tipos: await listEventTypes(account.id) });
}

// POST: cria um tipo; só nome é obrigatório (critério 8.2).
export async function POST(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const input = await parseBody(req, createEventTypeSchema);
  if (input instanceof Response) return input;
  try {
    return Response.json({ tipo: await createEventType(account.id, input) }, { status: 201 });
  } catch (e) {
    if (e instanceof EventTypeError) return apiError(e.code, e.code === "slug_em_uso" ? 409 : 422);
    throw e;
  }
}
