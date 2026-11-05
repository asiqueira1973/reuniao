// POST /api/painel/notificacoes/[id]/reenviar — reenvia um e-mail que falhou (seção 13, épico 8.7).
// 200 { status } · 404 · 409 limite_tentativas / transicao_invalida (já enviado).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireConta } from "@/server/auth/require-conta";
import { apiError } from "@/server/http";
import { OwnerActionError, resendNotification } from "@/server/owner-actions";
import { OWNER_STATUS } from "@/server/owner-status";

// POST: tenta reenviar e devolve a nova situação do e-mail.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/painel/notificacoes/[id]/reenviar">) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError("nao_encontrado", 404);
  try {
    return Response.json({ status: await resendNotification(account.id, id) });
  } catch (e) {
    if (e instanceof OwnerActionError) return apiError(e.code, OWNER_STATUS[e.code]);
    throw e;
  }
}
