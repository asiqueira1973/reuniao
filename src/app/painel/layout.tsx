// Layout do painel do dono — seções 10 e 16: menu lateral + conteúdo.
// O proxy já barrou quem não tem cookie; aqui a sessão é validada no banco (getCurrentAccount)
// e, sem conta, volta para /entrar. Com Cache Components, a leitura fica dentro de <Suspense>.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { getConnectionStatus } from "@/server/db/account-settings";
import styles from "./painel.module.css";

// Lê a conta da sessão e monta o menu com nome, e-mail e endereço público. Conexão revogada →
// faixa laranja "Reconectar Google" acima do conteúdo (seção 6, texto da seção 15).
async function PanelShell({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  const revoked = (await getConnectionStatus(account.id)) === "revogada";
  return (
    <>
      <Sidebar displayName={account.displayName} email={account.email} slug={account.slug} />
      <main className={styles.content}>
        {revoked ? (
          <div className={styles.reconnectBanner} role="alert">
            <span>{copy.account.reconnectBanner}</span>
            {/* Rota de API (redireciona ao Google), não página. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/auth/google">{copy.account.reconnectButton}</a>
          </div>
        ) : null}
        {children}
      </main>
    </>
  );
}

// Casca do painel: menu + conteúdo, com a sessão lida em streaming.
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<main className={styles.content} aria-busy="true" />}>
        <PanelShell>{children}</PanelShell>
      </Suspense>
    </div>
  );
}
