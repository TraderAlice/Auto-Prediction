import { describe, expect, it } from "vitest";
import {
  DiscoveryPool,
  HeuristicDiscoveryWorker,
  StructuredModelDiscoveryWorker,
  type AiModelPort,
  type DiscoveryTask,
} from "../src/index.js";

const task: DiscoveryTask = {
  taskId: "task:rain",
  question: "Will NYC rainfall exceed 0.25 inches?",
  venueIds: ["kalshi", "polymarket-global"],
  maxHypotheses: 5,
  deadlineEpochMs: 2_000,
};

describe("AI-native discovery boundary", () => {
  it("runs cheap scouts in parallel and emits proposal-only hypotheses", async () => {
    const pool = new DiscoveryPool(
      [
        new HeuristicDiscoveryWorker("heuristic-a"),
        new HeuristicDiscoveryWorker("heuristic-b"),
      ],
      () => 1_000,
    );
    const run = await pool.run(task);
    expect(run.workerIds).toEqual(["heuristic-a", "heuristic-b"]);
    expect(run.workerReports).toEqual([
      {
        workerId: "heuristic-a",
        kind: "HEURISTIC",
        costTier: "FREE",
        status: "PASS",
        startedAt: "1970-01-01T00:00:01.000Z",
        completedAt: "1970-01-01T00:00:01.000Z",
        durationMs: 0,
        hypothesisCount: 1,
        diagnostic: null,
      },
      {
        workerId: "heuristic-b",
        kind: "HEURISTIC",
        costTier: "FREE",
        status: "PASS",
        startedAt: "1970-01-01T00:00:01.000Z",
        completedAt: "1970-01-01T00:00:01.000Z",
        durationMs: 0,
        hypothesisCount: 1,
        diagnostic: null,
      },
    ]);
    expect(run.hypotheses).toHaveLength(1);
    expect(run.hypotheses[0]).toMatchObject({
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
    expect(run.hypotheses[0]?.claimSearchTerms).not.toContain("will");
    expect(run.executionAuthority).toBe(false);
  });

  it("adapts structured model output without promoting its claims", async () => {
    const port: AiModelPort = {
      async completeStructured() {
        return {
          hypotheses: [
            {
              thesis: "These listings may express the same rainfall claim.",
              strategyKind: "SAME_CLAIM_CROSS_VENUE",
              venueIds: ["kalshi", "polymarket-global"],
              claimSearchTerms: ["nyc", "rainfall"],
              listingRefs: [],
              confidenceBps: 7_000,
            },
          ],
        };
      },
    };
    const worker = new StructuredModelDiscoveryWorker(
      "model-fast-1",
      "provider/model-small",
      port,
    );
    const [hypothesis] = await worker.discover(task);
    expect(hypothesis?.authority).toBe("PROPOSE_ONLY");
    expect(hypothesis?.reviewStatus).toBe("UNREVIEWED");
  });

  it("fails closed on unsafe model output", async () => {
    const port: AiModelPort = {
      async completeStructured() {
        return { certificate: "trust me" };
      },
    };
    const worker = new StructuredModelDiscoveryWorker(
      "model-fast-1",
      "provider/model-small",
      port,
    );
    await expect(worker.discover(task)).rejects.toThrow(/does not match/);

    const authorityPort: AiModelPort = {
      async completeStructured() {
        return {
          hypotheses: [
            {
              thesis: "A model must not inject authority fields.",
              strategyKind: "SAME_CLAIM_CROSS_VENUE",
              venueIds: ["kalshi", "polymarket-global"],
              claimSearchTerms: ["rain"],
              listingRefs: [],
              confidenceBps: 9_999,
              authority: "CERTIFY_AND_EXECUTE",
            },
          ],
        };
      },
    };
    await expect(
      new StructuredModelDiscoveryWorker(
        "model-fast-1",
        "provider/model-small",
        authorityPort,
      ).discover(task),
    ).rejects.toThrow(/invalid shape/);
  });

  it("keeps heuristic proposals when a model worker fails closed", async () => {
    const port: AiModelPort = {
      async completeStructured() {
        throw new Error("model fixture unavailable");
      },
    };
    const pool = new DiscoveryPool(
      [
        new HeuristicDiscoveryWorker(),
        new StructuredModelDiscoveryWorker(
          "model-fast-lane",
          "gpt-5.4-mini",
          port,
        ),
      ],
      () => 1_000,
    );
    const run = await pool.run(task);
    expect(run.hypotheses).toHaveLength(1);
    expect(run.diagnostics).toEqual(["model fixture unavailable"]);
    expect(run.workerReports).toEqual([
      expect.objectContaining({
        workerId: "heuristic-fast-1",
        status: "PASS",
        hypothesisCount: 1,
        diagnostic: null,
      }),
      expect.objectContaining({
        workerId: "model-fast-lane",
        status: "FAILED",
        hypothesisCount: 0,
        diagnostic: "model fixture unavailable",
      }),
    ]);
    expect(run.executionAuthority).toBe(false);
  });

  it("runs every free worker but only the leased number of model workers", async () => {
    let modelCalls = 0;
    const port: AiModelPort = {
      async completeStructured() {
        modelCalls += 1;
        return { hypotheses: [] };
      },
    };
    const pool = new DiscoveryPool(
      [
        new HeuristicDiscoveryWorker("heuristic-budget"),
        new StructuredModelDiscoveryWorker("model-budget-1", "cheap-1", port),
        new StructuredModelDiscoveryWorker("model-budget-2", "cheap-2", port),
      ],
      () => 1_000,
    );
    const run = await pool.run(task, { maxModelWorkers: 1 });
    expect(run.workerIds).toEqual(["heuristic-budget", "model-budget-1"]);
    expect(modelCalls).toBe(1);
  });

  it("rejects expired or unbounded discovery work", async () => {
    const pool = new DiscoveryPool(
      [new HeuristicDiscoveryWorker()],
      () => 3_000,
    );
    await expect(pool.run(task)).rejects.toThrow(/expired/);
    await expect(
      pool.run({ ...task, deadlineEpochMs: 4_000, maxHypotheses: 51 }),
    ).rejects.toThrow(/invalid or unbounded/);
  });

  it("bounds heuristic prose derived from a maximum-length issue question", async () => {
    const pool = new DiscoveryPool([new HeuristicDiscoveryWorker()], () => 1_000);
    const run = await pool.run({
      ...task,
      taskId: "task:bounded-long-question",
      question: `Find related markets ${"and falsify semantic similarity ".repeat(14)}`.slice(0, 500),
    });
    expect(run.hypotheses[0]?.thesis.length).toBeLessThanOrEqual(500);
    expect(run.workerReports[0]).toMatchObject({ status: "PASS" });
  });
});
