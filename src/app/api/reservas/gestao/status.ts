// Status HTTP de cada código de erro da gestão (seção 13).
import type { ManageErrorCode } from "@/server/manage";

export const MANAGE_STATUS: Record<ManageErrorCode, number> = {
  nao_encontrado: 404,
  transicao_invalida: 409,
  reuniao_iniciada: 409,
  horario_indisponivel: 409,
  servico_indisponivel: 503,
  agenda_indisponivel: 503,
};
