import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveStudioRuntimeConfig } from "./studio-runtime-config.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function assertPortAvailable({
  host = "127.0.0.1",
  port = 4_100,
  name = "control-plane",
  createProbeServer = createServer,
} = {}) {
  return new Promise((resolveAvailable, rejectUnavailable) => {
    const probe = createProbeServer();
    probe.unref();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        rejectUnavailable(new Error(
          `${name} port http://${host}:${port} is already in use`,
        ));
        return;
      }
      rejectUnavailable(error);
    });
    probe.listen(port, host, () => {
      probe.close((error) => {
        if (error !== undefined) rejectUnavailable(error);
        else resolveAvailable();
      });
    });
  });
}

export async function assertStudioPortsAvailable(
  runtime = resolveStudioRuntimeConfig(),
  checkPort = assertPortAvailable,
) {
  await checkPort({
    host: runtime.host,
    port: runtime.controlPlanePort,
    name: "control-plane",
  });
  if (runtime.strictHttpPort) {
    await checkPort({
      host: runtime.host,
      port: runtime.httpPort,
      name: "Studio",
    });
  }
}

export function stopChild(child, signal = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform !== "win32" && child.pid !== undefined) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

export function superviseStudio(children, { stderr = process.stderr } = {}) {
  return new Promise((resolveExit) => {
    let settled = false;

    const settle = (source, code, signal, error) => {
      if (settled) return;
      settled = true;
      for (const candidate of children) {
        if (candidate !== source) stopChild(candidate.child);
      }

      const failed = error !== undefined || code !== 0;
      const detail = error !== undefined
        ? error.message
        : signal !== null
          ? `signal ${signal}`
          : `code ${code ?? "unknown"}`;
      stderr.write(
        `[studio] ${source.name} exited (${detail}); stopping the other process.\n`,
      );
      resolveExit(failed ? 1 : 0);
    };

    for (const source of children) {
      source.child.once("error", (error) => settle(source, null, null, error));
      source.child.once("exit", (code, signal) => settle(source, code, signal));
    }
  });
}

export function startStudioChildren({
  spawnProcess = spawn,
  nodeExecutable = process.execPath,
  pnpmExecutable = process.env.npm_execpath,
  environment = process.env,
} = {}) {
  if (pnpmExecutable === undefined || pnpmExecutable.length === 0) {
    throw new Error("pnpm studio must be launched through pnpm");
  }

  const launch = (name, packageName, command) => ({
    name,
    child: spawnProcess(
      nodeExecutable,
      [pnpmExecutable, "--filter", packageName, ...command],
      {
        cwd: repositoryRoot,
        env: environment,
        stdio: "inherit",
        detached: process.platform !== "win32",
      },
    ),
  });

  return [
    launch("control plane", "@pmh/control-plane", ["exec", "tsx", "src/main.ts"]),
    launch("Studio", "@pmh/studio", ["dev"]),
  ];
}
