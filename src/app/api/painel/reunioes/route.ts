// GET /api/painel/reunioes?aba=proximas|passadas|canceladas&pagina=0 — reuniões da conta da sessão
// (seção 13, épico 8.7). 50 por página. 401 sem sessão; 422 aba inválida.
import type { NextRequest } from "next/server";
import { requireConta } from "@/server/auth/require-conta";
import { listMeetings, MEETING_TABS, type MeetingTab } from "@/server/db/meetings";
import { apiError } from "@/server/http";

// GET: uma página de uma aba.
export async function GET(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const tab = (req.nextUrl.searchParams.get("aba") ?? "proximas") as MeetingTab;
  const page = Number(req.nextUrl.searchParams.get("pagina") ?? "0");
  if (!MEETING_TABS.includes(tab) || !Number.isInteger(page) || page < 0) return apiError("dados_invalidos", 422);
  return Response.json(await listMeetings(account.id, tab, new Date(), page));
}
