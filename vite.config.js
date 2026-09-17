import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",

  server: {
    host: true, // atau "0.0.0.0"
    port: 8085,
    strictPort: true,
  },

  preview: {
    host: true, // atau "0.0.0.0"
    port: 8085,
    strictPort: true,
  },

  plugins: [
    react(),
    VitePWA({
      // "autoUpdate": service worker baru langsung dipakai tanpa
      // siswa harus manual clear cache -- penting karena ini app ujian.
      registerType: "autoUpdate",

      // supaya ikon ikut ke-precache oleh service worker
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
        "icons/favicon-64.png",
      ],

      manifest: {
        name: "Ruang Ujian Terkunci",
        short_name: "Ruang Ujian",
        description: "Aplikasi ujian mode terkunci",
        // PENTING: start_url ke halaman gerbang token, BUKAN ke URL
        // ujian dengan token tertentu -- kalau tidak, ikon di
        // homescreen siswa akan selalu buka token lama/kedaluwarsa.
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#060b16",
        theme_color: "#0d2a63",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        // App ujian: jangan cache halaman API/data secara agresif,
        // cukup precache shell (JS/CSS/HTML) supaya app tetap bisa
        // dibuka standalone. Iframe LMS (urlLms) tetap request
        // langsung ke server, tidak melalui cache ini.
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
});
