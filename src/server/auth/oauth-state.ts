// Cookie curto com o state do OAuth (seção 6): HttpOnly, 10 min, só nas rotas /api/auth/google.
import "server-only";

export const OAUTH_STATE_COOKIE = "ag_oauth_state";
export const OAUTH_STATE_PATH = "/api/auth/google";
