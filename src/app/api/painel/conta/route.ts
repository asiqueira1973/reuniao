// /api/painel/conta — configurações da conta do dono (seção 13, épico 8.8).
// GET: configurações + situação da conexão. PATCH: nome, slug, mensagem, fuso (200 · 409
// slug_em_uso · 422 slug_reservado/dados_invalidos). DELETE { confirmacao: slug }: revoga o token
// no Google, apaga a conta em cascata e encerra a sessão (200 · 422 confirmacao_invalida).
import { NextResponse, type NextRequest } from "next/server";
import { accountDeleteSchema, accountPatchSchema } from "@/features/account/schema";
import { requireConta } from "@/server/auth/require-conta";
import { SESSION_COOKIE } from "@/server/auth/session";
import { AccountError, deleteAccount, getAccountSettings, updateAccountSettings } from "@/server/db/account-settings";
import { apiError, parseBody } from "@/server/http";

const STATUS: Record<AccountError["code"], number> = { slug_em_uso: 409, confirmacao_invalida: 422, nao_encontrado: 404 };

// GET: lê as configurações da conta da sessão.
export async function GET(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const conta = await getAccountSettings(account.id);
  if (!conta) return apiError("nao_encontrado", 404);
  return Response.json({ conta });
}

// PATCH: atualiza os campos enviados (schema sem padrões).
export async function PATCH(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, accountPatchSchema);
  if (body instanceof Response) return body;
  try {
    return Response.json({ conta: await updateAccountSettings(account.id, body) });
  } catch (e) {
    if (e instanceof AccountError) return apiError(e.code, STATUS[e.code]);
    throw e;
  }
}

// DELETE: exclui a conta (confirmação = slug) e apaga o cookie de sessão.
export async function DELETE(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const body = await parseBody(req, accountDeleteSchema);
  if (body instanceof Response) return body;
  try {
    await deleteAccount(account.id, body.confirmacao);
  } catch (e) {
    if (e instanceof AccountError) return apiError(e.code, STATUS[e.code]);
    throw e;
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}
