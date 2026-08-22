import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseStudioCliOverrides,
  resolveStudioRuntimeConfig,
  studioChildEnvironment,
} from "./studio-runtime-config.mjs";

const managedEnvironment = Object.freeze({
  HARNESS_CAPABILITY: "studio",
  HARNESS_HOST: "127.0.0.1",
  HARNESS_PORTS: '{"http":49321,"controlPlane":49322}',
  HARNESS_NO_OPEN: "1",
});

test("publishes the generic Harness Studio capability manifest", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../harness.json", import.meta.url),
    "utf8",
  ));
  const productPackage = JSON.parse(await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.version, productPackage.version);
  assert.deepEqual(manifest, {
    manifestVersion: 1,
    version: "0.1.1",
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

test("parses exact generic Harness ports", () => {
  assert.deepEqual(resolveStudioRuntimeConfig(managedEnvironment), {
    managed: true,
    host: "127.0.0.1",
    httpPort: 49_321,
    controlPlanePort: 49_322,
    strictHttpPort: true,
    openBrowser: false,
  });
});

test("preserves standalone defaults and supports explicit standalone ports", () => {
  assert.deepEqual(resolveStudioRuntimeConfig({}), {
    managed: false,
    host: "127.0.0.1",
    httpPort: 5_173,
    controlPlanePort: 4_100,
    strictHttpPort: false,
    openBrowser: false,
  });
  assert.deepEqual(resolveStudioRuntimeConfig({}, [
    "--host=localhost",
    "--port", "15173",
    "--control-plane-port=14100",
  ]), {
    managed: false,
    host: "localhost",
    httpPort: 15_173,
    controlPlanePort: 14_100,
    strictHttpPort: false,
    openBrowser: false,
  });
});

test("only the generic studio capability activates managed mode", () => {
  assert.equal(resolveStudioRuntimeConfig({
    HARNESS_CAPABILITY: "another-capability",
  }).managed, false);
  assert.equal(resolveStudioRuntimeConfig({
    OPENALICE_CAPABILITY: "studio",
    OPENALICE_CAPABILITY_HOST: "127.0.0.1",
    OPENALICE_CAPABILITY_PORTS: '{"http":49321,"controlPlane":49322}',
  }).managed, false);
});

test("accepts equal managed CLI values and rejects conflicts", () => {
  assert.equal(resolveStudioRuntimeConfig(managedEnvironment, [
    "--host", "127.0.0.1",
    "--http-port=49321",
    "--control-plane-port", "49322",
  ]).managed, true);
  assert.throws(
    () => resolveStudioRuntimeConfig(managedEnvironment, ["--port", "49323"]),
    /conflicts with Harness injection/,
  );
  assert.throws(
    () => resolveStudioRuntimeConfig(managedEnvironment, ["--host=localhost"]),
    /conflicts with Harness injection/,
  );
});

test("propagates one resolved config to standalone children", () => {
  const environment = studioChildEnvironment({
    managed: false,
    host: "127.0.0.1",
    httpPort: 15_173,
    controlPlanePort: 14_100,
    strictHttpPort: false,
    openBrowser: false,
  }, { PATH: "/bin" });
  assert.deepEqual(resolveStudioRuntimeConfig(environment), {
    managed: false,
    host: "127.0.0.1",
    httpPort: 15_173,
    controlPlanePort: 14_100,
    strictHttpPort: false,
    openBrowser: false,
  });
  assert.equal(environment.PATH, "/bin");
});

test("parses supported Studio CLI spellings", () => {
  assert.deepEqual(parseStudioCliOverrides([
    "--",
    "--host", "127.0.0.1",
    "--port=15173",
    "--control-plane-port", "14100",
  ]), {
    host: "127.0.0.1",
    httpPort: 15_173,
    controlPlanePort: 14_100,
  });
});

for (const [name, environment, diagnostic] of [
  ["missing ports", {
    HARNESS_CAPABILITY: "studio",
    HARNESS_HOST: "127.0.0.1",
  }, /HARNESS_PORTS is required/],
  ["invalid JSON", {
    HARNESS_CAPABILITY: "studio",
    HARNESS_HOST: "127.0.0.1",
    HARNESS_PORTS: "not-json",
  }, /valid JSON/],
  ["missing named port", {
    HARNESS_CAPABILITY: "studio",
    HARNESS_HOST: "127.0.0.1",
    HARNESS_PORTS: '{"http":49321}',
  }, /exactly http and controlPlane/],
  ["non-integer port", {
    HARNESS_CAPABILITY: "studio",
    HARNESS_HOST: "127.0.0.1",
    HARNESS_PORTS: '{"http":49321.5,"controlPlane":49322}',
  }, /http must be an integer/],
  ["out-of-range port", {
    HARNESS_CAPABILITY: "studio",
    HARNESS_HOST: "127.0.0.1",
    HARNESS_PORTS: '{"http":0,"controlPlane":49322}',
  }, /http must be an integer/],
  ["duplicate ports", {
    HARNESS_CAPABILITY: "studio",
    HARNESS_HOST: "127.0.0.1",
    HARNESS_PORTS: '{"http":49321,"controlPlane":49321}',
  }, /must be different/],
  ["remote host", {
    HARNESS_CAPABILITY: "studio",
    HARNESS_HOST: "0.0.0.0",
    HARNESS_PORTS: '{"http":49321,"controlPlane":49322}',
  }, /HARNESS_HOST must be 127\.0\.0\.1/],
]) {
  test(`fails closed for ${name}`, () => {
    assert.throws(() => resolveStudioRuntimeConfig(environment), diagnostic);
  });
}
