// Cifra do refresh token do Google — regra 11.10.
// AES-256-GCM com TOKEN_ENC_KEY (32 bytes em base64) e IV aleatório de 12 bytes por gravação.
// Formato gravado em ag_conexoes_google.refresh_token_cifrado: "iv.tag.cifra" em base64url.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Lê e valida a chave. Recebe: valor opcional (testes). Devolve: Buffer de 32 bytes.
function loadKey(raw = process.env.TOKEN_ENC_KEY): Buffer {
  if (!raw) throw new Error("TOKEN_ENC_KEY ausente");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENC_KEY precisa ter 32 bytes em base64");
  return key;
}

// Cifra um texto (o refresh token). Recebe: texto puro. Devolve: "iv.tag.cifra".
export function encryptSecret(plain: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(rawKey), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64url")).join(".");
}

// Decifra o formato "iv.tag.cifra". Lança erro se a chave ou o texto tiverem sido alterados.
export function decryptSecret(payload: string, rawKey?: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("segredo cifrado em formato inválido");
  const decipher = createDecipheriv("aes-256-gcm", loadKey(rawKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
