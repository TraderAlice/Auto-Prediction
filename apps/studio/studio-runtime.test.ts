import { describe, expect, it } from "vitest";
import { studioViteConfig } from "./vite.config";

describe("studioViteConfig", () => {
  it("uses exact OpenAlice host, ports, proxy, and strict binding", () => {
    const config = studioViteConfig({
      OPENALICE_CAPABILITY: "studio",
      OPENALICE_CAPABILITY_HOST: "127.0.0.1",
      OPENALICE_CAPABILITY_PORTS: JSON.stringify({
        http: 49321,
        controlPlane: 49322,
      }),
      OPENALICE_CAPABILITY_NO_OPEN: "1",
    });

    expect(config.server).toMatchObject({
      host: "127.0.0.1",
      port: 49321,
      strictPort: true,
      open: false,
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
      proxy: {
        "/api": "http://127.0.0.1:4100",
        "/health": "http://127.0.0.1:4100",
      },
    });
  });
});
