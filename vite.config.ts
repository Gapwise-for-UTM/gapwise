import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
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
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(.*)\.tiles\.openstreetmap\.org\/.*$/,
            handler: "NetworkOnly",
            options: {
              cacheName: "osm-tiles",
            },
          },
          {
            urlPattern: /^https:\/\/(.*)\.tile\.openstreetmap\.org\/.*$/,
            handler: "NetworkOnly",
            options: {
              cacheName: "osm-tiles",
            },
          },
          {
            urlPattern: /^https:\/\/(.*)\.mapbox\.com\/.*$/,
            handler: "NetworkOnly",
            options: {
              cacheName: "mapbox-tiles",
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
