import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind the same loopback family used by other local workspaces so Vite can
    // actually observe a port collision and increment to 5174, 5175, ... .
    // Binding the default `localhost` can otherwise admit ::1:5173 while a
    // different app already owns 127.0.0.1:5173.
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": "http://127.0.0.1:4100",
      "/health": "http://127.0.0.1:4100",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
