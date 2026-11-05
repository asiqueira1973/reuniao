// Testes da faxina diária (critério 8.9, regras 11.12 e seção 12) com Google e Resend simulados e
// o Supabase local. Linhas com datas explícitas no passado; a rotina recebe o "agora" real.
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { encryptSecret } from "@/server/google/crypto";
import { createTestAccount, deleteTestAccounts } from "../../../../../tests/helpers";

vi.mock("@/server/google/events", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/events")>();
  return { ...original, insertEvent: vi.fn(), patchEvent: vi.fn(), deleteEvent: vi.fn() };
});
vi.mock("@/server/email/resend", () => ({ sendEmail: vi.fn() }));

const events = await import("@/server/google/events");
const resend = await import("@/server/email/resend");
const { GET } = await import("./route");

let a: Awaited<ReturnType<typeof createTestAccount>>;
let tipoId: string;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function cron(secret: string | null = process.env.CRON_SECRET!) {
  return new NextRequest("http://localhost:3020/api/cron/diario", { headers: secret === null ? {} : { authorization: `Bearer ${secret}` } });
}

// Insere uma reserva direto no banco (datas relativas a agora).
async function reserva(o: { inicioMs: number; durMin?: number; status?: "processando" | "confirmada" | "cancelada_dono" | "remarcada"; criadoMs?: number; google?: string | null; de?: string }) {
  const inicio = new Date(Date.now() + o.inicioMs);
  const { data, error } = await db().from("ag_reservas").insert({
    conta_id: a.id, tipo_evento_id: tipoId, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + (o.durMin ?? 30) * MIN).toISOString(),
    status: o.status ?? "confirmada", nome_convidado: "Ana Pessoa", email_convidado: "ana@teste.dev", fuso_convidado: "America/Sao_Paulo",
    observacao: "obs", motivo_cancelamento: o.status === "cancelada_dono" ? "motivo" : null, token_hash: randomUUID(),
    google_evento_id: o.google === undefined ? null : o.google, remarcada_de_id: o.de ?? null,
    criado_em: new Date(Date.now() + (o.criadoMs ?? 0)).toISOString(),
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function statusOf(id: string) {
  return (await db().from("ag_reservas").select("status").eq("id", id).single()).data!.status;
}

beforeAll(async () => {
  a = await createTestAccount("cron");
  await db().from("ag_conexoes_google").insert({ conta_id: a.id, refresh_token_cifrado: encryptSecret("1//x"), escopos: [] });
  tipoId = (await db().from("ag_tipos_evento").insert({ conta_id: a.id, nome: "Reunião", slug: "reuniao", duracao_min: 30 }).select("id").single()).data!.id;
});
afterAll(() => deleteTestAccounts([a.id]));
beforeEach(async () => {
  vi.mocked(events.deleteEvent).mockReset().mockResolvedValue();
  vi.mocked(events.patchEvent).mockReset().mockResolvedValue();
  vi.mocked(resend.sendEmail).mockReset().mockResolvedValue("ok");
  await db().from("ag_reservas").delete().eq("conta_id", a.id);
  await db().from("ag_notificacoes").delete().eq("conta_id", a.id);
});

describe("GET /api/cron/diario", () => {
  it("sem o segredo certo → 401 e nada muda", async () => {
    expect((await GET(cron(null))).status).toBe(401);
    expect((await GET(cron("errado"))).status).toBe(401);
  });

  it("processando há mais de 10 min → falhou (apaga o evento que possa ter sido criado); recente e remarcação presa ficam", async () => {
    const velha = await reserva({ inicioMs: 3 * DAY, status: "processando", criadoMs: -11 * MIN });
    const nova = await reserva({ inicioMs: 4 * DAY, status: "processando", criadoMs: -2 * MIN });
    const antiga = await reserva({ inicioMs: 5 * DAY, status: "remarcada", criadoMs: -2 * DAY, google: "agx" });
    const presa = await reserva({ inicioMs: 6 * DAY, status: "processando", criadoMs: -30 * MIN, google: "agx", de: antiga });
    const res = await GET(cron());
    expect(res.status).toBe(200);
    expect((await res.json()).falhados).toBe(1);
    expect(await statusOf(velha)).toBe("falhou");
    expect(events.deleteEvent).toHaveBeenCalledWith(a.id, events.eventIdFor(velha));
    expect(await statusOf(nova)).toBe("processando");
    expect(await statusOf(presa)).toBe("processando");
  });

  it("reenvia e-mails falhou/pendente com < 5 tentativas; idempotente na segunda rodada", async () => {
    const futura = await reserva({ inicioMs: 3 * DAY });
    const passada = await reserva({ inicioMs: -3 * DAY });
    const base = { conta_id: a.id, tipo: "aviso_dono_nova" as const };
    const { data: ns } = await db().from("ag_notificacoes").insert([
      { ...base, reserva_id: futura, status: "falhou", tentativas: 1 },
      { ...base, reserva_id: passada, status: "falhou", tentativas: 1 },
      { ...base, reserva_id: futura, tipo: "aviso_dono_cancelada", status: "falhou", tentativas: 5 },
      { ...base, reserva_id: futura, tipo: "cancelamento_convidado", status: "pendente", tentativas: 0 },
    ]).select("id, tipo, reserva_id");
    const first = await (await GET(cron())).json();
    expect(first.reenviados).toBe(1);
    const ok = ns!.find((n) => n.tipo === "aviso_dono_nova" && n.reserva_id === futura)!;
    expect((await db().from("ag_notificacoes").select("status, tentativas").eq("id", ok.id).single()).data).toEqual({ status: "enviada", tentativas: 2 });
    expect(vi.mocked(resend.sendEmail).mock.calls).toHaveLength(1);
    const second = await (await GET(cron())).json();
    expect(second).toEqual({ reenviados: 0, falhados: 0, anonimizados: 0 });
    expect(vi.mocked(resend.sendEmail).mock.calls).toHaveLength(1);
  });

  it("pendente antigo também é reenviado (o envio original nunca terminou)", async () => {
    const futura = await reserva({ inicioMs: 3 * DAY, status: "cancelada_dono" });
    const { data: n } = await db().from("ag_notificacoes").insert({
      conta_id: a.id, reserva_id: futura, tipo: "cancelamento_convidado", status: "pendente", tentativas: 0, criado_em: new Date(Date.now() - 20 * MIN).toISOString(),
    }).select("id").single();
    expect((await (await GET(cron())).json()).reenviados).toBe(1);
    expect((await db().from("ag_notificacoes").select("status").eq("id", n!.id).single()).data!.status).toBe("enviada");
  });

  it("anonimiza reservas com fim há mais de 24 meses (regra 11.12), uma vez só", async () => {
    const velha = await reserva({ inicioMs: -(2 * 365 + 40) * DAY, status: "cancelada_dono" });
    const recente = await reserva({ inicioMs: -(2 * 365 - 40) * DAY });
    expect((await (await GET(cron())).json()).anonimizados).toBe(1);
    const { data: v } = await db().from("ag_reservas").select("nome_convidado, email_convidado, observacao, motivo_cancelamento, dados_anonimizados_em").eq("id", velha).single();
    expect(v).toMatchObject({ nome_convidado: "Convidado", email_convidado: "anonimo@invalid", observacao: null, motivo_cancelamento: null });
    expect(v!.dados_anonimizados_em).not.toBeNull();
    expect((await db().from("ag_reservas").select("nome_convidado").eq("id", recente).single()).data!.nome_convidado).toBe("Ana Pessoa");
    expect((await (await GET(cron())).json()).anonimizados).toBe(0);
  });
});
