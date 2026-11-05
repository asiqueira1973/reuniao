// Testes das reuniões do dono (critérios 8.7, seção 5) com Google e Resend simulados e o
// Supabase local. Relógio fixo: domingo 08/11/2026 09:00 de Brasília.
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { encryptSecret } from "@/server/google/crypto";
import { apiRequest, createTestAccount, deleteTestAccounts, routeCtx } from "../../../../../tests/helpers";

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
const { requireReservaPorToken } = await import("@/server/auth/require-reserva");
const { cancelByGuest } = await import("@/server/manage");
const { GET: list } = await import("./route");
const { GET: detail } = await import("./[id]/route");
const { POST: cancel } = await import("./[id]/cancelar/route");
const { POST: resendRoute } = await import("../notificacoes/[id]/reenviar/route");

let a: Awaited<ReturnType<typeof createTestAccount>>;
let b: Awaited<ReturnType<typeof createTestAccount>>;

// Prepara uma conta com conexão, faixas padrão e o tipo de 1 h.
async function setup(conta: Awaited<ReturnType<typeof createTestAccount>>) {
  await db().from("ag_conexoes_google").insert({ conta_id: conta.id, refresh_token_cifrado: encryptSecret("1//x"), escopos: [] });
  await db().rpc("ag_fn_substitui_horarios", {
    p_conta_id: conta.id,
    p_faixas: [1, 2, 3, 4, 5].flatMap((d) => [{ dia_semana: d, inicio: "10:30", fim: "12:00" }, { dia_semana: d, inicio: "14:30", fim: "18:00" }]),
  });
  await db().from("ag_tipos_evento").insert({ conta_id: conta.id, nome: "Reunião de 1h", slug: "reuniao-1h", duracao_min: 60 });
}

beforeAll(async () => {
  a = await createTestAccount("reun-a");
  b = await createTestAccount("reun-b");
  await setup(a);
  await setup(b);
});
afterAll(() => deleteTestAccounts([a.id, b.id]));
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  vi.mocked(calendar.queryFreeBusy).mockReset().mockResolvedValue([]);
  vi.mocked(events.insertEvent).mockReset().mockImplementation(async (_c, i) => ({ eventId: events.eventIdFor(i.reservaId), meetLink: null }));
  vi.mocked(events.deleteEvent).mockReset().mockResolvedValue();
  vi.mocked(events.patchEvent).mockReset().mockResolvedValue();
  vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("ok");
  await db().from("ag_reservas").delete().in("conta_id", [a.id, b.id]);
});
afterEach(() => vi.useRealTimers());

// Reserva pelo fluxo real (createBooking) numa conta.
function book(conta: { slug: string }, inicio: string, email = "ana@teste.dev") {
  return createBooking({ conta: conta.slug, tipo: "reuniao-1h", inicio, nome: "Ana", email, fuso: "America/Sao_Paulo" });
}

async function tab(cookie: string, aba: string) {
  const res = await list(apiRequest(`/api/painel/reunioes?aba=${aba}`, { cookie }));
  return (await res.json()).rows as { id: string; status: string }[];
}

describe("GET /api/painel/reunioes", () => {
  it("lista só da conta da sessão, nas abas certas; processando/falhou/remarcada fora", async () => {
    const r1 = await book(a, "2026-11-10T17:30:00.000Z");
    const r2 = await book(a, "2026-11-11T17:30:00.000Z");
    await book(b, "2026-11-10T17:30:00.000Z");
    await cancelByGuest(r2.token, null);
    // Uma passada (já terminou no relógio fixo), uma falhou e uma processando direto no banco.
    const tipoA = (await db().from("ag_tipos_evento").select("id").eq("conta_id", a.id).single()).data!.id;
    const base = { conta_id: a.id, tipo_evento_id: tipoA, nome_convidado: "X", email_convidado: "x@teste.dev", fuso_convidado: "America/Sao_Paulo" };
    await db().from("ag_reservas").insert([
      { ...base, inicio: "2026-11-05T13:30:00Z", fim: "2026-11-05T14:30:00Z", status: "confirmada", token_hash: `p-${a.id}` },
      { ...base, inicio: "2026-11-12T13:30:00Z", fim: "2026-11-12T14:30:00Z", status: "falhou", token_hash: `f-${a.id}` },
      { ...base, inicio: "2026-11-13T13:30:00Z", fim: "2026-11-13T14:30:00Z", status: "processando", token_hash: `q-${a.id}` },
    ]);
    expect((await tab(a.cookie, "proximas")).map((r) => r.id)).toEqual([r1.id]);
    expect((await tab(a.cookie, "canceladas")).map((r) => r.id)).toEqual([r2.id]);
    expect((await tab(a.cookie, "passadas"))).toHaveLength(1);
    expect((await tab(b.cookie, "proximas"))).toHaveLength(1);
    expect((await list(apiRequest("/api/painel/reunioes?aba=lixo", { cookie: a.cookie }))).status).toBe(422);
    expect((await list(apiRequest("/api/painel/reunioes"))).status).toBe(401);
  });
  it("detalhe de outra conta → 404", async () => {
    const r = await book(b, "2026-11-10T17:30:00.000Z");
    expect((await detail(apiRequest(`/api/painel/reunioes/${r.id}`, { cookie: a.cookie }), routeCtx({ id: r.id }))).status).toBe(404);
    expect((await detail(apiRequest(`/api/painel/reunioes/${r.id}`, { cookie: b.cookie }), routeCtx({ id: r.id }))).status).toBe(200);
  });
});

