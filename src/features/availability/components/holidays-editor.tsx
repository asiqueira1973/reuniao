"use client";
// Bloco "Feriados" — épico 8.3 e regra 11.4: chave geral "Brasil" e uma chave por feriado com a
// próxima data. Com a chave geral desligada, as chaves individuais ficam apagadas (sem efeito).
// Grava em PUT /api/painel/disponibilidade/feriados.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HOLIDAYS, nextHolidayDate } from "@/features/availability/holidays";
import { apiErrorText, copy } from "@/lib/copy";
import { formatDateShort } from "@/lib/format";
import styles from "./availability.module.css";

type Props = { initial: { feriados_ativos: boolean; feriados_desligados: string[] }; today: string };

const t = copy.availability;

// Editor dos feriados com Salvar próprio.
export function HolidaysEditor({ initial, today }: Props) {
  const router = useRouter();
  const [active, setActive] = useState(initial.feriados_ativos);
  const [off, setOff] = useState<string[]>(initial.feriados_desligados);
  const [base, setBase] = useState(initial);
  // Bug B-01: o Next 16 guarda as páginas já visitadas com o estado intacto; quando chegam dados
  // novos do servidor (`initial` novo), o estado é refeito a partir deles (padrão do React para
  // ajustar estado quando a prop muda, sem efeito).
  if (base !== initial) {
    setBase(initial);
    setActive(initial.feriados_ativos);
    setOff(initial.feriados_desligados);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Liga ou desliga um feriado.
  function toggle(code: string, on: boolean) {
    setSaved(false);
    setOff((o) => (on ? o.filter((c) => c !== code) : [...o, code]));
  }

  // Grava a configuração.
  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/painel/disponibilidade/feriados", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feriados_ativos: active, feriados_desligados: off }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError(apiErrorText(null));
    setSaved(true);
    router.refresh();
  }

  return (
    <section className={styles.block} aria-labelledby="feriados-title">
      <h2 id="feriados-title" className={styles.blockTitle}>{t.holidays.title}</h2>
      <label className={styles.holidayRow}>
        <span className={styles.holidayCountry}>{t.holidays.country}</span>
        <input type="checkbox" role="switch" className={styles.switch} aria-label={t.holidays.country} checked={active}
          onChange={(e) => { setSaved(false); setActive(e.target.checked); }} />
      </label>
      {HOLIDAYS.map((h) => (
        <label key={h.code} className={`${styles.holidayRow} ${active ? "" : styles.disabled}`}>
          <span className={styles.holidayName}>{h.name}</span>
          <span className={styles.holidayRight}>
            <span className={styles.holidayNext}>{t.holidays.next} {formatDateShort(nextHolidayDate(h.code, today))}</span>
            <input type="checkbox" role="switch" className={styles.switch} aria-label={h.name} disabled={!active}
              checked={!off.includes(h.code)} onChange={(e) => toggle(h.code, e.target.checked)} />
          </span>
        </label>
      ))}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.footer}>
        <button type="button" className={styles.primaryButton} onClick={save} disabled={saving}>{t.save}</button>
        {saved && <span className={styles.success} role="status">{t.saved}</span>}
      </div>
    </section>
  );
}
