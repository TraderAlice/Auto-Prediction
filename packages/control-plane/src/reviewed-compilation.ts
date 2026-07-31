import {
  assertReviewBindsProposal,
  hashCanonical,
  marketLinkReviewHash,
  proposalHash,
  type Hash,
  type MarketLinkProposal,
  type MarketLinkReview,
} from "@pmh/domain";
import {
  proposeCompleteSetCandidate,
  verifyArbitrageCandidate,
  type ArbitrageCandidate,
  type ArbitrageCertificate,
  type CapitalLimits,
  type VerificationContext,
} from "@pmh/opportunity";
import type { OpportunityHypothesis } from "./types.js";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

export type HypothesisReview = Readonly<{
  schemaVersion: "pmh.hypothesis-review.v1";
  reviewId: string;
  hypothesisHash: Hash;
  decision: "ACCEPT" | "REJECT";
  reviewerAuthority: string;
  reviewedAt: string;
  rationale: string;
  marketLinkProposalHashes: readonly Hash[];
  marketLinkReviewHashes: readonly Hash[];
}>;

export type ReviewedMarketLink = Readonly<{
  proposal: MarketLinkProposal;
  review: MarketLinkReview;
}>;

export type CurrentCompilationState = Readonly<
  Omit<VerificationContext, "claimGraphHash" | "resolutionPartitionHash">
>;

export type ReviewedCompilationArtifact = Readonly<{
  schemaVersion: "pmh.reviewed-compilation.v1";
  artifactHash: Hash;
  hypothesisHash: Hash;
  hypothesisReviewHash: Hash;
  marketLinkProposalHashes: readonly Hash[];
  marketLinkReviewHashes: readonly Hash[];
  candidateHash: Hash;
  certificate: ArbitrageCertificate;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ReviewedCompilationEvidence = Readonly<{
  schemaVersion: "pmh.reviewed-compilation-evidence.v1";
  scope: "SYNTHETIC_ARCHITECTURE_QUALIFICATION";
  status: "PASS";
  artifactHash: Hash;
  compiledArtifactHash: Hash;
  hypothesisId: string;
  hypothesisHash: Hash;
  hypothesisReviewHash: Hash;
  marketLinkProposalHashes: readonly Hash[];
  marketLinkReviewHashes: readonly Hash[];
  candidateHash: Hash;
  certificate: Readonly<{
    id: Hash;
    classification: "CERTIFIED_CONTRACT_ARBITRAGE";
    quantityScale: string;
    worstCaseAfterFees: string;
    capitalRequiredByVenue: Readonly<Record<string, string>>;
    payoffByResolution: Readonly<Record<string, string>>;
    legCount: number;
    resolutionStateCount: number;
  }>;
  stages: readonly Readonly<{
    stage:
      | "DISCOVERY"
      | "INDEPENDENT_REVIEW"
      | "DETERMINISTIC_COMPILATION"
      | "EXACT_VERIFICATION"
      | "EXECUTION_AUTHORITY";
    status: "PASS" | "BLOCKED";
    detail: string;
    evidenceHashes: readonly Hash[];
  }>[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export function hypothesisHash(hypothesis: OpportunityHypothesis): Hash {
  return hashCanonical(hypothesis);
}

export function hypothesisReviewHash(review: HypothesisReview): Hash {
  return hashCanonical(review);
}

function sortedUnique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort();
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = sortedUnique(left);
  const normalizedRight = sortedUnique(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((item, index) => item === normalizedRight[index])
  );
}

function assertHypothesisReview(
  hypothesis: OpportunityHypothesis,
  review: HypothesisReview,
): void {
  if (
    hypothesis.authority !== "PROPOSE_ONLY" ||
    hypothesis.reviewStatus !== "UNREVIEWED"
  ) {
    throw new Error("compilation source must remain a proposal-only hypothesis");
  }
  if (
    review.schemaVersion !== "pmh.hypothesis-review.v1" ||
    review.reviewId.trim() === "" ||
    review.reviewerAuthority.trim() === "" ||
    review.rationale.trim() === "" ||
    Number.isNaN(Date.parse(review.reviewedAt)) ||
    !HASH_PATTERN.test(review.hypothesisHash) ||
    review.marketLinkProposalHashes.length === 0 ||
    review.marketLinkReviewHashes.length === 0 ||
    review.marketLinkProposalHashes.some((item) => !HASH_PATTERN.test(item)) ||
    review.marketLinkReviewHashes.some((item) => !HASH_PATTERN.test(item)) ||
    new Set(review.marketLinkProposalHashes).size !==
      review.marketLinkProposalHashes.length ||
    new Set(review.marketLinkReviewHashes).size !==
      review.marketLinkReviewHashes.length
  ) {
    throw new Error("hypothesis review is malformed");
  }
  if (review.hypothesisHash !== hypothesisHash(hypothesis)) {
    throw new Error("hypothesis review does not bind the supplied hypothesis");
  }
  if (review.reviewerAuthority === hypothesis.workerId) {
    throw new Error("hypothesis review must be independent of its worker");
  }
  if (review.decision !== "ACCEPT") {
    throw new Error("rejected hypothesis cannot enter candidate compilation");
  }
}

function assertConnectedListingGraph(
  listingIds: readonly string[],
  links: readonly ReviewedMarketLink[],
): void {
  const expected = sortedUnique(listingIds);
  const linked = sortedUnique(
    links.flatMap(({ proposal }) => [
      proposal.leftListingId,
      proposal.rightListingId,
    ]),
  );
  if (!sameSet(expected, linked)) {
    throw new Error("reviewed link graph does not exactly cover candidate listings");
  }
  const adjacency = new Map<string, Set<string>>();
  for (const listingId of expected) adjacency.set(listingId, new Set());
  for (const { proposal } of links) {
    adjacency.get(proposal.leftListingId)?.add(proposal.rightListingId);
    adjacency.get(proposal.rightListingId)?.add(proposal.leftListingId);
  }
  const first = expected[0];
  if (first === undefined) throw new Error("candidate listing graph is empty");
  const visited = new Set([first]);
  const queue = [first];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  if (visited.size !== expected.length) {
    throw new Error("reviewed link graph is disconnected");
  }
}

function recordStrings(
  values: Readonly<Record<string, bigint>>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(values)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, value.toString()]),
    ),
  );
}

