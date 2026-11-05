// POST /api/reservas/gestao/cancelar — o convidado cancela pelo link (seção 13, épico 8.6).
// Entrada { token, motivo? }. 200 { dono } · 404 nao_encontrado · 409 transicao_invalida /
// reuniao_iniciada · 422 dados_invalidos · 503 servico_indisponivel / agenda_indisponivel.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, parseBody } from "@/server/http";
import { cancelByGuest, ManageError } from "@/server/manage";
import { MANAGE_STATUS } from "../status";

const bodySchema = z.object({ token: z.string().min(1).max(100), motivo: z.string().max(500).nullable().optional() });

// POST: cancela a reserva do token.
export async function POST(req: NextRequest) {
  const body = await parseBody(req, bodySchema);
  if (body instanceof Response) return body;
  try {
    const { ownerName } = await cancelByGuest(body.token, body.motivo ?? null);
    return Response.json({ dono: ownerName });
  } catch (e) {
    if (e instanceof ManageError) return apiError(e.code, MANAGE_STATUS[e.code]);
    throw e;
  }
}
