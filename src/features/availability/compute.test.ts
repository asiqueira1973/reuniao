// Testes do motor de disponibilidade (regra 11.2), escritos antes de compute.ts.
// Base: agora = domingo 08/11/2026 09:00 em Brasília (12:00 UTC); seg 09/11 é o primeiro dia útil.
import { describe, expect, it } from "vitest";
import { computeSlots, type SlotsInput } from "./compute";

const TZ = "America/Sao_Paulo";
const NOW = new Date("2026-11-08T12:00:00Z");
const DEFAULT_WEEK = [1, 2, 3, 4, 5].flatMap((dia_semana) => [
  { dia_semana, inicio: "10:30", fim: "12:00" },
  { dia_semana, inicio: "14:30", fim: "18:00" },
]);

// Monta a entrada com os padrões da conta nova (11.9) e do tipo (7.3), sobrescrevendo o que vier.
function input(over: Partial<SlotsInput> & { tipo?: Partial<SlotsInput["eventType"]> } = {}): SlotsInput {
  const { tipo, ...rest } = over;
  return {
    eventType: { duracao_min: 30, passo_min: 30, antecedencia_min: 240, janela_dias: 60, intervalo_antes_min: 0, intervalo_depois_min: 0, ...tipo },
    timeZone: TZ,
    weekly: DEFAULT_WEEK,
    overrides: [],
    holidays: { feriados_ativos: true, feriados_desligados: [] },
    busy: [],
    now: NOW,
    ...rest,
  };
}

// Horários de uma data, em HH:MM de Brasília.
function on(result: ReturnType<typeof computeSlots>, date: string): string[] {
  const day = result.find((d) => d.data === date);
  return (day?.horarios ?? []).map((iso) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)),
  );
}

