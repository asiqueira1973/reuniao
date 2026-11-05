// npm run seed:calendly -- <email> [--slug <slug>]
// Grava na conta existente os tipos de evento do Calendly (regra 11.9) e, opcionalmente, troca o
// endereço público da conta (pergunta 25.2). Usa SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY do
// .env.local (local) ou das variáveis do ambiente (remoto). Não cria conta: ela nasce no login.
import { createClient } from "@supabase/supabase-js";
import { seedCalendlyTypes } from "../src/features/event-types/calendly-seed";
import { isReservedAccountSlug, isValidSlug } from "../src/lib/slug";

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"))?.toLowerCase();
  const slugIdx = args.indexOf("--slug");
  const slug = slugIdx >= 0 ? args[slugIdx + 1] : undefined;
  if (!email) throw new Error("uso: npm run seed:calendly -- <email> [--slug <slug>]");
  if (slug && (!isValidSlug(slug) || isReservedAccountSlug(slug))) throw new Error(`slug inválido: ${slug}`);

  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: conta, error } = await client.from("ag_contas").select("id, slug").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!conta) throw new Error("conta não encontrada: entre com o Google uma vez antes de rodar o seed");

  if (slug && slug !== conta.slug) {
    const { error: e } = await client.from("ag_contas").update({ slug }).eq("id", conta.id);
    if (e) throw new Error(e.code === "23505" ? `slug já em uso: ${slug}` : e.message);
    console.log(`endereço: /${conta.slug} → /${slug}`);
  }
  const created = await seedCalendlyTypes(client, conta.id);
  console.log(created.length ? `tipos criados: ${created.join(", ")}` : "nenhum tipo novo (já estavam lá)");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
