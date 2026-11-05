// Testes das faixas de horário (seção 7.3 e função ag_fn_valida_faixas), antes da implementação.
import { describe, expect, it } from "vitest";
import { findOverlap, isValidRange, isValidTime, nextDefaultRange, toHHMM, toMinutes } from "./ranges";

describe("isValidTime / isValidRange", () => {
  it("aceita HH:MM múltiplo de 5 e fim > início", () => {
    expect(isValidTime("10:30")).toBe(true);
    expect(isValidTime("10:07")).toBe(false);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:30")).toBe(false);
    expect(isValidRange({ inicio: "10:30", fim: "12:00" })).toBe(true);
    expect(isValidRange({ inicio: "12:00", fim: "12:00" })).toBe(false);
    expect(isValidRange({ inicio: "14:00", fim: "12:00" })).toBe(false);
  });
});

describe("findOverlap", () => {
  it("acha sobreposição no mesmo grupo e aceita faixas que só encostam", () => {
    expect(findOverlap([{ inicio: "10:30", fim: "12:00" }, { inicio: "11:30", fim: "13:00" }])).toBe(true);
    expect(findOverlap([{ inicio: "10:00", fim: "12:00" }, { inicio: "12:00", fim: "13:00" }])).toBe(false);
    expect(findOverlap([{ inicio: "14:30", fim: "18:00" }, { inicio: "10:30", fim: "12:00" }])).toBe(false);
  });
});

describe("conversões", () => {
  it("minutos ↔ HH:MM e corte dos segundos do banco", () => {
    expect(toMinutes("14:30")).toBe(870);
    expect(toHHMM(870)).toBe("14:30");
    expect(toHHMM("10:30:00")).toBe("10:30");
  });
});

describe("nextDefaultRange", () => {
  it("dia vazio começa 09:00–17:00; senão uma hora depois da última faixa, sem passar de 23:55", () => {
    expect(nextDefaultRange([])).toEqual({ inicio: "09:00", fim: "17:00" });
    expect(nextDefaultRange([{ inicio: "10:30", fim: "12:00" }])).toEqual({ inicio: "13:00", fim: "14:00" });
    expect(nextDefaultRange([{ inicio: "20:00", fim: "23:00" }])).toEqual({ inicio: "23:00", fim: "23:55" });
    expect(nextDefaultRange([{ inicio: "20:00", fim: "23:55" }])).toBeNull();
  });
  it("ignora faixa com campo apagado (não sugere NaN)", () => {
    expect(nextDefaultRange([{ inicio: "10:30", fim: "" }])).toEqual({ inicio: "09:00", fim: "17:00" });
    expect(nextDefaultRange([{ inicio: "08:00", fim: "09:00" }, { inicio: "", fim: "" }])).toEqual({ inicio: "10:00", fim: "11:00" });
  });
});
