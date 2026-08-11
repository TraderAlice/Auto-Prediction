import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  AgentExecutionRegistry,
  AiUsageLedger,
  buildDiscoveryEvidenceLocator,
  buildEvidenceDocumentFetchPolicy,
  buildEvidenceRequirements,
  buildRuleEvidenceAgentMigration,
  createRuleEvidenceClaimDesk,
  EvidenceDocumentFetcher,
  RuleEvidenceClaimDesk,
  RuleEvidenceClaimScheduler,
  ruleEvidenceInterpreterIdentity,
  SqliteOperationalStore,
  type DiscoveryCatalogListing,
  type EvidenceDocumentCapture,
  type EvidenceRequirement,
  type RuleEvidenceClaimJobRecord,
  type RuleEvidenceClaimModelPort,
  type RuleEvidenceInterpreterEngine,
} from "../src/index.js";

function clock(start = "2026-08-10T09:00:00.000Z") {
  let current = Date.parse(start);
  return Object.freeze({
    now: () => current,
    advance: (milliseconds: number) => { current += milliseconds; },
    iso: () => new Date(current).toISOString(),
  });
}

function listing(listingRef: string, url?: string): DiscoveryCatalogListing {
  const locator = url === undefined ? null : buildDiscoveryEvidenceLocator({
    venueId: "migration-test",
    protocolIdentity: "migration-test:v1",
    role: "CONTRACT_RULE_DOCUMENT",
    url,
  });
  return Object.freeze({
    listingRef,
    venueId: "migration-test",
    venueInstrumentId: listingRef,
    title: `Will ${listingRef} happen?`,
    description: "Migration fixture listing.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: null,
    ...(locator === null ? {} : { evidenceLocators: Object.freeze([locator]) }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-10T08:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity: "migration-test:v1",
  });
}

function requirement(label: string): EvidenceRequirement {
  const first = listing(`${label}:first`, "https://rules.example.com/rules.txt");
  const second = listing(`${label}:second`);
  return buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({ proposal: label }),
    proposalListingRefs: [first.listingRef, second.listingRef],
    listings: [first, second],
    drafts: [{
      kind: "VOID_CANCELLATION",
      listingRefs: [first.listingRef],
      claim: `Cancellation resolves No for ${label}.`,
      reason: "Cancellation treatment controls the possible joint state.",
      satisfyingObservation: "The official rule resolves cancellation No.",
      contradictingObservation: "The official rule voids after cancellation.",
      temporalPosture: "CURRENT",
    }],
  })[0]!;
}

async function capture(
  source: EvidenceRequirement,
  now: () => number,
): Promise<EvidenceDocumentCapture> {
  const fetcher = new EvidenceDocumentFetcher({
    policies: [buildEvidenceDocumentFetchPolicy({
      venueId: "migration-test",
      protocolIdentity: "migration-test:v1",
      role: "CONTRACT_RULE_DOCUMENT",
      allowedHostnames: ["rules.example.com"],
      allowedContentTypes: ["text/plain"],
    })],
    fetch: async () => new Response(
      "Official rule: cancellation makes this contract resolve No.",
      { status: 200, headers: { "content-type": "text/plain" } },
    ),
    resolve: async () => [{ address: "8.8.8.8", family: 4 as const }],
    now,
  });
  return fetcher.capture({
    requirement: source,
    locatorIdentity: source.eligibleLocators[0]!.locator.locatorIdentity,
  });
}

function passingInterpreter(captured: EvidenceDocumentCapture): RuleEvidenceClaimModelPort {
  const quote = "cancellation makes this contract resolve No.";
  const start = captured.extraction.text.indexOf(quote);
  return {
    interpret: async () => ({
      draft: {
        disposition: "SUPPORTS",
        rationale: "The retained official clause settles cancellation treatment.",
        citations: [{ start, end: start + quote.length, quote }],
        unresolvedEvidence: [],
      },
      trace: {
        searchEffectCount: 1,
        readEffectCount: 1,
        submittedEffectHash: hashCanonical({ fixture: "migration" }),
      },
    }),
  };
}

function withJobHash(job: Omit<RuleEvidenceClaimJobRecord, "artifactHash">): RuleEvidenceClaimJobRecord {
  return Object.freeze({ ...job, artifactHash: hashCanonical(job) });
}

