// Testes das boas-vindas (critério 8.11) e da suspensão no painel (8.13), com o Supabase local.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { apiRequest, createTestAccount, deleteTestAccounts } from "../../../../../../tests/helpers";

const { POST } = await import("./route");
const { GET: getConta } = await import("../route");
const { getAccountById } = await import("@/server/db/accounts");

let a: Awaited<ReturnType<typeof createTestAccount>>;
let b: Awaited<ReturnType<typeof createTestAccount>>;

beforeAll(async () => {
  a = await createTestAccount("bv-a");
  b = await createTestAccount("bv-b");
});
afterAll(() => deleteTestAccounts([a.id, b.id]));

function welcome(cookie: string, body: unknown) {
  return POST(apiRequest("/api/painel/conta/boas-vindas", { method: "POST", cookie, body }));
}

describe("POST /api/painel/conta/boas-vindas", () => {
  it("conta nova começa sem aceite", async () => {
    expect((await getAccountById(a.id))!.termsAcceptedAt).toBeNull();
  });

  it("sem o aceite → 422 e nada muda", async () => {
    const res = await welcome(a.cookie, { nome_exibicao: "Ana", slug: a.slug, fuso: "America/Sao_Paulo", aceite: false });
    expect(res.status).toBe(422);
    expect((await getAccountById(a.id))!.termsAcceptedAt).toBeNull();
  });

  it("endereço de outra conta → 409 slug_em_uso e o aceite não é gravado", async () => {
    const res = await welcome(a.cookie, { nome_exibicao: "Ana", slug: b.slug, fuso: "America/Sao_Paulo", aceite: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ erro: "slug_em_uso" });
    expect((await getAccountById(a.id))!.termsAcceptedAt).toBeNull();
  });

  it("com o aceite grava nome, endereço, fuso e o instante do aceite", async () => {
    const slug = `${a.slug}-ok`.slice(0, 30);
    const res = await welcome(a.cookie, { nome_exibicao: " Ana Dona ", slug, fuso: "Europe/Lisbon", aceite: true });
    expect(res.status).toBe(200);
    const { data } = await db().from("ag_contas").select("nome_exibicao, slug, fuso, termos_aceitos_em").eq("id", a.id).single();
    expect(data).toMatchObject({ nome_exibicao: "Ana Dona", slug, fuso: "Europe/Lisbon" });
    expect(data!.termos_aceitos_em).not.toBeNull();
    a.slug = slug;
  });

  it("sem sessão → 401", async () => {
    expect((await welcome("", { aceite: true })).status).toBe(401);
  });
});

describe("conta suspensa no painel (8.13)", () => {
  it("sessão de conta suspensa → 401; reativada volta", async () => {
    await db().from("ag_contas").update({ suspensa_em: new Date().toISOString() }).eq("id", b.id);
    expect((await getConta(apiRequest("/api/painel/conta", { cookie: b.cookie }))).status).toBe(401);
    await db().from("ag_contas").update({ suspensa_em: null }).eq("id", b.id);
    expect((await getConta(apiRequest("/api/painel/conta", { cookie: b.cookie }))).status).toBe(200);
  });
});

describe("saída das boas-vindas (bug B-02)", () => {
  it("conta sem aceite consegue se excluir pela rota da conta", async () => {
    const { DELETE } = await import("../route");
    const c = await createTestAccount("bv-sai");
    expect((await getAccountById(c.id))!.termsAcceptedAt).toBeNull();
    const res = await DELETE(apiRequest("/api/painel/conta", { method: "DELETE", cookie: c.cookie, body: { confirmacao: c.slug } }));
    expect(res.status).toBe(200);
    expect((await db().from("ag_contas").select("id").eq("id", c.id)).data).toHaveLength(0);
  });
