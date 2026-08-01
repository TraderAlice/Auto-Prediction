import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  DurableProposalEvidenceBundle,
  MarketArchaeologistProjection,
  MarketRelationProposal,
} from "./market-archaeologist.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type { ResearchSemanticDecision } from "./opportunity-lifecycle-desk.js";
import {
  calculateCanonicalIndicativeEconomics,
  matchedCurrentContractListings,
} from "./indicative-relation-economics.js";
import {
  inspectRelationPayoffReadiness,
  type CompilableRelation,
  type RelationPayoffReadiness,
} from "./relation-payoff.js";
import type { SemanticReviewJobRecord } from "./semantic-review-scheduler.js";
import type {
  SemanticReviewRecommendation,
  SemanticReviewRecord,
} from "./semantic-review.js";

const MAX_ITEMS = 50;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type ReviewAttentionPosture =
  | "DECISION_READY"
  | "RESEARCH_ONLY"
  | "EVIDENCE_ESCALATION"
  | "REJECT_RECOMMENDED";

export type ReviewAttentionItem = Readonly<{
  schemaVersion: "pmh.review-attention-item.v1";
  itemId: Hash;
  opportunityId: string;
  proposalId: Hash;
  semanticReviewArtifactHash: Hash;
  completedAt: string;
  statement: string;
  recommendation: SemanticReviewRecommendation;
  relationConclusion: string;
  evidencePosture: "ORIGINAL_CORPUS" | "REBASED_CURRENT_CORPUS";
  operatorPosture: ReviewAttentionPosture;
  payoffReadiness: RelationPayoffReadiness;
  listingRefs: readonly string[];
  currentContractMatchCount: number;
  missingEvidenceCount: number;
  counterexampleCount: number;
  anonymousCoverage: Readonly<{
    status:
      | "EXACT_ADAPTER_COVERAGE"
      | "BOOK_ONLY_FEE_BLOCKED"
      | "UNSUPPORTED_VENUE"
      | "NOT_APPLICABLE";
    exactLegCount: number;
    bookOnlyLegCount: number;
    unsupportedLegCount: number;
  }>;
  indicativeEconomics: Readonly<{
    status:
      | "POSITIVE_GROSS_HINT"
      | "NON_POSITIVE_GROSS_HINT"
      | "PRICE_UNAVAILABLE"
      | "NOT_APPLICABLE";
    portfolioLabel: string | null;
    indicativeCostBpsCeil: string | null;
    grossEdgeBpsFloor: string | null;
    source: "CURRENT_CONTRACT_MATCHED" | null;
    feesIncluded: false;
    depthIncluded: false;
    executable: false;
  }>;
  nextAction:
    | "REVIEW_AND_DECIDE"
    | "KEEP_FOR_RESEARCH"
    | "RESOLVE_EVIDENCE_GAPS"
    | "CONFIRM_REJECTION";
  authority: "OPERATOR_ATTENTION_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    modelCalls: false;
    schedulerChanges: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ReviewAttentionProjection = Readonly<{
  schemaVersion: "pmh.review-attention-queue.v1";
  contentHash: Hash;
  sourceReviewCount: number;
  decidedReviewCount: number;
  unresolvedInputCount: number;
  itemCount: number;
  truncated: boolean;
  counts: Readonly<Record<ReviewAttentionPosture, number>>;
  exactAdapterCoverageCount: number;
  positiveGrossHintCount: number;
  items: readonly ReviewAttentionItem[];
  sortContract: "POSTURE_THEN_ADAPTER_THEN_GROSS_HINT_THEN_EVIDENCE_THEN_RECENCY";
  arithmetic: "BIGINT_FIXED_POINT_RATIONAL_BPS";
  authority: "OPERATOR_ATTENTION_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: ReviewAttentionItem["effects"];
}>;

type CandidateSource = Readonly<{
  proposal: MarketRelationProposal;
  bundle: DurableProposalEvidenceBundle | null;
}>;

function indicativeEconomics(
  proposal: MarketRelationProposal,
  readiness: RelationPayoffReadiness,
  current: ReturnType<typeof matchedCurrentContractListings>,
): ReviewAttentionItem["indicativeEconomics"] {
  const inert = {
    portfolioLabel: null,
    indicativeCostBpsCeil: null,
    grossEdgeBpsFloor: null,
    source: null,
    feesIncluded: false as const,
    depthIncluded: false as const,
    executable: false as const,
  };
  if (readiness.status !== "READY") return Object.freeze({ status: "NOT_APPLICABLE" as const, ...inert });
  return calculateCanonicalIndicativeEconomics({
    proposal,
    relation: readiness.relationKind as CompilableRelation,
    currentListings: current,
  });
}

function anonymousCoverage(
  proposal: MarketRelationProposal,
  readiness: RelationPayoffReadiness,
  bundle: DurableProposalEvidenceBundle | null,
  current: ReturnType<typeof matchedCurrentContractListings>,
): ReviewAttentionItem["anonymousCoverage"] {
  if (readiness.status !== "READY") {
    return Object.freeze({ status: "NOT_APPLICABLE", exactLegCount: 0, bookOnlyLegCount: 0, unsupportedLegCount: 0 });
  }
  const captured = new Map(
    (bundle?.listings ?? []).map((listing) => [listing.listingRef, listing] as const),
  );
  const venues = proposal.listingRefs.map((listingRef) =>
    captured.get(listingRef)?.venueId ?? current.get(listingRef)?.venueId ?? null,
  );
  const exactLegCount = venues.filter((venue) => venue === "polymarket-global").length;
  const bookOnlyLegCount = venues.filter((venue) => venue === "limitless").length;
  const unsupportedLegCount = venues.length - exactLegCount - bookOnlyLegCount;
  const status = unsupportedLegCount > 0
    ? "UNSUPPORTED_VENUE"
    : bookOnlyLegCount > 0
      ? "BOOK_ONLY_FEE_BLOCKED"
      : "EXACT_ADAPTER_COVERAGE";
  return Object.freeze({ status, exactLegCount, bookOnlyLegCount, unsupportedLegCount });
}

function postureFor(
  recommendation: SemanticReviewRecommendation,
  readiness: RelationPayoffReadiness,
): ReviewAttentionPosture {
  if (recommendation === "REJECT") return "REJECT_RECOMMENDED";
  if (recommendation === "ESCALATE") return "EVIDENCE_ESCALATION";
  return readiness.status === "READY" ? "DECISION_READY" : "RESEARCH_ONLY";
}

function collectSources(
  archaeologist: MarketArchaeologistProjection,
  jobs: readonly SemanticReviewJobRecord[],
): ReadonlyMap<Hash, CandidateSource> {
  const sources = new Map<Hash, CandidateSource>();
  for (const record of archaeologist.records) {
    if (record.status !== "PASS" || record.report === null) continue;
    const bundles = new Map(
      (record.report.result.proposalEvidenceBundles ?? []).flatMap((bundle) =>
        bundle.schemaVersion === "pmh.proposal-evidence-bundle.v2"
          ? [[bundle.proposalId, bundle] as const]
          : [],
      ),
    );
    for (const proposal of record.report.result.proposals) {
      sources.set(proposal.proposalId, { proposal, bundle: bundles.get(proposal.proposalId) ?? null });
    }
  }
  for (const job of jobs) {
    const bundle = job.evidenceBundle;
    if (bundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2") {
      sources.set(job.proposalId, { proposal: bundle.proposal, bundle });
    }
  }
  return sources;
}

const effects = Object.freeze({
  modelCalls: false as const,
  schedulerChanges: false as const,
  externalWrites: false as const,
  valueMovingActions: false as const,
  liveExecutionEnabled: false as const,
});

function assertItem(item: ReviewAttentionItem): ReviewAttentionItem {
  const { itemId, ...body } = item;
  if (
    item.schemaVersion !== "pmh.review-attention-item.v1" ||
    !HASH_PATTERN.test(itemId) ||
    itemId !== hashCanonical(body) ||
    item.authority !== "OPERATOR_ATTENTION_ONLY" ||
    item.semanticDecisionAuthority !== false ||
    item.simulationAuthority !== false ||
    item.certificateAuthority !== false ||
    item.executionAuthority !== false ||
    Object.values(item.effects).some((value) => value !== false)
  ) {
    throw new Error("review attention item violates its authority or identity contract");
  }
  return item;
}

export function assertReviewAttentionProjection(value: unknown): ReviewAttentionProjection {
  if (value === null || typeof value !== "object") throw new Error("review attention projection is malformed");
  const projection = value as ReviewAttentionProjection;
  const { contentHash, ...body } = projection;
  if (
    projection.schemaVersion !== "pmh.review-attention-queue.v1" ||
    !HASH_PATTERN.test(contentHash) ||
    contentHash !== hashCanonical(body) ||
    projection.items.length !== projection.itemCount ||
    projection.items.length > MAX_ITEMS ||
    projection.authority !== "OPERATOR_ATTENTION_ONLY" ||
    projection.semanticDecisionAuthority !== false ||
    projection.simulationAuthority !== false ||
    projection.certificateAuthority !== false ||
    projection.executionAuthority !== false ||
    Object.values(projection.effects).some((item) => item !== false)
  ) throw new Error("review attention projection violates its contract");
  projection.items.forEach(assertItem);
  return projection;
}

export function buildReviewAttentionProjection(input: {
  archaeologist: MarketArchaeologistProjection;
  semanticReviews: readonly SemanticReviewRecord[];
  semanticReviewJobs: readonly SemanticReviewJobRecord[];
  semanticDecisions: readonly ResearchSemanticDecision[];
  corpus: MarketCorpusSnapshot;
}): ReviewAttentionProjection {
  const sources = collectSources(input.archaeologist, input.semanticReviewJobs);
  const decidedArtifacts = new Set(input.semanticDecisions.map((decision) => decision.semanticReviewArtifactHash));
  const latest = new Map<Hash, SemanticReviewRecord>();
  for (const review of input.semanticReviews) {
    if (review.status !== "PASS" || review.report === null) continue;
    const existing = latest.get(review.proposalId);
    if (existing === undefined || review.completedAt! > existing.completedAt!) latest.set(review.proposalId, review);
  }
  let unresolvedInputCount = 0;
  const allItems = [...latest.values()].flatMap((review) => {
    if (decidedArtifacts.has(review.report!.artifactHash)) return [];
    const source = sources.get(review.proposalId);
    if (source === undefined) {
      unresolvedInputCount += 1;
      return [];
    }
    const readiness = inspectRelationPayoffReadiness({
      opportunityId: review.opportunityId,
      proposal: source.proposal,
      review,
    });
    const current = matchedCurrentContractListings(source.proposal, source.bundle, input.corpus);
    const operatorPosture = postureFor(review.report!.result.recommendation, readiness);
    const body = Object.freeze({
      schemaVersion: "pmh.review-attention-item.v1" as const,
      opportunityId: review.opportunityId,
      proposalId: source.proposal.proposalId,
      semanticReviewArtifactHash: review.report!.artifactHash,
      completedAt: review.completedAt!,
      statement: source.proposal.statement,
      recommendation: review.report!.result.recommendation,
      relationConclusion: review.report!.result.relationConclusion,
      evidencePosture: review.report!.input.evidencePosture,
      operatorPosture,
      payoffReadiness: readiness,
      listingRefs: Object.freeze([...source.proposal.listingRefs]),
      currentContractMatchCount: current.size,
      missingEvidenceCount: review.report!.result.missingEvidence.length,
      counterexampleCount: review.report!.result.counterexamples.length,
      anonymousCoverage: anonymousCoverage(source.proposal, readiness, source.bundle, current),
      indicativeEconomics: indicativeEconomics(source.proposal, readiness, current),
      nextAction: operatorPosture === "DECISION_READY" ? "REVIEW_AND_DECIDE" as const
        : operatorPosture === "RESEARCH_ONLY" ? "KEEP_FOR_RESEARCH" as const
          : operatorPosture === "EVIDENCE_ESCALATION" ? "RESOLVE_EVIDENCE_GAPS" as const
            : "CONFIRM_REJECTION" as const,
      authority: "OPERATOR_ATTENTION_ONLY" as const,
      semanticDecisionAuthority: false as const,
      simulationAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      effects,
    });
    return [assertItem(Object.freeze({ ...body, itemId: hashCanonical(body) }))];
  });
  const postureRank: Record<ReviewAttentionPosture, number> = {
    DECISION_READY: 0,
    RESEARCH_ONLY: 1,
    EVIDENCE_ESCALATION: 2,
    REJECT_RECOMMENDED: 3,
  };
  allItems.sort((left, right) =>
    postureRank[left.operatorPosture] - postureRank[right.operatorPosture] ||
    Number(right.anonymousCoverage.status === "EXACT_ADAPTER_COVERAGE") - Number(left.anonymousCoverage.status === "EXACT_ADAPTER_COVERAGE") ||
    Number(right.indicativeEconomics.status === "POSITIVE_GROSS_HINT") - Number(left.indicativeEconomics.status === "POSITIVE_GROSS_HINT") ||
    right.currentContractMatchCount - left.currentContractMatchCount ||
    left.missingEvidenceCount - right.missingEvidenceCount ||
    right.completedAt.localeCompare(left.completedAt) ||
    left.proposalId.localeCompare(right.proposalId),
  );
  const items = Object.freeze(allItems.slice(0, MAX_ITEMS));
  const counts = Object.freeze({
    DECISION_READY: allItems.filter((item) => item.operatorPosture === "DECISION_READY").length,
    RESEARCH_ONLY: allItems.filter((item) => item.operatorPosture === "RESEARCH_ONLY").length,
    EVIDENCE_ESCALATION: allItems.filter((item) => item.operatorPosture === "EVIDENCE_ESCALATION").length,
    REJECT_RECOMMENDED: allItems.filter((item) => item.operatorPosture === "REJECT_RECOMMENDED").length,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.review-attention-queue.v1" as const,
    sourceReviewCount: latest.size,
    decidedReviewCount: [...latest.values()].filter((review) => decidedArtifacts.has(review.report!.artifactHash)).length,
    unresolvedInputCount,
    itemCount: items.length,
    truncated: allItems.length > MAX_ITEMS,
    counts,
    exactAdapterCoverageCount: allItems.filter((item) => item.anonymousCoverage.status === "EXACT_ADAPTER_COVERAGE").length,
    positiveGrossHintCount: allItems.filter((item) => item.indicativeEconomics.status === "POSITIVE_GROSS_HINT").length,
    items,
    sortContract: "POSTURE_THEN_ADAPTER_THEN_GROSS_HINT_THEN_EVIDENCE_THEN_RECENCY" as const,
    arithmetic: "BIGINT_FIXED_POINT_RATIONAL_BPS" as const,
    authority: "OPERATOR_ATTENTION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects,
  });
  return assertReviewAttentionProjection(Object.freeze({ ...body, contentHash: hashCanonical(body) }));
}

export function emptyReviewAttentionProjection(): ReviewAttentionProjection {
  return buildReviewAttentionProjection({
    archaeologist: {
      schemaVersion: "pmh.market-archaeologist-desk.v1", configured: false, model: "unconfigured", status: "NEEDS_KEY",
      activeCount: 0, concurrencyLimit: 1, runCount: 0, passCount: 0, failedCount: 0, retentionLimit: 1,
      storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "runId" },
      scheduler: { enabled: false, intervalMs: null, changedCorpusOnly: true, lastAttemptedSnapshotIdentity: null },
      records: [], authority: "PROPOSE_ONLY", effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
    },
    semanticReviews: [], semanticReviewJobs: [], semanticDecisions: [],
    corpus: {
      schemaVersion: "pmh.market-corpus.v1", contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
      sourceSetIdentity: hashCanonical([]), snapshotIdentity: hashCanonical({ listings: [] }), eligibleSourceCount: 0,
      excludedSourceCount: 0, listingCount: 0, listings: [], authority: "OBSERVE_ONLY",
      effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
    },
  });
}
