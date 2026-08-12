import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProposalEvidenceBundle,
  buildProposalEvidenceBundle,
  type DurableProposalEvidenceBundle,
  type MarketRelationKind,
  type MarketRelationProposal,
  type ProposalEvidenceBundle,
} from "./market-archaeologist.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type { DiscoveryCatalogListing } from "./types.js";
import { contractSemanticSnapshot } from "./contract-semantics.js";
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
  schemaVersion:
    | "pmh.semantic-review-scope.v1"
    | "pmh.semantic-review-scope.v2"
    | "pmh.semantic-review-scope.v3";
  proposalId: Hash;
  status: "SCOPED" | "UNSCOPED_EVIDENCE";
  relationKind: MarketRelationKind;
  canonicalListingRefs: readonly string[];
  contractSemanticIdentity: Hash | null;
  evidenceCapabilityIdentity?: Hash;
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
  return contractSemanticSnapshot(listing);
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

export function buildEvidenceCapabilityIdentity(
  listingsInput: readonly DiscoveryCatalogListing[],
): Hash {
  const listings = [...listingsInput].sort((left, right) =>
    left.listingRef.localeCompare(right.listingRef)
  );
  if (
    listings.length < 2 || listings.length > 20 ||
    new Set(listings.map((listing) => listing.listingRef)).size !== listings.length
  ) {
    throw new Error("semantic review evidence capability requires 2-20 unique listings");
  }
  return hashCanonical({
    schemaVersion: "pmh.semantic-review-evidence-capability.v1",
    listings: listings.map((listing) => Object.freeze({
      listingRef: listing.listingRef,
      rulesTextPosture: listing.rulesTextPosture ?? null,
      rulesTextSourceCharacterCount: listing.rulesTextSourceCharacterCount ?? null,
      evidenceLocators: Object.freeze([...(listing.evidenceLocators ?? [])]
        .map((locator) => Object.freeze({
          locatorIdentity: locator.locatorIdentity,
          role: locator.role,
        }))
        .sort((left, right) =>
          left.role.localeCompare(right.role) ||
          left.locatorIdentity.localeCompare(right.locatorIdentity)
        )),
    })),
  });
}

export function selectCurrentSemanticEvidenceBundle(input: Readonly<{
  proposal: MarketRelationProposal;
  retainedBundle: DurableProposalEvidenceBundle | null;
  currentSnapshot: MarketCorpusSnapshot;
  proposalCorpusSnapshotIdentity: Hash;
}>): DurableProposalEvidenceBundle | null {
  if (!input.proposal.listingRefs.every((listingRef) =>
    input.currentSnapshot.listings.some((listing) => listing.listingRef === listingRef)
  )) return input.retainedBundle;
  const currentBundle = buildProposalEvidenceBundle(
    input.proposal,
    input.currentSnapshot,
    input.proposalCorpusSnapshotIdentity,
  );
  if (input.retainedBundle === null) return currentBundle;
  const semanticsChanged = buildContractSemanticIdentity(input.retainedBundle.listings) !==
    buildContractSemanticIdentity(currentBundle.listings);
  const capabilityChanged = buildEvidenceCapabilityIdentity(input.retainedBundle.listings) !==
    buildEvidenceCapabilityIdentity(currentBundle.listings);
  return semanticsChanged || capabilityChanged ? currentBundle : input.retainedBundle;
}

export function deriveLegacySemanticReviewScopeIdentity(
  proposal: MarketRelationProposal,
  evidenceBundle: DurableProposalEvidenceBundle,
  evidenceClaims: readonly RuleEvidenceClaim[] = [],
): Hash {
  const contractSemanticIdentity = buildContractSemanticIdentity(evidenceBundle.listings);
  if (evidenceClaims.length === 0) {
    return hashCanonical({
      schemaVersion: "pmh.semantic-review-scope-identity.v1",
      relationKind: proposal.relationKind,
      canonicalListingRefs: canonicalListingRefs(proposal),
      contractSemanticIdentity,
    });
  }
  const evidenceEnrichment = buildEvidenceEnrichedSemanticScope({
    evidenceBundle,
    claims: evidenceClaims,
  });
  return hashCanonical({
    schemaVersion: "pmh.semantic-review-scope-identity.v2",
    relationKind: proposal.relationKind,
    canonicalListingRefs: canonicalListingRefs(proposal),
    contractSemanticIdentity,
    evidenceEnrichmentIdentity: evidenceEnrichment.scopeIdentity,
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
    ![
      "pmh.semantic-review-scope.v1",
      "pmh.semantic-review-scope.v2",
      "pmh.semantic-review-scope.v3",
    ]
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
    (record.schemaVersion !== "pmh.semantic-review-scope.v3" &&
      record.evidenceCapabilityIdentity !== undefined) ||
    (record.schemaVersion === "pmh.semantic-review-scope.v3" &&
      !HASH_PATTERN.test(String(record.evidenceCapabilityIdentity))) ||
    scoped !== HASH_PATTERN.test(String(record.scopeIdentity)) ||
    (record.schemaVersion === "pmh.semantic-review-scope.v1" &&
      record.evidenceEnrichmentIdentity !== undefined) ||
    (record.schemaVersion === "pmh.semantic-review-scope.v2" &&
      !HASH_PATTERN.test(String(record.evidenceEnrichmentIdentity))) ||
    (record.schemaVersion === "pmh.semantic-review-scope.v3" &&
      record.evidenceEnrichmentIdentity !== undefined &&
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
    : record.schemaVersion === "pmh.semantic-review-scope.v2"
      ? hashCanonical({
        schemaVersion: "pmh.semantic-review-scope-identity.v2",
        relationKind: record.relationKind,
        canonicalListingRefs: record.canonicalListingRefs,
        contractSemanticIdentity: record.contractSemanticIdentity,
        evidenceEnrichmentIdentity: record.evidenceEnrichmentIdentity,
      })
      : hashCanonical({
        schemaVersion: "pmh.semantic-review-scope-identity.v3",
        relationKind: record.relationKind,
        canonicalListingRefs: record.canonicalListingRefs,
        contractSemanticIdentity: record.contractSemanticIdentity,
        evidenceCapabilityIdentity: record.evidenceCapabilityIdentity,
        evidenceEnrichmentIdentity: record.evidenceEnrichmentIdentity ?? null,
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
  const rebased = durable?.captureKind === "EXACT_CURRENT_REBASE";
  const evidenceCapabilityIdentity = rebased && durable !== null
    ? buildEvidenceCapabilityIdentity(durable.listings)
    : null;
  const scopeIdentity = contractSemanticIdentity === null
    ? null
    : rebased
      ? hashCanonical({
          schemaVersion: "pmh.semantic-review-scope-identity.v3",
          relationKind: proposal.relationKind,
          canonicalListingRefs: refs,
          contractSemanticIdentity,
          evidenceCapabilityIdentity,
          evidenceEnrichmentIdentity: evidenceEnrichment?.scopeIdentity ?? null,
        })
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
    schemaVersion: rebased
      ? "pmh.semantic-review-scope.v3" as const
      : evidenceEnrichment === null
        ? "pmh.semantic-review-scope.v1" as const
        : "pmh.semantic-review-scope.v2" as const,
    proposalId: proposal.proposalId,
    status: scopeIdentity === null
      ? "UNSCOPED_EVIDENCE" as const
      : "SCOPED" as const,
    relationKind: proposal.relationKind,
    canonicalListingRefs: refs,
    contractSemanticIdentity,
    ...(evidenceCapabilityIdentity === null ? {} : { evidenceCapabilityIdentity }),
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
