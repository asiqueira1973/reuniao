// [Dono] Tipos de evento — seção 10 e épico 8.2. Lê os tipos da conta (servidor, filtrado por
// conta_id) e entrega à lista interativa. Sessão e dados dentro de <Suspense> (Cache Components).
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { EventTypeList } from "@/features/event-types/components/event-type-list";
import listStyles from "@/features/event-types/components/event-types.module.css";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { listEventTypes } from "@/server/db/event-types";
import styles from "../painel.module.css";

// Carrega os tipos da conta da sessão e monta a lista.
async function EventTypesContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  const types = await listEventTypes(account.id);
  return (
    <>
      <p className={styles.pageSubtitle}>
        <a href={`/${account.slug}`} target="_blank" rel="noreferrer">{copy.nav.viewMyPage}</a>
      </p>
      <EventTypeList
      initial={types.map(({ id, nome, slug, duracao_min, com_meet, visivel_na_pagina, ativo }) => ({ id, nome, slug, duracao_min, com_meet, visivel_na_pagina, ativo }))}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      accountSlug={account.slug}
      />
    </>
  );
}

// Página: título, botão "Novo tipo" e a lista (que carrega em streaming).
export default function EventTypesPage() {
  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{copy.eventTypes.title}</h1>
        <Link href="/painel/tipos/novo" className={listStyles.primaryButton}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          {copy.eventTypes.newType}
        </Link>
      </div>
      <Suspense fallback={<div className={listStyles.empty} aria-busy="true" />}>
        <EventTypesContent />
      </Suspense>
    </>
  );
}
