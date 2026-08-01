import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  applyProposalEconomicPriority,
  assertProposalEconomicTriageProjection,
  buildMarketCorpusSnapshot,
  buildProposalEconomicTriage,
  buildProposalEvidenceBundle,
  explicitSettlementPosture,
  recoverBaseReviewPriority,
  type DiscoveryCatalogListing,
  type MarketCorpusSnapshot,
  type MarketRelationKind,
  type MarketRelationProposal,
  type SemanticReviewCandidate,
} from "../src/index.js";

const baseListings: readonly DiscoveryCatalogListing[] = [
  {
    listingRef: "polymarket-global:left", venueId: "polymarket-global", venueInstrumentId: "left",
    title: "Left event", description: "Left fixture", status: "OPEN", mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z", rulesText: "Resolves Yes if left happens.",
    outcomes: [
      { venueOutcomeId: "left-yes", label: "Yes", indicativePrice: "0.20" },
      { venueOutcomeId: "left-no", label: "No", indicativePrice: "0.80" },
    ],
    priceScale: "1000000", quantityScale: "1000000", minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION", sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "left" }), protocolIdentity: hashCanonical({ protocol: "left" }),
  },
  {
    listingRef: "polymarket-global:right", venueId: "polymarket-global", venueInstrumentId: "right",
    title: "Right event", description: "Right fixture", status: "OPEN", mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z", rulesText: "Resolves Yes if right happens.",
    outcomes: [
      { venueOutcomeId: "right-yes", label: "Yes", indicativePrice: "0.30" },
      { venueOutcomeId: "right-no", label: "No", indicativePrice: "0.70" },
    ],
    priceScale: "1000000", quantityScale: "1000000", minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION", sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "right" }), protocolIdentity: hashCanonical({ protocol: "right" }),
  },
  {
    listingRef: "polymarket-global:third", venueId: "polymarket-global", venueInstrumentId: "third",
    title: "Third event", description: "Third fixture", status: "OPEN", mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z", rulesText: "Resolves Yes if third happens.",
    outcomes: [
      { venueOutcomeId: "third-yes", label: "Yes", indicativePrice: "0.40" },
      { venueOutcomeId: "third-no", label: "No", indicativePrice: "0.60" },
    ],
    priceScale: "1000000", quantityScale: "1000000", minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION", sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "third" }), protocolIdentity: hashCanonical({ protocol: "third" }),
  },
];

function snapshot(
  listings: readonly DiscoveryCatalogListing[] = baseListings,
): MarketCorpusSnapshot {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ sources: "economic-triage" }),
    eligibleSourceCount: 1,
    excludedSourceCount: 0,
    listings,
  });
}

const captured = snapshot();

function proposal(
  relationKind: MarketRelationKind,
  name: string,
  listingRefs: readonly string[] = baseListings.slice(0, 2).map((item) => item.listingRef),
  proposalSnapshot: MarketCorpusSnapshot = captured,
): MarketRelationProposal {
  const body = {
    relationKind,
    listingRefs,
    statement: `${name} relation`,
    rationale: "Fixture rationale.",
    falsifiers: ["Rules can diverge."],
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  };
  return Object.freeze({
    ...body,
    proposalId: hashCanonical({ corpusSnapshotIdentity: proposalSnapshot.snapshotIdentity, ...body }),
  });
}

function candidate(
  item: MarketRelationProposal,
  priority: 1 | 2 | 3 | 4 | 5,
  withEvidence = true,
  evidenceSnapshot: MarketCorpusSnapshot = captured,
): SemanticReviewCandidate {
  return Object.freeze({
    proposal: item,
    proposalCorpusSnapshotIdentity: evidenceSnapshot.snapshotIdentity,
    evidenceBundle: withEvidence ? buildProposalEvidenceBundle(item, evidenceSnapshot) : null,
    issueIds: Object.freeze([hashCanonical({ issue: item.proposalId })]),
    priority,
  });
}

