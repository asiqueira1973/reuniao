"use client";
// Tela Conta — épico 8.8 e seção 10 ([Dono] Conta). Três blocos: Perfil (nome, endereço com
// checagem ao digitar e confirmação "Links antigos deixam de funcionar. Continuar?", mensagem,
// fuso), Google Agenda (e-mail, situação, Reconectar → /api/auth/google) e Excluir conta (digitar o
// endereço; DELETE /api/painel/conta e volta para /entrar).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiErrorText, copy } from "@/lib/copy";
import { isReservedAccountSlug, isValidSlug, normalizeSlug, sanitizeSlugInput } from "@/lib/slug";
import styles from "@/features/event-types/components/event-types.module.css";

export type AccountValues = { nome_exibicao: string; slug: string; mensagem_boas_vindas: string; fuso: string };

type Props = {
  initial: AccountValues;
  email: string;
  connection: "ativa" | "revogada" | "ausente";
  timeZones: string[];
  siteUrl: string;
};

const c = copy.account;

// Formulário da conta do dono.
export function AccountForm({ initial, email, connection, timeZones, siteUrl }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [slugFree, setSlugFree] = useState<boolean | null>(null);
  const [confirmSlug, setConfirmSlug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const slug = normalizeSlug(values.slug);
  const slugChanged = slug !== saved.slug;
  const slugFormatOk = isValidSlug(slug) && !isReservedAccountSlug(slug);

  // Checa a disponibilidade do endereço ao digitar (com espera curta para não chamar a cada tecla).
  useEffect(() => {
    if (!slugChanged || !slugFormatOk) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/painel/conta/slug-disponivel?slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal }).catch(() => null);
      if (res?.ok) setSlugFree((await res.json()).disponivel === true);
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [slug, slugChanged, slugFormatOk]);

  // Atualiza um campo e apaga o aviso anterior.
  function set<K extends keyof AccountValues>(key: K, value: AccountValues[K]) {
    setMessage(null);
    setConfirmSlug(false);
    if (key === "slug") setSlugFree(null);
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Envia só o que mudou. Troca de endereço passa antes pela confirmação.
  async function save(confirmed: boolean) {
    if (slugChanged && !confirmed) {
      setConfirmSlug(true);
      return;
    }
    setConfirmSlug(false);
    const body = Object.fromEntries(
      Object.entries({ ...values, slug }).filter(([k, v]) => saved[k as keyof AccountValues] !== v),
    );
    setBusy(true);
    const res = await fetch("/api/painel/conta", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setMessage({ ok: false, text: apiErrorText(res ? (await res.json().catch(() => ({}))).erro : null) });
      return;
    }
    const { conta } = await res.json();
    const next = { nome_exibicao: conta.nome_exibicao, slug: conta.slug, mensagem_boas_vindas: conta.mensagem_boas_vindas ?? "", fuso: conta.fuso };
    setValues(next);
    setSaved(next);
    setMessage({ ok: true, text: c.saved });
    router.refresh();
  }

  // Exclui a conta e volta para a tela de entrar (o cookie já foi apagado pela API).
  async function onDelete() {
    setBusy(true);
    const res = await fetch("/api/painel/conta", {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmacao: deleteText }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setDeleteError(apiErrorText(res ? (await res.json().catch(() => ({}))).erro : null));
      return;
    }
    router.replace("/entrar");
    router.refresh();
  }

  const prefix = `${siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/`;
  const slugError = slugChanged && (!slugFormatOk ? (isReservedAccountSlug(slug) ? copy.errors.slug_reservado : copy.errors.slug_invalido) : slugFree === false ? copy.errors.slug_em_uso : null);
  const dirty = (Object.keys(values) as (keyof AccountValues)[]).some((k) => (k === "slug" ? slug : values[k]) !== saved[k]);
  const zones = timeZones.includes(values.fuso) ? timeZones : [values.fuso, ...timeZones];

  return (
    <div className={styles.form}>
      <form className={styles.section} onSubmit={(e) => { e.preventDefault(); void save(false); }} noValidate>
        <h2 className={styles.sectionTitle}>{c.groups.profile}</h2>
        <label className={styles.field}>
          <span className={styles.label}>{c.fields.nome_exibicao}</span>
          <input className={styles.input} value={values.nome_exibicao} maxLength={100} required onChange={(e) => set("nome_exibicao", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{c.fields.slug}</span>
          <span className={`${styles.prefix} ${slugError ? styles.invalid : ""}`}>
            <span>{prefix}</span>
            <input className={styles.input} value={values.slug} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
              aria-invalid={!!slugError} onChange={(e) => set("slug", sanitizeSlugInput(e.target.value))} />
          </span>
          {slugError ? <p className={styles.hint} role="alert">{slugError}</p> : slugChanged && slugFree ? <p className={styles.hint}>{c.slugAvailable}</p> : null}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{c.fields.mensagem_boas_vindas}</span>
          <textarea className={styles.textarea} value={values.mensagem_boas_vindas} maxLength={300} onChange={(e) => set("mensagem_boas_vindas", e.target.value)} />
          <p className={styles.hint}>{c.fields.mensagemHint}</p>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{c.fields.fuso}</span>
          <select className={styles.select} value={values.fuso} onChange={(e) => set("fuso", e.target.value)}>
            {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        {confirmSlug ? (
          <div className={styles.actions} role="alertdialog" aria-label={c.changeSlug}>
            <span>{c.changeSlug}</span>
            <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void save(true)}>{c.changeSlugConfirm}</button>
            <button type="button" className={styles.secondaryButton} onClick={() => setConfirmSlug(false)}>{c.cancel}</button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryButton} disabled={busy || !dirty || !!slugError || !values.nome_exibicao.trim()}>{c.save}</button>
            {message ? <span role="status" className={message.ok ? undefined : styles.errorText}>{message.text}</span> : null}
          </div>
        )}
      </form>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{c.groups.google}</h2>
        <p className={styles.hint}>{email}</p>
        <p className={styles.hint}>{c.googleCalendar} · <strong className={connection === "ativa" ? undefined : styles.errorText}>{c.connection[connection]}</strong></p>
        <div className={styles.actions}>
          {/* Rota de API (redireciona ao Google), não página: <a> em vez de <Link>. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className={styles.linkButton} href="/api/auth/google">{c.reconnect}</a>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{c.groups.danger}</h2>
        <p className={styles.hint}>{c.deleteIntro}</p>
        <label className={styles.field}>
          <span className={styles.label}>{c.deleteTypeSlug(saved.slug)}</span>
          <input className={styles.input} value={deleteText} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => { setDeleteError(null); setDeleteText(e.target.value); }} />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.dangerButton} disabled={busy || deleteText.trim() !== saved.slug} onClick={() => void onDelete()}>{c.deleteButton}</button>
          {deleteError ? <span role="status" className={styles.errorText}>{deleteError}</span> : null}
        </div>
      </section>
    </div>
  );
}
