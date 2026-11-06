import type { NextConfig } from "next";

// Configuração do Next 16 (seção 4): Cache Components ligado, como no projeto de referência.
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // "/painel" não tem tela própria: abre em Tipos de evento (seção 8.1). "/" é a página inicial
  // (v0.5); com sessão, o proxy manda para o painel. Redirecionar aqui evita redirect() dentro de
  // página pré-renderizada.
  // Seção 20: a página de gestão carrega o token na URL; não indexar e não vazar no Referer.
  async headers() {
    return [
      {
        source: "/r/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/painel", destination: "/painel/tipos", permanent: false },
    ];
  },
};

export default nextConfig;
