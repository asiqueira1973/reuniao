// Testes de DELETE /api/painel/conta/assistentes/{id} (plano 9.6): só a conta dona desconecta.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { apiRequest, createTestAccount, deleteTestAccounts, routeCtx } from "../../../../../../../tests/helpers";
import { DELETE } from "./route";

let a: Awaited<ReturnType<typeof createTestAccount>>;
let b: Awaited<ReturnType<typeof createTestAccount>>;
let clienteId = "";
let tokenId = "";

beforeAll(async () => {
  a = await createTestAccount("assist-a");
  b = await createTestAccount("assist-b");
  const { data: cli } = await db().from("ag_oauth_clientes").insert({ nome: "Claude", redirect_uris: ["https://claude.ai/cb"] }).select("id").single();
  clienteId = cli!.id;
  const { data: t } = await db().from("ag_mcp_tokens").insert({ conta_id: a.id, cliente_id: clienteId, nome: "Claude", token_hash: `h-${randomUUID()}`, prefixo: "reuniao_mcp_x" }).select("id").single();
  tokenId = t!.id;
});
afterAll(async () => {
  await deleteTestAccounts([a.id, b.id]);
  await db().from("ag_oauth_clientes").delete().eq("id", clienteId);
});

describe("DELETE /api/painel/conta/assistentes/{id}", () => {
  it("sem sessão → 401", async () => {
    expect((await DELETE(apiRequest(`/api/painel/conta/assistentes/${tokenId}`, { method: "DELETE" }), routeCtx({ id: tokenId }))).status).toBe(401);
  });

  it("outra conta → 404 e o token segue ativo", async () => {
    const res = await DELETE(apiRequest(`/api/painel/conta/assistentes/${tokenId}`, { method: "DELETE", cookie: b.cookie }), routeCtx({ id: tokenId }));
    expect(res.status).toBe(404);
    expect((await db().from("ag_mcp_tokens").select("revogado_em").eq("id", tokenId).single()).data!.revogado_em).toBeNull();
  });

  it("dona → 200 e o token fica revogado; repetir → 404", async () => {
    const res = await DELETE(apiRequest(`/api/painel/conta/assistentes/${tokenId}`, { method: "DELETE", cookie: a.cookie }), routeCtx({ id: tokenId }));
    expect(res.status).toBe(200);
    expect((await db().from("ag_mcp_tokens").select("revogado_em").eq("id", tokenId).single()).data!.revogado_em).not.toBeNull();
    expect((await DELETE(apiRequest(`/api/painel/conta/assistentes/${tokenId}`, { method: "DELETE", cookie: a.cookie }), routeCtx({ id: tokenId }))).status).toBe(404);
  });
});
