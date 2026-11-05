// Faixas de horário "HH:MM" da disponibilidade — seção 7.3 (múltiplo de 5, fim > início) e a
// regra de ag_fn_valida_faixas (sem sobreposição; encostar não é sobrepor). Puro: editor e rotas.

export type TimeRange = { inicio: string; fim: string };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "HH:MM" válido e múltiplo de 5 minutos.
export function isValidTime(t: string): boolean {
  const m = TIME.exec(t);
  return !!m && Number(m[2]) % 5 === 0;
}

// Minutos desde 00:00.
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Minutos → "HH:MM"; aceita também o "HH:MM:SS" do banco (corta os segundos).
export function toHHMM(v: number | string): string {
  if (typeof v === "string") return v.slice(0, 5);
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

// Faixa válida: horários válidos e fim depois do início.
export function isValidRange(r: TimeRange): boolean {
  return isValidTime(r.inicio) && isValidTime(r.fim) && toMinutes(r.fim) > toMinutes(r.inicio);
}

// Diz se alguma faixa do grupo (mesmo dia/data) cruza outra. 12:00–13:00 e 13:00–14:00 não cruzam.
export function findOverlap(ranges: TimeRange[]): boolean {
  const sorted = [...ranges].sort((a, b) => toMinutes(a.inicio) - toMinutes(b.inicio));
  return sorted.some((r, i) => i > 0 && toMinutes(r.inicio) < toMinutes(sorted[i - 1].fim));
}

const LAST = 23 * 60 + 55;

// Faixa sugerida ao tocar em "+": dia vazio → 09:00–17:00; senão uma hora começando uma hora
// depois do fim da última faixa (limitada a 23:55). Devolve null se não couber mais nada.
export function nextDefaultRange(ranges: TimeRange[]): TimeRange | null {
  // Faixa com campo apagado ou inválido não conta para a sugestão (evitaria NaN).
  const valid = ranges.filter((r) => isValidTime(r.fim));
  if (valid.length === 0) return { inicio: "09:00", fim: "17:00" };
  const lastEnd = Math.max(...valid.map((r) => toMinutes(r.fim)));
  if (lastEnd >= LAST) return null;
  const start = Math.min(lastEnd + 60, LAST - 55);
  const begin = Math.max(start, lastEnd);
  return { inicio: toHHMM(begin), fim: toHHMM(Math.min(begin + 60, LAST)) };
}
