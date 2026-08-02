import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProposalEvidenceBundle,
  type DurableProposalEvidenceBundle,
} from "./market-archaeologist.js";
import {
  assertRuleEvidenceClaim,
  type RuleEvidenceClaim,
} from "./rule-evidence-claim.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_CLAIMS = 100;
const SCOPE_KEYS = Object.freeze([
  "artifactHash", "authority", "baseEvidenceBundleId", "certificateAuthority",
  "claimBindings", "claimSetIdentity", "executionAuthority", "modelConfidenceUsed",
  "productionReviewAuthority", "proposalCorpusSnapshotIdentity", "proposalId",
  "schemaVersion", "scopeIdentity", "semanticDecisionAuthority", "status",
]);
const BINDING_KEYS = Object.freeze([
  "claimArtifactHash", "claimId", "disposition", "documentId", "extractionId",
  "requirementId",
]);

export type EvidenceEnrichedSemanticScope = Readonly<{
  schemaVersion: "pmh.evidence-enriched-semantic-scope.v1";
  scopeIdentity: Hash;
  proposalId: Hash;
  proposalCorpusSnapshotIdentity: Hash;
  baseEvidenceBundleId: Hash;
  claimSetIdentity: Hash;
  claimBindings: readonly Readonly<{
    requirementId: Hash;
    claimId: Hash;
    claimArtifactHash: Hash;
    documentId: Hash;
    extractionId: Hash;
    disposition: RuleEvidenceClaim["disposition"];
  }>[];
  status: "EVIDENCE_ENRICHED";
  authority: "SEMANTIC_REVIEW_INPUT_ONLY";
  modelConfidenceUsed: false;
  semanticDecisionAuthority: false;
  productionReviewAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === keys.join("\n");
}

function withoutHash(
  scope: EvidenceEnrichedSemanticScope,
): Omit<EvidenceEnrichedSemanticScope, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = scope;
  return body;
}

function claimBindings(claimsInput: readonly RuleEvidenceClaim[]) {
  if (claimsInput.length < 1 || claimsInput.length > MAX_CLAIMS) {
    throw new Error("evidence-enriched semantic scope claim set is empty or unbounded");
  }
  const claims = claimsInput.map(assertRuleEvidenceClaim).sort((left, right) =>
    left.requirementId.localeCompare(right.requirementId) ||
    left.claimId.localeCompare(right.claimId)
  );
  if (new Set(claims.map((claim) => claim.requirementId)).size !== claims.length) {
    throw new Error("evidence-enriched semantic scope has multiple current claims per requirement");
  }
  return Object.freeze(claims.map((claim) => Object.freeze({
    requirementId: claim.requirementId,
    claimId: claim.claimId,
    claimArtifactHash: claim.artifactHash,
    documentId: claim.documentId,
    extractionId: claim.extractionId,
    disposition: claim.disposition,
  })));
}

