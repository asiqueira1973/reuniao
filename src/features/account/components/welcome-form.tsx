"use client";
// Boas-vindas do primeiro acesso — spec v0.5, épico 8.11. Nome, endereço (checagem ao digitar, como
// na tela Conta), fuso e o aceite dos Termos e da Privacidade. "Começar" fica desabilitado sem o
// aceite. POST /api/painel/conta/boas-vindas; depois, recarrega o painel (Tipos de evento).
// Saída (bug B-02): "Sair" (POST /sair) ou "Não quero usar o Reunião" → confirmação → DELETE
// /api/painel/conta com o endereço da própria conta → página inicial.
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiErrorText, copy } from "@/lib/copy";
import { isReservedAccountSlug, isValidSlug, normalizeSlug, sanitizeSlugInput } from "@/lib/slug";
import styles from "@/features/event-types/components/event-types.module.css";
import own from "./welcome.module.css";

type Props = { initial: { nome_exibicao: string; slug: string; fuso: string }; timeZones: string[]; siteUrl: string };

const c = copy.account;
const w = copy.welcome;

export function WelcomeForm({ initial, timeZones, siteUrl }: Props) {
  const [values, setValues] = useState(initial);
  const [accepted, setAccepted] = useState(false);
  const [slugFree, setSlugFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);

  const slug = normalizeSlug(values.slug);
  const slugChanged = slug !== initial.slug;
  const slugFormatOk = isValidSlug(slug) && !isReservedAccountSlug(slug);

  // Checa a disponibilidade do endereço ao digitar (o atual da conta já é dela).
  useEffect(() => {
    if (!slugChanged || !slugFormatOk) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/painel/conta/slug-disponivel?slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal }).catch(() => null);
      if (res?.ok) setSlugFree((await res.json()).disponivel === true);
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [slug, slugChanged, slugFormatOk]);

  // Envia e, dando certo, recarrega o painel (o layout já não mostra mais as boas-vindas).
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/painel/conta/boas-vindas", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, slug, aceite: accepted }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setError(apiErrorText(res ? (await res.json().catch(() => ({}))).erro : null));
      return;
    }
    window.location.replace("/painel/tipos");
  }

  // Exclui a conta sem aceitar (mesma rota da tela Conta, confirmação = endereço atual).
  async function onDecline() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/painel/conta", {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmacao: initial.slug }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setError(apiErrorText(res ? (await res.json().catch(() => ({}))).erro : null));
      return;
    }
    window.location.replace("/");
  }

  const prefix = `${siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/`;
  const slugError = !slugFormatOk
    ? (isReservedAccountSlug(slug) ? copy.errors.slug_reservado : copy.errors.slug_invalido)
    : slugChanged && slugFree === false ? copy.errors.slug_em_uso : null;
  const zones = timeZones.includes(values.fuso) ? timeZones : [values.fuso, ...timeZones];

  return (
    <>
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div>
        <h1 className={own.title}>{w.title}</h1>
        <p className={own.intro}>{w.intro}</p>
      </div>
      <section className={styles.section}>
        <label className={styles.field}>
          <span className={styles.label}>{c.fields.nome_exibicao}</span>
          <input className={styles.input} value={values.nome_exibicao} maxLength={100} required
            onChange={(e) => setValues((v) => ({ ...v, nome_exibicao: e.target.value }))} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{c.fields.slug}</span>
          <span className={`${styles.prefix} ${slugError ? styles.invalid : ""}`}>
            <span>{prefix}</span>
            <input className={styles.input} value={values.slug} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
              aria-invalid={!!slugError} onChange={(e) => { setSlugFree(null); setValues((v) => ({ ...v, slug: sanitizeSlugInput(e.target.value) })); }} />
          </span>
          {slugError ? <p className={styles.hint} role="alert">{slugError}</p> : slugChanged && slugFree ? <p className={styles.hint}>{c.slugAvailable}</p> : null}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{c.fields.fuso}</span>
          <select className={styles.select} value={values.fuso} onChange={(e) => setValues((v) => ({ ...v, fuso: e.target.value }))}>
            {zones.map((z) => <option key={z} value={z}>{z.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className={own.accept}>
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            {w.acceptBefore}
            <Link href="/termos" target="_blank">{copy.legal.terms}</Link>
            {w.acceptBetween}
            <Link href="/privacidade" target="_blank">{copy.legal.privacy}</Link>
          </span>
        </label>
      </section>
      <div className={styles.actions}>
        <button type="submit" className={styles.primaryButton} disabled={busy || !accepted || !!slugError || !values.nome_exibicao.trim()}>{w.submit}</button>
        {error ? <span role="status" className={styles.errorText}>{error}</span> : null}
      </div>
      <div className={own.exit}>
        {declining ? (
          <div className={styles.actions} role="alertdialog" aria-label={w.declineConfirm}>
            <span>{w.declineConfirm}</span>
            <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void onDecline()}>{w.declineButton}</button>
            <button type="button" className={styles.secondaryButton} onClick={() => setDeclining(false)}>{w.cancel}</button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setDeclining(true)}>{w.decline}</button>
            <button type="submit" form="welcome-sign-out" className={styles.secondaryButton}>{w.signOut}</button>
          </div>
        )}
      </div>
    </form>
    {/* "Sair" é POST /sair (nunca link); o botão acima aponta para este formulário pelo id. */}
    <form id="welcome-sign-out" method="post" action="/sair" hidden />
    </>
  );
}
