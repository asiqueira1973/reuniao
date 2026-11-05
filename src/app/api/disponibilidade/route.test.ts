// Testes de GET /api/disponibilidade (critérios 8.4) com o Google simulado e o Supabase local.
// Relógio fixo em domingo 08/11/2026 09:00 de Brasília.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { encryptSecret } from "@/server/google/crypto";
import { createTestAccount, deleteTestAccounts } from "../../../../tests/helpers";

vi.mock("@/server/google/calendar", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/calendar")>();
  return { ...original, queryFreeBusy: vi.fn() };
});
const calendar = await import("@/server/google/calendar");
const { GET } = await import("./route");

let conta: Awaited<ReturnType<typeof createTestAccount>>;
let tipoId: string;

beforeAll(async () => {
  conta = await createTestAccount("pub");
  await db().from("ag_conexoes_google").insert({ conta_id: conta.id, refresh_token_cifrado: encryptSecret("1//x"), escopos: [] });
  await db().rpc("ag_fn_substitui_horarios", {
    p_conta_id: conta.id,
    p_faixas: [1, 2, 3, 4, 5].flatMap((d) => [{ dia_semana: d, inicio: "10:30", fim: "12:00" }, { dia_semana: d, inicio: "14:30", fim: "18:00" }]),
  });
  const { data } = await db().from("ag_tipos_evento").insert({ conta_id: conta.id, nome: "Reunião de 1h", slug: "reuniao-1h", duracao_min: 60 }).select("id").single();
  tipoId = data!.id;
  await db().from("ag_tipos_evento").insert({ conta_id: conta.id, nome: "Pausado", slug: "pausado", ativo: false });
});
afterAll(() => deleteTestAccounts([conta.id]));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  vi.mocked(calendar.queryFreeBusy).mockReset().mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

// Chama a rota com a consulta dada e devolve status e corpo.
async function get(query: string) {
  const res = await GET(new NextRequest(`http://localhost:3020/api/disponibilidade?${query}`));
  return { status: res.status, body: await res.json() };
}

// Horários (HH:MM de Brasília) de uma data na resposta.
function hours(body: { dias: { data: string; horarios: string[] }[] }, date: string) {
  return (body.dias.find((d) => d.data === date)?.horarios ?? []).map((iso) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso)),
  );
}

describe("GET /api/disponibilidade", () => {
  it("devolve os dias com horários e consulta o Google uma vez para o intervalo", async () => {
    const { status, body } = await get(`conta=${conta.slug}&tipo=reuniao-1h&de=2026-11-09&ate=2026-11-10`);
    expect(status).toBe(200);
    expect(body.fuso_conta).toBe("America/Sao_Paulo");
    expect(body.dias.map((d: { data: string }) => d.data)).toEqual(["2026-11-09", "2026-11-10"]);
    expect(hours(body, "2026-11-09")).toEqual(["10:30", "11:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]);
    expect(calendar.queryFreeBusy).toHaveBeenCalledTimes(1);
    expect(calendar.queryFreeBusy).toHaveBeenCalledWith(conta.id, "2026-11-09T03:00:00.000Z", "2026-11-11T04:00:00.000Z");
  });
  it("compromisso 15:00–15:30 no Google remove todos os horários que o tocam", async () => {
    vi.mocked(calendar.queryFreeBusy).mockResolvedValue([{ inicio: "2026-11-09T18:00:00Z", fim: "2026-11-09T18:30:00Z" }]);
    const { body } = await get(`conta=${conta.slug}&tipo=reuniao-1h&de=2026-11-09&ate=2026-11-09`);
    expect(hours(body, "2026-11-09")).toEqual(["10:30", "11:00", "15:30", "16:00", "16:30", "17:00"]);
  });
  it("reserva confirmada (ou processando) bloqueia; falhou não bloqueia", async () => {
    const base = { conta_id: conta.id, tipo_evento_id: tipoId, nome_convidado: "Ana", email_convidado: "ana@teste.dev", fuso_convidado: "America/Sao_Paulo" };
    await db().from("ag_reservas").insert([
      { ...base, inicio: "2026-11-09T13:30:00Z", fim: "2026-11-09T14:30:00Z", status: "confirmada", token_hash: `h-${conta.id}-1` },
      { ...base, inicio: "2026-11-09T19:00:00Z", fim: "2026-11-09T20:00:00Z", status: "falhou", token_hash: `h-${conta.id}-2` },
    ]);
    const { body } = await get(`conta=${conta.slug}&tipo=reuniao-1h&de=2026-11-09&ate=2026-11-09`);
    const h = hours(body, "2026-11-09");
    expect(h).not.toContain("10:30");
    expect(h).not.toContain("11:00");
    expect(h).toContain("16:00");
    await db().from("ag_reservas").delete().eq("conta_id", conta.id);
  });
  it("Google com erro ou lento → 503 servico_indisponivel, sem horários", async () => {
    vi.mocked(calendar.queryFreeBusy).mockRejectedValue(new calendar.CalendarError("servico_indisponivel"));
    expect(await get(`conta=${conta.slug}&tipo=reuniao-1h`)).toEqual({ status: 503, body: { erro: "servico_indisponivel" } });
  });
  it("conexão revogada → 503 agenda_indisponivel sem chamar o Google", async () => {
    await db().from("ag_conexoes_google").update({ status: "revogada" }).eq("conta_id", conta.id);
    expect(await get(`conta=${conta.slug}&tipo=reuniao-1h`)).toEqual({ status: 503, body: { erro: "agenda_indisponivel" } });
    expect(calendar.queryFreeBusy).not.toHaveBeenCalled();
    await db().from("ag_conexoes_google").update({ status: "ativa" }).eq("conta_id", conta.id);
  });
  it("conta ou tipo inexistente → 404; tipo inativo → 404 tipo_indisponivel", async () => {
    expect((await get(`conta=nao-existe-xyz&tipo=reuniao-1h`)).body).toEqual({ erro: "nao_encontrado" });
    expect((await get(`conta=${conta.slug}&tipo=nada`)).status).toBe(404);
    expect(await get(`conta=${conta.slug}&tipo=pausado`)).toEqual({ status: 404, body: { erro: "tipo_indisponivel" } });
  });
  it("datas inválidas, invertidas, intervalo de mais de 42 dias ou sem conta → 422", async () => {
    for (const q of ["de=2026-13-01&ate=2026-12-01", "de=2026-11-20&ate=2026-11-10", "de=2026-11-09&ate=2026-12-21"]) {
      expect((await get(`conta=${conta.slug}&tipo=reuniao-1h&${q}`)).status).toBe(422);
    }
    expect((await get("tipo=reuniao-1h")).status).toBe(422);
    expect((await get(`conta=${conta.slug}&tipo=reuniao-1h&de=2026-11-09&ate=2026-12-20`)).status).toBe(200);
  });
  it("pedido fora da janela do tipo não consulta o Google", async () => {
    const { status, body } = await get(`conta=${conta.slug}&tipo=reuniao-1h&de=2027-06-01&ate=2027-06-10`);
    expect(status).toBe(200);
    expect(body.dias).toEqual([]);
    expect(calendar.queryFreeBusy).not.toHaveBeenCalled();
  });
});
