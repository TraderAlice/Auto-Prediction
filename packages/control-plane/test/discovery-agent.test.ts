import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  DiscoveryAgentSession,
  type DiscoveryCatalogContext,
  type DiscoveryTask,
} from "../src/index.js";

function context(): DiscoveryCatalogContext {
  const listings = [
    {
      listingRef: "venue-a:rain-yes",
      venueId: "venue-a",
      venueInstrumentId: "rain-yes",
      title: "Will NYC rain exceed 0.25 inches on Monday?",
      description: "Resolves yes from the official Central Park gauge.",
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      closesAt: "2026-08-03T12:00:00.000Z",
      rulesText: "Uses the Central Park daily rainfall report.",
      outcomes: [
        { venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.40" },
        { venueOutcomeId: "no", label: "No", indicativePrice: "0.60" },
      ],
      priceScale: "1000000",
      quantityScale: "1000000",
      minPriceTick: "10000",
      sourceKind: "LIVE_OBSERVATION" as const,
      sourceReceivedAt: "2026-08-02T00:00:00.000Z",
      sourceRawHash: `sha256:${"a".repeat(64)}`,
      protocolIdentity: "fixture:venue-a:rain-yes",
    },
    {
      listingRef: "venue-b:nyc-rain",
      venueId: "venue-b",
      venueInstrumentId: "nyc-rain",
      title: "NYC rainfall above a quarter inch Monday?",
      description: "A potentially equivalent contract.",
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      closesAt: "2026-08-03T12:00:00.000Z",
      rulesText: "Uses the Central Park daily rainfall report.",
      outcomes: [
        { venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.45" },
        { venueOutcomeId: "no", label: "No", indicativePrice: "0.55" },
      ],
      priceScale: "1000000",
      quantityScale: "1000000",
      minPriceTick: "10000",
      sourceKind: "LIVE_OBSERVATION" as const,
      sourceReceivedAt: "2026-08-02T00:00:00.000Z",
      sourceRawHash: `sha256:${"b".repeat(64)}`,
      protocolIdentity: "fixture:venue-b:nyc-rain",
    },
  ];
  const body = {
    schemaVersion: "pmh.discovery-catalog-context.v2" as const,
    source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
    contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
    listings,
  };
  return { ...body, contextIdentity: hashCanonical(body) };
}

const task: DiscoveryTask = {
  taskId: "task:agent-first-rain",
  question: "Find related NYC rain contracts.",
  venueIds: ["venue-a", "venue-b"],
  maxHypotheses: 3,
  deadlineEpochMs: Date.now() + 300_000,
  catalogContext: context(),
};

describe("bounded discovery agent session", () => {
  it("rejects premature completion and proposals until the required reads occur", () => {
    const session = new DiscoveryAgentSession("model-agent", task, 12);
    expect(session.completeSearch({ reason: "Skip the catalog." })).toMatchObject({
      status: "REJECTED",
      reason: "SEARCH_REQUIRED",
    });
    expect(session.recordHypothesis({
      thesis: "These contracts might match.",
      strategyKind: "SAME_CLAIM_CROSS_VENUE",
      listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
      claimSearchTerms: ["rainfall"],
      confidenceBps: 5_000,
    })).toMatchObject({
      status: "REJECTED",
      reason: "INSPECTION_REQUIRED",
    });
  });

  it("searches and inspects only the immutable assigned catalog", () => {
    const session = new DiscoveryAgentSession("model-agent", task, 12);
    expect(session.searchCatalog({ terms: ["rainfall", "Central Park"] }))
      .toMatchObject({
        status: "ACCEPTED",
        reason: "CATALOG_RESULTS",
        listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
      });
    expect(session.inspectListings({ listingRefs: ["venue-a:rain-yes"] }))
      .toMatchObject({
        status: "ACCEPTED",
        reason: "LISTINGS_INSPECTED",
        listingRefs: ["venue-a:rain-yes"],
      });
    expect(session.inspectListings({ listingRefs: ["venue-c:invented"] }))
      .toMatchObject({
        status: "REJECTED",
        reason: "UNKNOWN_LISTING",
      });
  });

  it("lets a rejected proposal self-correct without losing accepted effects", () => {
    const session = new DiscoveryAgentSession("model-agent", task, 12);
    expect(session.recordHypothesis({
      thesis: "An ungrounded guess.",
      strategyKind: "SAME_CLAIM_CROSS_VENUE",
      listingRefs: ["venue-a:rain-yes", "venue-c:invented"],
      claimSearchTerms: ["rain"],
      confidenceBps: 5_000,
    })).toMatchObject({ status: "REJECTED", reason: "UNKNOWN_LISTING" });
    session.inspectListings({
      listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
    });
    const accepted = session.recordHypothesis({
      thesis: "These contracts may use the same gauge and threshold.",
      strategyKind: "SAME_CLAIM_CROSS_VENUE",
      listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
      claimSearchTerms: ["rainfall", "central park"],
      confidenceBps: 7_000,
    });
    expect(accepted).toMatchObject({
      status: "ACCEPTED",
      reason: "HYPOTHESIS_RECORDED",
      hypothesisId: expect.stringMatching(/^hypothesis:/),
    });
    expect(session.completeSearch({ reason: "One grounded lead recorded." }))
      .toMatchObject({ status: "ACCEPTED", reason: "SEARCH_COMPLETED" });

    const result = session.finish({
      stepCount: 3,
      providerRequestAttemptCount: 3,
      toolCallCount: 4,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0]).toMatchObject({
      venueIds: ["venue-a", "venue-b"],
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
    expect(result.trace).toMatchObject({
      acceptedProposalCount: 1,
      rejectedProposalCount: 1,
      terminationReason: "EXPLICIT_COMPLETION",
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
  });

  it("keeps single-listing observations out of the semantic proposal lane", () => {
    const session = new DiscoveryAgentSession("model-agent", task, 12);
    session.inspectListings({ listingRefs: ["venue-a:rain-yes"] });
    expect(session.recordHypothesis({
      thesis: "No grounded relation was found, but retain this contract.",
      strategyKind: "COMPLETE_SET",
      listingRefs: ["venue-a:rain-yes"],
      claimSearchTerms: ["rainfall"],
      confidenceBps: 9_000,
    })).toMatchObject({
      status: "REJECTED",
      reason: "INVALID_INPUT",
      guidance: expect.stringContaining("2-20 listingRefs"),
    });
    expect(session.completeSearch({ reason: "No relational lead survived inspection." }))
      .toMatchObject({ status: "ACCEPTED", reason: "SEARCH_COMPLETED" });
    expect(session.finish({
      stepCount: 2,
      providerRequestAttemptCount: 2,
      toolCallCount: 3,
      terminationReason: "EXPLICIT_COMPLETION",
    }).hypotheses).toEqual([]);
  });

  it("makes exact repeated tool inputs idempotent", () => {
    const session = new DiscoveryAgentSession("model-agent", task, 12);
    session.inspectListings({
      listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
    });
    const input = {
      thesis: "These contracts may use the same gauge and threshold.",
      strategyKind: "SAME_CLAIM_CROSS_VENUE",
      listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
      claimSearchTerms: ["rainfall"],
      confidenceBps: 6_000,
    };
    const first = session.recordHypothesis(input);
    const replay = session.recordHypothesis(input);
    expect(first.status).toBe("ACCEPTED");
    expect(replay).toMatchObject({
      status: "IDEMPOTENT_REPLAY",
      reason: "DUPLICATE",
      hypothesisId: first.hypothesisId,
    });
    expect(session.finish({
      stepCount: 1,
      providerRequestAttemptCount: 1,
      toolCallCount: 2,
      terminationReason: "MODEL_FINISHED",
    }).hypotheses).toHaveLength(1);
  });

  it("retains inspected falsifications without creating a hypothesis", () => {
    const session = new DiscoveryAgentSession("model-agent", task, 12);
    const input = {
      claim: "The two rain contracts settle the same event.",
      reason:
        "The first uses daily accumulation while the second uses an hourly observation window.",
      relationKind: "EQUIVALENCE" as const,
      listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
      claimSearchTerms: ["NYC rainfall", "Central Park"],
    };
    expect(session.recordFalsification({
      ...input,
      claim: "An uninspected equivalence claim.",
    })).toMatchObject({
      status: "REJECTED",
      reason: "INSPECTION_REQUIRED",
    });
    session.inspectListings({ listingRefs: input.listingRefs });
    const accepted = session.recordFalsification(input);
    expect(accepted).toMatchObject({
      status: "ACCEPTED",
      reason: "FALSIFICATION_RECORDED",
      hypothesisId: null,
      falsificationId: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
    expect(session.recordFalsification(input)).toMatchObject({
      status: "IDEMPOTENT_REPLAY",
      reason: "DUPLICATE",
      falsificationId: accepted.falsificationId,
    });
    session.completeSearch({ reason: "The inspected relation was disproved." });
    const result = session.finish({
      stepCount: 3,
      providerRequestAttemptCount: 3,
      toolCallCount: 4,
      terminationReason: "EXPLICIT_COMPLETION",
    });
    expect(result.hypotheses).toEqual([]);
    expect(result.falsifications).toHaveLength(1);
    expect(result.falsifications[0]).toMatchObject({
      claim: input.claim,
      listingRefs: ["venue-a:rain-yes", "venue-b:nyc-rain"],
      authority: "SEARCH_NEGATIVE_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
    expect(result.trace).toMatchObject({
      schemaVersion: "pmh.discovery-agent-trace.v3",
      acceptedProposalCount: 0,
      acceptedFalsificationCount: 1,
      rejectedFalsificationCount: 1,
    });
  });
});
