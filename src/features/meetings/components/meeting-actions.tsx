"use client";
// Ações do detalhe da reunião — épico 8.7: "Cancelar reunião" (motivo opcional, vai para o
// convidado) e "Reenviar" e-mail que falhou. Depois de cada ação, recarrega os dados do servidor.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorText, copy } from "@/lib/copy";
import styles from "./meetings.module.css";

const t = copy.meetings;

// Botão "Reenviar" de uma notificação que falhou.
export function ResendButton({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  // Pede o reenvio e mostra o resultado.
  async function resend() {
    setState("sending");
    const res = await fetch(`/api/painel/notificacoes/${id}/reenviar`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && body.status === "enviada") {
      setState("done");
      setMsg(t.resent);
      router.refresh();
      return;
    }
    setState("error");
    setMsg(body.erro ? apiErrorText(body.erro) : t.emailFailed);
    router.refresh();
  }

  if (state === "done") return <span className={styles.noteOk}>{msg}</span>;
  return (
    <span>
      {state === "error" && msg && <span className={styles.noteFailed}>{msg} </span>}
      <button type="button" className={styles.small} disabled={state === "sending"} onClick={() => void resend()}>{t.resend}</button>
    </span>
  );
}

// Cancelar reunião pelo dono, com motivo opcional que vai para o convidado.
export function CancelMeeting({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Envia o cancelamento.
  async function cancel() {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/painel/reunioes/${id}/cancelar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ motivo: reason || null }),
    }).catch(() => null);
    setSending(false);
    if (res?.ok) {
      setDone(true);
      router.refresh();
      return;
    }
    const code = res ? (await res.json().catch(() => ({}))).erro : null;
    setError(code === "servico_indisponivel" || !code ? t.cancelFailed : apiErrorText(code));
  }

  if (done) return <p className={styles.message} role="status">{t.cancelledOk}</p>;
  if (!open) return <button type="button" className={styles.secondary} onClick={() => setOpen(true)}>{t.cancel}</button>;
  return (
    <>
      <label className={styles.fieldLabel}>
        {t.reasonForGuest}
        <textarea className={styles.textarea} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && <p className={`${styles.message} ${styles.error}`} role="alert">{error}</p>}
      <button type="button" className={styles.danger} disabled={sending} onClick={() => void cancel()}>{t.cancel}</button>
      <button type="button" className={styles.link} onClick={() => setOpen(false)}>{t.keep}</button>
    </>
  );
}
