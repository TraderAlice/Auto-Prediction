import { describe, expect, it } from "vitest";
import {
  buildResearchCaseDesk,
  createPiInvestigatorRuntime,
  DiscoveryLedger,
  DiscoveryPool,
  FixtureCatalogDiscoveryDesk,
  HeuristicDiscoveryWorker,
  InvestigationDesk,
  type DiscoveryDeskProjection,
  type DiscoveryTask,
  type PiProcessResult,
} from "../src/index.js";

async function fixtureTask(taskId: string): Promise<DiscoveryTask> {
  const catalog = new FixtureCatalogDiscoveryDesk();
  await catalog.load();
  return {
    taskId,
    question: "Highest temperature in Boston on July 31, 2026?",
    venueIds: ["gemini-predictions"],
    maxHypotheses: 5,
    deadlineEpochMs: Date.now() + 30_000,
    catalogContext: catalog.context(
      "Highest temperature in Boston on July 31, 2026?",
      ["gemini-predictions"],
    ),
  };
}

function piResult(listingRef: string): PiProcessResult {
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      summary: "The fixture range needs independent rule evidence.",
      candidateListingRefs: [listingRef],
      findings: [
        {
          listingRefs: [listingRef],
          statement: "The listing is one member of a temperature partition.",
          severity: "WARNING",
        },
      ],
      missingEvidence: ["Independent station-resolution evidence"],
    }),
    stderr: "",
    timedOut: false,
    outputLimitExceeded: false,
  };
}

describe("research case desk", () => {
  it("joins scout and retry history into one non-promotable research case", async () => {
    const scoutTask = await fixtureTask("task:case:scout");
    const investigationTask: DiscoveryTask = {
      ...scoutTask,
      taskId: "task:case:investigation",
    };
    const pool = new DiscoveryPool([new HeuristicDiscoveryWorker()]);
    const ledger = new DiscoveryLedger();
    ledger.record(scoutTask, await pool.run(scoutTask));
    const listingRef = scoutTask.catalogContext?.listings[0]?.listingRef;
    if (listingRef === undefined) throw new Error("missing fixture listing");
    let attempt = 0;
    const runtime = createPiInvestigatorRuntime(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        runner: async () => {
          attempt += 1;
          if (attempt === 1) throw new Error("pi investigator timed out");
          return piResult(listingRef);
        },
      },
    );
    const investigations = new InvestigationDesk(runtime.investigator);
    await investigations.begin(investigationTask).promise;
    await investigations.begin(investigationTask).promise;

    const desk = buildResearchCaseDesk(
      ledger.projection(),
      investigations.projection(),
    );
    expect(desk).toMatchObject({
      caseCount: 1,
      activeCount: 0,
      evidenceGapCount: 1,
      awaitingReviewCount: 0,
      needsContextCount: 0,
      needsInvestigationCount: 0,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(desk.cases[0]).toMatchObject({
      taskIds: ["task:case:investigation", "task:case:scout"],
      status: "EVIDENCE_GAPS",
      catalogContextSource: "VERIFIED_FIXTURE_CATALOGS",
      catalogListingCount: 6,
      scout: { status: "LEADS", hypothesisCount: 1 },
      investigation: {
        status: "PASS",
        attemptCount: 2,
        failedAttemptCount: 1,
        findingCount: 1,
        warningCount: 1,
      },
      candidateListingRefCount: 6,
      missingEvidence: ["Independent station-resolution evidence"],
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      promotionEligible: false,
      executionAuthority: false,
    });
    expect(desk.cases[0]?.candidateListingRefs).toContain(listingRef);
    expect(desk.cases[0]?.stages.map((stage) => [stage.stage, stage.status]))
      .toEqual([
        ["CATALOG_CONTEXT", "BOUND"],
        ["SCOUT_DISCOVERY", "PRESENT"],
        ["DEEP_INVESTIGATION", "PRESENT"],
        ["INDEPENDENT_REVIEW", "BLOCKED"],
        ["DETERMINISTIC_COMPILATION", "BLOCKED"],
        ["EXACT_VERIFICATION", "BLOCKED"],
      ]);
  });

  it("projects a scout lead that still needs deep investigation", async () => {
    const task = await fixtureTask("task:case:scout-only");
    const ledger = new DiscoveryLedger();
    ledger.record(
      task,
      await new DiscoveryPool([new HeuristicDiscoveryWorker()]).run(task),
    );
    const desk = buildResearchCaseDesk(ledger.projection(), {
      retentionLimit: 10,
      activeCount: 0,
      runCount: 0,
      passCount: 0,
      failedCount: 0,
      storage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "taskId+catalogContextIdentity",
      },
      records: [],
    });
    expect(desk).toMatchObject({
      caseCount: 1,
      needsInvestigationCount: 1,
      cases: [
        {
          status: "NEEDS_INVESTIGATION",
          investigation: { status: "MISSING", attemptCount: 0 },
          promotionEligible: false,
        },
      ],
    });
  });

  it("fails closed if an upstream projection asserts authority", async () => {
    const task = await fixtureTask("task:case:unsafe");
    const ledger = new DiscoveryLedger();
    ledger.record(
      task,
      await new DiscoveryPool([new HeuristicDiscoveryWorker()]).run(task),
    );
    const projection = ledger.projection();
    const run = projection.runs[0];
    if (run === undefined) throw new Error("missing discovery run");
    const unsafe = {
      ...projection,
      runs: [{ ...run, executionAuthority: true }],
    } as unknown as DiscoveryDeskProjection;
    expect(() =>
      buildResearchCaseDesk(unsafe, {
        retentionLimit: 10,
        activeCount: 0,
        runCount: 0,
        passCount: 0,
        failedCount: 0,
        storage: {
          mode: "MEMORY",
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "taskId+catalogContextIdentity",
        },
        records: [],
      }),
    ).toThrow(/authority boundary/);
  });

  it("rejects conflicting listing counts for one context identity", async () => {
    const task = await fixtureTask("task:case:count-conflict");
    const ledger = new DiscoveryLedger();
    ledger.record(
      task,
      await new DiscoveryPool([new HeuristicDiscoveryWorker()]).run(task),
    );
    expect(() =>
      buildResearchCaseDesk(ledger.projection(), {
        retentionLimit: 10,
        activeCount: 0,
        runCount: 1,
        passCount: 0,
        failedCount: 1,
        storage: {
          mode: "MEMORY",
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "taskId+catalogContextIdentity",
        },
        records: [
          {
            investigationId: `investigation:${"a".repeat(64)}`,
            taskId: "task:case:count-conflict:pi",
            question: task.question,
            venueIds: task.venueIds,
            catalogContextIdentity:
              task.catalogContext?.contextIdentity ?? "missing",
            catalogListingCount: 5,
            catalogContextSource: "VERIFIED_FIXTURE_CATALOGS",
            status: "FAILED",
            startedAt: "2026-08-01T00:00:00.000Z",
            completedAt: "2026-08-01T00:00:01.000Z",
            report: null,
            diagnostic: "pi investigator timed out",
            authority: "PROPOSE_ONLY",
            reviewStatus: "UNREVIEWED",
            executionAuthority: false,
          },
        ],
      }),
    ).toThrow(/conflicting catalog listing counts/);
  });
});
