import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createControlPlane,
  DiscoveryPool,
  type DiscoveryWorker,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const servers: ReturnType<typeof createControlPlane>["server"][] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
});

async function listen() {
  return (await listenControlPlane()).baseUrl;
}

async function listenControlPlane(
  options?: Parameters<typeof createControlPlane>[0],
) {
  const controlPlane = createControlPlane(options);
  servers.push(controlPlane.server);
  await new Promise<void>((resolve) =>
    controlPlane.server.listen(0, "127.0.0.1", resolve),
  );
  const address = controlPlane.server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    controlPlane,
  };
}

async function closeTracked(
  server: ReturnType<typeof createControlPlane>["server"],
): Promise<void> {
  const index = servers.indexOf(server);
  if (index >= 0) servers.splice(index, 1);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe("control-plane HTTP surface", () => {
  it("serves a live-disabled projection from a process", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/api/v1/projection`);
    const projection = (await response.json()) as {
      identity: { mode: string; stateHash: string };
      system: { liveExecutionEnabled: boolean; controlPlaneConnected: boolean };
      ai: { architecture: string };
      discoveryDesk: {
        storage: { mode: string; durable: boolean; idempotencyKey: string };
      };
    };
    expect(response.status).toBe(200);
    expect(projection.identity.mode).toBe("CONTROL_PLANE");
    expect(projection.identity.stateHash).toMatch(/^sha256:/);
    expect(projection.system).toMatchObject({
      liveExecutionEnabled: false,
      controlPlaneConnected: true,
    });
    expect(projection.ai.architecture).toBe("SCOUT_THEN_VERIFY");
    expect(projection.discoveryDesk.storage).toEqual({
      mode: "MEMORY",
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "taskId",
    });
  });

  it("accepts discovery work without returning execution authority", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Will NYC rainfall exceed 0.25 inches?",
        venueIds: ["kalshi", "polymarket-global"],
      }),
    });
    const run = (await response.json()) as {
      runId: string;
      taskId: string;
      executionAuthority: boolean;
      idempotentReplay: boolean;
      hypotheses: { authority: string }[];
    };
    expect(run.executionAuthority).toBe(false);
    expect(run.taskId).toMatch(/^task:[a-f0-9]{64}$/);
    expect(run.hypotheses[0]?.authority).toBe("PROPOSE_ONLY");
    expect(run.idempotentReplay).toBe(false);
    const replay = (await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "  Will NYC rainfall exceed 0.25 inches?  ",
        venueIds: ["polymarket-global", "kalshi", "kalshi"],
      }),
    }).then((replayResponse) => replayResponse.json())) as {
      runId: string;
      idempotentReplay: boolean;
    };
    expect(replay).toEqual(
      expect.objectContaining({
        runId: run.runId,
        idempotentReplay: true,
      }),
    );
    const ledger = (await fetch(`${baseUrl}/api/v1/discovery/runs`).then(
      (ledgerResponse) => ledgerResponse.json(),
    )) as {
      runCount: number;
      unreviewedCount: number;
      runs: { question: string; executionAuthority: boolean }[];
    };
    expect(ledger).toMatchObject({ runCount: 1, unreviewedCount: 1 });
    expect(ledger.runs[0]).toMatchObject({
      question: "Will NYC rainfall exceed 0.25 inches?",
      executionAuthority: false,
    });
    const malformed = await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: 123,
        question: "Malformed task identity?",
        venueIds: ["kalshi", 42],
      }),
    });
    expect(malformed.status).toBe(400);
  });

  it("restores taskId idempotency from SQLite after a server restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-server-state-"));
    const path = join(directory, "control-plane.sqlite");
    try {
      const first = await listenControlPlane({
        discoveryStore: new SqliteOperationalStore(path),
      });
      const request = {
        taskId: "task:restart-safe",
        question: "Will the restart fixture resolve yes?",
        venueIds: ["fixture-alpha", "fixture-beta"],
      };
      const created = (await fetch(`${first.baseUrl}/api/v1/discovery/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      }).then((response) => response.json())) as {
        runId: string;
        idempotentReplay: boolean;
      };
      expect(created.idempotentReplay).toBe(false);
      await closeTracked(first.controlPlane.server);

      const second = await listenControlPlane({
        discoveryStore: new SqliteOperationalStore(path),
      });
      const restoredDesk = (await fetch(
        `${second.baseUrl}/api/v1/discovery/runs`,
      ).then((response) => response.json())) as {
        runCount: number;
        storage: { mode: string; durable: boolean };
      };
      expect(restoredDesk).toMatchObject({
        runCount: 1,
        storage: { mode: "SQLITE_WAL", durable: true },
      });
      const replayed = (await fetch(
        `${second.baseUrl}/api/v1/discovery/runs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        },
      ).then((response) => response.json())) as {
        runId: string;
        idempotentReplay: boolean;
      };
      expect(replayed).toEqual(
        expect.objectContaining({
          runId: created.runId,
          idempotentReplay: true,
        }),
      );
      const conflict = await fetch(`${second.baseUrl}/api/v1/discovery/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, question: "Different scope?" }),
      });
      expect(conflict.status).toBe(409);
      await closeTracked(second.controlPlane.server);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("coalesces concurrent requests for the same taskId", async () => {
    let calls = 0;
    const worker: DiscoveryWorker = {
      workerId: "delayed-fixture-worker",
      kind: "HEURISTIC",
      costTier: "FREE",
      async discover(task) {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [
          {
            hypothesisId: "hypothesis:coalesced",
            workerId: "delayed-fixture-worker",
            thesis: "Concurrent fixture requests share one bounded run.",
            strategyKind: "SAME_CLAIM_CROSS_VENUE",
            venueIds: task.venueIds,
            claimSearchTerms: ["concurrent", "fixture"],
            confidenceBps: 1_000,
            authority: "PROPOSE_ONLY",
            reviewStatus: "UNREVIEWED",
          },
        ];
      },
    };
    const { baseUrl } = await listenControlPlane({
      discoveryPool: new DiscoveryPool([worker]),
    });
    const body = JSON.stringify({
      taskId: "task:coalesced",
      question: "Can concurrent discovery requests be coalesced?",
      venueIds: ["fixture-alpha", "fixture-beta"],
    });
    const responses = await Promise.all(
      [0, 1].map(() =>
        fetch(`${baseUrl}/api/v1/discovery/runs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }).then((response) => response.json()),
      ),
    ) as { runId: string; idempotentReplay: boolean }[];
    expect(calls).toBe(1);
    expect(new Set(responses.map((response) => response.runId)).size).toBe(1);
    expect(responses.map((response) => response.idempotentReplay).sort()).toEqual([
      false,
      true,
    ]);
  });

  it("replays verified books in memory with literal false effects", async () => {
    const baseUrl = await listen();
    const initial = (await fetch(`${baseUrl}/api/v1/books`).then((response) =>
      response.json(),
    )) as { replayCount: number; books: unknown[] };
    expect(initial).toMatchObject({ replayCount: 1 });
    expect(initial.books).toHaveLength(3);

    const response = await fetch(`${baseUrl}/api/v1/books/replay`, {
      method: "POST",
    });
    const replay = (await response.json()) as {
      effects: {
        externalWrites: boolean;
        valueMovingActions: boolean;
        liveExecutionEnabled: boolean;
      };
      bookDesk: { replayCount: number; books: unknown[] };
    };
    expect(response.status).toBe(200);
    expect(replay.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
    expect(replay.bookDesk.replayCount).toBe(2);
    expect(replay.bookDesk.books).toHaveLength(3);
  });

  it("serves content-addressed replay qualification evidence", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/api/v1/qualification`);
    const qualification = (await response.json()) as {
      replayChaos: {
        status: string;
        caseCount: number;
        suiteHash: string;
        effects: { liveExecutionEnabled: boolean };
      };
      campaignEvidence: {
        status: string;
        artifactHash: string;
        sourceArtifacts: unknown[];
      };
      reviewedCompilation: {
        scope: string;
        status: string;
        artifactHash: string;
        effects: { liveExecutionEnabled: boolean };
      };
    };
    expect(response.status).toBe(200);
    expect(qualification.replayChaos).toMatchObject({
      status: "PASS",
      caseCount: 6,
      effects: { liveExecutionEnabled: false },
    });
    expect(qualification.replayChaos.suiteHash).toMatch(/^sha256:/);
    expect(qualification.campaignEvidence.status).toBe("PASS");
    expect(qualification.campaignEvidence.sourceArtifacts).toHaveLength(3);
    expect(qualification.campaignEvidence.artifactHash).toMatch(/^sha256:/);
    expect(qualification.reviewedCompilation).toMatchObject({
      scope: "SYNTHETIC_ARCHITECTURE_QUALIFICATION",
      status: "PASS",
      effects: { liveExecutionEnabled: false },
    });
    expect(qualification.reviewedCompilation.artifactHash).toMatch(/^sha256:/);
  });

  it("broadcasts the replayed projection to connected SSE clients", async () => {
    const baseUrl = await listen();
    const abort = new AbortController();
    const eventResponse = await fetch(`${baseUrl}/api/v1/events`, {
      signal: abort.signal,
    });
    const reader = eventResponse.body?.getReader();
    if (reader === undefined) throw new Error("event stream has no body");
    const decoder = new TextDecoder();
    const first = await reader.read();
    expect(decoder.decode(first.value)).toContain("event: projection");

    await fetch(`${baseUrl}/api/v1/books/replay`, { method: "POST" });
    const second = await reader.read();
    const event = decoder.decode(second.value);
    expect(event).toContain("event: projection");
    expect(event).toContain('"replayCount":2');
    await reader.cancel();
    abort.abort();
  });

  it("broadcasts active and completed discovery ledger state", async () => {
    const baseUrl = await listen();
    const abort = new AbortController();
    const eventResponse = await fetch(`${baseUrl}/api/v1/events`, {
      signal: abort.signal,
    });
    const reader = eventResponse.body?.getReader();
    if (reader === undefined) throw new Error("event stream has no body");
    await reader.read();

    await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Will the Fed cut rates before September?",
        venueIds: ["kalshi", "polymarket-global"],
      }),
    });
    const decoder = new TextDecoder();
    let events = "";
    for (let index = 0; index < 4 && !events.includes('"runCount":1'); index += 1) {
      const chunk = await reader.read();
      events += decoder.decode(chunk.value);
    }
    expect(events).toContain('"activeRuns":1');
    expect(events).toContain('"runCount":1');
    expect(events).toContain('"executionAuthority":false');
    await reader.cancel();
    abort.abort();
  });
});