export function compileReviewedHypothesis(input: {
  hypothesis: OpportunityHypothesis;
  hypothesisReview: HypothesisReview;
  marketLinks: readonly ReviewedMarketLink[];
  candidateTemplate: ArbitrageCandidate;
  capitalLimits: CapitalLimits;
  currentState: CurrentCompilationState;
}): ReviewedCompilationArtifact {
  assertHypothesisReview(input.hypothesis, input.hypothesisReview);
  if (
    input.hypothesis.strategyKind !== "SAME_CLAIM_CROSS_VENUE" ||
    input.candidateTemplate.classification !==
      "CERTIFIED_CONTRACT_ARBITRAGE"
  ) {
    throw new Error("reviewed pipeline currently qualifies exact cross-venue sets only");
  }
  if (input.marketLinks.length === 0) {
    throw new Error("candidate compilation requires reviewed market links");
  }

  const proposalHashes: Hash[] = [];
  const reviewHashes: Hash[] = [];
  const reviewedRuleHashByListingId = new Map<string, Hash>();
  const bindReviewedRule = (listingId: string, ruleIdentity: string): void => {
    if (!HASH_PATTERN.test(ruleIdentity)) {
      throw new Error(`reviewed link has an invalid rule identity for ${listingId}`);
    }
    const ruleHash = ruleIdentity as Hash;
    const existing = reviewedRuleHashByListingId.get(listingId);
    if (existing !== undefined && existing !== ruleHash) {
      throw new Error(`reviewed links conflict on rule identity for ${listingId}`);
    }
    reviewedRuleHashByListingId.set(listingId, ruleHash);
  };
  for (const link of input.marketLinks) {
    assertReviewBindsProposal(link.proposal, link.review);
    if (link.review.decision !== "ACCEPT" || link.review.grade !== "EXACT") {
      throw new Error("certified arbitrage requires accepted exact market links");
    }
    proposalHashes.push(proposalHash(link.proposal));
    reviewHashes.push(marketLinkReviewHash(link.review));
    bindReviewedRule(link.proposal.leftListingId, link.proposal.leftRuleHash);
    bindReviewedRule(link.proposal.rightListingId, link.proposal.rightRuleHash);
    if (
      !sameSet(
        Object.keys(link.proposal.proposedOutcomeMapping),
        input.candidateTemplate.resolutionStateIds,
      ) ||
      !sameSet(
        Object.values(link.proposal.proposedOutcomeMapping),
        input.candidateTemplate.resolutionStateIds,
      )
    ) {
      throw new Error("reviewed outcome mapping does not cover the exact partition");
    }
  }
  if (
    new Set(proposalHashes).size !== proposalHashes.length ||
    new Set(reviewHashes).size !== reviewHashes.length
  ) {
    throw new Error("reviewed market-link evidence contains duplicates");
  }
  if (
    !sameSet(
      input.hypothesisReview.marketLinkProposalHashes,
      proposalHashes,
    ) ||
    !sameSet(input.hypothesisReview.marketLinkReviewHashes, reviewHashes)
  ) {
    throw new Error("hypothesis review does not bind the exact market-link set");
  }

  const candidateListingIds = input.candidateTemplate.legs.map(
    (leg) => leg.listingId,
  );
  if (
    new Set(candidateListingIds).size !== candidateListingIds.length ||
    new Set(input.candidateTemplate.legs.map((leg) => leg.id)).size !==
      input.candidateTemplate.legs.length
  ) {
    throw new Error("candidate leg and listing identities must be unique");
  }
  assertConnectedListingGraph(candidateListingIds, input.marketLinks);
  const proposedVenueIds = new Set(input.hypothesis.venueIds);
  if (
    input.candidateTemplate.legs.some(
      (leg) => !proposedVenueIds.has(leg.venueId),
    )
  ) {
    throw new Error("candidate contains a venue outside the reviewed hypothesis");
  }
  if (
    input.candidateTemplate.legs.some(
      (leg) =>
        reviewedRuleHashByListingId.get(leg.listingId) !==
        leg.listingRuleHash,
    )
  ) {
    throw new Error("candidate rule identity differs from the reviewed link graph");
  }

  const linkBindings = input.marketLinks
    .map((link) => ({
      proposalHash: proposalHash(link.proposal),
      reviewHash: marketLinkReviewHash(link.review),
      outcomeMapping: link.proposal.proposedOutcomeMapping,
    }))
    .sort((left, right) => left.proposalHash.localeCompare(right.proposalHash));
  const boundHypothesisHash = hypothesisHash(input.hypothesis);
  const claimGraphHash = hashCanonical({
    schemaVersion: "pmh.claim-graph.v1",
    hypothesisHash: boundHypothesisHash,
    links: linkBindings.map(({ proposalHash: linkProposalHash, reviewHash }) => ({
      proposalHash: linkProposalHash,
      reviewHash,
    })),
  });
  const resolutionPartitionHash = hashCanonical({
    schemaVersion: "pmh.resolution-partition.v1",
    stateIds: sortedUnique(input.candidateTemplate.resolutionStateIds),
    mappings: linkBindings.map(({ proposalHash: linkProposalHash, outcomeMapping }) => ({
      proposalHash: linkProposalHash,
      outcomeMapping,
    })),
  });
  const candidate = proposeCompleteSetCandidate(
    {
      ...input.candidateTemplate,
      claimGraphHash,
      resolutionPartitionHash,
    },
    input.capitalLimits,
  );
  const certificate = verifyArbitrageCandidate(candidate, {
    ...input.currentState,
    claimGraphHash,
    resolutionPartitionHash,
  });
  const body = {
    schemaVersion: "pmh.reviewed-compilation.v1" as const,
    hypothesisHash: boundHypothesisHash,
    hypothesisReviewHash: hypothesisReviewHash(input.hypothesisReview),
    marketLinkProposalHashes: sortedUnique(proposalHashes),
    marketLinkReviewHashes: sortedUnique(reviewHashes),
    candidateHash: hashCanonical(candidate),
    certificate,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ artifactHash: hashCanonical(body), ...body });
}

