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
    expect(run.hypotheses).toHaveLength(1);
    expect(run.hypotheses[0]).toMatchObject({
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
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
});
