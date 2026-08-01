import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { lovableAssetsProxyPlugin } from "@lovable.dev/vite-tanstack-config";

/**
 * Client-only build: routing, ICS parsing, route calculation, and Supabase calls all
 * run in the browser. `bun run build` emits a Cloudflare Pages-ready `dist/`.
 */
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    lovableAssetsProxyPlugin(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist",
  },
});
