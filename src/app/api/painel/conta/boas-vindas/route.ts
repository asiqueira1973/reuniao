// POST /api/painel/conta/boas-vindas — conclui o primeiro acesso (spec v0.5, épico 8.11).
// Entrada { nome_exibicao, slug, fuso, aceite: true }. Grava os dados e o instante do aceite dos
// Termos e da Privacidade. 200 · 401 · 409 slug_em_uso · 422 (sem aceite, slug reservado, fuso inválido).
import type { NextRequest } from "next/server";
import { welcomeSchema } from "@/features/account/schema";
import { requireConta } from "@/server/auth/require-conta";
import { AccountError, completeWelcome } from "@/server/db/account-settings";
import { apiError, parseBody } from "@/server/http";

export async function POST(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, welcomeSchema);
  if (body instanceof Response) return body;
  try {
    await completeWelcome(account.id, { nome_exibicao: body.nome_exibicao, slug: body.slug, fuso: body.fuso });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AccountError) return apiError(e.code, e.code === "slug_em_uso" ? 409 : 404);
    throw e;
  }
}
