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

export const AUTOMATIC_REVIEW_RELATIONS = Object.freeze([
  "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE",
  "CONDITIONAL", "RELATED", "CONFLICTING",
] as const satisfies readonly MarketRelationKind[]);

export type AutomaticReviewRelation = (typeof AUTOMATIC_REVIEW_RELATIONS)[number];

export type SemanticReviewAdmissionReason =
  | "TWO_LISTING_COMPILABLE_RELATION"
  | "PREMISE_AUDIT_REQUIRED"
  | "NON_COMPILABLE_RELATION"
  | "LISTING_ARITY_UNSUPPORTED"
  | "DUPLICATE_LISTING_REF";

export type SemanticReviewAdmissionRecord = Readonly<{
  schemaVersion: "pmh.semantic-review-admission.v1" | "pmh.semantic-review-admission.v2";
  proposalId: Hash;
  relationKind: MarketRelationKind;
  listingRefs: readonly string[];
  lane: "AUTO_ARBITRAGE_REVIEW" | "AUTO_PREMISE_REVIEW" | "RESEARCH_ONLY";
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
  schemaVersion: "pmh.semantic-review-admission-desk.v1" | "pmh.semantic-review-admission-desk.v2";
  policy:
    | "TWO_DISTINCT_LISTINGS_AND_COMPILABLE_RELATION_V1"
    | "TWO_TO_FOUR_DISTINCT_LISTINGS_WITH_PREMISE_LANE_V2";
  candidateCount: number;
  autoReviewCount: number;
  premiseReviewCount: number;
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
    !["pmh.semantic-review-admission.v1", "pmh.semantic-review-admission.v2"]
      .includes(record.schemaVersion) ||
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
    !["AUTO_ARBITRAGE_REVIEW", "AUTO_PREMISE_REVIEW", "RESEARCH_ONLY"]
      .includes(record.lane) ||
    ![
      "TWO_LISTING_COMPILABLE_RELATION", "NON_COMPILABLE_RELATION",
      "PREMISE_AUDIT_REQUIRED", "LISTING_ARITY_UNSUPPORTED", "DUPLICATE_LISTING_REF",
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
  const unique = new Set(record.listingRefs).size === record.listingRefs.length;
  const direct = record.listingRefs.length === 2 && unique &&
    COMPILABLE_RELATIONS.includes(record.relationKind as CompilableRelation);
  const premise = record.schemaVersion === "pmh.semantic-review-admission.v2" &&
    record.listingRefs.length >= 2 && record.listingRefs.length <= 4 && unique && !direct;
  if (
    (record.schemaVersion === "pmh.semantic-review-admission.v1" &&
      (record.lane === "AUTO_PREMISE_REVIEW" ||
        record.reason === "PREMISE_AUDIT_REQUIRED")) ||
    (record.lane === "AUTO_ARBITRAGE_REVIEW") !== direct ||
    (record.lane === "AUTO_PREMISE_REVIEW") !== premise ||
    (record.reason === "TWO_LISTING_COMPILABLE_RELATION") !== direct ||
    (record.reason === "PREMISE_AUDIT_REQUIRED") !== premise ||
    (record.lane === "RESEARCH_ONLY") !== (!direct && !premise)
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
  const direct = proposal.listingRefs.length === 2 &&
    COMPILABLE_RELATIONS.includes(proposal.relationKind as CompilableRelation);
  const reason: SemanticReviewAdmissionReason = uniqueCount !== proposal.listingRefs.length
    ? "DUPLICATE_LISTING_REF"
    : proposal.listingRefs.length < 2 || proposal.listingRefs.length > 4
      ? "LISTING_ARITY_UNSUPPORTED"
      : direct
        ? "TWO_LISTING_COMPILABLE_RELATION"
        : "PREMISE_AUDIT_REQUIRED";
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-review-admission.v2" as const,
    proposalId: proposal.proposalId,
    relationKind: proposal.relationKind,
    listingRefs: Object.freeze([...proposal.listingRefs]),
    lane: reason === "TWO_LISTING_COMPILABLE_RELATION"
      ? ("AUTO_ARBITRAGE_REVIEW" as const)
      : reason === "PREMISE_AUDIT_REQUIRED"
        ? ("AUTO_PREMISE_REVIEW" as const)
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
  return classifySemanticReviewAdmission(proposal).lane !== "RESEARCH_ONLY";
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
    Number(right.lane !== "RESEARCH_ONLY") - Number(left.lane !== "RESEARCH_ONLY") ||
    left.reason.localeCompare(right.reason) ||
    left.proposalId.localeCompare(right.proposalId)
  ));
  const autoReviewCount = candidates.filter((item) =>
    item.lane !== "RESEARCH_ONLY"
  ).length;
  const premiseReviewCount = candidates.filter((item) =>
    item.lane === "AUTO_PREMISE_REVIEW"
  ).length;
  const count = (reason: SemanticReviewAdmissionReason) =>
    candidates.filter((item) => item.reason === reason).length;
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-review-admission-desk.v2" as const,
    policy: "TWO_TO_FOUR_DISTINCT_LISTINGS_WITH_PREMISE_LANE_V2" as const,
    candidateCount: candidates.length,
    autoReviewCount,
    premiseReviewCount,
    researchOnlyCount: candidates.length - autoReviewCount,
    autoReviewRateBps: candidates.length === 0
      ? null
      : Math.floor(autoReviewCount * 10_000 / candidates.length),
    countsByReason: Object.freeze({
      TWO_LISTING_COMPILABLE_RELATION: count("TWO_LISTING_COMPILABLE_RELATION"),
      PREMISE_AUDIT_REQUIRED: count("PREMISE_AUDIT_REQUIRED"),
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
