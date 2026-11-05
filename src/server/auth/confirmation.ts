// Cookie curto da tela "Reunião marcada" — seção 10 ([Convidado] Confirmado).
// Logo depois de reservar, o navegador do convidado recebe ag_confirmacao (JWT de 30 min com o id
// da reserva). A tela de confirmado só mostra detalhes se o cookie bater com ?r=, para que o id na
// URL sozinho não exponha a reserva de ninguém.
import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const CONFIRMATION_COOKIE = "ag_confirmacao";
const MAX_AGE_S = 30 * 60;

// Chave derivada do SESSION_SECRET (mesmo segredo da sessão do dono, outra finalidade).
function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET ausente ou curto (mín. 32 caracteres)");
  return new TextEncoder().encode(`${secret}:confirmacao`);
}

// Assina o cookie para uma reserva.
export async function signConfirmation(reservaId: string): Promise<string> {
  return new SignJWT({ r: reservaId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE_S}s`).sign(key());
}

// Diz se o cookie vale para a reserva indicada.
export async function confirmationMatches(cookie: string | undefined, reservaId: string): Promise<boolean> {
  if (!cookie) return false;
  const k = key();
  try {
    const { payload } = await jwtVerify(cookie, k, { algorithms: ["HS256"] });
    return payload.r === reservaId;
  } catch {
    return false;
  }
}

// Opções do cookie: HttpOnly, SameSite=Lax, Secure em produção, 30 min.
export function confirmationCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE_S };
}
