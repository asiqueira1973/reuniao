// Guarda da gestão pelo convidado — seções 5, 6 e 11.7. O link /r/{token} é a única credencial
// do convidado: o servidor calcula o SHA-256 do token e procura a reserva pelo hash. A service
// role ignora RLS, então toda leitura de gestão passa por aqui (filtro por token_hash).
import "server-only";
import { db } from "@/server/db/client";
import { hashToken } from "@/server/booking";

export const MANAGE_COLUMNS =
  "id, conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, observacao, fuso_convidado, status, google_evento_id, link_meet, remarcada_de_id, ag_tipos_evento(nome, slug, duracao_min, com_meet), ag_contas(slug, nome_exibicao, email, fuso)" as const;

// Formato básico do token (43 caracteres base64url); outro formato nem consulta o banco.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Devolve a reserva do token (com tipo e conta) ou null se o token é inválido.
export async function requireReservaPorToken(token: string | undefined | null) {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const { data, error } = await db().from("ag_reservas").select(MANAGE_COLUMNS).eq("token_hash", hashToken(token)).maybeSingle();
  if (error) throw error;
  if (!data || !data.ag_contas || !data.ag_tipos_evento) return null;
  return data;
}

export type ManagedReservation = NonNullable<Awaited<ReturnType<typeof requireReservaPorToken>>>;
