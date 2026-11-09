// /robots.txt — bug B-03: o Google lê este arquivo antes das páginas. Libera o site público e
// bloqueia o painel, a gestão por token (/r/) e as APIs. Sem ele, o servidor devolvia HTML 200.
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/painel", "/r/", "/api/"] } };
}
