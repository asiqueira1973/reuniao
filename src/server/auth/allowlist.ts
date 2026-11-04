// Lista de e-mails que podem criar conta — seção 5 (EMAILS_PERMITIDOS, separada por vírgula).
import "server-only";

// Diz se o e-mail Google pode entrar. Recebe: e-mail e lista opcional (testes).
// Devolve: true se o e-mail (sem diferença de maiúsculas/espaços) está na lista.
export function isEmailAllowed(email: string, raw = process.env.EMAILS_PERMITIDOS ?? ""): boolean {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}
