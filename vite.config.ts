import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Cada publicação tem uma versão: o app aberto no iPhone compara com /versao.json e oferece atualizar.
const VERSAO = (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "drend-versao",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "versao.json", source: JSON.stringify({ versao: VERSAO }) });
      },
    } satisfies Plugin,
  ],
  define: { __VERSAO__: JSON.stringify(VERSAO) },
  // A integração Supabase da Vercel cria estas variáveis; só as públicas (URL e chave anônima) vão para o app.
  envPrefix: ["VITE_", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node" },
} as never);
