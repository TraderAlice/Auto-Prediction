import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import { resolveStudioRuntimeConfig } from "../../scripts/studio-runtime-config.mjs";

function managedSurfaceClient(managed: boolean): Plugin {
  return {
    name: "auto-prediction:managed-surface-client",
    enforce: "post",
    transform(code, id) {
      if (!managed || !id.replaceAll("\\", "/").endsWith("/vite/dist/client/client.mjs")) {
        return undefined;
      }
      const serverHost = /const serverHost = (?:__SERVER_HOST__|"[^"\n]*");/u;
      const directSocketHost = /const directSocketHost = (?:__HMR_DIRECT_TARGET__|"[^"\n]*");/u;
      if (!serverHost.test(code) || !directSocketHost.test(code)) {
        throw new Error("Vite managed client shape changed; refusing to expose bind addresses");
      }
      return {
        code: code
          .replace(serverHost, "const serverHost = importMetaUrl.host;")
          .replace(directSocketHost, "const directSocketHost = socketHost;"),
        map: null,
      };
    },
  };
}

export function studioViteConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): UserConfig {
  const runtime = resolveStudioRuntimeConfig(environment);
  const controlPlaneUrl = `http://${runtime.host}:${runtime.controlPlanePort}`;
  return {
    plugins: [react(), tailwindcss(), managedSurfaceClient(runtime.managed)],
    server: {
      // Independent mode keeps Vite's 5173, 5174, ... development behavior.
      // Managed mode binds the exact allocated loopback port and fails closed.
      host: runtime.host,
      port: runtime.httpPort,
      strictPort: runtime.strictHttpPort,
      open: runtime.openBrowser,
      allowedHosts: runtime.managed ? [".localhost"] : undefined,
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
