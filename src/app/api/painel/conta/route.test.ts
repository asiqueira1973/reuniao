// Testes da conta do dono (critérios 8.8) com o Google simulado e o Supabase local.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { encryptSecret } from "@/server/google/crypto";
import { apiRequest, createTestAccount, deleteTestAccounts } from "../../../../../tests/helpers";

vi.mock("@/server/google/oauth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/oauth")>();
  return { ...original, revokeToken: vi.fn() };
});

const oauth = await import("@/server/google/oauth");
const { GET, PATCH, DELETE } = await import("./route");
const { GET: slugCheck } = await import("./slug-disponivel/route");
const { newManageToken } = await import("@/server/booking");
const { requireReservaPorToken } = await import("@/server/auth/require-reserva");

let a: Awaited<ReturnType<typeof createTestAccount>>;
let b: Awaited<ReturnType<typeof createTestAccount>>;
const extra: string[] = [];

beforeAll(async () => {
  a = await createTestAccount("conta-a");
  b = await createTestAccount("conta-b");
  await db().from("ag_conexoes_google").insert({ conta_id: a.id, refresh_token_cifrado: encryptSecret("1//token-a"), escopos: [] });
});
afterAll(() => deleteTestAccounts([a.id, b.id, ...extra]));
beforeEach(() => vi.mocked(oauth.revokeToken).mockReset().mockResolvedValue());

function patch(cookie: string, body: unknown) {
  return PATCH(apiRequest("/api/painel/conta", { method: "PATCH", cookie, body }));
}

describe("GET/PATCH /api/painel/conta", () => {
  it("devolve as configurações e a situação da conexão", async () => {
    const res = await GET(apiRequest("/api/painel/conta", { cookie: a.cookie }));
    expect(res.status).toBe(200);
    expect((await res.json()).conta).toMatchObject({ slug: a.slug, nome_exibicao: "Conta Teste", fuso: "America/Sao_Paulo", conexao: "ativa" });
    expect((await (await GET(apiRequest("/api/painel/conta", { cookie: b.cookie }))).json()).conta.conexao).toBe("ausente");
    expect((await GET(apiRequest("/api/painel/conta"))).status).toBe(401);
  });

  it("muda nome, mensagem e fuso; mensagem vazia vira null; PATCH vazio não muda nada", async () => {
    const res = await patch(a.cookie, { nome_exibicao: " Ana Dona ", mensagem_boas_vindas: "Olá!", fuso: "Europe/Lisbon" });
    expect(res.status).toBe(200);
    expect((await res.json()).conta).toMatchObject({ nome_exibicao: "Ana Dona", mensagem_boas_vindas: "Olá!", fuso: "Europe/Lisbon" });
    expect((await (await patch(a.cookie, { mensagem_boas_vindas: "  " })).json()).conta.mensagem_boas_vindas).toBeNull();
    const empty = await patch(a.cookie, {});
    expect(empty.status).toBe(200);
    expect((await empty.json()).conta.nome_exibicao).toBe("Ana Dona");
  });

  it("rejeita fuso inválido, nome vazio, campo não editável e slug reservado", async () => {
    expect((await patch(a.cookie, { fuso: "Marte/Olympus" })).status).toBe(422);
    expect((await patch(a.cookie, { nome_exibicao: "  " })).status).toBe(422);
    expect((await patch(a.cookie, { email: "x@y.dev" })).status).toBe(422);
    const reserved = await patch(a.cookie, { slug: "painel" });
    expect(reserved.status).toBe(422);
    expect(await reserved.json()).toEqual({ erro: "slug_reservado" });
    expect((await patch(a.cookie, { slug: "Com Espaço" })).status).toBe(422);
  });

  it("slug de outra conta → 409 slug_em_uso; troca de slug mantém o link /r/{token}", async () => {
    const taken = await patch(a.cookie, { slug: b.slug });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ erro: "slug_em_uso" });

    const { data: tipo } = await db().from("ag_tipos_evento").insert({ conta_id: a.id, nome: "Reunião", slug: "reuniao-teste", duracao_min: 30 }).select("id").single();
    const { token, hash } = newManageToken();
    await db().from("ag_reservas").insert({
      conta_id: a.id, tipo_evento_id: tipo!.id, inicio: "2030-01-07T13:30:00Z", fim: "2030-01-07T14:00:00Z", status: "confirmada",
      nome_convidado: "Ana", email_convidado: "ana@teste.dev", fuso_convidado: "America/Sao_Paulo", token_hash: hash,
    });
    const novo = `${a.slug}-n`.slice(0, 30);
    const res = await patch(a.cookie, { slug: novo });
    expect(res.status).toBe(200);
    a.slug = novo;
    expect(await requireReservaPorToken(token)).not.toBeNull();
  });
});

describe("GET /api/painel/conta/slug-disponivel", () => {
  it("livre, ocupado por outra conta, o próprio slug e inválido", async () => {
    const check = async (slug: string) => (await (await slugCheck(apiRequest(`/api/painel/conta/slug-disponivel?slug=${encodeURIComponent(slug)}`, { cookie: a.cookie }))).json()).disponivel;
    expect(await check(`livre-${a.id.slice(0, 8)}`)).toBe(true);
    expect(await check(b.slug)).toBe(false);
    expect(await check(a.slug)).toBe(true);
    expect(await check("painel")).toBe(false);
    expect(await check("A")).toBe(false);
    expect((await slugCheck(apiRequest("/api/painel/conta/slug-disponivel?slug=x"))).status).toBe(401);
  });
});

describe("DELETE /api/painel/conta", () => {
  it("confirmação errada → 422 e nada apagado", async () => {
    const res = await DELETE(apiRequest("/api/painel/conta", { method: "DELETE", cookie: a.cookie, body: { confirmacao: "outra" } }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ erro: "confirmacao_invalida" });
    expect(oauth.revokeToken).not.toHaveBeenCalled();
    expect((await db().from("ag_contas").select("id").eq("id", a.id)).data).toHaveLength(1);
  });

  it("confirmação certa → revoga o token, apaga em cascata, apaga o cookie; outra conta intacta", async () => {
    const res = await DELETE(apiRequest("/api/painel/conta", { method: "DELETE", cookie: a.cookie, body: { confirmacao: a.slug } }));
    expect(res.status).toBe(200);
    expect(oauth.revokeToken).toHaveBeenCalledWith("1//token-a");
    expect(res.headers.get("set-cookie")).toMatch(/ag_sessao=;/);
    expect((await db().from("ag_contas").select("id").eq("id", a.id)).data).toHaveLength(0);
    for (const t of ["ag_conexoes_google", "ag_tipos_evento", "ag_reservas", "ag_horarios_semanais"] as const) {
      expect((await db().from(t).select("conta_id").eq("conta_id", a.id)).data).toHaveLength(0);
    }
    expect((await db().from("ag_contas").select("id").eq("id", b.id)).data).toHaveLength(1);
    // A sessão antiga deixa de valer.
    expect((await GET(apiRequest("/api/painel/conta", { cookie: a.cookie }))).status).toBe(401);
  });

  it("escrita sem Origin do site → 403", async () => {
    expect((await DELETE(apiRequest("/api/painel/conta", { method: "DELETE", cookie: b.cookie, body: { confirmacao: b.slug }, origin: "https://mal.example" }))).status).toBe(403);
  });
});
