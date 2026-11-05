// GET /api/cron/diario — faxina diária chamada pelo cron da Vercel (seção 13, épico 8.9).
// Exige `Authorization: Bearer CRON_SECRET` (a Vercel envia sozinha quando a variável existe).
// Devolve 200 { reenviados, falhados, anonimizados } · 401 sem o segredo certo.
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { runDailyCleanup } from "@/server/cron";
import { apiError } from "@/server/http";

// Compara o cabeçalho com o segredo em tempo constante. Sem segredo configurado, ninguém passa.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return apiError("nao_autenticado", 401);
  return Response.json(await runDailyCleanup());
}
