// Testes de formatação (seção 17).
import { describe, expect, it } from "vitest";
import { formatDateLong, formatDateShort, formatDateTimeLong, formatDateTimeShort, formatDuration, formatMinutes, publicTypeUrl, timeZoneName } from "./format";

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

describe("datas (seção 17)", () => {
  it("por extenso e curta, sem trocar de dia", () => {
    expect(formatDateLong("2026-11-04", 2026)).toBe("quarta-feira, 4 de novembro");
    expect(formatDateLong("2027-01-01", 2026)).toBe("sexta-feira, 1 de janeiro de 2027");
    expect(formatDateShort("2027-01-01")).toBe("1 de jan. de 2027");
  });
});

describe("data e hora com fuso (e-mails e confirmação)", () => {
  it("por extenso, curta e nome do fuso", () => {
    expect(formatDateTimeLong("2026-11-09T13:30:00Z", "America/Sao_Paulo")).toBe("segunda-feira, 9 de novembro de 2026 às 10:30");
    expect(formatDateTimeShort("2026-11-09T13:30:00Z", "America/Sao_Paulo")).toBe("09/11 às 10:30");
    expect(formatDateTimeShort("2026-11-09T13:30:00Z", "Europe/Lisbon")).toBe("09/11 às 13:30");
    expect(timeZoneName("America/Sao_Paulo")).toMatch(/Brasília/);
  });
});
