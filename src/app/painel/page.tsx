// [Dono] Painel — provisório do épico 8.1: confirma a sessão mostrando a conta e o botão Sair.
// No épico 8.2 vira o layout com menu lateral e passa a abrir em Tipos de evento.
// Sessão lida dentro de <Suspense> (Cache Components); sem conta, volta para /entrar.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import styles from "./painel.module.css";

// Mostra a conta da sessão (nome, e-mail, endereço) e o formulário POST /sair.
async function AccountSummary() {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{account.displayName}</h1>
      <p className={styles.secondary}>{account.email}</p>
      <p className={styles.secondary}>/{account.slug}</p>
      <form action="/sair" method="post">
        <button className={styles.button} type="submit">{copy.nav.signOut}</button>
      </form>
    </div>
  );
}

export default function PainelPage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={<div className={styles.card} aria-busy="true" />}>
        <AccountSummary />
      </Suspense>
    </main>
  );
}