describe("POST /api/painel/reunioes/[id]/cancelar", () => {
  it("cancela: cancelada_dono, evento apagado, e-mail ao convidado com motivo e link da página pública", async () => {
    const r = await book(a, "2026-11-10T17:30:00.000Z");
    vi.mocked(resend.sendEmail).mockClear();
    const res = await cancel(apiRequest(`/api/painel/reunioes/${r.id}/cancelar`, { method: "POST", cookie: a.cookie, body: { motivo: "Viagem" } }), routeCtx({ id: r.id }));
    expect(res.status).toBe(200);
    const { data } = await db().from("ag_reservas").select("status, motivo_cancelamento, cancelada_em").eq("id", r.id).single();
    expect(data).toMatchObject({ status: "cancelada_dono", motivo_cancelamento: "Viagem" });
    expect(data!.cancelada_em).not.toBeNull();
    expect(events.deleteEvent).toHaveBeenCalledWith(a.id, events.eventIdFor(r.id));
    const mail = vi.mocked(resend.sendEmail).mock.calls[0][0];
    expect(mail.to).toBe("ana@teste.dev");
    expect(mail.subject).toBe("Cancelada: Reunião de 1h com Conta Teste · ter., 10/11 às 14:30");
    expect(mail.text).toContain("Viagem");
    expect(mail.text).toContain(`http://localhost:3020/${a.slug}`);
  });
  it("outra conta → 404; Google com erro → 503 e continua confirmada; de novo → 409", async () => {
    const r = await book(a, "2026-11-10T17:30:00.000Z");
    expect((await cancel(apiRequest(`/api/painel/reunioes/${r.id}/cancelar`, { method: "POST", cookie: b.cookie, body: {} }), routeCtx({ id: r.id }))).status).toBe(404);
    vi.mocked(events.deleteEvent).mockRejectedValueOnce(new calendar.CalendarError("servico_indisponivel"));
    expect((await cancel(apiRequest(`/api/painel/reunioes/${r.id}/cancelar`, { method: "POST", cookie: a.cookie, body: {} }), routeCtx({ id: r.id }))).status).toBe(503);
    expect((await db().from("ag_reservas").select("status").eq("id", r.id).single()).data!.status).toBe("confirmada");
    expect((await cancel(apiRequest(`/api/painel/reunioes/${r.id}/cancelar`, { method: "POST", cookie: a.cookie, body: {} }), routeCtx({ id: r.id }))).status).toBe(200);
    expect((await cancel(apiRequest(`/api/painel/reunioes/${r.id}/cancelar`, { method: "POST", cookie: a.cookie, body: {} }), routeCtx({ id: r.id }))).status).toBe(409);
  });
});

