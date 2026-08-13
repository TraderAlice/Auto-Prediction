import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentTask } from "./agent-execution-substrate.js";
import type {
  ConsolidatedWorldStateMechanismRoute,
  WorldStateMechanismEvidenceBinding,
  WorldStateMechanismProposal,
} from "./world-state-mechanism.js";
import type { WorldStateMechanismSubjectBindingReview } from
  "./world-state-mechanism-observer.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type WorldStateSubjectBindingResearchInputRevision = Readonly<{
  schemaVersion: "pmh.world-state-subject-binding-research-input.v1";
  revisionId: Hash;
  caseId: Hash;
  routeFamilyId: Hash;
  routeId: Hash;
  sourceProposalIds: readonly Hash[];
  sourceAuthoringRunIds: readonly Hash[];
  candidateLabels: readonly string[];
  ambiguityNotes: readonly string[];
  triggerEvidenceBindings: readonly WorldStateMechanismEvidenceBinding[];
  dependentEvidenceBindings: readonly WorldStateMechanismEvidenceBinding[];
  counterScenarios: readonly string[];
  materializedAt: string;
  authority: "SUBJECT_BINDING_RESEARCH_INPUT_ONLY";
  semanticRelationAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateSubjectBindingEvidenceFinding = Readonly<{
  role: "TRIGGER" | "DEPENDENT" | "CROSS_ROLE";
  listingRefs: readonly string[];
  finding: string;
}>;

export type WorldStateSubjectBindingAssessment = Readonly<{
  schemaVersion: "pmh.world-state-subject-binding-assessment.v1";
  assessmentId: Hash;
  caseId: Hash;
  inputRevisionId: Hash;
  routeFamilyId: Hash;
  sourceProposalIds: readonly Hash[];
  sourceAgentRunId: Hash;
  recommendation: "APPROVE" | "REJECT";
  supportedLabels: readonly string[];
  rejectedLabels: readonly string[];
  evidenceFindings: readonly WorldStateSubjectBindingEvidenceFinding[];
  counterexamples: readonly string[];
  rationale: string;
  assessedAt: string;
  authority: "SUBJECT_BINDING_ASSESSMENT_EVIDENCE_ONLY";
  independentPromotionRequired: true;
  semanticRelationAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateSubjectBindingAbstention = Readonly<{
  schemaVersion: "pmh.world-state-subject-binding-abstention.v1";
  abstentionId: Hash;
  caseId: Hash;
  inputRevisionId: Hash;
  routeFamilyId: Hash;
  sourceProposalIds: readonly Hash[];
  sourceAgentRunId: Hash;
  evidenceFindings: readonly WorldStateSubjectBindingEvidenceFinding[];
  missingEvidence: readonly string[];
  counterexamples: readonly string[];
  rationale: string;
  assessedAt: string;
  authority: "EVIDENCE_BOUND_SUBJECT_BINDING_ABSTENTION_ONLY";
  independentPromotionRequired: true;
  semanticRelationAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldStateSubjectBindingResearchCase = Readonly<{
  schemaVersion: "pmh.world-state-subject-binding-research-case.v1";
  caseId: Hash;
  routeFamilyId: Hash;
  currentInputRevision: WorldStateSubjectBindingResearchInputRevision;
  task: AgentTask | null;
  assessmentIds: readonly Hash[];
  abstentionIds: readonly Hash[];
  reviewIds: readonly Hash[];
  state: "UNEXPLORED" | "ASSESSED" | "ABSTAINED" | "REVIEWED";
  campaignEligible: boolean;
  automaticDispatch: false;
  promotionAuthority: false;
  authority: "SUBJECT_BINDING_RESEARCH_CASE_ONLY";
  semanticRelationAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface WorldStateSubjectBindingResearchStore {
  readonly worldStateSubjectBindingResearchInputStorage:
    OperationalStorageProjection<"revisionId">;
  readonly worldStateSubjectBindingAssessmentStorage:
    OperationalStorageProjection<"assessmentId">;
  readonly worldStateSubjectBindingAbstentionStorage:
    OperationalStorageProjection<"abstentionId">;
  loadWorldStateSubjectBindingResearchInputs(
    limit: number,
  ): readonly WorldStateSubjectBindingResearchInputRevision[];
  saveWorldStateSubjectBindingResearchInputs(
    inputs: readonly WorldStateSubjectBindingResearchInputRevision[],
  ): readonly WorldStateSubjectBindingResearchInputRevision[];
  loadWorldStateSubjectBindingAssessments(
    limit: number,
  ): readonly WorldStateSubjectBindingAssessment[];
  saveWorldStateSubjectBindingAssessments(
    assessments: readonly WorldStateSubjectBindingAssessment[],
  ): readonly WorldStateSubjectBindingAssessment[];
  loadWorldStateSubjectBindingAbstentions(
    limit: number,
  ): readonly WorldStateSubjectBindingAbstention[];
  saveWorldStateSubjectBindingAbstentions(
    abstentions: readonly WorldStateSubjectBindingAbstention[],
  ): readonly WorldStateSubjectBindingAbstention[];
}

function canonicalText(value: string): string {
  return value.trim().replace(/\s+/gu, " ").normalize("NFKC")
    .toLocaleLowerCase("en-US");
}

function canonicalTexts(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map(canonicalText))].sort());
}

