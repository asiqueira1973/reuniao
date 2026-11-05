// Motor de disponibilidade — regra 11.2 (computeSlots). Puro: sem I/O, sem relógio próprio
// (recebe "agora"), sem fuso do servidor (tudo no fuso da conta, regra 11.1). O servidor monta a
// entrada (faixas, datas, feriados, ocupados do Google + reservas) e a página pública só exibe.
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { activeHolidaysOn, addDays, type HolidaySettings } from "./holidays";
import { toMinutes, type TimeRange } from "./ranges";

export type SlotsInput = {
  eventType: {
    duracao_min: number;
    passo_min: number;
    antecedencia_min: number;
    janela_dias: number;
    intervalo_antes_min: number;
    intervalo_depois_min: number;
  };
  timeZone: string;
  weekly: { dia_semana: number; inicio: string; fim: string }[];
  overrides: { data: string; tipo: "indisponivel" | "horario_especial"; faixas: TimeRange[] }[];
  holidays: HolidaySettings;
  // Ocupados do Google (freebusy) e reservas ativas, em ISO; intervalos meio-abertos [inicio, fim).
  busy: { inicio: string; fim: string }[];
  now: Date;
  // Intervalo pedido (datas no fuso da conta, inclusive); recortado pela janela do tipo.
  from?: string;
  to?: string;
};

export type DaySlots = { data: string; horarios: string[] };

const MIN = 60_000;

// Instante UTC (ms) de uma hora local "HH:MM" (em minutos) numa data civil do fuso da conta.
function instantAt(date: string, minutes: number, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, timeZone).getTime();
}

// Faixas valendo numa data (passo 2 da regra 11.2): exceção da data > feriado ativo > semanal.
function rangesFor(date: string, input: SlotsInput): TimeRange[] {
  const override = input.overrides.find((o) => o.data === date);
  if (override) return override.tipo === "indisponivel" ? [] : override.faixas;
  if (activeHolidaysOn(date, input.holidays).length > 0) return [];
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return input.weekly.filter((w) => w.dia_semana === dow);
}

// Calcula os horários livres (regra 11.2). Devolve só os dias que têm pelo menos um horário,
// em ordem, cada um com os inícios em ISO UTC ordenados e sem repetição.
export function computeSlots(input: SlotsInput): DaySlots[] {
  const t = input.eventType;
  const today = format(new TZDate(input.now, input.timeZone), "yyyy-MM-dd");
  const lastDay = addDays(today, t.janela_dias - 1);
  const first = input.from && input.from > today ? input.from : today;
  const last = input.to && input.to < lastDay ? input.to : lastDay;
  const earliest = input.now.getTime() + t.antecedencia_min * MIN;
  const busy = input.busy.map((b) => [Date.parse(b.inicio), Date.parse(b.fim)] as const);
  // Princípio 2: um ocupado ilegível poderia esconder um compromisso; na dúvida, nenhum horário.
  if (busy.some(([bs, be]) => Number.isNaN(bs) || Number.isNaN(be))) return [];

  const days: DaySlots[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const found = new Set<number>();
    for (const range of rangesFor(date, input)) {
      const end = toMinutes(range.fim);
      // Passo 3: inícios a cada passo_min a partir do início da faixa, cabendo inteiros nela.
      for (let m = toMinutes(range.inicio); m + t.duracao_min <= end; m += t.passo_min) {
        const start = instantAt(date, m, input.timeZone);
        // Passo 4: antecedência mínima (exatamente na borda vale).
        if (start < earliest) continue;
        // Passo 5: [início − folga antes, fim + folga depois) não pode cruzar nenhum ocupado.
        const from = start - t.intervalo_antes_min * MIN;
        const to = start + (t.duracao_min + t.intervalo_depois_min) * MIN;
        if (busy.some(([bs, be]) => bs < to && from < be)) continue;
        found.add(start);
      }
    }
    if (found.size) days.push({ data: date, horarios: [...found].sort((a, b) => a - b).map((ms) => new Date(ms).toISOString()) });
  }
  return days;
}
