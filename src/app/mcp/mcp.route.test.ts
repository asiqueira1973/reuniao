// Testes do MCP e do OAuth (plano 9.6) com o Supabase local: registro de cliente, consentimento,
// troca do código com PKCE, reuso do código, ferramentas (lista e anotações, leitura só da conta,
// formulário com _meta.ui, gravação com erros por campo) e token revogado.
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { s256 } from "@/server/oauth/server";
import { createTestAccount, deleteTestAccounts, SITE } from "../../../tests/helpers";

vi.mock("@/server/google/calendar", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/calendar")>();
  return { ...original, queryFreeBusy: vi.fn(async () => []) };
});

const { POST: registrar } = await import("../oauth/registrar/route");
const { POST: decidir } = await import("../oauth/autorizar/decidir/route");
const { POST: token } = await import("../oauth/token/route");
const { POST: mcp } = await import("./route");
const { revokeMcpConnection, listMcpConnections } = await import("@/server/oauth/tokens");
const { FORM_URI } = await import("@/server/mcp/shared");

let a: Awaited<ReturnType<typeof createTestAccount>>;
let b: Awaited<ReturnType<typeof createTestAccount>>;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
let clientId = "";
let accessToken = "";

// Uma chamada JSON-RPC ao /mcp; devolve o objeto da resposta (JSON ou SSE).
async function rpc(method: string, params: unknown, bearer = accessToken) {
  const res = await mcp(new NextRequest(`${SITE}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${bearer}`, "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  const text = await res.text();
  const json = text.trim().startsWith("{") ? text : text.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? "{}";
  return { status: res.status, body: JSON.parse(json) as { result?: Record<string, unknown>; error?: unknown } };
}
const call = async (name: string, args: Record<string, unknown> = {}) => (await rpc("tools/call", { name, arguments: args })).body.result as {
  content: Array<{ text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean;
};

// Consentimento + troca do código. Devolve o token.
async function connect(conta: { cookie: string }): Promise<{ code: string; token: string }> {
  const verifier = randomBytes(40).toString("base64url");
  const form = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: s256(verifier), code_challenge_method: "S256", state: "xyz", decisao: "permitir" });
  const res = await decidir(new NextRequest(`${SITE}/oauth/autorizar/decidir`, { method: "POST", headers: { cookie: conta.cookie, origin: SITE, "content-type": "application/x-www-form-urlencoded" }, body: form }));
  expect(res.status).toBe(303);
  const loc = new URL(res.headers.get("location")!);
  expect(loc.origin + loc.pathname).toBe(REDIRECT);
  expect(loc.searchParams.get("state")).toBe("xyz");
  const code = loc.searchParams.get("code")!;
  const t = await token(new Request(`${SITE}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier }) }));
  expect(t.status).toBe(200);
  return { code, token: (await t.json()).access_token };
}

beforeAll(async () => {
  a = await createTestAccount("mcp-a");
  b = await createTestAccount("mcp-b");
  await db().from("ag_contas").update({ termos_aceitos_em: new Date().toISOString() }).in("id", [a.id, b.id]);
  const r = await registrar(new Request(`${SITE}/oauth/registrar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris: [REDIRECT] }) }));
  expect(r.status).toBe(201);
  clientId = (await r.json()).client_id;
  accessToken = (await connect(a)).token;
});
afterAll(async () => {
  await deleteTestAccounts([a.id, b.id]);
  await db().from("ag_oauth_clientes").delete().eq("id", clientId);
});

