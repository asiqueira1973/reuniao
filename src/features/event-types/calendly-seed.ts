// Seed dos tipos de evento do Calendly — regra 11.9 (tabela do seed:calendly) e assunção 24.4.
// Idempotente por slug: tipo já existente (não excluído) não é duplicado nem alterado; só a
// ordem segue a tabela. Recebe o cliente do banco por parâmetro para rodar no script e nos testes.
import type { SupabaseClient } from "@supabase/supabase-js";

// Tabela da regra 11.9, na ordem em que aparecem no Calendly. "Reunião de 2h" com 120 min (24.4).
export const CALENDLY_TYPES = [
  { nome: "Entrevistas", slug: "entrevistas", duracao_min: 60 },
  { nome: "Reunião de 2h", slug: "reuniao-2h", duracao_min: 120 },
  { nome: "Reunião de 1,5h", slug: "reuniao-1-5h", duracao_min: 90 },
  { nome: "Reunião de 1h", slug: "reuniao-1h", duracao_min: 60 },
  { nome: "Reunião de 30 minutos", slug: "reuniao-30-minutos", duracao_min: 30 },
] as const;

// Grava os tipos que faltam na conta e ajusta a ordem. Devolve os slugs criados.
export async function seedCalendlyTypes(client: SupabaseClient, contaId: string): Promise<string[]> {
  const { data: existing, error } = await client
    .from("ag_tipos_evento")
    .select("id, slug")
    .eq("conta_id", contaId)
    .is("excluido_em", null);
  if (error) throw error;
  const bySlug = new Map((existing ?? []).map((r: { id: string; slug: string }) => [r.slug, r.id]));

  const created: string[] = [];
  for (const [ordem, t] of CALENDLY_TYPES.entries()) {
    const id = bySlug.get(t.slug);
    if (id) {
      const { error: e } = await client.from("ag_tipos_evento").update({ ordem }).eq("id", id).eq("conta_id", contaId);
      if (e) throw e;
    } else {
      const { error: e } = await client.from("ag_tipos_evento").insert({ ...t, conta_id: contaId, ordem });
      if (e) throw e;
      created.push(t.slug);
    }
  }
  return created;
}