const FIXED_SCALE = 100_000_000n;

function fixtureIdentity(label: string): Hash {
  return hashCanonical({ fixture: "reviewed-compilation", label });
}

export function buildReviewedCompilationFixture(): Readonly<{
  hypothesis: OpportunityHypothesis;
  hypothesisReview: HypothesisReview;
  marketLinks: readonly ReviewedMarketLink[];
  candidateTemplate: ArbitrageCandidate;
  capitalLimits: CapitalLimits;
  currentState: CurrentCompilationState;
  artifact: ReviewedCompilationArtifact;
}> {
  const hypothesis: OpportunityHypothesis = Object.freeze({
    hypothesisId: "hypothesis:synthetic-binary-pair",
    workerId: "fixture-scout",
    thesis:
      "Synthetic fixture listings may express complementary outcomes of one binary claim.",
    strategyKind: "SAME_CLAIM_CROSS_VENUE",
    venueIds: Object.freeze(["fixture-alpha", "fixture-beta"]),
    claimSearchTerms: Object.freeze(["synthetic", "binary", "qualification"]),
    confidenceBps: 5_000,
    authority: "PROPOSE_ONLY",
    reviewStatus: "UNREVIEWED",
  });
  const leftRuleHash = fixtureIdentity("rule:alpha");
  const rightRuleHash = fixtureIdentity("rule:beta");
  const proposal: MarketLinkProposal = Object.freeze({
    id: "link:synthetic-alpha-beta",
    grade: "UNREVIEWED",
    leftListingId: "listing:fixture-alpha:yes",
    rightListingId: "listing:fixture-beta:no",
    leftRuleHash,
    rightRuleHash,
    proposedOutcomeMapping: Object.freeze({ no: "no", yes: "yes" }),
    differenceSummary: Object.freeze([
      "Synthetic architecture-qualification fixture; not venue evidence.",
    ]),
    proposedAt: "2026-07-31T00:00:00.000Z",
    proposerIdentity: hypothesis.workerId,
  });
  const linkReview: MarketLinkReview = Object.freeze({
    id: "review:synthetic-alpha-beta",
    proposalHash: proposalHash(proposal),
    decision: "ACCEPT",
    grade: "EXACT",
    reviewerAuthority: "fixture-equivalence-reviewer",
    reviewedAt: "2026-07-31T00:01:00.000Z",
    leftRuleHash,
    rightRuleHash,
    outcomeMappingHash: hashCanonical(proposal.proposedOutcomeMapping),
    timingAssessment: "Synthetic close and observation windows are identical.",
    voidAssessment: "Synthetic exceptional-state treatment is identical.",
    resolutionSourceAssessment: "Synthetic source identity is identical.",
    rationale:
      "Accepted only to qualify the review-to-verifier software boundary.",
  });
  const marketLinks = Object.freeze([{ proposal, review: linkReview }]);
  const hypothesisReview: HypothesisReview = Object.freeze({
    schemaVersion: "pmh.hypothesis-review.v1",
    reviewId: "hypothesis-review:synthetic-binary-pair",
    hypothesisHash: hypothesisHash(hypothesis),
    decision: "ACCEPT",
    reviewerAuthority: "fixture-qualification-desk",
    reviewedAt: "2026-07-31T00:02:00.000Z",
    rationale:
      "The exact link review permits deterministic fixture compilation only.",
    marketLinkProposalHashes: Object.freeze([proposalHash(proposal)]),
    marketLinkReviewHashes: Object.freeze([marketLinkReviewHash(linkReview)]),
  });
  const listings = [
    {
      id: "listing:fixture-alpha:yes",
      venueId: "fixture-alpha",
      price: 40_000_000n,
      winningState: "yes",
      ruleHash: leftRuleHash,
    },
    {
      id: "listing:fixture-beta:no",
      venueId: "fixture-beta",
      price: 50_000_000n,
      winningState: "no",
      ruleHash: rightRuleHash,
    },
  ] as const;
  const candidateTemplate: ArbitrageCandidate = Object.freeze({
    classification: "CERTIFIED_CONTRACT_ARBITRAGE",
    claimGraphHash: fixtureIdentity("placeholder:claim-graph"),
    resolutionPartitionHash: fixtureIdentity("placeholder:partition"),
    resolutionStateIds: Object.freeze(["yes", "no"]),
    legs: Object.freeze(
      listings.map((listing, index) => ({
        id: `leg:fixture:${index}`,
        venueId: listing.venueId,
        listingId: listing.id,
        action: "BUY" as const,
        quantity: FIXED_SCALE,
        maxQuantity: 2n * FIXED_SCALE,
        quantityScale: FIXED_SCALE,
        quantityTick: FIXED_SCALE,
        unitPrice: listing.price,
        priceTick: 1_000_000n,
        fee: { flat: 0n, rate: 0n, rateScale: FIXED_SCALE },
        payoutPerUnitByResolution: Object.freeze({
          yes: listing.winningState === "yes" ? FIXED_SCALE : 0n,
          no: listing.winningState === "no" ? FIXED_SCALE : 0n,
        }),
        listingRuleHash: listing.ruleHash,
        feeScheduleHash: fixtureIdentity(`fee:${listing.id}`),
        bookGenerationHash: fixtureIdentity(`generation:${listing.id}`),
        bookStateHash: fixtureIdentity(`state:${listing.id}`),
      })),
    ),
    venueAssumptions: Object.freeze([]),
    expiresAtEpochMs: 2_000n,
  });
  const currentState: CurrentCompilationState = Object.freeze({
    nowEpochMs: 1_000n,
    listingRuleHashById: new Map(
      candidateTemplate.legs.map((leg) => [leg.listingId, leg.listingRuleHash]),
    ),
    feeScheduleHashByListingId: new Map(
      candidateTemplate.legs.map((leg) => [
        leg.listingId,
        leg.feeScheduleHash,
      ]),
    ),
    bookGenerationHashByListingId: new Map(
      candidateTemplate.legs.map((leg) => [
        leg.listingId,
        leg.bookGenerationHash,
      ]),
    ),
    bookStateHashByListingId: new Map(
      candidateTemplate.legs.map((leg) => [leg.listingId, leg.bookStateHash]),
    ),
  });
  const capitalLimits: CapitalLimits = new Map([
    ["fixture-alpha", 80_000_000n],
    ["fixture-beta", 100_000_000n],
  ]);
  const artifact = compileReviewedHypothesis({
    hypothesis,
    hypothesisReview,
    marketLinks,
    candidateTemplate,
    capitalLimits,
    currentState,
  });
  return Object.freeze({
    hypothesis,
    hypothesisReview,
    marketLinks,
    candidateTemplate,
    capitalLimits,
    currentState,
    artifact,
  });
}

