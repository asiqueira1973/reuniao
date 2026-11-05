// GET /api/disponibilidade?conta=&tipo=&de=&ate= — horários livres de um tipo (seção 13, épico 8.4).
// Público (convidado). de/ate são obrigatórios: datas AAAA-MM-DD no fuso da conta, de ≤ ate, no
// máximo 42 dias (seção 13). Respostas: 200 { fuso_conta, dias: [{ data, horarios: [iso] }] };
// 404 nao_encontrado / tipo_indisponivel; 422 dados_invalidos; 503 servico_indisponivel /
// agenda_indisponivel (princípio 2: nenhum horário quando a agenda não pôde ser conferida).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { addDays } from "@/features/availability/holidays";
import { AvailabilityLookupError, getAvailability } from "@/server/availability";
import { CalendarError } from "@/server/google/calendar";
import { getPublicAccount } from "@/server/db/public";
import { apiError, runAfterResponse } from "@/server/http";
import { ensureReconnectNotice } from "@/server/notifications";

const MAX_SPAN_DAYS = 42;

const querySchema = z
  .object({
    conta: z.string().min(1).max(30),
    tipo: z.string().min(1).max(30),
    de: z.iso.date(),
    ate: z.iso.date(),
  })
  .refine((q) => q.de <= q.ate && q.ate < addDays(q.de, MAX_SPAN_DAYS));

// GET: valida a consulta e devolve os dias com horários livres.
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return apiError("dados_invalidos", 422);
  const q = parsed.data;
  try {
    const { fuso_conta, dias } = await getAvailability({ accountSlug: q.conta, typeSlug: q.tipo, from: q.de, to: q.ate });
    return Response.json({ fuso_conta, dias }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof AvailabilityLookupError) {
      if (e.code === "agenda_indisponivel") {
        // Seção 6: avisa o dono uma vez para reconectar (depois de responder ao convidado).
        runAfterResponse(async () => {
          const conta = await getPublicAccount(q.conta);
          if (conta) await ensureReconnectNotice(conta.id);
        });
        return apiError(e.code, 503);
      }
      return apiError(e.code, 404);
    }
    if (e instanceof CalendarError) return apiError(e.code, 503);
    throw e;
  }
}
