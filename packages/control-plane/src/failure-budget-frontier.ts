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

export type FailureBudgetAttemptStatus =
  | "ESTIMATES_COMPLETE"
  | "AWAITING_ESTIMATES"
  | "ESTIMATION_ABSTAINED"
  | "ESTIMATION_EXHAUSTED"
  | "EVIDENCE_BLOCKED"
  | "SEMANTIC_REPAIR_REQUIRED";

export type FailureBudgetEstimationAttempt = Readonly<{
  caseIdentity: Hash;
  status: FailureBudgetAttemptStatus;
  provider: "DEEPSEEK" | "CODEX";
  model: string;
  reasoningEffort: string | null;
  inputProtocol: string;
  jobCount: number;
  createdAt: string;
  updatedAt: string;
}>;

export type FailureBudgetFrontierItem = Readonly<{
  itemId: Hash;
  workIdentity: Hash;
  proposalId: Hash;
  listingRefs: readonly string[];
  adverseStateIds: readonly string[];
  status:
    | "BOUNDED_ARBITRAGE_CANDIDATE"
    | "RESEARCH_MARGIN"
    | "BUDGET_EXHAUSTED"
    | "AWAITING_ESTIMATES"
    | "ESTIMATION_ABSTAINED"
    | "ESTIMATION_EXHAUSTED"
    | "EVIDENCE_BLOCKED"
    | "SEMANTIC_REPAIR_REQUIRED"
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
  attemptCount: number;
  estimationAttempts: readonly FailureBudgetEstimationAttempt[];
  estimatorJobCount: number;
  estimationCase: Readonly<{
    caseIdentity: Hash;
    provider: "DEEPSEEK" | "CODEX";
    model: string;
    reasoningEffort: string | null;
    inputProtocol: string;
    evidenceSource: "CURRENT_CATALOG_EXACT" | "DURABLE_REVIEW_BUNDLE" | "LEGACY_CURRENT_CATALOG";
  }> | null;
  evaluationArtifactHash: Hash | null;
  authority: "FAILURE_BUDGET_RANKING_ONLY";
  guaranteedProfit: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type FailureBudgetFrontier = Readonly<{
  schemaVersion: "pmh.failure-budget-frontier.v4";
  contentHash: Hash;
  evaluatedAt: string;
  itemCount: number;
  rawEstimatorCaseCount: number;
  collapsedEstimatorCaseCount: number;
  positiveMarginCount: number;
  boundedCandidateCount: number;
  awaitingEstimateCount: number;
  abstainedCaseCount: number;
  evidenceBlockedCount: number;
  challengedCaseCount: number;
  unboundedCaseCount: number;
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

function estimationCase(
  jobs: readonly ProbabilityEstimationJobRecord[],
): FailureBudgetFrontierItem["estimationCase"] {
  const first = jobs[0];
  if (first === undefined) return null;
  return Object.freeze({
    caseIdentity: first.caseIdentity,
    provider: first.engine?.provider ?? "DEEPSEEK",
    model: first.model,
    reasoningEffort: first.engine?.reasoningEffort ?? null,
    inputProtocol: first.inputProtocol ?? "pmh.probability-estimation-input.v1",
    evidenceSource: first.evidenceContext?.sourceKind ?? "LEGACY_CURRENT_CATALOG",
  });
}

function workIdentity(input: Readonly<{
  proposalId: Hash;
  semanticConstraintArtifactHash: Hash;
  adverseStateIds: readonly string[];
}>): Hash {
  return hashCanonical({
    proposalId: input.proposalId,
    semanticConstraintArtifactHash: input.semanticConstraintArtifactHash,
    adverseStateIds: input.adverseStateIds,
  });
}

function attemptStatus(
  jobs: readonly ProbabilityEstimationJobRecord[],
): FailureBudgetAttemptStatus {
  if (jobs.length > 0 && jobs.every((job) => job.status === "PASS")) {
    return "ESTIMATES_COMPLETE";
  }
  const terminal = jobs.every((job) =>
    ["PASS", "ABSTAINED", "CHALLENGED", "EXHAUSTED"].includes(job.status)
  );
  return terminal && jobs.some((job) => job.status === "CHALLENGED")
    ? "SEMANTIC_REPAIR_REQUIRED"
    : jobs.every((job) => job.status === "BLOCKED_EVIDENCE")
      ? "EVIDENCE_BLOCKED"
      : terminal && jobs.some((job) => job.status === "EXHAUSTED")
        ? "ESTIMATION_EXHAUSTED"
        : terminal && jobs.some((job) => job.status === "ABSTAINED")
          ? "ESTIMATION_ABSTAINED"
          : "AWAITING_ESTIMATES";
}

function orderedCases(
  cases: readonly (readonly ProbabilityEstimationJobRecord[])[],
): readonly (readonly ProbabilityEstimationJobRecord[])[] {
  return Object.freeze([...cases].sort((left, right) =>
    (right[0]?.createdAt ?? "").localeCompare(left[0]?.createdAt ?? "") ||
    (left[0]?.caseIdentity ?? "").localeCompare(right[0]?.caseIdentity ?? "")
  ));
}

function estimationAttempts(
  cases: readonly (readonly ProbabilityEstimationJobRecord[])[],
): readonly FailureBudgetEstimationAttempt[] {
  return Object.freeze(orderedCases(cases).map((jobs) => {
    const first = jobs[0]!;
    return Object.freeze({
      caseIdentity: first.caseIdentity,
      status: attemptStatus(jobs),
      provider: first.engine?.provider ?? "DEEPSEEK",
      model: first.model,
      reasoningEffort: first.engine?.reasoningEffort ?? null,
      inputProtocol: first.inputProtocol ?? "pmh.probability-estimation-input.v1",
      jobCount: jobs.length,
      createdAt: first.createdAt,
      updatedAt: [...jobs].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      )[0]!.updatedAt,
    });
  }));
}

function evaluatedItem(input: Readonly<{
  bound: ProbabilisticSemanticBoundArtifact;
  evaluation: ProbabilisticSemanticArbitrageEvaluation | null;
  estimatorCases: readonly (readonly ProbabilityEstimationJobRecord[])[];
  matchedEstimatorJobs: readonly ProbabilityEstimationJobRecord[];
}>): FailureBudgetFrontierItem {
  const evaluation = input.evaluation;
  const attempts = estimationAttempts(input.estimatorCases);
  const estimatorJobs = input.estimatorCases.flat();
  const identity = workIdentity({
    proposalId: input.bound.proposalId,
    semanticConstraintArtifactHash: input.bound.semanticConstraintArtifactHash,
    adverseStateIds: input.bound.adverseStateIds,
  });
  if (evaluation === null) {
    const body = Object.freeze({
      workIdentity: identity,
      proposalId: input.bound.proposalId,
      listingRefs: input.bound.listingRefs,
      adverseStateIds: input.bound.adverseStateIds,
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
      attemptCount: attempts.length,
      estimationAttempts: attempts,
      estimatorJobCount: estimatorJobs.length || input.bound.estimates.length,
      estimationCase: estimationCase(input.matchedEstimatorJobs),
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
    workIdentity: identity,
    proposalId: input.bound.proposalId,
    listingRefs: input.bound.listingRefs,
    adverseStateIds: input.bound.adverseStateIds,
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
    attemptCount: attempts.length,
    estimationAttempts: attempts,
    estimatorJobCount: estimatorJobs.length || input.bound.estimates.length,
    estimationCase: estimationCase(input.matchedEstimatorJobs),
    evaluationArtifactHash: evaluation.artifactHash,
    authority: "FAILURE_BUDGET_RANKING_ONLY" as const,
    guaranteedProfit: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ itemId: hashCanonical(body), ...body });
}

function pendingItem(
  cases: readonly (readonly ProbabilityEstimationJobRecord[])[],
): FailureBudgetFrontierItem {
  const ordered = orderedCases(cases);
  const current = ordered[0]!;
  const first = current[0]!;
  const jobs = cases.flat();
  const blockers = Object.freeze([...new Set(current.map((job) =>
    `ESTIMATOR_${job.role}_${job.status}`
  ))].sort());
  const currentAttemptStatus = attemptStatus(current);
  const status = currentAttemptStatus === "ESTIMATES_COMPLETE"
    ? "AWAITING_ESTIMATES" as const
    : currentAttemptStatus;
  const attempts = estimationAttempts(cases);
  const body = Object.freeze({
    workIdentity: workIdentity({
      proposalId: first.proposalId,
      semanticConstraintArtifactHash: first.semanticConstraintArtifactHash,
      adverseStateIds: first.adverseStateIds,
    }),
    proposalId: first.proposalId,
    listingRefs: first.semanticConstraint.listingRefs,
    adverseStateIds: first.adverseStateIds,
    status,
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
    attemptCount: attempts.length,
    estimationAttempts: attempts,
    estimatorJobCount: jobs.length,
    estimationCase: estimationCase(current),
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
  const casesByWork = new Map<Hash, (readonly ProbabilityEstimationJobRecord[])[]>();
  for (const jobs of jobsByCase.values()) {
    const first = jobs[0];
    if (first === undefined) continue;
    const identity = workIdentity({
      proposalId: first.proposalId,
      semanticConstraintArtifactHash: first.semanticConstraintArtifactHash,
      adverseStateIds: first.adverseStateIds,
    });
    const cases = casesByWork.get(identity) ?? [];
    cases.push(Object.freeze([...jobs]));
    casesByWork.set(identity, cases);
  }
  const matchedWorkIds = new Set<Hash>();
  const boundItems = input.bounds.map((bound) => {
    const identity = workIdentity({
      proposalId: bound.proposalId,
      semanticConstraintArtifactHash: bound.semanticConstraintArtifactHash,
      adverseStateIds: bound.adverseStateIds,
    });
    const cases = casesByWork.get(identity) ?? Object.freeze([]);
    const estimateIdentities = new Set(bound.estimates.map((estimate) =>
      estimate.estimateIdentity
    ));
    const matched = cases.find((jobs) => {
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
    if (cases.length > 0) matchedWorkIds.add(identity);
    return evaluatedItem({
      bound,
      evaluation: selectPortfolio(portfolioCandidates({
        bound,
        listings,
        evaluatedAt: input.evaluatedAt,
      })),
      estimatorCases: cases,
      matchedEstimatorJobs: matched ?? Object.freeze([]),
    });
  });
  const items = [
    ...boundItems,
    ...[...casesByWork.entries()].flatMap(([identity, cases]) =>
      matchedWorkIds.has(identity) ? [] : [pendingItem(cases)]
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
    schemaVersion: "pmh.failure-budget-frontier.v4" as const,
    evaluatedAt: input.evaluatedAt,
    itemCount: items.length,
    rawEstimatorCaseCount: jobsByCase.size,
    collapsedEstimatorCaseCount: [...casesByWork.values()].reduce(
      (sum, cases) => sum + Math.max(0, cases.length - 1),
      0,
    ),
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
    abstainedCaseCount: items.filter((item) =>
      item.status === "ESTIMATION_ABSTAINED"
    ).length,
    evidenceBlockedCount: items.filter((item) =>
      item.status === "EVIDENCE_BLOCKED"
    ).length,
    challengedCaseCount: items.filter((item) =>
      item.status === "SEMANTIC_REPAIR_REQUIRED"
    ).length,
    unboundedCaseCount: items.filter((item) => [
      "AWAITING_ESTIMATES", "ESTIMATION_ABSTAINED", "ESTIMATION_EXHAUSTED",
      "EVIDENCE_BLOCKED",
      "SEMANTIC_REPAIR_REQUIRED",
    ].includes(item.status)).length,
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
