// Validação dos tipos de evento — seção 7.3 (limites) e seção 13 (POST/PATCH /api/painel/tipos).
// Puro: usado pelas rotas e pelo editor. Sem .default(): na criação, o banco aplica os defaults de
// 7.3; no PATCH, campo ausente não muda (pegadinha do Zod 4: .default() sobrevive a .partial()).
import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";

// Valores aceitos para "horários começam a cada" (check ag_tipos_evento_passo_ck).
export const STEP_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120] as const;

const fields = {
  nome: z.string().trim().min(1).max(60),
  slug: z.string().regex(SLUG_PATTERN),
  // Texto vazio vira null (= "sem descrição", 7.3).
  descricao: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .transform((v) => (v ? v : null)),
  duracao_min: z.number().int().min(15).max(240).refine((v) => v % 5 === 0),
  com_meet: z.boolean(),
  antecedencia_min: z.number().int().min(0).max(10080),
  janela_dias: z.number().int().min(1).max(365),
  intervalo_antes_min: z.number().int().min(0).max(120),
  intervalo_depois_min: z.number().int().min(0).max(120),
  passo_min: z.number().int().refine((v) => (STEP_OPTIONS as readonly number[]).includes(v)),
  visivel_na_pagina: z.boolean(),
  ativo: z.boolean(),
};

// Criação: só o nome é obrigatório (critério 8.2); o slug, se faltar, é sugerido do nome.
export const createEventTypeSchema = z
  .object({
    nome: fields.nome,
    slug: fields.slug.optional(),
    descricao: fields.descricao.optional(),
    duracao_min: fields.duracao_min.optional(),
    com_meet: fields.com_meet.optional(),
    antecedencia_min: fields.antecedencia_min.optional(),
    janela_dias: fields.janela_dias.optional(),
    intervalo_antes_min: fields.intervalo_antes_min.optional(),
    intervalo_depois_min: fields.intervalo_depois_min.optional(),
    passo_min: fields.passo_min.optional(),
    visivel_na_pagina: fields.visivel_na_pagina.optional(),
    ativo: fields.ativo.optional(),
  })
  .strict();

// Edição: qualquer subconjunto dos campos, sem padrões.
export const patchEventTypeSchema = createEventTypeSchema.partial().strict();

export const reorderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(200) }).strict();

export type CreateEventTypeInput = z.infer<typeof createEventTypeSchema>;
export type PatchEventTypeInput = z.infer<typeof patchEventTypeSchema>;