describe("POST /api/painel/notificacoes/[id]/reenviar", () => {
  it("e-mail que falhou aparece no detalhe; reenviar marca enviada; limite de 5 → 409; outra conta → 404", async () => {
    vi.mocked(resend.sendEmail).mockRejectedValue(new Error("resend_500"));
    const r = await book(a, "2026-11-10T17:30:00.000Z");
    vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("ok");
    const body = await (await detail(apiRequest(`/api/painel/reunioes/${r.id}`, { cookie: a.cookie }), routeCtx({ id: r.id }))).json();
    const failed = body.reuniao.notificacoes.filter((n: { status: string }) => n.status === "falhou");
    expect(failed).toHaveLength(2);
    const owner = failed.find((n: { tipo: string }) => n.tipo === "aviso_dono_nova");

    expect((await resendRoute(apiRequest(`/api/painel/notificacoes/${owner.id}/reenviar`, { method: "POST", cookie: b.cookie }), routeCtx({ id: owner.id }))).status).toBe(404);
    const res = await resendRoute(apiRequest(`/api/painel/notificacoes/${owner.id}/reenviar`, { method: "POST", cookie: a.cookie }), routeCtx({ id: owner.id }));
    expect(await res.json()).toEqual({ status: "enviada" });
    // Já enviada → 409.
    expect((await resendRoute(apiRequest(`/api/painel/notificacoes/${owner.id}/reenviar`, { method: "POST", cookie: a.cookie }), routeCtx({ id: owner.id }))).status).toBe(409);

    const guest = failed.find((n: { tipo: string }) => n.tipo === "confirmacao_convidado");
    await db().from("ag_notificacoes").update({ tentativas: 5, status: "falhou" }).eq("id", guest.id);
    const limit = await resendRoute(apiRequest(`/api/painel/notificacoes/${guest.id}/reenviar`, { method: "POST", cookie: a.cookie }), routeCtx({ id: guest.id }));
    expect(limit.status).toBe(409);
    expect(await limit.json()).toEqual({ erro: "limite_tentativas" });
  });
  it("cancelamento ao convidado que falhou é remontado e reenviado", async () => {
    const r = await book(a, "2026-11-10T17:30:00.000Z");
    vi.mocked(resend.sendEmail).mockRejectedValueOnce(new Error("resend_500"));
    await cancel(apiRequest(`/api/painel/reunioes/${r.id}/cancelar`, { method: "POST", cookie: a.cookie, body: { motivo: "Viagem" } }), routeCtx({ id: r.id }));
    const { data: n } = await db().from("ag_notificacoes").select("id, status").eq("reserva_id", r.id).eq("tipo", "cancelamento_convidado").single();
    expect(n!.status).toBe("falhou");
    vi.mocked(resend.sendEmail).mockClear();
    const res = await resendRoute(apiRequest(`/api/painel/notificacoes/${n!.id}/reenviar`, { method: "POST", cookie: a.cookie }), routeCtx({ id: n!.id }));
    expect(await res.json()).toEqual({ status: "enviada" });
    expect(vi.mocked(resend.sendEmail).mock.calls[0][0].text).toContain("Viagem");
  });
});

describe("reenvio sem estragar o link do convidado (verifier 8.7)", () => {
  // Reenvia uma notificação da reserva pelo tipo.
  async function resendByType(reservaId: string, tipo: "aviso_dono_nova" | "confirmacao_convidado") {
    const { data: n } = await db().from("ag_notificacoes").select("id").eq("reserva_id", reservaId).eq("tipo", tipo).single();
    return resendRoute(apiRequest(`/api/painel/notificacoes/${n!.id}/reenviar`, { method: "POST", cookie: a.cookie }), routeCtx({ id: n!.id }));
  }

  it("só o aviso ao dono falhou: reenviar não troca o token nem mexe no evento", async () => {
    // Confirmação ao convidado sai; o aviso ao dono falha.
    vi.mocked(resend.sendEmail).mockImplementation(async (m) => {
      if (m.to !== "ana@teste.dev") throw new Error("resend_500");
      return "ok";
    });
    const r = await book(a, "2026-11-10T17:30:00.000Z");
    vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("ok");
    vi.mocked(events.patchEvent).mockClear();
    const res = await resendByType(r.id, "aviso_dono_nova");
    expect(await res.json()).toEqual({ status: "enviada" });
    expect(await requireReservaPorToken(r.token)).not.toBeNull();
    expect(events.patchEvent).not.toHaveBeenCalled();
    expect(vi.mocked(resend.sendEmail).mock.calls).toHaveLength(1);
    expect(vi.mocked(resend.sendEmail).mock.calls[0][0].to).toBe(`${a.slug}@teste.dev`);
  });

  it("confirmação com o Google fora: 503 e o link antigo continua valendo", async () => {
    vi.mocked(resend.sendEmail).mockRejectedValue(new Error("resend_500"));
    const r = await book(a, "2026-11-10T17:30:00.000Z");
    vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("ok");
    vi.mocked(events.patchEvent).mockRejectedValueOnce(new calendar.CalendarError("servico_indisponivel"));
    const res = await resendByType(r.id, "confirmacao_convidado");
    expect(res.status).toBe(503);
    expect(await requireReservaPorToken(r.token)).not.toBeNull();
  });

  it("aviso de reconexão com a conexão já ativa → 409", async () => {
    const { data: n } = await db().from("ag_notificacoes").insert({ conta_id: a.id, tipo: "reconectar_google", status: "falhou", tentativas: 1 }).select("id").single();
    const res = await resendRoute(apiRequest(`/api/painel/notificacoes/${n!.id}/reenviar`, { method: "POST", cookie: a.cookie }), routeCtx({ id: n!.id }));
    expect(res.status).toBe(409);
    await db().from("ag_notificacoes").delete().eq("id", n!.id);
  });
});

void NextRequest;
