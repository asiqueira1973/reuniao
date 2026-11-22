// Tokens do MCP (plano 9.6): conferência do Bearer em /mcp e as conexões que o dono vê e revoga em
// Conta. Sempre por conta_id. Conta suspensa ou token revogado não passam.
import "server-only";
import { db } from "@/server/db/client";
import { hashSecret, MCP_TOKEN_PREFIX } from "./server";

export type McpCaller = { contaId: string; tokenId: string; cliente: string };

// Confere o cabeçalho Authorization. Devolve: quem chama, ou null (token ausente, desconhecido,
// revogado ou de conta suspensa). Marca o último uso no máximo uma vez por minuto.
export async function verifyMcpToken(header: string | null): Promise<McpCaller | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  const token = m?.[1];
  if (!token || !token.startsWith(MCP_TOKEN_PREFIX) || token.length > 200) return null;
  const { data, error } = await db()
    .from("ag_mcp_tokens")
    .select("id, conta_id, nome, revogado_em, ultimo_uso_em, ag_contas(suspensa_em)")
    .eq("token_hash", hashSecret(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revogado_em || !data.ag_contas || data.ag_contas.suspensa_em) return null;
  if (!data.ultimo_uso_em || Date.now() - new Date(data.ultimo_uso_em).getTime() > 60_000) {
    await db().from("ag_mcp_tokens").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", data.id);
  }
  return { contaId: data.conta_id, tokenId: data.id, cliente: data.nome };
}

export type McpConnection = { id: string; nome: string; criado_em: string; ultimo_uso_em: string | null };

// Conexões ativas da conta (Conta → Assistentes conectados), da mais recente para a mais antiga.
export async function listMcpConnections(contaId: string): Promise<McpConnection[]> {
  const { data, error } = await db()
    .from("ag_mcp_tokens")
    .select("id, nome, criado_em, ultimo_uso_em")
    .eq("conta_id", contaId)
    .is("revogado_em", null)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data;
}

// Revoga uma conexão da conta. Devolve: true se havia uma conexão ativa com esse id.
export async function revokeMcpConnection(contaId: string, id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("ag_mcp_tokens")
    .update({ revogado_em: new Date().toISOString() })
    .eq("conta_id", contaId)
    .eq("id", id)
    .is("revogado_em", null)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}
