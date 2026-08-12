import { hashCanonical } from "@pmh/domain";
import { buildDiscoveryEvidenceLocator } from "./discovery-evidence-locator.js";
import {
  buildEvidenceDocumentFetchPolicy,
  EvidenceDocumentFetcher,
} from "./evidence-document.js";
import { buildEvidenceRequirements } from "./evidence-requirement.js";
import { createRuleEvidenceClaimDesk } from "./rule-evidence-claim.js";
import type { DiscoveryCatalogListing } from "./types.js";

const VENUE_ID = "rule-evidence-smoke";
const PROTOCOL_IDENTITY = "rule-evidence-smoke:v1";
const RULE_URL = "https://rules.example.com/cancellation.txt";

function listing(
  listingRef: string,
  withLocator: boolean,
): DiscoveryCatalogListing {
  const locator = withLocator
    ? buildDiscoveryEvidenceLocator({
        venueId: VENUE_ID,
        protocolIdentity: PROTOCOL_IDENTITY,
        role: "CONTRACT_RULE_DOCUMENT",
        url: RULE_URL,
      })
    : null;
  if (withLocator && locator === null) {
    throw new Error("rule evidence smoke locator is inadmissible");
  }
  return Object.freeze({
    listingRef,
    venueId: VENUE_ID,
    venueInstrumentId: listingRef,
    title: "Will the scheduled event occur?",
    description: "Live provider qualification over a bounded local capture.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: null,
    ...(locator === null ? {} : { evidenceLocators: Object.freeze([locator]) }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "VERIFIED_FIXTURE",
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef, source: "rule-evidence-claim-smoke" }),
    protocolIdentity: PROTOCOL_IDENTITY,
  });
}

export async function runRuleEvidenceClaimSmoke(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Readonly<Record<string, unknown>>> {
  const listings = Object.freeze([
    listing("rule-evidence-smoke:event", true),
    listing("rule-evidence-smoke:peer", false),
  ]);
  const requirement = buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({ schemaVersion: "pmh.rule-evidence-claim-smoke.v1" }),
    proposalListingRefs: listings.map((item) => item.listingRef),
    listings,
    drafts: [Object.freeze({
      kind: "VOID_CANCELLATION" as const,
      listingRefs: Object.freeze([listings[0]!.listingRef]),
      claim: "If the scheduled event is cancelled, the contract resolves No.",
      reason: "Cancellation semantics determine the feasible joint settlement states.",
      satisfyingObservation: "The official rule explicitly says cancellation resolves No.",
      contradictingObservation: "The official rule says cancellation voids or refunds the contract.",
      temporalPosture: "CURRENT" as const,
    })],
  })[0]!;
  const policy = buildEvidenceDocumentFetchPolicy({
    venueId: VENUE_ID,
    protocolIdentity: PROTOCOL_IDENTITY,
    role: "CONTRACT_RULE_DOCUMENT",
    allowedHostnames: ["rules.example.com"],
    allowedContentTypes: ["text/plain"],
  });
  const fetcher = new EvidenceDocumentFetcher({
    policies: [policy],
    fetch: async () => new Response(
      "Official settlement rule. If the scheduled event is cancelled, this contract resolves No. Postponement to a later announced date does not count as cancellation.",
      { status: 200, headers: { "content-type": "text/plain", etag: "\"smoke-v1\"" } },
    ),
    resolve: async () => Object.freeze([
      Object.freeze({ address: "8.8.8.8", family: 4 as const }),
    ]),
  });
  const capture = await fetcher.capture({
    requirement,
    locatorIdentity: requirement.eligibleLocators[0]!.locator.locatorIdentity,
  });
  const desk = createRuleEvidenceClaimDesk(environment);
  const record = await desk.begin(requirement, capture).promise;
  if (record.status !== "PASS" || record.claim === null) {
    throw new Error(record.diagnostic ?? "rule evidence claim smoke did not pass");
  }
  return Object.freeze({
    schemaVersion: "pmh.rule-evidence-claim-smoke.v1",
    status: record.status,
    model: record.model,
    interpretationId: record.interpretationId,
    requirementId: record.requirementId,
    documentId: "sourceKind" in record ? null : record.documentId,
    extractionId: "sourceKind" in record ? null : record.extractionId,
    disposition: record.claim.disposition,
    citationCount: record.claim.citations.length,
    citedCharacterCount: record.claim.citations.reduce(
      (sum, citation) => sum + citation.end - citation.start,
      0,
    ),
    searchEffectCount: record.claim.trace.searchEffectCount,
    readEffectCount: record.claim.trace.readEffectCount,
    wholeResponseSchemaParsing: record.claim.trace.wholeResponseSchemaParsing,
    terminalEffectEndsLoop: record.claim.trace.terminalEffectEndsLoop,
    claimArtifactHash: record.claim.artifactHash,
    semanticDecisionAuthority: record.claim.semanticDecisionAuthority,
    certificateAuthority: record.claim.certificateAuthority,
    executionAuthority: record.claim.executionAuthority,
  });
}
