// Cliente do banco com service role — seção 4 ("acesso ao banco só pelo servidor").
// A service role ignora RLS: todo helper que usa este cliente filtra por conta_id da sessão
// ou por token_hash (seção 6). Nunca importar fora de src/server/.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type Db = SupabaseClient<Database>;

let client: Db | null = null;

// Devolve o cliente único do processo, sem sessão de usuário nem refresh automático.
export function db(): Db {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
