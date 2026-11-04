// Gera src/server/db/types.ts a partir do Supabase local (seção 18: tipos espelham o banco).
// Recebe: nada (Supabase local rodando). Devolve: o arquivo com `import "server-only"` no topo,
// para manter a regra de que tudo em src/server/ só roda no servidor (seção 20).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const types = execSync("supabase gen types typescript --local --schema public", { encoding: "utf8" });
const header = `// Gerado por \`npm run db:types\` (supabase gen types). Não editar à mão.\nimport "server-only";\n\n`;
writeFileSync("src/server/db/types.ts", header + types);
console.log("src/server/db/types.ts atualizado");