function canonicalIso(value: string, name: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`${name} must be a canonical ISO timestamp`);
  }
  return value;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" &&
    value === value.trim().replace(/\s+/gu, " ") && value.length <= maximum;
}

function sortedHashes(values: readonly Hash[], minimum = 1): readonly Hash[] {
  const result = [...new Set(values)].sort();
  if (result.length < minimum || result.some((item) => !HASH_PATTERN.test(item))) {
    throw new Error("subject-binding lineage hashes are invalid");
  }
  return Object.freeze(result);
}

function assertFinding(value: unknown): WorldStateSubjectBindingEvidenceFinding {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("subject-binding evidence finding is malformed");
  }
  const item = value as Readonly<Record<string, unknown>>;
  if (Object.keys(item).sort().join("\n") !== ["finding", "listingRefs", "role"].sort().join("\n") ||
      !["TRIGGER", "DEPENDENT", "CROSS_ROLE"].includes(String(item.role)) ||
      !Array.isArray(item.listingRefs) || item.listingRefs.length < 1 ||
      item.listingRefs.length > 8 || item.listingRefs.some((ref) =>
        typeof ref !== "string" || ref.trim() === ""
      ) || new Set(item.listingRefs).size !== item.listingRefs.length ||
      [...item.listingRefs].sort().join("\n") !== item.listingRefs.join("\n") ||
      !boundedText(item.finding, 1_000)) {
    throw new Error("subject-binding evidence finding is malformed");
  }
  return Object.freeze(item as WorldStateSubjectBindingEvidenceFinding);
}

