// PUT /api/painel/disponibilidade/semanal — troca todas as faixas semanais da conta (seção 13, épico 8.3).
// Erros: 401, 403, 422 dados_invalidos / faixa_sobreposta.
import type { NextRequest } from "next/server";
import { weeklySchema } from "@/features/availability/schema";
import { requireConta } from "@/server/auth/require-conta";
import { AvailabilityError, replaceWeeklyRanges } from "@/server/db/availability";
import { apiError, parseBody } from "@/server/http";
import { track } from "@/server/analytics/track";

// PUT: grava o bloco "Horários semanais" inteiro de uma vez (ag_fn_substitui_horarios).
export async function PUT(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, weeklySchema);
  if (body instanceof Response) return body;
  try {
    await replaceWeeklyRanges(account.id, body.faixas);
    track({ nome: "reuniao_disponibilidade_salva", contaId: account.id, tela: "disponibilidade", descricao: "dono salvou os horários da semana", propriedades: { faixas: body.faixas.length } });
    return new Response(null, { status: 200 });
  } catch (e) {
    if (e instanceof AvailabilityError) return apiError(e.code, 422);
    throw e;
  }
}
