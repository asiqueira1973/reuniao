// Testes das rotas de disponibilidade (critérios 8.3, seção 5) no Supabase local.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { getWeeklyRanges, listDateOverrides } from "@/server/db/availability";
import { apiRequest, createTestAccount, deleteTestAccounts } from "../../../../../tests/helpers";
import { PUT as putWeekly } from "./semanal/route";
import { DELETE as deleteDate, PUT as putDate } from "./datas/route";
import { PUT as putHolidays } from "./feriados/route";

let a: Awaited<ReturnType<typeof createTestAccount>>;
let b: Awaited<ReturnType<typeof createTestAccount>>;

beforeAll(async () => {
  a = await createTestAccount("disp-a");
  b = await createTestAccount("disp-b");
  await db().rpc("ag_fn_substitui_horarios", { p_conta_id: b.id, p_faixas: [{ dia_semana: 1, inicio: "08:00", fim: "09:00" }] });
});
afterAll(() => deleteTestAccounts([a.id, b.id]));

// Envia uma requisição com a sessão da conta A.
function send(handler: (r: ReturnType<typeof apiRequest>) => Promise<Response>, path: string, method: string, body: unknown, cookie = a.cookie) {
  return handler(apiRequest(path, { method, cookie, body }));
}

describe("PUT /semanal", () => {
  it("troca todas as faixas e não mexe em outra conta", async () => {
    const faixas = [
      { dia_semana: 1, inicio: "10:30", fim: "12:00" },
      { dia_semana: 1, inicio: "14:30", fim: "18:00" },
      { dia_semana: 3, inicio: "09:00", fim: "10:00" },
    ];
    expect((await send(putWeekly, "/api/painel/disponibilidade/semanal", "PUT", { faixas })).status).toBe(200);
    expect(await getWeeklyRanges(a.id)).toEqual(faixas);
    expect(await getWeeklyRanges(b.id)).toEqual([{ dia_semana: 1, inicio: "08:00", fim: "09:00" }]);
  });
  it("sobreposição no mesmo dia → 422 faixa_sobreposta e nada muda", async () => {
    const res = await send(putWeekly, "/api/painel/disponibilidade/semanal", "PUT", {
      faixas: [{ dia_semana: 2, inicio: "10:00", fim: "12:00" }, { dia_semana: 2, inicio: "11:00", fim: "13:00" }],
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ erro: "faixa_sobreposta" });
    expect((await getWeeklyRanges(a.id)).length).toBe(3);
  });
  it("faixas que só encostam e semana vazia são aceitas", async () => {
    expect((await send(putWeekly, "/api/painel/disponibilidade/semanal", "PUT", {
      faixas: [{ dia_semana: 2, inicio: "10:00", fim: "12:00" }, { dia_semana: 2, inicio: "12:00", fim: "13:00" }],
    })).status).toBe(200);
    expect((await send(putWeekly, "/api/painel/disponibilidade/semanal", "PUT", { faixas: [] })).status).toBe(200);
    expect(await getWeeklyRanges(a.id)).toEqual([]);
  });
  it("horário fora do múltiplo de 5 ou fim antes do início → 422 dados_invalidos", async () => {
    for (const f of [{ inicio: "10:07", fim: "11:00" }, { inicio: "12:00", fim: "11:00" }]) {
      const res = await send(putWeekly, "/api/painel/disponibilidade/semanal", "PUT", { faixas: [{ dia_semana: 1, ...f }] });
      expect(await res.json()).toEqual({ erro: "dados_invalidos" });
    }
  });
  it("sem sessão → 401", async () => {
    expect((await putWeekly(apiRequest("/api/painel/disponibilidade/semanal", { method: "PUT", body: { faixas: [] } }))).status).toBe(401);
  });
});

describe("/datas", () => {
  it("data indisponível e depois horário especial substituindo", async () => {
    expect((await send(putDate, "/api/painel/disponibilidade/datas", "PUT", { data: "2030-05-10", tipo: "indisponivel" })).status).toBe(200);
    expect(await listDateOverrides(a.id, "2030-01-01")).toEqual([{ data: "2030-05-10", tipo: "indisponivel", faixas: [] }]);
    expect((await send(putDate, "/api/painel/disponibilidade/datas", "PUT", {
      data: "2030-05-10", tipo: "horario_especial", faixas: [{ inicio: "14:00", fim: "15:00" }, { inicio: "09:00", fim: "10:00" }],
    })).status).toBe(200);
    expect(await listDateOverrides(a.id, "2030-01-01")).toEqual([
      { data: "2030-05-10", tipo: "horario_especial", faixas: [{ inicio: "09:00", fim: "10:00" }, { inicio: "14:00", fim: "15:00" }] },
    ]);
  });
  it("faixas próprias sobrepostas → 422; horário especial sem faixa → 422", async () => {
    const overlap = await send(putDate, "/api/painel/disponibilidade/datas", "PUT", {
      data: "2030-05-11", tipo: "horario_especial", faixas: [{ inicio: "09:00", fim: "11:00" }, { inicio: "10:00", fim: "12:00" }],
    });
    expect(await overlap.json()).toEqual({ erro: "faixa_sobreposta" });
    expect((await send(putDate, "/api/painel/disponibilidade/datas", "PUT", { data: "2030-05-11", tipo: "horario_especial", faixas: [] })).status).toBe(422);
  });
  it("datas passadas não aparecem na lista, mas continuam no banco", async () => {
    await send(putDate, "/api/painel/disponibilidade/datas", "PUT", { data: "2030-03-01", tipo: "indisponivel" });
    expect((await listDateOverrides(a.id, "2030-04-01")).map((d) => d.data)).toEqual(["2030-05-10"]);
    const { count } = await db().from("ag_excecoes_data").select("id", { count: "exact", head: true }).eq("conta_id", a.id).eq("data", "2030-03-01");
    expect(count).toBe(1);
  });
  it("DELETE remove a data (200, seção 13); outra conta não apaga; repetir não é erro", async () => {
    expect((await send(deleteDate, "/api/painel/disponibilidade/datas", "DELETE", { data: "2030-05-10" }, b.cookie)).status).toBe(200);
    expect((await listDateOverrides(a.id, "2030-01-01")).map((d) => d.data)).toContain("2030-05-10");
    expect((await send(deleteDate, "/api/painel/disponibilidade/datas", "DELETE", { data: "2030-05-10" })).status).toBe(200);
    expect((await listDateOverrides(a.id, "2030-01-01")).map((d) => d.data)).not.toContain("2030-05-10");
    expect((await send(deleteDate, "/api/painel/disponibilidade/datas", "DELETE", { data: "2030-05-10" })).status).toBe(200);
  });
});

describe("PUT /feriados", () => {
  it("grava chave geral e desligados; código inexistente → 422", async () => {
    expect((await send(putHolidays, "/api/painel/disponibilidade/feriados", "PUT", { feriados_ativos: false, feriados_desligados: ["natal", "natal"] })).status).toBe(200);
    const { data } = await db().from("ag_contas").select("feriados_ativos, feriados_desligados").eq("id", a.id).single();
    expect(data).toEqual({ feriados_ativos: false, feriados_desligados: ["natal"] });
    expect((await send(putHolidays, "/api/painel/disponibilidade/feriados", "PUT", { feriados_ativos: true, feriados_desligados: ["pascoa"] })).status).toBe(422);
  });
});
