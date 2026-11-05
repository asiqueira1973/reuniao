// Teste do seed do Calendly (regra 11.9): cria os 5 tipos na ordem e não duplica ao rodar de novo.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { createTestAccount, deleteTestAccounts } from "../../../tests/helpers";
import { CALENDLY_TYPES, seedCalendlyTypes } from "./calendly-seed";

let conta: Awaited<ReturnType<typeof createTestAccount>>;

beforeAll(async () => {
  conta = await createTestAccount("seed");
  // Conta nova já tem o tipo padrão (11.9): o seed deve reaproveitá-lo, não duplicar.
  await db().from("ag_tipos_evento").insert({ conta_id: conta.id, nome: "Reunião de 30 minutos", slug: "reuniao-30-minutos", duracao_min: 30, ordem: 0 });
});
afterAll(() => deleteTestAccounts([conta.id]));

async function types() {
  const { data } = await db().from("ag_tipos_evento").select("nome, slug, duracao_min, ordem").eq("conta_id", conta.id).is("excluido_em", null).order("ordem");
  return data ?? [];
}

describe("seedCalendlyTypes (regra 11.9)", () => {
  it("grava os 5 tipos com as durações da tabela, na ordem", async () => {
    const created = await seedCalendlyTypes(db(), conta.id);
    expect(created).toEqual(["entrevistas", "reuniao-2h", "reuniao-1-5h", "reuniao-1h"]);
    expect(await types()).toEqual(CALENDLY_TYPES.map((t, ordem) => ({ ...t, ordem })));
  });
  it("rodar de novo não duplica nada", async () => {
    expect(await seedCalendlyTypes(db(), conta.id)).toEqual([]);
    expect(await types()).toHaveLength(5);
  });
});
