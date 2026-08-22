import { describe, expect, it } from "vitest";
import { studioViteConfig } from "./vite.config";

describe("studioViteConfig", () => {
  it("uses exact Harness host, ports, proxy, strict binding, and surface hosts", () => {
    const config = studioViteConfig({
      HARNESS_CAPABILITY: "studio",
      HARNESS_HOST: "127.0.0.1",
      HARNESS_PORTS: JSON.stringify({
        http: 49321,
        controlPlane: 49322,
      }),
      HARNESS_NO_OPEN: "1",
    });

    expect(config.server).toMatchObject({
      host: "127.0.0.1",
      port: 49321,
      strictPort: true,
      open: false,
      allowedHosts: [".localhost"],
      proxy: {
        "/api": "http://127.0.0.1:49322",
        "/health": "http://127.0.0.1:49322",
      },
    });
  });

  it("treats independent mode as the same config with default-filled ports", () => {
    const config = studioViteConfig({});

    expect(config.server).toMatchObject({
      host: "127.0.0.1",
      port: 5173,
      strictPort: false,
      open: false,
      allowedHosts: undefined,
      proxy: {
        "/api": "http://127.0.0.1:4100",
        "/health": "http://127.0.0.1:4100",
      },
    });
  });
});
