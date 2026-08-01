import { hashCanonical, type Hash } from "@pmh/domain";
import {
  calculateCanonicalIndicativeEconomics,
  matchedCurrentContractListings,
  type CanonicalIndicativeEconomics,
} from "./indicative-relation-economics.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  COMPILABLE_RELATIONS,
  type CompilableRelation,
} from "./relation-payoff.js";
import type { SemanticReviewCandidate } from "./semantic-review-scheduler.js";

const MAX_ITEMS = 250;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type ProposalEconomicTriageStatus =
  | "POSITIVE_GROSS_HINT"
  | "NON_POSITIVE_GROSS_HINT"
  | "PRICE_UNAVAILABLE"
  | "EVIDENCE_UNAVAILABLE"
  | "CURRENT_CONTRACT_MISMATCH"
  | "LISTING_SCOPE_UNSUPPORTED"
  | "RELATION_UNSUPPORTED";

const TRIAGE_STATUSES: readonly ProposalEconomicTriageStatus[] = Object.freeze([
  "POSITIVE_GROSS_HINT",
  "NON_POSITIVE_GROSS_HINT",
  "PRICE_UNAVAILABLE",
  "EVIDENCE_UNAVAILABLE",
  "CURRENT_CONTRACT_MISMATCH",
  "LISTING_SCOPE_UNSUPPORTED",
  "RELATION_UNSUPPORTED",
]);

