import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveStudioRuntimeConfig } from "./studio-runtime-config.mjs";

test("publishes the OpenAlice Harness Studio capability manifest", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../harness.json", import.meta.url),
    "utf8",
  ));
  assert.deepEqual(manifest, {
    manifestVersion: 1,
    version: "0.1.0",
    capabilities: {
      studio: {
        command: ["pnpm", "studio"],
        ports: ["http", "controlPlane"],
        entryPort: "http",
        readinessPath: "/health",
      },
    },
  });
});

test("parses exact managed Studio ports", () => {
  assert.deepEqual(resolveStudioRuntimeConfig({
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
    OPENALICE_CAPABILITY_PORTS: '{"http":49321,"controlPlane":49322}',
    OPENALICE_CAPABILITY_NO_OPEN: "1",
  }), {
    managed: true,
    host: "127.0.0.1",
    httpPort: 49_321,
    controlPlanePort: 49_322,
    strictHttpPort: true,
    openBrowser: false,
  });
});

test("preserves independent Studio defaults", () => {
  assert.deepEqual(resolveStudioRuntimeConfig({}), {
    managed: false,
    host: "127.0.0.1",
    httpPort: 5_173,
    controlPlanePort: 4_100,
    strictHttpPort: false,
    openBrowser: false,
  });
  assert.equal(resolveStudioRuntimeConfig({
    OPENALICE_CAPABILITY: "another-capability",
  }).managed, false);
});

for (const [name, environment, diagnostic] of [
  ["missing ports", {
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
  }, /PORTS is required/],
  ["invalid JSON", {
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
    OPENALICE_CAPABILITY_PORTS: "not-json",
  }, /valid JSON/],
  ["missing named port", {
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
    OPENALICE_CAPABILITY_PORTS: '{"http":49321}',
  }, /exactly http and controlPlane/],
  ["non-integer port", {
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
    OPENALICE_CAPABILITY_PORTS: '{"http":49321.5,"controlPlane":49322}',
  }, /http must be an integer/],
  ["out-of-range port", {
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
    OPENALICE_CAPABILITY_PORTS: '{"http":0,"controlPlane":49322}',
  }, /http must be an integer/],
  ["duplicate ports", {
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
    OPENALICE_CAPABILITY_PORTS: '{"http":49321,"controlPlane":49321}',
  }, /must be different/],
  ["remote host", {
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "0.0.0.0",
    OPENALICE_CAPABILITY_PORTS: '{"http":49321,"controlPlane":49322}',
  }, /must be 127\.0\.0\.1/],
]) {
  test(`fails closed for ${name}`, () => {
    assert.throws(() => resolveStudioRuntimeConfig(environment), diagnostic);
  });
}
