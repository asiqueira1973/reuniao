// Vitest de unidade e de rotas (seção 22). Testes de banco (pgTAP) rodam à parte em scripts/test-db.mjs.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    setupFiles: ["./tests/setup.ts"],
    // Testes de rota usam o banco local compartilhado entre arquivos: um arquivo por vez.
    fileParallelism: false,
    // O Supabase local divide o Docker com outros projetos; a primeira chamada pode levar ~10 s.
    testTimeout: 20000,
  },
});
