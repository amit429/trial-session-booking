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
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks; pages are split per route in router.tsx.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          data: ["@tanstack/react-query", "luxon", "zod"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover", "sonner", "lucide-react"]
        }
      }
    }
  },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], css: false }
});
