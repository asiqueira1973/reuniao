// Testes da sessão (seção 6).
import { describe, expect, it } from "vitest";
import { shouldRenew, signSession, verifySession } from "./session";

const secret = "s".repeat(40);
const other = "o".repeat(40);

describe("sessão (seção 6)", () => {
  it("assina e lê a conta", async () => {
    const jwt = await signSession("conta-1", new Date(), secret);
    expect(await verifySession(jwt, secret)).toMatchObject({ contaId: "conta-1" });
  });
  it("recusa assinatura de outro segredo, lixo e ausência", async () => {
    const jwt = await signSession("conta-1", new Date(), secret);
    expect(await verifySession(jwt, other)).toBeNull();
    expect(await verifySession("abc", secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });
  it("expira depois de 30 dias", async () => {
    const jwt = await signSession("conta-1", new Date(Date.now() - 31 * 864e5), secret);
    expect(await verifySession(jwt, secret)).toBeNull();
  });
  it("renova só depois de 7 dias", () => {
    const now = new Date();
    const iat = Math.floor(now.getTime() / 1000);
    expect(shouldRenew({ contaId: "c", issuedAt: iat - 6 * 86400 }, now)).toBe(false);
    expect(shouldRenew({ contaId: "c", issuedAt: iat - 8 * 86400 }, now)).toBe(true);
  });
});
