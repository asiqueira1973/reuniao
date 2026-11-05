// Tipos de evento do dono — seções 7.3, 7.4 e épico 8.2.
// Todo helper recebe conta_id como parâmetro obrigatório: a service role ignora RLS, então o
// filtro por conta é o que garante a matriz da seção 5 ("só da própria conta").
import "server-only";
import type { CreateEventTypeInput, PatchEventTypeInput } from "@/features/event-types/schema";
import { normalizeSlug } from "@/lib/slug";
import { db } from "./client";
import type { Database } from "./types";

type Row = Database["public"]["Tables"]["ag_tipos_evento"]["Row"];

// Colunas que o painel usa (nunca select("*") por hábito; aqui todas são do dono).
export const EVENT_TYPE_COLUMNS =
  "id, nome, slug, descricao, duracao_min, com_meet, antecedencia_min, janela_dias, intervalo_antes_min, intervalo_depois_min, passo_min, visivel_na_pagina, ativo, ordem" as const;

export type EventType = Pick<
  Row,
  | "id" | "nome" | "slug" | "descricao" | "duracao_min" | "com_meet" | "antecedencia_min" | "janela_dias"
  | "intervalo_antes_min" | "intervalo_depois_min" | "passo_min" | "visivel_na_pagina" | "ativo" | "ordem"
>;

// Erro de negócio com código da seção 13 (o servidor devolve { erro: code }).
export class EventTypeError extends Error {
  constructor(public readonly code: "slug_em_uso" | "slug_invalido" | "nao_encontrado") {
    super(code);
  }
}

// Traduz o erro do PostgREST: índice único do slug (7.3) → slug_em_uso.
function translate(error: { code?: string; message?: string }): never {
  if (error.code === "23505") throw new EventTypeError("slug_em_uso");
  if (error.code === "23514" && error.message?.includes("slug")) throw new EventTypeError("slug_invalido");
  throw error;
}

// Lista os tipos não excluídos da conta, na ordem do painel (ordem, depois criação).
export async function listEventTypes(contaId: string): Promise<EventType[]> {
  const { data, error } = await db()
    .from("ag_tipos_evento")
    .select(EVENT_TYPE_COLUMNS)
    .eq("conta_id", contaId)
    .is("excluido_em", null)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return data;
}

// Lê um tipo da conta. Devolve null se não existir, for de outra conta ou estiver excluído.
export async function getEventType(contaId: string, id: string): Promise<EventType | null> {
  const { data, error } = await db()
    .from("ag_tipos_evento")
    .select(EVENT_TYPE_COLUMNS)
    .eq("conta_id", contaId)
    .eq("id", id)
    .is("excluido_em", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Cria um tipo (critério 8.2). Slug ausente é sugerido do nome (regra 11.11). O novo tipo entra
// no fim da lista. Campos ausentes ficam com os defaults de 7.3 (aplicados pelo banco).
export async function createEventType(contaId: string, input: CreateEventTypeInput): Promise<EventType> {
  const slug = input.slug ?? normalizeSlug(input.nome);
  const { data: last } = await db()
    .from("ag_tipos_evento")
    .select("ordem")
    .eq("conta_id", contaId)
    .is("excluido_em", null)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db()
    .from("ag_tipos_evento")
    .insert({ ...input, slug, conta_id: contaId, ordem: (last?.ordem ?? -1) + 1 })
    .select(EVENT_TYPE_COLUMNS)
    .single();
  if (error) translate(error);
  return data!;
}

// Atualiza campos de um tipo da conta. Devolve o tipo atualizado ou lança nao_encontrado.
export async function updateEventType(contaId: string, id: string, patch: PatchEventTypeInput): Promise<EventType> {
  // Sem campos para mudar, o PostgREST não devolve a linha: só confere que o tipo é da conta.
  if (Object.keys(patch).length === 0) {
    const current = await getEventType(contaId, id);
    if (!current) throw new EventTypeError("nao_encontrado");
    return current;
  }
  const { data, error } = await db()
    .from("ag_tipos_evento")
    .update(patch)
    .eq("conta_id", contaId)
    .eq("id", id)
    .is("excluido_em", null)
    .select(EVENT_TYPE_COLUMNS)
    .maybeSingle();
  if (error) translate(error);
  if (!data) throw new EventTypeError("nao_encontrado");
  return data;
}

// Exclui (soft delete, 7.4): grava excluido_em. Reservas já confirmadas continuam valendo, e o
// slug fica livre (o índice único é parcial). Lança nao_encontrado se não for da conta.
export async function deleteEventType(contaId: string, id: string): Promise<void> {
  const { data, error } = await db()
    .from("ag_tipos_evento")
    .update({ excluido_em: new Date().toISOString() })
    .eq("conta_id", contaId)
    .eq("id", id)
    .is("excluido_em", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new EventTypeError("nao_encontrado");
}

// Reordena: cada id recebe ordem = posição na lista. Ids de outras contas são ignorados pelo
// filtro conta_id (não mudam nada).
export async function reorderEventTypes(contaId: string, ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, ordem) =>
      db().from("ag_tipos_evento").update({ ordem }).eq("conta_id", contaId).eq("id", id).is("excluido_em", null),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
