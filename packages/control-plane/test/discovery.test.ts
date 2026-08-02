import { describe, expect, it } from "vitest";
import {
  AgenticModelDiscoveryWorker,
  DiscoveryPool,
  HeuristicDiscoveryWorker,
  ModelRequestFailure,
  type DiscoveryAgentPort,
  type DiscoveryAgentTrace,
  type DiscoveryTask,
} from "../src/index.js";

const task: DiscoveryTask = {
  taskId: "task:rain",
  question: "Will NYC rainfall exceed 0.25 inches?",
  venueIds: ["kalshi", "polymarket-global"],
  maxHypotheses: 5,
  deadlineEpochMs: 2_000,
};

function trace(
  overrides: Partial<DiscoveryAgentTrace> = {},
): DiscoveryAgentTrace {
  return Object.freeze({
    schemaVersion: "pmh.discovery-agent-trace.v1",
    protocol: "PMH_BOUNDED_TOOL_LOOP_V1",
    stepCount: 1,
    providerRequestAttemptCount: 1,
    toolCallCount: 1,
    catalogReadCount: 0,
    acceptedProposalCount: 0,
    rejectedProposalCount: 0,
    terminationReason: "EXPLICIT_COMPLETION",
    effects: Object.freeze([]),
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
    ...overrides,
  });
}

describe("AI-native discovery boundary", () => {
  it("runs free scouts in parallel and emits proposal-only hypotheses", async () => {
    const pool = new DiscoveryPool(
      [new HeuristicDiscoveryWorker("heuristic-a"), new HeuristicDiscoveryWorker("heuristic-b")],
      () => 1_000,
    );
    const run = await pool.run(task);
    expect(run.workerIds).toEqual(["heuristic-a", "heuristic-b"]);
    expect(run.workerReports).toEqual([
      expect.objectContaining({
        workerId: "heuristic-a",
        status: "PASS",
        providerRequestAttemptCount: 0,
        providerFailureCategory: null,
      }),
      expect.objectContaining({
        workerId: "heuristic-b",
        status: "PASS",
        providerRequestAttemptCount: 0,
        providerFailureCategory: null,
      }),
    ]);
    expect(run.hypotheses).toHaveLength(1);
    expect(run.hypotheses[0]).toMatchObject({
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
    expect(run.hypotheses[0]?.claimSearchTerms).not.toContain("will");
    expect(run.executionAuthority).toBe(false);
  });

  it("propagates agent results and trace without promoting authority", async () => {
    const port: DiscoveryAgentPort = {
      async run(input) {
        return Object.freeze({
          hypotheses: Object.freeze([{
            hypothesisId: "hypothesis:agent-test",
            workerId: input.workerId,
            thesis: "These listings may express the same rainfall claim.",
            strategyKind: "SAME_CLAIM_CROSS_VENUE" as const,
            venueIds: Object.freeze(["kalshi", "polymarket-global"]),
            claimSearchTerms: Object.freeze(["nyc", "rainfall"]),
            listingRefs: Object.freeze([]),
            confidenceBps: 7_000,
            authority: "PROPOSE_ONLY" as const,
            reviewStatus: "UNREVIEWED" as const,
          }]),
          trace: trace({
            acceptedProposalCount: 1,
            terminationReason: "PROPOSAL_LIMIT",
          }),
        });
      },
    };
    const worker = new AgenticModelDiscoveryWorker(
      "model-fast-1",
      "provider/model-small",
      port,
    );
    const result = await worker.runWithTrace(task);
    expect(result.hypotheses[0]).toMatchObject({
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
    expect(result.trace.semanticDecisionAuthority).toBe(false);
    expect(result.trace.executionAuthority).toBe(false);
  });

  it("keeps heuristic proposals and partial model trace when an agent fails", async () => {
    const failedTrace = trace({ terminationReason: "PROVIDER_FAILURE" });
    const port: DiscoveryAgentPort = {
      async run() {
        throw new ModelRequestFailure("MODEL", "RETRYABLE_PROVIDER", 1, {
          agentTrace: failedTrace,
        });
      },
    };
    const pool = new DiscoveryPool([
      new HeuristicDiscoveryWorker(),
      new AgenticModelDiscoveryWorker("model-fast-lane", "cheap-model", port),
    ], () => 1_000);
    const run = await pool.run(task);
    expect(run.hypotheses).toHaveLength(1);
    expect(run.diagnostics).toEqual(["MODEL model request failed [RETRYABLE_PROVIDER]"]);
    expect(run.workerReports?.[1]).toMatchObject({
      workerId: "model-fast-lane",
      status: "FAILED",
      hypothesisCount: 0,
      providerRequestAttemptCount: 1,
      providerFailureCategory: "RETRYABLE_PROVIDER",
      agentTrace: { terminationReason: "PROVIDER_FAILURE" },
    });
  });

  it("runs every free worker but only the leased number of agent workers", async () => {
    let modelCalls = 0;
    const port: DiscoveryAgentPort = {
      async run() {
        modelCalls += 1;
        return Object.freeze({ hypotheses: Object.freeze([]), trace: trace() });
      },
    };
    const pool = new DiscoveryPool([
      new HeuristicDiscoveryWorker("heuristic-budget"),
      new AgenticModelDiscoveryWorker("model-budget-1", "cheap-1", port),
      new AgenticModelDiscoveryWorker("model-budget-2", "cheap-2", port),
    ], () => 1_000);
    const run = await pool.run(task, { maxModelWorkers: 1 });
    expect(run.workerIds).toEqual(["heuristic-budget", "model-budget-1"]);
    expect(modelCalls).toBe(1);
  });

  it("rejects expired or unbounded discovery work", async () => {
    const pool = new DiscoveryPool([new HeuristicDiscoveryWorker()], () => 3_000);
    await expect(pool.run(task)).rejects.toThrow(/expired/);
    await expect(pool.run({ ...task, deadlineEpochMs: 4_000, maxHypotheses: 51 }))
      .rejects.toThrow(/invalid or unbounded/);
  });

  it("bounds heuristic prose derived from a maximum-length issue question", async () => {
    const pool = new DiscoveryPool([new HeuristicDiscoveryWorker()], () => 1_000);
    const run = await pool.run({
      ...task,
      taskId: "task:bounded-long-question",
      question: `Find related markets ${"and falsify semantic similarity ".repeat(14)}`.slice(0, 500),
    });
    expect(run.hypotheses[0]?.thesis.length).toBeLessThanOrEqual(500);
    expect(run.workerReports?.[0]).toMatchObject({ status: "PASS" });
  });
});
