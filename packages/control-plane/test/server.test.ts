import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createControlPlane,
  CatalogObservationDesk,
  catalogObservationSources,
  type CatalogObservationSource,
  createOpenAiDiscoveryRuntime,
  createPiInvestigatorRuntime,
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
  const controlPlane = createControlPlane({
    modelRuntime: createOpenAiDiscoveryRuntime({}),
    ...options,
  });
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
      ai: {
        architecture: string;
        catalogContext: {
          listingCount: number;
          venueCount: number;
          sourceFixtureCount: number;
          corpusIdentity: string;
        };
        modelProvider: {
          configured: boolean;
          model: string;
          responseStorage: boolean;
        };
        investigator: {
          configured: boolean;
          model: string;
          tools: string[];
          sessionPersistence: boolean;
        };
        workers: { workerId: string; status: string }[];
      };
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
    expect(projection.ai.catalogContext).toMatchObject({
      listingCount: 12,
      venueCount: 6,
      sourceFixtureCount: 7,
    });
    expect(projection.ai.catalogContext.corpusIdentity).toMatch(/^sha256:/);
    expect(projection.ai.modelProvider).toMatchObject({
      configured: false,
      model: "gpt-5.6-luna",
      responseStorage: false,
    });
    expect(projection.ai.investigator).toMatchObject({
      configured: false,
      model: "deepseek-v4-flash",
      tools: ["read", "grep", "find", "ls"],
      sessionPersistence: false,
    });
    expect(projection.ai.workers).toContainEqual(
      expect.objectContaining({
        workerId: "model-fast-lane",
        status: "NEEDS_KEY",
      }),
    );
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
        question: "Highest temperature in Boston on July 31, 2026?",
        venueIds: ["gemini-predictions"],
      }),
    });
    const run = (await response.json()) as {
      runId: string;
      taskId: string;
      executionAuthority: boolean;
      idempotentReplay: boolean;
      hypotheses: { authority: string }[];
      catalogContextIdentity: string;
      catalogListingCount: number;
      catalogContextSource: string;
    };
    expect(run.executionAuthority).toBe(false);
    expect(run.taskId).toMatch(/^task:[a-f0-9]{64}$/);
    expect(run.hypotheses[0]?.authority).toBe("PROPOSE_ONLY");
    expect(run.catalogContextIdentity).toMatch(/^sha256:/);
    expect(run.catalogListingCount).toBe(6);
    expect(run.catalogContextSource).toBe("VERIFIED_FIXTURE_CATALOGS");
    expect(run.idempotentReplay).toBe(false);
    const replay = (await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "  Highest temperature in Boston on July 31, 2026?  ",
        venueIds: ["gemini-predictions", "gemini-predictions"],
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
      question: "Highest temperature in Boston on July 31, 2026?",
      executionAuthority: false,
    });
    const caseDesk = (await fetch(`${baseUrl}/api/v1/projection`).then(
      (projectionResponse) => projectionResponse.json(),
    )) as {
      ai: {
        researchDesk: {
          caseCount: number;
          needsInvestigationCount: number;
          cases: {
            status: string;
            promotionEligible: boolean;
            executionAuthority: boolean;
          }[];
        };
      };
    };
    expect(caseDesk.ai.researchDesk).toMatchObject({
      caseCount: 1,
      needsInvestigationCount: 1,
      cases: [
        {
          status: "NEEDS_INVESTIGATION",
          promotionEligible: false,
          executionAuthority: false,
        },
      ],
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

  it("triages only a current server-bound radar pair through the scout pool", async () => {
    let nowMs = Date.parse("2026-08-01T04:07:36.000Z");
    const source = (
      venueId: string,
      title: string,
      closesAt?: string,
    ): CatalogObservationSource => ({
      venueId,
      protocolIdentity: `${venueId}:v1`,
      sourceUrl: `https://example.test/${venueId}`,
      decode: (fixture) => [
        {
          venueId,
          venueInstrumentId: `${venueId}-bnb-hourly`,
          title,
          description: "Whether BNB finishes the hour up or down.",
          status: "OPEN",
          mechanism: "ONCHAIN_CLOB",
          ...(closesAt === undefined ? {} : { closesAt }),
          outcomes: [
            { venueOutcomeId: "up", label: "Up" },
            { venueOutcomeId: "down", label: "Down" },
          ],
          priceScale: 1_000_000n,
          quantityScale: 1_000_000n,
          sourceFixtureHash: fixture.rawHash,
          protocolIdentity: `${venueId}:v1`,
        },
      ],
    });
    const sources = [
      source(
        "opinion",
        "BNB Up or Down - Hourly (Aug 01, 2026 05:00 UTC Close)",
      ),
      source(
        "limitless",
        "BNB Up or Down - Hourly",
        "2026-08-01T05:00:00.000Z",
      ),
    ];
    const desk = new CatalogObservationDesk({
      sources,
      now: () => nowMs,
      fetcher: async (input) =>
        new Response(JSON.stringify({ source: input }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    const piRuntime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        runner: async () => ({
          exitCode: 0,
          stdout: JSON.stringify({
            summary: "The bounded radar pair needs independent rule review.",
            candidateListingRefs: [
              "limitless:limitless-bnb-hourly",
              "opinion:opinion-bnb-hourly",
            ],
            findings: [],
            missingEvidence: ["Independent oracle and comparator review"],
          }),
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        }),
      },
    );
    const { baseUrl } = await listenControlPlane({
      catalogObservationDesk: desk,
      piRuntime,
    });
    await desk.refresh();
    const radar = (await fetch(`${baseUrl}/api/v1/radar`).then((response) =>
      response.json(),
    )) as {
      candidateCount: number;
      candidates: { candidateId: string }[];
      effects: { liveExecutionEnabled: boolean };
    };
    expect(radar).toMatchObject({
      candidateCount: 1,
      effects: { liveExecutionEnabled: false },
    });
    const candidateId = radar.candidates[0]?.candidateId;
    if (candidateId === undefined) throw new Error("missing radar candidate");

    const triageResponse = await fetch(`${baseUrl}/api/v1/radar/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateId }),
    });
    const triage = (await triageResponse.json()) as {
      radarCandidateId: string;
      idempotentReplay: boolean;
      catalogListingCount: number;
      catalogContextSource: string;
      executionAuthority: boolean;
      hypotheses: {
        listingRefs: string[];
        authority: string;
        reviewStatus: string;
      }[];
    };
    expect(triageResponse.status).toBe(200);
    expect(triage).toMatchObject({
      radarCandidateId: candidateId,
      idempotentReplay: false,
      catalogListingCount: 2,
      catalogContextSource: "QUALIFIED_LIVE_OBSERVATIONS",
      executionAuthority: false,
    });
    expect(triage.hypotheses[0]).toMatchObject({
      listingRefs: ["limitless:limitless-bnb-hourly", "opinion:opinion-bnb-hourly"],
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });

    const replay = await fetch(`${baseUrl}/api/v1/radar/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateId }),
    }).then((response) => response.json()) as { idempotentReplay: boolean };
    expect(replay.idempotentReplay).toBe(true);

    nowMs += 1_000;
    await desk.refresh();
    const refreshedRadar = desk.radar();
    expect(refreshedRadar.candidates[0]?.candidateId).not.toBe(candidateId);

    const investigationResponse = await fetch(
      `${baseUrl}/api/v1/radar/investigate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId }),
      },
    );
    const investigation = (await investigationResponse.json()) as {
      status: string;
      radarCandidateId: string;
      taskId: string;
      catalogListingCount: number;
      authority: string;
      reviewStatus: string;
      executionAuthority: boolean;
      report: { result: { executionAuthority: boolean } };
    };
    expect(investigationResponse.status).toBe(200);
    expect(investigation).toMatchObject({
      status: "PASS",
      radarCandidateId: candidateId,
      taskId: expect.stringMatching(/^task:[0-9a-f]{64}$/),
      catalogListingCount: 2,
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      executionAuthority: false,
      report: { result: { executionAuthority: false } },
    });
    const caseReplay = await fetch(
      `${baseUrl}/api/v1/research-cases/investigate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: investigation.taskId }),
      },
    ).then((response) => response.json()) as { idempotentReplay: boolean };
    expect(caseReplay.idempotentReplay).toBe(true);
    const joinedCase = (await fetch(`${baseUrl}/api/v1/projection`).then(
      (response) => response.json(),
    )) as {
      ai: {
        researchDesk: {
          cases: { taskIds: string[]; status: string; missingEvidence: string[] }[];
        };
      };
    };
    expect(
      joinedCase.ai.researchDesk.cases.find((item) =>
        item.taskIds.includes(investigation.taskId),
      ),
    ).toMatchObject({
      status: "EVIDENCE_GAPS",
      missingEvidence: ["Independent oracle and comparator review"],
    });

    nowMs += 900_001;
    const stale = await fetch(`${baseUrl}/api/v1/radar/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateId }),
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      executionAuthority: false,
      diagnostic: expect.stringMatching(/no longer present/),
    });
  });

  it("refreshes an anonymous catalog observation without promoting it", async () => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "polymarket-global",
    );
    if (source === undefined) throw new Error("missing Polymarket source");
    const bytes = await readFile(
      join(
        import.meta.dirname,
        "../../../projects/fixtures/polymarket-global/2026-07-31/polymarket-catalog.json",
      ),
    );
    const { baseUrl } = await listenControlPlane({
      catalogObservationDesk: new CatalogObservationDesk({
        sources: [source],
        now: () => Date.parse("2026-08-01T03:25:00.000Z"),
        fetcher: async (_input, init) => {
          expect(init).toMatchObject({ method: "GET", credentials: "omit" });
          return new Response(new Uint8Array(bytes).buffer, {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      }),
    });
    const response = await fetch(
      `${baseUrl}/api/v1/catalog/observations/refresh`,
      { method: "POST" },
    );
    const projection = (await response.json()) as {
      status: string;
      promotion: string;
      listingCount: number;
      sources: { credentialsUsed: boolean; rawHash: string }[];
      effects: {
        externalWrites: boolean;
        valueMovingActions: boolean;
        liveExecutionEnabled: boolean;
      };
    };
    expect(response.status).toBe(200);
    expect(projection).toMatchObject({
      status: "READY",
      promotion: "OBSERVE_ONLY",
      listingCount: 1,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.sources[0]).toMatchObject({
      credentialsUsed: false,
      rawHash: expect.stringMatching(/^sha256:/),
    });
    const discoveryResponse = await fetch(
      `${baseUrl}/api/v1/discovery/runs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: "New Rihanna Album before GTA VI?",
          venueIds: ["polymarket-global"],
          catalogMode: "CURRENT_OBSERVATIONS",
        }),
      },
    );
    const discovery = (await discoveryResponse.json()) as {
      catalogContextSource: string;
      catalogListingCount: number;
      executionAuthority: boolean;
      hypotheses: { authority: string; reviewStatus: string }[];
    };
    expect(discoveryResponse.status).toBe(200);
    expect(discovery).toMatchObject({
      catalogContextSource: "QUALIFIED_LIVE_OBSERVATIONS",
      catalogListingCount: 1,
      executionAuthority: false,
      hypotheses: [
        { authority: "PROPOSE_ONLY", reviewStatus: "UNREVIEWED" },
      ],
    });
    const current = await fetch(
      `${baseUrl}/api/v1/catalog/observations`,
    ).then((result) => result.json());
    expect(current).toEqual(projection);
  });

  it("rejects explicitly requested live context after its freshness window", async () => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "polymarket-global",
    );
    if (source === undefined) throw new Error("missing Polymarket source");
    const bytes = await readFile(
      join(
        import.meta.dirname,
        "../../../projects/fixtures/polymarket-global/2026-07-31/polymarket-catalog.json",
      ),
    );
    let nowMs = Date.parse("2026-08-01T03:25:00.000Z");
    const { baseUrl } = await listenControlPlane({
      catalogObservationDesk: new CatalogObservationDesk({
        sources: [source],
        now: () => nowMs,
        contextMaxAgeMs: 1_000,
        fetcher: async () =>
          new Response(new Uint8Array(bytes).buffer, {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      }),
    });
    await fetch(`${baseUrl}/api/v1/catalog/observations/refresh`, {
      method: "POST",
    });
    nowMs += 1_001;
    const response = await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "New Rihanna Album before GTA VI?",
        venueIds: ["polymarket-global"],
        catalogMode: "CURRENT_OBSERVATIONS",
      }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      diagnostic: expect.stringContaining("last observation is stale"),
      executionAuthority: false,
    });
  });

  it("fails closed when an investigation is requested without pi configuration", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/api/v1/investigations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Investigate the Boston temperature partition",
        venueIds: ["gemini-predictions"],
      }),
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      diagnostic: "pi investigator is not configured",
      executionAuthority: false,
    });
  });

  it("runs and retains an explicitly requested pi investigation", async () => {
    const piRuntime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        runner: async () => ({
          exitCode: 0,
          stdout: JSON.stringify({
            summary: "The fixture partition needs independent rule evidence.",
            candidateListingRefs: [],
            findings: [],
            missingEvidence: ["Official resolution rules"],
          }),
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        }),
      },
    );
    const { baseUrl } = await listenControlPlane({ piRuntime });
    const response = await fetch(`${baseUrl}/api/v1/investigations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Investigate the Boston temperature partition",
        venueIds: ["gemini-predictions"],
      }),
    });
    const record = (await response.json()) as {
      investigationId: string;
      status: string;
      report: { artifactHash: string; result: { executionAuthority: boolean } };
      authority: string;
      reviewStatus: string;
      executionAuthority: boolean;
      idempotentReplay: boolean;
    };
    expect(response.status).toBe(200);
    expect(record).toMatchObject({
      status: "PASS",
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      executionAuthority: false,
      idempotentReplay: false,
      report: { result: { executionAuthority: false } },
    });
    expect(record.investigationId).toMatch(/^investigation:[0-9a-f]{64}$/);
    expect(record.report.artifactHash).toMatch(/^sha256:/);

    const desk = (await fetch(`${baseUrl}/api/v1/investigations`).then(
      (deskResponse) => deskResponse.json(),
    )) as { activeCount: number; passCount: number; records: unknown[] };
    expect(desk).toMatchObject({ activeCount: 0, passCount: 1 });
    expect(desk.records).toHaveLength(1);

    const replay = await fetch(`${baseUrl}/api/v1/investigations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "  Investigate the Boston temperature partition  ",
        venueIds: ["gemini-predictions", "gemini-predictions"],
      }),
    });
    await expect(replay.json()).resolves.toMatchObject({
      investigationId: record.investigationId,
      idempotentReplay: true,
      executionAuthority: false,
    });
  });

  it("restores pi reports and idempotency from SQLite after a server restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-investigation-state-"));
    const path = join(directory, "control-plane.sqlite");
    let invocations = 0;
    const piRuntime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        runner: async () => {
          invocations += 1;
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              summary: "Persistent bounded report.",
              candidateListingRefs: [],
              findings: [],
              missingEvidence: ["Independent rule review"],
            }),
            stderr: "",
            timedOut: false,
            outputLimitExceeded: false,
          };
        },
      },
    );
    const request = {
      taskId: "task:investigation:restart-safe",
      question: "Investigate persistent bounded context",
      venueIds: ["gemini-predictions"],
    };
    try {
      const first = await listenControlPlane({
        discoveryStore: new SqliteOperationalStore(path),
        piRuntime,
      });
      const created = (await fetch(`${first.baseUrl}/api/v1/investigations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      }).then((response) => response.json())) as {
        investigationId: string;
        idempotentReplay: boolean;
      };
      expect(created.idempotentReplay).toBe(false);
      expect(invocations).toBe(1);
      await closeTracked(first.controlPlane.server);

      const second = await listenControlPlane({
        discoveryStore: new SqliteOperationalStore(path),
        piRuntime,
      });
      const restored = (await fetch(
        `${second.baseUrl}/api/v1/investigations`,
      ).then((response) => response.json())) as {
        passCount: number;
        storage: {
          mode: string;
          durable: boolean;
          schemaVersion: number;
        };
        records: { investigationId: string }[];
      };
      expect(restored).toMatchObject({
        passCount: 1,
        storage: {
          mode: "SQLITE_WAL",
          durable: true,
          schemaVersion: 3,
        },
        records: [{ investigationId: created.investigationId }],
      });
      const replayed = (await fetch(
        `${second.baseUrl}/api/v1/investigations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        },
      ).then((response) => response.json())) as {
        investigationId: string;
        idempotentReplay: boolean;
      };
      expect(replayed).toEqual(
        expect.objectContaining({
          investigationId: created.investigationId,
          idempotentReplay: true,
        }),
      );
      expect(invocations).toBe(1);
      const conflict = await fetch(`${second.baseUrl}/api/v1/investigations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...request,
          question: "Substituted investigation scope",
        }),
      });
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({
        executionAuthority: false,
        diagnostic: "taskId is already bound to another investigation scope",
      });
      await closeTracked(second.controlPlane.server);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains a grounded run with no matching hypothesis", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "ZXQJ QVBX NMPZ",
        venueIds: ["gemini-predictions"],
      }),
    });
    const run = (await response.json()) as {
      hypotheses: unknown[];
      catalogContextIdentity: string;
      catalogListingCount: number;
      executionAuthority: boolean;
    };
    expect(response.status).toBe(200);
    expect(run).toMatchObject({
      hypotheses: [],
      catalogListingCount: 7,
      executionAuthority: false,
    });
    expect(run.catalogContextIdentity).toMatch(/^sha256:/);
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
      async discover() {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [];
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
      realCandidatePreflight: {
        status: string;
        classification: string;
        catalogIndicativeGrossEdgeBps: string;
        venueReportedBuyGrossEdgeBps: string;
        verifierInvoked: boolean;
        arbitrageVerified: boolean;
        artifactHash: string;
        effects: { liveExecutionEnabled: boolean };
      };
      realCandidateDepth: {
        status: string;
        classification: string;
        screenQuantity: string;
        quantityBound: boolean;
        totalCostBeforeFees: string;
        grossEdgeBpsBeforeFees: string;
        verifierInvoked: boolean;
        arbitrageVerified: boolean;
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
    expect(qualification.realCandidatePreflight).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      catalogIndicativeGrossEdgeBps: "55",
      venueReportedBuyGrossEdgeBps: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(qualification.realCandidatePreflight.artifactHash).toMatch(
      /^sha256:/,
    );
    expect(qualification.realCandidateDepth).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      screenQuantity: "500000000",
      quantityBound: true,
      totalCostBeforeFees: "500000000",
      grossEdgeBpsBeforeFees: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(qualification.realCandidateDepth.artifactHash).toMatch(/^sha256:/);
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
