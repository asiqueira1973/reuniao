// Status HTTP dos erros das ações do dono (seção 13).
import "server-only";
import type { OwnerErrorCode } from "./owner-actions";

export const OWNER_STATUS: Record<OwnerErrorCode, number> = {
  nao_encontrado: 404,
  transicao_invalida: 409,
  reuniao_iniciada: 409,
  limite_tentativas: 409,
  servico_indisponivel: 503,
  agenda_indisponivel: 503,
};