export function buildReviewedCompilationEvidence(): ReviewedCompilationEvidence {
  const fixture = buildReviewedCompilationFixture();
  const { artifact } = fixture;
  const quantityScale = artifact.certificate.legs[0]?.quantityScale;
  if (quantityScale === undefined) {
    throw new Error("reviewed compilation certificate has no quantity scale");
  }
  const body = {
    schemaVersion: "pmh.reviewed-compilation-evidence.v1" as const,
    scope: "SYNTHETIC_ARCHITECTURE_QUALIFICATION" as const,
    status: "PASS" as const,
    compiledArtifactHash: artifact.artifactHash,
    hypothesisId: fixture.hypothesis.hypothesisId,
    hypothesisHash: artifact.hypothesisHash,
    hypothesisReviewHash: artifact.hypothesisReviewHash,
    marketLinkProposalHashes: artifact.marketLinkProposalHashes,
    marketLinkReviewHashes: artifact.marketLinkReviewHashes,
    candidateHash: artifact.candidateHash,
    certificate: {
      id: artifact.certificate.id,
      classification: "CERTIFIED_CONTRACT_ARBITRAGE" as const,
      quantityScale: quantityScale.toString(),
      worstCaseAfterFees: artifact.certificate.worstCaseAfterFees.toString(),
      capitalRequiredByVenue: recordStrings(
        artifact.certificate.capitalRequiredByVenue,
      ),
      payoffByResolution: recordStrings(
        artifact.certificate.payoffByResolution,
      ),
      legCount: artifact.certificate.legs.length,
      resolutionStateCount: Object.keys(
        artifact.certificate.payoffByResolution,
      ).length,
    },
    stages: Object.freeze([
      {
        stage: "DISCOVERY" as const,
        status: "PASS" as const,
        detail: "proposal-only hypothesis bound",
        evidenceHashes: Object.freeze([artifact.hypothesisHash]),
      },
      {
        stage: "INDEPENDENT_REVIEW" as const,
        status: "PASS" as const,
        detail: "hypothesis + exact market link accepted",
        evidenceHashes: Object.freeze([
          artifact.hypothesisReviewHash,
          ...artifact.marketLinkProposalHashes,
          ...artifact.marketLinkReviewHashes,
        ]),
      },
      {
        stage: "DETERMINISTIC_COMPILATION" as const,
        status: "PASS" as const,
        detail: `${artifact.certificate.legs.length} capital-bounded legs`,
        evidenceHashes: Object.freeze([artifact.candidateHash]),
      },
      {
        stage: "EXACT_VERIFICATION" as const,
        status: "PASS" as const,
        detail: `${Object.keys(artifact.certificate.payoffByResolution).length} canonical states`,
        evidenceHashes: Object.freeze([artifact.certificate.id]),
      },
      {
        stage: "EXECUTION_AUTHORITY" as const,
        status: "BLOCKED" as const,
        detail: "fixture certificate · shadow only",
        evidenceHashes: Object.freeze([artifact.artifactHash]),
      },
    ]),
    effects: artifact.effects,
  };
  return Object.freeze({ artifactHash: hashCanonical(body), ...body });
}
