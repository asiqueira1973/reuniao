// GET /api/auth/google/callback — retorno do Google (seção 6, tabela 13, critérios 8.1).
// Confere o state, troca o código, valida o id_token, aplica as regras de acesso (v0.5, 8.10:
// lista opcional de permitidos, bloqueados e limite diário de contas novas) e a exigência das duas
// permissões de agenda, cifra o refresh token (11.10), cria ou atualiza a conta (11.9) e abre a
// sessão. Erros voltam para /entrar?erro=sem_acesso|cadastros_pausados|escopos|falha.
// Nunca registra e-mail nem token em log (seção 20).
import { NextResponse, type NextRequest } from "next/server";
import { dailySignupLimit, isEmailAllowed, isEmailBlocked } from "@/server/auth/allowlist";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_PATH } from "@/server/auth/oauth-state";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/server/auth/session";
import { accountExistsForGoogle, countAccountsCreatedSince, upsertAccountFromGoogle } from "@/server/db/accounts";
import { encryptSecret } from "@/server/google/crypto";
import { exchangeCode, hasCalendarScopes, verifyIdToken } from "@/server/google/oauth";

// Redireciona para /entrar com o código de erro e apaga o cookie de state.
function fail(req: NextRequest, code: "sem_acesso" | "cadastros_pausados" | "escopos" | "falha") {
  const res = NextResponse.redirect(new URL(`/entrar?erro=${code}`, req.url), 302);
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: OAUTH_STATE_PATH });
  return res;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return fail(req, "falha");

  try {
    const tokens = await exchangeCode(code);
    const identity = await verifyIdToken(tokens.idToken);
    // Seção 6 (v0.5): lista opcional de permitidos e bloqueados; nada é gravado antes disso.
    if (!isEmailAllowed(identity.email) || isEmailBlocked(identity.email)) return fail(req, "sem_acesso");
    // Freio de cadastro: conta nova só se o limite das últimas 24 h não foi atingido.
    if (!(await accountExistsForGoogle(identity.sub))) {
      const recent = await countAccountsCreatedSince(new Date(Date.now() - 24 * 3600_000));
      if (recent >= dailySignupLimit()) return fail(req, "cadastros_pausados");
    }
    // Seção 6: o Google deixa desmarcar permissões; sem as duas de agenda não há conta.
    if (!hasCalendarScopes(tokens.scopes)) return fail(req, "escopos");
    if (!tokens.refreshToken) return fail(req, "falha");

    const { contaId } = await upsertAccountFromGoogle({
      sub: identity.sub,
      email: identity.email,
      name: identity.name,
      encryptedRefreshToken: encryptSecret(tokens.refreshToken),
      scopes: tokens.scopes,
    });

    const res = NextResponse.redirect(new URL("/painel/tipos", req.url), 302);
    res.cookies.set(SESSION_COOKIE, await signSession(contaId), sessionCookieOptions());
    res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: OAUTH_STATE_PATH });
    return res;
  } catch (e) {
    console.error("auth_callback_falhou", e instanceof Error ? e.message : "erro");
    return fail(req, "falha");
  }
}
