const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const DEFAULT_HTTP_PORT = 5_173;
const DEFAULT_CONTROL_PLANE_PORT = 4_100;

function port(value, name) {
  const parsed = typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : value;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be an integer from 1 to 65535`);
  }
  return parsed;
}

function loopbackHost(value, name) {
  if (typeof value !== "string" || !LOOPBACK_HOSTS.has(value)) {
    throw new Error(`${name} must be 127.0.0.1, ::1, or localhost`);
  }
  return value;
}

function readOptionValue(arguments_, index, name) {
  const argument = arguments_[index];
  const prefix = `${name}=`;
  if (argument.startsWith(prefix)) {
    return { value: argument.slice(prefix.length), consumed: 0 };
  }
  if (argument !== name) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return { value, consumed: 1 };
}

export function parseStudioCliOverrides(arguments_ = []) {
  const overrides = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    const host = readOptionValue(arguments_, index, "--host");
    if (host !== undefined) {
      overrides.host = loopbackHost(host.value, "--host");
      index += host.consumed;
      continue;
    }
    const http = readOptionValue(arguments_, index, "--port")
      ?? readOptionValue(arguments_, index, "--http-port");
    if (http !== undefined) {
      overrides.httpPort = port(http.value, argument.split("=")[0]);
      index += http.consumed;
      continue;
    }
    const controlPlane = readOptionValue(arguments_, index, "--control-plane-port");
    if (controlPlane !== undefined) {
      overrides.controlPlanePort = port(controlPlane.value, "--control-plane-port");
      index += controlPlane.consumed;
    }
  }
  return Object.freeze(overrides);
}

function assertNoConflict(name, explicit, injected) {
  if (explicit !== undefined && explicit !== injected) {
    throw new Error(`${name}=${explicit} conflicts with Harness injection ${injected}`);
  }
}

export function resolveStudioRuntimeConfig(
  environment = process.env,
  arguments_ = [],
) {
  const explicit = parseStudioCliOverrides(arguments_);
  const managed = environment.HARNESS_CAPABILITY === "studio";
  if (!managed) {
    const host = explicit.host
      ?? loopbackHost(environment.PMH_STUDIO_HOST ?? "127.0.0.1", "PMH_STUDIO_HOST");
    const httpPort = explicit.httpPort
      ?? port(environment.PMH_STUDIO_HTTP_PORT ?? DEFAULT_HTTP_PORT, "PMH_STUDIO_HTTP_PORT");
    const controlPlanePort = explicit.controlPlanePort
      ?? port(
        environment.PMH_STUDIO_CONTROL_PLANE_PORT ?? DEFAULT_CONTROL_PLANE_PORT,
        "PMH_STUDIO_CONTROL_PLANE_PORT",
      );
    if (httpPort === controlPlanePort) {
      throw new Error("Studio http and controlPlane ports must be different");
    }
    return Object.freeze({
      managed,
      host,
      httpPort,
      controlPlanePort,
      strictHttpPort: false,
      openBrowser: false,
    });
  }

  const host = loopbackHost(environment.HARNESS_HOST, "HARNESS_HOST");
  const encodedPorts = environment.HARNESS_PORTS;
  if (typeof encodedPorts !== "string" || encodedPorts.trim() === "") {
    throw new Error("HARNESS_PORTS is required in studio mode");
  }
  let decoded;
  try {
    decoded = JSON.parse(encodedPorts);
  } catch {
    throw new Error("HARNESS_PORTS must be valid JSON");
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("HARNESS_PORTS must be a JSON object");
  }
  const keys = Object.keys(decoded).sort();
  if (keys.length !== 2 || keys[0] !== "controlPlane" || keys[1] !== "http") {
    throw new Error("HARNESS_PORTS must contain exactly http and controlPlane");
  }
  const httpPort = port(decoded.http, "HARNESS_PORTS.http");
  const controlPlanePort = port(decoded.controlPlane, "HARNESS_PORTS.controlPlane");
  if (httpPort === controlPlanePort) {
    throw new Error("Harness studio http and controlPlane ports must be different");
  }

  assertNoConflict("--host", explicit.host, host);
  assertNoConflict("--port", explicit.httpPort, httpPort);
  assertNoConflict(
    "--control-plane-port",
    explicit.controlPlanePort,
    controlPlanePort,
  );

  return Object.freeze({
    managed,
    host,
    httpPort,
    controlPlanePort,
    strictHttpPort: true,
    openBrowser: false,
  });
}

export function studioChildEnvironment(runtime, environment = process.env) {
  return {
    ...environment,
    PMH_STUDIO_HOST: runtime.host,
    PMH_STUDIO_HTTP_PORT: String(runtime.httpPort),
    PMH_STUDIO_CONTROL_PLANE_PORT: String(runtime.controlPlanePort),
  };
}
