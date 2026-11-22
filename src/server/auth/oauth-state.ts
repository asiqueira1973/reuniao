// Cookie curto com o state do OAuth (seção 6): HttpOnly, 10 min, só nas rotas /api/auth/google.
import "server-only";

export const OAUTH_STATE_COOKIE = "ag_oauth_state";
export const OAUTH_STATE_PATH = "/api/auth/google";

// Para onde voltar depois do login (plano 9.6): só a tela de autorização do MCP, para o login
// nunca virar redirecionador aberto. Cookie curto no mesmo caminho do state.
export const LOGIN_RETURN_COOKIE = "ag_login_volta";

// Diz se o caminho de volta é aceito. Recebe: o valor de ?volta=. Devolve: true só para
// /oauth/autorizar?…
export function isSafeReturnPath(path: string | null | undefined): path is string {
  return typeof path === "string" && path.length <= 2000 && path.startsWith("/oauth/autorizar?") && !path.includes("//");
}
