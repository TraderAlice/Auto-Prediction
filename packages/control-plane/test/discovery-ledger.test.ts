import { describe, expect, it } from "vitest";
import {
  assertDiscoveryRunRecord,
  DiscoveryLedger,
  DiscoveryPool,
  HeuristicDiscoveryWorker,
  type DiscoveryTask,
} from "../src/index.js";

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
});
