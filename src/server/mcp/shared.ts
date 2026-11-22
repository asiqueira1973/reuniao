// Base das ferramentas do MCP (plano 9.6): contexto da conta, registro com anotações e respostas.
// Toda ferramenta age só sobre a conta do token (nunca recebe conta por argumento), tem título e
// as dicas de leitura/escrita (readOnlyHint/destructiveHint) e openWorldHint: false.
import "server-only";
import { createHash } from "node:crypto";
import { TZDate } from "@date-fns/tz";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { z } from "zod";
import { apiErrorText } from "@/lib/copy";
import type { Formulario, RespostaDoSalvar } from "@/mcp-ui/spec";
import { getAccountSettings, type AccountSettings } from "@/server/db/account-settings";
import { siteOrigin } from "@/server/oauth/server";
import { FORM_HTML } from "./ui-html.generated";

export type McpContext = { contaId: string; cliente: string };

// Endereço do formulário versionado pelo conteúdo (o Claude guarda o HTML por endereço).
export const FORM_URI = `ui://reuniao/formulario-${createHash("sha256").update(FORM_HTML).digest("hex").slice(0, 12)}.html`;

// Registra o HTML do formulário como recurso MCP Apps. Sem _meta.ui.csp: vale o CSP padrão
// (sem rede); o formulário fala com o servidor só por callServerTool.
export function registerFormResource(server: McpServer): void {
  registerAppResource(server, "Formulário do Reunião", FORM_URI, { mimeType: RESOURCE_MIME_TYPE, description: "Formulário do Reunião" }, async () => ({
    contents: [{ uri: FORM_URI, mimeType: RESOURCE_MIME_TYPE, text: FORM_HTML }],
  }));
}

type ToolResult = { content: Array<{ type: "text"; text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean };
type Handler<S extends z.ZodType> = (args: z.infer<S>) => Promise<ToolResult>;

// Ferramenta comum (leitura ou escrita). escrita = cria, altera ou apaga (pede confirmação no host).
export function tool<S extends z.ZodType>(
  server: McpServer,
  name: string,
  cfg: { title: string; description: string; input: S; escrita: boolean },
  handler: Handler<S>,
): void {
  server.registerTool(
    name,
    {
      title: cfg.title,
      description: cfg.description,
      inputSchema: cfg.input,
      annotations: { title: cfg.title, readOnlyHint: !cfg.escrita, destructiveHint: cfg.escrita, openWorldHint: false },
    },
    (async (args: z.infer<S>) => {
      try {
        return await handler(args);
      } catch (e) {
        console.error("mcp_ferramenta_falhou", { ferramenta: name, erro: e instanceof Error ? e.message.slice(0, 80) : "erro" });
        return erro("Não consegui fazer isso agora. Tente de novo em instantes.");
      }
    }) as never,
  );
}

// Ferramenta que abre o formulário (MCP App). Não grava nada: é leitura.
export function formTool<S extends z.ZodType>(
  server: McpServer,
  name: string,
  cfg: { title: string; description: string; input: S },
  handler: (args: z.infer<S>) => Promise<Formulario | ToolResult>,
): void {
  registerAppTool(
    server,
    name,
    {
      title: cfg.title,
      description: `${cfg.description} Não grava nada: a pessoa confere e clica no botão do formulário. Se ela fechar sem salvar, nada é gravado; não diga que foi gravado antes do formulário confirmar.`,
      inputSchema: cfg.input,
      annotations: { title: cfg.title, readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: FORM_URI } },
    },
    (async (args: z.infer<S>) => {
      try {
        const r = await handler(args);
        if ("content" in r) return r;
        return { content: [{ type: "text", text: `Formulário "${r.titulo}" aberto. Nada foi gravado ainda.` }], structuredContent: r };
      } catch (e) {
        console.error("mcp_formulario_falhou", { ferramenta: name, erro: e instanceof Error ? e.message.slice(0, 80) : "erro" });
        return erro("Não consegui abrir o formulário agora. Tente de novo em instantes.");
      }
    }) as never,
  );
}

// Resposta de leitura: texto para o modelo e os dados estruturados.
export function ok(texto: string, dados: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text: texto }], structuredContent: dados };
}

export function erro(texto: string): ToolResult {
  return { content: [{ type: "text", text: texto }], isError: true };
}

// Resposta de gravação no formato que o formulário entende (RespostaDoSalvar).
export function salvo(resp: RespostaDoSalvar): ToolResult {
  const texto = resp.ok ? resp.resumo : resp.erros.map((e) => (e.campo ? `${e.campo}: ${e.mensagem}` : e.mensagem)).join("\n");
  return { content: [{ type: "text", text: texto }], structuredContent: resp as unknown as Record<string, unknown>, isError: !resp.ok };
}

// Falha com código de negócio (seção 13), traduzido pelo copy.ts.
export function falha(codigo: string, campo: string | null = null): ToolResult {
  return salvo({ ok: false, erros: [{ campo, mensagem: apiErrorText(codigo) }] });
}

// Erros de validação do zod por campo (o primeiro nível do caminho).
export function falhaDeValidacao(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): ToolResult {
  const erros = issues.slice(0, 10).map((i) => {
    const campo = typeof i.path[0] === "string" ? i.path[0] : null;
    const msg = i.message === "faixa_sobreposta" || i.message === "slug_reservado" ? apiErrorText(i.message) : "Confira este campo.";
    return { campo, mensagem: msg };
  });
  return salvo({ ok: false, erros: erros.length ? erros : [{ campo: null, mensagem: apiErrorText("dados_invalidos") }] });
}

// Configurações da conta do token (lança se a conta sumiu).
export async function conta(ctx: McpContext): Promise<AccountSettings> {
  const c = await getAccountSettings(ctx.contaId);
  if (!c) throw new Error("conta_nao_encontrada");
  return c;
}

export const paginaPublica = (slug: string) => `${siteOrigin()}/${slug}`;

// Data local (AAAA-MM-DD) de hoje no fuso.
export function hojeNo(fuso: string, agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

// Início (00:00) de uma data local no fuso, em ISO.
export function inicioDoDia(data: string, fuso: string): string {
  const [y, m, d] = data.split("-").map(Number);
  return new TZDate(y!, m! - 1, d!, 0, 0, 0, fuso).toISOString();
}

// Soma dias a uma data AAAA-MM-DD.
export function somarDias(data: string, dias: number): string {
  const t = new Date(`${data}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

// "terça-feira, 24 de novembro, 14:30" no fuso.
export function quando(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function hora(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
