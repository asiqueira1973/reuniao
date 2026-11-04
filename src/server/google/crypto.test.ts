// Testes da regra 11.10 (cifra do refresh token).
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const key = randomBytes(32).toString("base64");

describe("encryptSecret / decryptSecret (regra 11.10)", () => {
  it("ida e volta devolve o texto original e não o deixa em claro", () => {
    const token = "1//0gExemploDeRefreshToken";
    const enc = encryptSecret(token, key);
    expect(enc).not.toContain("1//");
    expect(enc.split(".")).toHaveLength(3);
    expect(decryptSecret(enc, key)).toBe(token);
  });
  it("usa IV novo a cada gravação", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });
  it("recusa texto adulterado ou chave errada", () => {
    const enc = encryptSecret("segredo", key);
    const [iv, tag, data] = enc.split(".");
    const tampered = [iv, tag, Buffer.from("outra coisa").toString("base64url")].join(".");
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(`${iv}.${tag}.${data}`, randomBytes(32).toString("base64"))).toThrow();
  });
  it("recusa chave com tamanho errado", () => {
    expect(() => encryptSecret("x", Buffer.from("curta").toString("base64"))).toThrow(/32 bytes/);
  });
});
