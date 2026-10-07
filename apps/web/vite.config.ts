/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    // Same-origin API in development so session cookies just work.
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: false } }
  },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], css: false }
});
