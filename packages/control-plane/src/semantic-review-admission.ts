import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  MarketRelationKind,
  MarketRelationProposal,
} from "./market-archaeologist.js";
import {
  COMPILABLE_RELATIONS,
  type CompilableRelation,
} from "./relation-payoff.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export const AUTOMATIC_REVIEW_RELATIONS = COMPILABLE_RELATIONS;

export type AutomaticReviewRelation = CompilableRelation;

export type SemanticReviewAdmissionReason =
  | "TWO_LISTING_COMPILABLE_RELATION"
  | "NON_COMPILABLE_RELATION"
  | "LISTING_ARITY_UNSUPPORTED"
  | "DUPLICATE_LISTING_REF";

export type SemanticReviewAdmissionRecord = Readonly<{
  schemaVersion: "pmh.semantic-review-admission.v1";
  proposalId: Hash;
  relationKind: MarketRelationKind;
  listingRefs: readonly string[];
  lane: "AUTO_ARBITRAGE_REVIEW" | "RESEARCH_ONLY";
  reason: SemanticReviewAdmissionReason;
  manualReviewAvailable: true;
  modelConfidenceUsed: false;
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export type SemanticReviewAdmissionProjection = Readonly<{
  schemaVersion: "pmh.semantic-review-admission-desk.v1";
  policy: "TWO_DISTINCT_LISTINGS_AND_COMPILABLE_RELATION_V1";
  candidateCount: number;
  autoReviewCount: number;
  researchOnlyCount: number;
  autoReviewRateBps: number | null;
  countsByReason: Readonly<Record<SemanticReviewAdmissionReason, number>>;
  candidates: readonly SemanticReviewAdmissionRecord[];
  supportedRelations: readonly AutomaticReviewRelation[];
  manualReviewAvailable: true;
  modelConfidenceUsed: false;
  authority: "AUTOMATIC_REVIEW_ADMISSION_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    modelCalls: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  contentHash: Hash;
}>;

function recordBody(
  record: SemanticReviewAdmissionRecord,
): Omit<SemanticReviewAdmissionRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

export function assertSemanticReviewAdmissionRecord(
  value: unknown,
): SemanticReviewAdmissionRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("semantic review admission record is malformed");
  }
  const record = value as SemanticReviewAdmissionRecord;
  if (
    record.schemaVersion !== "pmh.semantic-review-admission.v1" ||
    !HASH_PATTERN.test(String(record.proposalId)) ||
    ![
      "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE",
      "EXHAUSTIVE", "CONDITIONAL", "RELATED", "CONFLICTING",
    ].includes(record.relationKind) ||
    !Array.isArray(record.listingRefs) || record.listingRefs.length < 1 ||
    record.listingRefs.length > 20 ||
    record.listingRefs.some((item) =>
      typeof item !== "string" || item.trim() === "" || item.length > 500
    ) ||
    !["AUTO_ARBITRAGE_REVIEW", "RESEARCH_ONLY"].includes(record.lane) ||
    ![
      "TWO_LISTING_COMPILABLE_RELATION", "NON_COMPILABLE_RELATION",
      "LISTING_ARITY_UNSUPPORTED", "DUPLICATE_LISTING_REF",
    ].includes(record.reason) ||
    record.manualReviewAvailable !== true ||
    record.modelConfidenceUsed !== false ||
    record.semanticDecisionAuthority !== false ||
    record.simulationAuthority !== false ||
    record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    hashCanonical(recordBody(record)) !== record.artifactHash
  ) {
    throw new Error("semantic review admission record violates its contract");
  }
  const admitted = record.lane === "AUTO_ARBITRAGE_REVIEW";
  if (
    admitted !== (record.reason === "TWO_LISTING_COMPILABLE_RELATION") ||
    admitted !== (
      record.listingRefs.length === 2 &&
      new Set(record.listingRefs).size === 2 &&
      AUTOMATIC_REVIEW_RELATIONS.includes(
        record.relationKind as AutomaticReviewRelation,
      )
    )
  ) {
    throw new Error("semantic review admission record is internally inconsistent");
  }
  return Object.freeze(record);
}

