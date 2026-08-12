import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProposalEvidenceBundle,
  type DurableProposalEvidenceBundle,
} from "./market-archaeologist.js";
import {
  assertRuleEvidenceClaim,
  type DocumentRuleEvidenceClaim,
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
const DOCUMENT_BINDING_KEYS = Object.freeze([
  "claimArtifactHash", "claimId", "disposition", "documentId", "extractionId",
  "requirementId",
]);
const SOURCE_BINDING_KEYS = Object.freeze([
  "claimArtifactHash", "claimId", "disposition", "requirementId",
  "sourceArtifactId", "sourceKind", "textArtifactId",
]);

type DocumentClaimBinding = Readonly<{
  requirementId: Hash;
  claimId: Hash;
  claimArtifactHash: Hash;
  documentId: Hash;
  extractionId: Hash;
  disposition: RuleEvidenceClaim["disposition"];
}>;

type SourceClaimBinding = Readonly<{
  requirementId: Hash;
  claimId: Hash;
  claimArtifactHash: Hash;
  sourceKind: "DOCUMENT_EXTRACTION" | "CATALOG_CONTRACT_TEXT";
  sourceArtifactId: Hash;
  textArtifactId: Hash;
  disposition: RuleEvidenceClaim["disposition"];
}>;

type EvidenceEnrichedSemanticScopeFields = Readonly<{
  scopeIdentity: Hash;
  proposalId: Hash;
  proposalCorpusSnapshotIdentity: Hash;
  baseEvidenceBundleId: Hash;
  claimSetIdentity: Hash;
  status: "EVIDENCE_ENRICHED";
  authority: "SEMANTIC_REVIEW_INPUT_ONLY";
  modelConfidenceUsed: false;
  semanticDecisionAuthority: false;
  productionReviewAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

export type EvidenceEnrichedSemanticScope =
  | (EvidenceEnrichedSemanticScopeFields & Readonly<{
      schemaVersion: "pmh.evidence-enriched-semantic-scope.v1";
      claimBindings: readonly DocumentClaimBinding[];
    }>)
  | (EvidenceEnrichedSemanticScopeFields & Readonly<{
      schemaVersion: "pmh.evidence-enriched-semantic-scope.v2";
      claimBindings: readonly SourceClaimBinding[];
    }>);

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === keys.join("\n");
}

function withoutHash(scope: EvidenceEnrichedSemanticScope): object {
  const { artifactHash: _artifactHash, ...body } = scope;
  return body;
}

function sortedClaims(claimsInput: readonly RuleEvidenceClaim[]) {
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
  return claims;
}

function documentClaimBindings(
  claims: readonly DocumentRuleEvidenceClaim[],
): readonly DocumentClaimBinding[] {
  return Object.freeze(claims.map((claim) => Object.freeze({
    requirementId: claim.requirementId,
    claimId: claim.claimId,
    claimArtifactHash: claim.artifactHash,
    documentId: claim.documentId,
    extractionId: claim.extractionId,
    disposition: claim.disposition,
  })));
}

function sourceClaimBindings(
  claims: readonly RuleEvidenceClaim[],
): readonly SourceClaimBinding[] {
  return Object.freeze(claims.map((claim) => Object.freeze({
    requirementId: claim.requirementId,
    claimId: claim.claimId,
    claimArtifactHash: claim.artifactHash,
    sourceKind: claim.schemaVersion === "pmh.rule-evidence-claim.v3"
      ? claim.sourceKind
      : "DOCUMENT_EXTRACTION" as const,
    sourceArtifactId: claim.schemaVersion === "pmh.rule-evidence-claim.v3"
      ? claim.sourceArtifactId
      : claim.documentId,
    textArtifactId: claim.schemaVersion === "pmh.rule-evidence-claim.v3"
      ? claim.textArtifactId
      : claim.extractionId,
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
  const claims = sortedClaims(input.claims);
  if (claims.some((claim) => claim.proposalId !== bundle.proposalId)) {
    throw new Error("evidence-enriched semantic scope claim belongs to another proposal");
  }
  const hasCatalogClaim = claims.some(
    (claim) => claim.schemaVersion === "pmh.rule-evidence-claim.v3",
  );
  const bindings = hasCatalogClaim
    ? sourceClaimBindings(claims)
    : documentClaimBindings(claims as readonly DocumentRuleEvidenceClaim[]);
  const claimSetIdentity = hashCanonical({
    schemaVersion: hasCatalogClaim
      ? "pmh.rule-evidence-claim-set.v2"
      : "pmh.rule-evidence-claim-set.v1",
    proposalId: bundle.proposalId,
    claims: bindings,
  });
  const scopeIdentity = hashCanonical({
    schemaVersion: hasCatalogClaim
      ? "pmh.evidence-enriched-semantic-scope-identity.v2"
      : "pmh.evidence-enriched-semantic-scope-identity.v1",
    proposalId: bundle.proposalId,
    proposalCorpusSnapshotIdentity: bundle.proposalCorpusSnapshotIdentity,
    baseEvidenceBundleId: bundle.bundleId,
    claimSetIdentity,
  });
  const body = Object.freeze({
    schemaVersion: hasCatalogClaim
      ? "pmh.evidence-enriched-semantic-scope.v2" as const
      : "pmh.evidence-enriched-semantic-scope.v1" as const,
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
  const isDocumentScope =
    scope.schemaVersion === "pmh.evidence-enriched-semantic-scope.v1";
  const isSourceScope =
    scope.schemaVersion === "pmh.evidence-enriched-semantic-scope.v2";
  const bindingKeys = isDocumentScope ? DOCUMENT_BINDING_KEYS : SOURCE_BINDING_KEYS;
  const claimSetSchema = isDocumentScope
    ? "pmh.rule-evidence-claim-set.v1"
    : "pmh.rule-evidence-claim-set.v2";
  const identitySchema = isDocumentScope
    ? "pmh.evidence-enriched-semantic-scope-identity.v1"
    : "pmh.evidence-enriched-semantic-scope-identity.v2";
  if (
    !exactKeys(scope, SCOPE_KEYS) ||
    (!isDocumentScope && !isSourceScope) ||
    !HASH_PATTERN.test(String(scope.scopeIdentity)) ||
    !HASH_PATTERN.test(String(scope.proposalId)) ||
    !HASH_PATTERN.test(String(scope.proposalCorpusSnapshotIdentity)) ||
    !HASH_PATTERN.test(String(scope.baseEvidenceBundleId)) ||
    !HASH_PATTERN.test(String(scope.claimSetIdentity)) ||
    !Array.isArray(scope.claimBindings) || scope.claimBindings.length < 1 ||
    scope.claimBindings.length > MAX_CLAIMS ||
    new Set(scope.claimBindings.map((binding) => binding.requirementId)).size !==
      scope.claimBindings.length ||
    scope.claimBindings.some((binding, index) => {
      const candidate = binding as unknown as Record<string, unknown>;
      return !exactKeys(binding, bindingKeys) ||
        !HASH_PATTERN.test(String(candidate.requirementId)) ||
        !HASH_PATTERN.test(String(candidate.claimId)) ||
        !HASH_PATTERN.test(String(candidate.claimArtifactHash)) ||
        (isDocumentScope
          ? !HASH_PATTERN.test(String(candidate.documentId)) ||
            !HASH_PATTERN.test(String(candidate.extractionId))
          : !["DOCUMENT_EXTRACTION", "CATALOG_CONTRACT_TEXT"].includes(
              String(candidate.sourceKind),
            ) ||
            !HASH_PATTERN.test(String(candidate.sourceArtifactId)) ||
            !HASH_PATTERN.test(String(candidate.textArtifactId))) ||
        !["SUPPORTS", "CONTRADICTS", "INCONCLUSIVE"].includes(
          String(candidate.disposition),
        ) ||
        (index > 0 && String(candidate.requirementId) <=
          scope.claimBindings[index - 1]!.requirementId);
    }) ||
    scope.claimSetIdentity !== hashCanonical({
      schemaVersion: claimSetSchema,
      proposalId: scope.proposalId,
      claims: scope.claimBindings,
    }) ||
    scope.scopeIdentity !== hashCanonical({
      schemaVersion: identitySchema,
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
