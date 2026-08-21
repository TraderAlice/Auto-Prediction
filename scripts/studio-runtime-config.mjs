const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function managedPort(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(
      `OPENALICE_CAPABILITY_PORTS.${name} must be an integer from 1 to 65535`,
    );
  }
  return value;
}

export function resolveStudioRuntimeConfig(environment = process.env) {
  const managed = environment.OPENALICE_CAPABILITY === "studio";
  if (!managed) return Object.freeze({
    managed,
    host: "127.0.0.1",
    httpPort: 5_173,
    controlPlanePort: 4_100,
    strictHttpPort: managed,
    openBrowser: false,
  });

  const host = environment.OPENALICE_CAPABILITY_HOST;
  if (typeof host !== "string" || !LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      "OPENALICE_CAPABILITY_HOST must be 127.0.0.1, ::1, or localhost in studio mode",
    );
  }
  const encodedPorts = environment.OPENALICE_CAPABILITY_PORTS;
  if (typeof encodedPorts !== "string" || encodedPorts.trim() === "") {
    throw new Error("OPENALICE_CAPABILITY_PORTS is required in studio mode");
  }
  let decoded;
  try {
    decoded = JSON.parse(encodedPorts);
  } catch {
    throw new Error("OPENALICE_CAPABILITY_PORTS must be valid JSON");
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("OPENALICE_CAPABILITY_PORTS must be a JSON object");
  }
  const keys = Object.keys(decoded).sort();
  if (keys.length !== 2 || keys[0] !== "controlPlane" || keys[1] !== "http") {
    throw new Error(
      "OPENALICE_CAPABILITY_PORTS must contain exactly http and controlPlane",
    );
  }
  const httpPort = managedPort(decoded.http, "http");
  const controlPlanePort = managedPort(decoded.controlPlane, "controlPlane");
  if (httpPort === controlPlanePort) {
    throw new Error("OpenAlice studio http and controlPlane ports must be different");
  }

  return Object.freeze({
    managed,
    host,
    httpPort,
    controlPlanePort,
    strictHttpPort: managed,
    openBrowser: false,
  });
}
