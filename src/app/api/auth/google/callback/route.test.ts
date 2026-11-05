// Testes do callback do login (critérios do épico 8.1) com o Google simulado e o Supabase local.
// Cada teste usa um google_sub único e apaga as próprias contas no fim (o banco local é compartilhado).
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { decryptSecret } from "@/server/google/crypto";
import { verifySession } from "@/server/auth/session";
import { CALENDAR_SCOPES } from "@/server/google/oauth";

vi.mock("@/server/google/oauth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/google/oauth")>();
  return { ...original, exchangeCode: vi.fn(), verifyIdToken: vi.fn() };
});

const oauth = await import("@/server/google/oauth");
const { GET } = await import("./route");

const createdSubs: string[] = [];
const ALL_SCOPES = ["openid", "email", "profile", ...CALENDAR_SCOPES];

// Simula o Google devolvendo tokens e identidade.
function mockGoogle(opts: { sub: string; email?: string; scopes?: string[]; refreshToken?: string | null }) {
  createdSubs.push(opts.sub);
  vi.mocked(oauth.exchangeCode).mockResolvedValue({
    refreshToken: opts.refreshToken === undefined ? `1//refresh-${opts.sub}` : opts.refreshToken,
    idToken: "id-token-simulado",
    scopes: opts.scopes ?? ALL_SCOPES,
  });
  vi.mocked(oauth.verifyIdToken).mockResolvedValue({
    sub: opts.sub,
    email: opts.email ?? "dono.permitido@teste.dev",
    name: "Dono Permitido",
  });
}

// Monta a requisição de retorno do Google com state no cookie.
function callback(state = "estado-ok", cookieState = "estado-ok") {
  return new NextRequest(`http://localhost:3020/api/auth/google/callback?code=codigo&state=${state}`, {
    headers: { cookie: `ag_oauth_state=${cookieState}` },
  });
}

async function accountBySub(sub: string) {
  const { data } = await db().from("ag_contas").select("*").eq("google_sub", sub);
  return data ?? [];
}

beforeEach(() => vi.clearAllMocks());

afterAll(async () => {
  if (createdSubs.length) await db().from("ag_contas").delete().in("google_sub", createdSubs);
});

describe("GET /api/auth/google/callback (épico 8.1)", () => {
  it("state diferente do cookie → erro=falha sem chamar o Google", async () => {
    const res = await GET(callback("estado-ok", "outro"));
    expect(res.headers.get("location")).toBe("http://localhost:3020/entrar?erro=falha");
    expect(oauth.exchangeCode).not.toHaveBeenCalled();
  });

  it("e-mail fora de EMAILS_PERMITIDOS → erro=sem_acesso e nada gravado", async () => {
    const sub = `sub-${randomUUID()}`;
    mockGoogle({ sub, email: "estranho@teste.dev" });
    const res = await GET(callback());
    expect(res.headers.get("location")).toBe("http://localhost:3020/entrar?erro=sem_acesso");
    expect(await accountBySub(sub)).toHaveLength(0);
  });

  it("sem uma das permissões de agenda → erro=escopos e nada gravado", async () => {
    const sub = `sub-${randomUUID()}`;
    mockGoogle({ sub, scopes: ["openid", "email", "profile", CALENDAR_SCOPES[0]] });
    const res = await GET(callback());
    expect(res.headers.get("location")).toBe("http://localhost:3020/entrar?erro=escopos");
    expect(await accountBySub(sub)).toHaveLength(0);
  });

  it("sem refresh token → erro=falha", async () => {
    const sub = `sub-${randomUUID()}`;
    mockGoogle({ sub, refreshToken: null });
    const res = await GET(callback());
    expect(res.headers.get("location")).toBe("http://localhost:3020/entrar?erro=falha");
    expect(await accountBySub(sub)).toHaveLength(0);
  });

  it("primeiro login cria conta, conexão cifrada, faixas e tipo padrão, e abre a sessão", async () => {
    const sub = `sub-${randomUUID()}`;
    mockGoogle({ sub });
    const res = await GET(callback());
    expect(res.headers.get("location")).toBe("http://localhost:3020/painel/tipos");

    const [conta] = await accountBySub(sub);
    expect(conta).toBeDefined();
    expect(conta.email).toBe("dono.permitido@teste.dev");
    expect(conta.slug).toMatch(/^dono-permitido(-\d+)?$/);
    expect(conta.feriados_desligados.sort()).toEqual(["carnaval_segunda", "carnaval_terca", "cinzas", "corpus_christi"]);

    const { data: conexao } = await db().from("ag_conexoes_google").select("*").eq("conta_id", conta.id).single();
    expect(conexao!.refresh_token_cifrado).not.toContain("1//");
    expect(decryptSecret(conexao!.refresh_token_cifrado)).toBe(`1//refresh-${sub}`);
    expect(conexao!.status).toBe("ativa");

    const { data: faixas } = await db().from("ag_horarios_semanais").select("dia_semana, inicio, fim").eq("conta_id", conta.id);
    expect(faixas).toHaveLength(10);
    expect(faixas).toContainEqual({ dia_semana: 1, inicio: "10:30:00", fim: "12:00:00" });
    expect(faixas).toContainEqual({ dia_semana: 5, inicio: "14:30:00", fim: "18:00:00" });
    expect(faixas!.some((f) => f.dia_semana === 0 || f.dia_semana === 6)).toBe(false);

    const { data: tipos } = await db().from("ag_tipos_evento").select("nome, slug, duracao_min, com_meet").eq("conta_id", conta.id);
    expect(tipos).toEqual([{ nome: "Reunião de 30 minutos", slug: "reuniao-30-minutos", duracao_min: 30, com_meet: true }]);

    const cookie = res.cookies.get("ag_sessao");
    expect(cookie?.httpOnly).toBe(true);
    expect((await verifySession(cookie!.value))?.contaId).toBe(conta.id);
  });

  it("segundo login com o mesmo Google atualiza o token e não duplica a conta", async () => {
    const sub = `sub-${randomUUID()}`;
    mockGoogle({ sub });
    await GET(callback());
    mockGoogle({ sub, refreshToken: "1//token-novo" });
    const res = await GET(callback());
    expect(res.headers.get("location")).toBe("http://localhost:3020/painel/tipos");

    const contas = await accountBySub(sub);
    expect(contas).toHaveLength(1);
    const { data: conexao } = await db().from("ag_conexoes_google").select("refresh_token_cifrado").eq("conta_id", contas[0].id).single();
    expect(decryptSecret(conexao!.refresh_token_cifrado)).toBe("1//token-novo");
    const { count } = await db().from("ag_tipos_evento").select("id", { count: "exact", head: true }).eq("conta_id", contas[0].id);
    expect(count).toBe(1);
  });

  it("reconectar (critério 8.8): conexão revogada volta a ativa e libera um novo aviso", async () => {
    const sub = `sub-${randomUUID()}`;
    mockGoogle({ sub });
    await GET(callback());
    const [conta] = await accountBySub(sub);
    await db().from("ag_conexoes_google").update({ status: "revogada", revogada_em: new Date().toISOString(), aviso_reconectar_enviado: true }).eq("conta_id", conta.id);
    mockGoogle({ sub, refreshToken: "1//reconectado" });
    await GET(callback());
    const { data } = await db().from("ag_conexoes_google").select("status, revogada_em, aviso_reconectar_enviado").eq("conta_id", conta.id).single();
    expect(data).toEqual({ status: "ativa", revogada_em: null, aviso_reconectar_enviado: false });
  });
});
