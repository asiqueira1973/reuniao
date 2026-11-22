// GET /.well-known/oauth-protected-resource (e /…/mcp) — RFC 9728, plano 9.6: diz ao cliente MCP
// qual é o recurso e onde autorizar. Sem autenticação.
import { corsHeaders, mcpResource, oauthJson, siteOrigin } from "@/server/oauth/server";

export function GET() {
  return oauthJson({
    resource: mcpResource(),
    authorization_servers: [siteOrigin()],
    bearer_methods_supported: ["header"],
    resource_name: "Reunião",
    resource_documentation: `${siteOrigin()}/`,
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
