import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertEvidenceRequirement,
  buildDiscoveryEvidenceLocator,
  buildEvidenceRequirements,
  type DiscoveryCatalogListing,
  type EvidenceRequirementDraft,
} from "../src/index.js";

function listing(
  venueId: string,
  locatorRole: "CONTRACT_RULE_DOCUMENT" | "OUTCOME_RESOLUTION_SOURCE",
  options: Readonly<{ listingRef?: string; url?: string }> = {},
): DiscoveryCatalogListing {
  const protocolIdentity = `${venueId}:v1`;
  const locator = buildDiscoveryEvidenceLocator({
    venueId,
    protocolIdentity,
    role: locatorRole,
    url: options.url ?? `https://evidence.example/${venueId}/${locatorRole}.html`,
  });
  if (locator === null) throw new Error("missing test locator");
  return Object.freeze({
    listingRef: options.listingRef ?? `${venueId}:event`,
    venueId,
    venueInstrumentId: "event",
    title: "Will the event happen?",
    description: "A bounded event.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: null,
    evidenceLocators: Object.freeze([locator]),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.4" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.6" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T00:00:00.000Z",
    sourceRawHash: hashCanonical({ venueId }),
    protocolIdentity,
  });
}

const listings = Object.freeze([
  listing("venue-a", "CONTRACT_RULE_DOCUMENT"),
  listing("venue-b", "OUTCOME_RESOLUTION_SOURCE"),
]);
const proposalId = hashCanonical({ proposal: "fixture" });
const proposalListingRefs = listings.map((item) => item.listingRef);

function draft(
  kind: EvidenceRequirementDraft["kind"],
  listingRefs = proposalListingRefs,
): EvidenceRequirementDraft {
  return Object.freeze({
    kind,
    listingRefs,
    claim: `The ${kind} evidence is required.`,
    reason: "The proposed truth-state restriction cannot be falsified without it.",
    satisfyingObservation: "An official source states the complete applicable rule.",
    contradictingObservation: "The official source permits the disputed joint state.",
    temporalPosture: "HISTORICAL_AT_SOURCE_OBSERVATION",
  });
}

describe("structured evidence requirements", () => {
  it("derives bounded acquisition routes and adapter-owned locators", () => {
    const requirements = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs,
      listings,
      drafts: [
        draft("RESOLUTION_RULE"),
        draft("ORACLE_SOURCE", ["venue-b:event"]),
        draft("QUOTE_DEPTH"),
        draft("FEE_SCHEDULE"),
      ],
    });
    expect(requirements).toHaveLength(4);
    expect(requirements.find((item) => item.kind === "RESOLUTION_RULE"))
      .toMatchObject({
        acquisitionRoute: "DOCUMENT_LOCATOR",
        eligibleLocators: [{
          listingRefs: ["venue-a:event"],
          locator: { role: "CONTRACT_RULE_DOCUMENT", fetchAuthority: false },
        }],
        authority: "EVIDENCE_ACQUISITION_REQUEST_ONLY",
        fetchAuthority: false,
        providerRequestAuthority: false,
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      });
    expect(requirements.find((item) => item.kind === "ORACLE_SOURCE"))
      .toMatchObject({
        acquisitionRoute: "DOCUMENT_LOCATOR",
        eligibleLocators: [{
          listingRefs: ["venue-b:event"],
          locator: { role: "OUTCOME_RESOLUTION_SOURCE" },
        }],
      });
    expect(requirements.find((item) => item.kind === "QUOTE_DEPTH")
      ?.acquisitionRoute).toBe("MARKET_DATA");
    expect(requirements.find((item) => item.kind === "FEE_SCHEDULE")
      ?.acquisitionRoute).toBe("UNSUPPORTED");
    expect(requirements.every((item) =>
      assertEvidenceRequirement(item) === item &&
      item.requirementId.startsWith("sha256:") &&
      item.acquisitionScopeIdentity.startsWith("sha256:")
    )).toBe(true);
  });

  it("coalesces one shared document across listings and acquisition requests", () => {
    const sharedUrl = "https://evidence.example/gemini/event-contracts.pdf";
    const sharedListings = Object.freeze([
      listing("gemini", "CONTRACT_RULE_DOCUMENT", {
        listingRef: "gemini:event-a",
        url: sharedUrl,
      }),
      listing("gemini", "CONTRACT_RULE_DOCUMENT", {
        listingRef: "gemini:event-b",
        url: sharedUrl,
      }),
    ]);
    const sharedRefs = sharedListings.map((item) => item.listingRef);
    const both = buildEvidenceRequirements({
      origin: "MARKET_ARCHAEOLOGIST",
      proposalId,
      proposalListingRefs: sharedRefs,
      listings: sharedListings,
      drafts: [draft("RESOLUTION_RULE", sharedRefs)],
    })[0]!;
    expect(both.eligibleLocators).toMatchObject([{
      listingRefs: sharedRefs,
      locator: { url: sharedUrl },
    }]);
    const firstOnly = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs: sharedRefs,
      listings: sharedListings,
      drafts: [draft("RESOLUTION_RULE", [sharedRefs[0]!])],
    })[0]!;
    expect(firstOnly.acquisitionScopeIdentity).toBe(both.acquisitionScopeIdentity);
  });

  it("deduplicates identical requests and rejects out-of-proposal scope", () => {
    const duplicate = draft("RESOLUTION_RULE", ["venue-a:event"]);
    expect(buildEvidenceRequirements({
      origin: "MARKET_ARCHAEOLOGIST",
      proposalId,
      proposalListingRefs,
      listings,
      drafts: [duplicate, duplicate],
    })).toHaveLength(1);
    expect(() => buildEvidenceRequirements({
      origin: "MARKET_ARCHAEOLOGIST",
      proposalId,
      proposalListingRefs,
      listings,
      drafts: [draft("RESOLUTION_RULE", ["outside:event"])],
    })).toThrow(/proposal listing scope/);
  });

  it("rejects a rehashed requirement whose adapter locator was modified", () => {
    const requirement = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs,
      listings,
      drafts: [draft("RESOLUTION_RULE", ["venue-a:event"])],
    })[0]!;
    const { requirementId: _requirementId, ...body } = requirement;
    const tamperedBody = {
      ...body,
      eligibleLocators: body.eligibleLocators.map((item) => ({
        ...item,
        locator: { ...item.locator, url: "https://substituted.example/rules" },
      })),
    };
    expect(() => assertEvidenceRequirement({
      ...tamperedBody,
      requirementId: hashCanonical(tamperedBody),
    })).toThrow(/locator binding/);

    const reboundBody = {
      ...body,
      eligibleLocators: body.eligibleLocators.map((item) => ({
        ...item,
        listingRefs: ["venue-b:event"],
      })),
    };
    expect(() => assertEvidenceRequirement({
      ...reboundBody,
      requirementId: hashCanonical(reboundBody),
    })).toThrow(/locator binding/);

    const extendedBody = { ...body, executionApproved: true };
    expect(() => assertEvidenceRequirement({
      ...extendedBody,
      requirementId: hashCanonical(extendedBody),
    })).toThrow(/authority contract/);
  });
});
