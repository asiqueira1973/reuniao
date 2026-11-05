// Testes dos eventos no Google (regra 11.5) com o token e o fetch simulados.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./calendar", async (importOriginal) => {
  const original = await importOriginal<typeof import("./calendar")>();
  return { ...original, getAccessToken: vi.fn().mockResolvedValue("at") };
});
const { deleteEvent, eventIdFor, insertEvent } = await import("./events");

const RID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const INPUT = {
  reservaId: RID,
  summary: "Reunião de 1h · Ana",
  description: "Agendado por Ana (ana@teste.dev).",
  start: "2026-11-09T13:30:00.000Z",
  end: "2026-11-09T14:30:00.000Z",
  attendee: { email: "ana@teste.dev", name: "Ana" },
  withMeet: true,
};

let requests: { url: string; method: string; body?: unknown }[];

// Simula o Google com uma sequência de respostas.
function stub(...responses: Response[]) {
  requests = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    return responses.shift() ?? new Response("sem resposta", { status: 500 });
  });
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("insertEvent (regra 11.5)", () => {
  it("manda id derivado, participante, Meet e sendUpdates=all", async () => {
    stub(Response.json({ id: eventIdFor(RID), hangoutLink: "https://meet.google.com/abc-defg-hij" }));
    expect(await insertEvent("conta", INPUT)).toEqual({ eventId: eventIdFor(RID), meetLink: "https://meet.google.com/abc-defg-hij" });
    const [req] = requests;
    expect(req.url).toContain("conferenceDataVersion=1");
    expect(req.url).toContain("sendUpdates=all");
    expect(req.body).toMatchObject({
      id: "ag7c9e6679742540de944be07fc1f90ae7",
      summary: INPUT.summary,
      attendees: [{ email: "ana@teste.dev", displayName: "Ana" }],
      conferenceData: { createRequest: { requestId: RID, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    });
  });
  it("sem Meet não pede conferência", async () => {
    stub(Response.json({ id: eventIdFor(RID) }));
    expect(await insertEvent("conta", { ...INPUT, withMeet: false })).toEqual({ eventId: eventIdFor(RID), meetLink: null });
    expect(requests[0].body).not.toHaveProperty("conferenceData");
  });
  it("409 (já existe) lê o evento existente: não duplica", async () => {
    stub(new Response("", { status: 409 }), Response.json({ id: eventIdFor(RID), hangoutLink: "https://meet.google.com/x" }));
    expect((await insertEvent("conta", INPUT)).meetLink).toBe("https://meet.google.com/x");
    expect(requests.map((r) => r.method)).toEqual(["POST", "GET"]);
  });
  it("Meet pendente: busca de novo até sair o link", async () => {
    const pending = { id: eventIdFor(RID), conferenceData: { createRequest: { status: { statusCode: "pending" } } } };
    stub(Response.json(pending), Response.json(pending), Response.json({ id: eventIdFor(RID), hangoutLink: "https://meet.google.com/y" }));
    expect((await insertEvent("conta", INPUT, 1)).meetLink).toBe("https://meet.google.com/y");
  });
  it("Meet que nunca sai: confirma sem link depois de 3 tentativas", async () => {
    const pending = { id: eventIdFor(RID), conferenceData: { createRequest: { status: { statusCode: "pending" } } } };
    stub(Response.json(pending), Response.json(pending), Response.json(pending), Response.json(pending));
    expect((await insertEvent("conta", INPUT, 1)).meetLink).toBeNull();
    expect(requests).toHaveLength(4);
  });
  it("erro do Google → servico_indisponivel", async () => {
    stub(new Response("x", { status: 500 }));
    await expect(insertEvent("conta", INPUT)).rejects.toMatchObject({ code: "servico_indisponivel" });
  });
});

describe("deleteEvent", () => {
  it("evento que já não existe conta como apagado", async () => {
    stub(new Response("", { status: 410 }));
    await expect(deleteEvent("conta", "ag1")).resolves.toBeUndefined();
    expect(requests[0].url).toContain("sendUpdates=all");
  });
});