describe("proposal economic triage", () => {
  it("boosts a positive canonical gross hint by one with exact bigint bounds", () => {
    const source = candidate(proposal("EQUIVALENT", "positive"), 3);
    const triage = buildProposalEconomicTriage({ candidates: [source], corpus: captured });
    expect(triage.items[0]).toMatchObject({
      status: "POSITIVE_GROSS_HINT",
      basePriority: 3,
      priorityBoost: 1,
      effectivePriority: 4,
      currentContractMatchCount: 2,
      settlementPosture: {
        status: "NOT_EXPLICITLY_INELIGIBLE",
        checkedListingCount: 2,
        evidence: [],
      },
      indicativeEconomics: {
        portfolioLabel: "Left true + right false",
        indicativeCostBpsCeil: "9000",
        grossEdgeBpsFloor: "1000",
        feesIncluded: false,
        depthIncluded: false,
        executable: false,
      },
    });
    expect(applyProposalEconomicPriority([source], triage)[0]?.priority).toBe(4);
  });

  it("withholds a positive hint when exact current text explicitly denies settlement", () => {
    const nonSettling = snapshot(baseListings.map((listing, index) => index === 0
      ? {
        ...listing,
        description: "This market is trading only and will never be resolved towards either option.",
      }
      : listing));
    const item = proposal("EQUIVALENT", "never resolves", undefined, nonSettling);
    const source = candidate(item, 3, true, nonSettling);
    const highPriorityResearch = candidate(
      proposal("RELATED", "high priority research", undefined, nonSettling),
      5,
      true,
      nonSettling,
    );
    const triage = buildProposalEconomicTriage({
      candidates: [highPriorityResearch, source],
      corpus: nonSettling,
    });
    expect(triage.items[0]).toMatchObject({
      status: "SETTLEMENT_INELIGIBLE",
      basePriority: 3,
      priorityBoost: 0,
      effectivePriority: 3,
      diagnostic: expect.stringContaining("explicitly denies settlement"),
      settlementPosture: {
        status: "EXPLICITLY_INELIGIBLE",
        policy: "EXPLICIT_NON_SETTLEMENT_TEXT_V1",
        checkedListingCount: 2,
        evidence: [{
          listingRef: "polymarket-global:left",
          signal: "NEVER_RESOLVES",
        }],
      },
      indicativeEconomics: {
        status: "NOT_APPLICABLE",
        grossEdgeBpsFloor: null,
      },
    });
    expect(triage.counts.SETTLEMENT_INELIGIBLE).toBe(1);
    expect(triage.counts.POSITIVE_GROSS_HINT).toBe(0);
    expect(triage.boostedCount).toBe(0);
    expect(triage.items[0]?.status).toBe("SETTLEMENT_INELIGIBLE");
    expect(triage.items[1]).toMatchObject({
      status: "RELATION_UNSUPPORTED",
      basePriority: 5,
      effectivePriority: 5,
    });
    expect(applyProposalEconomicPriority([source], triage)[0]?.priority).toBe(3);

    const changedCurrent = buildProposalEconomicTriage({
      candidates: [source],
      corpus: captured,
    });
    expect(changedCurrent.items[0]).toMatchObject({
      status: "CURRENT_CONTRACT_MISMATCH",
      settlementPosture: { status: "NOT_EVALUATED", checkedListingCount: 0 },
    });
  });

  it("recognizes only explicit non-settlement evidence and does not infer eligibility", () => {
    const fixtures = baseListings.map((listing, index) => ({
      ...listing,
      description: index === 0
        ? "This market will not resolve. No resolution can be triggered in this market."
        : "This market resolves Yes if the named event happens.",
    }));
    expect(explicitSettlementPosture(fixtures)).toEqual({
      status: "EXPLICITLY_INELIGIBLE",
      policy: "EXPLICIT_NON_SETTLEMENT_TEXT_V1",
      checkedListingCount: 3,
      evidence: [
        { listingRef: "polymarket-global:left", signal: "NO_RESOLUTION_TRIGGER" },
        { listingRef: "polymarket-global:left", signal: "WILL_NOT_RESOLVE" },
      ],
    });
    expect(explicitSettlementPosture([fixtures[1]!])).toMatchObject({
      status: "NOT_EXPLICITLY_INELIGIBLE",
      checkedListingCount: 1,
      evidence: [],
    });
    expect(explicitSettlementPosture([{
      ...fixtures[1]!,
      description: "This market will not resolve until official results are published.",
    }])).toMatchObject({
      status: "NOT_EXPLICITLY_INELIGIBLE",
      evidence: [],
    });
  });

  it("caps positive priority at five and never penalizes a non-positive hint", () => {
    const capped = candidate(proposal("EQUIVALENT", "capped"), 5);
    const nonPositiveProposal = proposal("IMPLIES", "non-positive");
    const nonPositive = candidate(nonPositiveProposal, 2);
    const projection = buildProposalEconomicTriage({
      candidates: [capped, nonPositive],
      corpus: captured,
    });
    const cappedItem = projection.items.find((item) => item.proposalId === capped.proposal.proposalId)!;
    const nonPositiveItem = projection.items.find((item) => item.proposalId === nonPositiveProposal.proposalId)!;
    expect(cappedItem).toMatchObject({
      status: "POSITIVE_GROSS_HINT",
      priorityBoost: 0,
      effectivePriority: 5,
    });
    expect(nonPositiveItem).toMatchObject({
      status: "NON_POSITIVE_GROSS_HINT",
      priorityBoost: 0,
      basePriority: 2,
      effectivePriority: 2,
    });
    expect(projection.retentionPolicy).toBe("NO_SUPPRESSION_NO_NEGATIVE_PENALTY");
  });

  it("names missing evidence, changed contracts, unsupported scope, and malformed prices", () => {
    const missing = candidate(proposal("IMPLIES", "missing"), 4, false);
    const staleProposal = proposal("IMPLIES", "stale");
    const stale = candidate(staleProposal, 4);
    const unsupported = candidate(proposal("RELATED", "related"), 4);
    const wide = candidate(proposal(
      "EXHAUSTIVE",
      "wide",
      baseListings.map((listing) => listing.listingRef),
    ), 4);
    const malformedProposal = proposal("IMPLIES", "malformed");
    const malformed = candidate(malformedProposal, 4);
    const current = snapshot(baseListings.map((listing) => {
      if (listing.listingRef === "polymarket-global:left") {
        return { ...listing, rulesText: "Changed resolution semantics." };
      }
      if (listing.listingRef === "polymarket-global:right") {
        return {
          ...listing,
          outcomes: listing.outcomes.map((outcome) => ({ ...outcome, indicativePrice: "bad" })),
        };
      }
      return listing;
    }));
    const projection = buildProposalEconomicTriage({
      candidates: [missing, stale, unsupported, wide],
      corpus: current,
    });
    const byProposal = new Map(projection.items.map((item) => [item.proposalId, item] as const));
    expect(byProposal.get(missing.proposal.proposalId)?.status).toBe("EVIDENCE_UNAVAILABLE");
    expect(byProposal.get(staleProposal.proposalId)?.status).toBe("CURRENT_CONTRACT_MISMATCH");
    expect(byProposal.get(unsupported.proposal.proposalId)?.status).toBe("RELATION_UNSUPPORTED");
    expect(byProposal.get(wide.proposal.proposalId)?.status).toBe("LISTING_SCOPE_UNSUPPORTED");
    expect(projection.items.every((item) => item.priorityBoost === 0)).toBe(true);
    const malformedCurrent = snapshot(baseListings.map((listing) =>
      listing.listingRef === "polymarket-global:right"
        ? {
          ...listing,
          outcomes: listing.outcomes.map((outcome) => ({ ...outcome, indicativePrice: "bad" })),
        }
        : listing,
    ));
    expect(buildProposalEconomicTriage({
      candidates: [malformed],
      corpus: malformedCurrent,
    }).items[0]?.status).toBe("PRICE_UNAVAILABLE");
  });

  it("rejects a rehashed authority escalation", () => {
    const projection = buildProposalEconomicTriage({
      candidates: [candidate(proposal("IMPLIES", "authority"), 3)],
      corpus: captured,
    });
    const tampered = { ...projection, semanticDecisionAuthority: true };
    const { contentHash: _old, ...body } = tampered;
    expect(() => assertProposalEconomicTriageProjection({
      ...tampered,
      contentHash: hashCanonical(body),
    })).toThrow(/contract/);
  });

  it("changes projection identity with current prices and issue lineage", () => {
    const source = candidate(proposal("IMPLIES", "identity"), 3);
    const baseline = buildProposalEconomicTriage({ candidates: [source], corpus: captured });
    const repricedCorpus = snapshot(baseListings.map((listing) =>
      listing.listingRef === "polymarket-global:right"
        ? {
          ...listing,
          outcomes: listing.outcomes.map((outcome) => ({
            ...outcome,
            indicativePrice: outcome.label === "Yes" ? "0.10" : "0.90",
          })),
        }
        : listing,
    ));
    const repriced = buildProposalEconomicTriage({ candidates: [source], corpus: repricedCorpus });
    const relineaged = buildProposalEconomicTriage({
      candidates: [{ ...source, issueIds: [hashCanonical({ issue: "different" })] }],
      corpus: captured,
    });
    expect(repriced.contentHash).not.toBe(baseline.contentHash);
    expect(relineaged.contentHash).not.toBe(baseline.contentHash);
  });

  it("recovers base priority from issue lineage instead of compounding a retained boost", () => {
    expect(recoverBaseReviewPriority({
      issuePriorities: [2, 3],
      retainedJobPriority: 4,
    })).toBe(3);
    expect(recoverBaseReviewPriority({
      issuePriorities: [],
      retainedJobPriority: 4,
    })).toBe(4);
  });
});
