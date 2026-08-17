import { hashCanonical, parseFixed, type Hash } from "@pmh/domain";
import { assertMarketCorpusSnapshot, type MarketCorpusSnapshot } from "./market-corpus.js";
import {
  assertSettlementProjection,
  assertWorldRelationExperiment,
  type SettlementProjection,
  type WorldRelationExperiment,
} from "./world-history-ontology.js";
import {
  assertWorldRelationExperimentInputRevision,
  type WorldRelationExperimentInputRevision,
} from "./world-relation-experiment-work.js";

const PPM = 1_000_000n;

export type WorldRelationShadowHypothesisBlocker =
  | "RELATION_NOT_PROBABILISTICALLY_SUPPORTED"
  | "MISSING_ADVERSE_ASSIGNMENT"
  | "LISTING_ARITY_UNSUPPORTED"
  | "INSPECTED_LISTINGS_LACK_SETTLEMENT_PROJECTIONS"
  | "INSPECTED_LISTING_PROJECTION_COVERAGE_INCOMPLETE"
  | "MISSING_EXACT_INPUT_PROJECTION"
  | "PROJECTION_NOT_SINGLE_PREDICATE"
  | "NON_EXACT_SETTLEMENT_PROJECTION"
  | "INDICATIVE_PRICE_UNAVAILABLE"
  | "NON_POSITIVE_INDICATIVE_FAILURE_BUDGET"
  | "ADVERSE_PROBABILITY_BOUND_UNAVAILABLE";

export type WorldRelationShadowTradeHypothesis = Readonly<{
  schemaVersion: "pmh.world-relation-shadow-trade-hypothesis.v2";
  hypothesisId: Hash;
  sourceExperimentArtifactHash: Hash;
  sourceInputRevisionId: Hash;
  sourceCorpusSnapshotIdentity: Hash;
  quoteCorpusSnapshotIdentity: Hash;
  adverseWorldStateId: string;
  adverseListingStateId: string;
  legs: readonly Readonly<{
    listingRef: string;
    projectionId: Hash;
    predicateId: Hash;
    adverseTruth: boolean;
    outcome: "TRUE" | "FALSE";
    indicativeAskUnits: string | null;
    priceScale: string;
    sourceReceivedAt: string;
    evidenceHash: Hash;
  }>[];
  payoffShape: Readonly<{
    commonPriceScale: string | null;
    minimumNonAdversePayoutUnits: string | null;
    adversePayoutUnits: "0";
    totalIndicativeCostUnits: string | null;
    grossFailureBudgetUnits: string | null;
    breakEvenAdverseProbabilityUpperPpm: string | null;
    formula: "MIN_NON_ADVERSE_PAYOUT_MINUS_COST_MINUS_ADVERSE_PROBABILITY_TAIL";
  }>;
  status:
    | "READY_FOR_PROBABILITY_BOUND"
    | "SETTLEMENT_MAPPING_BLOCKED"
    | "NON_POSITIVE_INDICATIVE_MARGIN"
    | "RESEARCH_ONLY";
  blockers: readonly WorldRelationShadowHypothesisBlocker[];
  quotePosture: "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH";
  quoteRefreshPosture: "CURRENT_LISTING_REF_MATCH_OVER_RETAINED_SEMANTIC_INPUT";
  guaranteedProfit: false;
  verifierEligible: false;
  authority: "SHADOW_TRADE_HYPOTHESIS_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function lcm(left: bigint, right: bigint): bigint {
  return left / gcd(left, right) * right;
}

function outcomePrice(
  listing: MarketCorpusSnapshot["listings"][number],
  outcome: "TRUE" | "FALSE",
): bigint | null {
  const labels = outcome === "TRUE" ? ["yes", "up"] : ["no", "down"];
  const selected = listing.outcomes.find((item) =>
    labels.includes(item.label.trim().toLowerCase()));
  if (selected?.indicativePrice === null || selected?.indicativePrice === undefined) {
    return null;
  }
  try {
    const scale = BigInt(listing.priceScale);
    const price = parseFixed(selected.indicativePrice, scale);
    return scale > 0n && price >= 0n && price <= scale ? price : null;
  } catch {
    return null;
  }
}

