// /mcp — servidor MCP do Reunião por Streamable HTTP, sem estado (plano 9.6): um McpServer por
// requisição, preso à conta do token. Bearer: o token `reuniao_mcp_…` do OAuth. Sem credencial
// válida: 401 com WWW-Authenticate apontando os metadados do recurso (RFC 9728), exposto pelo
// CORS; é o que faz o "adicionar conector" do Claude e do ChatGPT achar o OAuth sozinho.
import { createMcpHandler, type AuthInfo } from "@modelcontextprotocol/server";
import { buildMcpServer } from "@/server/mcp/server";
import { verifyMcpToken } from "@/server/oauth/tokens";
import { corsHeaders, resourceMetadataUrl } from "@/server/oauth/server";

export const maxDuration = 60;

const handler = createMcpHandler(({ authInfo }) => {
  const extra = authInfo?.extra as { contaId?: string; cliente?: string } | undefined;
  if (!extra?.contaId) throw new Error("sem_conta");
  return buildMcpServer({ contaId: extra.contaId, cliente: extra.cliente ?? "Assistente" });
});

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function handle(req: Request): Promise<Response> {
  const caller = await verifyMcpToken(req.headers.get("authorization"));
  if (!caller) {
    return withCors(
      new Response(JSON.stringify({ error: "invalid_token", error_description: "Conecte o Reunião pelo assistente para obter um token." }), {
        status: 401,
        headers: { "content-type": "application/json", "www-authenticate": `Bearer resource_metadata="${resourceMetadataUrl()}"` },
      }),
    );
  }
  const authInfo: AuthInfo = {
    token: "redacted",
    clientId: caller.tokenId,
    scopes: [],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: { contaId: caller.contaId, cliente: caller.cliente },
  };
  return withCors(await handler.fetch(req, { authInfo }));
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
