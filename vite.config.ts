import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { lovableAssetsProxyPlugin } from "@lovable.dev/vite-tanstack-config";

/**
 * Client-only build: routing, ICS parsing, route calculation, and Supabase calls run in the
 * browser. `bun run build` emits the static `dist/` deployed by Vercel.
 */
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
        globIgnores: ["models/**"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*$/,
            handler: "NetworkOnly",
            options: {
              cacheName: "openfreemap-tiles",
            },
          },
          {
            urlPattern: /\/models\/.*\.(?:glb|png)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "models-assets",
            },
          },
        ],
      },
    }),
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
