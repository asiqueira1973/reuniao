// Testes do OAuth do Google (seções 6 e 20) com chaves locais no lugar do JWKS do Google.
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { buildAuthUrl, CALENDAR_SCOPES, hasCalendarScopes, verifyIdToken } from "./oauth";

process.env.GOOGLE_CLIENT_ID = "client-teste.apps.googleusercontent.com";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3020";

let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  jwks = createLocalJWKSet({ keys: [jwk] });
});

// Monta um id_token de teste com os campos desejados.
function idToken(claims: Record<string, unknown>, opts: { aud?: string; iss?: string; exp?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? "client-teste.apps.googleusercontent.com")
    .setSubject("sub-123")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(privateKey);
}

describe("buildAuthUrl (seção 6)", () => {
  it("pede offline, consent, select_account e os escopos de agenda", () => {
    const url = new URL(buildAuthUrl("estado-1"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent select_account");
    expect(url.searchParams.get("state")).toBe("estado-1");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3020/api/auth/google/callback");
    for (const s of CALENDAR_SCOPES) expect(url.searchParams.get("scope")).toContain(s);
  });
});

describe("hasCalendarScopes", () => {
  it("exige as duas permissões", () => {
    expect(hasCalendarScopes([...CALENDAR_SCOPES, "openid"])).toBe(true);
    expect(hasCalendarScopes([CALENDAR_SCOPES[0], "openid"])).toBe(false);
  });
});

describe("verifyIdToken (seção 20)", () => {
  it("devolve identidade com e-mail minúsculo", async () => {
    const t = await idToken({ email: "Alexandre@Gmail.com", email_verified: true, name: "Alexandre Siqueira" });
    expect(await verifyIdToken(t, jwks)).toEqual({ sub: "sub-123", email: "alexandre@gmail.com", name: "Alexandre Siqueira" });
  });
  it("recusa aud, iss, exp errados e e-mail não verificado", async () => {
    await expect(verifyIdToken(await idToken({ email: "a@b.c", email_verified: true }, { aud: "outro" }), jwks)).rejects.toThrow();
    await expect(verifyIdToken(await idToken({ email: "a@b.c", email_verified: true }, { iss: "https://mal.example" }), jwks)).rejects.toThrow();
    await expect(verifyIdToken(await idToken({ email: "a@b.c", email_verified: true }, { exp: "-1h" }), jwks)).rejects.toThrow();
    await expect(verifyIdToken(await idToken({ email: "a@b.c", email_verified: false }), jwks)).rejects.toThrow(/verificado/);
  });
});
