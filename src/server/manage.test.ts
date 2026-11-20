// Testes da gestão pelo convidado (critérios 8.6, seção 12) com Google e Resend simulados e o
// Supabase local. Relógio fixo: domingo 02/11/2031 09:00 de Brasília (datas 5 anos à frente, mesmo dia da semana: o relógio do banco é real).
import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { encryptSecret } from "@/server/google/crypto";
import { createTestAccount, deleteTestAccounts } from "../../tests/helpers";

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
const { createBooking } = await import("./booking");
const { cancelByGuest, getManageView, rescheduleByGuest } = await import("./manage");
const { getAvailability } = await import("./availability");

let conta: Awaited<ReturnType<typeof createTestAccount>>;
const SLOT = "2031-11-04T17:30:00.000Z"; // ter 14:30 Brasília
const GUEST = { nome: "Ana Teste", email: "ana@teste.dev", observacao: null, fuso: "America/Sao_Paulo" };

beforeAll(async () => {
  conta = await createTestAccount("gestao");
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
  vi.setSystemTime(new Date("2031-11-02T12:00:00Z"));
  vi.mocked(calendar.queryFreeBusy).mockReset().mockResolvedValue([]);
  vi.mocked(events.insertEvent).mockReset().mockImplementation(async (_c, i) => ({ eventId: events.eventIdFor(i.reservaId), meetLink: "https://meet.google.com/aaa-bbbb-ccc" }));
  vi.mocked(events.patchEvent).mockReset().mockResolvedValue();
  vi.mocked(events.deleteEvent).mockReset().mockResolvedValue();
  vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("ok");
  await db().from("ag_reservas").delete().eq("conta_id", conta.id);
});
afterEach(() => vi.useRealTimers());

// Cria uma reserva confirmada e devolve id e token.
async function booked(inicio = SLOT) {
  const r = await createBooking({ conta: conta.slug, tipo: "reuniao-1h", inicio, ...GUEST });
  vi.mocked(resend.sendEmail).mockClear();
  return r;
}

async function row(id: string) {
  return (await db().from("ag_reservas").select("*").eq("id", id).single()).data!;
}

describe("getManageView (critérios 8.6)", () => {
  it("token inválido, ativa, já começou", async () => {
    expect((await getManageView("x")).state).toBe("invalid");
    expect((await getManageView("A".repeat(43))).state).toBe("invalid");
    const r = await booked();
    const view = await getManageView(r.token);
    expect(view.state).toBe("active");
    if (view.state === "active") expect(view.r.link_meet).toBe("https://meet.google.com/aaa-bbbb-ccc");
    expect((await getManageView(r.token, new Date("2031-11-04T17:30:00Z"))).state).toBe("past");
  });
});

describe("cancelByGuest", () => {
  it("cancela: status, cancelada_em, motivo, evento apagado e e-mail ao dono", async () => {
    const r = await booked();
    const res = await cancelByGuest(r.token, "  Surgiu um imprevisto  ");
    expect(res.ownerName).toBe("Conta Teste");
    expect(await row(r.id)).toMatchObject({ status: "cancelada_convidado", motivo_cancelamento: "Surgiu um imprevisto" });
    expect((await row(r.id)).cancelada_em).not.toBeNull();
    expect(events.deleteEvent).toHaveBeenCalledWith(conta.id, events.eventIdFor(r.id));
    const mail = vi.mocked(resend.sendEmail).mock.calls[0][0];
    expect(mail.to).toBe(`${conta.slug}@teste.dev`);
    expect(mail.subject).toBe("Cancelada: Ana Teste · 04/11 14:30");
    expect(mail.text).toContain("Surgiu um imprevisto");
    expect((await getManageView(r.token)).state).toBe("cancelled");
  });
  it("Google com erro → continua confirmada e servico_indisponivel", async () => {
    const r = await booked();
    vi.mocked(events.deleteEvent).mockRejectedValue(new calendar.CalendarError("servico_indisponivel"));
    await expect(cancelByGuest(r.token, null)).rejects.toMatchObject({ code: "servico_indisponivel" });
    expect((await row(r.id)).status).toBe("confirmada");
  });
  it("cancelar de novo → transicao_invalida; depois do início → reuniao_iniciada; token ruim → nao_encontrado", async () => {
    const r = await booked();
    await cancelByGuest(r.token, null);
    await expect(cancelByGuest(r.token, null)).rejects.toMatchObject({ code: "transicao_invalida" });
    const r2 = await booked("2031-11-05T17:30:00.000Z");
    await expect(cancelByGuest(r2.token, null, new Date("2031-11-05T17:30:00Z"))).rejects.toMatchObject({ code: "reuniao_iniciada" });
    await expect(cancelByGuest("x", null)).rejects.toMatchObject({ code: "nao_encontrado" });
  });
  it("o horário cancelado volta a ficar livre", async () => {
    const r = await booked();
    await cancelByGuest(r.token, null);
    const a = await getAvailability({ accountSlug: conta.slug, typeSlug: "reuniao-1h", from: "2031-11-04", to: "2031-11-04" });
    expect(a.dias[0].horarios).toContain(SLOT);
  });
});

