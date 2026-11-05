// Testes da regra 11.4 (feriados nacionais), escritos antes do cálculo.
import { describe, expect, it } from "vitest";
import { easterDate, holidayDates, isHolidayActive, nextHolidayDate } from "./holidays";

describe("easterDate (Meeus/Jones/Butcher)", () => {
  it("bate com os casos do spec", () => {
    expect(easterDate(2026)).toBe("2026-04-05");
    expect(easterDate(2027)).toBe("2027-03-28");
    expect(easterDate(2028)).toBe("2028-04-16");
  });
});

describe("holidayDates", () => {
  it("2027: fixos e móveis", () => {
    const d = holidayDates(2027);
    expect(d.confraternizacao).toBe("2027-01-01");
    expect(d.carnaval_segunda).toBe("2027-02-08");
    expect(d.carnaval_terca).toBe("2027-02-09");
    expect(d.cinzas).toBe("2027-02-10");
    expect(d.sexta_santa).toBe("2027-03-26");
    expect(d.tiradentes).toBe("2027-04-21");
    expect(d.trabalho).toBe("2027-05-01");
    expect(d.corpus_christi).toBe("2027-05-27");
    expect(d.independencia).toBe("2027-09-07");
    expect(d.aparecida).toBe("2027-10-12");
    expect(d.finados).toBe("2027-11-02");
    expect(d.republica).toBe("2027-11-15");
    expect(d.consciencia_negra).toBe("2027-11-20");
    expect(d.natal).toBe("2027-12-25");
  });
  it("2026: Corpus Christi = Páscoa + 60", () => {
    expect(holidayDates(2026).corpus_christi).toBe("2026-06-04");
  });
});

describe("nextHolidayDate", () => {
  it("usa o ano corrente se ainda não passou, senão o seguinte", () => {
    expect(nextHolidayDate("republica", "2026-11-04")).toBe("2026-11-15");
    expect(nextHolidayDate("finados", "2026-11-04")).toBe("2027-11-02");
    expect(nextHolidayDate("finados", "2026-11-02")).toBe("2026-11-02");
  });
});

describe("isHolidayActive (regra 11.4)", () => {
  it("chave geral e lista de desligados", () => {
    expect(isHolidayActive("natal", { feriados_ativos: true, feriados_desligados: [] })).toBe(true);
    expect(isHolidayActive("natal", { feriados_ativos: true, feriados_desligados: ["natal"] })).toBe(false);
    expect(isHolidayActive("natal", { feriados_ativos: false, feriados_desligados: [] })).toBe(false);
  });
});
