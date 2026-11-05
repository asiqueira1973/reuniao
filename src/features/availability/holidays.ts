// Feriados nacionais do Brasil — regra 11.4. Puro: datas como "AAAA-MM-DD" (data civil, sem fuso).
// Tabela de códigos, padrão de conta nova, cálculo da Páscoa e dos feriados móveis.
import { copy } from "@/lib/copy";

export type HolidayCode =
  | "confraternizacao" | "carnaval_segunda" | "carnaval_terca" | "cinzas" | "sexta_santa"
  | "tiradentes" | "trabalho" | "corpus_christi" | "independencia" | "aparecida" | "finados"
  | "republica" | "consciencia_negra" | "natal";

// Tabela 11.4: código, nome exibido e se nasce ligado na conta nova.
export const HOLIDAYS: ReadonlyArray<{ code: HolidayCode; name: string; onByDefault: boolean }> = [
  { code: "confraternizacao", name: copy.holidays.confraternizacao, onByDefault: true },
  { code: "carnaval_segunda", name: copy.holidays.carnaval_segunda, onByDefault: false },
  { code: "carnaval_terca", name: copy.holidays.carnaval_terca, onByDefault: false },
  { code: "cinzas", name: copy.holidays.cinzas, onByDefault: false },
  { code: "sexta_santa", name: copy.holidays.sexta_santa, onByDefault: true },
  { code: "tiradentes", name: copy.holidays.tiradentes, onByDefault: true },
  { code: "trabalho", name: copy.holidays.trabalho, onByDefault: true },
  { code: "corpus_christi", name: copy.holidays.corpus_christi, onByDefault: false },
  { code: "independencia", name: copy.holidays.independencia, onByDefault: true },
  { code: "aparecida", name: copy.holidays.aparecida, onByDefault: true },
  { code: "finados", name: copy.holidays.finados, onByDefault: true },
  { code: "republica", name: copy.holidays.republica, onByDefault: true },
  { code: "consciencia_negra", name: copy.holidays.consciencia_negra, onByDefault: true },
  { code: "natal", name: copy.holidays.natal, onByDefault: true },
];

// Códigos que a conta nova já grava em feriados_desligados (regra 11.4: "ligado por padrão = não").
export const DEFAULT_DISABLED_HOLIDAYS: HolidayCode[] = HOLIDAYS.filter((h) => !h.onByDefault).map((h) => h.code);

// Formata ano/mês/dia em "AAAA-MM-DD".
function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Soma dias a uma data "AAAA-MM-DD" (aritmética em UTC, sem efeito de horário de verão).
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Domingo de Páscoa pelo algoritmo gregoriano anônimo (Meeus/Jones/Butcher) — regra 11.4.
export function easterDate(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

// Datas de todos os feriados da tabela 11.4 num ano.
export function holidayDates(year: number): Record<HolidayCode, string> {
  const easter = easterDate(year);
  return {
    confraternizacao: ymd(year, 1, 1),
    carnaval_segunda: addDays(easter, -48),
    carnaval_terca: addDays(easter, -47),
    cinzas: addDays(easter, -46),
    sexta_santa: addDays(easter, -2),
    tiradentes: ymd(year, 4, 21),
    trabalho: ymd(year, 5, 1),
    corpus_christi: addDays(easter, 60),
    independencia: ymd(year, 9, 7),
    aparecida: ymd(year, 10, 12),
    finados: ymd(year, 11, 2),
    republica: ymd(year, 11, 15),
    consciencia_negra: ymd(year, 11, 20),
    natal: ymd(year, 12, 25),
  };
}

// Próxima data do feriado a partir de "hoje" (inclusive): a deste ano ou a do ano seguinte.
export function nextHolidayDate(code: HolidayCode, today: string): string {
  const year = Number(today.slice(0, 4));
  const thisYear = holidayDates(year)[code];
  return thisYear >= today ? thisYear : holidayDates(year + 1)[code];
}

export type HolidaySettings = { feriados_ativos: boolean; feriados_desligados: readonly string[] };

// Feriado ativo = chave geral ligada e código fora de feriados_desligados (regra 11.4).
export function isHolidayActive(code: HolidayCode, settings: HolidaySettings): boolean {
  return settings.feriados_ativos && !settings.feriados_desligados.includes(code);
}

// Códigos de feriado ativos que caem na data (para o motor do 8.4).
export function activeHolidaysOn(date: string, settings: HolidaySettings): HolidayCode[] {
  const all = holidayDates(Number(date.slice(0, 4)));
  return HOLIDAYS.map((h) => h.code).filter((c) => all[c] === date && isHolidayActive(c, settings));
}

// Diz se o texto é um código de feriado conhecido.
export function isHolidayCode(v: string): v is HolidayCode {
  return HOLIDAYS.some((h) => h.code === v);
}
