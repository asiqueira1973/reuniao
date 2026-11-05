// GET /api/painel/conta/slug-disponivel?slug= — checagem ao digitar o endereço (seção 13, 8.8).
// Devolve { disponivel }: false para formato inválido, reservado ou slug de outra conta.
import type { NextRequest } from "next/server";
import { isReservedAccountSlug, isValidSlug } from "@/lib/slug";
import { requireConta } from "@/server/auth/require-conta";
import { isSlugAvailable } from "@/server/db/account-settings";

// GET: confere formato, reservados e se outra conta já usa o slug.
export async function GET(req: NextRequest) {
  const account = await requireConta(req);
  if (account instanceof Response) return account;
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!isValidSlug(slug) || isReservedAccountSlug(slug)) return Response.json({ disponivel: false });
  return Response.json({ disponivel: await isSlugAvailable(account.id, slug) });
}
