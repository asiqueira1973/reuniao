// Testes da validação dos tipos de evento (seção 7.3, critérios 8.2).
import { describe, expect, it } from "vitest";
import { createEventTypeSchema, patchEventTypeSchema, reorderSchema } from "./schema";

describe("createEventTypeSchema", () => {
  it("aceita só nome e duração e não inventa padrões", () => {
    const r = createEventTypeSchema.parse({ nome: " Entrevistas ", duracao_min: 60 });
    expect(r).toEqual({ nome: "Entrevistas", duracao_min: 60 });
  });
  it("exige nome", () => {
    expect(createEventTypeSchema.safeParse({ duracao_min: 60 }).success).toBe(false);
    expect(createEventTypeSchema.safeParse({ nome: "  " }).success).toBe(false);
  });
  it("recusa valores fora dos limites de 7.3", () => {
    const bad = [
      { duracao_min: 10 }, { duracao_min: 245 }, { duracao_min: 32 },
      { antecedencia_min: -1 }, { antecedencia_min: 10081 },
      { janela_dias: 0 }, { janela_dias: 366 },
      { intervalo_antes_min: 121 }, { intervalo_depois_min: -5 },
      { passo_min: 25 }, { slug: "A b" }, { nome: "x".repeat(61) },
      { descricao: "x".repeat(1001) },
    ];
    for (const b of bad) expect(createEventTypeSchema.safeParse({ nome: "Ok", ...b }).success, JSON.stringify(b)).toBe(false);
  });
  it("aceita os passos válidos e descrição vazia vira null", () => {
    expect(createEventTypeSchema.parse({ nome: "Ok", passo_min: 45, descricao: "" })).toEqual({ nome: "Ok", passo_min: 45, descricao: null });
  });
  it("recusa campo desconhecido", () => {
    expect(createEventTypeSchema.safeParse({ nome: "Ok", conta_id: "x" }).success).toBe(false);
  });
});

describe("patchEventTypeSchema", () => {
  it("não preenche campos ausentes (sem padrões herdados)", () => {
    expect(patchEventTypeSchema.parse({ ativo: false })).toEqual({ ativo: false });
    expect(patchEventTypeSchema.parse({})).toEqual({});
  });
  it("mantém os limites", () => {
    expect(patchEventTypeSchema.safeParse({ duracao_min: 7 }).success).toBe(false);
  });
});

describe("reorderSchema", () => {
  it("exige lista de uuids", () => {
    expect(reorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(reorderSchema.safeParse({ ids: ["x"] }).success).toBe(false);
    expect(reorderSchema.safeParse({ ids: ["7c9e6679-7425-40de-944b-e07fc1f90ae7"] }).success).toBe(true);
  });
});
