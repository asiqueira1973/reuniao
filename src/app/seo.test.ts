// Bug B-03: a página inicial, a privacidade e os termos precisam ser legíveis por robôs (revisão do
// OAuth do Google), e /robots.txt precisa existir como texto. O resto do app segue noindex.
import { describe, expect, it } from "vitest";

describe("páginas públicas legíveis por robôs (B-03)", () => {
  it("/, /privacidade e /termos com index e follow", async () => {
    for (const mod of [await import("./page"), await import("./privacidade/page"), await import("./termos/page")]) {
      expect((mod as { metadata?: { robots?: unknown } }).metadata?.robots).toEqual({ index: true, follow: true });
    }
  });
  it("o layout raiz continua noindex para o resto do app", async () => {
    expect((await import("./layout")).metadata.robots).toEqual({ index: false, follow: false });
  });
  it("robots.txt libera o site e bloqueia painel, gestão e APIs", async () => {
    const robots = (await import("./robots")).default();
    expect(robots.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/painel", "/r/", "/api/"] });
  });
});
