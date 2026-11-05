// Testes das rotas de tipos de evento (critérios 8.2, seção 5) no Supabase local.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { apiRequest, createTestAccount, deleteTestAccounts, routeCtx } from "../../../../../tests/helpers";
import { GET as list, POST as create } from "./route";
import { DELETE as remove, GET as getOne, PATCH as patch } from "./[id]/route";
import { POST as reorder } from "./ordem/route";

let a: Awaited<ReturnType<typeof createTestAccount>>;
let b: Awaited<ReturnType<typeof createTestAccount>>;

beforeAll(async () => {
  a = await createTestAccount("tipos-a");
  b = await createTestAccount("tipos-b");
});
afterAll(() => deleteTestAccounts([a.id, b.id]));

// Cria um tipo pela rota e devolve o corpo.
async function createType(cookie: string, body: unknown) {
  const res = await create(apiRequest("/api/painel/tipos", { method: "POST", cookie, body }));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/painel/tipos", () => {
  it("só nome e duração → defaults de 7.3 e slug sugerido do nome", async () => {
    const { status, body } = await createType(a.cookie, { nome: "Reunião de 1,5h", duracao_min: 90 });
    expect(status).toBe(201);
    expect(body.tipo).toMatchObject({
      nome: "Reunião de 1,5h", slug: "reuniao-de-15h", duracao_min: 90, com_meet: true, antecedencia_min: 240,
      janela_dias: 60, intervalo_antes_min: 0, intervalo_depois_min: 0, passo_min: 30, visivel_na_pagina: true, ativo: true,
    });
  });
  it("slug repetido na mesma conta → 409 slug_em_uso; em outra conta pode", async () => {
    await createType(a.cookie, { nome: "Entrevistas", slug: "entrevistas" });
    expect(await createType(a.cookie, { nome: "Outra", slug: "entrevistas" })).toEqual({ status: 409, body: { erro: "slug_em_uso" } });
    expect((await createType(b.cookie, { nome: "Entrevistas", slug: "entrevistas" })).status).toBe(201);
  });
  it("dados fora do limite → 422; nome que não vira slug válido → 422", async () => {
    expect((await createType(a.cookie, { nome: "X", duracao_min: 7 })).status).toBe(422);
    expect(await createType(a.cookie, { nome: "!!" })).toEqual({ status: 422, body: { erro: "slug_invalido" } });
  });
  it("sem sessão → 401; Origin estranho → 403", async () => {
    expect((await create(apiRequest("/api/painel/tipos", { method: "POST", body: { nome: "x" } }))).status).toBe(401);
    expect((await create(apiRequest("/api/painel/tipos", { method: "POST", cookie: a.cookie, body: { nome: "x" }, origin: "https://mal.example" }))).status).toBe(403);
    expect((await create(apiRequest("/api/painel/tipos", { method: "POST", cookie: a.cookie, body: { nome: "x" }, origin: null }))).status).toBe(403);
  });
});

describe("GET /api/painel/tipos", () => {
  it("lista só os tipos da própria conta", async () => {
    const res = await list(apiRequest("/api/painel/tipos", { cookie: b.cookie }));
    const { tipos } = await res.json();
    expect(tipos.map((t: { slug: string }) => t.slug)).toEqual(["entrevistas"]);
  });
});

