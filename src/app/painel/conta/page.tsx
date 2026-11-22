// [Dono] Conta — seção 10 e épico 8.8: perfil, endereço, mensagem, fuso, Google Agenda e excluir;
// plano 9.6: assistentes conectados pelo MCP.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AccountForm } from "@/features/account/components/account-form";
import { AssistantsSection } from "@/features/account/components/assistants-section";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { getAccountSettings } from "@/server/db/account-settings";
import { listMcpConnections } from "@/server/oauth/tokens";
import { mcpResource } from "@/server/oauth/server";
import styles from "../painel.module.css";

// Lista de fusos IANA do servidor (a mesma em todo render, sem diferença de hidratação).
function timeZones(): string[] {
  return typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["America/Sao_Paulo"];
}

// Lê as configurações da conta da sessão e abre o formulário.
async function AccountContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  const [conta, conexoes] = await Promise.all([getAccountSettings(account.id), listMcpConnections(account.id)]);
  if (!conta) redirect("/entrar");
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: conta.fuso, day: "numeric", month: "short", year: "numeric" });
  const rows = conexoes.map((x) => ({ id: x.id, nome: x.nome, conectadoEm: fmt.format(new Date(x.criado_em)), ultimoUso: x.ultimo_uso_em ? fmt.format(new Date(x.ultimo_uso_em)) : null }));
  return (
    <>
    <AccountForm
      initial={{ nome_exibicao: conta.nome_exibicao, slug: conta.slug, mensagem_boas_vindas: conta.mensagem_boas_vindas ?? "", fuso: conta.fuso }}
      email={conta.email}
      connection={conta.conexao}
      timeZones={timeZones()}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
    />
    <AssistantsSection mcpUrl={mcpResource()} rows={rows} />
    </>
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
