"use client";
// Bloco "Datas específicas" — épico 8.3: lista das datas de hoje em diante, "Adicionar data"
// (indisponível o dia todo ou horários próprios), editar e remover. Grava em
// PUT/DELETE /api/painel/disponibilidade/datas. Datas passadas não aparecem (o servidor filtra).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { findOverlap, isValidRange, nextDefaultRange, type TimeRange } from "@/features/availability/ranges";
import { apiErrorText, copy } from "@/lib/copy";
import { formatDateLong } from "@/lib/format";
import styles from "./availability.module.css";

export type DateOverrideItem = { data: string; tipo: "indisponivel" | "horario_especial"; faixas: TimeRange[] };
type Props = { initial: DateOverrideItem[]; today: string };

const t = copy.availability;

// Texto curto das faixas de um dia: "09:00 – 10:00, 14:00 – 15:00".
function rangesText(faixas: TimeRange[]): string {
  return faixas.map((f) => `${f.inicio} – ${f.fim}`).join(", ");
}

// Formulário de uma data (nova ou em edição).
function DateForm({ initial, today, onDone, onCancel }: {
  initial: DateOverrideItem; today: string; onDone: () => void; onCancel: () => void;
}) {
  const [data, setData] = useState(initial.data);
  const [tipo, setTipo] = useState(initial.tipo);
  const [faixas, setFaixas] = useState<TimeRange[]>(initial.faixas.length ? initial.faixas : [{ inicio: "09:00", fim: "17:00" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Valida localmente e grava a data (substitui o que havia nela).
  async function save() {
    if (!data || data < today) return setError(apiErrorText("dados_invalidos"));
    if (tipo === "horario_especial") {
      if (!faixas.length || faixas.some((f) => !isValidRange(f))) return setError(t.weekly.invalid);
      if (findOverlap(faixas)) return setError(t.weekly.overlap);
    }
    setSaving(true);
    const res = await fetch("/api/painel/disponibilidade/datas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tipo === "indisponivel" ? { data, tipo } : { data, tipo, faixas }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError(apiErrorText(res ? (await res.json().catch(() => ({}))).erro : null));
    onDone();
  }

  const suggestion = nextDefaultRange(faixas);
  return (
    <div className={styles.form}>
      <label className={styles.field}>
        {t.dates.date}
        <input className={styles.dateInput} type="date" min={today} value={data} onChange={(e) => setData(e.target.value)} />
      </label>
      <label className={styles.radio}>
        <input type="radio" name="tipo" checked={tipo === "indisponivel"} onChange={() => setTipo("indisponivel")} />
        {t.dates.unavailableAllDay}
      </label>
      <label className={styles.radio}>
        <input type="radio" name="tipo" checked={tipo === "horario_especial"} onChange={() => setTipo("horario_especial")} />
        {t.dates.customHours}
      </label>
      {tipo === "horario_especial" && (
        <div className={styles.ranges}>
          {faixas.map((r, i) => (
            <div key={i} className={styles.range}>
              <input className={styles.time} type="time" step={300} value={r.inicio} aria-label={t.weekly.start}
                onChange={(e) => setFaixas(faixas.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))} />
              <span className={styles.dash}>–</span>
              <input className={styles.time} type="time" step={300} value={r.fim} aria-label={t.weekly.end}
                onChange={(e) => setFaixas(faixas.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))} />
              <button type="button" className={styles.iconButton} aria-label={t.weekly.removeRange} disabled={faixas.length === 1}
                onClick={() => setFaixas(faixas.filter((_, j) => j !== i))}>
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className={styles.iconButton} aria-label={t.weekly.addRange} disabled={!suggestion}
              onClick={() => suggestion && setFaixas([...faixas, suggestion])}>
              <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.footer}>
        <button type="button" className={styles.primaryButton} onClick={save} disabled={saving || !data}>{t.save}</button>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>{t.dates.cancel}</button>
      </div>
    </div>
  );
}

// Lista das datas específicas com adicionar, editar e remover.
export function DateOverrides({ initial, today }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<DateOverrideItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const year = Number(today.slice(0, 4));

  // Remove a data e recarrega a lista do servidor.
  async function remove(data: string) {
    setError(null);
    const res = await fetch("/api/painel/disponibilidade/datas", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
    }).catch(() => null);
    if (!res?.ok) return setError(apiErrorText(null));
    router.refresh();
  }

  return (
    <section className={styles.block} aria-labelledby="datas-title">
      <h2 id="datas-title" className={styles.blockTitle}>{t.dates.title}</h2>
      {initial.length === 0 && !editing && <p className={styles.empty}>{t.dates.empty}</p>}
      <ul className={styles.list}>
        {initial.map((item) => (
          <li key={item.data} className={styles.listItem}>
            <div className={styles.listMain}>
              <p className={styles.listTitle}>{formatDateLong(item.data, year)}</p>
              <p className={styles.listMeta}>{item.tipo === "indisponivel" ? t.weekly.unavailable : rangesText(item.faixas)}</p>
            </div>
            <button type="button" className={`${styles.secondaryButton} ${styles.smallButton}`} onClick={() => setEditing(item)}>{t.dates.edit}</button>
            <button type="button" className={styles.dangerLink} onClick={() => remove(item.data)}>{t.dates.remove}</button>
          </li>
        ))}
      </ul>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {editing ? (
        <DateForm
          key={editing.data || "nova"}
          initial={editing}
          today={today}
          onCancel={() => setEditing(null)}
          onDone={() => { setEditing(null); router.refresh(); }}
        />
      ) : (
        <div className={styles.footer}>
          <button type="button" className={styles.secondaryButton} onClick={() => setEditing({ data: "", tipo: "indisponivel", faixas: [] })}>
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            {t.dates.add}
          </button>
        </div>
      )}
    </section>
  );
}
