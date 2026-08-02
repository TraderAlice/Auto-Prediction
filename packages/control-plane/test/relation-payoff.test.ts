import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertResearchRelationPayoff,
  buildSemanticConstraintArtifact,
  buildRelationPayoffProjection,
  compileResearchRelationPayoff,
  evaluateSemanticPriceInequality,
  type MarketRelationKind,
  type MarketRelationProposal,
  type ResearchSemanticDecision,
  type SemanticReviewRecord,
} from "../src/index.js";

function fixture(relationKind: MarketRelationKind): {
  opportunityId: string;
  proposal: MarketRelationProposal;
  review: SemanticReviewRecord;
  decision: ResearchSemanticDecision;
} {
  const proposalBody = {
    relationKind,
    listingRefs: ["venue-a:left", "venue-b:right"],
    statement: `${relationKind} relation`,
    rationale: "Research fixture.",
    falsifiers: ["A forbidden truth assignment."],
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  };
  const proposal = Object.freeze({
    ...proposalBody,
    proposalId: hashCanonical(proposalBody),
  });
  const opportunityId = `ai:${proposal.proposalId}`;
  const corpus = hashCanonical({ corpus: "relation-payoff" });
  const listingEvidence = proposal.listingRefs.map((listingRef) => ({
    listingRef,
    listingHash: hashCanonical({ listingRef }),
    sourceRawHash: hashCanonical({ source: listingRef }),
    protocolIdentity: `protocol:${listingRef}`,
    venueId: listingRef.split(":", 1)[0]!,
    venueInstrumentId: listingRef.split(":", 2)[1]!,
    outcomes: [
      { venueOutcomeId: `${listingRef}:yes`, label: "Yes" },
      { venueOutcomeId: `${listingRef}:no`, label: "No" },
    ],
    priceScale: "1000",
    quantityScale: "1000",
    minPriceTick: "1",
  }));
  const stateAllowed = (left: boolean, right: boolean): boolean => {
    switch (relationKind) {
      case "EQUIVALENT": return left === right;
      case "IMPLIES":
      case "SUBSET": return !left || right;
      case "MUTUALLY_EXCLUSIVE": return !left || !right;
      case "EXHAUSTIVE": return left || right;
      default: return true;
    }
  };
  const hard = [
    "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
  ].includes(relationKind);
  const semanticConstraint = buildSemanticConstraintArtifact({
    proposal,
    proposalCorpusSnapshotIdentity: corpus,
    evidenceCorpusSnapshotIdentity: corpus,
    listingEvidence,
    draft: {
      classification: hard ? "HARD_SETTLEMENT_CONSTRAINT" : "PROBABILISTIC_DEPENDENCE",
      relationKind,
      assumptions: [],
      counterexampleAttempt: {
        attempted: true,
        result: hard ? "NOT_FOUND" : "INCONCLUSIVE",
        narrative: hard
          ? "Tried a forbidden joint state against both rule texts and it cannot settle."
          : "No exact settlement exclusion follows from topical relatedness.",
        truths: [true, true],
      },
      truthTable: [
        [false, false], [false, true], [true, false], [true, true],
      ].map(([left, right]) => ({
        truths: [left!, right!],
        disposition: stateAllowed(left!, right!) ? "FEASIBLE" as const : "IMPOSSIBLE" as const,
        rationale: "Explicit fixture state classification.",
        evidenceListingRefs: proposal.listingRefs,
      })),
      unresolvedEvidence: hard ? [] : ["No hard constraint is stated by the rules."],
    },
  });
  const reportBody = {
    schemaVersion: "pmh.semantic-review-report.v2" as const,
    status: "PASS" as const,
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:01.000Z",
    engine: {
      transport: "VERCEL_AI_SDK" as const,
      provider: "deepseek" as const,
      model: "deepseek-v4-flash",
      role: "ADVERSARIAL_SEMANTIC_REVIEWER" as const,
      independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER" as const,
    },
    input: {
      opportunityId,
      proposalId: proposal.proposalId,
      proposalCorpusSnapshotIdentity: corpus,
      corpusSnapshotIdentity: corpus,
      evidencePosture: "ORIGINAL_CORPUS" as const,
      relationKind,
      statement: proposal.statement,
      listingEvidence,
    },
    result: {
      recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
      relationConclusion: relationKind,
      assessments: {
        outcomeMapping: "Binary truth outcomes are bound for research.",
        timingAndClose: "Timing is scoped.",
        voidAndCancellation: "Exceptional states are excluded from this hypothesis.",
        resolutionSources: "Sources are independently identified.",
      },
      counterexamples: [],
      missingEvidence: [],
      rationale: "Scoped for non-authoritative research simulation.",
      semanticConstraint,
      authority: "ADVISORY_ONLY" as const,
      productionReviewAuthority: false as const,
      simulationAuthority: false as const,
      executionAuthority: false as const,
    },
    trace: {
      protocol: "AI_SDK_TOOL_LOOP" as const,
      maximumSteps: 12 as const,
      counterexampleEffectCount: 1,
      submittedEffectHash: hashCanonical({ fixture: relationKind }),
      wholeResponseSchemaParsing: false as const,
    },
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const report = Object.freeze({
    ...reportBody,
    artifactHash: hashCanonical(reportBody),
  });
  const reviewIdentity = {
    schemaVersion: "pmh.semantic-review-run.v1",
    opportunityId,
    proposalId: proposal.proposalId,
    proposalCorpusSnapshotIdentity: corpus,
    corpusSnapshotIdentity: corpus,
    model: "deepseek-v4-flash",
  };
  const review: SemanticReviewRecord = Object.freeze({
    reviewId: hashCanonical(reviewIdentity),
    opportunityId,
    proposalId: proposal.proposalId,
    proposalCorpusSnapshotIdentity: corpus,
    corpusSnapshotIdentity: corpus,
    model: "deepseek-v4-flash",
    status: "PASS",
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    diagnostic: null,
    report,
  });
  const decisionBody = {
    schemaVersion: "pmh.research-semantic-decision.v1" as const,
    opportunityId,
    semanticReviewArtifactHash: report.artifactHash,
    reviewRecommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
    decision: "ACCEPT_FOR_SIMULATION" as const,
    rationale: "Accept the bounded relation for research simulation only.",
    decidedAt: "2026-08-01T00:00:02.000Z",
    authority: "LOCAL_OPERATOR_RESEARCH_ONLY" as const,
    productionReviewAuthority: false as const,
    productionPromotionEligible: false as const,
    executionAuthority: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const decision = Object.freeze({
    ...decisionBody,
    decisionId: hashCanonical(decisionBody),
  });
  return { opportunityId, proposal, review, decision };
}

describe("research relation payoff compiler", () => {
  it.each([
    ["EQUIVALENT", 2, 2],
    ["IMPLIES", 3, 1],
    ["SUBSET", 3, 1],
    ["MUTUALLY_EXCLUSIVE", 3, 1],
    ["EXHAUSTIVE", 3, 1],
  ] as const)("compiles %s into exact truth states and conservative buy portfolios", (kind, states, portfolios) => {
    const artifact = compileResearchRelationPayoff(fixture(kind));
    expect(artifact).toMatchObject({
      status: "SIMULATION_TEMPLATE_READY",
      relationKind: kind,
      verifierEligible: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(artifact.canonicalStates).toHaveLength(states);
    expect(artifact.portfolios).toHaveLength(portfolios);
    expect(artifact.schemaVersion).toBe("pmh.research-relation-payoff.v2");
    expect(artifact.portfolios.every((item) => BigInt(item.minimumPayoutUnits) >= 1n)).toBe(true);
    expect(artifact.portfolios.every((item) =>
      Object.values(item.payoutUnitsByState).every((value) => typeof value === "string")
    )).toBe(true);
    expect(() => assertResearchRelationPayoff(artifact)).not.toThrow();
  });

  it("blocks semantic relationships that do not define a payoff partition", () => {
    const related = compileResearchRelationPayoff(fixture("RELATED"));
    expect(related).toMatchObject({
      status: "BLOCKED",
      relationKind: "RELATED",
      canonicalStates: [],
      portfolios: [],
    });
    expect(related.diagnostic).toContain("cannot enter the exact payoff compiler");
    const projection = buildRelationPayoffProjection([fixture("RELATED"), fixture("IMPLIES")]);
    expect(projection).toMatchObject({
      qualificationCount: 2,
      readyCount: 1,
      blockedCount: 1,
      verifierEligible: false,
      certificateAuthority: false,
    });
  });

  it("rejects stale decisions and rehashed authority escalation", () => {
    const input = fixture("IMPLIES");
    const { decisionId: _decisionId, ...decisionBody } = input.decision;
    const staleDecisionBody = {
      ...decisionBody,
      semanticReviewArtifactHash: hashCanonical({ stale: true }),
    };
    expect(() =>
      compileResearchRelationPayoff({
        ...input,
        decision: {
          ...staleDecisionBody,
          decisionId: hashCanonical(staleDecisionBody),
        },
      }),
    ).toThrow(/stale|accepted/);

    const artifact = compileResearchRelationPayoff(input);
    const tampered = { ...artifact, certificateAuthority: true };
    const { artifactHash: _old, ...body } = tampered;
    expect(() =>
      assertResearchRelationPayoff({ ...tampered, artifactHash: hashCanonical(body) }),
    ).toThrow(/contract/);
  });

  it("qualifies a state-derived price violation with bigint fees and depth", () => {
    const qualification = compileResearchRelationPayoff(
      fixture("MUTUALLY_EXCLUSIVE"),
    );
    const portfolio = qualification.portfolios.find((candidate) =>
      candidate.legs.every((leg) => leg.outcome === "FALSE")
    );
    if (portfolio === undefined) throw new Error("missing mutual-exclusion complement portfolio");
    const quotes = portfolio.legs.map((leg) => ({
      listingRef: leg.listingRef,
      outcome: leg.outcome,
      askPriceUnits: leg.legId === "left" ? "300" : "400",
      feeUnitsPerContract: "10",
      priceScale: "1000",
      availableQuantityUnits: "5000",
      requiredQuantityUnits: "1000",
      quantityScale: "1000",
    }));
    const positive = evaluateSemanticPriceInequality({
      qualification,
      portfolioId: portfolio.portfolioId,
      quotes,
    });
    expect(positive).toMatchObject({
      status: "POSITIVE_GROSS_FLOOR",
      totalAskAndFeeUnits: "720",
      guaranteedPayoutUnits: "1000",
      grossEdgeUnits: "280",
      arithmetic: "BIGINT_RATIONAL_FIXED_POINT",
      feesIncluded: true,
      depthIncluded: true,
      certificateAuthority: false,
      executionAuthority: false,
    });

    const feeBlocked = evaluateSemanticPriceInequality({
      qualification,
      portfolioId: portfolio.portfolioId,
      quotes: quotes.map((quote) => ({ ...quote, feeUnitsPerContract: "200" })),
    });
    expect(feeBlocked.status).toBe("NO_GROSS_EDGE");

    const depthBlocked = evaluateSemanticPriceInequality({
      qualification,
      portfolioId: portfolio.portfolioId,
      quotes: quotes.map((quote, index) =>
        index === 0 ? { ...quote, availableQuantityUnits: "999" } : quote
      ),
    });
    expect(depthBlocked.status).toBe("DEPTH_INSUFFICIENT");
  });
});