function object(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} is malformed`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  name: string,
): void {
  if (Object.keys(value).sort().join("\n") !== [...expected].sort().join("\n")) {
    throw new Error(`${name} contains unknown or missing fields`);
  }
}

function assertEvidenceBinding(value: unknown): WorldStateMechanismEvidenceBinding {
  const item = object(value, "subject-binding evidence binding");
  exactKeys(item, [
    "listingRef", "title", "nodeId", "worldFacetId", "sourceRawHash",
    "protocolIdentity",
  ], "subject-binding evidence binding");
  if (![item.listingRef, item.title, item.protocolIdentity].every((field) =>
        boundedText(field, field === item.title ? 1_000 : 500)
      ) || ![item.nodeId, item.worldFacetId, item.sourceRawHash].every((field) =>
        typeof field === "string" && HASH_PATTERN.test(field)
      )) {
    throw new Error("subject-binding evidence binding is invalid");
  }
  return Object.freeze(item as unknown as WorldStateMechanismEvidenceBinding);
}

function validAuthorityBoundary(item: Readonly<Record<string, unknown>>): boolean {
  return item.independentPromotionRequired !== false &&
    item.semanticRelationAuthority === false && item.probabilityAuthority === false &&
    item.certificateAuthority === false && item.executionAuthority === false &&
    item.externalWriteAuthority === false && item.valueMovingAuthority === false;
}

export function assertWorldStateSubjectBindingResearchInput(
  value: unknown,
): WorldStateSubjectBindingResearchInputRevision {
  const item = object(value, "subject-binding research input");
  exactKeys(item, [
    "schemaVersion", "revisionId", "caseId", "routeFamilyId", "routeId",
    "sourceProposalIds", "sourceAuthoringRunIds", "candidateLabels",
    "ambiguityNotes", "triggerEvidenceBindings", "dependentEvidenceBindings",
    "counterScenarios", "materializedAt", "authority", "semanticRelationAuthority",
    "probabilityAuthority", "certificateAuthority", "executionAuthority",
    "externalWriteAuthority", "valueMovingAuthority",
  ], "subject-binding research input");
  const typed = item as unknown as WorldStateSubjectBindingResearchInputRevision;
  const { revisionId, ...body } = typed;
  const triggerEvidenceBindings = Array.isArray(typed.triggerEvidenceBindings)
    ? typed.triggerEvidenceBindings.map(assertEvidenceBinding) : [];
  const dependentEvidenceBindings = Array.isArray(typed.dependentEvidenceBindings)
    ? typed.dependentEvidenceBindings.map(assertEvidenceBinding) : [];
  if (typed.schemaVersion !== "pmh.world-state-subject-binding-research-input.v1" ||
      ![revisionId, typed.caseId, typed.routeFamilyId, typed.routeId].every((field) =>
        HASH_PATTERN.test(String(field))
      ) || revisionId !== hashCanonical(body) ||
      typed.caseId !== worldStateSubjectBindingResearchCaseIdentity(typed.routeFamilyId) ||
      sortedHashes(typed.sourceProposalIds).join("\n") !== typed.sourceProposalIds.join("\n") ||
      sortedHashes(typed.sourceAuthoringRunIds).join("\n") !==
        typed.sourceAuthoringRunIds.join("\n") ||
      !Array.isArray(typed.candidateLabels) || typed.candidateLabels.length < 1 ||
      typed.candidateLabels.length > 16 || typed.candidateLabels.some((label) =>
        label !== canonicalText(label)
      ) || !Array.isArray(typed.ambiguityNotes) || !Array.isArray(typed.counterScenarios) ||
      triggerEvidenceBindings.length < 1 || dependentEvidenceBindings.length < 1 ||
      canonicalIso(typed.materializedAt, "subject-binding input materializedAt") !==
        typed.materializedAt || typed.authority !== "SUBJECT_BINDING_RESEARCH_INPUT_ONLY" ||
      !validAuthorityBoundary(item)) {
    throw new Error("subject-binding research input is invalid");
  }
  return Object.freeze({ ...typed, triggerEvidenceBindings, dependentEvidenceBindings });
}

function assertResearchResult(
  value: unknown,
  kind: "assessment" | "abstention",
): WorldStateSubjectBindingAssessment | WorldStateSubjectBindingAbstention {
  const item = object(value, `subject-binding ${kind}`);
  const identityKey = kind === "assessment" ? "assessmentId" : "abstentionId";
  const kindKeys = kind === "assessment"
    ? ["recommendation", "supportedLabels", "rejectedLabels"]
    : ["missingEvidence"];
  exactKeys(item, [
    "schemaVersion", identityKey, "caseId", "inputRevisionId", "routeFamilyId",
    "sourceProposalIds", "sourceAgentRunId", ...kindKeys, "evidenceFindings",
    "counterexamples", "rationale", "assessedAt", "authority",
    "independentPromotionRequired", "semanticRelationAuthority", "probabilityAuthority",
    "certificateAuthority", "executionAuthority", "externalWriteAuthority",
    "valueMovingAuthority",
  ], `subject-binding ${kind}`);
  const identity = item[identityKey];
  const { [identityKey]: _identity, ...body } = item;
  const findings = Array.isArray(item.evidenceFindings)
    ? item.evidenceFindings.map(assertFinding) : [];
  const expectedSchema = kind === "assessment"
    ? "pmh.world-state-subject-binding-assessment.v1"
    : "pmh.world-state-subject-binding-abstention.v1";
  const expectedAuthority = kind === "assessment"
    ? "SUBJECT_BINDING_ASSESSMENT_EVIDENCE_ONLY"
    : "EVIDENCE_BOUND_SUBJECT_BINDING_ABSTENTION_ONLY";
  if (item.schemaVersion !== expectedSchema || typeof identity !== "string" ||
      !HASH_PATTERN.test(identity) || identity !== hashCanonical(body) ||
      ![item.caseId, item.inputRevisionId, item.routeFamilyId, item.sourceAgentRunId]
        .every((field) => typeof field === "string" && HASH_PATTERN.test(field)) ||
      item.caseId !== worldStateSubjectBindingResearchCaseIdentity(item.routeFamilyId as Hash) ||
      !Array.isArray(item.sourceProposalIds) ||
      sortedHashes(item.sourceProposalIds as Hash[]).join("\n") !==
        item.sourceProposalIds.join("\n") || findings.length < 1 || findings.length > 16 ||
      !Array.isArray(item.counterexamples) || item.counterexamples.length < 1 ||
      !boundedText(item.rationale, 2_000) ||
      canonicalIso(String(item.assessedAt), "subject-binding result assessedAt") !==
        item.assessedAt || item.authority !== expectedAuthority ||
      item.independentPromotionRequired !== true || !validAuthorityBoundary(item)) {
    throw new Error(`subject-binding ${kind} is invalid`);
  }
  if (kind === "assessment") {
    if (!["APPROVE", "REJECT"].includes(String(item.recommendation)) ||
        !Array.isArray(item.supportedLabels) || !Array.isArray(item.rejectedLabels)) {
      throw new Error("subject-binding assessment is invalid");
    }
    return Object.freeze({ ...item, evidenceFindings: findings }) as unknown as
      WorldStateSubjectBindingAssessment;
  }
  if (!Array.isArray(item.missingEvidence) || item.missingEvidence.length < 1 ||
      item.missingEvidence.length > 16) {
    throw new Error("subject-binding abstention is invalid");
  }
  return Object.freeze({ ...item, evidenceFindings: findings }) as unknown as
    WorldStateSubjectBindingAbstention;
}

export function assertWorldStateSubjectBindingAssessment(
  value: unknown,
): WorldStateSubjectBindingAssessment {
  return assertResearchResult(value, "assessment") as WorldStateSubjectBindingAssessment;
}

export function assertWorldStateSubjectBindingAbstention(
  value: unknown,
): WorldStateSubjectBindingAbstention {
  return assertResearchResult(value, "abstention") as WorldStateSubjectBindingAbstention;
}

function evidenceIdentity(binding: WorldStateMechanismEvidenceBinding): Hash {
  return hashCanonical({
    listingRef: binding.listingRef,
    nodeId: binding.nodeId,
    worldFacetId: binding.worldFacetId,
    sourceRawHash: binding.sourceRawHash,
    protocolIdentity: binding.protocolIdentity,
  });
}

export function worldStateSubjectBindingResearchCaseIdentity(routeFamilyId: Hash): Hash {
  if (!HASH_PATTERN.test(routeFamilyId)) throw new Error("route family identity is invalid");
  return hashCanonical({
    schemaVersion: "pmh.world-state-subject-binding-research-case-identity.v1",
    routeFamilyId,
  });
}

export function buildWorldStateSubjectBindingResearchInput(input: Readonly<{
  route: ConsolidatedWorldStateMechanismRoute;
  proposals: readonly WorldStateMechanismProposal[];
}>): WorldStateSubjectBindingResearchInputRevision {
  const proposals = input.proposals.filter((proposal) =>
    input.route.sourceProposalIds.includes(proposal.proposalId)
  );
  if (proposals.length !== input.route.sourceProposalIds.length) {
    throw new Error("subject-binding research input is missing exact proposals");
  }
  const caseId = worldStateSubjectBindingResearchCaseIdentity(input.route.routeFamilyId);
  const uniqueBindings = (values: readonly WorldStateMechanismEvidenceBinding[]) =>
    Object.freeze([...new Map(values.map((item) => [evidenceIdentity(item), item])).values()]
      .sort((left, right) => evidenceIdentity(left).localeCompare(evidenceIdentity(right))));
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-subject-binding-research-input.v1" as const,
    caseId,
    routeFamilyId: input.route.routeFamilyId,
    routeId: input.route.routeId,
    sourceProposalIds: input.route.sourceProposalIds,
    sourceAuthoringRunIds: input.route.sourceAgentRunIds,
    candidateLabels: input.route.canonicalRoute.canonicalSubjectLabels,
    ambiguityNotes: canonicalTexts(proposals.flatMap((item) => item.subjectAmbiguityNotes)),
    triggerEvidenceBindings: uniqueBindings(input.route.triggerEvidenceBindings),
    dependentEvidenceBindings: uniqueBindings(input.route.dependentEvidenceBindings),
    counterScenarios: canonicalTexts(input.route.counterScenarios),
    materializedAt: canonicalIso(
      input.route.lastProposedAt,
      "subject-binding input materializedAt",
    ),
    authority: "SUBJECT_BINDING_RESEARCH_INPUT_ONLY" as const,
    semanticRelationAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldStateSubjectBindingResearchInput(Object.freeze({
    ...body, revisionId: hashCanonical(body),
  }));
}

function buildResultBody(input: Readonly<{
  researchInput: WorldStateSubjectBindingResearchInputRevision;
  sourceAgentRunId: Hash;
  evidenceFindings: readonly WorldStateSubjectBindingEvidenceFinding[];
  counterexamples: readonly string[];
  rationale: string;
  assessedAt: string;
}>) {
  if (!HASH_PATTERN.test(input.sourceAgentRunId) || input.evidenceFindings.length < 1 ||
      input.evidenceFindings.length > 16 || input.counterexamples.length < 1 ||
      input.counterexamples.length > 16 || !boundedText(input.rationale, 2_000)) {
    throw new Error("subject-binding research result is invalid");
  }
  const allowedRefs = new Set([
    ...input.researchInput.triggerEvidenceBindings,
    ...input.researchInput.dependentEvidenceBindings,
  ].map((item) => item.listingRef));
  const findings = Object.freeze(input.evidenceFindings.map(assertFinding));
  if (findings.some((item) => item.listingRefs.some((ref) => !allowedRefs.has(ref)))) {
    throw new Error("subject-binding finding is outside exact input evidence");
  }
  return Object.freeze({
    caseId: input.researchInput.caseId,
    inputRevisionId: input.researchInput.revisionId,
    routeFamilyId: input.researchInput.routeFamilyId,
    sourceProposalIds: input.researchInput.sourceProposalIds,
    sourceAgentRunId: input.sourceAgentRunId,
    evidenceFindings: findings,
    counterexamples: canonicalTexts(input.counterexamples),
    rationale: input.rationale,
    assessedAt: canonicalIso(input.assessedAt, "subject-binding result assessedAt"),
  });
}

export function buildWorldStateSubjectBindingAssessment(input: Readonly<{
  researchInput: WorldStateSubjectBindingResearchInputRevision;
  sourceAgentRunId: Hash;
  recommendation: "APPROVE" | "REJECT";
  supportedLabels: readonly string[];
  rejectedLabels: readonly string[];
  evidenceFindings: readonly WorldStateSubjectBindingEvidenceFinding[];
  counterexamples: readonly string[];
  rationale: string;
  assessedAt: string;
}>): WorldStateSubjectBindingAssessment {
  const shared = buildResultBody(input);
  const supportedLabels = canonicalTexts(input.supportedLabels);
  const rejectedLabels = canonicalTexts(input.rejectedLabels);
  const candidates = new Set(input.researchInput.candidateLabels);
  if (supportedLabels.some((item) => !candidates.has(item)) ||
      rejectedLabels.some((item) => !candidates.has(item)) ||
      supportedLabels.some((item) => rejectedLabels.includes(item)) ||
      (input.recommendation === "APPROVE" && supportedLabels.length < 1) ||
      (input.recommendation === "REJECT" && rejectedLabels.length < 1)) {
    throw new Error("subject-binding assessment labels are invalid");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-subject-binding-assessment.v1" as const,
    ...shared,
    recommendation: input.recommendation,
    supportedLabels,
    rejectedLabels,
    authority: "SUBJECT_BINDING_ASSESSMENT_EVIDENCE_ONLY" as const,
    independentPromotionRequired: true as const,
    semanticRelationAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldStateSubjectBindingAssessment(Object.freeze({
    ...body, assessmentId: hashCanonical(body),
  }));
}

export function buildWorldStateSubjectBindingAbstention(input: Readonly<{
  researchInput: WorldStateSubjectBindingResearchInputRevision;
  sourceAgentRunId: Hash;
  evidenceFindings: readonly WorldStateSubjectBindingEvidenceFinding[];
  missingEvidence: readonly string[];
  counterexamples: readonly string[];
  rationale: string;
  assessedAt: string;
}>): WorldStateSubjectBindingAbstention {
  const shared = buildResultBody(input);
  const missingEvidence = canonicalTexts(input.missingEvidence);
  if (missingEvidence.length < 1 || missingEvidence.length > 16) {
    throw new Error("subject-binding abstention requires bounded missing evidence");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-state-subject-binding-abstention.v1" as const,
    ...shared,
    missingEvidence,
    authority: "EVIDENCE_BOUND_SUBJECT_BINDING_ABSTENTION_ONLY" as const,
    independentPromotionRequired: true as const,
    semanticRelationAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertWorldStateSubjectBindingAbstention(Object.freeze({
    ...body, abstentionId: hashCanonical(body),
  }));
}

export function materializeWorldStateSubjectBindingResearchCases(input: Readonly<{
  routes: readonly ConsolidatedWorldStateMechanismRoute[];
  proposals: readonly WorldStateMechanismProposal[];
  assessments: readonly WorldStateSubjectBindingAssessment[];
  abstentions: readonly WorldStateSubjectBindingAbstention[];
  reviews: readonly WorldStateMechanismSubjectBindingReview[];
}>): readonly WorldStateSubjectBindingResearchCase[] {
  return Object.freeze(input.routes.map((route) => {
    const currentInputRevision = buildWorldStateSubjectBindingResearchInput({
      route, proposals: input.proposals,
    });
    const assessments = input.assessments.filter((item) => item.caseId ===
      currentInputRevision.caseId);
    const abstentions = input.abstentions.filter((item) => item.caseId ===
      currentInputRevision.caseId);
    const reviews = input.reviews.filter((item) => item.routeFamilyId === route.routeFamilyId);
    const state = reviews.length > 0 ? "REVIEWED" as const
      : assessments.length > 0 ? "ASSESSED" as const
      : abstentions.length > 0 ? "ABSTAINED" as const
      : "UNEXPLORED" as const;
    return Object.freeze({
      schemaVersion: "pmh.world-state-subject-binding-research-case.v1" as const,
      caseId: currentInputRevision.caseId,
      routeFamilyId: route.routeFamilyId,
      currentInputRevision,
      task: null,
      assessmentIds: sortedHashes(assessments.map((item) => item.assessmentId), 0),
      abstentionIds: sortedHashes(abstentions.map((item) => item.abstentionId), 0),
      reviewIds: sortedHashes(reviews.map((item) => item.reviewId), 0),
      state,
      campaignEligible: state === "UNEXPLORED",
      automaticDispatch: false as const,
      promotionAuthority: false as const,
      authority: "SUBJECT_BINDING_RESEARCH_CASE_ONLY" as const,
      semanticRelationAuthority: false as const,
      probabilityAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      externalWriteAuthority: false as const,
      valueMovingAuthority: false as const,
    });
  }).sort((left, right) => left.caseId.localeCompare(right.caseId)));
}
