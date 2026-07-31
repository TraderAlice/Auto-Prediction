import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createControlPlane } from "../src/index.js";

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
  const controlPlane = createControlPlane();
  servers.push(controlPlane.server);
  await new Promise<void>((resolve) =>
    controlPlane.server.listen(0, "127.0.0.1", resolve),
  );
  const address = controlPlane.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("control-plane HTTP surface", () => {
  it("serves a live-disabled projection from a process", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/api/v1/projection`);
    const projection = (await response.json()) as {
      identity: { mode: string; stateHash: string };
      system: { liveExecutionEnabled: boolean; controlPlaneConnected: boolean };
      ai: { architecture: string };
    };
    expect(response.status).toBe(200);
    expect(projection.identity.mode).toBe("CONTROL_PLANE");
    expect(projection.identity.stateHash).toMatch(/^sha256:/);
    expect(projection.system).toMatchObject({
      liveExecutionEnabled: false,
      controlPlaneConnected: true,
    });
    expect(projection.ai.architecture).toBe("SCOUT_THEN_VERIFY");
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
      executionAuthority: boolean;
      hypotheses: { authority: string }[];
    };
    expect(run.executionAuthority).toBe(false);
    expect(run.hypotheses[0]?.authority).toBe("PROPOSE_ONLY");
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
