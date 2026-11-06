// Testes do 404 das páginas públicas no proxy (critério 8.5 "página /{slug} inexistente → 404").
// A página usa streaming (status 200 fixo); por isso o proxy confere conta/tipo antes e reescreve
// para a rota de não encontrado.
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { createTestAccount, deleteTestAccounts } from "../tests/helpers";
import { proxy } from "./proxy";

let conta: Awaited<ReturnType<typeof createTestAccount>>;

beforeAll(async () => {
  conta = await createTestAccount("proxy");
  await db().from("ag_tipos_evento").insert([
    { conta_id: conta.id, nome: "Ok", slug: "tipo-ok" },
    { conta_id: conta.id, nome: "Antigo", slug: "tipo-antigo", excluido_em: new Date().toISOString() },
  ]);
});
afterAll(() => deleteTestAccounts([conta.id]));

// Diz se o proxy reescreveu para a rota de não encontrado.
async function isNotFound(path: string) {
  const res = await proxy(new NextRequest(`http://localhost:3020${path}`));
  return (res.headers.get("x-middleware-rewrite") ?? "").includes("/_not-found");
}

describe("proxy — 404 das páginas públicas", () => {
  it("conta e tipo existentes seguem", async () => {
    expect(await isNotFound(`/${conta.slug}`)).toBe(false);
    expect(await isNotFound(`/${conta.slug}/tipo-ok`)).toBe(false);
    expect(await isNotFound(`/${conta.slug}/tipo-ok/confirmado`)).toBe(false);
  });
  it("conta inexistente, tipo inexistente ou excluído → não encontrado", async () => {
    expect(await isNotFound("/nao-existe-xyz-123")).toBe(true);
    expect(await isNotFound(`/${conta.slug}/nao-existe`)).toBe(true);
    expect(await isNotFound(`/${conta.slug}/tipo-antigo`)).toBe(true);
    expect(await isNotFound("/nao-existe-xyz-123/tipo-ok/confirmado")).toBe(true);
  });
  it("rotas do app não passam pela checagem", async () => {
    expect(await isNotFound("/entrar")).toBe(false);
  });

  it("conta suspensa → não encontrado; reativada volta (8.13)", async () => {
    await db().from("ag_contas").update({ suspensa_em: new Date().toISOString() }).eq("id", conta.id);
    expect(await isNotFound(`/${conta.slug}`)).toBe(true);
    expect(await isNotFound(`/${conta.slug}/tipo-ok`)).toBe(true);
    await db().from("ag_contas").update({ suspensa_em: null }).eq("id", conta.id);
    expect(await isNotFound(`/${conta.slug}`)).toBe(false);
  });
});
