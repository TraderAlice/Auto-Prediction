import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildEvidenceRequirements,
  OfficialSourceDiscoveryScheduler,
  SqliteOperationalStore,
  type DiscoveryCatalogListing,
  type OfficialSourceDiscoveryAgentPort,
  type OfficialSourceDiscoveryTask,
} from "../src/index.js";

function listing(venueId: string, listingRef: string): DiscoveryCatalogListing {
  return {
    listingRef,
    venueId,
    venueInstrumentId: listingRef,
    title: "Will LAFC win MLS Cup?",
    description: "Current contract",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-12-06T00:00:00.000Z",
    rulesText: null,
    outcomes: [
      { venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.1" },
      { venueOutcomeId: "no", label: "No", indicativePrice: "0.9" },
    ],
    priceScale: "100000000",
    quantityScale: "100000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-10T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity: venueId === "gemini-predictions"
      ? "prediction-markets-v1:2026-07-30"
      : "kalshi-v1",
  };
}

function requirement() {
  const gemini = listing("gemini-predictions", "gemini-predictions:lafc");
  const kalshi = listing("kalshi", "kalshi:lafc");
  return buildEvidenceRequirements({
    origin: "PROBABILITY_ESTIMATION",
    proposalId: hashCanonical({ proposal: "scheduler" }),
    proposalListingRefs: [gemini.listingRef, kalshi.listingRef],
    listings: [gemini, kalshi],
    drafts: [{
      kind: "OUTCOME_MAPPING",
      listingRefs: [gemini.listingRef],
      claim: "Gemini YES maps to winning the named MLS Cup.",
      reason: "The cross-venue probability relation depends on exact scope.",
      satisfyingObservation: "Official terms name the exact competition and outcome.",
      contradictingObservation: "Official terms name another competition or outcome.",
      temporalPosture: "CURRENT",
    }],
  })[0]!;
}

function coalescedRequirements() {
  const gemini = listing("gemini-predictions", "gemini-predictions:lafc");
  const kalshi = listing("kalshi", "kalshi:lafc");
  return buildEvidenceRequirements({
    origin: "PROBABILITY_ESTIMATION",
    proposalId: hashCanonical({ proposal: "coalesced-scheduler" }),
    proposalListingRefs: [gemini.listingRef, kalshi.listingRef],
    listings: [gemini, kalshi],
    drafts: [
      {
        kind: "OUTCOME_MAPPING",
        listingRefs: [gemini.listingRef],
        claim: "Gemini YES maps to winning the named MLS Cup.",
        reason: "The cross-venue probability relation depends on exact scope.",
        satisfyingObservation: "Official terms name the exact competition and outcome.",
        contradictingObservation: "Official terms name another competition or outcome.",
        temporalPosture: "CURRENT",
      },
      {
        kind: "VOID_CANCELLATION",
        listingRefs: [gemini.listingRef],
        claim: "Gemini publishes cancellation treatment for this MLS Cup contract.",
        reason: "The failure state changes if the competition is cancelled.",
        satisfyingObservation: "Official terms state cancellation and postponement treatment.",
        contradictingObservation: "Official terms omit or contradict that treatment.",
        temporalPosture: "CURRENT",
      },
    ],
  });
}

function crossVenueRequirement() {
  const gemini = listing("gemini-predictions", "gemini-predictions:lafc");
  const kalshi = listing("kalshi", "kalshi:lafc");
  return buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({ proposal: "split-scheduler" }),
    proposalListingRefs: [gemini.listingRef, kalshi.listingRef],
    listings: [gemini, kalshi],
    drafts: [{
      kind: "RESOLUTION_RULE",
      listingRefs: [gemini.listingRef, kalshi.listingRef],
      claim: "Both venues publish the exact MLS Cup winner predicate.",
      reason: "Cross-venue equivalence requires both official rule supplies.",
      satisfyingObservation: "Each venue names the same competition and winner condition.",
      contradictingObservation: "Either venue names a materially different condition.",
      temporalPosture: "CURRENT",
    }],
  })[0]!;
}

