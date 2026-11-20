// Testes do envio de eventos (plano 9.5): formato do ingest e regra de privacidade do distinct_id.
import { describe, expect, it } from "vitest";
import { buildPayload, track } from "./track";

describe("eventos da Visão de Produto", () => {
  it("monta o corpo do ingest com o id da conta como distinct_id", () => {
    const body = buildPayload(
      { nome: "reuniao_reserva_criada", contaId: "11111111-1111-4111-8111-111111111111", tela: "pagina_publica", descricao: "convidado marcou", propriedades: { duracao_min: 30 } },
      new Date("2026-11-20T12:00:00Z"),
      "evt-1",
    );
    expect(body).toEqual({
      eventos: [{
        id: "evt-1", nome: "reuniao_reserva_criada", distinct_id: "11111111-1111-4111-8111-111111111111",
        ocorrido_em: "2026-11-20T12:00:00.000Z", tela: "pagina_publica", descricao: "convidado marcou",
        propriedades: { ambiente: "local", duracao_min: 30 },
      }],
    });
  });
  it("nos testes não envia nada (sem rede)", () => {
    process.env.VISAO_API_KEY = "ing_teste";
    expect(() => track({ nome: "reuniao_login", contaId: "x", tela: "entrar", descricao: "x" })).not.toThrow();
    delete process.env.VISAO_API_KEY;
  });
});
