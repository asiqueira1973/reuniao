// Configurações da conta do dono — épico 8.8, seções 6, 7.4 e 20. Sempre por conta_id.
import "server-only";
import type { AccountPatch } from "@/features/account/schema";
import { decryptSecret } from "@/server/google/crypto";
import { clearTokenCache } from "@/server/google/calendar";
import { revokeToken } from "@/server/google/oauth";
import { db } from "./client";

export type AccountSettings = {
  nome_exibicao: string;
  slug: string;
  mensagem_boas_vindas: string | null;
  fuso: string;
  email: string;
  conexao: "ativa" | "revogada" | "ausente";
};

// Erro de negócio com o código da seção 13.
export class AccountError extends Error {
  constructor(public readonly code: "slug_em_uso" | "confirmacao_invalida" | "nao_encontrado") {
    super(code);
  }
}

// Lê as configurações e a situação da conexão Google.
export async function getAccountSettings(contaId: string): Promise<AccountSettings | null> {
  const { data, error } = await db()
    .from("ag_contas")
    .select("nome_exibicao, slug, mensagem_boas_vindas, fuso, email, ag_conexoes_google(status)")
    .eq("id", contaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { ag_conexoes_google: conexao, ...rest } = data;
  return { ...rest, conexao: conexao?.status ?? "ausente" };
}

// Situação da conexão Google (faixa de reconexão do painel).
export async function getConnectionStatus(contaId: string): Promise<AccountSettings["conexao"]> {
  const { data, error } = await db().from("ag_conexoes_google").select("status").eq("conta_id", contaId).maybeSingle();
  if (error) throw error;
  return data?.status ?? "ausente";
}

// Atualiza os campos enviados. Slug de outra conta → slug_em_uso (índice único do banco).
export async function updateAccountSettings(contaId: string, patch: AccountPatch): Promise<AccountSettings> {
  if (Object.keys(patch).length > 0) {
    const { error } = await db().from("ag_contas").update(patch).eq("id", contaId);
    if (error?.code === "23505") throw new AccountError("slug_em_uso");
    if (error) throw error;
  }
  const settings = await getAccountSettings(contaId);
  if (!settings) throw new AccountError("nao_encontrado");
  return settings;
}

// Conclui as boas-vindas (spec v0.5, 8.11): grava nome, endereço e fuso e o instante do aceite
// dos Termos e da Privacidade, numa única atualização (endereço ocupado → slug_em_uso, sem aceite).
export async function completeWelcome(
  contaId: string,
  values: { nome_exibicao: string; slug: string; fuso: string },
  now = new Date(),
): Promise<void> {
  const { error } = await db()
    .from("ag_contas")
    .update({ ...values, termos_aceitos_em: now.toISOString() })
    .eq("id", contaId);
  if (error?.code === "23505") throw new AccountError("slug_em_uso");
  if (error) throw error;
}

// Diz se o slug está livre para esta conta (o próprio slug atual conta como livre).
export async function isSlugAvailable(contaId: string, slug: string): Promise<boolean> {
  const { data, error } = await db().from("ag_contas").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return !data || data.id === contaId;
}

// Exclui a conta (critério 8.8): confere a confirmação (= slug), revoga o refresh token no
// Google e apaga a conta em cascata (tipos, faixas, datas, reservas, notificações, conexão).
// Eventos já criados no Google Agenda não são apagados.
export async function deleteAccount(contaId: string, confirmacao: string): Promise<void> {
  const { data: conta, error } = await db()
    .from("ag_contas")
    .select("slug, ag_conexoes_google(refresh_token_cifrado)")
    .eq("id", contaId)
    .maybeSingle();
  if (error) throw error;
  if (!conta) throw new AccountError("nao_encontrado");
  if (confirmacao.trim() !== conta.slug) throw new AccountError("confirmacao_invalida");
  const encrypted = conta.ag_conexoes_google?.refresh_token_cifrado;
  if (encrypted) {
    try {
      await revokeToken(decryptSecret(encrypted));
    } catch {
      // Token ilegível: segue com a exclusão (a conexão some junto com a conta).
    }
  }
  clearTokenCache(contaId);
  const { error: e2 } = await db().from("ag_contas").delete().eq("id", contaId);
  if (e2) throw e2;
}
