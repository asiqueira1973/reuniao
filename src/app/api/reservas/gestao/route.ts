// GET /api/reservas/gestao?token= — resumo público da reserva do token (seção 13, épico 8.6).
// Devolve só o que o convidado já sabe (tipo, horários, fuso, Meet, situação) e nunca ids de
// conta nem e-mails de terceiros. Token inválido → 404 nao_encontrado.
import type { NextRequest } from "next/server";
import { apiError } from "@/server/http";
import { getManageView } from "@/server/manage";

// GET: estado da reserva para a tela de gestão.
export async function GET(req: NextRequest) {
  const view = await getManageView(req.nextUrl.searchParams.get("token") ?? "");
  if (view.state === "invalid") return apiError("nao_encontrado", 404);
  const r = view.r;
  return Response.json(
    {
      estado: view.state,
      tipo: r.ag_tipos_evento!.nome,
      dono: r.ag_contas!.nome_exibicao,
      inicio: new Date(r.inicio).toISOString(),
      fim: new Date(r.fim).toISOString(),
      fuso: r.fuso_convidado,
      link_meet: r.link_meet,
      ...(view.state === "rescheduled" && view.newStart ? { novo_inicio: new Date(view.newStart).toISOString() } : {}),
    },
    { headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}
