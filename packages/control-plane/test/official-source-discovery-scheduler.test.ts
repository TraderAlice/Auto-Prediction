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

class FakeAgent implements OfficialSourceDiscoveryAgentPort {
  public readonly configured = true;
  public readonly agentIdentity: Hash = hashCanonical({ agent: "official-source-test" });
  public readonly provider = "CODEX" as const;
  public readonly model = "gpt-5.6-terra";
  public calls = 0;

  public async discover(task: OfficialSourceDiscoveryTask) {
    this.calls += 1;
    const surface = task.surfaces.find((item) => item.venueId === "gemini-predictions")!;
    return {
      outcome: "PROPOSE_LOCATOR" as const,
      candidates: [{
        url: "https://developer.gemini.com/prediction-markets/prediction-markets/lafc",
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
    expect(first.projection().storage).toMatchObject({
      mode: "MEMORY",
      schemaVersion: 34,
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
