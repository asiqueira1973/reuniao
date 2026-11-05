// PUT /api/painel/disponibilidade/feriados — chave geral e feriados desligados (seção 13, regra 11.4).
import type { NextRequest } from "next/server";
import { holidaysSchema } from "@/features/availability/schema";
import { requireConta } from "@/server/auth/require-conta";
import { updateHolidayState } from "@/server/db/availability";
import { parseBody } from "@/server/http";

// PUT: grava feriados_ativos e feriados_desligados da conta.
export async function PUT(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, holidaysSchema);
  if (body instanceof Response) return body;
  await updateHolidayState(account.id, body);
  return new Response(null, { status: 200 });
}
