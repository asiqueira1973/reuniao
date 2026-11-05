import type { NextConfig } from "next";

// Configuração do Next 16 (seção 4): Cache Components ligado, como no projeto de referência.
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // "/" e "/painel" não têm tela própria: abrem em Tipos de evento (seção 8.1). Sem sessão, o
  // proxy manda para /entrar. Redirecionar aqui evita redirect() dentro de página pré-renderizada.
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
      { source: "/", destination: "/painel/tipos", permanent: false },
      { source: "/painel", destination: "/painel/tipos", permanent: false },
    ];
  },
};

export default nextConfig;
