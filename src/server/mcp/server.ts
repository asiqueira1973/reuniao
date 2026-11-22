// Monta o servidor MCP de uma requisição (plano 9.6): o recurso do formulário e as ferramentas de
// leitura, de formulário e de gravação, todas presas à conta do token.
import "server-only";
import { McpServer } from "@modelcontextprotocol/server";
import { registerFormTools } from "./form-tools";
import { registerReadTools } from "./read-tools";
import { registerFormResource, type McpContext } from "./shared";
import { registerWriteTools } from "./write-tools";

export const SERVER_INFO = { name: "reuniao", version: "1.0.0" } as const;

export const INSTRUCTIONS =
  "Reunião é o agendador do dono desta conta (reuniao.app.br). Para criar ou mudar algo, prefira as ferramentas abrir_formulario_*: elas abrem um formulário para a pessoa conferir e salvar. Datas no formato AAAA-MM-DD; horários no fuso da conta (ver_conta). Para marcar, use um horário de horarios_livres. Não diga que algo foi gravado antes de o formulário ou a ferramenta de gravação confirmar.";

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  registerFormResource(server);
  registerReadTools(server, ctx);
  registerFormTools(server, ctx);
  registerWriteTools(server, ctx);
  return server;
}
