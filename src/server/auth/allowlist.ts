// Quem pode entrar no painel — seção 6 (v0.5, épico 8.10).
// EMAILS_PERMITIDOS (opcional): se definida, só os e-mails da lista entram (dev e testes).
// Vazia ou ausente: cadastro aberto a qualquer conta Google. EMAILS_BLOQUEADOS barra abuso.
import "server-only";

// Separa a lista "a@b, c@d" em e-mails minúsculos.
function parseList(raw: string): string[] {
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Diz se o e-mail Google pode entrar. Recebe: e-mail e a lista (padrão: EMAILS_PERMITIDOS).
// Devolve: true com lista vazia (cadastro aberto) ou se o e-mail estiver nela.
export function isEmailAllowed(email: string, raw = process.env.EMAILS_PERMITIDOS ?? ""): boolean {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;
  const list = parseList(raw);
  return list.length === 0 || list.includes(wanted);
}

// Diz se o e-mail está em EMAILS_BLOQUEADOS (sem diferença de maiúsculas e espaços).
export function isEmailBlocked(email: string, raw = process.env.EMAILS_BLOQUEADOS ?? ""): boolean {
  return parseList(raw).includes(email.trim().toLowerCase());
}

// Limite de contas novas nas últimas 24 h (CONTAS_NOVAS_POR_DIA, padrão 50).
export function dailySignupLimit(raw = process.env.CONTAS_NOVAS_POR_DIA): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && raw !== undefined && raw !== "" ? n : 50;
}
