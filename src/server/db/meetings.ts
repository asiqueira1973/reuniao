// Reuniões do dono — épico 8.7 e seção 10 ([Dono] Reuniões e Detalhe). Toda consulta recebe
// conta_id (a service role ignora RLS, seção 6). Reservas 'processando', 'falhou' e 'remarcada'
// não aparecem na lista (a remarcada vira histórico da reserva nova).
import "server-only";
import { db } from "./client";

export type MeetingTab = "proximas" | "passadas" | "canceladas";
export const MEETING_TABS: MeetingTab[] = ["proximas", "passadas", "canceladas"];
export const PAGE_SIZE = 50;

export type MeetingRow = {
  id: string;
  inicio: string;
  fim: string;
  nome_convidado: string;
  email_convidado: string;
  status: string;
  tipo: string;
};

// Lista uma aba (50 por página). Próximas: confirmadas que ainda não terminaram, da mais cedo
// para a mais tarde. Passadas: confirmadas já terminadas, da mais recente. Canceladas: as duas
// formas de cancelamento, da mais recente. Desempate por id para a paginação não repetir linhas.
export async function listMeetings(contaId: string, tab: MeetingTab, now: Date, page = 0): Promise<{ rows: MeetingRow[]; hasMore: boolean }> {
  let q = db()
    .from("ag_reservas")
    .select("id, inicio, fim, nome_convidado, email_convidado, status, ag_tipos_evento(nome)")
    .eq("conta_id", contaId);
  const nowIso = now.toISOString();
  if (tab === "proximas") q = q.eq("status", "confirmada").gt("fim", nowIso).order("inicio", { ascending: true }).order("id");
  else if (tab === "passadas") q = q.eq("status", "confirmada").lte("fim", nowIso).order("inicio", { ascending: false }).order("id");
  else q = q.in("status", ["cancelada_convidado", "cancelada_dono"]).order("inicio", { ascending: false }).order("id");
  const { data, error } = await q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (error) throw error;
  const rows = data.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id, inicio: r.inicio, fim: r.fim, nome_convidado: r.nome_convidado, email_convidado: r.email_convidado,
    status: r.status, tipo: r.ag_tipos_evento?.nome ?? "",
  }));
  return { rows, hasMore: data.length > PAGE_SIZE };
}

export type MeetingDetail = MeetingRow & {
  observacao: string | null;
  link_meet: string | null;
  motivo_cancelamento: string | null;
  cancelada_em: string | null;
  fuso_convidado: string;
  historico: string[]; // inícios anteriores (remarcações), do mais recente ao mais antigo
  notificacoes: { id: string; tipo: string; status: string; tentativas: number }[];
};

// Detalhe de uma reunião da conta (não mostra 'processando'/'falhou'/'remarcada'). Devolve null
// se não existir ou for de outra conta.
export async function getMeeting(contaId: string, id: string): Promise<MeetingDetail | null> {
  const { data: r, error } = await db()
    .from("ag_reservas")
    .select("id, inicio, fim, nome_convidado, email_convidado, status, observacao, link_meet, motivo_cancelamento, cancelada_em, fuso_convidado, remarcada_de_id, ag_tipos_evento(nome)")
    .eq("conta_id", contaId)
    .eq("id", id)
    .in("status", ["confirmada", "cancelada_convidado", "cancelada_dono"])
    .maybeSingle();
  if (error) throw error;
  if (!r) return null;

  // Histórico de remarcações: segue remarcada_de_id para trás (no máximo 20 elos).
  const historico: string[] = [];
  let prev = r.remarcada_de_id;
  for (let i = 0; prev && i < 20; i++) {
    const { data: p } = await db().from("ag_reservas").select("inicio, remarcada_de_id").eq("conta_id", contaId).eq("id", prev).maybeSingle();
    if (!p) break;
    historico.push(p.inicio);
    prev = p.remarcada_de_id;
  }

  const { data: notes, error: e2 } = await db()
    .from("ag_notificacoes")
    .select("id, tipo, status, tentativas")
    .eq("conta_id", contaId)
    .eq("reserva_id", id)
    .order("criado_em");
  if (e2) throw e2;

  return {
    id: r.id, inicio: r.inicio, fim: r.fim, nome_convidado: r.nome_convidado, email_convidado: r.email_convidado, status: r.status,
    tipo: r.ag_tipos_evento?.nome ?? "", observacao: r.observacao, link_meet: r.link_meet, motivo_cancelamento: r.motivo_cancelamento,
    cancelada_em: r.cancelada_em, fuso_convidado: r.fuso_convidado, historico, notificacoes: notes,
  };
}

// Reuniões confirmadas da conta que começam num intervalo [de, ate) — agenda do dia e da semana
// do MCP (plano 9.6). Da mais cedo para a mais tarde.
export async function listMeetingsBetween(contaId: string, fromIso: string, toIso: string): Promise<MeetingRow[]> {
  const { data, error } = await db()
    .from("ag_reservas")
    .select("id, inicio, fim, nome_convidado, email_convidado, status, ag_tipos_evento(nome)")
    .eq("conta_id", contaId)
    .eq("status", "confirmada")
    .gte("inicio", fromIso)
    .lt("inicio", toIso)
    .order("inicio", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id, inicio: r.inicio, fim: r.fim, nome_convidado: r.nome_convidado, email_convidado: r.email_convidado,
    status: r.status, tipo: r.ag_tipos_evento?.nome ?? "",
  }));
}