export function buildEvidenceEnrichedSemanticScope(input: Readonly<{
  evidenceBundle: DurableProposalEvidenceBundle;
  claims: readonly RuleEvidenceClaim[];
}>): EvidenceEnrichedSemanticScope {
  const bundle = assertProposalEvidenceBundle(input.evidenceBundle);
  if (bundle.schemaVersion !== "pmh.proposal-evidence-bundle.v2") {
    throw new Error("evidence enrichment requires a durable proposal evidence bundle");
  }
  const bindings = claimBindings(input.claims);
  if (input.claims.some((claim) => claim.proposalId !== bundle.proposalId)) {
    throw new Error("evidence-enriched semantic scope claim belongs to another proposal");
  }
  const claimSetIdentity = hashCanonical({
    schemaVersion: "pmh.rule-evidence-claim-set.v1",
    proposalId: bundle.proposalId,
    claims: bindings,
  });
  const scopeIdentity = hashCanonical({
    schemaVersion: "pmh.evidence-enriched-semantic-scope-identity.v1",
    proposalId: bundle.proposalId,
    proposalCorpusSnapshotIdentity: bundle.proposalCorpusSnapshotIdentity,
    baseEvidenceBundleId: bundle.bundleId,
    claimSetIdentity,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.evidence-enriched-semantic-scope.v1" as const,
    scopeIdentity,
    proposalId: bundle.proposalId,
    proposalCorpusSnapshotIdentity: bundle.proposalCorpusSnapshotIdentity,
    baseEvidenceBundleId: bundle.bundleId,
    claimSetIdentity,
    claimBindings: bindings,
    status: "EVIDENCE_ENRICHED" as const,
    authority: "SEMANTIC_REVIEW_INPUT_ONLY" as const,
    modelConfidenceUsed: false as const,
    semanticDecisionAuthority: false as const,
    productionReviewAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertEvidenceEnrichedSemanticScope(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function assertEvidenceEnrichedSemanticScope(
  value: unknown,
): EvidenceEnrichedSemanticScope {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("evidence-enriched semantic scope is malformed");
  }
  const scope = value as EvidenceEnrichedSemanticScope;
  if (
    !exactKeys(scope, SCOPE_KEYS) ||
    scope.schemaVersion !== "pmh.evidence-enriched-semantic-scope.v1" ||
    !HASH_PATTERN.test(String(scope.scopeIdentity)) ||
    !HASH_PATTERN.test(String(scope.proposalId)) ||
    !HASH_PATTERN.test(String(scope.proposalCorpusSnapshotIdentity)) ||
    !HASH_PATTERN.test(String(scope.baseEvidenceBundleId)) ||
    !HASH_PATTERN.test(String(scope.claimSetIdentity)) ||
    !Array.isArray(scope.claimBindings) || scope.claimBindings.length < 1 ||
    scope.claimBindings.length > MAX_CLAIMS ||
    new Set(scope.claimBindings.map((binding) => binding.requirementId)).size !==
      scope.claimBindings.length ||
    scope.claimBindings.some((binding, index) =>
      !exactKeys(binding, BINDING_KEYS) ||
      !HASH_PATTERN.test(String(binding.requirementId)) ||
      !HASH_PATTERN.test(String(binding.claimId)) ||
      !HASH_PATTERN.test(String(binding.claimArtifactHash)) ||
      !HASH_PATTERN.test(String(binding.documentId)) ||
      !HASH_PATTERN.test(String(binding.extractionId)) ||
      !["SUPPORTS", "CONTRADICTS", "INCONCLUSIVE"].includes(binding.disposition) ||
      (index > 0 && binding.requirementId <= scope.claimBindings[index - 1]!.requirementId)
    ) ||
    scope.claimSetIdentity !== hashCanonical({
      schemaVersion: "pmh.rule-evidence-claim-set.v1",
      proposalId: scope.proposalId,
      claims: scope.claimBindings,
    }) ||
    scope.scopeIdentity !== hashCanonical({
      schemaVersion: "pmh.evidence-enriched-semantic-scope-identity.v1",
      proposalId: scope.proposalId,
      proposalCorpusSnapshotIdentity: scope.proposalCorpusSnapshotIdentity,
      baseEvidenceBundleId: scope.baseEvidenceBundleId,
      claimSetIdentity: scope.claimSetIdentity,
    }) ||
    scope.status !== "EVIDENCE_ENRICHED" ||
    scope.authority !== "SEMANTIC_REVIEW_INPUT_ONLY" ||
    scope.modelConfidenceUsed !== false || scope.semanticDecisionAuthority !== false ||
    scope.productionReviewAuthority !== false || scope.certificateAuthority !== false ||
    scope.executionAuthority !== false ||
    !HASH_PATTERN.test(String(scope.artifactHash)) ||
    scope.artifactHash !== hashCanonical(withoutHash(scope))
  ) throw new Error("evidence-enriched semantic scope violates its lineage contract");
  return Object.freeze(scope);
}
