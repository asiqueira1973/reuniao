// POST /api/reservas/gestao/remarcar — o convidado remarca pelo link (seção 13, épico 8.6).
// Entrada { token, inicio, fuso }. 201 { id, inicio, fim, link_meet } + cookie da tela de
// confirmado (o token novo vai só no e-mail) · 404 · 409 horario_indisponivel / transicao_invalida
// / reuniao_iniciada · 422 · 503.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CONFIRMATION_COOKIE, confirmationCookieOptions, signConfirmation } from "@/server/auth/confirmation";
import { apiError, parseBody } from "@/server/http";
import { ManageError, rescheduleByGuest } from "@/server/manage";
import { MANAGE_STATUS } from "../status";

// Fuso IANA válido.
function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const bodySchema = z.object({ token: z.string().min(1).max(100), inicio: z.iso.datetime({ offset: true }), fuso: z.string().max(64).refine(isTimeZone) });

// POST: remarca e grava o cookie da tela de confirmado da reserva nova.
export async function POST(req: NextRequest) {
  const body = await parseBody(req, bodySchema);
  if (body instanceof Response) return body;
  try {
    const r = await rescheduleByGuest(body.token, body.inicio, body.fuso);
    const res = NextResponse.json(r, { status: 201 });
    res.cookies.set(CONFIRMATION_COOKIE, await signConfirmation(r.id), confirmationCookieOptions());
    return res;
  } catch (e) {
    if (e instanceof ManageError) return apiError(e.code, MANAGE_STATUS[e.code]);
    throw e;
  }
}
