import { hashCanonical, parseFixed, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  compileProbabilisticSemanticArbitrage,
  type ProbabilisticPortfolioQuote,
  type ProbabilisticSemanticArbitrageEvaluation,
  type ProbabilisticSemanticBoundArtifact,
} from "./probabilistic-semantic-arbitrage.js";
import type { ProbabilityEstimationJobRecord } from "./probability-estimation-scheduler.js";
import type { DiscoveryCatalogListing } from "./types.js";

const PPM = 1_000_000n;
const BPS = 10_000n;

export type FailureBudgetFactor = Readonly<{
  factorId: Hash;
  label: string;
  source: "ASSUMPTION" | "COUNTER_SCENARIO";
}>;

export type FailureBudgetFrontierItem = Readonly<{
  itemId: Hash;
  proposalId: Hash;
  listingRefs: readonly string[];
  status:
    | "BOUNDED_ARBITRAGE_CANDIDATE"
    | "RESEARCH_MARGIN"
    | "BUDGET_EXHAUSTED"
    | "AWAITING_ESTIMATES"
    | "PRICE_UNAVAILABLE";
  portfolioLabel: string | null;
  breakEvenEpsilonPpm: string | null;
  adverseProbabilityUpperPpm: string | null;
  remainingFailureBudgetPpm: string | null;
  budgetUtilizationBps: string | null;
  expectedEdgeFloorUnits: string | null;
  adverseTailLossUnits: string | null;
  commonPriceScale: string | null;
  calibrationStatus: "UNCALIBRATED" | "CALIBRATED" | "PENDING";
  blockers: readonly string[];
  failureFactors: readonly FailureBudgetFactor[];
  estimatorJobCount: number;
  evaluationArtifactHash: Hash | null;
  authority: "FAILURE_BUDGET_RANKING_ONLY";
  guaranteedProfit: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type FailureBudgetFrontier = Readonly<{
  schemaVersion: "pmh.failure-budget-frontier.v1";
  contentHash: Hash;
  evaluatedAt: string;
  itemCount: number;
  positiveMarginCount: number;
  boundedCandidateCount: number;
  awaitingEstimateCount: number;
  items: readonly FailureBudgetFrontierItem[];
  rankingContract: "REMAINING_FAILURE_BUDGET_DESC_THEN_EDGE_DESC";
  quotePosture: "INDICATIVE_ZERO_FEE_ZERO_DEPTH_ONLY";
  authority: "FAILURE_BUDGET_RANKING_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    providerRequests: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function outcomePrice(
  listing: DiscoveryCatalogListing,
  side: "TRUE" | "FALSE",
): Readonly<{ units: string; scale: string }> | null {
  const labels = side === "TRUE" ? ["yes", "up"] : ["no", "down"];
  const outcome = listing.outcomes.find((candidate) =>
    labels.includes(candidate.label.trim().toLowerCase())
  );
  if (outcome?.indicativePrice === null || outcome?.indicativePrice === undefined) {
    return null;
  }
  try {
    const scale = BigInt(listing.priceScale);
    const units = parseFixed(outcome.indicativePrice, scale);
    return scale > 0n && units >= 0n && units <= scale
      ? Object.freeze({ units: units.toString(), scale: scale.toString() })
      : null;
  } catch {
    return null;
  }
}

function portfolioCandidates(input: Readonly<{
  bound: ProbabilisticSemanticBoundArtifact;
  listings: ReadonlyMap<string, DiscoveryCatalogListing>;
  evaluatedAt: string;
}>): readonly ProbabilisticSemanticArbitrageEvaluation[] {
  const count = input.bound.listingRefs.length;
  return Object.freeze(Array.from({ length: 2 ** count }, (_, mask) => {
    const quotes = input.bound.listingRefs.flatMap((listingRef, index) => {
      const listing = input.listings.get(listingRef);
      const outcome = (mask & (1 << (count - index - 1))) === 0
        ? "FALSE" as const
        : "TRUE" as const;
      const price = listing === undefined ? null : outcomePrice(listing, outcome);
      return listing === undefined || price === null
        ? []
        : [Object.freeze({
            listingRef,
            outcome,
            askPriceUnits: price.units,
            feeUnitsPerContract: "0",
            priceScale: price.scale,
            availableQuantityUnits: "0",
            requiredQuantityUnits: listing.quantityScale,
            quantityScale: listing.quantityScale,
            observedAt: listing.sourceReceivedAt,
            evidenceHash: listing.sourceRawHash as Hash,
          }) satisfies ProbabilisticPortfolioQuote];
    });
    if (quotes.length !== count) return null;
    return compileProbabilisticSemanticArbitrage({
      bound: input.bound,
      quotes,
      evaluatedAt: input.evaluatedAt,
      riskPolicy: Object.freeze({
        maxQuoteAgeMs: 86_400_000,
        maxTailLossPpm: "4000000",
        concentrationPpm: "0",
        maxConcentrationPpm: "1000000",
      }),
    });
  }).filter((item): item is ProbabilisticSemanticArbitrageEvaluation => item !== null));
}

function signedMargin(evaluation: ProbabilisticSemanticArbitrageEvaluation): bigint {
  return BigInt(evaluation.breakEvenEpsilonPpm) -
    BigInt(evaluation.adverseProbabilityUpperPpm);
}

function selectPortfolio(
  evaluations: readonly ProbabilisticSemanticArbitrageEvaluation[],
): ProbabilisticSemanticArbitrageEvaluation | null {
  return [...evaluations].sort((left, right) => {
    const margin = signedMargin(right) - signedMargin(left);
    if (margin !== 0n) return margin > 0n ? 1 : -1;
    const edge = BigInt(right.expectedEdgeFloorUnits) -
      BigInt(left.expectedEdgeFloorUnits);
    return edge === 0n
      ? left.artifactHash.localeCompare(right.artifactHash)
      : edge > 0n ? 1 : -1;
  })[0] ?? null;
}

function factors(bound: ProbabilisticSemanticBoundArtifact): readonly FailureBudgetFactor[] {
  const inputs = [
    ...bound.semanticConstraint.assumptions.map((label) => ({
      label,
      source: "ASSUMPTION" as const,
    })),
    ...bound.counterScenarios.map((label) => ({
      label,
      source: "COUNTER_SCENARIO" as const,
    })),
  ];
  return Object.freeze([...new Map(inputs.map((item) => {
    const normalized = item.label.trim();
    const factorId = hashCanonical({ source: item.source, label: normalized });
    return [factorId, Object.freeze({ factorId, label: normalized, source: item.source })] as const;
  })).values()].slice(0, 12));
}

function evaluatedItem(input: Readonly<{
  bound: ProbabilisticSemanticBoundArtifact;
  evaluation: ProbabilisticSemanticArbitrageEvaluation | null;
  estimatorJobCount: number;
}>): FailureBudgetFrontierItem {
  const evaluation = input.evaluation;
  if (evaluation === null) {
    const body = Object.freeze({
      proposalId: input.bound.proposalId,
      listingRefs: input.bound.listingRefs,
      status: "PRICE_UNAVAILABLE" as const,
      portfolioLabel: null,
      breakEvenEpsilonPpm: null,
      adverseProbabilityUpperPpm: input.bound.epsilonPpm,
      remainingFailureBudgetPpm: null,
      budgetUtilizationBps: null,
      expectedEdgeFloorUnits: null,
      adverseTailLossUnits: null,
      commonPriceScale: null,
      calibrationStatus: input.bound.calibration.status,
      blockers: Object.freeze(["INDICATIVE_BINARY_QUOTES_UNAVAILABLE"]),
      failureFactors: factors(input.bound),
      estimatorJobCount: input.estimatorJobCount,
      evaluationArtifactHash: null,
      authority: "FAILURE_BUDGET_RANKING_ONLY" as const,
      guaranteedProfit: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
    });
    return Object.freeze({ itemId: hashCanonical(body), ...body });
  }
  const breakEven = BigInt(evaluation.breakEvenEpsilonPpm);
  const epsilon = BigInt(evaluation.adverseProbabilityUpperPpm);
  const margin = breakEven - epsilon;
  const utilization = breakEven === 0n
    ? epsilon === 0n ? 0n : BPS
    : (epsilon * BPS + breakEven - 1n) / breakEven;
  const blockers = Object.freeze([
    ...evaluation.diagnostics,
    ...(evaluation.calibrationStatus === "CALIBRATED" ? [] : ["UNCALIBRATED"]),
  ]);
  const status = margin <= 0n
    ? "BUDGET_EXHAUSTED" as const
    : blockers.length === 0
      ? "BOUNDED_ARBITRAGE_CANDIDATE" as const
      : "RESEARCH_MARGIN" as const;
  const portfolioLabel = evaluation.quotes.map((quote) =>
    `${quote.outcome === "TRUE" ? "YES" : "NO"} ${quote.listingRef}`
  ).join(" + ");
  const body = Object.freeze({
    proposalId: input.bound.proposalId,
    listingRefs: input.bound.listingRefs,
    status,
    portfolioLabel,
    breakEvenEpsilonPpm: evaluation.breakEvenEpsilonPpm,
    adverseProbabilityUpperPpm: evaluation.adverseProbabilityUpperPpm,
    remainingFailureBudgetPpm: margin.toString(),
    budgetUtilizationBps: (utilization > BPS ? BPS : utilization).toString(),
    expectedEdgeFloorUnits: evaluation.expectedEdgeFloorUnits,
    adverseTailLossUnits: evaluation.adverseTailLossUnits,
    commonPriceScale: evaluation.commonPriceScale,
    calibrationStatus: evaluation.calibrationStatus,
    blockers,
    failureFactors: factors(input.bound),
    estimatorJobCount: input.estimatorJobCount,
    evaluationArtifactHash: evaluation.artifactHash,
    authority: "FAILURE_BUDGET_RANKING_ONLY" as const,
    guaranteedProfit: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ itemId: hashCanonical(body), ...body });
}

function pendingItem(
  jobs: readonly ProbabilityEstimationJobRecord[],
): FailureBudgetFrontierItem {
  const first = jobs[0]!;
  const blockers = Object.freeze([...new Set(jobs.map((job) =>
    `ESTIMATOR_${job.role}_${job.status}`
  ))].sort());
  const body = Object.freeze({
    proposalId: first.proposalId,
    listingRefs: first.semanticConstraint.listingRefs,
    status: "AWAITING_ESTIMATES" as const,
    portfolioLabel: null,
    breakEvenEpsilonPpm: null,
    adverseProbabilityUpperPpm: null,
    remainingFailureBudgetPpm: null,
    budgetUtilizationBps: null,
    expectedEdgeFloorUnits: null,
    adverseTailLossUnits: null,
    commonPriceScale: null,
    calibrationStatus: "PENDING" as const,
    blockers,
    failureFactors: Object.freeze([]),
    estimatorJobCount: jobs.length,
    evaluationArtifactHash: null,
    authority: "FAILURE_BUDGET_RANKING_ONLY" as const,
    guaranteedProfit: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ itemId: hashCanonical(body), ...body });
}

export function buildFailureBudgetFrontier(input: Readonly<{
  bounds: readonly ProbabilisticSemanticBoundArtifact[];
  jobs: readonly ProbabilityEstimationJobRecord[];
  corpus: MarketCorpusSnapshot;
  evaluatedAt: string;
}>): FailureBudgetFrontier {
  const evaluatedTime = Date.parse(input.evaluatedAt);
  if (
    !Number.isFinite(evaluatedTime) ||
    new Date(evaluatedTime).toISOString() !== input.evaluatedAt
  ) {
    throw new Error("failure budget evaluation time must be canonical ISO");
  }
  const listings = new Map(input.corpus.listings.map((listing) =>
    [listing.listingRef, listing] as const
  ));
  const jobsByCase = new Map<Hash, ProbabilityEstimationJobRecord[]>();
  for (const job of input.jobs) {
    const jobs = jobsByCase.get(job.caseIdentity) ?? [];
    jobs.push(job);
    jobsByCase.set(job.caseIdentity, jobs);
  }
  const matchedCaseIds = new Set<Hash>();
  const boundItems = input.bounds.map((bound) => {
    const estimateIdentities = new Set(bound.estimates.map((estimate) =>
      estimate.estimateIdentity
    ));
    const matched = [...jobsByCase.entries()].find(([_caseId, jobs]) => {
      const first = jobs[0];
      if (
        first === undefined ||
        first.semanticConstraintArtifactHash !== bound.semanticConstraintArtifactHash ||
        first.adverseStateIds.join("\n") !== bound.adverseStateIds.join("\n")
      ) return false;
      const passingIdentities = jobs.flatMap((job) =>
        job.status === "PASS" && job.lastEstimateIdentity !== null
          ? [job.lastEstimateIdentity]
          : []
      );
      return passingIdentities.length === estimateIdentities.size &&
        passingIdentities.every((identity) => estimateIdentities.has(identity));
    });
    if (matched !== undefined) matchedCaseIds.add(matched[0]);
    return evaluatedItem({
      bound,
      evaluation: selectPortfolio(portfolioCandidates({
        bound,
        listings,
        evaluatedAt: input.evaluatedAt,
      })),
      estimatorJobCount: matched?.[1].length ?? bound.estimates.length,
    });
  });
  const items = [
    ...boundItems,
    ...[...jobsByCase.entries()].flatMap(([caseId, jobs]) =>
      matchedCaseIds.has(caseId) ? [] : [pendingItem(jobs)]
    ),
  ].sort((left, right) => {
    const leftMargin = left.remainingFailureBudgetPpm === null
      ? -PPM
      : BigInt(left.remainingFailureBudgetPpm);
    const rightMargin = right.remainingFailureBudgetPpm === null
      ? -PPM
      : BigInt(right.remainingFailureBudgetPpm);
    if (leftMargin !== rightMargin) return leftMargin > rightMargin ? -1 : 1;
    const leftEdge = BigInt(left.expectedEdgeFloorUnits ?? "-1");
    const rightEdge = BigInt(right.expectedEdgeFloorUnits ?? "-1");
    return leftEdge === rightEdge
      ? left.itemId.localeCompare(right.itemId)
      : leftEdge > rightEdge ? -1 : 1;
  });
  const body = Object.freeze({
    schemaVersion: "pmh.failure-budget-frontier.v1" as const,
    evaluatedAt: input.evaluatedAt,
    itemCount: items.length,
    positiveMarginCount: items.filter((item) =>
      item.remainingFailureBudgetPpm !== null &&
      BigInt(item.remainingFailureBudgetPpm) > 0n
    ).length,
    boundedCandidateCount: items.filter((item) =>
      item.status === "BOUNDED_ARBITRAGE_CANDIDATE"
    ).length,
    awaitingEstimateCount: items.filter((item) =>
      item.status === "AWAITING_ESTIMATES"
    ).length,
    items: Object.freeze(items),
    rankingContract: "REMAINING_FAILURE_BUDGET_DESC_THEN_EDGE_DESC" as const,
    quotePosture: "INDICATIVE_ZERO_FEE_ZERO_DEPTH_ONLY" as const,
    authority: "FAILURE_BUDGET_RANKING_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      providerRequests: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, contentHash: hashCanonical(body) });
}
