import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import {
  assertContractSemanticSnapshot,
  buildContractListingSemanticIdentity,
  contractSemanticSnapshot,
  type ContractSemanticSnapshot,
} from "./contract-semantics.js";
import type { CatalogContractTextEvidence } from "./catalog-contract-text-evidence.js";
import type { DiscoveryCatalogListing } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type ContractSemanticContinuity = Readonly<{
  schemaVersion: "pmh.contract-semantic-continuity.v1";
  continuityId: Hash;
  listingRef: string;
  priorSemanticSourceArtifactId: Hash;
  priorListing: DiscoveryCatalogListing;
  priorListingHash: Hash;
  priorSourceRawHash: Hash;
  priorSourceReceivedAt: string;
  currentListingHash: Hash;
  currentSourceRawHash: Hash;
  currentSourceReceivedAt: string;
  currentCatalogTextArtifactId: Hash;
  contractSemanticIdentity: Hash;
  contractSemantics: ContractSemanticSnapshot;
  rulesTextHash: Hash;
  comparison: "EXACT_CONTRACT_SEMANTICS_AND_RULES_TEXT";
  authority: "CONTINUITY_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface ContractSemanticContinuityStore {
  loadContractSemanticContinuities(
    limit: number,
  ): readonly ContractSemanticContinuity[];
  saveContractSemanticContinuity(
    continuity: ContractSemanticContinuity,
  ): ContractSemanticContinuity;
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

export function assertContractSemanticContinuity(
  value: unknown,
): ContractSemanticContinuity {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("contract semantic continuity is malformed");
  }
  const record = value as ContractSemanticContinuity;
  const { continuityId, ...body } = record;
  const priorListing = record.priorListing;
  let priorSemantics: ContractSemanticSnapshot;
  try {
    priorSemantics = contractSemanticSnapshot(priorListing);
  } catch {
    throw new Error("contract semantic continuity prior listing is malformed");
  }
  if (
    record.schemaVersion !== "pmh.contract-semantic-continuity.v1" ||
    !HASH_PATTERN.test(String(continuityId)) || continuityId !== hashCanonical(body) ||
    typeof record.listingRef !== "string" || record.listingRef.length < 3 ||
    !HASH_PATTERN.test(String(record.priorSemanticSourceArtifactId)) ||
    hashCanonical(priorListing) !== record.priorListingHash ||
    priorListing.listingRef !== record.listingRef ||
    priorListing.sourceRawHash !== record.priorSourceRawHash ||
    priorListing.sourceReceivedAt !== record.priorSourceReceivedAt ||
    !HASH_PATTERN.test(String(record.priorListingHash)) ||
    !HASH_PATTERN.test(String(record.priorSourceRawHash)) ||
    !isIso(record.priorSourceReceivedAt) ||
    !HASH_PATTERN.test(String(record.currentListingHash)) ||
    !HASH_PATTERN.test(String(record.currentSourceRawHash)) ||
    !isIso(record.currentSourceReceivedAt) ||
    !HASH_PATTERN.test(String(record.currentCatalogTextArtifactId)) ||
    !HASH_PATTERN.test(String(record.contractSemanticIdentity)) ||
    !HASH_PATTERN.test(String(record.rulesTextHash)) ||
    assertContractSemanticSnapshot(record.contractSemantics).listingRef !== record.listingRef ||
    hashCanonical(priorSemantics) !== hashCanonical(record.contractSemantics) ||
    hashCanonical({
      schemaVersion: "pmh.contract-semantics.v1",
      contract: record.contractSemantics,
    }) !== record.contractSemanticIdentity ||
    record.contractSemantics.rulesText === null ||
    hashBytes(new TextEncoder().encode(record.contractSemantics.rulesText)) !==
      record.rulesTextHash ||
    record.comparison !== "EXACT_CONTRACT_SEMANTICS_AND_RULES_TEXT" ||
    record.authority !== "CONTINUITY_EVIDENCE_ONLY" ||
    record.semanticDecisionAuthority !== false ||
    record.certificateAuthority !== false || record.executionAuthority !== false ||
    record.externalWriteAuthority !== false || record.valueMovingAuthority !== false
  ) throw new Error("contract semantic continuity violates its bounded contract");
  return Object.freeze(record);
}

export function buildContractSemanticContinuity(input: Readonly<{
  priorListing: DiscoveryCatalogListing;
  priorSemanticSourceArtifactId: Hash;
  currentListing: DiscoveryCatalogListing;
  currentCatalogTextEvidence: CatalogContractTextEvidence;
}>): ContractSemanticContinuity {
  const priorIdentity = buildContractListingSemanticIdentity(input.priorListing);
  const currentIdentity = buildContractListingSemanticIdentity(input.currentListing);
  const evidence = input.currentCatalogTextEvidence;
  if (
    priorIdentity !== currentIdentity ||
    input.priorListing.listingRef !== input.currentListing.listingRef ||
    evidence.listingRef !== input.currentListing.listingRef ||
    evidence.schemaVersion !== "pmh.catalog-contract-text-evidence.v2" ||
    evidence.discoveryListingHash !== hashCanonical(input.currentListing) ||
    evidence.sourceRawHash !== input.currentListing.sourceRawHash ||
    evidence.receivedAt !== input.currentListing.sourceReceivedAt ||
    evidence.text !== input.currentListing.rulesText
  ) throw new Error("contract semantics are not continuous across observations");
  const body = Object.freeze({
    schemaVersion: "pmh.contract-semantic-continuity.v1" as const,
    listingRef: input.currentListing.listingRef,
    priorSemanticSourceArtifactId: input.priorSemanticSourceArtifactId,
    priorListing: input.priorListing,
    priorListingHash: hashCanonical(input.priorListing),
    priorSourceRawHash: input.priorListing.sourceRawHash as Hash,
    priorSourceReceivedAt: input.priorListing.sourceReceivedAt,
    currentListingHash: hashCanonical(input.currentListing),
    currentSourceRawHash: input.currentListing.sourceRawHash as Hash,
    currentSourceReceivedAt: input.currentListing.sourceReceivedAt,
    currentCatalogTextArtifactId: evidence.artifactId,
    contractSemanticIdentity: currentIdentity,
    contractSemantics: contractSemanticSnapshot(input.currentListing),
    rulesTextHash: evidence.textHash,
    comparison: "EXACT_CONTRACT_SEMANTICS_AND_RULES_TEXT" as const,
    authority: "CONTINUITY_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertContractSemanticContinuity(Object.freeze({
    ...body,
    continuityId: hashCanonical(body),
  }));
}
