// [Dono] Conta — seção 10 e épico 8.8: perfil, endereço, mensagem, fuso, Google Agenda e excluir.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AccountForm } from "@/features/account/components/account-form";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { getAccountSettings } from "@/server/db/account-settings";
import styles from "../painel.module.css";

// Lista de fusos IANA do servidor (a mesma em todo render, sem diferença de hidratação).
function timeZones(): string[] {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["America/Sao_Paulo"];
}

// Lê as configurações da conta da sessão e abre o formulário.
async function AccountContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  const conta = await getAccountSettings(account.id);
  if (!conta) redirect("/entrar");
  return (
    <AccountForm
      initial={{ nome_exibicao: conta.nome_exibicao, slug: conta.slug, mensagem_boas_vindas: conta.mensagem_boas_vindas ?? "", fuso: conta.fuso }}
      email={conta.email}
      connection={conta.conexao}
      timeZones={timeZones()}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
    />
  );
}

export default function AccountPage() {
  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{copy.account.title}</h1>
      </div>
      <Suspense fallback={null}>
        <AccountContent />
      </Suspense>
    </>
  );
}
