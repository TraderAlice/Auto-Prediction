import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildDiscoveryEvidenceLocator,
  buildEvidenceDocumentFetchPolicy,
  buildEvidenceRequirements,
  AgentExecutionRegistry,
  codexCredentialForTest,
  createRuleEvidenceClaimDesk,
  EvidenceAcquisitionScheduler,
  EvidenceDocumentFetcher,
  RuleEvidenceClaimDesk,
  RuleEvidenceClaimScheduler,
  SqliteOperationalStore,
  type DiscoveryCatalogListing,
  type EvidenceDocumentCapture,
  type EvidenceRequirement,
  type RuleEvidenceClaimModelPort,
  type AiRuntimeConfiguration,
} from "../src/index.js";

function clock(start = "2026-08-02T09:00:00.000Z") {
  let current = Date.parse(start);
  return Object.freeze({
    now: () => current,
    advance: (milliseconds: number) => { current += milliseconds; },
  });
}

const publicResolver = async () => Object.freeze([
  Object.freeze({ address: "8.8.8.8", family: 4 as const }),
]);

function listing(listingRef: string, locator: false | string = false): DiscoveryCatalogListing {
  const evidenceLocator = locator ? buildDiscoveryEvidenceLocator({
    venueId: "claim-scheduler-test",
    protocolIdentity: "claim-scheduler-test:v1",
    role: "CONTRACT_RULE_DOCUMENT",
    url: locator,
  }) : null;
  if (locator && evidenceLocator === null) throw new Error("scheduler locator failed");
  return Object.freeze({
    listingRef,
    venueId: "claim-scheduler-test",
    venueInstrumentId: listingRef,
    title: `Will ${listingRef} happen?`,
    description: "Claim scheduler test listing.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: null,
    ...(evidenceLocator === null
      ? {}
      : { evidenceLocators: Object.freeze([evidenceLocator]) }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-02T08:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity: "claim-scheduler-test:v1",
  });
}

function requirement(
  label: string,
  url = "https://rules.example.com/shared.txt",
): EvidenceRequirement {
  const first = listing(`${label}:first`, url);
  const second = listing("shared:second");
  return buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({ proposal: label }),
    proposalListingRefs: [first.listingRef, second.listingRef],
    listings: [first, second],
    drafts: [Object.freeze({
      kind: "VOID_CANCELLATION" as const,
      listingRefs: Object.freeze([first.listingRef]),
      claim: `Cancellation resolves No for ${label}.`,
      reason: "Cancellation treatment controls the possible joint state.",
      satisfyingObservation: "The official rule resolves cancellation No.",
      contradictingObservation: "The official rule voids after cancellation.",
      temporalPosture: "CURRENT" as const,
    })],
  })[0]!;
}

function documentFetcher(now: () => number): EvidenceDocumentFetcher {
  return new EvidenceDocumentFetcher({
    policies: [buildEvidenceDocumentFetchPolicy({
      venueId: "claim-scheduler-test",
      protocolIdentity: "claim-scheduler-test:v1",
      role: "CONTRACT_RULE_DOCUMENT",
      allowedHostnames: ["rules.example.com"],
      allowedContentTypes: ["text/plain"],
    })],
    fetch: async () => new Response(
      "Official rule: cancellation makes this contract resolve No.",
      { status: 200, headers: { "content-type": "text/plain" } },
    ),
    resolve: publicResolver,
    now,
  });
}

async function captureFor(
  input: EvidenceRequirement,
  now: () => number,
): Promise<EvidenceDocumentCapture> {
  return documentFetcher(now).capture({
    requirement: input,
    locatorIdentity: input.eligibleLocators[0]!.locator.locatorIdentity,
  });
}

