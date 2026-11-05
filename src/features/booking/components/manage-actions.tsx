"use client";
// Ações da tela "Sua reunião" — épico 8.6: Remarcar (vai para /r/{token}/remarcar) e Cancelar
// reunião (motivo opcional → POST /api/reservas/gestao/cancelar → "Reunião cancelada. Avisei
// {dono}."). Google com erro mostra "Não consegui cancelar agora. Tente de novo." e nada muda.
import Link from "next/link";
import { useState } from "react";
import { apiErrorText, copy } from "@/lib/copy";
import styles from "./public.module.css";

const m = copy.manage;

// Botões e formulário de cancelamento da reserva do token.
export function ManageActions({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Envia o cancelamento.
  async function cancel() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/reservas/gestao/cancelar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, motivo: reason || null }),
    }).catch(() => null);
    setSending(false);
    if (res?.ok) {
      const { dono } = (await res.json()) as { dono: string };
      setDone(m.cancelled.replace("{dono}", dono));
      return;
    }
    const code = res ? (await res.json().catch(() => ({}))).erro : null;
    setError(code === "servico_indisponivel" || !code ? m.cancelFailed : apiErrorText(code));
  }

  if (done) return <p className={styles.message} role="status">{done}</p>;

  return (
    <div className={styles.form}>
      {confirming ? (
        <>
          <label className={styles.field}>
            {m.reason}
            <textarea className={styles.textarea} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {error && <p className={`${styles.message} ${styles.messageError}`} role="alert">{error}</p>}
          <button type="button" className={`${styles.primary} ${styles.danger}`} disabled={sending} onClick={() => void cancel()}>{m.cancel}</button>
          <button type="button" className={styles.linkButton} onClick={() => { setConfirming(false); setError(null); }}>{m.keep}</button>
        </>
      ) : (
        <>
          <Link className={styles.primary} href={`/r/${token}/remarcar`} style={{ display: "grid", placeItems: "center" }}>{m.reschedule}</Link>
          <button type="button" className={styles.secondary} onClick={() => setConfirming(true)}>{m.cancel}</button>
        </>
      )}
    </div>
  );
}
