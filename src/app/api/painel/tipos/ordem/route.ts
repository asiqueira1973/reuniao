// POST /api/painel/tipos/ordem — grava a nova ordem dos tipos da conta (seção 13, critério 8.2 "reordenar").
// Recebe { ids: uuid[] } na ordem desejada; ids de outra conta são ignorados.
import type { NextRequest } from "next/server";
import { reorderSchema } from "@/features/event-types/schema";
import { requireConta } from "@/server/auth/require-conta";
import { reorderEventTypes } from "@/server/db/event-types";
import { parseBody } from "@/server/http";

// POST: grava ordem = posição de cada id na lista recebida.
export async function POST(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, reorderSchema);
  if (body instanceof Response) return body;
  await reorderEventTypes(account.id, body.ids);
  return new Response(null, { status: 200 });
}
