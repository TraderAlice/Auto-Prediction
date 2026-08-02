import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashBytes, hashCanonical } from "@pmh/domain";
import { geminiManifest } from "@pmh/venue-gemini";
import { buildDiscoveryEvidenceLocator } from "./discovery-evidence-locator.js";
import { EvidenceDocumentFetcher } from "./evidence-document.js";
import { buildEvidenceRequirements } from "./evidence-requirement.js";
import type { DiscoveryCatalogListing } from "./types.js";

const fixturePath = resolve(
  import.meta.dirname,
  "../../../projects/fixtures/gemini-predictions/2026-07-31/gemini-binary-catalog.json",
);

function listing(input: Readonly<{
  listingRef: string;
  sourceRawHash: ReturnType<typeof hashBytes>;
  locatorUrl?: string;
}>): DiscoveryCatalogListing {
  const locator = input.locatorUrl === undefined
    ? null
    : buildDiscoveryEvidenceLocator({
        venueId: geminiManifest.venueId,
        protocolIdentity: geminiManifest.protocolIdentity,
        role: "CONTRACT_RULE_DOCUMENT",
        url: input.locatorUrl,
      });
  if (input.locatorUrl !== undefined && locator === null) {
    throw new Error("fixture contains no admissible Gemini rule locator");
  }
  return Object.freeze({
    listingRef: input.listingRef,
    venueId: geminiManifest.venueId,
    venueInstrumentId: input.listingRef,
    title: input.listingRef,
    description: "Checked-in Gemini catalog evidence-document smoke scope.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: null,
    ...(locator === null ? {} : { evidenceLocators: Object.freeze([locator]) }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "100000000",
    quantityScale: "100000000",
    minPriceTick: "1000000",
    sourceKind: "VERIFIED_FIXTURE",
    sourceReceivedAt: "2026-07-31T00:00:00.000Z",
    sourceRawHash: input.sourceRawHash,
    protocolIdentity: geminiManifest.protocolIdentity,
  });
}

async function main(): Promise<void> {
  const fixtureBytes = new Uint8Array(await readFile(fixturePath));
  const payload = JSON.parse(new TextDecoder().decode(fixtureBytes)) as {
    data?: readonly Readonly<{
      contracts?: readonly Readonly<{ termsAndConditionsUrl?: string }>[];
      termsLink?: string;
    }>[];
  };
  const url = payload.data?.[0]?.contracts?.[0]?.termsAndConditionsUrl ??
    payload.data?.[0]?.termsLink;
  if (url === undefined || url === "") throw new Error("fixture has no rule URL");
  const sourceRawHash = hashBytes(fixtureBytes);
  const listings = Object.freeze([
    listing({ listingRef: "gemini-smoke:rule", sourceRawHash, locatorUrl: url }),
    listing({ listingRef: "gemini-smoke:peer", sourceRawHash }),
  ]);
  const requirement = buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({ schemaVersion: "pmh.evidence-document-smoke.v1" }),
    proposalListingRefs: listings.map((item) => item.listingRef),
    listings,
    drafts: [Object.freeze({
      kind: "RESOLUTION_RULE" as const,
      listingRefs: Object.freeze([listings[0]!.listingRef]),
      claim: "The checked-in contract has an anonymously retrievable official rule.",
      reason: "Qualify the bounded acquisition and extraction boundary.",
      satisfyingObservation: "The official PDF is captured and yields bounded text.",
      contradictingObservation: "The locator is unavailable or cannot yield bounded text.",
      temporalPosture: "HISTORICAL_AT_SOURCE_OBSERVATION" as const,
    })],
  })[0]!;
  const fetcher = new EvidenceDocumentFetcher({
    trustClashFakeIp: process.env.PMH_EVIDENCE_TRUST_CLASH_FAKE_IP === "1",
  });
  const capture = await fetcher.capture({
    requirement,
    locatorIdentity: requirement.eligibleLocators[0]!.locator.locatorIdentity,
  });
  const revalidated = await fetcher.capture({
    requirement,
    locatorIdentity: requirement.eligibleLocators[0]!.locator.locatorIdentity,
    previous: capture,
  });
  process.stdout.write(`${JSON.stringify({
    status: capture.status,
    requirementId: requirement.requirementId,
    policyIdentity: capture.document.record.policyIdentity,
    locatorIdentity: capture.document.record.locatorIdentity,
    finalLocatorIdentity: capture.document.record.finalLocatorIdentity,
    documentId: capture.document.record.documentId,
    rawHash: capture.document.record.rawHash,
    byteLength: capture.document.record.byteLength,
    contentType: capture.document.record.contentType,
    networkResolution: capture.observation.networkResolution,
    selectedAddress: capture.observation.selectedAddress,
    selectedAddressFamily: capture.observation.selectedAddressFamily,
    extractionId: capture.extraction.record.extractionId,
    extractionStatus: capture.extraction.record.status,
    pageCount: capture.extraction.record.pageCount,
    characterLength: capture.extraction.record.characterLength,
    promptInstructionsAccepted: capture.extraction.record.promptInstructionsAccepted,
    semanticDecisionAuthority: capture.extraction.record.semanticDecisionAuthority,
    executionAuthority: capture.extraction.record.executionAuthority,
    revalidationStatus: revalidated.status,
    revalidationHttpStatus: revalidated.observation.httpStatus,
    revalidationSelectedAddress: revalidated.observation.selectedAddress,
    revalidationSelectedAddressFamily: revalidated.observation.selectedAddressFamily,
    revalidationDocumentReused:
      revalidated.document.record.documentId === capture.document.record.documentId,
  }, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
