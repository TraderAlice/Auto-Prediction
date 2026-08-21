import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import test from "node:test";

import {
  assertPortAvailable,
  assertStudioPortsAvailable,
  startStudioChildren,
  superviseStudio,
} from "./studio-supervisor.mjs";

function fakeChild(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.killSignals = [];
  child.kill = (signal) => child.killSignals.push(signal);
  return child;
}

test("stops Studio and fails when the control plane cannot bind", async () => {
  const controlPlane = fakeChild();
  const studio = fakeChild();
  const diagnostics = [];
  const result = superviseStudio([
    { name: "control plane", child: controlPlane },
    { name: "Studio", child: studio },
  ], { stderr: { write: (value) => diagnostics.push(value) } });

  controlPlane.emit("exit", 1, null);

  assert.equal(await result, 1);
  assert.deepEqual(studio.killSignals, ["SIGTERM"]);
  assert.match(diagnostics.join(""), /control plane exited \(code 1\)/);
});

test("stops the control plane when Studio exits cleanly", async () => {
  const controlPlane = fakeChild();
  const studio = fakeChild();
  const result = superviseStudio([
    { name: "control plane", child: controlPlane },
    { name: "Studio", child: studio },
  ], { stderr: { write() {} } });

  studio.emit("exit", 0, null);

  assert.equal(await result, 0);
  assert.deepEqual(controlPlane.killSignals, ["SIGTERM"]);
});

test("treats a child spawn error as a failed unit", async () => {
  const controlPlane = fakeChild();
  const studio = fakeChild();
  const result = superviseStudio([
    { name: "control plane", child: controlPlane },
    { name: "Studio", child: studio },
  ], { stderr: { write() {} } });

  studio.emit("error", new Error("spawn failed"));

  assert.equal(await result, 1);
  assert.deepEqual(controlPlane.killSignals, ["SIGTERM"]);
});

test("rejects before either child starts when port 4100 is occupied", async () => {
  const occupant = createServer();
  await new Promise((resolveListen) => occupant.listen(0, "127.0.0.1", resolveListen));
  const address = occupant.address();
  assert.ok(address !== null && typeof address === "object");

  await assert.rejects(
    assertPortAvailable({ port: address.port }),
    /control-plane port .* is already in use/,
  );
  await new Promise((resolveClose) => occupant.close(resolveClose));
});

test("preflights both exact ports only in OpenAlice managed mode", async () => {
  const calls = [];
  const checkPort = async (input) => calls.push(input);
  await assertStudioPortsAvailable({
    managed: true,
    host: "127.0.0.1",
    httpPort: 49_321,
    controlPlanePort: 49_322,
    strictHttpPort: true,
  }, checkPort);
  assert.deepEqual(calls, [
    { host: "127.0.0.1", port: 49_322, name: "control-plane" },
    { host: "127.0.0.1", port: 49_321, name: "Studio" },
  ]);

  calls.length = 0;
  await assertStudioPortsAvailable({
    managed: false,
    host: "127.0.0.1",
    httpPort: 5_173,
    controlPlanePort: 4_100,
    strictHttpPort: false,
  }, checkPort);
  assert.deepEqual(calls, [
    { host: "127.0.0.1", port: 4_100, name: "control-plane" },
  ]);
});

test("rejects an occupied managed Studio entry port instead of incrementing", async () => {
  const occupant = createServer();
  await new Promise((resolveListen) => occupant.listen(0, "127.0.0.1", resolveListen));
  const address = occupant.address();
  assert.ok(address !== null && typeof address === "object");
  const controlPlaneProbe = createServer();
  await new Promise((resolveListen) =>
    controlPlaneProbe.listen(0, "127.0.0.1", resolveListen)
  );
  const controlPlaneAddress = controlPlaneProbe.address();
  assert.ok(controlPlaneAddress !== null && typeof controlPlaneAddress === "object");
  const controlPlanePort = controlPlaneAddress.port;
  await new Promise((resolveClose) => controlPlaneProbe.close(resolveClose));
  await assert.rejects(assertStudioPortsAvailable({
    managed: true,
    host: "127.0.0.1",
    httpPort: address.port,
    controlPlanePort,
    strictHttpPort: true,
  }), /Studio port .* is already in use/);
  await new Promise((resolveClose) => occupant.close(resolveClose));
});

test("runs the control plane without a watcher that can hide startup failure", () => {
  const calls = [];
  startStudioChildren({
    nodeExecutable: "/node",
    pnpmExecutable: "/pnpm.cjs",
    spawnProcess: (...args) => {
      calls.push(args);
      return fakeChild();
    },
    environment: { OPENALICE_CAPABILITY: "studio" },
  });

  assert.deepEqual(calls.map(([executable, args]) => [executable, args]), [
    ["/node", ["/pnpm.cjs", "--filter", "@pmh/control-plane", "exec", "tsx", "src/main.ts"]],
    ["/node", ["/pnpm.cjs", "--filter", "@pmh/studio", "dev"]],
  ]);
  assert.equal(calls[0][2].env.OPENALICE_CAPABILITY, "studio");
  assert.equal(calls[1][2].env.OPENALICE_CAPABILITY, "studio");
});