describe("OAuth do MCP", () => {
  it("registro recusa redirect http fora de localhost", async () => {
    const r = await registrar(new Request(`${SITE}/oauth/registrar`, { method: "POST", body: JSON.stringify({ redirect_uris: ["http://mal.example/cb"] }), headers: { "content-type": "application/json" } }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe("invalid_redirect_uri");
  });

  it("token começa com reuniao_mcp_ e o reuso do código revoga o token emitido", async () => {
    const verifier = randomBytes(40).toString("base64url");
    const { code, token: t } = await connect(b);
    expect(t.startsWith("reuniao_mcp_")).toBe(true);
    const again = await token(new Request(`${SITE}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier }) }));
    expect((await again.json()).error).toBe("invalid_grant");
    expect((await rpc("tools/list", {}, t)).status).toBe(401);
  });

  it("consentimento sem sessão → 401; pedido com redirect não registrado → 400 sem redirecionar", async () => {
    const form = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: "https://mal.example/cb", code_challenge: "a".repeat(43), code_challenge_method: "S256", decisao: "permitir" });
    const semSessao = await decidir(new NextRequest(`${SITE}/oauth/autorizar/decidir`, { method: "POST", headers: { origin: SITE, "content-type": "application/x-www-form-urlencoded" }, body: form }));
    expect(semSessao.status).toBe(401);
    const ruim = await decidir(new NextRequest(`${SITE}/oauth/autorizar/decidir`, { method: "POST", headers: { cookie: a.cookie, origin: SITE, "content-type": "application/x-www-form-urlencoded" }, body: form }));
    expect(ruim.status).toBe(400);
    expect(ruim.headers.get("location")).toBeNull();
  });
});

describe("ferramentas do MCP", () => {
  it("sem token → 401 com o endereço dos metadados", async () => {
    const r = await rpc("tools/list", {}, "nada");
    expect(r.status).toBe(401);
  });

  it("lista as ferramentas com título e dicas; formulários apontam o recurso do formulário", async () => {
    const r = await rpc("tools/list", {});
    expect(r.status).toBe(200);
    const tools = (r.body.result!.tools as Array<{ name: string; title?: string; annotations?: Record<string, unknown>; _meta?: { ui?: { resourceUri?: string } } }>);
    const nomes = tools.map((t) => t.name);
    for (const n of ["ver_conta", "listar_tipos_de_reuniao", "ver_disponibilidade", "horarios_livres", "listar_reunioes", "agenda_do_dia", "agenda_da_semana", "ver_reuniao",
      "abrir_formulario_tipo_de_reuniao", "abrir_formulario_horarios_da_semana", "abrir_formulario_data_especial", "abrir_formulario_marcar_reuniao", "abrir_formulario_cancelar_reuniao", "abrir_formulario_conta",
      "salvar_tipo_de_reuniao", "salvar_horarios_da_semana", "salvar_data_especial", "marcar_reuniao", "cancelar_reuniao", "salvar_conta", "reenviar_email"]) {
      expect(nomes).toContain(n);
    }
    for (const t of tools) {
      expect(t.title ?? t.annotations?.title).toBeTruthy();
      expect(t.annotations?.openWorldHint).toBe(false);
      const escrita = !t.name.startsWith("abrir_") && /^(salvar_|marcar_|cancelar_|reenviar_)/.test(t.name);
      expect(t.annotations?.readOnlyHint).toBe(!escrita);
      expect(t.annotations?.destructiveHint).toBe(escrita);
    }
    expect(tools.find((t) => t.name === "abrir_formulario_conta")?._meta?.ui?.resourceUri).toBe(FORM_URI);
  });

  it("o recurso do formulário é HTML de MCP App", async () => {
    const r = await rpc("resources/read", { uri: FORM_URI });
    const c = (r.body.result!.contents as Array<{ mimeType: string; text: string }>)[0]!;
    expect(c.mimeType).toContain("text/html");
    expect(c.text).toContain('<main id="app">');
  });

  it("ver_conta mostra só a conta do token", async () => {
    const r = await call("ver_conta");
    expect(r.structuredContent).toMatchObject({ endereco: a.slug, link: `${SITE}/${a.slug}` });
  });

  it("abrir formulário não grava e devolve os campos; salvar cria o tipo; erro volta por campo", async () => {
    const f = await call("abrir_formulario_tipo_de_reuniao", { nome: "Café de 15", duracao_min: 15 });
    expect(f.structuredContent).toMatchObject({ acao: "salvar_tipo_de_reuniao", valores: { nome: "Café de 15", duracao_min: 15 } });
    expect((await db().from("ag_tipos_evento").select("id").eq("conta_id", a.id)).data).toHaveLength(0);

    const ruim = await call("salvar_tipo_de_reuniao", { nome: "", duracao_min: 7 });
    expect(ruim.isError).toBe(true);
    expect((ruim.structuredContent!.erros as Array<{ campo: string }>).map((e) => e.campo)).toEqual(expect.arrayContaining(["nome"]));

    const okr = await call("salvar_tipo_de_reuniao", { nome: "Café de 15", duracao_min: "15", passo_min: "15", antecedencia_min: "0", com_meet: true });
    expect(okr.structuredContent).toMatchObject({ ok: true });
    const { data } = await db().from("ag_tipos_evento").select("nome, duracao_min, passo_min").eq("conta_id", a.id).single();
    expect(data).toEqual({ nome: "Café de 15", duracao_min: 15, passo_min: 15 });
  });

  it("horários: sobreposição é recusada; salvar troca a semana", async () => {
    const ruim = await call("salvar_horarios_da_semana", { faixas: [{ dia_semana: 1, inicio: "09:00", fim: "12:00" }, { dia_semana: 1, inicio: "11:00", fim: "13:00" }] });
    expect(ruim.isError).toBe(true);
    const okr = await call("salvar_horarios_da_semana", { faixas: [{ dia_semana: 2, inicio: "09:00", fim: "11:00" }] });
    expect(okr.structuredContent).toMatchObject({ ok: true });
    const { data } = await db().from("ag_horarios_semanais").select("dia_semana, inicio, fim").eq("conta_id", a.id);
    expect(data).toEqual([{ dia_semana: 2, inicio: "09:00:00", fim: "11:00:00" }]);
  });

  it("reunião de outra conta não aparece nem pode ser cancelada", async () => {
    const { data: tipo } = await db().from("ag_tipos_evento").insert({ conta_id: b.id, nome: "R", slug: "reuniao-b", duracao_min: 30 }).select("id").single();
    const { data: r } = await db().from("ag_reservas").insert({
      conta_id: b.id, tipo_evento_id: tipo!.id, inicio: "2031-11-04T13:00:00Z", fim: "2031-11-04T13:30:00Z", status: "confirmada",
      nome_convidado: "Bia", email_convidado: "bia@teste.dev", fuso_convidado: "America/Sao_Paulo", token_hash: `mcp-${b.id}`,
    }).select("id").single();
    expect((await call("ver_reuniao", { reuniao_id: r!.id })).isError).toBe(true);
    expect((await call("abrir_formulario_cancelar_reuniao", { reuniao_id: r!.id })).isError).toBe(true);
    expect((await call("cancelar_reuniao", { reuniao_id: r!.id })).isError).toBe(true);
    expect((await db().from("ag_reservas").select("status").eq("id", r!.id).single()).data!.status).toBe("confirmada");
  });

  it("conexão aparece em Conta e, revogada, o token deixa de valer", async () => {
    const extra = (await connect(a)).token;
    const conns = await listMcpConnections(a.id);
    expect(conns.length).toBeGreaterThanOrEqual(2);
    expect(conns[0]!.nome).toBe("Claude");
    expect(await revokeMcpConnection(a.id, conns[0]!.id)).toBe(true);
    expect((await rpc("tools/list", {}, extra)).status).toBe(401);
    expect((await rpc("tools/list", {})).status).toBe(200);
  });
});
