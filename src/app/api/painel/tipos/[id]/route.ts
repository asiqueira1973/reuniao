// /api/painel/tipos/[id] — lê (GET), edita (PATCH) e exclui (DELETE, soft delete 7.4) um tipo da
// conta da sessão (seção 13, épico 8.2). Tipo de outra conta responde 404 (seção 5).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { patchEventTypeSchema } from "@/features/event-types/schema";
import { requireConta } from "@/server/auth/require-conta";
import { deleteEventType, EventTypeError, getEventType, updateEventType } from "@/server/db/event-types";
import { apiError, parseBody } from "@/server/http";

// Converte o erro de negócio em resposta HTTP (seção 13).
function toResponse(e: unknown): Response {
  if (e instanceof EventTypeError) {
    const status = e.code === "nao_encontrado" ? 404 : e.code === "slug_em_uso" ? 409 : 422;
    return apiError(e.code, status);
  }
  throw e;
}

// Id que não é uuid é tratado como inexistente (evita erro de tipo no banco).
async function readId(ctx: RouteContext<"/api/painel/tipos/[id]">): Promise<string | null> {
  const { id } = await ctx.params;
  return z.uuid().safeParse(id).success ? id : null;
}

// GET: um tipo da conta, ou 404.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/painel/tipos/[id]">) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const id = await readId(ctx);
  const tipo = id ? await getEventType(account.id, id) : null;
  return tipo ? Response.json({ tipo }) : apiError("nao_encontrado", 404);
}

// PATCH: muda só os campos enviados; corpo vazio devolve o tipo como está.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/painel/tipos/[id]">) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const id = await readId(ctx);
  if (!id) return apiError("nao_encontrado", 404);
  const patch = await parseBody(req, patchEventTypeSchema);
  if (patch instanceof Response) return patch;
  try {
    return Response.json({ tipo: await updateEventType(account.id, id, patch) });
  } catch (e) {
    return toResponse(e);
  }
}

// DELETE: soft delete (7.4); responde 204.
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/painel/tipos/[id]">) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const id = await readId(ctx);
  if (!id) return apiError("nao_encontrado", 404);
  try {
    await deleteEventType(account.id, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return toResponse(e);
  }
}
