"use client";
// Editor de tipo de evento — épico 8.2 e seção 10 ([Dono] Editar tipo): uma tela só, em grupos
// Básico, Local, Regras e Visibilidade, com os defaults de 7.3 já preenchidos no tipo novo.
// Novo: POST /api/painel/tipos (slug sugerido do nome enquanto o dono não mexer no endereço).
// Edição: PATCH só com os campos alterados. Excluir: confirmação inline e DELETE (soft delete).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { STEP_OPTIONS } from "@/features/event-types/schema";
import { apiErrorText, copy } from "@/lib/copy";
import { formatMinutes } from "@/lib/format";
import { normalizeSlug, sanitizeSlugInput } from "@/lib/slug";
import styles from "./event-types.module.css";

export type EventTypeValues = {
  nome: string;
  slug: string;
  descricao: string;
  duracao_min: number;
  com_meet: boolean;
  antecedencia_min: number;
  janela_dias: number;
  intervalo_antes_min: number;
  intervalo_depois_min: number;
  passo_min: number;
  visivel_na_pagina: boolean;
  ativo: boolean;
};

// Defaults de 7.3 para o tipo novo (o banco aplicaria os mesmos).
export const NEW_TYPE_DEFAULTS: EventTypeValues = {
  nome: "", slug: "", descricao: "", duracao_min: 30, com_meet: true, antecedencia_min: 240, janela_dias: 60,
  intervalo_antes_min: 0, intervalo_depois_min: 0, passo_min: 30, visivel_na_pagina: true, ativo: true,
};

// Opções de antecedência e de intervalo (minutos), dentro dos limites de 7.3.
const NOTICE_OPTIONS = [0, 30, 60, 120, 240, 480, 720, 1440, 2880, 10080];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60, 90, 120];

type Props = { id: string | null; initial: EventTypeValues; siteUrl: string; accountSlug: string };

// Garante que o valor atual apareça na lista de opções mesmo se não for um dos padrões.
function withCurrent(options: readonly number[], current: number): number[] {
  return [...new Set([...options, current])].sort((a, b) => a - b);
}