export function compileWorldRelationShadowTradeHypotheses(input: Readonly<{
  experiment: WorldRelationExperiment;
  inputRevision: WorldRelationExperimentInputRevision;
  corpus: MarketCorpusSnapshot;
  quoteCorpus?: MarketCorpusSnapshot;
  projections: readonly SettlementProjection[];
  inspectedListingRefs?: readonly string[];
  projectionCoverageIncomplete?: boolean;
}>): readonly WorldRelationShadowTradeHypothesis[] {
  const experiment = assertWorldRelationExperiment(input.experiment);
  const revision = assertWorldRelationExperimentInputRevision(input.inputRevision);
  const corpus = assertMarketCorpusSnapshot(input.corpus);
  const quoteCorpus = assertMarketCorpusSnapshot(input.quoteCorpus ?? input.corpus);
  if (corpus.snapshotIdentity !== revision.corpusSnapshotIdentity ||
      experiment.predicateIds.join("\n") !==
        revision.frontier.predicates.map((item) => item.predicateId).sort().join("\n")) {
    throw new Error("world relation shadow hypothesis requires the exact retained input");
  }
  const allowedProjectionHashes = new Set(revision.settlementProjectionArtifactHashes);
  const inspectedProjectionIds = new Set(experiment.inspectedProjectionIds);
  const inspectedListingRefs = new Set(input.inspectedListingRefs ?? []);
  const frontierPredicateIds = new Set(experiment.predicateIds);
  const projections = [...new Map(input.projections.map(assertSettlementProjection)
    .filter((item) => (
      allowedProjectionHashes.has(item.artifactHash) &&
      inspectedProjectionIds.has(item.projectionId)
    ) || (
      inspectedListingRefs.has(item.listing.listingRef) &&
      item.predicateIds.every((predicateId) => frontierPredicateIds.has(predicateId))
    )).map((item) => [item.projectionId, item] as const)).values()];
  const semanticListingByRef = new Map(corpus.listings.map((item) =>
    [item.listingRef, item] as const));
  const quoteListingByRef = new Map(quoteCorpus.listings.map((item) =>
    [item.listingRef, item] as const));
  const globalBlockers: WorldRelationShadowHypothesisBlocker[] = [];
  if (experiment.terminalDisposition !== "SUPPORTED_PROBABILISTIC") {
    globalBlockers.push("RELATION_NOT_PROBABILISTICALLY_SUPPORTED");
  }
  if (experiment.adverseAssignments.length === 0) {
    globalBlockers.push("MISSING_ADVERSE_ASSIGNMENT");
  }
  if (experiment.inspectedProjectionIds.length === 0 &&
      experiment.counterworlds[0]?.evidenceBindingHashes.length !== 0 &&
      projections.length === 0) {
    globalBlockers.push("INSPECTED_LISTINGS_LACK_SETTLEMENT_PROJECTIONS");
  } else if (input.projectionCoverageIncomplete === true) {
    globalBlockers.push("INSPECTED_LISTING_PROJECTION_COVERAGE_INCOMPLETE");
  } else if (projections.length < 2 || projections.length > 4) {
    globalBlockers.push("LISTING_ARITY_UNSUPPORTED");
  }
  if (experiment.inspectedProjectionIds.some((projectionId) =>
      !projections.some((item) => item.projectionId === projectionId))) {
    globalBlockers.push("MISSING_EXACT_INPUT_PROJECTION");
  }
  if (projections.some((item) => item.predicateIds.length !== 1)) {
    globalBlockers.push("PROJECTION_NOT_SINGLE_PREDICATE");
  }
  if (projections.some((item) => item.compilerAdmission !== "EXACT_BINARY_ELIGIBLE")) {
    globalBlockers.push("NON_EXACT_SETTLEMENT_PROJECTION");
  }
  const candidates = new Map<string, WorldRelationShadowTradeHypothesis>();
  for (const adverse of experiment.adverseAssignments) {
    const legs = projections.flatMap((projection) => {
      const predicateId = projection.predicateIds[0];
      const semanticListing = semanticListingByRef.get(projection.listing.listingRef);
      const quoteListing = quoteListingByRef.get(projection.listing.listingRef);
      if (predicateId === undefined || semanticListing === undefined ||
          adverse.truthByPredicateId[predicateId] === undefined) return [];
      const adverseTruth = adverse.truthByPredicateId[predicateId]!;
      const outcome = adverseTruth ? "FALSE" as const : "TRUE" as const;
      const price = quoteListing === undefined ? null : outcomePrice(quoteListing, outcome);
      const observedListing = quoteListing ?? semanticListing;
      return [Object.freeze({
        listingRef: semanticListing.listingRef,
        projectionId: projection.projectionId,
        predicateId,
        adverseTruth,
        outcome,
        indicativeAskUnits: price?.toString() ?? null,
        priceScale: semanticListing.priceScale,
        sourceReceivedAt: observedListing.sourceReceivedAt,
        evidenceHash: observedListing.sourceRawHash as Hash,
      })];
    }).sort((left, right) => left.listingRef.localeCompare(right.listingRef));
    const adverseListingStateId = legs.map((item) => item.adverseTruth ? "T" : "F").join("");
    if (candidates.has(adverseListingStateId)) continue;
    const blockers = [...globalBlockers];
    if (legs.length !== projections.length) blockers.push("MISSING_EXACT_INPUT_PROJECTION");
    if (legs.some((item) => item.indicativeAskUnits === null)) {
      blockers.push("INDICATIVE_PRICE_UNAVAILABLE");
    }
    let commonScale: bigint | null = null;
    let totalCost: bigint | null = null;
    let failureBudget: bigint | null = null;
    let breakEven: bigint | null = null;
    if (legs.length > 0 && legs.every((item) => item.indicativeAskUnits !== null)) {
      commonScale = legs.reduce((scale, item) => lcm(scale, BigInt(item.priceScale)), 1n);
      totalCost = legs.reduce((sum, item) => sum +
        BigInt(item.indicativeAskUnits!) * (commonScale! / BigInt(item.priceScale)), 0n);
      failureBudget = commonScale - totalCost;
      breakEven = failureBudget <= 0n ? 0n : failureBudget * PPM / commonScale;
      if (failureBudget <= 0n) blockers.push("NON_POSITIVE_INDICATIVE_FAILURE_BUDGET");
    }
    blockers.push("ADVERSE_PROBABILITY_BOUND_UNAVAILABLE");
    const uniqueBlockers = Object.freeze([...new Set(blockers)].sort());
    const status = uniqueBlockers.includes("NON_EXACT_SETTLEMENT_PROJECTION") ||
      uniqueBlockers.includes("MISSING_EXACT_INPUT_PROJECTION")
      ? "SETTLEMENT_MAPPING_BLOCKED" as const
      : uniqueBlockers.includes("NON_POSITIVE_INDICATIVE_FAILURE_BUDGET")
        ? "NON_POSITIVE_INDICATIVE_MARGIN" as const
        : uniqueBlockers.length === 1 &&
            uniqueBlockers[0] === "ADVERSE_PROBABILITY_BOUND_UNAVAILABLE"
          ? "READY_FOR_PROBABILITY_BOUND" as const
          : "RESEARCH_ONLY" as const;
    const body = Object.freeze({
      schemaVersion: "pmh.world-relation-shadow-trade-hypothesis.v2" as const,
      sourceExperimentArtifactHash: experiment.artifactHash,
      sourceInputRevisionId: revision.inputRevisionId,
      sourceCorpusSnapshotIdentity: corpus.snapshotIdentity,
      quoteCorpusSnapshotIdentity: quoteCorpus.snapshotIdentity,
      adverseWorldStateId: adverse.stateId,
      adverseListingStateId,
      legs: Object.freeze(legs),
      payoffShape: Object.freeze({
        commonPriceScale: commonScale?.toString() ?? null,
        minimumNonAdversePayoutUnits: commonScale?.toString() ?? null,
        adversePayoutUnits: "0" as const,
        totalIndicativeCostUnits: totalCost?.toString() ?? null,
        grossFailureBudgetUnits: failureBudget?.toString() ?? null,
        breakEvenAdverseProbabilityUpperPpm: breakEven?.toString() ?? null,
        formula: "MIN_NON_ADVERSE_PAYOUT_MINUS_COST_MINUS_ADVERSE_PROBABILITY_TAIL" as const,
      }),
      status,
      blockers: uniqueBlockers,
      quotePosture: "INDICATIVE_CATALOG_PRICE_ZERO_FEE_ZERO_DEPTH" as const,
      quoteRefreshPosture:
        "CURRENT_LISTING_REF_MATCH_OVER_RETAINED_SEMANTIC_INPUT" as const,
      guaranteedProfit: false as const,
      verifierEligible: false as const,
      authority: "SHADOW_TRADE_HYPOTHESIS_ONLY" as const,
      semanticDecisionAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
    candidates.set(adverseListingStateId, Object.freeze({
      ...body,
      hypothesisId: hashCanonical(body),
    }));
  }
  return Object.freeze([...candidates.values()].sort((left, right) =>
    left.hypothesisId.localeCompare(right.hypothesisId)));
}
