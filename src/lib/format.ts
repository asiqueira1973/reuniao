// Formatação de valores para a interface (seção 17: pt-BR, 24 h). Unidades vêm de copy.units.
import { copy } from "./copy";

const u = copy.units;

// Duração em minutos para texto curto: 30 → "30 min", 60 → "1 h", 90 → "1 h 30 min".
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} ${u.minutes}`;
  return m === 0 ? `${h} ${u.hours}` : `${h} ${u.hours} ${m} ${u.minutes}`;
}

// Link público de um tipo (critério 8.2 "Copiar link"): {site}/{slug-conta}/{slug-tipo}.
export function publicTypeUrl(siteUrl: string, accountSlug: string, typeSlug: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${accountSlug}/${typeSlug}`;
}

// Antecedência e intervalos em texto (editor do 8.2): 240 → "4 h", 1440 → "1 dia", 10080 → "7 dias".
export function formatMinutes(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const d = minutes / 1440;
    return d === 1 ? `1 ${u.day}` : `${d} ${u.days}`;
  }
  return formatDuration(minutes);
}

// Data civil "AAAA-MM-DD" por extenso (seção 17): "quarta-feira, 4 de novembro". Ano só quando
// diferente do ano de referência. Usa UTC ao meio-dia para não trocar de dia por fuso.
export function formatDateLong(date: string, referenceYear?: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  const withYear = referenceYear !== undefined && d.getUTCFullYear() !== referenceYear;
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC",
  }).format(d);
}

// Data curta como no Calendly: "1 de jan. de 2027".
export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

// Data e hora de um instante ISO num fuso, por extenso: "segunda-feira, 9 de novembro de 2026, 10:30".
export function formatDateTimeLong(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone,
  }).format(new Date(iso));
}

// Data e hora curtas para assuntos de e-mail (seção 15): "09/11 às 10:30".
export function formatDateTimeShort(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(d);
  return `${date} às ${time}`;
}

// Nome do fuso como o convidado reconhece: "Horário de Brasília", "Horário da Europa Ocidental"…
export function timeZoneName(timeZone: string): string {
  const part = new Intl.DateTimeFormat("pt-BR", { timeZone, timeZoneName: "longGeneric" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

// Assunto ao convidado (seção 15, "{dia, dd/mm às hh:mm}"): "seg., 09/11 às 13:30".
export function formatSubjectGuest(iso: string, timeZone: string): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone }).format(new Date(iso));
  return `${weekday}, ${formatDateTimeShort(iso, timeZone)}`;
}

// Assunto ao dono (seção 15, "{dd/mm hh:mm}"): "09/11 10:30".
export function formatSubjectOwner(iso: string, timeZone: string): string {
  return formatDateTimeShort(iso, timeZone).replace(" às ", " ");
}
