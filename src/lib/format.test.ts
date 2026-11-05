// Testes de formatação (seção 17).
import { describe, expect, it } from "vitest";
import { formatDuration, formatMinutes, publicTypeUrl } from "./format";

describe("formatDuration", () => {
  it("formata como no Calendly", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(120)).toBe("2 h");
  });
});

describe("publicTypeUrl", () => {
  it("monta o link do critério 8.2", () => {
    expect(publicTypeUrl("https://reuniao.app.br/", "alexandre", "entrevistas")).toBe("https://reuniao.app.br/alexandre/entrevistas");
  });
});

describe("formatMinutes", () => {
  it("usa dias quando é múltiplo de 24 h", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(240)).toBe("4 h");
    expect(formatMinutes(1440)).toBe("1 dia");
    expect(formatMinutes(10080)).toBe("7 dias");
  });
});