function interpreter(
  capture: EvidenceDocumentCapture,
  disposition: "SUPPORTS" | "CONTRADICTS" | "INCONCLUSIVE" = "SUPPORTS",
): RuleEvidenceClaimModelPort {
  const quote = "cancellation makes this contract resolve No.";
  const start = capture.extraction.text.indexOf(quote);
  return {
    interpret: async () => ({
      draft: disposition === "INCONCLUSIVE"
        ? {
            disposition,
            rationale: "The retained document does not settle the requirement.",
            citations: [],
            unresolvedEvidence: ["A requirement-specific official clause is absent."],
          }
        : {
            disposition,
            rationale: "The exact retained clause determines cancellation treatment.",
            citations: [{ start, end: start + quote.length, quote }],
            unresolvedEvidence: [],
          },
      trace: {
        searchEffectCount: 1,
        readEffectCount: 0,
        submittedEffectHash: hashCanonical({ disposition }),
      },
    }),
  };
}

describe("durable rule evidence claim scheduler", () => {
  it("closes a provider-shaped evidence job with a durable Agent-runtime claim", async () => {
    const time = clock();
    const source = requirement("agent-runtime-completion");
    const capture = await captureFor(source, time.now);
    const desk = new RuleEvidenceClaimDesk(
      interpreter(capture),
      "deepseek-v4-flash",
      20,
      undefined,
      1,
      time.now,
    );
    const scheduler = new RuleEvidenceClaimScheduler({ desk, now: time.now });
    scheduler.reconcile([{ requirement: source, capture }]);
    const pending = scheduler.projection().jobs[0]!;
    const result = await interpreter(capture).interpret({ requirement: source, capture });
    time.advance(1_000);
    const record = desk.retainAgentResult({
      requirement: source,
      capture,
      engine: {
        provider: "DEEPSEEK",
        transport: "AGENT_RUNTIME",
        model: "deepseek-v4-flash",
        reasoningEffort: null,
        responseStorage: false,
      },
      startedAt: "2026-08-02T09:00:00.000Z",
      completedAt: "2026-08-02T09:00:01.000Z",
      result,
    });
    scheduler.reconcile([{ requirement: source, capture }]);

    expect(record.claim).toMatchObject({
      interpreter: { transport: "AGENT_RUNTIME" },
      disposition: "SUPPORTS",
    });
    expect(record.interpretationId).not.toBe(pending.jobId);
    expect(scheduler.projection()).toMatchObject({
      pendingCount: 0,
      passedCount: 1,
      supportedCount: 1,
      jobs: [{
        schemaVersion: "pmh.rule-evidence-claim-job.v2",
        jobId: pending.jobId,
        status: "PASS",
        lastClaimId: record.interpretationId,
      }],
    });
  });

  it("keeps the same newest-job retention window in memory and SQLite", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-rule-claim-window-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const requirements = Array.from({ length: 11 }, (_, index) =>
        requirement(`retention-${index}`)
      );
      const capture = await captureFor(requirements[0]!, time.now);
      const store = new SqliteOperationalStore(path);
      const desk = new RuleEvidenceClaimDesk(
        interpreter(capture),
        "deepseek-v4-flash",
        20,
        store,
        1,
        time.now,
      );
      const scheduler = new RuleEvidenceClaimScheduler({
        desk,
        retentionLimit: 10,
        store,
        now: time.now,
      });
      for (const source of requirements) {
        scheduler.reconcile([{ requirement: source, capture }]);
        time.advance(1_000);
      }
      const memoryIds = scheduler.projection().jobs.map((job) => job.jobId);
      const storedIds = store.loadRuleEvidenceClaimJobRecords(10).map((job) => job.jobId);
      expect(memoryIds).toEqual(storedIds);
      expect(memoryIds).toHaveLength(10);
      expect(scheduler.projection().jobs.some((job) =>
        job.requirementId === requirements[10]!.requirementId
      )).toBe(true);
      expect(scheduler.projection().jobs.some((job) =>
        job.requirementId === requirements[0]!.requirementId
      )).toBe(false);
      expect(store.loadRuleEvidenceClaimJobRecordsByRequirementIds([
        requirements[10]!.requirementId,
      ])).toHaveLength(1);
      expect(store.loadRuleEvidenceClaimJobRecordsByRequirementIds([
        requirements[0]!.requirementId,
      ])).toEqual([]);
      expect(() => scheduler.reconcile(requirements.map((source) => ({
        requirement: source,
        capture,
      })))).toThrow("active rule evidence claim inputs exceed the durable retention bound");
      store.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("interprets proposal-local requirements independently over one shared document", async () => {
    const time = clock();
    const first = requirement("first-proposal");
    const second = requirement("second-proposal");
    expect(first.acquisitionScopeIdentity).toBe(second.acquisitionScopeIdentity);
    const capture = await captureFor(first, time.now);
    const model = interpreter(capture);
    const interpret = vi.spyOn(model, "interpret");
    const desk = new RuleEvidenceClaimDesk(model, "deepseek-v4-flash", 20, undefined, 3, time.now);
    const scheduler = new RuleEvidenceClaimScheduler({
      desk,
      tickIntervalMs: 1_000,
      now: time.now,
    });

    const work = scheduler.tick([
      { requirement: first, capture },
      { requirement: second, capture },
    ]);
    expect(work).toHaveLength(2);
    await Promise.all(work);
    expect(interpret).toHaveBeenCalledTimes(2);
    expect(scheduler.projection()).toMatchObject({
      passedCount: 2,
      supportedCount: 2,
      contradictedCount: 0,
      inconclusiveCount: 0,
      budget: { providerAttemptsStarted: 2 },
    });
    expect(new Set(scheduler.projection().jobs.map((job) => job.documentId))).toEqual(
      new Set([capture.document.record.documentId]),
    );
  });

  it("runs exactly one selected pending claim without enabling the queue", async () => {
    const time = clock();
    const first = requirement("manual-first");
    const second = requirement("manual-second");
    const capture = await captureFor(first, time.now);
    const model = interpreter(capture);
    const interpret = vi.spyOn(model, "interpret");
    const desk = new RuleEvidenceClaimDesk(model, "gpt-5.6-terra", 20, undefined, 3, time.now);
    const scheduler = new RuleEvidenceClaimScheduler({ desk, now: time.now });
    const inputs = [
      { requirement: first, capture },
      { requirement: second, capture },
    ];
    scheduler.reconcile(inputs);
    const selected = scheduler.projection().jobs.find((job) =>
      job.requirementId === second.requirementId
    )!;
    await scheduler.runJob(selected.jobId, inputs);
    expect(interpret).toHaveBeenCalledOnce();
    expect(scheduler.projection()).toMatchObject({
      passedCount: 1,
      pendingCount: 1,
      budget: { providerAttemptsStarted: 1 },
    });
  });

  it("does not clone the business queue when Codex effort changes", async () => {
    const time = clock();
    const input = requirement("runtime-generation");
    const capture = await captureFor(input, time.now);
    let configuration: AiRuntimeConfiguration = Object.freeze({
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 1,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: "2026-08-02T09:00:00.000Z",
    });
    const providerFetch = vi.fn(async () => {
      throw new Error("reconciliation must not call the provider");
    });
    const desk = createRuleEvidenceClaimDesk({}, {
      runtimeConfiguration: () => configuration,
      codexCredentialProvider: codexCredentialForTest("test-token", "test-account"),
      codexFetcher: providerFetch,
      now: time.now,
    });
    const scheduler = new RuleEvidenceClaimScheduler({ desk, now: time.now });
    const agentExecution = new AgentExecutionRegistry();
    agentExecution.reconcileRuleEvidenceTasks([{ requirement: input, capture }]);
    scheduler.reconcile([{ requirement: input, capture }]);
    const highJob = scheduler.projection().jobs[0]!;
    expect(scheduler.projection()).toMatchObject({ currentJobCount: 1, legacyJobCount: 0 });

    configuration = Object.freeze({
      ...configuration,
      revision: 2,
      codexReasoningEffort: "max",
      updatedAt: "2026-08-02T09:01:00.000Z",
    });
    scheduler.reconcile([{ requirement: input, capture }]);
    agentExecution.reconcileRuleEvidenceTasks([{ requirement: input, capture }]);
    const projection = scheduler.projection();
    expect(projection).toMatchObject({
      currentJobCount: 0,
      legacyJobCount: 1,
      pendingCount: 0,
      dueCount: 0,
    });
    expect(projection.currentInterpreterIdentity).not.toBe(highJob.interpreterIdentity);
    expect(projection.jobs.some((job) => job.jobId === highJob.jobId)).toBe(true);
    expect(projection.jobs).toHaveLength(1);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(agentExecution.projection()).toMatchObject({
      taskCount: 1,
      runCount: 0,
      modelInvocationCount: 0,
      activeCampaignCount: 0,
      automaticDispatchFromConfiguration: false,
    });
  });

  it("bounds provider retries and preserves the terminal diagnostic", async () => {
    const time = clock();
    const input = requirement("retry");
    const capture = await captureFor(input, time.now);
    const desk = new RuleEvidenceClaimDesk({
      interpret: async () => { throw new Error("provider unavailable"); },
    }, "deepseek-v4-flash", 20, undefined, 1, time.now);
    const scheduler = new RuleEvidenceClaimScheduler({
      desk,
      tickIntervalMs: 1_000,
      maxAttempts: 2,
      retryDelayMs: 1_000,
      now: time.now,
    });
    const inputs = [{ requirement: input, capture }];

    await Promise.all(scheduler.tick(inputs));
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "RETRY_WAIT",
      attemptCount: 1,
    });
    time.advance(1_000);
    await Promise.all(scheduler.tick(inputs));
    expect(scheduler.projection().jobs[0]).toMatchObject({
      status: "EXHAUSTED",
      attemptCount: 2,
      diagnostic: "provider unavailable",
    });
    expect(scheduler.tick(inputs)).toEqual([]);
  });

  it("restores a completed claim and job from SQLite without another model request", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-rule-claim-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("restart");
      const firstStore = new SqliteOperationalStore(path);
      const acquisition = new EvidenceAcquisitionScheduler({
        fetcher: documentFetcher(time.now),
        tickIntervalMs: 1_000,
        store: firstStore,
        now: time.now,
      });
      await Promise.all(acquisition.tick([input]));
      const acquisitionJob = acquisition.projection().jobs[0]!;
      const capture = acquisition.captureForJob(acquisitionJob.jobId)!;
      const firstPort = interpreter(capture);
      const firstInterpret = vi.spyOn(firstPort, "interpret");
      const firstDesk = new RuleEvidenceClaimDesk(
        firstPort,
        "deepseek-v4-flash",
        20,
        firstStore,
        1,
        time.now,
      );
      const firstScheduler = new RuleEvidenceClaimScheduler({
        desk: firstDesk,
        tickIntervalMs: 1_000,
        store: firstStore,
        now: time.now,
      });
      await Promise.all(firstScheduler.tick([{ requirement: input, capture }]));
      expect(firstInterpret).toHaveBeenCalledOnce();
      const firstJob = firstScheduler.projection().jobs[0]!;
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondPort = interpreter(capture);
      const secondInterpret = vi.spyOn(secondPort, "interpret");
      const secondDesk = new RuleEvidenceClaimDesk(
        secondPort,
        "deepseek-v4-flash",
        20,
        secondStore,
        1,
        time.now,
      );
      const secondScheduler = new RuleEvidenceClaimScheduler({
        desk: secondDesk,
        tickIntervalMs: 1_000,
        store: secondStore,
        now: time.now,
      });
      expect(secondScheduler.tick([{ requirement: input, capture }])).toEqual([]);
      expect(secondInterpret).not.toHaveBeenCalled();
      expect(secondScheduler.projection().jobs[0]).toEqual(firstJob);
      expect(secondDesk.projection()).toMatchObject({ passCount: 1, runCount: 1 });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reuses exact interpreted bytes across a later not-modified observation", async () => {
    const time = clock();
    const input = requirement("not-modified-recapture");
    let requestCount = 0;
    const fetcher = new EvidenceDocumentFetcher({
      policies: [buildEvidenceDocumentFetchPolicy({
        venueId: "claim-scheduler-test",
        protocolIdentity: "claim-scheduler-test:v1",
        role: "CONTRACT_RULE_DOCUMENT",
        allowedHostnames: ["rules.example.com"],
        allowedContentTypes: ["text/plain"],
      })],
      fetch: async () => {
        requestCount += 1;
        return requestCount === 1
          ? new Response(
              "Official rule: cancellation makes this contract resolve No.",
              {
                status: 200,
                headers: { "content-type": "text/plain", etag: '"fixture-v1"' },
              },
            )
          : new Response(null, { status: 304, headers: { etag: '"fixture-v1"' } });
      },
      resolve: publicResolver,
      now: time.now,
    });
    const first = await fetcher.capture({
      requirement: input,
      locatorIdentity: input.eligibleLocators[0]!.locator.locatorIdentity,
    });
    const model = interpreter(first);
    const interpret = vi.spyOn(model, "interpret");
    const desk = new RuleEvidenceClaimDesk(
      model,
      "deepseek-v4-flash",
      20,
      undefined,
      1,
      time.now,
    );
    const scheduler = new RuleEvidenceClaimScheduler({
      desk,
      tickIntervalMs: 1_000,
      now: time.now,
    });
    await Promise.all(scheduler.tick([{ requirement: input, capture: first }]));
    const completed = scheduler.projection().jobs[0]!;
    expect(interpret).toHaveBeenCalledOnce();

    time.advance(60_000);
    const later = await fetcher.capture({
      requirement: input,
      locatorIdentity: input.eligibleLocators[0]!.locator.locatorIdentity,
      previous: first,
    });
    expect(later).toMatchObject({ status: "NOT_MODIFIED" });
    expect(later.observation.observationId).not.toBe(first.observation.observationId);
    expect(later.document.record.documentId).toBe(first.document.record.documentId);
    expect(later.extraction.record.extractionId).toBe(first.extraction.record.extractionId);

    expect(scheduler.tick([{ requirement: input, capture: later }])).toEqual([]);
    expect(interpret).toHaveBeenCalledOnce();
    expect(scheduler.projection().budget.providerAttemptsStarted).toBe(1);
    expect(scheduler.projection().jobs).toEqual([completed]);
  });

  it("quarantines an expired lease after restart instead of replaying the model request", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-rule-claim-interrupted-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("interrupted");
      const capture = await captureFor(input, time.now);
      const firstStore = new SqliteOperationalStore(path);
      const firstInterpret = vi.fn(() =>
        new Promise<never>(() => undefined)
      );
      const firstDesk = new RuleEvidenceClaimDesk(
        { interpret: firstInterpret },
        "deepseek-v4-flash",
        20,
        firstStore,
        1,
        time.now,
      );
      const firstScheduler = new RuleEvidenceClaimScheduler({
        desk: firstDesk,
        tickIntervalMs: 1_000,
        leaseTimeoutMs: 1_000,
        store: firstStore,
        now: time.now,
      });
      const inFlight = firstScheduler.tick([{ requirement: input, capture }]);
      expect(inFlight).toHaveLength(1);
      await Promise.resolve();
      expect(firstInterpret).toHaveBeenCalledOnce();
      expect(firstScheduler.projection()).toMatchObject({
        activeCount: 1,
        leasedCount: 1,
        interruptedLeaseCount: 0,
      });
      firstStore.close();

      time.advance(1_001);
      const secondStore = new SqliteOperationalStore(path);
      const secondPort = interpreter(capture);
      const secondInterpret = vi.spyOn(secondPort, "interpret");
      const secondDesk = new RuleEvidenceClaimDesk(
        secondPort,
        "deepseek-v4-flash",
        20,
        secondStore,
        1,
        time.now,
      );
      const secondScheduler = new RuleEvidenceClaimScheduler({
        desk: secondDesk,
        tickIntervalMs: 1_000,
        leaseTimeoutMs: 1_000,
        store: secondStore,
        now: time.now,
      });
      expect(secondScheduler.tick([{ requirement: input, capture }])).toEqual([]);
      expect(secondInterpret).not.toHaveBeenCalled();
      expect(secondScheduler.projection()).toMatchObject({
        activeCount: 0,
        dueCount: 0,
        leasedCount: 1,
        interruptedLeaseCount: 1,
        retryWaitCount: 0,
        exhaustedCount: 0,
        budget: { providerAttemptsStarted: 1 },
      });
      expect(secondScheduler.projection().jobs[0]).toMatchObject({
        status: "LEASED",
        attemptCount: 1,
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("retains claimed documents when acquisition jobs exceed queue retention", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-claimed-document-retention-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("claimed-before-prune");
      const store = new SqliteOperationalStore(path);
      const acquisition = new EvidenceAcquisitionScheduler({
        fetcher: documentFetcher(time.now),
        tickIntervalMs: 1_000,
        retentionLimit: 10,
        store,
        now: time.now,
      });
      await Promise.all(acquisition.tick([input]));
      const capture = acquisition.captureForJob(acquisition.projection().jobs[0]!.jobId)!;
      const desk = new RuleEvidenceClaimDesk(
        interpreter(capture),
        "deepseek-v4-flash",
        20,
        store,
        1,
        time.now,
      );
      const scheduler = new RuleEvidenceClaimScheduler({
        desk,
        tickIntervalMs: 1_000,
        store,
        now: time.now,
      });
      await Promise.all(scheduler.tick([{ requirement: input, capture }]));

      const later = Array.from({ length: 11 }, (_, index) => requirement(
        `later-${index}`,
        `https://rules.example.com/later-${index}.txt`,
      ));
      expect(() => acquisition.reconcile(later)).not.toThrow();
      store.close();

      const reopened = new SqliteOperationalStore(path);
      const restored = new RuleEvidenceClaimDesk(
        interpreter(capture),
        "deepseek-v4-flash",
        20,
        reopened,
        1,
        time.now,
      );
      expect(restored.projection()).toMatchObject({ passCount: 1, runCount: 1 });
      reopened.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when a retained passage is changed behind its hash", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-rule-claim-tamper-"));
    const path = join(directory, "operations.sqlite");
    try {
      const time = clock();
      const input = requirement("tamper");
      const store = new SqliteOperationalStore(path);
      const acquisition = new EvidenceAcquisitionScheduler({
        fetcher: documentFetcher(time.now),
        tickIntervalMs: 1_000,
        store,
        now: time.now,
      });
      await Promise.all(acquisition.tick([input]));
      const capture = acquisition.captureForJob(acquisition.projection().jobs[0]!.jobId)!;
      const desk = new RuleEvidenceClaimDesk(
        interpreter(capture),
        "deepseek-v4-flash",
        20,
        store,
        1,
        time.now,
      );
      const scheduler = new RuleEvidenceClaimScheduler({
        desk,
        tickIntervalMs: 1_000,
        store,
        now: time.now,
      });
      await Promise.all(scheduler.tick([{ requirement: input, capture }]));
      store.close();

      const database = new DatabaseSync(path);
      database.prepare(
        "UPDATE evidence_document_texts SET extracted_text = ?",
      ).run("Tampered text with the old record hash.");
      database.close();

      const reopened = new SqliteOperationalStore(path);
      expect(() => new RuleEvidenceClaimDesk(
        interpreter(capture),
        "deepseek-v4-flash",
        20,
        reopened,
        1,
        time.now,
      )).toThrow(/evidence document text identity/);
      reopened.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
