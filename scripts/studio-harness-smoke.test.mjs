import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = new URL("..", import.meta.url);
const surfaceHost = "oa-surface-0123456789abcdef01234567.localhost";

async function manifestCommand() {
  const manifest = JSON.parse(await readFile(
    new URL("../harness.json", import.meta.url),
    "utf8",
  ));
  return manifest.capabilities.studio.command;
}

async function listen(server, port = 0) {
  if (server.__harnessSockets === undefined) {
    server.__harnessSockets = new Set();
    server.on("connection", (socket) => {
      server.__harnessSockets.add(socket);
      socket.once("close", () => server.__harnessSockets.delete(socket));
    });
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  return address.port;
}

async function close(server) {
  for (const socket of server.__harnessSockets ?? []) socket.destroy();
  await new Promise((resolve, reject) => server.close((error) => {
    if (error !== undefined) reject(error);
    else resolve();
  }));
}

async function allocateLoopbackPorts(count) {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      await listen(server);
      servers.push(server);
    }
    return servers.map((server) => server.address().port);
  } finally {
    await Promise.all(servers.map(close));
  }
}

async function holdDefaultPortIfAvailable(port) {
  const server = createServer();
  try {
    await listen(server, port);
    return server;
  } catch (error) {
    if (error?.code === "EADDRINUSE") return undefined;
    throw error;
  }
}

function cleanEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  for (const name of [
    "HARNESS_CAPABILITY",
    "HARNESS_HOST",
    "HARNESS_PORTS",
    "HARNESS_NO_OPEN",
    "OPENALICE_CAPABILITY",
    "OPENALICE_CAPABILITY_HOST",
    "OPENALICE_CAPABILITY_PORTS",
    "OPENALICE_CAPABILITY_NO_OPEN",
    "PMH_STUDIO_HOST",
    "PMH_STUDIO_HTTP_PORT",
    "PMH_STUDIO_CONTROL_PLANE_PORT",
  ]) {
    if (!(name in overrides)) delete environment[name];
  }
  return environment;
}

