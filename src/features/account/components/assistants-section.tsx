"use client";
// Conta → Assistentes conectados (plano 9.6): o endereço do MCP com botão de copiar e a lista de
// assistentes conectados, cada um com "Desconectar" (DELETE /api/painel/conta/assistentes/{id}).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorText, copy } from "@/lib/copy";
import styles from "@/features/event-types/components/event-types.module.css";

export type AssistantRow = { id: string; nome: string; conectadoEm: string; ultimoUso: string | null };

const c = copy.assistants;

export function AssistantsSection({ mcpUrl, rows }: { mcpUrl: string; rows: AssistantRow[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const visible = rows.filter((r) => !hidden.includes(r.id));

  // Copia o endereço do MCP para a área de transferência.
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setMessage({ ok: true, text: c.copied });
    } catch {
      setMessage(null);
    }
  }

  // Desconecta um assistente (revoga o token) e atualiza a lista.
  async function revoke(id: string) {
    setBusy(id);
    setMessage(null);
    const res = await fetch(`/api/painel/conta/assistentes/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (res?.ok || res?.status === 404) {
      setHidden((h) => [...h, id]);
      setMessage({ ok: true, text: c.revoked });
      router.refresh();
    } else {
      setMessage({ ok: false, text: apiErrorText("generic") });
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{c.title}</h2>
      <p className={styles.hint}>{c.intro}</p>
      <div className={styles.actions}>
        <code>{mcpUrl}</code>
        <button type="button" className={styles.secondaryButton} onClick={() => void copyUrl()}>{c.copy}</button>
      </div>
      {visible.length === 0 ? (
        <p className={styles.hint}>{c.empty}</p>
      ) : (
        visible.map((r) => (
          <div key={r.id} className={styles.actions}>
            <span>
              <strong>{r.nome}</strong>
              <span className={styles.hint}> · {c.connectedOn(r.conectadoEm)}{r.ultimoUso ? `, ${c.lastUse(r.ultimoUso)}` : ""}</span>
            </span>
            <button type="button" className={styles.dangerButton} disabled={busy === r.id} onClick={() => void revoke(r.id)}>{c.revoke}</button>
          </div>
        ))
      )}
      {message ? <p role="status" className={message.ok ? styles.hint : styles.errorText}>{message.text}</p> : null}
    </section>
  );
}
