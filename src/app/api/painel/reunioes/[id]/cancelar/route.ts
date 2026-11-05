// POST /api/painel/reunioes/[id]/cancelar — o dono cancela uma reunião (seção 13, épico 8.7).
// Entrada { motivo? } (vai para o convidado). 200 · 404 · 409 · 422 · 503.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireConta } from "@/server/auth/require-conta";
import { apiError, parseBody } from "@/server/http";
import { cancelByOwner, OwnerActionError } from "@/server/owner-actions";
import { OWNER_STATUS } from "@/server/owner-status";

const bodySchema = z.object({ motivo: z.string().max(500).nullable().optional() });

// POST: cancela e avisa o convidado.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/painel/reunioes/[id]/cancelar">) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError("nao_encontrado", 404);
  const body = await parseBody(req, bodySchema);
  if (body instanceof Response) return body;
  try {
    await cancelByOwner(account.id, id, body.motivo ?? null);
    return new Response(null, { status: 200 });
  } catch (e) {
    if (e instanceof OwnerActionError) return apiError(e.code, OWNER_STATUS[e.code]);
    throw e;
  }
}