async function startCapability({ environment, extraArguments = [] }) {
  const [executable, ...arguments_] = await manifestCommand();
  const output = [];
  const child = spawn(executable, [...arguments_, ...extraArguments], {
    cwd: repositoryRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const exit = new Promise((resolve) => child.once("exit", (code, signal) => {
    resolve({ code, signal });
  }));
  return { child, exit, output };
}

function request({ port, path = "/", host = "127.0.0.1", headers = {} }) {
  return new Promise((resolve, reject) => {
    const request_ = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      headers: { host, ...headers },
      timeout: 2_000,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request_.once("timeout", () => request_.destroy(new Error("request timed out")));
    request_.once("error", reject);
    request_.end();
  });
}

async function requestUntilReady(input, deadline) {
  let diagnostic = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await request(input);
      if (response.status >= 200 && response.status < 300) return response;
      diagnostic = `HTTP ${response.status}: ${response.body}`;
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${input.path}: ${diagnostic}`);
}

function openSse({ port, host }) {
  return new Promise((resolve, reject) => {
    const request_ = http.request({
      hostname: "127.0.0.1",
      port,
      path: "/api/v1/events",
      headers: { host, accept: "text/event-stream" },
    });
    request_.once("response", (response) => {
      resolve({ response, close: () => {
        response.destroy();
        request_.destroy();
      } });
    });
    request_.once("error", reject);
    request_.end();
  });
}

function openViteWebSocket({ port, host, token }) {
  let socket;
  const handshake = new Promise((resolve, reject) => {
    socket = connect({ host: "127.0.0.1", port });
    const key = randomBytes(16).toString("base64");
    let response = "";
    socket.once("connect", () => socket.write([
      `GET /?token=${encodeURIComponent(token)} HTTP/1.1`,
      `Host: ${host}`,
      "Connection: Upgrade",
      "Upgrade: websocket",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      "Sec-WebSocket-Protocol: vite-hmr",
      `Origin: http://${host}`,
      "",
      "",
    ].join("\r\n")));
    socket.on("data", (chunk) => {
      response += chunk.toString("latin1");
      if (!response.includes("\r\n\r\n")) return;
      if (!response.startsWith("HTTP/1.1 101")) {
        socket.destroy();
        reject(new Error(`unexpected WebSocket response: ${response}`));
        return;
      }
      resolve({ socket, response });
    });
    socket.once("error", reject);
    socket.once("close", () => reject(new Error(
      `WebSocket closed before upgrade: ${response}`,
    )));
  });
  let timer;
  return Promise.race([
    handshake,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        socket?.destroy();
        reject(new Error("WebSocket upgrade timed out"));
      }, 3_000);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function waitForExit(launch, timeout = 10_000) {
  let timer;
  try {
    return await Promise.race([
      launch.exit,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(
          `capability did not exit:\n${launch.output.join("")}`,
        )), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function stopCapability(launch) {
  if (launch.child.exitCode === null && launch.child.signalCode === null) {
    launch.child.kill("SIGTERM");
  }
  try {
    await waitForExit(launch);
  } catch (error) {
    if (process.platform !== "win32" && launch.child.pid !== undefined) {
      try { process.kill(-launch.child.pid, "SIGKILL"); } catch {}
    } else {
      launch.child.kill("SIGKILL");
    }
    throw error;
  }
}

async function assertPortReleased(port) {
  const deadline = Date.now() + 10_000;
  let diagnostic;
  while (Date.now() < deadline) {
    const probe = createServer();
    try {
      await listen(probe, port);
      await close(probe);
      return;
    } catch (error) {
      diagnostic = error;
      if (probe.listening) await close(probe);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`port ${port} was not released: ${diagnostic}`);
}

test("standalone manifest command remains runnable without HARNESS variables", {
  timeout: 90_000,
}, async () => {
  const [httpPort, controlPlanePort] = await allocateLoopbackPorts(2);
  const directory = await mkdtemp(join(tmpdir(), "auto-prediction-standalone-"));
  const launch = await startCapability({
    environment: cleanEnvironment({
      PMH_STATE_DB: join(directory, "control-plane.sqlite"),
    }),
    extraArguments: [
      "--",
      "--host", "127.0.0.1",
      "--port", String(httpPort),
      "--control-plane-port", String(controlPlanePort),
    ],
  });
  try {
    const health = await requestUntilReady({ port: httpPort, path: "/health" }, Date.now() + 60_000);
    assert.equal(JSON.parse(health.body).ok, true);
    assert.equal((await request({ port: controlPlanePort, path: "/health" })).status, 200);
  } finally {
    await stopCapability(launch);
    await Promise.all([assertPortReleased(httpPort), assertPortReleased(controlPlanePort)]);
    await rm(directory, { recursive: true, force: true });
  }
});

test("managed manifest command serves the complete same-origin surface on exact ports", {
  timeout: 90_000,
}, async () => {
  const [httpPort, controlPlanePort] = await allocateLoopbackPorts(2);
  const defaultHolders = (await Promise.all([
    holdDefaultPortIfAvailable(5_173),
    holdDefaultPortIfAvailable(4_100),
  ])).filter(Boolean);
  const directory = await mkdtemp(join(tmpdir(), "auto-prediction-harness-"));
  const opener = join(directory, "browser-opener");
  const openerSentinel = join(directory, "browser-opened");
  await writeFile(opener, `#!/bin/sh\ntouch "${openerSentinel}"\n`, "utf8");
  await chmod(opener, 0o755);
  const launch = await startCapability({
    environment: cleanEnvironment({
      HARNESS_CAPABILITY: "studio",
      HARNESS_HOST: "127.0.0.1",
      HARNESS_PORTS: JSON.stringify({ http: httpPort, controlPlane: controlPlanePort }),
      HARNESS_NO_OPEN: "1",
      BROWSER: opener,
      PMH_STATE_DB: join(directory, "control-plane.sqlite"),
    }),
  });

  try {
    const deadline = Date.now() + 60_000;
    const health = await requestUntilReady({
      port: httpPort,
      path: "/health",
      host: surfaceHost,
    }, deadline);
    assert.equal(JSON.parse(health.body).ok, true);

    const controlPlaneHealth = await request({ port: controlPlanePort, path: "/health" });
    assert.equal(controlPlaneHealth.status, 200);

    const html = await request({ port: httpPort, host: surfaceHost });
    assert.equal(html.status, 200);
    assert.match(html.body, /<!doctype html>/iu);
    assert.equal(html.headers["x-frame-options"], undefined);
    assert.doesNotMatch(html.headers["content-security-policy"] ?? "", /frame-ancestors\s+'none'/iu);
    const assetPath = html.body.match(/(?:src|href)="(\/[^"?#]+)/u)?.[1];
    assert.ok(assetPath, "Studio HTML must reference a root-relative asset");
    const asset = await request({ port: httpPort, path: assetPath, host: surfaceHost });
    assert.equal(asset.status, 200);
    assert.doesNotMatch(asset.body, new RegExp(`127\\.0\\.0\\.1:${httpPort}`, "u"));
    assert.doesNotMatch(asset.body, new RegExp(`127\\.0\\.0\\.1:${controlPlanePort}`, "u"));
    assert.match(asset.body, /const serverHost = importMetaUrl\.host;/u);
    assert.match(asset.body, /const directSocketHost = socketHost;/u);
    const webSocketToken = asset.body.match(/const wsToken = "([^"]+)"/u)?.[1];
    assert.ok(webSocketToken, "Vite client must carry its HMR WebSocket token");

    const readiness = await request({
      port: httpPort,
      path: "/api/v1/readiness",
      host: surfaceHost,
    });
    assert.equal(readiness.status, 200);
    assert.equal(JSON.parse(readiness.body).schemaVersion, "pmh.startup-readiness.v1");

    const sse = await openSse({ port: httpPort, host: surfaceHost });
    assert.equal(sse.response.statusCode, 200);
    assert.match(sse.response.headers["content-type"] ?? "", /^text\/event-stream/u);
    sse.close();

    const websocket = await openViteWebSocket({
      port: httpPort,
      host: surfaceHost,
      token: webSocketToken,
    });
    assert.match(websocket.response, /Sec-WebSocket-Protocol: vite-hmr/iu);
    websocket.socket.destroy();

    await assert.rejects(access(openerSentinel));
    const output = launch.output.join("");
    assert.match(output, new RegExp(`127\\.0\\.0\\.1:${httpPort}`));
    assert.doesNotMatch(output, /Local:\s+http:\/\/127\.0\.0\.1:517[3-9]/u);
  } finally {
    await Promise.all(defaultHolders.map(close));
    await stopCapability(launch);
    await Promise.all([assertPortReleased(httpPort), assertPortReleased(controlPlanePort)]);
    await rm(directory, { recursive: true, force: true });
  }
});

test("managed launch rejects conflicting explicit ports before spawning children", {
  timeout: 20_000,
}, async () => {
  const [httpPort, controlPlanePort, conflictingPort] = await allocateLoopbackPorts(3);
  const launch = await startCapability({
    environment: cleanEnvironment({
      HARNESS_CAPABILITY: "studio",
      HARNESS_HOST: "127.0.0.1",
      HARNESS_PORTS: JSON.stringify({ http: httpPort, controlPlane: controlPlanePort }),
      HARNESS_NO_OPEN: "1",
    }),
    extraArguments: ["--", "--port", String(conflictingPort)],
  });
  const result = await waitForExit(launch, 10_000);
  assert.notEqual(result.code, 0);
  assert.match(launch.output.join(""), /conflicts with Harness injection/u);
  await Promise.all([assertPortReleased(httpPort), assertPortReleased(controlPlanePort)]);
});

test("managed launch fails quickly when either injected port is occupied", {
  timeout: 45_000,
}, async (context) => {
  for (const occupiedName of ["http", "controlPlane"]) {
    await context.test(occupiedName, async () => {
      const occupant = createServer();
      const occupiedPort = await listen(occupant);
      const [otherPort] = await allocateLoopbackPorts(1);
      const ports = occupiedName === "http"
        ? { http: occupiedPort, controlPlane: otherPort }
        : { http: otherPort, controlPlane: occupiedPort };
      const directory = await mkdtemp(join(tmpdir(), "auto-prediction-occupied-"));
      const launch = await startCapability({
        environment: cleanEnvironment({
          HARNESS_CAPABILITY: "studio",
          HARNESS_HOST: "127.0.0.1",
          HARNESS_PORTS: JSON.stringify(ports),
          HARNESS_NO_OPEN: "1",
          PMH_STATE_DB: join(directory, "control-plane.sqlite"),
        }),
      });
      try {
        const result = await waitForExit(launch, 10_000);
        assert.notEqual(result.code, 0);
        assert.match(launch.output.join(""), /port .* is already in use/u);
        assert.doesNotMatch(launch.output.join(""), /Local:\s+http:/u);
      } finally {
        if (launch.child.exitCode === null && launch.child.signalCode === null) {
          await stopCapability(launch);
        }
        await close(occupant);
        await Promise.all([assertPortReleased(ports.http), assertPortReleased(ports.controlPlane)]);
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
});
