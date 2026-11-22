// /api/painel/conta/assistentes/{id} — desconecta um assistente (plano 9.6).
// DELETE: revoga o token MCP da conta da sessão (200 · 404 nao_encontrado se não for dela ou já revogado).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireConta } from "@/server/auth/require-conta";
import { apiError } from "@/server/http";
import { revokeMcpConnection } from "@/server/oauth/tokens";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError("nao_encontrado", 404);
  if (!(await revokeMcpConnection(account.id, id))) return apiError("nao_encontrado", 404);
  return Response.json({ ok: true });
}
