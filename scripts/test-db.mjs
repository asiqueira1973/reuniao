// Roda os testes de banco (pgTAP) no Supabase local — seção 22 e 22.1.
// Recebe: nada. Devolve: código de saída 0 se todos os testes passarem.
// Sobe o Supabase local se ele não estiver rodando; sem testes em supabase/tests, apenas avisa.
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const testsDir = "supabase/tests";
const hasTests = existsSync(testsDir) && readdirSync(testsDir, { recursive: true }).some((f) => String(f).endsWith(".sql"));
if (!hasTests) {
  console.log("test:db — nenhum teste em supabase/tests ainda (pulado).");
  process.exit(0);
}
try {
  execSync("supabase status", { stdio: "ignore" });
} catch {
  console.log("test:db — subindo Supabase local…");
  execSync("supabase start", { stdio: "inherit" });
}
// Aplica migrations pendentes sem apagar dados de desenvolvimento; os testes pgTAP rodam em
// transação com rollback e o teste de concorrência usa marcas próprias.
execSync("supabase migration up --local", { stdio: "inherit" });
execSync("supabase test db", { stdio: "inherit" });
