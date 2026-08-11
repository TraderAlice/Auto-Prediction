import { hashCanonical, type Hash } from "@pmh/domain";
import type { ProbabilityCaseRepairItem } from "./probability-case-challenge-queue.js";
import {
  assertProbabilityAdverseStateInterpretation,
  type ProbabilityAdverseStateInterpretation,
} from "./probability-case-integrity.js";
import {
  assertSemanticConstraintArtifact,
  type SemanticConstraintArtifact,
} from "./semantic-constraint.js";
import type {
  ProbabilityCaseChallengeKind,
  ProbabilityEstimatorRole,
} from "./probability-estimation-agent.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const MAX_AUTOMATIC_SEMANTIC_REPAIR_GENERATIONS = 3;

export type ProbabilitySemanticRepairAdmission =
  | "AUTOMATIC_MULTI_ROLE"
  | "MANUAL_SINGLE_ROLE"
  | "MANUAL_GENERATION_LIMIT";

export type ProbabilitySemanticRepairRequest = Readonly<{
  schemaVersion: "pmh.probability-semantic-repair-request.v1";
  requestId: Hash;
  repairId: Hash;
  generation: number;
  parentRepairRequestId: Hash | null;
  admission: ProbabilitySemanticRepairAdmission;
  sourceReviewId: Hash;
  sourceSemanticReviewArtifactHash: Hash;
  sourceSemanticConstraint: SemanticConstraintArtifact;
  adverseStateInterpretation: ProbabilityAdverseStateInterpretation;
  kind: ProbabilityCaseChallengeKind;
  stateIds: readonly string[];
  listingRefs: readonly string[];
  explanationVariants: readonly string[];
  expectedInterpretations: readonly string[];
  observedConflicts: readonly string[];
  evidenceHashes: readonly Hash[];
  challengeIds: readonly Hash[];
  runIds: readonly Hash[];
  roles: readonly ProbabilityEstimatorRole[];
  engines: readonly string[];
  authority: "SEMANTIC_REVIEW_INPUT_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  executionAuthority: false;
}>;

function boundedTextArray(
  value: unknown,
  minimum: number,
  maximum: number,
  maximumLength: number,
): value is readonly string[] {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum &&
    value.every((item) =>
      typeof item === "string" && item.trim() !== "" && item.length <= maximumLength
    );
}

function bodyWithoutId(
  request: ProbabilitySemanticRepairRequest,
): Omit<ProbabilitySemanticRepairRequest, "requestId"> {
  const { requestId: _requestId, ...body } = request;
  return body;
}

export function assertProbabilitySemanticRepairRequest(
  value: unknown,
): ProbabilitySemanticRepairRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probability semantic repair request is malformed");
  }
  const request = value as ProbabilitySemanticRepairRequest;
  const constraint = assertSemanticConstraintArtifact(request.sourceSemanticConstraint);
  const interpretation = assertProbabilityAdverseStateInterpretation(
    request.adverseStateInterpretation,
  );
  const expectedAdmission: ProbabilitySemanticRepairAdmission = request.generation >
      MAX_AUTOMATIC_SEMANTIC_REPAIR_GENERATIONS
    ? "MANUAL_GENERATION_LIMIT"
    : request.roles.length < 2
      ? "MANUAL_SINGLE_ROLE"
      : "AUTOMATIC_MULTI_ROLE";
  if (
    request.schemaVersion !== "pmh.probability-semantic-repair-request.v1" ||
    !HASH_PATTERN.test(String(request.requestId)) ||
    request.requestId !== hashCanonical(bodyWithoutId(request)) ||
    !HASH_PATTERN.test(String(request.repairId)) ||
    !Number.isSafeInteger(request.generation) || request.generation < 1 ||
    request.generation > MAX_AUTOMATIC_SEMANTIC_REPAIR_GENERATIONS + 1 ||
    (request.generation === 1) !== (request.parentRepairRequestId === null) ||
    (request.parentRepairRequestId !== null &&
      !HASH_PATTERN.test(String(request.parentRepairRequestId))) ||
    request.admission !== expectedAdmission ||
    !HASH_PATTERN.test(String(request.sourceReviewId)) ||
    !HASH_PATTERN.test(String(request.sourceSemanticReviewArtifactHash)) ||
    constraint.proposalId !== interpretation.proposalId ||
    constraint.artifactHash !== interpretation.semanticConstraintArtifactHash ||
    request.listingRefs.join("\n") !== constraint.listingRefs.join("\n") ||
    request.listingRefs.join("\n") !== interpretation.listingRefs.join("\n") ||
    request.stateIds.join("\n") !== interpretation.adverseStateIds.join("\n") ||
    !boundedTextArray(request.explanationVariants, 1, 8, 2_000) ||
    !boundedTextArray(request.expectedInterpretations, 1, 8, 2_000) ||
    !boundedTextArray(request.observedConflicts, 1, 8, 2_000) ||
    !boundedTextArray(request.engines, 1, 8, 200) ||
    !Array.isArray(request.evidenceHashes) || request.evidenceHashes.length < 1 ||
    request.evidenceHashes.length > 40 ||
    request.evidenceHashes.some((item) => !HASH_PATTERN.test(String(item))) ||
    !Array.isArray(request.challengeIds) || request.challengeIds.length < 1 ||
    request.challengeIds.length > 8 ||
    request.challengeIds.some((item) => !HASH_PATTERN.test(String(item))) ||
    !Array.isArray(request.runIds) || request.runIds.length !== request.challengeIds.length ||
    request.runIds.some((item) => !HASH_PATTERN.test(String(item))) ||
    !Array.isArray(request.roles) || request.roles.length < 1 || request.roles.length > 3 ||
    new Set(request.roles).size !== request.roles.length ||
    request.roles.join("\n") !== [...request.roles].sort().join("\n") ||
    request.authority !== "SEMANTIC_REVIEW_INPUT_ONLY" ||
    request.providerRequestAuthority !== false ||
    request.semanticDecisionAuthority !== false ||
    request.probabilityCertificateAuthority !== false ||
    request.executionAuthority !== false
  ) throw new Error("probability semantic repair request violates its bounded contract");
  return Object.freeze(request);
}