export function classifySemanticReviewAdmission(
  proposal: MarketRelationProposal,
): SemanticReviewAdmissionRecord {
  if (
    !HASH_PATTERN.test(String(proposal.proposalId)) ||
    !Array.isArray(proposal.listingRefs) || proposal.listingRefs.length < 1 ||
    proposal.listingRefs.length > 20
  ) {
    throw new Error("semantic review admission proposal is invalid or unbounded");
  }
  const uniqueCount = new Set(proposal.listingRefs).size;
  const relationSupported = AUTOMATIC_REVIEW_RELATIONS.includes(
    proposal.relationKind as AutomaticReviewRelation,
  );
  const reason: SemanticReviewAdmissionReason = uniqueCount !== proposal.listingRefs.length
    ? "DUPLICATE_LISTING_REF"
    : proposal.listingRefs.length !== 2
      ? "LISTING_ARITY_UNSUPPORTED"
      : !relationSupported
        ? "NON_COMPILABLE_RELATION"
        : "TWO_LISTING_COMPILABLE_RELATION";
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-review-admission.v1" as const,
    proposalId: proposal.proposalId,
    relationKind: proposal.relationKind,
    listingRefs: Object.freeze([...proposal.listingRefs]),
    lane: reason === "TWO_LISTING_COMPILABLE_RELATION"
      ? ("AUTO_ARBITRAGE_REVIEW" as const)
      : ("RESEARCH_ONLY" as const),
    reason,
    manualReviewAvailable: true as const,
    modelConfidenceUsed: false as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertSemanticReviewAdmissionRecord(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function isAutomaticSemanticReviewCandidate(
  proposal: MarketRelationProposal,
): boolean {
  return classifySemanticReviewAdmission(proposal).lane === "AUTO_ARBITRAGE_REVIEW";
}

export function buildSemanticReviewAdmissionProjection(
  proposals: readonly MarketRelationProposal[],
): SemanticReviewAdmissionProjection {
  const byProposal = new Map<Hash, SemanticReviewAdmissionRecord>();
  for (const proposal of proposals) {
    const admission = classifySemanticReviewAdmission(proposal);
    const existing = byProposal.get(admission.proposalId);
    if (existing !== undefined && existing.artifactHash !== admission.artifactHash) {
      throw new Error("proposalId is bound to conflicting review admission inputs");
    }
    byProposal.set(admission.proposalId, admission);
  }
  const candidates = Object.freeze([...byProposal.values()].sort((left, right) =>
    Number(right.lane === "AUTO_ARBITRAGE_REVIEW") -
      Number(left.lane === "AUTO_ARBITRAGE_REVIEW") ||
    left.reason.localeCompare(right.reason) ||
    left.proposalId.localeCompare(right.proposalId)
  ));
  const autoReviewCount = candidates.filter((item) =>
    item.lane === "AUTO_ARBITRAGE_REVIEW"
  ).length;
  const count = (reason: SemanticReviewAdmissionReason) =>
    candidates.filter((item) => item.reason === reason).length;
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-review-admission-desk.v1" as const,
    policy: "TWO_DISTINCT_LISTINGS_AND_COMPILABLE_RELATION_V1" as const,
    candidateCount: candidates.length,
    autoReviewCount,
    researchOnlyCount: candidates.length - autoReviewCount,
    autoReviewRateBps: candidates.length === 0
      ? null
      : Math.floor(autoReviewCount * 10_000 / candidates.length),
    countsByReason: Object.freeze({
      TWO_LISTING_COMPILABLE_RELATION: count("TWO_LISTING_COMPILABLE_RELATION"),
      NON_COMPILABLE_RELATION: count("NON_COMPILABLE_RELATION"),
      LISTING_ARITY_UNSUPPORTED: count("LISTING_ARITY_UNSUPPORTED"),
      DUPLICATE_LISTING_REF: count("DUPLICATE_LISTING_REF"),
    }),
    candidates,
    supportedRelations: AUTOMATIC_REVIEW_RELATIONS,
    manualReviewAvailable: true as const,
    modelConfidenceUsed: false as const,
    authority: "AUTOMATIC_REVIEW_ADMISSION_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      modelCalls: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, contentHash: hashCanonical(body) });
}
