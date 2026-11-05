// Testes da reserva (critérios 8.5, regras 11.3/11.5/11.7/11.8, seção 12) com Google e Resend
// simulados e o Supabase local. Relógio fixo: domingo 08/11/2026 09:00 de Brasília.
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
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
  return { ...original, insertEvent: vi.fn() };
});
vi.mock("@/server/email/resend", () => ({ sendEmail: vi.fn() }));

const calendar = await import("@/server/google/calendar");
const events = await import("@/server/google/events");
const resend = await import("@/server/email/resend");
const { BookingError, createBooking } = await import("./booking");
const { notifyReservation } = await import("./notifications");
const { getAvailability } = await import("./availability");
const { POST } = await import("@/app/api/reservas/route");

let conta: Awaited<ReturnType<typeof createTestAccount>>;
let tipoId: string;
const SLOT = "2026-11-09T13:30:00.000Z"; // seg 10:30 Brasília
const GUEST = { nome: "Ana Teste", email: "Ana@Teste.dev", observacao: "Sobre o projeto X", fuso: "Europe/Lisbon" };

beforeAll(async () => {
  conta = await createTestAccount("reserva");
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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  vi.mocked(calendar.queryFreeBusy).mockReset().mockResolvedValue([]);
  vi.mocked(events.insertEvent).mockReset().mockImplementation(async (_c, input) => ({ eventId: events.eventIdFor(input.reservaId), meetLink: "https://meet.google.com/abc-defg-hij" }));
  vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("resend-id");
  await db().from("ag_reservas").delete().eq("conta_id", conta.id);
  await db().from("ag_conexoes_google").update({ status: "ativa" }).eq("conta_id", conta.id);
});
afterEach(() => vi.useRealTimers());

// Atalho: reserva no tipo de 1 h com o convidado padrão.
function book(over: Partial<Parameters<typeof createBooking>[0]> = {}) {
  return createBooking({ conta: conta.slug, tipo: "reuniao-1h", inicio: SLOT, ...GUEST, ...over });
}

describe("createBooking — caminho feliz", () => {
  it("confirma, cria o evento da regra 11.5, guarda só o hash do token e manda os dois e-mails", async () => {
    const r = await book();
    expect(r).toMatchObject({ inicio: SLOT, fim: "2026-11-09T14:30:00.000Z", link_meet: "https://meet.google.com/abc-defg-hij" });

    const { data: row } = await db().from("ag_reservas").select("*").eq("id", r.id).single();
    expect(row).toMatchObject({
      status: "confirmada", email_convidado: "ana@teste.dev", fuso_convidado: "Europe/Lisbon", tipo_evento_id: tipoId,
      google_evento_id: events.eventIdFor(r.id), link_meet: "https://meet.google.com/abc-defg-hij", observacao: "Sobre o projeto X",
    });
    expect(row!.token_hash).toBe(createHash("sha256").update(r.token).digest("hex"));
    expect(row!.token_hash).not.toContain(r.token);

    const [, input] = vi.mocked(events.insertEvent).mock.calls[0];
    expect(input).toMatchObject({
      reservaId: r.id, summary: "Reunião de 1h · Ana Teste", start: SLOT, end: "2026-11-09T14:30:00.000Z",
      attendee: { email: "ana@teste.dev", name: "Ana Teste" }, withMeet: true,
    });
    expect(input.description).toContain("Agendado por Ana Teste (ana@teste.dev).");
    expect(input.description).toContain("Sobre o projeto X");
    expect(input.description).toContain(`http://localhost:3020/r/${r.token}`);

    const { data: notes } = await db().from("ag_notificacoes").select("tipo, status, tentativas").eq("reserva_id", r.id);
    expect([...notes!].sort((a, b) => a.tipo.localeCompare(b.tipo))).toEqual([
      { tipo: "confirmacao_convidado", status: "enviada", tentativas: 1 },
      { tipo: "aviso_dono_nova", status: "enviada", tentativas: 1 },
    ].sort((a, b) => a.tipo.localeCompare(b.tipo)));
    const sent = vi.mocked(resend.sendEmail).mock.calls.map(([m]) => m);
    const toGuest = sent.find((m) => m.to === "ana@teste.dev")!;
    expect(toGuest.subject).toBe("Confirmado: Reunião de 1h com Conta Teste · seg., 09/11 às 13:30");
    expect(toGuest.replyTo).toBe(`${conta.slug}@teste.dev`);
    expect(toGuest.text).toContain(`/r/${r.token}`);
    const toOwner = sent.find((m) => m.to === `${conta.slug}@teste.dev`)!;
    expect(toOwner.subject).toBe("Nova reunião: Ana Teste · 09/11 10:30");
    expect(toOwner.replyTo).toBe("ana@teste.dev");
  });
});

