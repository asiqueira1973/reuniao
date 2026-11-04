// Ambiente dos testes Vitest (seção 22): aponta para o Supabase local (portas 554xx) e define
// segredos descartáveis. A chave de serviço local é lida do `supabase status` (não fica no git).
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

function localSupabaseEnv(): Record<string, string> {
  try {
    const out = execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return Object.fromEntries(
      out.split("\n").map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
    );
  } catch {
    return {};
  }
}

const local = localSupabaseEnv();
process.env.SUPABASE_URL = local.API_URL ?? "http://127.0.0.1:55421";
process.env.SUPABASE_SERVICE_ROLE_KEY = local.SERVICE_ROLE_KEY ?? "";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3020";
process.env.GOOGLE_CLIENT_ID = "client-teste.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "segredo-teste";
process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
process.env.EMAILS_PERMITIDOS = "dono.permitido@teste.dev, outro@teste.dev";

// Espera o Supabase local responder antes dos testes (até 60 s). Logo depois do `test:db`, a
// primeira conexão do host com o Docker chega a levar ~20 s; sem isso o primeiro teste de rota
// estoura o tempo por causa do ambiente, não do código.
async function waitForLocalSupabase(timeoutMs = 60000): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/ag_contas?select=id&limit=1`, {
        headers: { apikey: key, authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) return;
    } catch {
      // tenta de novo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

await waitForLocalSupabase();
