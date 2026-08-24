import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCodexAppServerConnectionFactory } from "../src/index.js";

const directories: string[] = [];

async function fakeAppServer(): Promise<Readonly<{ command: string; cwd: string }>> {
  const cwd = await mkdtemp(join(tmpdir(), "pmh-codex-app-server-transport-"));
  directories.push(cwd);
  const command = join(cwd, "fake-codex");
  await writeFile(command, `#!/usr/bin/env node
import readline from "node:readline";

const lines = readline.createInterface({ input: process.stdin });
let first = null;
const send = (value) => process.stdout.write(JSON.stringify(value) + "\\n");

lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    send({ id: message.id, result: { userAgent: "fake-app-server" } });
  } else if (message.method === "initialized") {
    send({ method: "thread/status/changed", params: { status: "ready" } });
    send({ id: 900, method: "item/tool/call", params: { callId: "call:1" } });
  } else if (message.method === "first") {
    first = message;
  } else if (message.method === "second") {
    send({ id: message.id, result: { order: 2 } });
    send({ id: first.id, result: { order: 1 } });
  } else if (message.method === "overflow") {
    process.stderr.write("x".repeat(12000));
  } else if (message.method === "protocol-error") {
    send({ id: message.id, error: { code: -32602, message: "dynamic tool schema rejected" } });
  } else if (message.id === 900) {
    send({ method: "tool/result-observed", params: message.result });
  }
});
`, "utf8");
  await chmod(command, 0o755);
  return Object.freeze({ command, cwd });
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function silentAppServer(): Promise<Readonly<{
  command: string;
  cwd: string;
  pidFile: string;
}>> {
  const cwd = await mkdtemp(join(tmpdir(), "pmh-codex-app-server-silent-"));
  directories.push(cwd);
  const command = join(cwd, "silent-codex");
  const pidFile = join(cwd, "child.pid");
  await writeFile(command, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
// Never answer the initialize handshake; just stay alive.
process.stdin.on("data", () => {});
setInterval(() => {}, 1000);
`, "utf8");
  await chmod(command, 0o755);
  return Object.freeze({ command, cwd, pidFile });
}

async function processGone(pid: number, waitMs: number): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

describe("Codex app-server JSONL process transport", () => {
  it("tears down the spawned child when the initialize handshake fails", async () => {
    const fixture = await silentAppServer();
    const factory = createCodexAppServerConnectionFactory({
      command: fixture.command,
      cwd: fixture.cwd,
      requestTimeoutMs: 1_000,
    });

    await expect(factory()).rejects.toThrow(/timed out/iu);

    const { readFile } = await import("node:fs/promises");
    const pid = Number(await readFile(fixture.pidFile, "utf8"));
    expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
    expect(await processGone(pid, 3_000)).toBe(true);
  });

  it("correlates out-of-order responses and carries notifications and server requests", async () => {
    const fixture = await fakeAppServer();
    const connection = await createCodexAppServerConnectionFactory({
      ...fixture,
      requestTimeoutMs: 2_000,
    })();

    const notification = await connection.nextInbound(2_000);
    const toolRequest = await connection.nextInbound(2_000);
    expect(notification).toEqual({
      method: "thread/status/changed",
      params: { status: "ready" },
    });
    expect(toolRequest).toEqual({
      id: 900,
      method: "item/tool/call",
      params: { callId: "call:1" },
    });

    const first = connection.request("first", {});
    const second = connection.request("second", {});
    await expect(second).resolves.toEqual({ order: 2 });
    await expect(first).resolves.toEqual({ order: 1 });

    connection.respond(900, { success: true });
    await expect(connection.nextInbound(2_000)).resolves.toEqual({
      method: "tool/result-observed",
      params: { success: true },
    });
    await connection.close();
  });

  it("bounds request waits and rejects pending work when closed", async () => {
    const fixture = await fakeAppServer();
    const connection = await createCodexAppServerConnectionFactory({
      ...fixture,
      requestTimeoutMs: 1_000,
    })();
    await connection.nextInbound(2_000);
    await connection.nextInbound(2_000);

    await expect(connection.request("slow", {}, 1_000)).rejects.toThrow(
      "Codex app-server request timed out: slow",
    );
    const pending = connection.request("slow", {}, 5_000);
    const rejected = expect(pending).rejects.toThrow("Codex app-server connection closed");
    await connection.close();
    await rejected;
  });

  it("terminates the process when combined stdout and stderr exceed the bound", async () => {
    const fixture = await fakeAppServer();
    const connection = await createCodexAppServerConnectionFactory({
      ...fixture,
      requestTimeoutMs: 2_000,
      maxOutputBytes: 10_000,
    })();
    await connection.nextInbound(2_000);
    await connection.nextInbound(2_000);

    await expect(connection.request("overflow", {}, 2_000)).rejects.toThrow(
      "Codex app-server output bound exceeded",
    );
    await connection.close();
  });

  it("retains bounded app-server protocol error details", async () => {
    const fixture = await fakeAppServer();
    const connection = await createCodexAppServerConnectionFactory({
      ...fixture,
      requestTimeoutMs: 2_000,
    })();
    await connection.nextInbound(2_000);
    await connection.nextInbound(2_000);

    await expect(connection.request("protocol-error", {}, 2_000)).rejects.toThrow(
      "code=-32602; message=dynamic tool schema rejected",
    );
    await connection.close();
  });
});
