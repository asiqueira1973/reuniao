// GET /api/painel/reunioes/[id] — detalhe de uma reunião da conta (seção 13, épico 8.7).
// Reunião de outra conta (ou processando/falhou/remarcada) → 404.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireConta } from "@/server/auth/require-conta";
import { getMeeting } from "@/server/db/meetings";
import { apiError } from "@/server/http";

// GET: detalhe com histórico e e-mails.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/painel/reunioes/[id]">) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const { id } = await ctx.params;
  const meeting = z.uuid().safeParse(id).success ? await getMeeting(account.id, id) : null;
  return meeting ? Response.json({ reuniao: meeting }) : apiError("nao_encontrado", 404);
}
