import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  AgenticModelDiscoveryWorker,
  assertDiscoveryRunRecord,
  DiscoveryAgentSession,
  DiscoveryLedger,
  DiscoveryPool,
  HeuristicDiscoveryWorker,
  type DiscoveryTask,
} from "../src/index.js";
import {
  agentTask,
  proposalInput,
  TEST_LISTING_REF,
  TEST_LISTING_REFS,
} from "./model-agent-fixtures.js";

const baseTask: DiscoveryTask = {
  taskId: "task:one",
  question: "Will NYC rainfall exceed 0.25 inches?",
  venueIds: ["kalshi", "polymarket-global"],
  maxHypotheses: 5,
  deadlineEpochMs: 2_000,
};

describe("discovery ledger", () => {
  it("retains bounded proposal-only run records", async () => {
    const pool = new DiscoveryPool(
      [new HeuristicDiscoveryWorker()],
      () => 1_000,
    );
    const ledger = new DiscoveryLedger(1);
    ledger.record(baseTask, await pool.run(baseTask));
    const secondTask = {
      ...baseTask,
      taskId: "task:two",
      question: "Will BTC close above $100,000?",
    };
    ledger.record(secondTask, await pool.run(secondTask));
    const projection = ledger.projection();
    expect(projection).toMatchObject({
      retentionLimit: 1,
      runCount: 1,
      hypothesisCount: 1,
      unreviewedCount: 1,
    });
    expect(projection.runs[0]).toMatchObject({
      taskId: "task:two",
      question: "Will BTC close above $100,000?",
      executionAuthority: false,
    });
    expect(projection.runs[0]?.hypotheses[0]).toMatchObject({
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
  });

  it("rejects an invalid retention boundary", () => {
    expect(() => new DiscoveryLedger(0)).toThrow(/retention limit/);
  });

  it("rejects substituted or internally inconsistent worker telemetry", async () => {
    const pool = new DiscoveryPool(
      [new HeuristicDiscoveryWorker()],
      () => 1_000,
    );
    const run = await pool.run(baseTask);
    const record = new DiscoveryLedger(1).record(baseTask, run);
    const { workerReports: _workerReports, ...legacyRecord } = record;
    expect(assertDiscoveryRunRecord(legacyRecord).workerReports).toBeUndefined();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const reports = tampered.workerReports as Record<string, unknown>[];
    const legacyWorkerReports = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const legacyReport = (legacyWorkerReports.workerReports as Record<string, unknown>[])[0]!;
    delete legacyReport.providerRequestAttemptCount;
    delete legacyReport.providerFailureCategory;
    expect(assertDiscoveryRunRecord(legacyWorkerReports).workerReports?.[0])
      .not.toHaveProperty("providerRequestAttemptCount");
    reports[0] = { ...reports[0], durationMs: 1 };
    expect(() => assertDiscoveryRunRecord(tampered)).toThrow(
      /worker report violates/,
    );
    expect(() =>
      assertDiscoveryRunRecord({ ...tampered, workerReports: [] }),
    ).toThrow(/do not bind/);
    const invalidTelemetry = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    (invalidTelemetry.workerReports as Record<string, unknown>[])[0] = {
      ...(invalidTelemetry.workerReports as Record<string, unknown>[])[0],
      providerFailureCategory: "SECRET_PROVIDER_BODY",
    };
    expect(() => assertDiscoveryRunRecord(invalidTelemetry)).toThrow(
      /worker report violates/,
    );
  });

  it("round-trips a bounded agent effect journal and rejects trace substitution", async () => {
    const session = new DiscoveryAgentSession("model:journal", agentTask, 24);
    session.inspectListings({ listingRefs: TEST_LISTING_REFS });
    session.recordHypothesis(proposalInput());
    session.completeSearch({ reason: "Grounded journal qualification complete." });
    const result = session.finish({
      stepCount: 3,
      providerRequestAttemptCount: 3,
      toolCallCount: 3,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    const worker = new AgenticModelDiscoveryWorker(
      "model:journal",
      "provider/cheap",
      { async run() { return result; } },
    );
    const run = await new DiscoveryPool([worker]).run(agentTask);
    const record = new DiscoveryLedger(2).record(agentTask, run);
    const restored = assertDiscoveryRunRecord(JSON.parse(JSON.stringify(record)));

    expect(restored.workerReports?.[0]?.agentTrace).toEqual(result.trace);
    expect(restored.workerReports?.[0]?.agentTrace?.effects).toHaveLength(3);
    const tampered = JSON.parse(JSON.stringify(record));
    tampered.workerReports[0].agentTrace.effects[1].outputIdentity =
      `sha256:${"f".repeat(64)}`;
    // A valid-looking substituted hash is detectable only when the surrounding
    // trace identity is bound elsewhere, so exercise an intrinsic invariant too.
    tampered.workerReports[0].agentTrace.effects[1].ordinal = 99;
    expect(() => assertDiscoveryRunRecord(tampered)).toThrow(/agent effect/);
  });

  it("replays v1 catalog-read counts without weakening v2 validation", async () => {
    const session = new DiscoveryAgentSession("model:migration", agentTask, 24);
    session.inspectListings({ listingRefs: ["kalshi:unknown"] });
    session.inspectListings({ listingRefs: [TEST_LISTING_REF] });
    const result = session.finish({
      stepCount: 2,
      providerRequestAttemptCount: 2,
      toolCallCount: 2,
      terminationReason: "MODEL_FINISHED",
    });
    const worker = new AgenticModelDiscoveryWorker(
      "model:migration",
      "provider/cheap",
      { async run() { return result; } },
    );
    const run = await new DiscoveryPool([worker]).run(agentTask);
    const record = new DiscoveryLedger(2).record(agentTask, run);

    const legacy = JSON.parse(JSON.stringify(record));
    delete legacy.workerReports[0].agentTrace.acceptedFalsificationCount;
    delete legacy.workerReports[0].agentTrace.rejectedFalsificationCount;
    for (const effect of legacy.workerReports[0].agentTrace.effects) {
      delete effect.falsificationId;
    }
    legacy.workerReports[0].agentTrace.schemaVersion =
      "pmh.discovery-agent-trace.v1";
    legacy.workerReports[0].agentTrace.catalogReadCount = 2;
    expect(
      assertDiscoveryRunRecord(legacy).workerReports?.[0]?.agentTrace,
    ).toMatchObject({
      schemaVersion: "pmh.discovery-agent-trace.v1",
      catalogReadCount: 2,
    });

    const invalidV2 = JSON.parse(JSON.stringify(legacy));
    invalidV2.workerReports[0].agentTrace.schemaVersion =
      "pmh.discovery-agent-trace.v2";
    expect(() => assertDiscoveryRunRecord(invalidV2)).toThrow(
      /agent trace violates/,
    );
  });

  it("round-trips a negative finding without placing it in the proposal pool", async () => {
    const first = agentTask.catalogContext!.listings[0]!;
    const second = Object.freeze({
      ...first,
      listingRef: "venue-b:boston-weather",
      venueId: "venue-b",
      venueInstrumentId: "boston-weather",
      title: "Boston temperature at least 80°F",
      sourceRawHash: `sha256:${"b".repeat(64)}`,
      protocolIdentity: "fixture:venue-b:boston-weather",
    });
    const contextBody = Object.freeze({
      ...agentTask.catalogContext!,
      listings: Object.freeze([first, second]),
    });
    const { contextIdentity: _contextIdentity, ...identityBody } = contextBody;
    const task = Object.freeze({
      ...agentTask,
      taskId: "task:model-agent-falsification",
      venueIds: Object.freeze(["gemini-predictions", "venue-b"]),
      catalogContext: Object.freeze({
        ...identityBody,
        contextIdentity: hashCanonical(identityBody),
      }),
    });
    const session = new DiscoveryAgentSession("model:falsifier", task, 24);
    const refs = task.catalogContext.listings.map((item) => item.listingRef);
    session.inspectListings({ listingRefs: refs });
    session.recordFalsification({
      claim: "These listings settle the same Boston temperature event.",
      reason: "One is a two-degree interval while the other is an open-ended threshold.",
      relationKind: "EQUIVALENCE",
      listingRefs: refs,
      claimSearchTerms: ["Boston temperature", "80°F"],
    });
    session.completeSearch({ reason: "The candidate relation was disproved." });
    const result = session.finish({
      stepCount: 3,
      providerRequestAttemptCount: 3,
      toolCallCount: 3,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    const run = await new DiscoveryPool([
      new AgenticModelDiscoveryWorker(
        "model:falsifier",
        "provider/cheap",
        { async run() { return result; } },
      ),
    ]).run(task);
    const ledger = new DiscoveryLedger(2);
    const record = ledger.record(task, run);
    const restored = assertDiscoveryRunRecord(JSON.parse(JSON.stringify(record)));

    expect(restored.hypotheses).toEqual([]);
    expect(restored.falsifications).toHaveLength(1);
    expect(restored.workerReports?.[0]).toMatchObject({
      hypothesisCount: 0,
      falsificationCount: 1,
      agentTrace: {
        schemaVersion: "pmh.discovery-agent-trace.v3",
        acceptedFalsificationCount: 1,
      },
    });
    expect(ledger.projection()).toMatchObject({
      hypothesisCount: 0,
      falsificationCount: 1,
    });

    const legacy = JSON.parse(JSON.stringify(record));
    const legacyFinding = legacy.falsifications[0];
    legacyFinding.schemaVersion = "pmh.discovery-falsification.v1";
    delete legacyFinding.findingIdentity;
    delete legacyFinding.relationKind;
    const { falsificationId: _legacyId, ...legacyBody } = legacyFinding;
    legacyFinding.falsificationId = hashCanonical(legacyBody);
    const effect = legacy.workerReports[0].agentTrace.effects.find(
      (item: { toolName: string }) => item.toolName === "record_falsification",
    );
    effect.falsificationId = legacyFinding.falsificationId;
    expect(assertDiscoveryRunRecord(legacy).falsifications?.[0]).toMatchObject({
      schemaVersion: "pmh.discovery-falsification.v1",
      falsificationId: legacyFinding.falsificationId,
    });
  });
});
