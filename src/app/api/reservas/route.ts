// POST /api/reservas — o convidado marca uma reunião (seção 13, épico 8.5). Público.
// Entrada { conta, tipo, inicio, nome, email, observacao?, fuso, site }: qualquer outro campo é
// ignorado (critério 8.5); o fim é calculado no servidor. Respostas: 201 { id, inicio, fim, link_meet } + cookie
// curto da tela de confirmado; 404 nao_encontrado/tipo_indisponivel; 409 horario_indisponivel;
// 422 dados_invalidos; 429 limite_excedido; 503 servico_indisponivel/agenda_indisponivel.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CONFIRMATION_COOKIE, confirmationCookieOptions, signConfirmation } from "@/server/auth/confirmation";
import { BookingError, createBooking } from "@/server/booking";
import { apiError, parseBody } from "@/server/http";

// Fuso IANA válido (regra 11.3).
function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const bodySchema = z
  .object({
    conta: z.string().min(1).max(30),
    tipo: z.string().min(1).max(30),
    inicio: z.iso.datetime({ offset: true }),
    nome: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    observacao: z.string().max(1000).nullable().optional(),
    fuso: z.string().max(64).refine(isTimeZone),
    site: z.string().max(200).optional(),
  });

const STATUS: Record<BookingError["code"], number> = {
  nao_encontrado: 404,
  tipo_indisponivel: 404,
  horario_indisponivel: 409,
  limite_excedido: 429,
  agenda_indisponivel: 503,
  servico_indisponivel: 503,
};

// POST: valida, cria a reserva e grava o cookie da tela de confirmado.
export async function POST(req: NextRequest) {
  const body = await parseBody(req, bodySchema);
  if (body instanceof Response) return body;
  try {
    const { token: _token, ...result } = await createBooking(body);
    void _token;
    const res = NextResponse.json(result, { status: 201 });
    res.cookies.set(CONFIRMATION_COOKIE, await signConfirmation(result.id), confirmationCookieOptions());
    return res;
  } catch (e) {
    if (e instanceof BookingError) return apiError(e.code, STATUS[e.code]);
    throw e;
  }
}