describe("legacy Rule Evidence Agent migration", () => {
  it("imports PASS and failed Codex jobs without dispatch, retry, or fabricated history", async () => {
    const time = clock();
    const passedRequirement = requirement("passed");
    const failedRequirement = requirement("failed-codex");
    const pendingRequirement = requirement("pending");
    const passedCapture = await capture(passedRequirement, time.now);
    const failedCapture = await capture(failedRequirement, time.now);
    const pendingCapture = await capture(pendingRequirement, time.now);

    const passedDesk = new RuleEvidenceClaimDesk(
      passingInterpreter(passedCapture),
      "deepseek-v4-flash",
      20,
      undefined,
      1,
      time.now,
    );
    const passedScheduler = new RuleEvidenceClaimScheduler({
      desk: passedDesk,
      tickIntervalMs: 1_000,
      now: time.now,
    });
    await Promise.all(passedScheduler.tick([{ requirement: passedRequirement, capture: passedCapture }]));
    const passedJob = passedScheduler.projection().jobs[0]!;
    const passedRecord = passedDesk.projection().records[0]!;

    time.advance(1_000);
    const failedDesk = new RuleEvidenceClaimDesk({
      interpret: async () => { throw new Error("fixture provider failure"); },
    }, "deepseek-v4-flash", 20, undefined, 1, time.now);
    const failedScheduler = new RuleEvidenceClaimScheduler({
      desk: failedDesk,
      tickIntervalMs: 1_000,
      maxAttempts: 2,
      now: time.now,
    });
    await Promise.all(failedScheduler.tick([{ requirement: failedRequirement, capture: failedCapture }]));
    const deepSeekFailure = failedScheduler.projection().jobs[0]!;
    const terraEngine: RuleEvidenceInterpreterEngine = Object.freeze({
      provider: "CODEX",
      transport: "VERCEL_AI_SDK",
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      responseStorage: false,
    });
    const interpreterIdentity = ruleEvidenceInterpreterIdentity(terraEngine);
    const jobId = hashCanonical({
      schemaVersion: "pmh.rule-evidence-interpretation-run.v1",
      requirementId: deepSeekFailure.requirementId,
      documentId: deepSeekFailure.documentId,
      extractionId: deepSeekFailure.extractionId,
      interpreterIdentity,
    });
    const { artifactHash: _oldHash, ...failedBody } = deepSeekFailure;
    const codexFailure = withJobHash({
      ...failedBody,
      jobId,
      interpreterIdentity,
      diagnostic: "fixture Codex request failed",
    });

    const pendingDesk = createRuleEvidenceClaimDesk({}, { now: time.now });
    const pendingScheduler = new RuleEvidenceClaimScheduler({ desk: pendingDesk, now: time.now });
    pendingScheduler.reconcile([{ requirement: pendingRequirement, capture: pendingCapture }]);
    const pendingJob = pendingScheduler.projection().jobs[0]!;

    const registry = new AgentExecutionRegistry();
    registry.reconcileRuleEvidenceTasks([
      { requirement: passedRequirement, capture: passedCapture },
      { requirement: failedRequirement, capture: failedCapture },
      { requirement: pendingRequirement, capture: pendingCapture },
    ]);
    const usage = new AiUsageLedger();
    usage.record({
      occurredAt: codexFailure.updatedAt,
      durationMs: 900,
      purpose: "RULE_EVIDENCE_CLAIM",
      role: "EVIDENCE_INTERPRETER",
      provider: "CODEX",
      model: "gpt-5.6-terra",
      transport: "VERCEL_AI_SDK",
      operationIdentity: `requirement:${failedRequirement.requirementId}`,
      outcome: "FAILED",
      durableEffect: false,
      providerRequestCount: 1,
      usage: { inputTokens: 100, outputTokens: 4, totalTokens: 104 },
    });

    const migration = buildRuleEvidenceAgentMigration({
      snapshot: registry.snapshot(),
      jobs: [passedJob, codexFailure, pendingJob],
      records: [passedRecord],
      usageEvents: usage.events(),
      observedAt: time.iso(),
    });
    registry.saveBatch(migration.batch);
    registry.saveBatch(migration.batch);
    const snapshot = registry.snapshot();

    expect(migration.report).toMatchObject({
      terminalJobCount: 1,
      attemptBearingJobCount: 2,
      pendingTaskOnlyCount: 1,
      migratedRunCount: 2,
      migratedInvocationCount: 2,
      migratedArtifactCount: 1,
      unmappedTerminalJobCount: 0,
      unmappedUsageEventCount: 0,
      providerRequestsStarted: 0,
    });
    expect(snapshot.tasks).toHaveLength(3);
    expect(snapshot.runs).toHaveLength(2);
    expect(snapshot.runs.map((run) => run.status).sort()).toEqual(["INTERRUPTED", "SUCCEEDED"]);
    expect(snapshot.runs.every((run) => run.authorization.kind === "LEGACY_IMPORT")).toBe(true);
    expect(snapshot.modelInvocations).toHaveLength(2);
    expect(snapshot.runArtifacts).toHaveLength(1);
    expect(snapshot.toolEffects).toHaveLength(1);
    expect(snapshot.runAnnotations.some((annotation) =>
      annotation.category === "INCIDENT_FAILED_CODEX_REQUEST"
    )).toBe(true);
    expect(snapshot.runAnnotations.some((annotation) =>
      annotation.category === "LEGACY_RETRY_WAIT_INTERRUPTED"
    )).toBe(true);
    expect(snapshot.campaigns).toHaveLength(0);
  });

  it("exposes the additive artifact and annotation tables in schema 37", () => {
    const store = new SqliteOperationalStore(":memory:");
    expect(store.agentExecutionStorage.schemaVersion).toBe(37);
    expect(store.loadAgentExecutionSnapshot()).toMatchObject({
      runArtifacts: [],
      runAnnotations: [],
    });
    store.close();
  });
});
