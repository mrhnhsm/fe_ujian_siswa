import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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

  plugins: [react()],
});
