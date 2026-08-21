import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";
import { resolveStudioRuntimeConfig } from "../../scripts/studio-runtime-config.mjs";

export function studioViteConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): UserConfig {
  const runtime = resolveStudioRuntimeConfig(environment);
  const controlPlaneUrl = `http://${runtime.host}:${runtime.controlPlanePort}`;
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Independent mode keeps Vite's 5173, 5174, ... development behavior.
      // OpenAlice mode binds the exact allocated loopback port and fails closed.
      host: runtime.host,
      port: runtime.httpPort,
      strictPort: runtime.strictHttpPort,
      open: runtime.openBrowser,
      proxy: {
        "/api": controlPlaneUrl,
        "/health": controlPlaneUrl,
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
}

export default defineConfig(() => studioViteConfig());
