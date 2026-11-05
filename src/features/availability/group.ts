// Exibição dos horários no fuso do convidado — regra 11.1. Puro: a página pública agrupa os
// horários (ISO UTC vindos do servidor) por data local do convidado e mostra a hora local;
// trocar o fuso não chama o servidor.

const dateFmt = new Map<string, Intl.DateTimeFormat>();
const timeFmt = new Map<string, Intl.DateTimeFormat>();

// Formatador de data "AAAA-MM-DD" (en-CA) por fuso, com cache.
function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dateFmt.get(timeZone);
  if (!f) dateFmt.set(timeZone, (f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })));
  return f;
}

// Data civil local de um instante ISO no fuso dado.
export function localDate(iso: string, timeZone: string): string {
  return dateFormatter(timeZone).format(new Date(iso));
}

// Hora local "HH:MM" (24 h) de um instante ISO no fuso dado.
export function localTime(iso: string, timeZone: string): string {
  let f = timeFmt.get(timeZone);
  if (!f) timeFmt.set(timeZone, (f = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })));
  return f.format(new Date(iso));
}

// Agrupa horários ISO pela data local do convidado, mantendo a ordem.
export function groupByLocalDate(isoList: string[], timeZone: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const iso of isoList) (out[localDate(iso, timeZone)] ??= []).push(iso);
  return out;
}
