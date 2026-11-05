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
