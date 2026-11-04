// Testes do proxy (seção 6): painel sem sessão vai para /entrar; com sessão segue.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";
import { signSession } from "@/server/auth/session";

describe("proxy (seção 6)", () => {
  it("/painel sem cookie redireciona para /entrar", async () => {
    const res = await proxy(new NextRequest("http://localhost:3020/painel"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3020/entrar");
  });
  it("/painel com cookie inválido redireciona para /entrar", async () => {
    const res = await proxy(new NextRequest("http://localhost:3020/painel/tipos", { headers: { cookie: "ag_sessao=lixo" } }));
    expect(res.headers.get("location")).toBe("http://localhost:3020/entrar");
  });
  it("/painel com sessão válida segue sem redirecionar e sem renovar", async () => {
    const jwt = await signSession("conta-x");
    const res = await proxy(new NextRequest("http://localhost:3020/painel", { headers: { cookie: `ag_sessao=${jwt}` } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("ag_sessao")).toBeUndefined();
  });
  it("sessão com mais de 7 dias é renovada", async () => {
    const jwt = await signSession("conta-x", new Date(Date.now() - 8 * 864e5));
    const res = await proxy(new NextRequest("http://localhost:3020/painel", { headers: { cookie: `ag_sessao=${jwt}` } }));
    expect(res.cookies.get("ag_sessao")?.value).toBeTruthy();
  });
});
