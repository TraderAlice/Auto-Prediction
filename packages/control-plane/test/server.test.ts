import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  AnonymousSimulationMaterializerDesk,
  CandidateWatchDesk,
  candidateWatchSources,
  createControlPlane,
  CatalogObservationDesk,
  CatalogRefreshScheduler,
  catalogObservationSources,
  createMarketArchaeologistDesk,
  type CatalogObservationSource,
  createOpenAiDiscoveryRuntime,
  createPiInvestigatorRuntime,
  createSemanticReviewDesk,
  DiscoveryPool,
  RealCandidatePreflightDesk,
  SearchIssueScheduler,
  SearchLeaseScheduler,
  startControlPlane,
  type DiscoveryCatalogContext,
  type DiscoveryRunRecord,
  type DiscoveryTask,
  type DiscoveryWorker,
  type StudioProjection,
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
  it("loses a port race without starting catalog or lease mutations", async () => {
    const blocker = createServer((_request, response) => response.end("occupied"));
    servers.push(blocker);
    await new Promise<void>((resolveListen) =>
      blocker.listen(0, "127.0.0.1", resolveListen),
    );
    const address = blocker.address() as AddressInfo;
    const directory = await mkdtemp(join(tmpdir(), "pmh-startup-gate-"));
    const databasePath = join(directory, "control-plane.sqlite");

    try {
      await expect(
        startControlPlane(address.port, "127.0.0.1", databasePath),
      ).rejects.toMatchObject({ code: "EADDRINUSE" });

      const store = new SqliteOperationalStore(databasePath);
      try {
        expect(store.loadCatalogObservations(100)).toHaveLength(0);
        expect(store.loadSearchLeaseRecords(100)).toHaveLength(0);
      } finally {
        store.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not start mutable background work before the HTTP listener is admitted", async () => {
    let releaseStartup: (() => void) | undefined;
    const startupGate = new Promise<void>((resolveStartup) => {
      releaseStartup = resolveStartup;
    });
    let fetchCount = 0;
    const source: CatalogObservationSource = {
      venueId: "gate-test",
      protocolIdentity: "gate-test:v1",
      sourceUrl: "https://example.test/gate",
      decode: () => [],
    };
    const catalogDesk = new CatalogObservationDesk({
      sources: [source],
      fetcher: async () => {
        fetchCount += 1;
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const catalogRefreshScheduler = new CatalogRefreshScheduler({
      desk: catalogDesk,
      intervalMs: null,
    });
    const controlPlane = createControlPlane({
      modelRuntime: createOpenAiDiscoveryRuntime({}),
      catalogObservationDesk: catalogDesk,
      catalogRefreshScheduler,
      refreshCatalogOnReady: true,
      startupGate,
    });
    servers.push(controlPlane.server);

    await Promise.resolve();
    expect(fetchCount).toBe(0);
    expect(catalogRefreshScheduler.projection().runCount).toBe(0);

    await new Promise<void>((resolveListen) =>
      controlPlane.server.listen(0, "127.0.0.1", resolveListen),
    );
    expect(fetchCount).toBe(0);

    releaseStartup?.();
    await controlPlane.ready;
    expect(fetchCount).toBe(1);
    expect(catalogRefreshScheduler.projection().runCount).toBe(1);
  });

  it("holds due issues during refresh and dispatches them on the new corpus", async () => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "polymarket-global",
    );
    if (source === undefined) throw new Error("missing Polymarket source");
    const bytes = await readFile(
      resolve(
        import.meta.dirname,
        "../../../projects/fixtures/polymarket-global/2026-07-31/polymarket-catalog.json",
      ),
    );
    let releaseFetch: (() => void) | undefined;
    let announceFetch: (() => void) | undefined;
    const fetchStarted = new Promise<void>((resolveStarted) => {
      announceFetch = resolveStarted;
    });
    const fetchGate = new Promise<void>((resolveGate) => {
      releaseFetch = resolveGate;
    });
    const catalogDesk = new CatalogObservationDesk({
      sources: [source],
      fetcher: async () => {
        announceFetch?.();
        await fetchGate;
        return new Response(new Uint8Array(bytes).buffer, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const catalogRefreshScheduler = new CatalogRefreshScheduler({
      desk: catalogDesk,
      intervalMs: 200,
    });
    const leaseScheduler = new SearchLeaseScheduler({
      concurrencyLimit: 3,
      context: (question, venueIds, _lens, snapshot): DiscoveryCatalogContext => {
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-catalog-context.v2" as const,
          source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
          contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
          listings: Object.freeze(
            snapshot.listings.filter((listing) => venueIds.includes(listing.venueId)),
          ),
        });
        expect(question).not.toHaveLength(0);
        return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
      },
      runFast: async (task: DiscoveryTask): Promise<DiscoveryRunRecord> =>
        Object.freeze({
          runId: hashCanonical({ taskId: task.taskId }),
          taskId: task.taskId,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          workerIds: Object.freeze(["test-fast-lane"]),
          workerReports: Object.freeze([]),
          hypotheses: Object.freeze([]),
          diagnostics: Object.freeze([]),
          executionAuthority: false,
          question: task.question,
          venueIds: task.venueIds,
          catalogContext: task.catalogContext,
          catalogContextIdentity: task.catalogContext?.contextIdentity,
          catalogListingCount: task.catalogContext?.listings.length,
          catalogContextSource: task.catalogContext?.source,
        }),
    });
    const issueScheduler = new SearchIssueScheduler({
      leaseScheduler,
      tickIntervalMs: 1_000,
      concurrencyLimit: 3,
    });
    const { controlPlane } = await listenControlPlane({
      catalogObservationDesk: catalogDesk,
      catalogRefreshScheduler,
      searchLeaseScheduler: leaseScheduler,
      searchIssueScheduler: issueScheduler,
    });

    await fetchStarted;
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    expect(catalogRefreshScheduler.projection().status).toBe("REFRESHING");
    expect(leaseScheduler.projection().records).toHaveLength(0);

    releaseFetch?.();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (leaseScheduler.projection().runCount > 0) break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
    const refresh = catalogRefreshScheduler.projection();
    const leases = leaseScheduler.projection().records;
    expect(refresh).toMatchObject({
      status: "IDLE",
      lastResult: "READY",
      runCount: 1,
    });
    expect(leases).toHaveLength(3);
    expect(
      leases.every(
        (record) =>
          record.status === "PASS" &&
          record.lease.snapshotIdentity === refresh.latestSnapshotIdentity,
      ),
    ).toBe(true);
    expect(controlPlane.searchIssueScheduler.projection()).toMatchObject({
      activeCount: 0,
      concurrencyLimit: 3,
    });
  });

  it("runs a default issue against healthy sources while binding one failed source", async () => {
    const source = (venueId: string): CatalogObservationSource => ({
      venueId,
      protocolIdentity: `${venueId}:v1`,
      sourceUrl: `https://example.test/${venueId}`,
      decode: (fixture) => [
        {
          venueId,
          venueInstrumentId: `${venueId}-rate-decision`,
          title: `Federal funds rate decision on ${venueId}`,
          description: "Whether the announced target rate is unchanged.",
          status: "OPEN",
          mechanism: "CENTRALIZED_ORDER_BOOK",
          closesAt: "2026-08-31T20:00:00.000Z",
          outcomes: [
            { venueOutcomeId: "yes", label: "Yes" },
            { venueOutcomeId: "no", label: "No" },
          ],
          priceScale: 1_000_000n,
          quantityScale: 1_000_000n,
          sourceFixtureHash: fixture.rawHash,
          protocolIdentity: `${venueId}:v1`,
        },
      ],
    });
    let failedVenue: string | null = null;
    const desk = new CatalogObservationDesk({
      sources: [source("venue-a"), source("venue-b"), source("venue-c")],
      now: () => Date.parse("2026-08-01T09:30:00.000Z"),
      fetcher: async (input) => {
        if (failedVenue !== null && input.endsWith(`/${failedVenue}`)) {
          return new Response("unavailable", { status: 503 });
        }
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    await desk.refresh();
    failedVenue = "venue-c";
    await desk.refresh();
    expect(desk.projection()).toMatchObject({
      status: "DEGRADED",
      healthySourceCount: 2,
      contextQualification: { eligibleSourceCount: 2 },
    });

    const { baseUrl } = await listenControlPlane({
      catalogObservationDesk: desk,
      refreshCatalogOnReady: false,
      marketArchaeologistDesk: createMarketArchaeologistDesk({}),
    });
    const studio = (await fetch(`${baseUrl}/api/v1/projection`).then((response) =>
      response.json()
    )) as StudioProjection;
    const issue = studio.ai.searchIssueScheduler.issues.find(
      (candidate) => candidate.lens === "MECHANISM",
    );
    if (issue === undefined) throw new Error("missing mechanism issue");

    const response = await fetch(
      `${baseUrl}/api/v1/search-issues/${issue.issueId}/runs`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    const record = await response.json() as {
      status: string;
      lease: { scope: { venueIds: string[] } };
      fastLane: {
        corpusCoverage: {
          status: string;
          requestedVenueIds: string[];
          eligibleVenueIds: string[];
          contextVenueIds: string[];
          omittedSources: { venueId: string; reason: string }[];
        };
      };
    };
    expect(record).toMatchObject({
      status: "PASS",
      lease: {
        scope: { venueIds: ["venue-a", "venue-b", "venue-c"] },
      },
      fastLane: {
        corpusCoverage: {
          status: "DEGRADED",
          requestedVenueIds: ["venue-a", "venue-b", "venue-c"],
          eligibleVenueIds: ["venue-a", "venue-b"],
          omittedSources: [{
            venueId: "venue-c",
            reason: "LATEST_REFRESH_FAILED",
          }],
        },
      },
    });
    expect(record.fastLane.corpusCoverage.contextVenueIds.every(
      (venueId) => venueId === "venue-a" || venueId === "venue-b",
    )).toBe(true);
  });

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
        catalogRefreshScheduler: {
          enabled: boolean;
          status: string;
          intervalMs: number | null;
          runCount: number;
          effects: { anonymousPublicGets: boolean; modelCalls: boolean };
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
        searchLeaseScheduler: {
          enabled: boolean;
          lensOrder: string[];
          budget: { maxFastModelRequests: number; maxPiInvocations: number };
          retainedCorpusCount: number;
          recoverableIssuedCount: number;
          missingCorpusIssuedCount: number;
          corpusStorage: { durable: boolean; idempotencyKey: string };
          semanticDecisionAuthority: boolean;
          certificateAuthority: boolean;
          executionAuthority: boolean;
        };
        searchQuoteEnrichment: {
          mode: string;
          retainedObservationCount: number;
          supportedVenues: string[];
          storage: { durable: boolean; idempotencyKey: string };
          semanticDecisionAuthority: boolean;
          executionAuthority: boolean;
        };
        searchAttention: {
          messageCount: number;
          unreadInAppCount: number;
          channels: { webhookJson: { configured: boolean; destinationStored: boolean } };
          semanticDecisionAuthority: boolean;
          simulationAuthority: boolean;
          certificateAuthority: boolean;
          executionAuthority: boolean;
        };
        searchOutcomeAttribution: {
          attributionIdentity: string;
          attributedProposalCount: number;
          modelConfidenceUsed: boolean;
          semanticDecisionAuthority: boolean;
          certificateAuthority: boolean;
          executionAuthority: boolean;
        };
        semanticReviewScheduler: {
          configured: boolean;
          pendingCount: number;
          budget: { basis: string; maxAttemptsPerJob: number };
          semanticDecisionAuthority: boolean;
          certificateAuthority: boolean;
          executionAuthority: boolean;
        };
        reviewAttention: {
          contentHash: string;
          itemCount: number;
          semanticDecisionAuthority: boolean;
          simulationAuthority: boolean;
          certificateAuthority: boolean;
          executionAuthority: boolean;
        };
        proposalEconomicTriage: {
          contentHash: string;
          itemCount: number;
          boostedCount: number;
          retentionPolicy: string;
          semanticDecisionAuthority: boolean;
          simulationAuthority: boolean;
          certificateAuthority: boolean;
          executionAuthority: boolean;
        };
        semanticRelationGraph: {
          graphIdentity: string;
          listingCount: number;
          relationCount: number;
          feedbackCount: number;
          modelConfidenceUsed: boolean;
          semanticDecisionAuthority: boolean;
          executionAuthority: boolean;
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
    expect(projection.ai.architecture).toBe("AI_NATIVE_DISCOVERY");
    expect(projection.ai.catalogContext).toMatchObject({
      listingCount: 32,
      venueCount: 7,
      sourceFixtureCount: 8,
    });
    expect(projection.ai.catalogContext.corpusIdentity).toMatch(/^sha256:/);
    expect(projection.ai.catalogRefreshScheduler).toMatchObject({
      enabled: false,
      status: "DISABLED",
      intervalMs: null,
      runCount: 0,
      effects: { anonymousPublicGets: true, modelCalls: false },
    });
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
    expect(projection.ai.searchLeaseScheduler).toMatchObject({
      enabled: false,
      lensOrder: ["EQUIVALENCE", "IMPLICATION", "PARTITION", "MECHANISM"],
      budget: { maxFastModelRequests: 1, maxPiInvocations: 1 },
      retainedCorpusCount: 0,
      recoverableIssuedCount: 0,
      missingCorpusIssuedCount: 0,
      corpusStorage: { durable: false, idempotencyKey: "snapshotIdentity" },
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.searchQuoteEnrichment).toMatchObject({
      mode: "ANONYMOUS_PUBLIC_GET",
      retainedObservationCount: 0,
      supportedVenues: ["opinion"],
      storage: { durable: false, idempotencyKey: "observationId" },
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.searchAttention).toMatchObject({
      messageCount: 0,
      unreadInAppCount: 0,
      channels: { webhookJson: { configured: false, destinationStored: false } },
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    const attentionResponse = await fetch(`${baseUrl}/api/v1/search-attention`);
    expect(attentionResponse.status).toBe(200);
    expect(await attentionResponse.json()).toMatchObject({
      schemaVersion: "pmh.search-attention-outbox.v1",
      authority: "ATTENTION_ROUTING_ONLY",
      effects: { valueMovingActions: false, liveExecutionEnabled: false },
    });
    expect(projection.ai.searchOutcomeAttribution).toMatchObject({
      attributedProposalCount: 0,
      modelConfidenceUsed: false,
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.searchOutcomeAttribution.attributionIdentity).toMatch(/^sha256:/);
    const attributionResponse = await fetch(
      `${baseUrl}/api/v1/search-outcome-attribution`,
    );
    expect(attributionResponse.status).toBe(200);
    expect(await attributionResponse.json()).toMatchObject({
      attributionIdentity: projection.ai.searchOutcomeAttribution.attributionIdentity,
      measurementBasis: "DISTINCT_PROPOSALS_FROM_PASSED_ISSUE_LEASES",
      authority: "DERIVED_RESEARCH_EVIDENCE_ONLY",
      executionAuthority: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(projection.ai.semanticReviewScheduler).toMatchObject({
      configured: false,
      pendingCount: 0,
      researchOnlyCount: 0,
      duplicateScopeCount: 0,
      scopedJobCount: 0,
      uniqueReviewScopeCount: 0,
      historicalRedundantPassCount: 0,
      bundledJobCount: 0,
      legacyEvidenceDebtCount: 0,
      budget: { basis: "REQUEST_ATTEMPTS", maxAttemptsPerJob: 3 },
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.semanticReviewAdmission).toMatchObject({
      policy: "TWO_DISTINCT_LISTINGS_AND_COMPILABLE_RELATION_V1",
      candidateCount: 0,
      autoReviewCount: 0,
      researchOnlyCount: 0,
      manualReviewAvailable: true,
      modelConfidenceUsed: false,
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.semanticReviewAdmission.contentHash).toMatch(/^sha256:/);
    expect(projection.ai.reviewAttention).toMatchObject({
      itemCount: 0,
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.reviewAttention.contentHash).toMatch(/^sha256:/);
    expect(projection.ai.proposalEconomicTriage).toMatchObject({
      itemCount: 0,
      boostedCount: 0,
      retentionPolicy: "NO_SUPPRESSION_NO_NEGATIVE_PENALTY",
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.proposalEconomicTriage.contentHash).toMatch(/^sha256:/);
    const reviewSchedulerResponse = await fetch(
      `${baseUrl}/api/v1/semantic-review-scheduler`,
    );
    expect(reviewSchedulerResponse.status).toBe(200);
    expect(await reviewSchedulerResponse.json()).toMatchObject({
      schemaVersion: "pmh.semantic-review-scheduler.v1",
      authority: "ADVISORY_ORCHESTRATION_ONLY",
      uniqueReviewScopeCount: 0,
      duplicateScopeCount: 0,
      budget: { basis: "REQUEST_ATTEMPTS" },
      executionAuthority: false,
      effects: { liveExecutionEnabled: false },
    });
    const reviewAdmissionResponse = await fetch(
      `${baseUrl}/api/v1/semantic-review-admission`,
    );
    expect(reviewAdmissionResponse.status).toBe(200);
    expect(await reviewAdmissionResponse.json()).toMatchObject({
      policy: "TWO_DISTINCT_LISTINGS_AND_COMPILABLE_RELATION_V1",
      candidateCount: 0,
      authority: "AUTOMATIC_REVIEW_ADMISSION_ONLY",
      effects: { modelCalls: false, liveExecutionEnabled: false },
    });
    expect(projection.ai.semanticRelationGraph).toMatchObject({
      listingCount: 0,
      relationCount: 0,
      feedbackCount: 0,
      modelConfidenceUsed: false,
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
    expect(projection.ai.semanticRelationGraph.graphIdentity).toMatch(/^sha256:/);
    const graphResponse = await fetch(`${baseUrl}/api/v1/semantic-relation-graph`);
    expect(graphResponse.status).toBe(200);
    expect(await graphResponse.json()).toMatchObject({
      graphIdentity: projection.ai.semanticRelationGraph.graphIdentity,
      priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS",
      modelConfidenceUsed: false,
      executionAuthority: false,
      effects: { liveExecutionEnabled: false },
    });
    const blockedShadowObservation = await fetch(
      `${baseUrl}/api/v1/opportunity-lifecycle/shadow-observations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    expect(blockedShadowObservation.status).toBe(409);
    expect(await blockedShadowObservation.json()).toMatchObject({
      actualOrderObserved: false,
      gatewayCalls: 0,
      executionAuthority: false,
      liveExecutionEnabled: false,
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

  it("creates and pauses search issues and rejects dispatch without a qualified corpus", async () => {
    const baseUrl = await listen();
    const initial = (await fetch(`${baseUrl}/api/v1/projection`).then((response) =>
      response.json())) as StudioProjection;
    expect(initial.ai.searchIssueScheduler).toMatchObject({
      issueCount: 5,
      enabledIssueCount: 5,
      activeCount: 0,
      concurrencyLimit: 3,
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    const createdResponse = await fetch(`${baseUrl}/api/v1/search-issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Named-person action aliases",
        question: "Find markets about the same named person performing the same public action.",
        lens: "EQUIVALENCE",
        cadenceMs: 300_000,
        priority: 5,
      }),
    });
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as { issueId: string };
    expect(created.issueId).toMatch(/^sha256:/u);

    const pausedResponse = await fetch(
      `${baseUrl}/api/v1/search-issues/${created.issueId}/enabled`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      },
    );
    expect(pausedResponse.status).toBe(200);
    await expect(pausedResponse.json()).resolves.toMatchObject({ enabled: false });

    const runResponse = await fetch(
      `${baseUrl}/api/v1/search-issues/${created.issueId}/runs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    expect(runResponse.status).toBe(400);
    await expect(runResponse.json()).resolves.toMatchObject({
      diagnostic: "search lease requires a non-empty qualified corpus",
    });
    const finalProjection = (await fetch(`${baseUrl}/api/v1/projection`).then((response) =>
      response.json())) as StudioProjection;
    expect(finalProjection.ai.searchIssueScheduler).toMatchObject({
      issueCount: 6,
      enabledIssueCount: 5,
    });
    expect(finalProjection.ai.searchIssueScheduler.issues.find(
      (issue) => issue.issueId === created.issueId,
    )).toMatchObject({ enabled: false, runCount: 0, passCount: 0 });
  });

  it("runs advisory counterexample review before a research-only lifecycle decision", async () => {
    const source = (venueId: string): CatalogObservationSource => ({
      venueId,
      protocolIdentity: `${venueId}:v1`,
      sourceUrl: `https://example.test/${venueId}`,
      decode: (fixture) => [
        {
          venueId,
          venueInstrumentId: `${venueId}-btc-hourly`,
          title: "BTC Up or Down - Hourly",
          description:
            venueId === "opinion"
              ? "Inclusive Chainlink comparison; a tie is Up."
              : "Strict Pyth comparison; a tie is Down.",
          status: "OPEN",
          mechanism: "ONCHAIN_CLOB",
          closesAt: "2026-08-01T10:00:00.000Z",
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
    const catalogDesk = new CatalogObservationDesk({
      sources: [source("opinion"), source("limitless")],
      now: () => Date.parse("2026-08-01T09:30:00.000Z"),
      fetcher: async () =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    await catalogDesk.refresh();
    const archaeologist = createMarketArchaeologistDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        runner: async (request) => {
          const effectPath = request.environment.PMH_MARKET_EFFECT_PATH;
          if (effectPath === undefined) throw new Error("missing market effect path");
          await writeFile(effectPath, JSON.stringify({
            summary: "The hourly markets diverge on ties and source disagreement.",
            proposals: [
              {
                relationKind: "IMPLIES",
                listingRefs: [
                  "limitless:limitless-btc-hourly",
                  "opinion:opinion-btc-hourly",
                ],
                statement:
                  "A Limitless Up outcome implies an Opinion Up outcome under the reviewed scope.",
                rationale: "The left event is a strict subset of the right event.",
                falsifiers: ["Limitless Up while Opinion resolves Down."],
              },
            ],
            missingEvidence: [],
          }), "utf8");
          return {
            exitCode: 0,
            stdout: "Findings submitted through submit_market_findings.",
            stderr: "",
            timedOut: false,
            outputLimitExceeded: false,
          };
        },
      },
    );
    const archaeologyRecord = await archaeologist.begin(
      catalogDesk.corpus(),
      "Find conditional BTC relations",
    ).promise;
    const proposalId = archaeologyRecord.report?.result.proposals[0]?.proposalId;
    if (proposalId === undefined) throw new Error("missing archaeology proposal");
    const opportunityId = `ai:${proposalId}`;
    const semanticReview = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        reviewer: {
          review: async () => ({
            recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION",
            relationConclusion: "IMPLIES",
            assessments: {
              outcomeMapping: "Up and Down labels map directly.",
              timingAndClose: "The hourly close times align.",
              voidAndCancellation: "No complete outage policy is supplied.",
              resolutionSources: "The relation explicitly conditions on source agreement.",
            },
            counterexamples: [],
            missingEvidence: [],
            rationale: "The implication scope is explicit enough for simulation.",
            constraintDraft: {
              classification: "HARD_SETTLEMENT_CONSTRAINT" as const,
              relationKind: "IMPLIES" as const,
              assumptions: [],
              counterexampleAttempt: {
                attempted: true as const,
                result: "NOT_FOUND" as const,
                narrative: "Tried Limitless Up with Opinion Down; the scoped source-agreement rules exclude it.",
                truths: [true, false],
              },
              truthTable: [
                { truths: [false, false], disposition: "FEASIBLE" as const, rationale: "Both may settle Down.", evidenceListingRefs: ["limitless:limitless-btc-hourly", "opinion:opinion-btc-hourly"] },
                { truths: [false, true], disposition: "FEASIBLE" as const, rationale: "Opinion may be Up without Limitless Up.", evidenceListingRefs: ["limitless:limitless-btc-hourly", "opinion:opinion-btc-hourly"] },
                { truths: [true, false], disposition: "IMPOSSIBLE" as const, rationale: "The reviewed implication forbids this state.", evidenceListingRefs: ["limitless:limitless-btc-hourly", "opinion:opinion-btc-hourly"] },
                { truths: [true, true], disposition: "FEASIBLE" as const, rationale: "Both may settle Up.", evidenceListingRefs: ["limitless:limitless-btc-hourly", "opinion:opinion-btc-hourly"] },
              ],
              unresolvedEvidence: [],
            },
          }),
        },
      },
    );
    const { baseUrl } = await listenControlPlane({
      catalogObservationDesk: catalogDesk,
      marketArchaeologistDesk: archaeologist,
      semanticReviewDesk: semanticReview,
      simulationMaterializerDesk: new AnonymousSimulationMaterializerDesk({
        now: () => new Date("2026-08-01T09:31:00.000Z"),
        fetcher: async (url, init) => {
          expect(init).toMatchObject({
            method: "GET",
            credentials: "omit",
            redirect: "error",
          });
          expect(url).toContain("/markets/limitless-btc-hourly/orderbook");
          return new Response(
            JSON.stringify({
              bids: [],
              asks: [{ price: "0.4", size: "1000000", side: "SELL" }],
              tokenId: "down",
              minSize: "1000000",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      }),
    });

    const reviewResponse = await fetch(
      `${baseUrl}/api/v1/semantic-reviews/runs`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      },
    );
    expect(reviewResponse.status).toBe(200);
    expect(await reviewResponse.json()).toMatchObject({
      opportunityId,
      status: "PASS",
      report: {
        result: {
          recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION",
          authority: "ADVISORY_ONLY",
          simulationAuthority: false,
          executionAuthority: false,
        },
      },
    });

    const decisionResponse = await fetch(
      `${baseUrl}/api/v1/opportunity-lifecycle/semantic-decisions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          decision: "ACCEPT_FOR_SIMULATION",
          rationale: "Accept the exact implication scope for research simulation only.",
        }),
      },
    );
    expect(decisionResponse.status).toBe(200);
    expect(await decisionResponse.json()).toMatchObject({
      decision: {
        authority: "LOCAL_OPERATOR_RESEARCH_ONLY",
        productionPromotionEligible: false,
        executionAuthority: false,
      },
      lifecycle: {
        state: "AWAITING_EXCHANGE_SIMULATION",
        nextAction: "RUN_EXCHANGE_SIMULATION",
        effects: {
          liveOrdersPlaced: false,
          valueMovingActions: false,
          liveExecutionEnabled: false,
        },
      },
    });
    const duplicate = await fetch(
      `${baseUrl}/api/v1/opportunity-lifecycle/semantic-decisions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          decision: "REJECT",
          rationale: "Attempt to rewrite the decision.",
        }),
      },
    );
    expect(duplicate.status).toBe(409);
    const projection = (await (
      await fetch(`${baseUrl}/api/v1/projection`)
    ).json()) as StudioProjection;
    expect(projection.relationPayoff).toMatchObject({
      sourceDecisionCount: 1,
      qualificationCount: 1,
      readyCount: 1,
      blockedCount: 0,
      verifierEligible: false,
      certificateAuthority: false,
      executionAuthority: false,
      qualifications: [
        {
          opportunityId,
          relationKind: "IMPLIES",
          status: "SIMULATION_TEMPLATE_READY",
        },
      ],
    });
    const qualification = projection.relationPayoff.qualifications[0]!;
    const portfolio = qualification.portfolios[0]!;
    const materializationResponse = await fetch(
      `${baseUrl}/api/v1/opportunity-lifecycle/materializations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          portfolioId: portfolio.portfolioId,
          requestedQuantity: "1000000",
        }),
      },
    );
    expect(materializationResponse.status).toBe(200);
    expect(await materializationResponse.json()).toMatchObject({
      materialization: {
        status: "BLOCKED",
        opportunityId,
        portfolioId: portfolio.portfolioId,
        legs: expect.arrayContaining([
          expect.objectContaining({
            venueId: "limitless",
            blocker: "DYNAMIC_FEE_MODEL_UNSUPPORTED",
          }),
          expect.objectContaining({
            venueId: "opinion",
            blocker: "UNSUPPORTED_ANONYMOUS_BOOK",
          }),
        ]),
        certificateAuthority: false,
        executionAuthority: false,
      },
      simulation: null,
      lifecycle: { state: "AWAITING_EXCHANGE_SIMULATION" },
      certificateAuthority: false,
      executionAuthority: false,
    });
    const materializerProjection = (await fetch(
      `${baseUrl}/api/v1/projection`,
    ).then((response) => response.json())) as StudioProjection;
    expect(materializerProjection.simulationMaterializer).toMatchObject({
      status: "BLOCKED",
      runCount: 1,
      blockedCount: 1,
      retainedRawSourceCount: 1,
    });
    const wireRequest = (
      venueId: string,
      instrumentId: string,
      price: string,
    ) => ({
      model: "CLOB_TAKER_V1",
      venueId,
      instrumentId,
      side: "BUY",
      fillPolicy: "FILL_OR_KILL",
      requestedQuantity: "1000000",
      quantityScale: "1000000",
      collateralScale: "1000000",
      levels: [
        {
          price,
          quantity: "1000000",
          levelIdentity: hashCanonical({ venueId, price }),
        },
      ],
      fee: {
        rate: "0",
        rateScale: "10000",
        flat: "0",
        scheduleHash: hashCanonical({ venueId, fee: 0 }),
      },
      bookStateHash: hashCanonical({ venueId, book: 1 }),
      observedAtEpochMs: "1785523200000",
    });
    const simulationResponse = await fetch(
      `${baseUrl}/api/v1/opportunity-lifecycle/simulations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          portfolioId: portfolio.portfolioId,
          legs: portfolio.legs.map((leg, index) => ({
            legId: leg.legId,
            request: wireRequest(
              leg.listingRef.split(":", 1)[0]!,
              leg.outcome === "TRUE"
                ? qualification.listingBindings.find(
                    (binding) => binding.listingRef === leg.listingRef,
                  )!.trueOutcome.venueOutcomeId
                : qualification.listingBindings.find(
                    (binding) => binding.listingRef === leg.listingRef,
                  )!.falseOutcome.venueOutcomeId,
              index === 0 ? "400000" : "450000",
            ),
          })),
        }),
      },
    );
    expect(simulationResponse.status).toBe(200);
    expect(await simulationResponse.json()).toMatchObject({
      simulation: {
        status: "POSITIVE_SIMULATED_FLOOR",
        minimumPayoutCollateral: "1000000",
        simulatedCostCollateral: "850000",
        floorAfterSimulatedFees: "150000",
        authority: "SIMULATION_ONLY",
        verifierEligible: false,
        certificateAuthority: false,
        executionAuthority: false,
      },
      lifecycle: {
        state: "AWAITING_EXACT_CERTIFICATE",
        nextAction: "RUN_EXACT_VERIFIER",
        certificateId: null,
      },
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

  it("keeps manual and scheduled task deadlines at least as long as the provider budget", async () => {
    let capturedDeadlineEpochMs = 0;
    const capturingWorker: DiscoveryWorker = {
      workerId: "deadline-capture",
      kind: "HEURISTIC",
      costTier: "FREE",
      async discover(task) {
        capturedDeadlineEpochMs = task.deadlineEpochMs;
        return [];
      },
    };
    const { baseUrl, controlPlane } = await listenControlPlane({
      modelRuntime: createOpenAiDiscoveryRuntime({
        PMH_DISCOVERY_TIMEOUT_MS: "300000",
      }),
      discoveryPool: new DiscoveryPool([capturingWorker]),
    });
    const beforeRequest = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Capture the configured deadline.",
        venueIds: ["gemini-predictions"],
      }),
    });

    expect(response.status).toBe(200);
    expect(capturedDeadlineEpochMs - beforeRequest).toBeGreaterThanOrEqual(301_000);
    expect(controlPlane.searchLeaseScheduler.projection().budget).toMatchObject({
      fastDeadlineMs: 300_000,
      deepDeadlineMs: 300_000,
      orchestrationGraceMs: 5_000,
      deadlineMs: 605_000,
    });
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
          description: venueId === "opinion"
            ? "Whether BNB finishes the hour up or down. Exact same claim payout partition matching titles times search evidence proof."
            : "Whether BNB finishes the hour up or down.",
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
    const corpusResponse = await fetch(`${baseUrl}/api/v1/market-corpus`);
    await expect(corpusResponse.json()).resolves.toMatchObject({
      schemaVersion: "pmh.market-corpus.v1",
      listingCount: 1,
      eligibleSourceCount: 1,
      authority: "OBSERVE_ONLY",
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    const searchResponse = await fetch(
      `${baseUrl}/api/v1/market-corpus/search`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patterns: ["Rihanna"], fields: ["title"] }),
      },
    );
    await expect(searchResponse.json()).resolves.toMatchObject({
      schemaVersion: "pmh.market-corpus-search.v1",
      matchCount: 1,
      hits: [{ venueId: "polymarket-global" }],
      authority: "SEARCH_EVIDENCE_ONLY",
      executionAuthority: false,
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

  it("refreshes a complete candidate watch batch without granting review authority", async () => {
    const fixtureRoot = join(import.meta.dirname, "../../../projects/fixtures");
    const evidenceDesk = new RealCandidatePreflightDesk(fixtureRoot);
    await evidenceDesk.load();
    const watchDesk = new CandidateWatchDesk({
      evidenceDesk,
      now: () => Date.parse("2026-08-01T06:30:00.000Z"),
      fetcher: async (input, init) => {
        const source = candidateWatchSources.find(
          (candidate) => candidate.sourceUrl === input,
        );
        if (source === undefined) return new Response(null, { status: 404 });
        expect(init).toMatchObject({ method: "GET", credentials: "omit" });
        const fixtureName =
          source.venueId === "polymarket-global"
            ? "polymarket-trump-out-2027-book-rescreen-1"
            : "limitless-trump-out-2027-book-rescreen-1";
        const bytes = await readFile(
          join(
            fixtureRoot,
            source.venueId,
            "2026-08-01",
            `${fixtureName}.json`,
          ),
        );
        return new Response(new Uint8Array(bytes).buffer, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const { baseUrl } = await listenControlPlane({
      realCandidatePreflightDesk: evidenceDesk,
      candidateWatchDesk: watchDesk,
    });
    const response = await fetch(`${baseUrl}/api/v1/candidate-watch/refresh`, {
      method: "POST",
    });
    const result = (await response.json()) as {
      status: string;
      authority: string;
      latestRefreshId: string | null;
      refreshHistory: unknown[];
      decision: {
        status: string;
        priorDecisionReused: boolean;
        independentReviewInvoked: boolean;
        verifierInvoked: boolean;
        arbitrageVerified: boolean;
      } | null;
      effects: {
        externalWrites: boolean;
        valueMovingActions: boolean;
        liveExecutionEnabled: boolean;
      };
    };
    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      status: "READY",
      authority: "OBSERVE_AND_SCREEN_ONLY",
      latestRefreshId: expect.stringMatching(/^candidate-watch-refresh:/),
      refreshHistory: [
        {
          status: "READY",
          sources: [
            expect.objectContaining({ status: "SUCCESS" }),
            expect.objectContaining({ status: "SUCCESS" }),
          ],
        },
      ],
      decision: {
        status: "UNCHANGED_BOUND_SNAPSHOT",
        priorDecisionReused: true,
        independentReviewInvoked: false,
        verifierInvoked: false,
        arbitrageVerified: false,
      },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    const qualification = (await fetch(
      `${baseUrl}/api/v1/qualification`,
    ).then((item) => item.json())) as { candidateWatch: unknown };
    expect(qualification.candidateWatch).toEqual(result);
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

  it("serves a self-verifying review intake packet without a decision path", async () => {
    const piRuntime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        runner: async () => ({
          exitCode: 0,
          stdout: JSON.stringify({
            summary: "The fixture partition is ready for independent assessment.",
            candidateListingRefs: [],
            findings: [],
            missingEvidence: [],
          }),
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        }),
      },
    );
    const { baseUrl } = await listenControlPlane({ piRuntime });
    const discovery = (await fetch(`${baseUrl}/api/v1/discovery/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Highest temperature in Boston on July 31, 2026?",
        venueIds: ["gemini-predictions"],
      }),
    }).then((response) => response.json())) as { taskId: string };
    const beforeInvestigation = (await fetch(
      `${baseUrl}/api/v1/projection`,
    ).then((response) => response.json())) as {
      ai: { researchDesk: { cases: { caseId: string }[] } };
    };
    const unreadyCaseId = beforeInvestigation.ai.researchDesk.cases[0]?.caseId;
    if (unreadyCaseId === undefined) throw new Error("missing research case");
    const unreadyPacket = await fetch(
      `${baseUrl}/api/v1/research-cases/review-intake?caseId=${encodeURIComponent(unreadyCaseId)}`,
    );
    expect(unreadyPacket.status).toBe(409);
    await expect(unreadyPacket.json()).resolves.toMatchObject({
      executionAuthority: false,
    });
    const investigation = await fetch(
      `${baseUrl}/api/v1/research-cases/investigate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: discovery.taskId }),
      },
    );
    expect(investigation.status).toBe(200);
    const projection = (await fetch(`${baseUrl}/api/v1/projection`).then(
      (response) => response.json(),
    )) as {
      ai: {
        researchDesk: {
          cases: {
            caseId: string;
            status: string;
            reviewIntake: {
              packetHash: string;
              readiness: string;
            } | null;
          }[];
        };
      };
    };
    const researchCase = projection.ai.researchDesk.cases[0];
    if (researchCase?.reviewIntake === null || researchCase === undefined) {
      throw new Error("missing review intake packet");
    }
    expect(researchCase).toMatchObject({
      status: "AWAITING_REVIEW",
      reviewIntake: { readiness: "READY_FOR_INDEPENDENT_REVIEW" },
    });
    const packetResponse = await fetch(
      `${baseUrl}/api/v1/research-cases/review-intake?caseId=${encodeURIComponent(researchCase.caseId)}`,
    );
    expect(packetResponse.status).toBe(200);
    await expect(packetResponse.json()).resolves.toMatchObject({
      packetHash: researchCase.reviewIntake.packetHash,
      readiness: "READY_FOR_INDEPENDENT_REVIEW",
      authority: {
        posture: "REVIEW_INTAKE_ONLY",
        decisionIngestionEnabled: false,
        promotionEligible: false,
        executionAuthority: false,
      },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    const decisionAttempt = await fetch(
      `${baseUrl}/api/v1/research-cases/review-intake?caseId=${encodeURIComponent(researchCase.caseId)}`,
      { method: "POST" },
    );
    expect(decisionAttempt.status).toBe(404);
    await expect(decisionAttempt.json()).resolves.toMatchObject({
      diagnostic: "route not found",
    });
    const absent = await fetch(
      `${baseUrl}/api/v1/research-cases/review-intake?caseId=missing`,
    );
    expect(absent.status).toBe(404);
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
          schemaVersion: 18,
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
    expect(initial.books).toHaveLength(4);

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
    expect(replay.bookDesk.books).toHaveLength(4);
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
      realCandidateDisposition: {
        status: string;
        classification: string;
        scope: string;
        postFeeFloorUpperBound: string;
        strictlyPositivePostFeeFloorPossible: boolean;
        terminalForSnapshot: boolean;
        rescreenRequiredOnBookChange: boolean;
        independentReviewInvoked: boolean;
        verifierInvoked: boolean;
        arbitrageVerified: boolean;
        artifactHash: string;
        effects: { liveExecutionEnabled: boolean };
      };
      realCandidateRescreen: {
        status: string;
        classification: string;
        scope: string;
        rescreenSequence: number;
        previousDispositionInvalidated: boolean;
        conclusionRecomputed: boolean;
        priorDecisionReused: boolean;
        decisionContinuity: string;
        currentGrossFloorUpperBoundBeforeFees: string;
        currentPostFeeFloorUpperBound: string;
        terminalForCurrentSnapshot: boolean;
        rescreenRequiredOnBookChange: boolean;
        independentReviewInvoked: boolean;
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
    expect(qualification.realCandidateDisposition).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      scope: "BOUND_BOOK_SNAPSHOT_ONLY",
      postFeeFloorUpperBound: "0",
      strictlyPositivePostFeeFloorPossible: false,
      terminalForSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(qualification.realCandidateDisposition.artifactHash).toMatch(
      /^sha256:/,
    );
    expect(qualification.realCandidateRescreen).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      scope: "CURRENT_BOUND_BOOK_SNAPSHOT_ONLY",
      rescreenSequence: 2,
      previousDispositionInvalidated: true,
      conclusionRecomputed: true,
      priorDecisionReused: false,
      decisionContinuity: "REJECTED_TO_REJECTED",
      currentGrossFloorUpperBoundBeforeFees: "0",
      currentPostFeeFloorUpperBound: "0",
      terminalForCurrentSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(qualification.realCandidateRescreen.artifactHash).toMatch(
      /^sha256:/,
    );
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
    let buffered = "";
    const readEvent = async (): Promise<string> => {
      while (!buffered.includes("\n\n")) {
        const next = await reader.read();
        if (next.done) throw new Error("event stream ended before a complete event");
        buffered += decoder.decode(next.value, { stream: true });
      }
      const boundary = buffered.indexOf("\n\n");
      const event = buffered.slice(0, boundary);
      buffered = buffered.slice(boundary + 2);
      return event;
    };
    expect(await readEvent()).toContain("event: projection");

    await fetch(`${baseUrl}/api/v1/books/replay`, { method: "POST" });
    const event = await readEvent();
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