describe("/api/painel/tipos/[id]", () => {
  it("outra conta não lê, não edita e não exclui (404)", async () => {
    const { body } = await createType(a.cookie, { nome: "Privado da A" });
    const id = body.tipo.id as string;
    expect((await getOne(apiRequest(`/api/painel/tipos/${id}`, { cookie: b.cookie }), routeCtx({ id }))).status).toBe(404);
    expect((await patch(apiRequest(`/api/painel/tipos/${id}`, { method: "PATCH", cookie: b.cookie, body: { ativo: false } }), routeCtx({ id }))).status).toBe(404);
    expect((await remove(apiRequest(`/api/painel/tipos/${id}`, { method: "DELETE", cookie: b.cookie }), routeCtx({ id }))).status).toBe(404);
    const { data } = await db().from("ag_tipos_evento").select("ativo, excluido_em").eq("id", id).single();
    expect(data).toEqual({ ativo: true, excluido_em: null });
  });
  it("PATCH muda só o campo enviado", async () => {
    const { body } = await createType(a.cookie, { nome: "Editável", duracao_min: 60 });
    const id = body.tipo.id as string;
    const res = await patch(apiRequest(`/api/painel/tipos/${id}`, { method: "PATCH", cookie: a.cookie, body: { visivel_na_pagina: false } }), routeCtx({ id }));
    expect((await res.json()).tipo).toMatchObject({ nome: "Editável", duracao_min: 60, visivel_na_pagina: false, ativo: true });
  });
  it("DELETE faz soft delete, some da lista e libera o slug", async () => {
    const { body } = await createType(a.cookie, { nome: "Temporário", slug: "temporario" });
    const id = body.tipo.id as string;
    expect((await remove(apiRequest(`/api/painel/tipos/${id}`, { method: "DELETE", cookie: a.cookie }), routeCtx({ id }))).status).toBe(204);
    const { data } = await db().from("ag_tipos_evento").select("excluido_em").eq("id", id).single();
    expect(data!.excluido_em).not.toBeNull();
    const { tipos } = await (await list(apiRequest("/api/painel/tipos", { cookie: a.cookie }))).json();
    expect(tipos.some((t: { id: string }) => t.id === id)).toBe(false);
    expect((await createType(a.cookie, { nome: "Temporário de novo", slug: "temporario" })).status).toBe(201);
  });
  it("PATCH sem nenhum campo devolve o tipo como está (salvar sem mudar nada não é erro)", async () => {
    const { body } = await createType(a.cookie, { nome: "Sem mudança" });
    const id = body.tipo.id as string;
    const res = await patch(apiRequest(`/api/painel/tipos/${id}`, { method: "PATCH", cookie: a.cookie, body: {} }), routeCtx({ id }));
    expect(res.status).toBe(200);
    expect((await res.json()).tipo).toMatchObject({ id, nome: "Sem mudança" });
  });
  it("PATCH vazio em tipo de outra conta continua 404", async () => {
    const { body } = await createType(a.cookie, { nome: "Vazio da A" });
    const id = body.tipo.id as string;
    expect((await patch(apiRequest(`/api/painel/tipos/${id}`, { method: "PATCH", cookie: b.cookie, body: {} }), routeCtx({ id }))).status).toBe(404);
  });
  it("id que não é uuid → 404", async () => {
    expect((await getOne(apiRequest("/api/painel/tipos/abc", { cookie: a.cookie }), routeCtx({ id: "abc" }))).status).toBe(404);
  });
});

describe("POST /api/painel/tipos/ordem", () => {
  it("grava a ordem e ignora ids de outra conta", async () => {
    const { tipos: before } = await (await list(apiRequest("/api/painel/tipos", { cookie: a.cookie }))).json();
    const ids = before.map((t: { id: string }) => t.id).reverse();
    const { tipos: bTipos } = await (await list(apiRequest("/api/painel/tipos", { cookie: b.cookie }))).json();
    const res = await reorder(apiRequest("/api/painel/tipos/ordem", { method: "POST", cookie: a.cookie, body: { ids: [...ids, bTipos[0].id] } }));
    expect(res.status).toBe(200);
    const { tipos: after } = await (await list(apiRequest("/api/painel/tipos", { cookie: a.cookie }))).json();
    expect(after.map((t: { id: string }) => t.id)).toEqual(ids);
    const { data } = await db().from("ag_tipos_evento").select("ordem").eq("id", bTipos[0].id).single();
    expect(data!.ordem).toBe(0);
  });
});
