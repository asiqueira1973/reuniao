// Testes da regra 11.11 (slugs) e da sugestão de slug da conta nova (regra 11.9).
import { describe, expect, it } from "vitest";
import { isReservedAccountSlug, isValidSlug, normalizeSlug, slugCandidates } from "./slug";

describe("normalizeSlug (regra 11.11)", () => {
  it("converte a parte local do e-mail do exemplo do spec", () => {
    expect(normalizeSlug("alexandre.silva.siqueira")).toBe("alexandre-silva-siqueira");
  });
  it("tira acento, troca espaço e remove símbolos", () => {
    expect(normalizeSlug("Reunião de 1,5h")).toBe("reuniao-de-15h");
    expect(normalizeSlug("  Café   com  Ana!! ")).toBe("cafe-com-ana");
  });
  it("junta hífens e corta a 30 sem hífen no fim", () => {
    expect(normalizeSlug("a--b")).toBe("a-b");
    const long = normalizeSlug("palavra-muito-comprida-que-passa-de-trinta");
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("aceita e recusa conforme o formato", () => {
    expect(isValidSlug("alexandre")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-ab")).toBe(false);
    expect(isValidSlug("Ab")).toBe(false);
    expect(isValidSlug("a".repeat(31))).toBe(false);
  });
});

describe("isReservedAccountSlug", () => {
  it("reconhece a lista reservada", () => {
    expect(isReservedAccountSlug("painel")).toBe(true);
    expect(isReservedAccountSlug("alexandre")).toBe(false);
  });
});

describe("slugCandidates (regra 11.9)", () => {
  it("gera base, base-2, base-3", () => {
    expect(slugCandidates("alexandre", 3)).toEqual(["alexandre", "alexandre-2", "alexandre-3"]);
  });
  it("respeita 30 caracteres com sufixo", () => {
    const base = "a".repeat(30);
    for (const c of slugCandidates(base, 12)) expect(isValidSlug(c)).toBe(true);
  });
});
