import { hashCanonical } from "@pmh/domain";
import {
  polymarketUsContractRulesUrl,
  polymarketUsManifest,
} from "@pmh/venue-polymarket-us";
import { buildDiscoveryEvidenceLocator } from "./discovery-evidence-locator.js";
import { EvidenceDocumentFetcher } from "./evidence-document.js";
import { buildEvidenceRequirements } from "./evidence-requirement.js";
import { loadLocalEnvironment } from "./local-environment.js";
import type { DiscoveryCatalogListing } from "./types.js";

loadLocalEnvironment();

const DEFAULT_SLUG = "paccc-usho-midterms-2026-11-03-dem";

function listing(
  slug: string,
  locator: NonNullable<DiscoveryCatalogListing["evidenceLocators"]>[number] | null,
): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef: `polymarket-us:${slug}`,
    venueId: polymarketUsManifest.venueId,
    venueInstrumentId: slug,
    title: slug,
    description: "Live contract-detail evidence smoke scope.",
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: null,
    rulesText: null,
    ...(locator === null ? {} : { evidenceLocators: Object.freeze([locator]) }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "100000000",
    quantityScale: "10000",
    minPriceTick: "100000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: new Date().toISOString(),
    sourceRawHash: hashCanonical({ source: "live-contract-detail-smoke", slug }),
    protocolIdentity: polymarketUsManifest.protocolIdentity,
  });
}

async function main(): Promise<void> {
  const slug = process.env.PMH_POLYMARKET_US_SMOKE_SLUG?.trim() || DEFAULT_SLUG;
  const url = polymarketUsContractRulesUrl(slug);
  const locator = buildDiscoveryEvidenceLocator({
    venueId: polymarketUsManifest.venueId,
    protocolIdentity: polymarketUsManifest.protocolIdentity,
    role: "CONTRACT_RULE_DOCUMENT",
    url,
  });
  if (locator === null) throw new Error("Polymarket US smoke locator is invalid");
  const peerSlug = `${slug}-peer`;
  const listings = Object.freeze([listing(slug, locator), listing(peerSlug, null)]);
  const requirement = buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({
      schemaVersion: "pmh.polymarket-us-contract-rule-smoke.v1",
      slug,
    }),
    proposalListingRefs: listings.map((item) => item.listingRef),
    listings,
    drafts: [{
      kind: "RESOLUTION_RULE",
      listingRefs: [listings[0]!.listingRef],
      claim: "The official market detail contains the contract-specific resolution rule.",
      reason: "Qualify slug binding and first-party JSON description extraction.",
      satisfyingObservation: "The bound detail response yields non-empty contract rules.",
      contradictingObservation: "The detail response is absent, mismatched, or empty.",
      temporalPosture: "CURRENT",
    }],
  })[0]!;
  const capture = await new EvidenceDocumentFetcher({
    trustClashFakeIp: process.env.PMH_EVIDENCE_TRUST_CLASH_FAKE_IP === "1",
  }).capture({
    requirement,
    locatorIdentity: locator.locatorIdentity,
  });

  process.stdout.write(`${JSON.stringify({
    status: capture.status,
    slug,
    requestedUrl: capture.document.record.requestedUrl,
    contentType: capture.document.record.contentType,
    byteLength: capture.document.record.byteLength,
    rawHash: capture.document.record.rawHash,
    extractionId: capture.extraction.record.extractionId,
    extractionStatus: capture.extraction.record.status,
    characterLength: capture.extraction.record.characterLength,
    contractRulesPreview: capture.extraction.text.slice(0, 160),
    promptInstructionsAccepted: capture.extraction.record.promptInstructionsAccepted,
    semanticDecisionAuthority: capture.extraction.record.semanticDecisionAuthority,
    executionAuthority: capture.extraction.record.executionAuthority,
  }, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
