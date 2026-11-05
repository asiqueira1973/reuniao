// Layout do painel do dono — seções 10 e 16: menu lateral + conteúdo.
// O proxy já barrou quem não tem cookie; aqui a sessão é validada no banco (getCurrentAccount)
// e, sem conta, volta para /entrar. Com Cache Components, a leitura fica dentro de <Suspense>.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { getCurrentAccount } from "@/server/auth/require-conta";
import styles from "./painel.module.css";

// Lê a conta da sessão e monta o menu com nome, e-mail e endereço público.
async function PanelShell({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  return (
    <>
      <Sidebar displayName={account.displayName} email={account.email} slug={account.slug} />
      <main className={styles.content}>{children}</main>
    </>
  );
}

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<main className={styles.content} aria-busy="true" />}>
        <PanelShell>{children}</PanelShell>
      </Suspense>
    </div>
  );
}
