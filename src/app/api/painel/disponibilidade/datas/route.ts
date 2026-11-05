// /api/painel/disponibilidade/datas — datas específicas da conta (seção 13, épico 8.3).
// PUT grava uma data (indisponível ou com faixas próprias), substituindo o que havia; DELETE a remove.
import type { NextRequest } from "next/server";
import { dateDeleteSchema, dateOverrideSchema } from "@/features/availability/schema";
import { requireConta } from "@/server/auth/require-conta";
import { AvailabilityError, deleteDateOverride, replaceDateOverride } from "@/server/db/availability";
import { apiError, parseBody } from "@/server/http";

// Converte o erro de negócio (faixa_sobreposta / excecao_conflitante) em 422 (seção 13).
function toResponse(e: unknown): Response {
  if (e instanceof AvailabilityError) return apiError(e.code, 422);
  throw e;
}

// PUT: grava a data específica (ag_fn_substitui_excecoes_data).
export async function PUT(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, dateOverrideSchema);
  if (body instanceof Response) return body;
  try {
    await replaceDateOverride(account.id, body);
    return new Response(null, { status: 200 });
  } catch (e) {
    return toResponse(e);
  }
}

// DELETE: remove a data específica; volta a valer o horário semanal. Responde 200 (seção 13).
export async function DELETE(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, dateDeleteSchema);
  if (body instanceof Response) return body;
  try {
    await deleteDateOverride(account.id, body.data);
    return new Response(null, { status: 200 });
  } catch (e) {
    return toResponse(e);
  }
}