class FakeAgent implements OfficialSourceDiscoveryAgentPort {
  public readonly configured = true;
  public readonly agentIdentity: Hash = hashCanonical({ agent: "official-source-test" });
  public readonly provider = "CODEX" as const;
  public readonly model = "gpt-5.6-terra";
  public calls = 0;

  public async discover(task: OfficialSourceDiscoveryTask) {
    this.calls += 1;
    const surface = task.surfaces[0]!;
    return {
      outcome: "PROPOSE_LOCATOR" as const,
      candidates: [{
        url: new URL("/official-contract-rule", surface.rootUrl).toString(),
        sourceSurfaceId: surface.surfaceId,
        title: "Official LAFC contract terms",
        evidenceRole: task.targetRole,
        evidenceScope: "CONTRACT_SPECIFIC" as const,
        temporalPosture: task.requirement.temporalPosture,
        rationale: "This official page defines the named contract outcome.",
      }],
      diagnostic: "One official contract-bound source was found.",
      providerRequestCount: 3,
      toolCallCount: 5,
    };
  }
}

describe("official source discovery scheduler", () => {
  it("coalesces same-supply obligations and shares one admitted locator", async () => {
    const agent = new FakeAgent();
    const scheduler = new OfficialSourceDiscoveryScheduler({ agent });
    const requirements = coalescedRequirements();
    scheduler.reconcile(requirements.map((item) => ({
      requirement: item,
      priorityTier: "EVIDENCE_ESCALATION" as const,
    })));
    expect(scheduler.projection()).toMatchObject({ pendingCount: 1, dueCount: 1 });
    const task = scheduler.projection().jobs[0]!.task;
    expect(task.schemaVersion).toBe("pmh.official-source-discovery-task.v2");
    if (task.schemaVersion !== "pmh.official-source-discovery-task.v2") return;
    expect(task.requirementIds).toHaveLength(2);
    expect(task.venueIds).toEqual(["gemini-predictions"]);
    await scheduler.tick()[0];
    const routed = scheduler.applyAdmissions(requirements);
    expect(routed.every((item) => item.acquisitionRoute === "DOCUMENT_LOCATOR")).toBe(true);
    expect(new Set(routed.map((item) =>
      item.eligibleLocators[0]?.locator.locatorIdentity
    )).size).toBe(1);
    expect(agent.calls).toBe(1);
  });

  it("splits one cross-venue requirement and accumulates both admitted supplies", async () => {
    const agent = new FakeAgent();
    const scheduler = new OfficialSourceDiscoveryScheduler({ agent });
    const source = crossVenueRequirement();
    scheduler.reconcile([{ requirement: source, priorityTier: "ACTIVE_TRIAGE_DEBT" }]);
    const tasks = scheduler.projection().jobs.map((job) => job.task);
    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.venueIds[0]).sort()).toEqual([
      "gemini-predictions",
      "kalshi",
    ]);
    expect(tasks.every((task) =>
      task.schemaVersion === "pmh.official-source-discovery-task.v2" &&
      task.requirementIds.includes(source.requirementId) && task.venueIds.length === 1
    )).toBe(true);
    await Promise.all(scheduler.tick());
    const routed = scheduler.applyAdmissions([source])[0]!;
    expect(routed.acquisitionRoute).toBe("DOCUMENT_LOCATOR");
    expect(routed.eligibleLocators).toHaveLength(2);
    expect(routed.eligibleLocators.map((binding) => binding.venueId).sort()).toEqual([
      "gemini-predictions",
      "kalshi",
    ]);
    expect(agent.calls).toBe(2);
  });

  it("retires a superseded obligation bundle from the runnable queue", () => {
    const scheduler = new OfficialSourceDiscoveryScheduler({ agent: new FakeAgent() });
    const requirements = coalescedRequirements();
    scheduler.reconcile([{ requirement: requirements[0]!, priorityTier: "ACTIVE_TRIAGE_DEBT" }]);
    const oldJobId = scheduler.projection().jobs[0]!.jobId;
    scheduler.reconcile(requirements.map((item) => ({
      requirement: item,
      priorityTier: "ACTIVE_TRIAGE_DEBT" as const,
    })));
    expect(scheduler.projection()).toMatchObject({
      pendingCount: 1,
      supersededCount: 1,
    });
    expect(scheduler.projection().jobs[0]?.jobId).not.toBe(oldJobId);
    expect(() => scheduler.runJob(oldJobId)).toThrow("inactive supply scope");
  });

  it("raises a supply task priority without later lowering it", () => {
    const scheduler = new OfficialSourceDiscoveryScheduler({ agent: new FakeAgent() });
    const source = requirement();
    scheduler.reconcile([{
      requirement: source,
      priorityTier: "RETAINED_RESEARCH_DEBT",
    }]);
    scheduler.reconcile([{
      requirement: source,
      priorityTier: "POSITIVE_GROSS_BLOCKER",
    }]);
    const raised = scheduler.projection().jobs[0]!;
    expect(raised.priorityTier).toBe("POSITIVE_GROSS_BLOCKER");
    scheduler.reconcile([{
      requirement: source,
      priorityTier: "RETAINED_RESEARCH_DEBT",
    }]);
    const retained = scheduler.projection().jobs[0]!;
    expect(retained.priorityTier).toBe("POSITIVE_GROSS_BLOCKER");
    expect(retained.artifactHash).toBe(raised.artifactHash);
  });

  it("persists a bounded Agent job and feeds only admitted locators back to acquisition", async () => {
    let now = Date.parse("2026-08-10T01:00:00.000Z");
    const agent = new FakeAgent();
    const scheduler = new OfficialSourceDiscoveryScheduler({
      agent,
      tickIntervalMs: 60_000,
      now: () => now,
    });
    const source = requirement();
    scheduler.reconcile([{ requirement: source, priorityTier: "EVIDENCE_ESCALATION" }]);
    expect(scheduler.projection()).toMatchObject({
      pendingCount: 1,
      dueCount: 1,
      configured: true,
    });
    const runs = scheduler.tick();
    expect(runs).toHaveLength(1);
    const completed = await runs[0];
    expect(completed).toMatchObject({
      status: "ADMITTED",
      providerRequestCount: 3,
      toolCallCount: 5,
    });
    expect(completed.admittedRequirement?.acquisitionRoute).toBe("DOCUMENT_LOCATOR");
    const routed = scheduler.applyAdmissions([source]);
    expect(routed[0]?.acquisitionRoute).toBe("DOCUMENT_LOCATOR");
    expect(routed[0]?.eligibleLocators[0]?.locator.schemaVersion)
      .toBe("pmh.discovery-evidence-locator.v3");
    expect(agent.calls).toBe(1);
    now += 60_000;
    expect(scheduler.tick()).toHaveLength(0);
  });

  it("restores admitted source lineage from SQLite without calling the Agent again", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const agent = new FakeAgent();
    const source = requirement();
    const first = new OfficialSourceDiscoveryScheduler({
      agent,
      tickIntervalMs: 60_000,
      now: () => Date.parse("2026-08-10T01:00:00.000Z"),
      store,
    });
    first.reconcile([{ requirement: source, priorityTier: "POSITIVE_GROSS_BLOCKER" }]);
    await first.tick()[0];
    expect(store.loadOfficialSourceDiscoveryJobRecordsByRequirementIds([
      source.requirementId,
    ])).toHaveLength(1);
    expect(store.loadOfficialSourceDiscoveryJobRecordsByRequirementIds([
      hashCanonical({ requirement: "absent-official-source" }),
    ])).toEqual([]);
    expect(first.projection().storage).toMatchObject({
      mode: "MEMORY",
      schemaVersion: 64,
      idempotencyKey: "jobId",
    });
    const restored = new OfficialSourceDiscoveryScheduler({
      agent,
      tickIntervalMs: 60_000,
      now: () => Date.parse("2026-08-10T02:00:00.000Z"),
      store,
    });
    expect(restored.projection()).toMatchObject({ admittedCount: 1, pendingCount: 0 });
    expect(restored.applyAdmissions([source])[0]?.acquisitionRoute)
      .toBe("DOCUMENT_LOCATOR");
    expect(agent.calls).toBe(1);
    store.close();
  });
});
