import type { NextConfig } from "next";

// Configuração do Next 16 (seção 4): Cache Components ligado, como no projeto de referência.
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
