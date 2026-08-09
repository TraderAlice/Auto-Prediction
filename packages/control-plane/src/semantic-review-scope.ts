import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProposalEvidenceBundle,
  type DurableProposalEvidenceBundle,
  type MarketRelationKind,
  type MarketRelationProposal,
  type ProposalEvidenceBundle,
} from "./market-archaeologist.js";
import type { DiscoveryCatalogListing } from "./types.js";
import {
  buildEvidenceEnrichedSemanticScope,
} from "./evidence-enriched-semantic-scope.js";
import type { RuleEvidenceClaim } from "./rule-evidence-claim.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export const SYMMETRIC_REVIEW_RELATIONS = Object.freeze([
  "EQUIVALENT",
  "MUTUALLY_EXCLUSIVE",
  "EXHAUSTIVE",
] as const);

export type SemanticReviewScopeRecord = Readonly<{
  schemaVersion: "pmh.semantic-review-scope.v1" | "pmh.semantic-review-scope.v2";
  proposalId: Hash;
  status: "SCOPED" | "UNSCOPED_EVIDENCE";
  relationKind: MarketRelationKind;
  canonicalListingRefs: readonly string[];
  contractSemanticIdentity: Hash | null;
  scopeIdentity: Hash | null;
  evidenceEnrichmentIdentity?: Hash;
  priceIndependent: true;
  modelConfidenceUsed: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

function contractListing(listing: DiscoveryCatalogListing) {
  return Object.freeze({
    listingRef: listing.listingRef,
    venueId: listing.venueId,
    venueInstrumentId: listing.venueInstrumentId,
    title: listing.title,
    description: listing.description,
    mechanism: listing.mechanism,
    closesAt: listing.closesAt,
    rulesText: listing.rulesText,
    outcomes: Object.freeze([...listing.outcomes]
      .map((outcome) => Object.freeze({
        venueOutcomeId: outcome.venueOutcomeId,
        label: outcome.label,
      }))
      .sort((left, right) =>
        left.venueOutcomeId.localeCompare(right.venueOutcomeId) ||
        left.label.localeCompare(right.label)
      )),
    priceScale: listing.priceScale,
    quantityScale: listing.quantityScale,
    protocolIdentity: listing.protocolIdentity,
  });
}

export function buildContractSemanticIdentity(
  listingsInput: readonly DiscoveryCatalogListing[],
): Hash {
  const listings = [...listingsInput].sort((left, right) =>
    left.listingRef.localeCompare(right.listingRef)
  );
  if (
    listings.length < 2 || listings.length > 20 ||
    new Set(listings.map((listing) => listing.listingRef)).size !== listings.length
  ) {
    throw new Error("semantic review contract identity requires 2-20 unique listings");
  }
  return hashCanonical({
    schemaVersion: "pmh.semantic-review-contract-semantics.v1",
    listings: listings.map(contractListing),
  });
}

function canonicalListingRefs(proposal: MarketRelationProposal): readonly string[] {
  return Object.freeze(
    SYMMETRIC_REVIEW_RELATIONS.includes(
      proposal.relationKind as (typeof SYMMETRIC_REVIEW_RELATIONS)[number],
    )
      ? [...proposal.listingRefs].sort()
      : [...proposal.listingRefs],
  );
}

function withoutArtifactHash(
  record: SemanticReviewScopeRecord,
): Omit<SemanticReviewScopeRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...body } = record;
  return body;
}

