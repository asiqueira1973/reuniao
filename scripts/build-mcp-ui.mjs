// Monta o formulário do MCP (plano 9.6): empacota src/mcp-ui/form.ts (com o cliente do ext-apps)
// num HTML único e grava src/server/mcp/ui-html.generated.ts (fora do git). Roda antes do
// typecheck, dos testes e do build. Falha acima de 800 KB (o zod que o cliente do ext-apps
// puxa pesa ~440 KB com o esbuild; ver plans/9.6-mcp.md).
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const LIMITE = 800 * 1024;
const out = await build({
  entryPoints: ["src/mcp-ui/form.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  write: false,
  legalComments: "none",
});
const js = out.outputFiles[0].text.replaceAll("</script", "<\\/script");
const css = readFileSync("src/mcp-ui/form.css", "utf8");
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reunião</title><style>${css}</style></head><body><main id="app"></main><script>${js}</script></body></html>`;
const bytes = Buffer.byteLength(html);
if (bytes > LIMITE) {
  console.error(`formulário do MCP: ${bytes} bytes, acima de ${LIMITE}.`);
  process.exit(1);
}
writeFileSync(
  "src/server/mcp/ui-html.generated.ts",
  `// GERADO por scripts/build-mcp-ui.mjs a partir de src/mcp-ui/. Não edite.\nexport const FORM_HTML: string = ${JSON.stringify(html)};\n`,
);
console.log(`formulário do MCP: ${(bytes / 1024).toFixed(1)} KB`);
