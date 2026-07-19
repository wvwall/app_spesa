import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "La spesa di casa",
        short_name: "La spesa",
        description: "Pianifica pranzo e cena della settimana e fai la spesa, anche offline.",
        lang: "it",
        start_url: "/",
        display: "standalone",
        background_color: "#FAFAF6",
        theme_color: "#1D3EA5",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,png}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
