// Testes do agrupamento por data no fuso do convidado (regra 11.1), escritos antes de group.ts.
import { describe, expect, it } from "vitest";
import { groupByLocalDate, localTime } from "./group";

const SLOTS = [
  "2026-11-09T13:30:00.000Z", // 10:30 Brasília
  "2026-11-09T20:30:00.000Z", // 17:30 Brasília
  "2026-11-10T01:00:00.000Z", // 22:00 Brasília (de 09/11)
];

describe("groupByLocalDate", () => {
  it("Brasília: tudo em 09/11", () => {
    expect(groupByLocalDate(SLOTS, "America/Sao_Paulo")).toEqual({ "2026-11-09": SLOTS });
  });
  it("Lisboa (UTC+0 em novembro): 22:00 de Brasília vira 01:00 de 10/11", () => {
    const g = groupByLocalDate(SLOTS, "Europe/Lisbon");
    expect(g["2026-11-09"]).toEqual(SLOTS.slice(0, 2));
    expect(g["2026-11-10"]).toEqual([SLOTS[2]]);
    expect(localTime(SLOTS[0], "Europe/Lisbon")).toBe("13:30");
  });
  it("Los Angeles (UTC−8): 10:30 de Brasília vira 05:30", () => {
    expect(localTime(SLOTS[0], "America/Los_Angeles")).toBe("05:30");
    expect(Object.keys(groupByLocalDate(SLOTS, "America/Los_Angeles"))).toEqual(["2026-11-09"]);
  });
});
