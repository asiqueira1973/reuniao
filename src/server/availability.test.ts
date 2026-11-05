// Testes de subtractInterval (remarcação, 8.6): o intervalo da reunião sai dos ocupados.
import { describe, expect, it } from "vitest";
import { subtractInterval } from "./availability";

const CUT = { inicio: "2026-11-10T17:30:00.000Z", fim: "2026-11-10T18:30:00.000Z" };

describe("subtractInterval", () => {
  it("bloco igual some; bloco fora fica", () => {
    expect(subtractInterval([CUT], CUT)).toEqual([]);
    const other = { inicio: "2026-11-10T19:00:00.000Z", fim: "2026-11-10T20:00:00.000Z" };
    expect(subtractInterval([other], CUT)).toEqual([other]);
  });
  it("bloco maior (eventos colados que o Google juntou) vira o que sobra antes e depois", () => {
    const merged = { inicio: "2026-11-10T17:00:00.000Z", fim: "2026-11-10T19:00:00.000Z" };
    expect(subtractInterval([merged], CUT)).toEqual([
      { inicio: "2026-11-10T17:00:00.000Z", fim: "2026-11-10T17:30:00.000Z" },
      { inicio: "2026-11-10T18:30:00.000Z", fim: "2026-11-10T19:00:00.000Z" },
    ]);
  });
});
