// Disponibilidade do dono — seções 7.3/7.5 e épico 8.3: faixas semanais, datas específicas e
// feriados. Todo helper recebe conta_id (a service role ignora RLS, seção 6).
import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { DateOverrideInput, HolidaysInput } from "@/features/availability/schema";
import { toHHMM, type TimeRange } from "@/features/availability/ranges";
import { db } from "./client";

export type WeeklyRange = TimeRange & { dia_semana: number };
export type DateOverride = { data: string; tipo: "indisponivel" | "horario_especial"; faixas: TimeRange[] };
export type HolidayState = { feriados_ativos: boolean; feriados_desligados: string[] };

// Erro de negócio que sobe do banco com MESSAGE = código (seção 7.5).
export class AvailabilityError extends Error {
  constructor(public readonly code: "faixa_sobreposta" | "excecao_conflitante") {
    super(code);
  }
}

// Traduz o erro do banco: as funções de 7.5 levantam o código como mensagem.
function translate(error: { message?: string }): never {
  if (error.message === "faixa_sobreposta" || error.message === "excecao_conflitante") throw new AvailabilityError(error.message);
  throw error;
}

// Data de hoje ("AAAA-MM-DD") no fuso da conta (regra 11.1).
export function todayIn(timeZone: string, now = new Date()): string {
  return format(new TZDate(now, timeZone), "yyyy-MM-dd");
}

// Faixas semanais da conta, ordenadas por dia e início.
export async function getWeeklyRanges(contaId: string): Promise<WeeklyRange[]> {
  const { data, error } = await db()
    .from("ag_horarios_semanais")
    .select("dia_semana, inicio, fim")
    .eq("conta_id", contaId)
    .order("dia_semana")
    .order("inicio");
  if (error) throw error;
  return data.map((r) => ({ dia_semana: r.dia_semana, inicio: toHHMM(r.inicio), fim: toHHMM(r.fim) }));
}

// Troca todas as faixas semanais numa transação (ag_fn_substitui_horarios).
export async function replaceWeeklyRanges(contaId: string, faixas: WeeklyRange[]): Promise<void> {
  const { error } = await db().rpc("ag_fn_substitui_horarios", { p_conta_id: contaId, p_faixas: faixas });
  if (error) translate(error);
}

// Datas específicas de hoje em diante (no fuso da conta); as passadas ficam no banco mas não
// aparecem (critério 8.3). Agrupa as faixas de horário especial por data.
export async function listDateOverrides(contaId: string, today: string): Promise<DateOverride[]> {
  const { data, error } = await db()
    .from("ag_excecoes_data")
    .select("data, tipo, inicio, fim")
    .eq("conta_id", contaId)
    .gte("data", today)
    .order("data")
    .order("inicio");
  if (error) throw error;
  const byDate = new Map<string, DateOverride>();
  for (const r of data) {
    const item = byDate.get(r.data) ?? { data: r.data, tipo: r.tipo, faixas: [] };
    if (r.tipo === "horario_especial" && r.inicio && r.fim) item.faixas.push({ inicio: toHHMM(r.inicio), fim: toHHMM(r.fim) });
    byDate.set(r.data, item);
  }
  return [...byDate.values()];
}

// Grava uma data específica, substituindo o que havia nela (ag_fn_substitui_excecoes_data).
export async function replaceDateOverride(contaId: string, input: DateOverrideInput): Promise<void> {
  const { error } = await db().rpc("ag_fn_substitui_excecoes_data", {
    p_conta_id: contaId,
    p_data: input.data,
    p_tipo: input.tipo,
    p_faixas: input.tipo === "horario_especial" ? input.faixas : [],
  });
  if (error) translate(error);
}

// Remove a data específica (volta a valer o horário semanal). Idempotente: data que não existe
// na conta não muda nada (seção 13 responde 200 nos dois casos).
export async function deleteDateOverride(contaId: string, date: string): Promise<void> {
  const { error } = await db().from("ag_excecoes_data").delete().eq("conta_id", contaId).eq("data", date);
  if (error) throw error;
}

// Configuração de feriados e fuso da conta.
export async function getHolidayState(contaId: string): Promise<HolidayState & { fuso: string }> {
  const { data, error } = await db()
    .from("ag_contas")
    .select("feriados_ativos, feriados_desligados, fuso")
    .eq("id", contaId)
    .single();
  if (error) throw error;
  return data;
}

// Grava a chave geral e os feriados desligados (regra 11.4).
export async function updateHolidayState(contaId: string, input: HolidaysInput): Promise<void> {
  const { error } = await db()
    .from("ag_contas")
    .update({ feriados_ativos: input.feriados_ativos, feriados_desligados: [...new Set(input.feriados_desligados)] })
    .eq("id", contaId);
  if (error) throw error;
}
