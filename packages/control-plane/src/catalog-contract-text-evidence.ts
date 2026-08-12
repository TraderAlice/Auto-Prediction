import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import { verifyRawFixture } from "@pmh/evidence";
import {
  MAX_RETAINED_RULE_CHARACTERS,
  toDiscoveryCatalogListing,
} from "./catalog-discovery.js";
import {
  verifyStoredCatalogObservation,
  type CatalogObservationSource,
  type StoredCatalogObservation,
} from "./catalog-observation.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ARTIFACT_KEYS = Object.freeze([
  "artifactId", "authority", "catalogObservationId", "certificateAuthority",
  "characterLength", "executionAuthority", "externalWriteAuthority", "field",
  "fieldDerivationIdentity",
  "listingRef", "modelInvocationsStartedByDerivation", "normalizedListingHash",
  "normalizerIdentity", "protocolIdentity", "providerRequestsStartedByDerivation",
  "receivedAt", "schemaVersion", "semanticDecisionAuthority", "sourceRawHash",
  "text", "textHash", "valueMovingAuthority", "venueId",
]);
const ARTIFACT_V2_KEYS = Object.freeze([
  ...ARTIFACT_KEYS,
  "discoveryListingHash",
].sort());

export const CATALOG_CONTRACT_TEXT_DERIVATION_IDENTITY = hashCanonical({
  schemaVersion: "pmh.catalog-contract-text-field-derivation.v1",
  sourceField: "rulesText",
  transform: "html-text+entity-decode+trim+whitespace-collapse",
  maximumRetainedCharacters: MAX_RETAINED_RULE_CHARACTERS,
});

type CatalogContractTextEvidenceFields = Readonly<{
  artifactId: Hash;
  catalogObservationId: string;
  sourceRawHash: Hash;
  normalizerIdentity: Hash;
  normalizedListingHash: Hash;
  listingRef: string;
  venueId: string;
  protocolIdentity: string;
  field: "rulesText";
  fieldDerivationIdentity: Hash;
  textHash: Hash;
  characterLength: number;
  receivedAt: string;
  text: string;
  authority: "UNTRUSTED_CATALOG_CONTRACT_TEXT_ONLY";
  providerRequestsStartedByDerivation: 0;
  modelInvocationsStartedByDerivation: 0;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type CatalogContractTextEvidence =
  | Readonly<CatalogContractTextEvidenceFields & {
      schemaVersion: "pmh.catalog-contract-text-evidence.v1";
    }>
  | Readonly<CatalogContractTextEvidenceFields & {
      schemaVersion: "pmh.catalog-contract-text-evidence.v2";
      discoveryListingHash: Hash;
    }>;

export interface CatalogContractTextEvidenceStore {
  loadCatalogContractTextEvidence(limit: number): readonly CatalogContractTextEvidence[];
  saveCatalogContractTextEvidence(
    evidence: CatalogContractTextEvidence,
  ): CatalogContractTextEvidence;
}

function iso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

export function assertCatalogContractTextEvidence(
  value: unknown,
): CatalogContractTextEvidence {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("catalog contract-text evidence is malformed");
  }
  const artifact = value as CatalogContractTextEvidence;
  const { artifactId, ...body } = artifact;
  const expectedKeys = artifact.schemaVersion ===
      "pmh.catalog-contract-text-evidence.v1"
    ? ARTIFACT_KEYS
    : artifact.schemaVersion === "pmh.catalog-contract-text-evidence.v2"
      ? ARTIFACT_V2_KEYS
      : null;
  if (
    expectedKeys === null ||
    Object.keys(artifact).sort().join("\n") !== expectedKeys.join("\n") ||
    !HASH_PATTERN.test(String(artifactId)) || artifactId !== hashCanonical(body) ||
    !/^catalog-observation:[0-9a-f]{64}$/u.test(artifact.catalogObservationId) ||
    !HASH_PATTERN.test(String(artifact.sourceRawHash)) ||
    !HASH_PATTERN.test(String(artifact.normalizerIdentity)) ||
    !HASH_PATTERN.test(String(artifact.normalizedListingHash)) ||
    typeof artifact.listingRef !== "string" || artifact.listingRef.length < 3 ||
    typeof artifact.venueId !== "string" || artifact.venueId.length < 1 ||
    typeof artifact.protocolIdentity !== "string" ||
    artifact.protocolIdentity.length < 1 || artifact.field !== "rulesText" ||
    artifact.fieldDerivationIdentity !==
      CATALOG_CONTRACT_TEXT_DERIVATION_IDENTITY ||
    !HASH_PATTERN.test(String(artifact.textHash)) ||
    typeof artifact.text !== "string" || artifact.text.trim() === "" ||
    artifact.text.length > 20_000 || artifact.characterLength !== artifact.text.length ||
    artifact.textHash !== hashBytes(new TextEncoder().encode(artifact.text)) ||
    !iso(artifact.receivedAt) ||
    artifact.authority !== "UNTRUSTED_CATALOG_CONTRACT_TEXT_ONLY" ||
    artifact.providerRequestsStartedByDerivation !== 0 ||
    artifact.modelInvocationsStartedByDerivation !== 0 ||
    artifact.semanticDecisionAuthority !== false ||
    artifact.certificateAuthority !== false || artifact.executionAuthority !== false ||
    artifact.externalWriteAuthority !== false || artifact.valueMovingAuthority !== false
  ) throw new Error("catalog contract-text evidence violates its bounded contract");
  if (
    artifact.schemaVersion === "pmh.catalog-contract-text-evidence.v2" &&
    !HASH_PATTERN.test(String(artifact.discoveryListingHash))
  ) throw new Error("catalog contract-text discovery listing identity is malformed");
  return Object.freeze(artifact);
}