export function assertSemanticReviewScopeRecord(
  value: unknown,
): SemanticReviewScopeRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("semantic review scope record is malformed");
  }
  const record = value as SemanticReviewScopeRecord;
  const scoped = record.status === "SCOPED";
  if (
    !["pmh.semantic-review-scope.v1", "pmh.semantic-review-scope.v2"]
      .includes(record.schemaVersion) ||
    !HASH_PATTERN.test(String(record.proposalId)) ||
    !["SCOPED", "UNSCOPED_EVIDENCE"].includes(record.status) ||
    ![
      "EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE",
      "EXHAUSTIVE", "CONDITIONAL", "RELATED", "CONFLICTING",
    ].includes(record.relationKind) ||
    !Array.isArray(record.canonicalListingRefs) ||
    record.canonicalListingRefs.length < 1 ||
    record.canonicalListingRefs.length > 20 ||
    new Set(record.canonicalListingRefs).size !== record.canonicalListingRefs.length ||
    record.canonicalListingRefs.some((item) =>
      typeof item !== "string" || item.trim() === "" || item.length > 500
    ) ||
    scoped !== HASH_PATTERN.test(String(record.contractSemanticIdentity)) ||
    scoped !== HASH_PATTERN.test(String(record.scopeIdentity)) ||
    (record.schemaVersion === "pmh.semantic-review-scope.v1" &&
      record.evidenceEnrichmentIdentity !== undefined) ||
    (record.schemaVersion === "pmh.semantic-review-scope.v2" &&
      !HASH_PATTERN.test(String(record.evidenceEnrichmentIdentity))) ||
    record.priceIndependent !== true ||
    record.modelConfidenceUsed !== false ||
    record.semanticDecisionAuthority !== false ||
    record.certificateAuthority !== false ||
    record.executionAuthority !== false ||
    !HASH_PATTERN.test(String(record.artifactHash)) ||
    hashCanonical(withoutArtifactHash(record)) !== record.artifactHash
  ) {
    throw new Error("semantic review scope record violates its contract");
  }
  if (
    SYMMETRIC_REVIEW_RELATIONS.includes(
      record.relationKind as (typeof SYMMETRIC_REVIEW_RELATIONS)[number],
    ) &&
    record.canonicalListingRefs.join("\n") !==
      [...record.canonicalListingRefs].sort().join("\n")
  ) {
    throw new Error("symmetric semantic review scope refs are not canonical");
  }
  const expectedScopeIdentity = record.schemaVersion === "pmh.semantic-review-scope.v1"
    ? hashCanonical({
        schemaVersion: "pmh.semantic-review-scope-identity.v1",
        relationKind: record.relationKind,
        canonicalListingRefs: record.canonicalListingRefs,
        contractSemanticIdentity: record.contractSemanticIdentity,
      })
    : hashCanonical({
        schemaVersion: "pmh.semantic-review-scope-identity.v2",
        relationKind: record.relationKind,
        canonicalListingRefs: record.canonicalListingRefs,
        contractSemanticIdentity: record.contractSemanticIdentity,
        evidenceEnrichmentIdentity: record.evidenceEnrichmentIdentity,
      });
  if (scoped && record.scopeIdentity !== expectedScopeIdentity) {
    throw new Error("semantic review scope identity is inconsistent");
  }
  return Object.freeze(record);
}

export function deriveSemanticReviewScope(
  proposal: MarketRelationProposal,
  evidenceBundle: ProposalEvidenceBundle | null | undefined,
  evidenceClaims: readonly RuleEvidenceClaim[] = [],
): SemanticReviewScopeRecord {
  const refs = canonicalListingRefs(proposal);
  const durable = evidenceBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2"
    ? assertProposalEvidenceBundle(evidenceBundle) as DurableProposalEvidenceBundle
    : null;
  if (durable !== null && durable.proposalId !== proposal.proposalId) {
    throw new Error("semantic review scope evidence belongs to another proposal");
  }
  const contractSemanticIdentity = durable === null
    ? null
    : buildContractSemanticIdentity(durable.listings);
  if (evidenceClaims.length > 0 && durable === null) {
    throw new Error("evidence-enriched semantic review requires a durable evidence bundle");
  }
  const evidenceEnrichment = evidenceClaims.length === 0 || durable === null
    ? null
    : buildEvidenceEnrichedSemanticScope({ evidenceBundle: durable, claims: evidenceClaims });
  const scopeIdentity = contractSemanticIdentity === null
    ? null
    : evidenceEnrichment === null
      ? hashCanonical({
          schemaVersion: "pmh.semantic-review-scope-identity.v1",
          relationKind: proposal.relationKind,
          canonicalListingRefs: refs,
          contractSemanticIdentity,
        })
      : hashCanonical({
          schemaVersion: "pmh.semantic-review-scope-identity.v2",
          relationKind: proposal.relationKind,
          canonicalListingRefs: refs,
          contractSemanticIdentity,
          evidenceEnrichmentIdentity: evidenceEnrichment.scopeIdentity,
        });
  const body = Object.freeze({
    schemaVersion: evidenceEnrichment === null
      ? "pmh.semantic-review-scope.v1" as const
      : "pmh.semantic-review-scope.v2" as const,
    proposalId: proposal.proposalId,
    status: scopeIdentity === null
      ? "UNSCOPED_EVIDENCE" as const
      : "SCOPED" as const,
    relationKind: proposal.relationKind,
    canonicalListingRefs: refs,
    contractSemanticIdentity,
    scopeIdentity,
    ...(evidenceEnrichment === null
      ? {}
      : { evidenceEnrichmentIdentity: evidenceEnrichment.scopeIdentity }),
    priceIndependent: true as const,
    modelConfidenceUsed: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertSemanticReviewScopeRecord(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}
