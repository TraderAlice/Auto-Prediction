import { hashCanonical, type Hash } from "@pmh/domain";
import type { DiscoveryCatalogListing } from "./types.js";

export type ContractSemanticSnapshot = Readonly<{
  listingRef: string;
  venueId: string;
  venueInstrumentId: string;
  title: string;
  description: string | null;
  mechanism: DiscoveryCatalogListing["mechanism"];
  closesAt: string | null;
  rulesText: string | null;
  outcomes: readonly Readonly<{
    venueOutcomeId: string;
    label: string;
  }>[];
  priceScale: string;
  quantityScale: string;
  protocolIdentity: string;
}>;

const SNAPSHOT_KEYS = Object.freeze([
  "closesAt", "description", "listingRef", "mechanism", "outcomes", "priceScale",
  "protocolIdentity", "quantityScale", "rulesText", "title", "venueId",
  "venueInstrumentId",
]);
const OUTCOME_KEYS = Object.freeze(["label", "venueOutcomeId"]);

function exactKeys(value: object, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === expected.join("\n");
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function nullableBoundedText(value: unknown, maximum: number): value is string | null {
  return value === null || typeof value === "string" && value.length <= maximum;
}

export function assertContractSemanticSnapshot(
  value: unknown,
): ContractSemanticSnapshot {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("contract semantic snapshot is malformed");
  }
  const snapshot = value as ContractSemanticSnapshot;
  if (
    !exactKeys(snapshot, SNAPSHOT_KEYS) ||
    !boundedText(snapshot.listingRef, 500) ||
    !boundedString(snapshot.venueId, 200) ||
    !boundedString(snapshot.venueInstrumentId, 500) ||
    !boundedString(snapshot.title, 10_000) ||
    !nullableBoundedText(snapshot.description, 200_000) ||
    !boundedString(snapshot.mechanism, 500) ||
    !(snapshot.closesAt === null || boundedString(snapshot.closesAt, 200)) ||
    !nullableBoundedText(snapshot.rulesText, 1_000_000) ||
    !Array.isArray(snapshot.outcomes) || snapshot.outcomes.length > 256 ||
    snapshot.outcomes.some((outcome) =>
      outcome === null || typeof outcome !== "object" ||
      !exactKeys(outcome, OUTCOME_KEYS) ||
      !boundedString(outcome.venueOutcomeId, 500) ||
      !boundedString(outcome.label, 10_000)
    ) ||
    !boundedString(snapshot.priceScale, 100) ||
    !boundedString(snapshot.quantityScale, 100) ||
    !boundedString(snapshot.protocolIdentity, 1_000) ||
    new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > 2_000_000
  ) throw new Error("contract semantic snapshot violates its bounded contract");
  return Object.freeze(snapshot);
}

export function contractSemanticSnapshot(
  listing: DiscoveryCatalogListing,
): ContractSemanticSnapshot {
  return assertContractSemanticSnapshot(Object.freeze({
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
  }));
}

export function buildContractListingSemanticIdentity(
  listing: DiscoveryCatalogListing,
): Hash {
  const contract = contractSemanticSnapshot(listing);
  return hashCanonical({
    schemaVersion: "pmh.contract-semantics.v1",
    contract,
  });
}