export function deriveCatalogContractTextEvidence(input: Readonly<{
  observation: StoredCatalogObservation;
  source: CatalogObservationSource;
  listingRef: string;
}>): CatalogContractTextEvidence {
  const observation = verifyStoredCatalogObservation(input.observation);
  const normalizerIdentity = input.source.normalizerIdentity;
  if (
    observation.record.schemaVersion !== "pmh.catalog-observation.v2" ||
    normalizerIdentity === undefined ||
    observation.record.venueId !== input.source.venueId ||
    observation.record.protocolIdentity !== input.source.protocolIdentity ||
    observation.record.sourceUrl !== input.source.sourceUrl ||
    observation.record.normalizerIdentity !== normalizerIdentity
  ) throw new Error("catalog contract-text source does not match its observation");
  const fixture = verifyRawFixture(observation.bytes, {
    schemaVersion: "pmh.raw-fixture.v1",
    name: `${input.source.venueId}-catalog-contract-text`,
    venue: input.source.venueId,
    protocolVersion: input.source.protocolIdentity,
    sourceUrl: input.source.sourceUrl,
    fetchedAt: observation.record.receivedAt,
    httpStatus: observation.record.httpStatus,
    contentType: observation.record.contentType,
    etag: observation.record.etag,
    lastModified: observation.record.lastModified,
    rawHash: observation.record.rawHash,
    byteLength: observation.record.byteLength,
    acquisition: observation.record.acquisition,
  });
  const normalizedListings = input.source.decode(fixture);
  if (
    normalizedListings.length !== observation.record.listingCount ||
    hashCanonical(normalizedListings) !== observation.record.listingIdentity
  ) throw new Error("catalog contract-text observation normalization is inconsistent");
  const normalizedListing = normalizedListings.find(
    (item) => `${item.venueId}:${item.venueInstrumentId}` === input.listingRef,
  );
  if (normalizedListing === undefined) {
    throw new Error("listing is absent from the exact catalog observation");
  }
  const listing = toDiscoveryCatalogListing(normalizedListing, {
    kind: "LIVE_OBSERVATION",
    receivedAt: observation.record.receivedAt,
  });
  if (listing.rulesText === null || listing.rulesTextPosture !== "COMPLETE" ||
      listing.rulesTextSourceCharacterCount !== listing.rulesText.length) {
    throw new Error("catalog contract text is absent or truncated");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.catalog-contract-text-evidence.v2" as const,
    catalogObservationId: observation.record.observationId,
    sourceRawHash: observation.record.rawHash,
    normalizerIdentity,
    normalizedListingHash: hashCanonical(normalizedListing),
    discoveryListingHash: hashCanonical(listing),
    listingRef: listing.listingRef,
    venueId: listing.venueId,
    protocolIdentity: listing.protocolIdentity,
    field: "rulesText" as const,
    fieldDerivationIdentity: CATALOG_CONTRACT_TEXT_DERIVATION_IDENTITY,
    textHash: hashBytes(new TextEncoder().encode(listing.rulesText)),
    characterLength: listing.rulesText.length,
    receivedAt: listing.sourceReceivedAt,
    text: listing.rulesText,
    authority: "UNTRUSTED_CATALOG_CONTRACT_TEXT_ONLY" as const,
    providerRequestsStartedByDerivation: 0 as const,
    modelInvocationsStartedByDerivation: 0 as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertCatalogContractTextEvidence(Object.freeze({
    ...body,
    artifactId: hashCanonical(body),
  }));
}
