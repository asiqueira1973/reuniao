// POST /oauth/registrar — RFC 7591, plano 9.6: registro dinâmico de cliente público (sem segredo).
// redirect_uris: 1 a 5, só https ou http em localhost/127.0.0.1. Resposta 201 com o client_id.
import { z } from "zod";
import { acceptableRedirectUri, corsHeaders, oauthError, oauthJson, registerClient } from "@/server/oauth/server";

const Body = z.object({
  redirect_uris: z.array(z.string()).min(1).max(5),
  client_name: z.string().trim().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return oauthError("invalid_client_metadata", "Envie redirect_uris (de 1 a 5) e, se quiser, client_name.");
  if (!parsed.data.redirect_uris.every(acceptableRedirectUri)) {
    return oauthError("invalid_redirect_uri", "Use endereços https (ou http só em localhost).");
  }
  const client = await registerClient(parsed.data.client_name ?? "Assistente", parsed.data.redirect_uris);
  return oauthJson(
    {
      client_id: client.id,
      client_name: client.nome,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    201,
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