export type ProposalEconomicTriageItem = Readonly<{
  schemaVersion: "pmh.proposal-economic-triage-item.v1";
  itemId: Hash;
  proposalId: Hash;
  statement: string;
  relationKind: string;
  listingRefs: readonly string[];
  evidenceBundleId: Hash | null;
  currentContractMatchCount: number;
  issueIds: readonly Hash[];
  basePriority: 1 | 2 | 3 | 4 | 5;
  priorityBoost: 0 | 1;
  effectivePriority: 1 | 2 | 3 | 4 | 5;
  status: ProposalEconomicTriageStatus;
  diagnostic: string;
  indicativeEconomics:
    | CanonicalIndicativeEconomics
    | Readonly<{
      status: "NOT_APPLICABLE";
      portfolioLabel: null;
      indicativeCostBpsCeil: null;
      grossEdgeBpsFloor: null;
      source: null;
      feesIncluded: false;
      depthIncluded: false;
      executable: false;
    }>;
  authority: "REVIEW_SCHEDULING_HINT_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    modelCalls: false;
    schedulerRequestsAdded: false;
    proposalsSuppressed: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ProposalEconomicTriageProjection = Readonly<{
  schemaVersion: "pmh.proposal-economic-triage.v1";
  contentHash: Hash;
  sourceCandidateCount: number;
  itemCount: number;
  truncated: boolean;
  counts: Readonly<Record<ProposalEconomicTriageStatus, number>>;
  boostedCount: number;
  items: readonly ProposalEconomicTriageItem[];
  priorityPolicy: "POSITIVE_GROSS_HINT_PLUS_ONE_CAPPED_AT_FIVE";
  retentionPolicy: "NO_SUPPRESSION_NO_NEGATIVE_PENALTY";
  arithmetic: "BIGINT_FIXED_POINT_RATIONAL_BPS";
  authority: "REVIEW_SCHEDULING_HINT_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: ProposalEconomicTriageItem["effects"];
}>;

const effects = Object.freeze({
  modelCalls: false as const,
  schedulerRequestsAdded: false as const,
  proposalsSuppressed: false as const,
  externalWrites: false as const,
  valueMovingActions: false as const,
  liveExecutionEnabled: false as const,
});

const inertEconomics = Object.freeze({
  status: "NOT_APPLICABLE" as const,
  portfolioLabel: null,
  indicativeCostBpsCeil: null,
  grossEdgeBpsFloor: null,
  source: null,
  feesIncluded: false as const,
  depthIncluded: false as const,
  executable: false as const,
});

function cappedPriority(
  base: SemanticReviewCandidate["priority"],
  boost: 0 | 1,
): SemanticReviewCandidate["priority"] {
  return Math.min(5, base + boost) as SemanticReviewCandidate["priority"];
}

export function recoverBaseReviewPriority(input: Readonly<{
  issuePriorities: readonly SemanticReviewCandidate["priority"][];
  retainedJobPriority: SemanticReviewCandidate["priority"];
}>): SemanticReviewCandidate["priority"] {
  return input.issuePriorities.reduce<SemanticReviewCandidate["priority"]>(
    (highest, priority) => priority > highest ? priority : highest,
    input.issuePriorities[0] ?? input.retainedJobPriority,
  );
}

function classify(
  candidate: SemanticReviewCandidate,
  corpus: MarketCorpusSnapshot,
): Readonly<{
  status: ProposalEconomicTriageStatus;
  diagnostic: string;
  currentContractMatchCount: number;
  economics: ProposalEconomicTriageItem["indicativeEconomics"];
}> {
  const proposal = candidate.proposal;
  const bundle = candidate.evidenceBundle;
  if (bundle === null) {
    return Object.freeze({
      status: "EVIDENCE_UNAVAILABLE",
      diagnostic: "No durable v2 proposal evidence bundle is available for contract matching.",
      currentContractMatchCount: 0,
      economics: inertEconomics,
    });
  }
  const current = matchedCurrentContractListings(proposal, bundle, corpus);
  if (proposal.listingRefs.length !== 2 || new Set(proposal.listingRefs).size !== 2) {
    return Object.freeze({
      status: "LISTING_SCOPE_UNSUPPORTED",
      diagnostic: "Indicative scheduling economics require exactly two distinct listing references.",
      currentContractMatchCount: current.size,
      economics: inertEconomics,
    });
  }
  if (!COMPILABLE_RELATIONS.includes(proposal.relationKind as CompilableRelation)) {
    return Object.freeze({
      status: "RELATION_UNSUPPORTED",
      diagnostic: `${proposal.relationKind} does not declare a canonical guaranteed-payout portfolio.`,
      currentContractMatchCount: current.size,
      economics: inertEconomics,
    });
  }
  if (current.size !== proposal.listingRefs.length) {
    return Object.freeze({
      status: "CURRENT_CONTRACT_MISMATCH",
      diagnostic: "At least one current listing is missing or no longer matches the captured contract semantics.",
      currentContractMatchCount: current.size,
      economics: inertEconomics,
    });
  }
  const economics = calculateCanonicalIndicativeEconomics({
    proposal,
    relation: proposal.relationKind as CompilableRelation,
    currentListings: current,
  });
  return Object.freeze({
    status: economics.status,
    diagnostic: economics.status === "PRICE_UNAVAILABLE"
      ? "Canonical Yes/No or Up/Down indicative prices are incomplete or malformed."
      : economics.status === "POSITIVE_GROSS_HINT"
        ? "The proposal-declared canonical portfolio has a positive current gross hint before fees and depth."
        : "The proposal-declared canonical portfolio has no positive current gross hint before fees and depth.",
    currentContractMatchCount: current.size,
    economics,
  });
}

function assertItem(item: ProposalEconomicTriageItem): ProposalEconomicTriageItem {
  const { itemId, ...body } = item;
  if (
    item.schemaVersion !== "pmh.proposal-economic-triage-item.v1" ||
    !HASH_PATTERN.test(item.itemId) ||
    !HASH_PATTERN.test(item.proposalId) ||
    item.itemId !== hashCanonical(body) ||
    !TRIAGE_STATUSES.includes(item.status) ||
    !Number.isSafeInteger(item.basePriority) ||
    item.basePriority < 1 || item.basePriority > 5 ||
    !Number.isSafeInteger(item.effectivePriority) ||
    item.effectivePriority < 1 || item.effectivePriority > 5 ||
    item.issueIds.some((issueId) => !HASH_PATTERN.test(issueId)) ||
    item.priorityBoost !== (
      item.status === "POSITIVE_GROSS_HINT" && item.basePriority < 5 ? 1 : 0
    ) ||
    item.effectivePriority !== cappedPriority(item.basePriority, item.priorityBoost) ||
    item.authority !== "REVIEW_SCHEDULING_HINT_ONLY" ||
    item.semanticDecisionAuthority !== false ||
    item.simulationAuthority !== false ||
    item.certificateAuthority !== false ||
    item.executionAuthority !== false ||
    Object.values(item.effects).some((value) => value !== false)
  ) throw new Error("proposal economic triage item violates its contract");
  return item;
}

export function assertProposalEconomicTriageProjection(
  value: unknown,
): ProposalEconomicTriageProjection {
  if (value === null || typeof value !== "object") {
    throw new Error("proposal economic triage projection is malformed");
  }
  const projection = value as ProposalEconomicTriageProjection;
  const { contentHash, ...body } = projection;
  if (
    projection.schemaVersion !== "pmh.proposal-economic-triage.v1" ||
    !HASH_PATTERN.test(projection.contentHash) ||
    projection.contentHash !== hashCanonical(body) ||
    !Number.isSafeInteger(projection.sourceCandidateCount) ||
    projection.sourceCandidateCount < projection.itemCount ||
    projection.items.length !== projection.itemCount ||
    projection.items.length > MAX_ITEMS ||
    projection.boostedCount !== projection.items.filter((item) => item.priorityBoost === 1).length ||
    Object.values(projection.counts).reduce((sum, count) => sum + count, 0) !== projection.itemCount ||
    TRIAGE_STATUSES.some((status) =>
      !Number.isSafeInteger(projection.counts[status]) || projection.counts[status] < 0
    ) ||
    projection.priorityPolicy !== "POSITIVE_GROSS_HINT_PLUS_ONE_CAPPED_AT_FIVE" ||
    projection.retentionPolicy !== "NO_SUPPRESSION_NO_NEGATIVE_PENALTY" ||
    projection.arithmetic !== "BIGINT_FIXED_POINT_RATIONAL_BPS" ||
    projection.authority !== "REVIEW_SCHEDULING_HINT_ONLY" ||
    projection.semanticDecisionAuthority !== false ||
    projection.simulationAuthority !== false ||
    projection.certificateAuthority !== false ||
    projection.executionAuthority !== false ||
    Object.values(projection.effects).some((value) => value !== false)
  ) throw new Error("proposal economic triage projection violates its contract");
  projection.items.forEach(assertItem);
  return projection;
}

export function buildProposalEconomicTriage(input: {
  candidates: readonly SemanticReviewCandidate[];
  corpus: MarketCorpusSnapshot;
}): ProposalEconomicTriageProjection {
  const unique = new Map(
    input.candidates.map((candidate) => [candidate.proposal.proposalId, candidate] as const),
  );
  const allItems = [...unique.values()].map((candidate) => {
    const classification = classify(candidate, input.corpus);
    const priorityBoost = classification.status === "POSITIVE_GROSS_HINT" && candidate.priority < 5
      ? 1 as const
      : 0 as const;
    const body = Object.freeze({
      schemaVersion: "pmh.proposal-economic-triage-item.v1" as const,
      proposalId: candidate.proposal.proposalId,
      statement: candidate.proposal.statement,
      relationKind: candidate.proposal.relationKind,
      listingRefs: Object.freeze([...candidate.proposal.listingRefs]),
      evidenceBundleId: candidate.evidenceBundle?.bundleId ?? null,
      currentContractMatchCount: classification.currentContractMatchCount,
      issueIds: Object.freeze([...candidate.issueIds].sort()),
      basePriority: candidate.priority,
      priorityBoost,
      effectivePriority: cappedPriority(candidate.priority, priorityBoost),
      status: classification.status,
      diagnostic: classification.diagnostic,
      indicativeEconomics: classification.economics,
      authority: "REVIEW_SCHEDULING_HINT_ONLY" as const,
      semanticDecisionAuthority: false as const,
      simulationAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      effects,
    });
    return assertItem(Object.freeze({ ...body, itemId: hashCanonical(body) }));
  });
  allItems.sort((left, right) =>
    right.priorityBoost - left.priorityBoost ||
    right.effectivePriority - left.effectivePriority ||
    Number(right.currentContractMatchCount === right.listingRefs.length) -
      Number(left.currentContractMatchCount === left.listingRefs.length) ||
    left.proposalId.localeCompare(right.proposalId),
  );
  const items = Object.freeze(allItems.slice(0, MAX_ITEMS));
  const counts = Object.freeze(Object.fromEntries(
    TRIAGE_STATUSES.map((status) => [
      status,
      items.filter((item) => item.status === status).length,
    ]),
  ) as Record<ProposalEconomicTriageStatus, number>);
  const body = Object.freeze({
    schemaVersion: "pmh.proposal-economic-triage.v1" as const,
    sourceCandidateCount: input.candidates.length,
    itemCount: items.length,
    truncated: allItems.length > MAX_ITEMS,
    counts,
    boostedCount: items.filter((item) => item.priorityBoost === 1).length,
    items,
    priorityPolicy: "POSITIVE_GROSS_HINT_PLUS_ONE_CAPPED_AT_FIVE" as const,
    retentionPolicy: "NO_SUPPRESSION_NO_NEGATIVE_PENALTY" as const,
    arithmetic: "BIGINT_FIXED_POINT_RATIONAL_BPS" as const,
    authority: "REVIEW_SCHEDULING_HINT_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects,
  });
  return assertProposalEconomicTriageProjection(Object.freeze({
    ...body,
    contentHash: hashCanonical(body),
  }));
}

export function applyProposalEconomicPriority(
  candidates: readonly SemanticReviewCandidate[],
  triage: ProposalEconomicTriageProjection,
): readonly SemanticReviewCandidate[] {
  const effective = new Map(
    triage.items.map((item) => [item.proposalId, item.effectivePriority] as const),
  );
  return Object.freeze(candidates.map((candidate) => Object.freeze({
    ...candidate,
    priority: effective.get(candidate.proposal.proposalId) ?? candidate.priority,
  })));
}

export function emptyProposalEconomicTriage(): ProposalEconomicTriageProjection {
  return buildProposalEconomicTriage({
    candidates: [],
    corpus: {
      schemaVersion: "pmh.market-corpus.v1",
      contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
      sourceSetIdentity: hashCanonical([]),
      snapshotIdentity: hashCanonical({ listings: [] }),
      eligibleSourceCount: 0,
      excludedSourceCount: 0,
      listingCount: 0,
      listings: [],
      authority: "OBSERVE_ONLY",
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    },
  });
}
