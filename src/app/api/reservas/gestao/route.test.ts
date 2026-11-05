// Testes das rotas de gestão (seção 13, épico 8.6) com Google e Resend simulados e o Supabase local.
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { encryptSecret } from "@/server/google/crypto";
import { createTestAccount, deleteTestAccounts } from "../../../../../tests/helpers";

vi.mock("@/server/google/calendar", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/calendar")>();
  return { ...original, queryFreeBusy: vi.fn() };
});
vi.mock("@/server/google/events", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/events")>();
  return { ...original, insertEvent: vi.fn(), patchEvent: vi.fn(), deleteEvent: vi.fn() };
});
vi.mock("@/server/email/resend", () => ({ sendEmail: vi.fn() }));

const calendar = await import("@/server/google/calendar");
const events = await import("@/server/google/events");
const resend = await import("@/server/email/resend");
const { createBooking } = await import("@/server/booking");
const { GET } = await import("./route");
const { POST: cancel } = await import("./cancelar/route");
const { POST: reschedule } = await import("./remarcar/route");
const { GET: availability } = await import("../../disponibilidade/route");

let conta: Awaited<ReturnType<typeof createTestAccount>>;
const SLOT = "2026-11-10T17:30:00.000Z";

beforeAll(async () => {
  conta = await createTestAccount("gestao-rota");
  await db().from("ag_conexoes_google").insert({ conta_id: conta.id, refresh_token_cifrado: encryptSecret("1//x"), escopos: [] });
  await db().rpc("ag_fn_substitui_horarios", {
    p_conta_id: conta.id,
    p_faixas: [1, 2, 3, 4, 5].flatMap((d) => [{ dia_semana: d, inicio: "10:30", fim: "12:00" }, { dia_semana: d, inicio: "14:30", fim: "18:00" }]),
  });
  await db().from("ag_tipos_evento").insert({ conta_id: conta.id, nome: "Reunião de 1h", slug: "reuniao-1h", duracao_min: 60 });
});
afterAll(() => deleteTestAccounts([conta.id]));
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  vi.mocked(calendar.queryFreeBusy).mockReset().mockResolvedValue([]);
  vi.mocked(events.insertEvent).mockReset().mockImplementation(async (_c, i) => ({ eventId: events.eventIdFor(i.reservaId), meetLink: null }));
  vi.mocked(events.patchEvent).mockReset().mockResolvedValue();
  vi.mocked(events.deleteEvent).mockReset().mockResolvedValue();
  vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("ok");
  await db().from("ag_reservas").delete().eq("conta_id", conta.id);
});
afterEach(() => vi.useRealTimers());

// Requisição JSON pública.
function post(handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown) {
  return handler(new NextRequest(`http://localhost:3020${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

async function book() {
  return createBooking({ conta: conta.slug, tipo: "reuniao-1h", inicio: SLOT, nome: "Ana", email: "ana@teste.dev", fuso: "America/Sao_Paulo" });
}

describe("rotas de gestão", () => {
  it("GET: token inválido → 404; válido → resumo sem ids de conta nem e-mails", async () => {
    expect((await GET(new NextRequest("http://localhost:3020/api/reservas/gestao?token=x"))).status).toBe(404);
    const r = await book();
    const res = await GET(new NextRequest(`http://localhost:3020/api/reservas/gestao?token=${r.token}`));
    const body = await res.json();
    expect(body).toMatchObject({ estado: "active", tipo: "Reunião de 1h", dono: "Conta Teste", inicio: SLOT });
    expect(JSON.stringify(body)).not.toContain("@");
    expect(JSON.stringify(body)).not.toContain(conta.id);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("cancelar: 200 com o nome do dono; de novo → 409", async () => {
    const r = await book();
    const res = await post(cancel, "/api/reservas/gestao/cancelar", { token: r.token, motivo: "imprevisto" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dono: "Conta Teste" });
    expect((await post(cancel, "/api/reservas/gestao/cancelar", { token: r.token })).status).toBe(409);
  });
  it("cancelar com Google fora → 503", async () => {
    const r = await book();
    vi.mocked(events.deleteEvent).mockRejectedValue(new calendar.CalendarError("servico_indisponivel"));
    expect(await (await post(cancel, "/api/reservas/gestao/cancelar", { token: r.token })).json()).toEqual({ erro: "servico_indisponivel" });
  });
  it("remarcar: 201 com a reserva nova e cookie da tela de confirmado; horário tomado → 409", async () => {
    const r = await book();
    const res = await post(reschedule, "/api/reservas/gestao/remarcar", { token: r.token, inicio: "2026-11-11T18:00:00Z", fuso: "America/Sao_Paulo" });
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toMatch(/ag_confirmacao=/);
    const body = await res.json();
    expect(body.inicio).toBe("2026-11-11T18:00:00.000Z");
    expect(body).not.toHaveProperty("token");
    expect((await post(reschedule, "/api/reservas/gestao/remarcar", { token: r.token, inicio: "2026-11-12T18:00:00Z", fuso: "America/Sao_Paulo" })).status).toBe(409);
  });
  it("disponibilidade com remarcar=token mostra o horário da própria reunião como livre", async () => {
    const r = await book();
    const url = (extra = "") => new NextRequest(`http://localhost:3020/api/disponibilidade?conta=${conta.slug}&tipo=reuniao-1h&de=2026-11-10&ate=2026-11-10${extra}`);
    const plain = (await (await availability(url())).json()).dias[0].horarios;
    expect(plain).not.toContain(SLOT);
    const withToken = (await (await availability(url(`&remarcar=${r.token}`))).json()).dias[0].horarios;
    expect(withToken).toContain(SLOT);
    expect(withToken).toContain("2026-11-10T18:00:00.000Z");
    // Token de outra coisa (ou inválido) não libera nada.
    expect((await (await availability(url("&remarcar=x"))).json()).dias[0].horarios).not.toContain(SLOT);
  });
});
