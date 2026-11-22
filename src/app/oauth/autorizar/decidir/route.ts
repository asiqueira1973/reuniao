// POST /oauth/autorizar/decidir — a decisão da tela de autorização (plano 9.6). Exige sessão e
// Origin do site (requireConta) e o primeiro acesso concluído. Confere o pedido de novo (o
// formulário pode ter sido mexido). "Permitir" grava o código (10 min, PKCE) e volta com
// ?code&state; "Cancelar" volta com ?error=access_denied&state. Pedido inválido → 400.
import { NextResponse, type NextRequest } from "next/server";
import { requireConta } from "@/server/auth/require-conta";
import { checkAuthorizeParams, withParams } from "@/server/oauth/authorize";
import { createAuthorizationCode } from "@/server/oauth/server";

export async function POST(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  if (!account.termsAcceptedAt) return Response.json({ error: "access_denied" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const p = Object.fromEntries([...(form?.entries() ?? [])].map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
  const check = await checkAuthorizeParams(p);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  const { client, redirectUri, codeChallenge, state } = check.req;
  if (p.decisao !== "permitir") {
    return NextResponse.redirect(withParams(redirectUri, { error: "access_denied", ...(state ? { state } : {}) }), 303);
  }
  const code = await createAuthorizationCode(client, account.id, redirectUri, codeChallenge);
  return NextResponse.redirect(withParams(redirectUri, { code, ...(state ? { state } : {}) }), 303);
}
