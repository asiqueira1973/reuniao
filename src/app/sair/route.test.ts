// Teste de POST /sair (seção 6): apaga o cookie de sessão e volta para /entrar com 303.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /sair (seção 6)", () => {
  it("apaga ag_sessao e redireciona com 303 para /entrar", async () => {
    const res = await POST(new NextRequest("http://localhost:3020/sair", { method: "POST", headers: { cookie: "ag_sessao=x" } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3020/entrar");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/ag_sessao=;/);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });
});