// Formulário do editor: novo (id null) ou edição de um tipo existente.
export function EventTypeForm({ id, initial, siteUrl, accountSlug }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(id !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Atualiza um campo; no tipo novo, o nome sugere o endereço até o dono editá-lo (regra 11.11).
  function set<K extends keyof EventTypeValues>(key: K, value: EventTypeValues[K]) {
    setSaved(false);
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "nome" && !slugTouched) next.slug = normalizeSlug(String(value));
      return next;
    });
  }

  // Monta o corpo: tudo no tipo novo; só o que mudou na edição.
  // O endereço sai sem hífen sobrando no fim (o campo o mantém durante a digitação).
  function payload(): Partial<EventTypeValues> {
    const clean = { ...values, slug: normalizeSlug(values.slug) };
    if (!id) return clean;
    return Object.fromEntries(
      Object.entries(clean).filter(([k, v]) => initial[k as keyof EventTypeValues] !== v),
    ) as Partial<EventTypeValues>;
  }

  // Salva: POST no tipo novo (volta para a lista) ou PATCH na edição (mostra "Salvo.").
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrorField(null);
    const body = payload();
    const res = await fetch(id ? `/api/painel/tipos/${id}` : "/api/painel/tipos", {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const code = res ? (await res.json().catch(() => ({}))).erro : null;
      setError(apiErrorText(code));
      if (code === "slug_em_uso" || code === "slug_invalido") setErrorField("slug");
      return;
    }
    if (!id) {
      router.push("/painel/tipos");
      router.refresh();
      return;
    }
    setSaved(true);
    router.refresh();
  }

  // Exclui depois da confirmação e volta para a lista.
  async function onDelete() {
    if (!id) return;
    setSaving(true);
    const res = await fetch(`/api/painel/tipos/${id}`, { method: "DELETE" }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setError(apiErrorText(null));
      setConfirmingDelete(false);
      return;
    }
    router.push("/painel/tipos");
    router.refresh();
  }

  const f = copy.eventTypeForm.fields;
  const prefix = `${siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/${accountSlug}/`;

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{copy.eventTypeForm.groups.basic}</h2>
        <label className={styles.field}>
          <span className={styles.label}>{f.nome}</span>
          <input className={styles.input} value={values.nome} maxLength={60} required onChange={(e) => set("nome", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{f.duracao_min}</span>
          <span className={styles.inline}>
            <input className={styles.input} type="number" inputMode="numeric" min={15} max={240} step={5} value={values.duracao_min}
              onChange={(e) => set("duracao_min", Number(e.target.value))} />
            <span>{copy.units.minutes}</span>
          </span>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{f.descricao}</span>
          <textarea className={styles.textarea} value={values.descricao} maxLength={1000} onChange={(e) => set("descricao", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{f.slug}</span>
          <span className={`${styles.prefix} ${errorField === "slug" ? styles.invalid : ""}`}>
            <span>{prefix}</span>
            <input className={styles.input} value={values.slug} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onChange={(e) => { setSlugTouched(true); set("slug", sanitizeSlugInput(e.target.value)); }} />
          </span>
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{copy.eventTypeForm.groups.location}</h2>
        <label className={styles.switchRow}>
          <span className={styles.label}>{f.com_meet}</span>
          <input type="checkbox" role="switch" className={styles.switch} aria-label={f.com_meet} checked={values.com_meet} onChange={(e) => set("com_meet", e.target.checked)} />
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{copy.eventTypeForm.groups.rules}</h2>
        <div className={styles.twoCols}>
          <label className={styles.field}>
            <span className={styles.label}>{f.antecedencia_min}</span>
            <select className={styles.select} value={values.antecedencia_min} onChange={(e) => set("antecedencia_min", Number(e.target.value))}>
              {withCurrent(NOTICE_OPTIONS, values.antecedencia_min).map((m) => <option key={m} value={m}>{formatMinutes(m)}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{f.janela_dias}</span>
            <span className={styles.inline}>
              <input className={styles.input} type="number" inputMode="numeric" min={1} max={365} value={values.janela_dias}
                onChange={(e) => set("janela_dias", Number(e.target.value))} />
              <span>{copy.units.days}</span>
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{f.intervalo_antes_min}</span>
            <select className={styles.select} value={values.intervalo_antes_min} onChange={(e) => set("intervalo_antes_min", Number(e.target.value))}>
              {withCurrent(BUFFER_OPTIONS, values.intervalo_antes_min).map((m) => <option key={m} value={m}>{formatMinutes(m)}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{f.intervalo_depois_min}</span>
            <select className={styles.select} value={values.intervalo_depois_min} onChange={(e) => set("intervalo_depois_min", Number(e.target.value))}>
              {withCurrent(BUFFER_OPTIONS, values.intervalo_depois_min).map((m) => <option key={m} value={m}>{formatMinutes(m)}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{f.passo_min}</span>
            <select className={styles.select} value={values.passo_min} onChange={(e) => set("passo_min", Number(e.target.value))}>
              {STEP_OPTIONS.map((m) => <option key={m} value={m}>{formatMinutes(m)}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{copy.eventTypeForm.groups.visibility}</h2>
        <label className={styles.switchRow}>
          <span className={styles.label}>{f.visivel_na_pagina}</span>
          <input type="checkbox" role="switch" className={styles.switch} aria-label={f.visivel_na_pagina} checked={values.visivel_na_pagina} onChange={(e) => set("visivel_na_pagina", e.target.checked)} />
        </label>
        <p className={styles.hint}>{copy.eventTypeForm.hiddenHint}</p>
        <label className={styles.switchRow}>
          <span className={styles.label}>{f.ativo}</span>
          <input type="checkbox" role="switch" className={styles.switch} aria-label={f.ativo} checked={values.ativo} onChange={(e) => set("ativo", e.target.checked)} />
        </label>
      </section>

      {error && <p className={styles.errorBox} role="alert">{error}</p>}

      {confirmingDelete ? (
        <div className={styles.confirmBox}>
          <p>{copy.eventTypeForm.deleteConfirm}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.dangerButton} onClick={onDelete} disabled={saving}>{copy.eventTypeForm.delete}</button>
            <button type="button" className={styles.secondaryButton} onClick={() => setConfirmingDelete(false)}>{copy.eventTypeForm.cancel}</button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="submit" className={styles.primaryButton} disabled={saving || !values.nome.trim()}>{copy.eventTypeForm.save}</button>
          {saved && <span className={styles.successText} role="status">{copy.eventTypeForm.saved}</span>}
          <span className={styles.spacer} />
          {id && <button type="button" className={styles.dangerButton} onClick={() => setConfirmingDelete(true)}>{copy.eventTypeForm.delete}</button>}
        </div>
      )}
    </form>
  );
}

// Link de volta para a lista, usado no topo das páginas do editor.
export function BackToList() {
  return (
    <Link href="/painel/tipos" className={styles.backLink}>
      <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      {copy.eventTypeForm.back}
    </Link>
  );
}
