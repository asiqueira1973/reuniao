// Contas do dono e conexão Google — seções 5, 6 e regra 11.9.
// Fronteira de idioma: nomes do banco em português ficam só aqui dentro.
import "server-only";
import { DEFAULT_DISABLED_HOLIDAYS } from "@/features/availability/holidays";
import { isReservedAccountSlug, normalizeSlug, slugCandidates } from "@/lib/slug";
import { db } from "./client";

export type Account = {
  id: string;
  email: string;
  displayName: string;
  slug: string;
};

// Faixas da conta nova (regra 11.9): seg a sex, 10:30–12:00 e 14:30–18:00.
export const DEFAULT_WEEKLY_RANGES = [1, 2, 3, 4, 5].flatMap((dia_semana) => [
  { dia_semana, inicio: "10:30", fim: "12:00" },
  { dia_semana, inicio: "14:30", fim: "18:00" },
]);

// Tipo de evento da conta nova (regra 11.9); os outros campos ficam com os defaults de 7.3.
export const DEFAULT_EVENT_TYPE = { nome: "Reunião de 30 minutos", slug: "reuniao-30-minutos", duracao_min: 30 };

type GoogleLogin = {
  sub: string;
  email: string;
  name: string;
  encryptedRefreshToken: string;
  scopes: string[];
};

// Lê a conta pelo id da sessão. Devolve: a conta ou null se não existir mais.
export async function getAccountById(contaId: string): Promise<Account | null> {
  const { data, error } = await db()
    .from("ag_contas")
    .select("id, email, nome_exibicao, slug")
    .eq("id", contaId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, email: data.email, displayName: data.nome_exibicao, slug: data.slug } : null;
}

// Escolhe o slug sugerido da conta nova (regra 11.9): parte local do e-mail normalizada; se
// ocupada ou reservada, acrescenta -2, -3… Devolve: primeiro candidato livre.
async function pickFreeAccountSlug(email: string): Promise<string> {
  const candidates = slugCandidates(normalizeSlug(email.split("@")[0])).filter((s) => !isReservedAccountSlug(s));
  const { data, error } = await db().from("ag_contas").select("slug").in("slug", candidates);
  if (error) throw error;
  const taken = new Set((data ?? []).map((r) => r.slug));
  const free = candidates.find((c) => !taken.has(c));
  if (!free) throw new Error("sem_slug_livre");
  return free;
}

// Cria a conta no primeiro login ou atualiza o token no login seguinte (critérios 8.1).
// Conta nova recebe: slug sugerido, feriados padrão (11.4), faixas e tipo padrão (11.9).
// Recebe: identidade Google, refresh token já cifrado e escopos. Devolve: id da conta e se é nova.
export async function upsertAccountFromGoogle(login: GoogleLogin): Promise<{ contaId: string; created: boolean }> {
  const client = db();
  const { data: existing, error: findError } = await client
    .from("ag_contas")
    .select("id")
    .eq("google_sub", login.sub)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    // Login seguinte: guarda o token novo (o Google pode invalidar o antigo, risco 23.9) e
    // volta a conexão para ativa (reconectar, épico 8.8).
    const { error } = await client.from("ag_conexoes_google").upsert({
      conta_id: existing.id,
      refresh_token_cifrado: login.encryptedRefreshToken,
      escopos: login.scopes,
      status: "ativa",
      revogada_em: null,
      aviso_reconectar_enviado: false,
    });
    if (error) throw error;
    // O e-mail de avisos acompanha o e-mail atual da conta Google.
    const { error: emailError } = await client.from("ag_contas").update({ email: login.email }).eq("id", existing.id);
    if (emailError) throw emailError;
    return { contaId: existing.id, created: false };
  }

  const slug = await pickFreeAccountSlug(login.email);
  const { data: conta, error: createError } = await client
    .from("ag_contas")
    .insert({
      google_sub: login.sub,
      email: login.email,
      nome_exibicao: login.name.slice(0, 100),
      slug,
      feriados_desligados: DEFAULT_DISABLED_HOLIDAYS,
    })
    .select("id")
    .single();
  if (createError) throw createError;

  try {
    const steps = await Promise.all([
      client.from("ag_conexoes_google").insert({
        conta_id: conta.id,
        refresh_token_cifrado: login.encryptedRefreshToken,
        escopos: login.scopes,
      }),
      client.rpc("ag_fn_substitui_horarios", { p_conta_id: conta.id, p_faixas: DEFAULT_WEEKLY_RANGES }),
      client.from("ag_tipos_evento").insert({ conta_id: conta.id, ...DEFAULT_EVENT_TYPE }),
    ]);
    const failed = steps.find((s) => s.error);
    if (failed?.error) throw failed.error;
  } catch (e) {
    // Sem conta pela metade: desfaz tudo (a cascata leva o que já foi gravado).
    await client.from("ag_contas").delete().eq("id", conta.id);
    throw e;
  }
  return { contaId: conta.id, created: true };
}

// Diz se já existe conta para este login Google (o limite diário só vale para conta nova, 8.10).
export async function accountExistsForGoogle(sub: string): Promise<boolean> {
  const { data, error } = await db().from("ag_contas").select("id").eq("google_sub", sub).maybeSingle();
  if (error) throw error;
  return !!data;
}

// Conta as contas criadas desde um instante (freio de cadastro do épico 8.10).
export async function countAccountsCreatedSince(since: Date): Promise<number> {
  const { count, error } = await db().from("ag_contas").select("id", { count: "exact", head: true }).gte("criado_em", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}
