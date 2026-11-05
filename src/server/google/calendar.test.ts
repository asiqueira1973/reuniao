// Testes do cliente do Google Calendar (seções 6, 11.10 e 17) com fetch simulado e banco local.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { createTestAccount, deleteTestAccounts } from "../../../tests/helpers";
import { CalendarError, clearTokenCache, FREEBUSY_URL, queryFreeBusy } from "./calendar";
import { encryptSecret } from "./crypto";
import { GOOGLE_TOKEN_URL } from "./oauth";

let conta: Awaited<ReturnType<typeof createTestAccount>>;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  conta = await createTestAccount("cal");
});
afterAll(() => deleteTestAccounts([conta.id]));
afterEach(() => {
  vi.unstubAllGlobals();
  clearTokenCache();
});

// Grava (ou regrava) a conexão da conta de teste.
async function setConnection(status: "ativa" | "revogada") {
  await db().from("ag_conexoes_google").upsert({
    conta_id: conta.id, refresh_token_cifrado: encryptSecret("1//teste"), escopos: [], status, revogada_em: null,
  });
}

// Simula o Google: token e freebusy com respostas configuráveis; o resto vai ao fetch real (Supabase).
function stubGoogle(opts: { token?: () => Response | Promise<Response>; freebusy?: () => Response | Promise<Response> }) {
  const calls = { token: 0, freebusy: 0 };
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u === GOOGLE_TOKEN_URL) {
      calls.token++;
      return opts.token ? opts.token() : Response.json({ access_token: "at", expires_in: 3600 });
    }
    if (u === FREEBUSY_URL) {
      calls.freebusy++;
      if (init?.signal) {
        const signal = init.signal;
        const result = opts.freebusy ? opts.freebusy() : Response.json({ calendars: { primary: { busy: [] } } });
        return Promise.race([
          Promise.resolve(result),
          new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
        ]);
      }
    }
    return realFetch(url, init);
  });
  return calls;
}

describe("queryFreeBusy", () => {
  it("devolve os ocupados da agenda principal", async () => {
    await setConnection("ativa");
    stubGoogle({ freebusy: () => Response.json({ calendars: { primary: { busy: [{ start: "2026-11-09T18:00:00Z", end: "2026-11-09T18:30:00Z" }] } } }) });
    expect(await queryFreeBusy(conta.id, "2026-11-09T00:00:00Z", "2026-11-10T00:00:00Z")).toEqual([
      { inicio: "2026-11-09T18:00:00Z", fim: "2026-11-09T18:30:00Z" },
    ]);
  });
  it("reaproveita o access token em cache", async () => {
    await setConnection("ativa");
    const calls = stubGoogle({});
    await queryFreeBusy(conta.id, "2026-11-09T00:00:00Z", "2026-11-10T00:00:00Z");
    await queryFreeBusy(conta.id, "2026-11-09T00:00:00Z", "2026-11-10T00:00:00Z");
    expect(calls.token).toBe(1);
  });
  it("Google com erro duas vezes → servico_indisponivel (tentou de novo uma vez)", async () => {
    await setConnection("ativa");
    const calls = stubGoogle({ freebusy: () => new Response("x", { status: 500 }) });
    await expect(queryFreeBusy(conta.id, "a", "b")).rejects.toMatchObject({ code: "servico_indisponivel" });
    expect(calls.freebusy).toBe(2);
  });
  it("Google demorando mais que o limite → servico_indisponivel", async () => {
    await setConnection("ativa");
    stubGoogle({ freebusy: () => new Promise<Response>(() => {}) });
    await expect(queryFreeBusy(conta.id, "a", "b", 50)).rejects.toBeInstanceOf(CalendarError);
  });
  it("corpo do freebusy ilegível → servico_indisponivel (não 500)", async () => {
    await setConnection("ativa");
    stubGoogle({ freebusy: () => new Response("isto não é json", { status: 200, headers: { "content-type": "application/json" } }) });
    await expect(queryFreeBusy(conta.id, "a", "b")).rejects.toMatchObject({ code: "servico_indisponivel" });
  });
  it("invalid_grant → agenda_indisponivel e conexão revogada", async () => {
    await setConnection("ativa");
    stubGoogle({ token: () => Response.json({ error: "invalid_grant" }, { status: 400 }) });
    await expect(queryFreeBusy(conta.id, "a", "b")).rejects.toMatchObject({ code: "agenda_indisponivel" });
    const { data } = await db().from("ag_conexoes_google").select("status, revogada_em").eq("conta_id", conta.id).single();
    expect(data!.status).toBe("revogada");
    expect(data!.revogada_em).not.toBeNull();
  });
  it("conexão já revogada → agenda_indisponivel sem chamar o Google", async () => {
    await setConnection("revogada");
    const calls = stubGoogle({});
    await expect(queryFreeBusy(conta.id, "a", "b")).rejects.toMatchObject({ code: "agenda_indisponivel" });
    expect(calls.token + calls.freebusy).toBe(0);
  });
});