export function buildProbabilitySemanticRepairRequest(input: Readonly<{
  item: ProbabilityCaseRepairItem;
  sourceReviewId: Hash;
  sourceSemanticConstraint: SemanticConstraintArtifact;
  parentRepairRequest?: ProbabilitySemanticRepairRequest | null;
}>): ProbabilitySemanticRepairRequest {
  const constraint = assertSemanticConstraintArtifact(input.sourceSemanticConstraint);
  const interpretation = assertProbabilityAdverseStateInterpretation(
    input.item.adverseStateInterpretation,
  );
  const parent = input.parentRepairRequest === undefined ||
      input.parentRepairRequest === null
    ? null
    : assertProbabilitySemanticRepairRequest(input.parentRepairRequest);
  const generation = (parent?.generation ?? 0) + 1;
  const allowedEvidence = new Set(constraint.ruleEvidence.flatMap((item) =>
    [item.listingHash, item.sourceRawHash]
  ));
  if (
    !HASH_PATTERN.test(String(input.sourceReviewId)) ||
    !HASH_PATTERN.test(String(input.item.sourceSemanticReviewArtifactHash)) ||
    input.item.proposalId !== constraint.proposalId ||
    input.item.semanticConstraintArtifactHash !== constraint.artifactHash ||
    input.item.interpretationArtifactHash !== interpretation.artifactHash ||
    input.item.listingRefs.join("\n") !== constraint.listingRefs.join("\n") ||
    input.item.stateIds.join("\n") !== interpretation.adverseStateIds.join("\n") ||
    input.item.evidenceHashes.some((hash) => !allowedEvidence.has(hash)) ||
    (parent !== null && (
      parent.sourceSemanticConstraint.proposalId !== constraint.proposalId ||
      parent.sourceReviewId === input.sourceReviewId ||
      parent.sourceSemanticReviewArtifactHash === input.item.sourceSemanticReviewArtifactHash
    )) ||
    generation > MAX_AUTOMATIC_SEMANTIC_REPAIR_GENERATIONS + 1
  ) throw new Error("probability semantic repair input lineage is inconsistent");
  const roles = Object.freeze([...input.item.roles].sort()) as
    readonly ProbabilityEstimatorRole[];
  const body = Object.freeze({
    schemaVersion: "pmh.probability-semantic-repair-request.v1" as const,
    repairId: input.item.repairId,
    generation,
    parentRepairRequestId: parent?.requestId ?? null,
    admission: generation > MAX_AUTOMATIC_SEMANTIC_REPAIR_GENERATIONS
      ? "MANUAL_GENERATION_LIMIT" as const
      : roles.length < 2
        ? "MANUAL_SINGLE_ROLE" as const
        : "AUTOMATIC_MULTI_ROLE" as const,
    sourceReviewId: input.sourceReviewId,
    sourceSemanticReviewArtifactHash: input.item.sourceSemanticReviewArtifactHash,
    sourceSemanticConstraint: constraint,
    adverseStateInterpretation: interpretation,
    kind: input.item.kind,
    stateIds: Object.freeze([...input.item.stateIds]),
    listingRefs: Object.freeze([...input.item.listingRefs]),
    explanationVariants: Object.freeze([...input.item.explanationVariants].sort()),
    expectedInterpretations: Object.freeze([...input.item.expectedInterpretations].sort()),
    observedConflicts: Object.freeze([...input.item.observedConflicts].sort()),
    evidenceHashes: Object.freeze([...input.item.evidenceHashes].sort()) as readonly Hash[],
    challengeIds: Object.freeze([...input.item.challengeIds].sort()) as readonly Hash[],
    runIds: Object.freeze([...input.item.runIds].sort()) as readonly Hash[],
    roles,
    engines: Object.freeze([...input.item.engines].sort()),
    authority: "SEMANTIC_REVIEW_INPUT_ONLY" as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityCertificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertProbabilitySemanticRepairRequest(Object.freeze({
    ...body,
    requestId: hashCanonical(body),
  }));
}
