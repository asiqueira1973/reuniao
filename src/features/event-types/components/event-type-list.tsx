"use client";
// Lista de tipos de evento do painel — épico 8.2 e seção 10 ([Dono] Tipos de evento).
// Cards com nome, duração, "Google Meet", selos Oculto/Inativo, Copiar link e Abrir; reordenar
// arrastando (desktop) ou pelas setas (sempre visíveis, para celular e teclado). A nova ordem
// é gravada em POST /api/painel/tipos/ordem; se falhar, volta a ordem anterior.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, GripVertical, Link2 } from "lucide-react";
import { copy } from "@/lib/copy";
import { formatDuration, publicTypeUrl } from "@/lib/format";
import styles from "./event-types.module.css";

export type EventTypeCard = {
  id: string;
  nome: string;
  slug: string;
  duracao_min: number;
  com_meet: boolean;
  visivel_na_pagina: boolean;
  ativo: boolean;
};

type Props = { initial: EventTypeCard[]; siteUrl: string; accountSlug: string };

// Copia texto para a área de transferência. Tenta a API moderna e, se o navegador recusar
// (webview, permissão), cai no método antigo com um campo temporário. Devolve se copiou.
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

// Botão "Copiar link": copia o link público e mostra "Link copiado." por 2 s (critério 8.2).
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    if (await writeClipboard(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }
  return (
    <button type="button" className={styles.pillButton} onClick={onCopy} aria-live="polite">
      <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
      {copied ? copy.eventTypes.linkCopied : copy.eventTypes.copyLink}
    </button>
  );
}

export function EventTypeList({ initial, siteUrl, accountSlug }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);

  // Aplica a nova ordem na tela e grava; em erro, desfaz.
  async function commit(next: EventTypeCard[]) {
    const previous = items;
    setItems(next);
    const res = await fetch("/api/painel/tipos/ordem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: next.map((i) => i.id) }),
    }).catch(() => null);
    if (!res?.ok) setItems(previous);
    else router.refresh();
  }

  // Move o item de índice "from" para "to".
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void commit(next);
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{copy.eventTypes.empty}</p>
        <Link className={styles.primaryButton} href="/painel/tipos/novo">{copy.eventTypes.createFirst}</Link>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((t, index) => {
        const url = publicTypeUrl(siteUrl, accountSlug, t.slug);
        return (
          <li
            key={t.id}
            className={`${styles.card} ${dragId === t.id ? styles.dragging : ""} ${t.ativo ? "" : styles.inactiveCard}`}
            draggable
            onDragStart={() => setDragId(t.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = items.findIndex((i) => i.id === dragId);
              if (from >= 0) move(from, index);
              setDragId(null);
            }}
          >
            <span className={styles.grip} aria-label={copy.eventTypes.dragHandle} title={copy.eventTypes.dragHandle}>
              <GripVertical size={18} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <Link href={`/painel/tipos/${t.id}`} className={styles.cardMain}>
              <span className={styles.cardTitle}>{t.nome}</span>
              <span className={styles.cardMeta}>
                {formatDuration(t.duracao_min)}
                {t.com_meet ? ` · ${copy.eventTypes.meet}` : ""}
              </span>
              <span className={styles.badges}>
                {!t.visivel_na_pagina && <span className={styles.badge}>{copy.eventTypes.hidden}</span>}
                {!t.ativo && <span className={styles.badge}>{copy.eventTypes.inactive}</span>}
              </span>
            </Link>
            <div className={styles.cardActions}>
              <CopyLinkButton url={url} />
              <a className={styles.iconButton} href={url} target="_blank" rel="noreferrer" aria-label={copy.eventTypes.open} title={copy.eventTypes.open}>
                <ExternalLink size={18} strokeWidth={1.75} aria-hidden="true" />
              </a>
              <span className={styles.arrows}>
                <button type="button" className={styles.iconButton} onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={copy.eventTypes.moveUp}>
                  <ChevronUp size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button type="button" className={styles.iconButton} onClick={() => move(index, index + 1)} disabled={index === items.length - 1} aria-label={copy.eventTypes.moveDown}>
                  <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
