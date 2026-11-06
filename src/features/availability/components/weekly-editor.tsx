"use client";
// Bloco "Horários semanais" — épico 8.3: uma linha por dia (D S T Q Q S S), faixas de 5 em 5
// min, "+" para nova faixa, "×" para remover, "Copiar para…" outros dias; dia sem faixa aparece
// "Indisponível". Salva o bloco inteiro em PUT /api/painel/disponibilidade/semanal.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import { findOverlap, isValidRange, nextDefaultRange, type TimeRange } from "@/features/availability/ranges";
import { apiErrorText, copy } from "@/lib/copy";
import styles from "./availability.module.css";

type Week = Record<number, TimeRange[]>;
type Props = { initial: { dia_semana: number; inicio: string; fim: string }[] };

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const t = copy.availability;

// Agrupa as faixas recebidas do servidor por dia da semana.
function groupByDay(list: Props["initial"]): Week {
  const week: Week = Object.fromEntries(DAYS.map((d) => [d, []]));
  for (const r of list) week[r.dia_semana].push({ inicio: r.inicio, fim: r.fim });
  return week;
}

// Popover "Copiar para…": escolhe os dias que recebem as faixas do dia de origem.
function CopyToPopover({ from, onApply, onClose }: { from: number; onApply: (days: number[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  return (
    <div className={styles.popover} role="dialog" aria-label={t.weekly.copyTo}>
      <p className={styles.popoverTitle}>{t.weekly.copyTo}</p>
      {DAYS.filter((d) => d !== from).map((d) => (
        <label key={d} className={styles.check}>
          <input
            type="checkbox"
            checked={selected.includes(d)}
            onChange={(e) => setSelected((s) => (e.target.checked ? [...s, d] : s.filter((x) => x !== d)))}
          />
          {t.days.long[d]}
        </label>
      ))}
      <div className={styles.footer}>
        <button type="button" className={`${styles.primaryButton} ${styles.smallButton}`} disabled={!selected.length} onClick={() => { onApply(selected); onClose(); }}>
          {t.weekly.apply}
        </button>
        <button type="button" className={`${styles.secondaryButton} ${styles.smallButton}`} onClick={onClose}>{t.dates.cancel}</button>
      </div>
    </div>
  );
}

// Editor do bloco semanal com validação local (sobreposição e fim > início) antes de salvar.
export function WeeklyEditor({ initial }: Props) {
  const router = useRouter();
  const [week, setWeek] = useState<Week>(() => groupByDay(initial));
  const [base, setBase] = useState(initial);
  // Bug B-01: o Next 16 guarda as páginas já visitadas com o estado intacto; quando chegam dados
  // novos do servidor (`initial` novo), o estado é refeito a partir deles (padrão do React para
  // ajustar estado quando a prop muda, sem efeito).
  if (base !== initial) {
    setBase(initial);
    setWeek(groupByDay(initial));
  }
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Aplica uma mudança num dia e limpa as mensagens.
  function update(day: number, ranges: TimeRange[]) {
    setSaved(false);
    setError(null);
    setWeek((w) => ({ ...w, [day]: ranges }));
  }

  // Copia as faixas do dia de origem para os dias escolhidos (substitui as deles).
  function copyTo(from: number, days: number[]) {
    setSaved(false);
    setError(null);
    setWeek((w) => ({ ...w, ...Object.fromEntries(days.map((d) => [d, w[from].map((r) => ({ ...r }))])) }));
  }

  // Valida e grava o bloco inteiro.
  async function save() {
    const all = DAYS.flatMap((d) => week[d].map((r) => ({ dia_semana: d, ...r })));
    if (all.some((r) => !isValidRange(r))) return setError(t.weekly.invalid);
    if (DAYS.some((d) => findOverlap(week[d]))) return setError(t.weekly.overlap);
    setSaving(true);
    const res = await fetch("/api/painel/disponibilidade/semanal", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ faixas: all }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError(apiErrorText(res ? (await res.json().catch(() => ({}))).erro : null));
    setSaved(true);
    router.refresh();
  }

  return (
    <section className={styles.block} aria-labelledby="semanal-title">
      <h2 id="semanal-title" className={styles.blockTitle}>{t.weekly.title}</h2>
      {DAYS.map((day) => {
        const ranges = week[day];
        const suggestion = nextDefaultRange(ranges);
        return (
          <div key={day} className={styles.dayRow}>
            <span className={`${styles.dayBadge} ${ranges.length ? "" : styles.dayBadgeOff}`} aria-label={t.days.long[day]} title={t.days.long[day]}>
              {t.days.short[day]}
            </span>
            <div className={styles.ranges}>
              {ranges.length === 0 && <span className={styles.unavailable}>{t.weekly.unavailable}</span>}
              {ranges.map((r, i) => (
                <div key={i} className={styles.range}>
                  <input className={styles.time} type="time" step={300} value={r.inicio} aria-label={`${t.days.long[day]} ${t.weekly.start}`}
                    onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))} />
                  <span className={styles.dash}>–</span>
                  <input className={styles.time} type="time" step={300} value={r.fim} aria-label={`${t.days.long[day]} ${t.weekly.end}`}
                    onChange={(e) => update(day, ranges.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))} />
                  <button type="button" className={styles.iconButton} aria-label={t.weekly.removeRange} onClick={() => update(day, ranges.filter((_, j) => j !== i))}>
                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.dayActions}>
              <button type="button" className={styles.iconButton} aria-label={`${t.weekly.addRange} — ${t.days.long[day]}`} disabled={!suggestion}
                onClick={() => suggestion && update(day, [...ranges, suggestion])}>
                <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" className={styles.iconButton} aria-label={`${t.weekly.copyTo} — ${t.days.long[day]}`} aria-expanded={copyFrom === day}
                onClick={() => setCopyFrom(copyFrom === day ? null : day)}>
                <Copy size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
              {copyFrom === day && <CopyToPopover from={day} onApply={(days) => copyTo(day, days)} onClose={() => setCopyFrom(null)} />}
            </div>
          </div>
        );
      })}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.footer}>
        <button type="button" className={styles.primaryButton} onClick={save} disabled={saving}>{t.save}</button>
        {saved && <span className={styles.success} role="status">{t.saved}</span>}
      </div>
    </section>
  );
}
