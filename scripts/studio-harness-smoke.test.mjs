import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function allocateLoopbackPorts(count) {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      servers.push(server);
    }
    return servers.map((server) => {
      const address = server.address();
      assert.ok(address !== null && typeof address === "object");
      return address.port;
    });
  } finally {
    await Promise.all(servers.map((server) =>
      new Promise((resolve) => server.close(resolve))
    ));
  }
}

async function fetchUntilReady(url, deadline) {
  let diagnostic = "no response";
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return response;
      diagnostic = `HTTP ${response.status}: ${await response.text()}`;
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${url}: ${diagnostic}`);
}

test("starts the complete Studio on exact OpenAlice loopback ports", {
  timeout: 90_000,
}, async () => {
  const pnpmExecutable = process.env.npm_execpath ?? "pnpm";
  const packageManagerIsScript = /\.(?:c?js|mjs)$/u.test(pnpmExecutable);
  const [httpPort, controlPlanePort] = await allocateLoopbackPorts(2);
  const directory = await mkdtemp(join(tmpdir(), "auto-prediction-harness-"));
  const output = [];
  const child = spawn(
    packageManagerIsScript ? process.execPath : pnpmExecutable,
    packageManagerIsScript ? [pnpmExecutable, "studio"] : ["studio"],
    {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      OPENALICE_CAPABILITY: "studio",
      OPENALICE_CAPABILITY_HOST: "127.0.0.1",
      OPENALICE_CAPABILITY_PORTS: JSON.stringify({ http: httpPort, controlPlane: controlPlanePort }),
      OPENALICE_CAPABILITY_NO_OPEN: "1",
      PMH_STATE_DB: join(directory, "control-plane.sqlite"),
    },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const exit = new Promise((resolve) => child.once("exit", (code, signal) =>
    resolve({ code, signal })
  ));

  try {
    const entry = `http://127.0.0.1:${httpPort}`;
    const deadline = Date.now() + 60_000;
    const health = await fetchUntilReady(`${entry}/health`, deadline);
    assert.equal((await health.json()).ok, true);

    const readiness = await fetchUntilReady(`${entry}/api/v1/readiness`, deadline);
    assert.equal((await readiness.json()).schemaVersion, "pmh.startup-readiness.v1");

    const html = await fetchUntilReady(entry, deadline);
    assert.match(await html.text(), /<!doctype html>/iu);

    const controller = new AbortController();
    const events = await fetch(`${entry}/api/v1/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal,
    });
    assert.equal(events.status, 200);
    assert.match(events.headers.get("content-type") ?? "", /^text\/event-stream/u);
    controller.abort();

    assert.match(output.join(""), new RegExp(`127\\.0\\.0\\.1:${httpPort}`));
    assert.doesNotMatch(output.join(""), /Local:\s+http:\/\/127\.0\.0\.1:517[3-9]/u);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    let shutdownTimer;
    try {
      await Promise.race([
        exit,
        new Promise((_, reject) => {
          shutdownTimer = setTimeout(
            () => reject(new Error(`Studio did not stop cleanly:\n${output.join("")}`)),
            10_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(shutdownTimer);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
