import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  createPiInvestigatorRuntime,
  InvestigationBusyError,
  InvestigationDesk,
  InvestigationNotConfiguredError,
  type DiscoveryTask,
  type PiProcessResult,
  type PiProcessRunner,
} from "../src/index.js";

function task(taskId = "task:investigation:test", question = "Investigate A"): DiscoveryTask {
  return {
    taskId,
    question,
    venueIds: ["gemini-predictions"],
    maxHypotheses: 3,
    deadlineEpochMs: Date.now() + 30_000,
    catalogContext: {
      schemaVersion: "pmh.discovery-catalog-context.v2",
      source: "VERIFIED_FIXTURE_CATALOGS",
      contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
      contextIdentity: hashCanonical({ taskId, question }),
      listings: [
        {
          listingRef: "gemini-predictions:fixture-a",
          venueId: "gemini-predictions",
          venueInstrumentId: "fixture-a",
          title: "Fixture A",
          description: "Bounded fixture",
          status: "OPEN",
          mechanism: "CLOB",
          closesAt: null,
          rulesText: null,
          outcomes: [{ label: "Yes", indicativePrice: "0.5" }],
          sourceKind: "VERIFIED_FIXTURE",
          sourceReceivedAt: "2026-07-31T00:00:00.000Z",
          sourceRawHash: hashCanonical({ source: "fixture-a" }),
          protocolIdentity: "prediction-markets-v1:test",
        },
      ],
    },
  };
}

function processResult(summary = "Bounded investigation complete."): PiProcessResult {
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      summary,
      candidateListingRefs: [],
      findings: [],
      missingEvidence: ["Independent resolution evidence"],
    }),
    stderr: "",
    timedOut: false,
    outputLimitExceeded: false,
  };
}

function deskWithRunner(runner: PiProcessRunner): InvestigationDesk {
  const runtime = createPiInvestigatorRuntime(
    { DEEPSEEK_API_KEY: "test-only-key" },
    { runner },
  );
  return new InvestigationDesk(runtime.investigator, 3);
}

describe("investigation desk", () => {
  it("fails closed when pi is not configured", () => {
    const desk = new InvestigationDesk(null);
    expect(() => desk.begin(task())).toThrow(InvestigationNotConfiguredError);
    expect(desk.projection()).toMatchObject({ activeCount: 0, runCount: 0 });
  });

  it("projects a running job and retains its proposal-only report", async () => {
    let finish!: (result: PiProcessResult) => void;
    const process = new Promise<PiProcessResult>((resolve) => {
      finish = resolve;
    });
    const desk = deskWithRunner(() => process);
    const invocation = desk.begin(task());
    expect(invocation.idempotentReplay).toBe(false);
    expect(desk.projection()).toMatchObject({
      activeCount: 1,
      runCount: 1,
      records: [{ status: "RUNNING", executionAuthority: false }],
    });

    finish(processResult());
    const record = await invocation.promise;
    expect(record).toMatchObject({
      status: "PASS",
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      executionAuthority: false,
      report: {
        status: "PASS",
        result: { executionAuthority: false },
      },
    });
    expect(desk.projection()).toMatchObject({
      activeCount: 0,
      passCount: 1,
      failedCount: 0,
    });
  });

  it("shares an identical in-flight task and rejects competing work", async () => {
    let finish!: (result: PiProcessResult) => void;
    const process = new Promise<PiProcessResult>((resolve) => {
      finish = resolve;
    });
    const desk = deskWithRunner(() => process);
    const first = desk.begin(task());
    const duplicate = desk.begin(task());
    expect(duplicate.idempotentReplay).toBe(true);
    expect(duplicate.promise).toBe(first.promise);
    expect(() =>
      desk.begin(task("task:investigation:other", "Investigate B")),
    ).toThrow(InvestigationBusyError);

    finish(processResult());
    const completed = await first.promise;
    const replay = desk.begin(task());
    expect(replay.idempotentReplay).toBe(true);
    await expect(replay.promise).resolves.toBe(completed);
  });

  it("retains a sanitized failure and permits a later retry", async () => {
    let attempts = 0;
    const desk = deskWithRunner(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("upstream leaked test-only-key");
      return processResult("Retry passed.");
    });
    const failed = await desk.begin(task()).promise;
    expect(failed).toMatchObject({
      status: "FAILED",
      diagnostic: "pi investigator failed",
      report: null,
      executionAuthority: false,
    });
    expect(JSON.stringify(failed)).not.toContain("test-only-key");

    const passed = await desk.begin(task()).promise;
    expect(passed.status).toBe("PASS");
    expect(desk.projection()).toMatchObject({
      activeCount: 0,
      runCount: 2,
      passCount: 1,
      failedCount: 1,
    });
  });
});