describe("tabela de exemplos da regra 11.2 (seg 09/11/2026)", () => {
  const cases: [number, string[], string[]][] = [
    [30, ["10:30", "11:00", "11:30"], ["14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]],
    [60, ["10:30", "11:00"], ["14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]],
    [90, ["10:30"], ["14:30", "15:00", "15:30", "16:00", "16:30"]],
    [120, [], ["14:30", "15:00", "15:30", "16:00"]],
  ];
  for (const [dur, morning, afternoon] of cases) {
    it(`${dur} min`, () => {
      expect(on(computeSlots(input({ tipo: { duracao_min: dur } })), "2026-11-09")).toEqual([...morning, ...afternoon]);
    });
  }
  it("a faixa não emenda com a seguinte (nada entre 12:00 e 14:30)", () => {
    const slots = on(computeSlots(input({ tipo: { duracao_min: 60 } })), "2026-11-09");
    expect(slots).not.toContain("11:30");
    expect(slots).not.toContain("12:00");
  });
  it("saída em ISO UTC, ordenada", () => {
    const day = computeSlots(input()).find((d) => d.data === "2026-11-09")!;
    expect(day.horarios[0]).toBe("2026-11-09T13:30:00.000Z");
    expect([...day.horarios].sort()).toEqual(day.horarios);
  });
});

describe("dias candidatos e janela", () => {
  it("fim de semana sem faixa não tem horários; domingo de hoje também não", () => {
    const r = computeSlots(input());
    expect(on(r, "2026-11-08")).toEqual([]);
    expect(on(r, "2026-11-14")).toEqual([]);
  });
  it("janela_dias: hoje + janela − 1", () => {
    const r = computeSlots(input({ tipo: { janela_dias: 2 } }));
    expect(r.map((d) => d.data)).toEqual(["2026-11-09"]);
    expect(computeSlots(input({ tipo: { janela_dias: 1 } }))).toEqual([]);
  });
  it("respeita o intervalo pedido (de/até)", () => {
    const r = computeSlots(input({ from: "2026-11-10", to: "2026-11-11" }));
    expect(r.map((d) => d.data)).toEqual(["2026-11-10", "2026-11-11"]);
  });
  it("intervalo pedido antes de hoje é recortado", () => {
    const r = computeSlots(input({ from: "2026-11-01", to: "2026-11-09" }));
    expect(r.map((d) => d.data)).toEqual(["2026-11-09"]);
  });
});

describe("antecedência", () => {
  it("descarta início antes de agora + antecedência; exatamente na borda vale", () => {
    // agora = seg 09/11 06:30 BRT; antecedência 4 h → primeiro início possível 10:30.
    const now = new Date("2026-11-09T09:30:00Z");
    expect(on(computeSlots(input({ now })), "2026-11-09")[0]).toBe("10:30");
    const later = new Date("2026-11-09T09:31:00Z");
    expect(on(computeSlots(input({ now: later })), "2026-11-09")[0]).toBe("11:00");
  });
});

describe("feriados (regra 11.4)", () => {
  // Sexta 20/11/2026 = Consciência Negra.
  it("feriado ativo não tem horários", () => {
    expect(on(computeSlots(input()), "2026-11-20")).toEqual([]);
  });
  it("feriado desligado volta a ter horários; chave geral desligada também", () => {
    expect(on(computeSlots(input({ holidays: { feriados_ativos: true, feriados_desligados: ["consciencia_negra"] } })), "2026-11-20")).toHaveLength(10);
    expect(on(computeSlots(input({ holidays: { feriados_ativos: false, feriados_desligados: [] } })), "2026-11-20")).toHaveLength(10);
  });
});

describe("datas específicas", () => {
  it("indisponível tira o dia inteiro", () => {
    expect(on(computeSlots(input({ overrides: [{ data: "2026-11-10", tipo: "indisponivel", faixas: [] }] })), "2026-11-10")).toEqual([]);
  });
  it("horário especial substitui as faixas semanais só naquela data, inclusive em feriado e fim de semana", () => {
    const r = computeSlots(input({
      overrides: [
        { data: "2026-11-10", tipo: "horario_especial", faixas: [{ inicio: "08:00", fim: "09:00" }] },
        { data: "2026-11-14", tipo: "horario_especial", faixas: [{ inicio: "09:00", fim: "10:00" }] },
        { data: "2026-11-20", tipo: "horario_especial", faixas: [{ inicio: "09:00", fim: "09:30" }] },
      ],
    }));
    expect(on(r, "2026-11-10")).toEqual(["08:00", "08:30"]);
    expect(on(r, "2026-11-11")).toHaveLength(10);
    expect(on(r, "2026-11-14")).toEqual(["09:00", "09:30"]);
    expect(on(r, "2026-11-20")).toEqual(["09:00"]);
  });
});

describe("conflitos", () => {
  const BUSY_15 = [{ inicio: "2026-11-09T18:00:00Z", fim: "2026-11-09T18:30:00Z" }]; // 15:00–15:30 BRT
  it("compromisso 15:00–15:30 remove todos os horários que o tocam (1 h)", () => {
    const slots = on(computeSlots(input({ tipo: { duracao_min: 60 }, busy: BUSY_15 })), "2026-11-09");
    expect(slots).toEqual(["10:30", "11:00", "15:30", "16:00", "16:30", "17:00"]);
  });
  it("encostar não é cruzar; com folga antes de 15 min, cruza", () => {
    const busyTo15 = [{ inicio: "2026-11-09T17:00:00Z", fim: "2026-11-09T18:00:00Z" }]; // 14:00–15:00 BRT
    expect(on(computeSlots(input({ busy: busyTo15 })), "2026-11-09")).toContain("15:00");
    const withBuffer = on(computeSlots(input({ busy: busyTo15, tipo: { intervalo_antes_min: 15 } })), "2026-11-09");
    expect(withBuffer).not.toContain("15:00");
    expect(withBuffer).toContain("15:30");
  });
  it("folga depois: reunião que terminaria encostando no compromisso, com folga, sai", () => {
    expect(on(computeSlots(input({ busy: BUSY_15 })), "2026-11-09")).toContain("14:30");
    expect(on(computeSlots(input({ busy: BUSY_15, tipo: { intervalo_depois_min: 10 } })), "2026-11-09")).not.toContain("14:30");
  });
  it("ocupado atravessando as duas faixas", () => {
    const busy = [{ inicio: "2026-11-09T14:00:00Z", fim: "2026-11-09T18:00:00Z" }]; // 11:00–15:00 BRT
    expect(on(computeSlots(input({ busy })), "2026-11-09")).toEqual(["10:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]);
  });
});

describe("princípio 2 com dado ruim", () => {
  it("ocupado com data ilegível não pode liberar horário: nenhum horário é oferecido", () => {
    expect(computeSlots(input({ busy: [{ inicio: "lixo", fim: "2026-11-09T18:30:00Z" }] }))).toEqual([]);
  });
});

describe("passo", () => {
  it("passo de 45 min começa no início da faixa", () => {
    expect(on(computeSlots(input({ tipo: { passo_min: 45 } })), "2026-11-09")).toEqual(["10:30", "11:15", "14:30", "15:15", "16:00", "16:45", "17:30"]);
  });
});
