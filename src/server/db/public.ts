// Leituras da página pública (convidado) — seções 5, 10 e 11.2. Só colunas necessárias; nada de
// e-mail do dono, token ou dados de outros convidados. Sempre por slug da conta + conta_id.
import "server-only";
import { db } from "./client";

export type PublicAccount = {
  id: string;
  slug: string;
  nome_exibicao: string;
  mensagem_boas_vindas: string | null;
  fuso: string;
  feriados_ativos: boolean;
  feriados_desligados: string[];
  conexao_ativa: boolean;
};

// Conta pelo endereço público, com a situação da conexão Google. Devolve null se não existe.
export async function getPublicAccount(slug: string): Promise<PublicAccount | null> {
  const { data, error } = await db()
    .from("ag_contas")
    .select("id, slug, nome_exibicao, mensagem_boas_vindas, fuso, feriados_ativos, feriados_desligados, ag_conexoes_google(status)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { ag_conexoes_google: conexao, ...rest } = data;
  return { ...rest, conexao_ativa: conexao?.status === "ativa" };
}

export type PublicEventType = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  duracao_min: number;
  com_meet: boolean;
  antecedencia_min: number;
  janela_dias: number;
  intervalo_antes_min: number;
  intervalo_depois_min: number;
  passo_min: number;
  visivel_na_pagina: boolean;
  ativo: boolean;
};

// Tipo de evento pelo slug, entre os não excluídos da conta. Devolve null se não existe.
export async function getPublicEventType(contaId: string, slug: string): Promise<PublicEventType | null> {
  const { data, error } = await db()
    .from("ag_tipos_evento")
    .select("id, nome, slug, descricao, duracao_min, com_meet, antecedencia_min, janela_dias, intervalo_antes_min, intervalo_depois_min, passo_min, visivel_na_pagina, ativo")
    .eq("conta_id", contaId)
    .eq("slug", slug)
    .is("excluido_em", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Reservas que ocupam horário (processando ou confirmada) e cruzam [fromIso, toIso) — regra 11.2.
export async function listBlockingReservations(contaId: string, fromIso: string, toIso: string): Promise<{ inicio: string; fim: string }[]> {
  const { data, error } = await db()
    .from("ag_reservas")
    .select("inicio, fim")
    .eq("conta_id", contaId)
    .in("status", ["processando", "confirmada"])
    .lt("inicio", toIso)
    .gt("fim", fromIso);
  if (error) throw error;
  return data;
}

// Tipos que aparecem na página da conta: não excluídos, ativos e visíveis, na ordem do painel.
export async function listPublicEventTypes(contaId: string): Promise<Pick<PublicEventType, "id" | "nome" | "slug" | "duracao_min" | "com_meet" | "descricao">[]> {
  const { data, error } = await db()
    .from("ag_tipos_evento")
    .select("id, nome, slug, duracao_min, com_meet, descricao")
    .eq("conta_id", contaId)
    .is("excluido_em", null)
    .eq("ativo", true)
    .eq("visivel_na_pagina", true)
    .order("ordem")
    .order("criado_em");
  if (error) throw error;
  return data;
}

// Reserva para a tela de confirmado (só com o cookie certo; ver src/server/auth/confirmation.ts).
export async function getConfirmedReservation(reservaId: string) {
  const { data, error } = await db()
    .from("ag_reservas")
    .select("id, inicio, fim, email_convidado, fuso_convidado, link_meet, status, ag_tipos_evento(nome), ag_contas(nome_exibicao, slug)")
    .eq("id", reservaId)
    .eq("status", "confirmada")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Diz se o endereço público existe: conta pelo slug e, se vier, tipo não excluído da conta.
// Usado pelo proxy para responder 404 de verdade antes do streaming (critério 8.5).
export async function publicPathExists(accountSlug: string, typeSlug?: string): Promise<boolean> {
  const { data: conta, error } = await db().from("ag_contas").select("id").eq("slug", accountSlug).maybeSingle();
  if (error) throw error;
  if (!conta) return false;
  if (!typeSlug) return true;
  const { data: tipo, error: e2 } = await db()
    .from("ag_tipos_evento")
    .select("id")
    .eq("conta_id", conta.id)
    .eq("slug", typeSlug)
    .is("excluido_em", null)
    .maybeSingle();
  if (e2) throw e2;
  return !!tipo;
}
