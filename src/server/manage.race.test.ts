// Corrida na remarcação (seção 12, verifier 8.6): a revalidação vê o horário livre, mas outra
// reserva o pega antes do INSERT — a constraint do banco decide (23P01 → horario_indisponivel) e
// a reserva original fica intacta. Aqui a revalidação é simulada para forçar esse caminho.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { encryptSecret } from "@/server/google/crypto";
import { createTestAccount, deleteTestAccounts } from "../../tests/helpers";

vi.mock("@/server/availability", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/availability")>();
  return { ...original, getAvailability: vi.fn() };
});
vi.mock("@/server/google/events", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/events")>();
  return { ...original, patchEvent: vi.fn() };
});
vi.mock("@/server/email/resend", () => ({ sendEmail: vi.fn().mockResolvedValue("ok") }));

const availability = await import("@/server/availability");
const events = await import("@/server/google/events");
const { newManageToken } = await import("./booking");
const { rescheduleByGuest } = await import("./manage");

let conta: Awaited<ReturnType<typeof createTestAccount>>;
let tipoId: string;

beforeAll(async () => {
  conta = await createTestAccount("corrida");
  await db().from("ag_conexoes_google").insert({ conta_id: conta.id, refresh_token_cifrado: encryptSecret("1//x"), escopos: [] });
  tipoId = (await db().from("ag_tipos_evento").insert({ conta_id: conta.id, nome: "Reunião de 1h", slug: "reuniao-1h", duracao_min: 60 }).select("id").single()).data!.id;
});
afterAll(() => deleteTestAccounts([conta.id]));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2031-11-02T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("rescheduleByGuest — corrida no INSERT", () => {
  it("23P01 vira horario_indisponivel e a reserva original continua confirmada", async () => {
    const { token, hash } = newManageToken();
    const base = { conta_id: conta.id, tipo_evento_id: tipoId, nome_convidado: "Ana", email_convidado: "ana@teste.dev", fuso_convidado: "America/Sao_Paulo", status: "confirmada" as const };
    const { data: mine } = await db().from("ag_reservas").insert({ ...base, inicio: "2031-11-04T17:30:00Z", fim: "2031-11-04T18:30:00Z", token_hash: hash, google_evento_id: "ag1" }).select("id").single();
    // Outra reserva já ocupa o horário novo, mas a revalidação (simulada) diz que está livre.
    await db().from("ag_reservas").insert({ ...base, inicio: "2031-11-05T18:00:00Z", fim: "2031-11-05T19:00:00Z", token_hash: `outra-${mine!.id}` });
    vi.mocked(availability.getAvailability).mockResolvedValue({ fuso_conta: "America/Sao_Paulo", dias: [{ data: "2031-11-05", horarios: ["2031-11-05T18:00:00.000Z"] }] } as never);

    await expect(rescheduleByGuest(token, "2031-11-05T18:00:00.000Z", "America/Sao_Paulo")).rejects.toMatchObject({ code: "horario_indisponivel" });
    const { data } = await db().from("ag_reservas").select("status").eq("id", mine!.id).single();
    expect(data!.status).toBe("confirmada");
    expect(events.patchEvent).not.toHaveBeenCalled();
  });
});
