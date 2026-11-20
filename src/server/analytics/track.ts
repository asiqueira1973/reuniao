// Eventos de uso enviados à Visão de Produto (ferramenta de análise da DabLab), plano 9.5.
// Regras de privacidade (seção 20 e política enviada ao Google):
// - distinct_id é o id interno da conta (uuid do banco), nunca o e-mail nem outro dado do Google;
// - nada de convidado (nome, e-mail, observação), token, link /r/ ou link do Meet;
// - nunca atrasa nem quebra a ação: roda depois da resposta, timeout de 4 s, erro só vai ao log.
// Sem VISAO_API_KEY (ou nos testes) não envia nada.
import "server-only";
import { randomUUID } from "node:crypto";
import { runAfterResponse } from "@/server/http";

export type EventName =
  | "reuniao_conta_criada"
  | "reuniao_login"
  | "reuniao_boas_vindas_concluidas"
  | "reuniao_tipo_criado"
  | "reuniao_disponibilidade_salva"
  | "reuniao_reserva_criada"
  | "reuniao_reserva_falhou"
  | "reuniao_reserva_cancelada"
  | "reuniao_reserva_remarcada"
  | "reuniao_conexao_revogada"
  | "reuniao_conta_excluida";

export type ProductEvent = {
  nome: EventName;
  /** Id interno da conta (ag_contas.id) do dono a quem o fato pertence. */
  contaId: string;
  tela: string;
  descricao: string;
  propriedades?: Record<string, string | number | boolean | null>;
};

export const ENDPOINT = "https://api.visaodeproduto.com.br/functions/v1/ingest";

// Monta o corpo do ingest (puro; testado). Devolve o JSON do POST.
export function buildPayload(event: ProductEvent, now = new Date(), id: string = randomUUID()) {
  return {
    eventos: [
      {
        id,
        nome: event.nome,
        distinct_id: event.contaId,
        ocorrido_em: now.toISOString(),
        tela: event.tela,
        descricao: event.descricao,
        propriedades: { ambiente: process.env.VERCEL_ENV ?? "local", ...(event.propriedades ?? {}) },
      },
    ],
  };
}

// Envia um evento em segundo plano. Recebe: o evento. Devolve: nada.
export function track(event: ProductEvent): void {
  const key = process.env.VISAO_API_KEY;
  if (!key || process.env.VITEST || !event.contaId) return;
  const body = JSON.stringify(buildPayload(event));
  runAfterResponse(async () => {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key },
        body,
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) console.error("visao_produto_recusou", { evento: event.nome, status: res.status });
    } catch {
      console.error("visao_produto_indisponivel", { evento: event.nome });
    }
  });
}