describe("corrida cancelar × remarcar (verifier 8.6)", () => {
  it("remarcar enquanto o cancelamento fala com o Google → transicao_invalida, sem patch", async () => {
    const r = await booked();
    let rescheduleResult: unknown = null;
    vi.mocked(events.deleteEvent).mockImplementation(async () => {
      rescheduleResult = await rescheduleByGuest(r.token, "2031-11-05T18:00:00.000Z", "America/Sao_Paulo").catch((e) => e);
    });
    await cancelByGuest(r.token, null);
    expect(rescheduleResult).toMatchObject({ code: "transicao_invalida" });
    expect(events.patchEvent).not.toHaveBeenCalled();
    expect((await row(r.id)).status).toBe("cancelada_convidado");
  });
});

describe("rescheduleByGuest (seção 12)", () => {
  it("remarcar para o mesmo horário é recusado", async () => {
    const r = await booked();
    await expect(rescheduleByGuest(r.token, SLOT, "America/Sao_Paulo")).rejects.toMatchObject({ code: "dados_invalidos" });
    expect((await row(r.id)).status).toBe("confirmada");
  });
  it("patch falha e alguém pegou o horário antigo nesse meio-tempo → 'perdida': dono avisado", async () => {
    const r = await booked();
    vi.mocked(events.patchEvent).mockImplementation(async () => {
      // O horário antigo ficou livre (antiga 'remarcada'): outra reserva o ocupa antes do desfazer.
      const tipoId = (await row(r.id)).tipo_evento_id;
      await db().from("ag_reservas").insert({
        conta_id: conta.id, tipo_evento_id: tipoId, inicio: SLOT, fim: "2031-11-04T18:30:00.000Z", nome_convidado: "Bia",
        email_convidado: "bia@teste.dev", fuso_convidado: "America/Sao_Paulo", status: "confirmada", token_hash: `outra-${r.id}`,
      });
      throw new calendar.CalendarError("servico_indisponivel");
    });
    await expect(rescheduleByGuest(r.token, "2031-11-05T18:00:00.000Z", "America/Sao_Paulo")).rejects.toMatchObject({ code: "servico_indisponivel" });
    expect((await row(r.id)).status).toBe("remarcada");
    const mail = vi.mocked(resend.sendEmail).mock.calls.map(([m]) => m).find((m) => m.to === `${conta.slug}@teste.dev`);
    expect(mail?.subject).toBe("Cancelada: Ana Teste · 04/11 14:30");
  });
  it("remarca: nova reserva, patch no mesmo evento com link novo, antiga remarcada, e-mails", async () => {
    const r = await booked();
    const NEW = "2031-11-05T18:00:00.000Z"; // qua 15:00
    const res = await rescheduleByGuest(r.token, NEW, "Europe/Lisbon");
    expect(res).toMatchObject({ inicio: NEW, fim: "2031-11-05T19:00:00.000Z", link_meet: "https://meet.google.com/aaa-bbbb-ccc", slug: conta.slug, tipo: "reuniao-1h" });

    expect((await row(r.id)).status).toBe("remarcada");
    const nova = await row(res.id);
    expect(nova).toMatchObject({ status: "confirmada", remarcada_de_id: r.id, google_evento_id: events.eventIdFor(r.id), fuso_convidado: "Europe/Lisbon" });

    const [, eventId, patch] = vi.mocked(events.patchEvent).mock.calls[0];
    expect(eventId).toBe(events.eventIdFor(r.id));
    expect(patch).toMatchObject({ start: NEW, end: "2031-11-05T19:00:00.000Z" });
    const newToken = /\/r\/([A-Za-z0-9_-]{43})/.exec(patch.description!)![1];
    expect(createHash("sha256").update(newToken).digest("hex")).toBe(nova.token_hash);
    expect(newToken).not.toBe(r.token);

    const sent = vi.mocked(resend.sendEmail).mock.calls.map(([m]) => m);
    expect(sent.find((m) => m.to === "ana@teste.dev")!.text).toContain(`/r/${newToken}`);
    expect(sent.find((m) => m.to === `${conta.slug}@teste.dev`)!.subject).toBe("Remarcada: Ana Teste · 04/11 14:30 → 05/11 15:00");

    const old = await getManageView(r.token);
    expect(old.state).toBe("rescheduled");
    if (old.state === "rescheduled") expect(new Date(old.newStart!).toISOString()).toBe(NEW);
    // O horário antigo fica livre.
    const a = await getAvailability({ accountSlug: conta.slug, typeSlug: "reuniao-1h", from: "2031-11-04", to: "2031-11-04" });
    expect(a.dias[0].horarios).toContain(SLOT);
  });
  it("adiar 30 min uma reunião de 1 h (cruza o próprio horário) funciona", async () => {
    const r = await booked();
    const res = await rescheduleByGuest(r.token, "2031-11-04T18:00:00.000Z", "America/Sao_Paulo");
    expect((await row(res.id)).status).toBe("confirmada");
  });
  it("horário tomado no meio do caminho → horario_indisponivel e reserva original intacta", async () => {
    const r = await booked();
    // Outro compromisso no Google no horário novo.
    vi.mocked(calendar.queryFreeBusy).mockResolvedValue([{ inicio: "2031-11-05T18:00:00Z", fim: "2031-11-05T19:00:00Z" }]);
    await expect(rescheduleByGuest(r.token, "2031-11-05T18:00:00.000Z", "America/Sao_Paulo")).rejects.toMatchObject({ code: "horario_indisponivel" });
    expect((await row(r.id)).status).toBe("confirmada");
    expect(events.patchEvent).not.toHaveBeenCalled();
  });
  it("corrida: outra reserva pega o horário novo depois da revalidação → horario_indisponivel e original intacta", async () => {
    const r = await booked();
    const other = await booked("2031-11-06T17:30:00.000Z");
    void other;
    await expect(rescheduleByGuest(r.token, "2031-11-06T17:30:00.000Z", "America/Sao_Paulo")).rejects.toMatchObject({ code: "horario_indisponivel" });
    expect((await row(r.id)).status).toBe("confirmada");
  });
  it("Google falha no patch → nova falhou e antiga volta a confirmada", async () => {
    const r = await booked();
    vi.mocked(events.patchEvent).mockRejectedValue(new calendar.CalendarError("servico_indisponivel"));
    await expect(rescheduleByGuest(r.token, "2031-11-05T18:00:00.000Z", "America/Sao_Paulo")).rejects.toMatchObject({ code: "servico_indisponivel" });
    expect((await row(r.id)).status).toBe("confirmada");
    const { data } = await db().from("ag_reservas").select("status").eq("remarcada_de_id", r.id);
    expect(data).toEqual([{ status: "falhou" }]);
  });
  it("só reserva confirmada e futura pode ser remarcada", async () => {
    const r = await booked();
    await cancelByGuest(r.token, null);
    await expect(rescheduleByGuest(r.token, "2031-11-05T18:00:00.000Z", "America/Sao_Paulo")).rejects.toMatchObject({ code: "transicao_invalida" });
  });
});