describe("createBooking — recusas", () => {
  it("horário que não está na lista → horario_indisponivel e nada gravado", async () => {
    await expect(book({ inicio: "2026-11-09T15:00:00.000Z" })).rejects.toMatchObject({ code: "horario_indisponivel" });
    const { count } = await db().from("ag_reservas").select("id", { count: "exact", head: true }).eq("conta_id", conta.id);
    expect(count).toBe(0);
  });
  it("revalida com o Google atual: horário que ficou ocupado é recusado", async () => {
    vi.mocked(calendar.queryFreeBusy).mockResolvedValue([{ inicio: "2026-11-09T13:00:00Z", fim: "2026-11-09T14:00:00Z" }]);
    await expect(book()).rejects.toMatchObject({ code: "horario_indisponivel" });
  });
  it("dois envios ao mesmo tempo para o mesmo horário: exatamente um confirma", async () => {
    vi.mocked(events.insertEvent).mockImplementation(async (_c, input) => {
      await new Promise((r) => setTimeout(r, 50));
      return { eventId: events.eventIdFor(input.reservaId), meetLink: null };
    });
    const results = await Promise.allSettled([book(), book({ email: "bia@teste.dev", nome: "Bia" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BookingError);
    expect(rejected.reason.code).toBe("horario_indisponivel");
  });
  it("Google falha ao criar o evento → reserva falhou, 503 e o horário volta a aparecer", async () => {
    vi.mocked(events.insertEvent).mockRejectedValue(new calendar.CalendarError("servico_indisponivel"));
    await expect(book()).rejects.toMatchObject({ code: "servico_indisponivel" });
    const { data } = await db().from("ag_reservas").select("status").eq("conta_id", conta.id);
    expect(data).toEqual([{ status: "falhou" }]);
    const again = await getAvailability({ accountSlug: conta.slug, typeSlug: "reuniao-1h", from: "2026-11-09", to: "2026-11-09" });
    expect(again.dias[0].horarios).toContain(SLOT);
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });
  it("honeypot preenchido → sucesso falso, nada gravado, nenhum e-mail", async () => {
    const r = await book({ site: "http://spam.example" });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    const { count } = await db().from("ag_reservas").select("id", { count: "exact", head: true }).eq("conta_id", conta.id);
    expect(count).toBe(0);
    expect(events.insertEvent).not.toHaveBeenCalled();
  });
  it("4ª reserva futura confirmada do mesmo e-mail → limite_excedido (regra 11.8)", async () => {
    const base = { conta_id: conta.id, tipo_evento_id: tipoId, nome_convidado: "Ana", email_convidado: "ana@teste.dev", fuso_convidado: "America/Sao_Paulo", status: "confirmada" as const };
    await db().from("ag_reservas").insert([10, 11, 12].map((d, i) => ({ ...base, inicio: `2026-11-${d}T17:30:00Z`, fim: `2026-11-${d}T18:30:00Z`, token_hash: `lim-${conta.id}-${i}` })));
    await expect(book()).rejects.toMatchObject({ code: "limite_excedido" });
    expect((await book({ email: "outra@teste.dev" })).inicio).toBe(SLOT);
  });
  it("tipo inativo → tipo_indisponivel; conexão revogada → agenda_indisponivel; conta inexistente → nao_encontrado", async () => {
    await expect(book({ tipo: "pausado" })).rejects.toMatchObject({ code: "tipo_indisponivel" });
    await expect(book({ conta: "nao-existe-xyz" })).rejects.toMatchObject({ code: "nao_encontrado" });
    await db().from("ag_conexoes_google").update({ status: "revogada" }).eq("conta_id", conta.id);
    await expect(book()).rejects.toMatchObject({ code: "agenda_indisponivel" });
  });
  it("Resend fora do ar: a reserva confirma mesmo assim e as notificações ficam falhou", async () => {
    vi.mocked(resend.sendEmail).mockRejectedValue(new Error("resend_500"));
    const r = await book();
    const { data: row } = await db().from("ag_reservas").select("status").eq("id", r.id).single();
    expect(row!.status).toBe("confirmada");
    const { data: notes } = await db().from("ag_notificacoes").select("status, tentativas, erro").eq("reserva_id", r.id);
    expect(notes).toEqual([
      { status: "falhou", tentativas: 1, erro: "resend_500" },
      { status: "falhou", tentativas: 1, erro: "resend_500" },
    ]);
  });
});

describe("notifyReservation — idempotência (regra 11.6)", () => {
  it("o mesmo e-mail não sai duas vezes para a mesma reserva", async () => {
    const r = await book();
    vi.mocked(resend.sendEmail).mockClear();
    const delivery = { to: "x@teste.dev", fromName: "Dono", email: { subject: "s", html: "h", text: "t" } };
    expect(await notifyReservation(conta.id, r.id, "confirmacao_convidado", delivery)).toBe("ignorada");
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/reservas", () => {
  // Monta a requisição pública de reserva.
  function post(body: unknown) {
    return POST(new NextRequest("http://localhost:3020/api/reservas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  }
  it("201 com id, início, fim e Meet; grava o cookie da tela de confirmado; não devolve o token", async () => {
    const res = await post({ conta: conta.slug, tipo: "reuniao-1h", inicio: SLOT, ...GUEST, site: "" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["fim", "id", "inicio", "link_meet"]);
    expect(res.headers.get("set-cookie")).toMatch(/ag_confirmacao=.+HttpOnly/i);
  });
  it("campo extra (ex.: fim vindo do navegador) é ignorado: o fim é sempre do servidor (8.5)", async () => {
    const res = await post({ conta: conta.slug, tipo: "reuniao-1h", inicio: SLOT, ...GUEST, fim: "2026-11-09T20:00:00Z", status: "confirmada" });
    expect(res.status).toBe(201);
    expect((await res.json()).fim).toBe("2026-11-09T14:30:00.000Z");
  });
  it("e-mail ou fuso inválido → 422", async () => {
    expect((await post({ conta: conta.slug, tipo: "reuniao-1h", inicio: SLOT, ...GUEST, email: "não-é-email" })).status).toBe(422);
    expect((await post({ conta: conta.slug, tipo: "reuniao-1h", inicio: SLOT, ...GUEST, fuso: "Marte/Olimpo" })).status).toBe(422);
  });
  it("códigos de negócio viram os status da seção 13", async () => {
    expect((await post({ conta: conta.slug, tipo: "reuniao-1h", inicio: "2026-11-09T15:00:00Z", ...GUEST })).status).toBe(409);
    vi.mocked(calendar.queryFreeBusy).mockRejectedValue(new calendar.CalendarError("servico_indisponivel"));
    expect(await (await post({ conta: conta.slug, tipo: "reuniao-1h", inicio: SLOT, ...GUEST })).json()).toEqual({ erro: "servico_indisponivel" });
  });
});
