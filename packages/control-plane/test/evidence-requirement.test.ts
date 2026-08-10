import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertEvidenceRequirement,
  buildDiscoveryEvidenceLocator,
  buildEvidenceRequirements,
  rebaseEvidenceRequirementToCurrentListings,
  rebaseEvidenceRequirementToRetainedLocatorCapabilities,
  type DiscoveryCatalogListing,
  type EvidenceRequirementDraft,
} from "../src/index.js";

function listing(
  venueId: string,
  locatorRole:
    | "CONTRACT_RULE_DOCUMENT"
    | "VENUE_RULE_DOCUMENT"
    | "OUTCOME_RESOLUTION_SOURCE",
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
  it("rebinds a retained current requirement only when acquisition scope changes", () => {
    const oldContract = listing("polymarket-us", "CONTRACT_RULE_DOCUMENT", {
      listingRef: "polymarket-us:house-dem",
      url: "https://www.cftc.gov/filings/orgrules/legacy.docx",
    });
    const peer = Object.freeze({
      ...oldContract,
      listingRef: "polymarket-us:house-rep",
      venueInstrumentId: "house-rep",
    });
    const refs = [oldContract.listingRef, peer.listingRef];
    const retained = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs: refs,
      listings: [oldContract, peer],
      drafts: [{ ...draft("RESOLUTION_RULE", [oldContract.listingRef]), temporalPosture: "CURRENT" }],
    })[0]!;
    expect(retained.schemaVersion).toBe("pmh.evidence-requirement.v2");
    if (retained.schemaVersion !== "pmh.evidence-requirement.v2") {
      throw new Error("expected current evidence requirement schema");
    }
    expect(retained.proposalListingRefs).toEqual(refs);
    const contractLocator = buildDiscoveryEvidenceLocator({
      venueId: oldContract.venueId,
      protocolIdentity: oldContract.protocolIdentity,
      role: "CONTRACT_RULE_DOCUMENT",
      url: "https://gateway.polymarket.us/v1/market/slug/house-dem",
    });
    const venueLocator = buildDiscoveryEvidenceLocator({
      venueId: oldContract.venueId,
      protocolIdentity: oldContract.protocolIdentity,
      role: "VENUE_RULE_DOCUMENT",
      url: "https://www.cftc.gov/filings/orgrules/current.docx",
    });
    if (contractLocator === null || venueLocator === null) {
      throw new Error("missing current evidence locators");
    }
    const currentContract = Object.freeze({
      ...oldContract,
      evidenceLocators: Object.freeze([contractLocator, venueLocator]),
    });
    const rebased = rebaseEvidenceRequirementToCurrentListings(retained, {
      listings: [currentContract, peer],
    });
    expect(rebased.requirementId).not.toBe(retained.requirementId);
    expect(rebased.acquisitionScopeIdentity).not.toBe(
      retained.acquisitionScopeIdentity,
    );
    expect(rebased.eligibleLocators.map((item) => item.locator)).toEqual([
      contractLocator,
    ]);
    expect(rebaseEvidenceRequirementToCurrentListings(rebased, {
      listings: [{
        ...currentContract,
        outcomes: currentContract.outcomes.map((outcome) => ({
          ...outcome,
          indicativePrice: outcome.indicativePrice === "0.4" ? "0.41" : "0.59",
        })),
      }, peer],
    })).toBe(rebased);
  });

  it("reads v1 requirements without inventing missing proposal scope", () => {
    const current = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs,
      listings,
      drafts: [{
        ...draft("RESOLUTION_RULE", [proposalListingRefs[0]!]),
        temporalPosture: "CURRENT",
      }],
    })[0]!;
    if (current.schemaVersion !== "pmh.evidence-requirement.v2") {
      throw new Error("expected current evidence requirement schema");
    }
    const {
      proposalListingRefs: _proposalListingRefs,
      requirementId: _requirementId,
      schemaVersion: _schemaVersion,
      ...retainedBody
    } = current;
    const legacyBody = Object.freeze({
      ...retainedBody,
      schemaVersion: "pmh.evidence-requirement.v1" as const,
    });
    const legacy = assertEvidenceRequirement(Object.freeze({
      ...legacyBody,
      requirementId: hashCanonical(legacyBody),
    }));
    expect(legacy.schemaVersion).toBe("pmh.evidence-requirement.v1");
    expect(rebaseEvidenceRequirementToCurrentListings(legacy, { listings }))
      .toBe(legacy);
    const migrated = rebaseEvidenceRequirementToCurrentListings(legacy, {
      proposalListingRefs,
      listings,
    });
    expect(migrated.schemaVersion).toBe("pmh.evidence-requirement.v2");
  });

  it("reuses exact-ref retained locator capability without reusing claim authority", () => {
    const contractListings = Object.freeze([
      listing("polymarket-us", "CONTRACT_RULE_DOCUMENT", {
        listingRef: "polymarket-us:house-dem",
        url: "https://gateway.polymarket.us/v1/market/slug/house-dem",
      }),
      listing("polymarket-us", "CONTRACT_RULE_DOCUMENT", {
        listingRef: "polymarket-us:house-rep",
        url: "https://gateway.polymarket.us/v1/market/slug/house-rep",
      }),
    ]);
    const refs = contractListings.map((item) => item.listingRef);
    const withoutLocators = contractListings.map((item) => Object.freeze({
      ...item,
      evidenceLocators: Object.freeze([]),
    }));
    const target = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs: refs,
      listings: withoutLocators,
      drafts: [{ ...draft("TIME_BOUNDARY", refs), temporalPosture: "CURRENT" }],
    })[0]!;
    const donor = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId: hashCanonical({ proposal: "donor" }),
      proposalListingRefs: refs,
      listings: contractListings,
      drafts: [{
        ...draft("TIME_BOUNDARY", refs),
        claim: "The donor asks a different time-boundary question.",
        temporalPosture: "CURRENT",
      }],
    })[0]!;
    const rebased = rebaseEvidenceRequirementToRetainedLocatorCapabilities(
      target,
      [donor],
    );

    expect(rebased).toMatchObject({
      schemaVersion: "pmh.evidence-requirement.v2",
      proposalId: target.proposalId,
      kind: "TIME_BOUNDARY",
      claim: target.claim,
      acquisitionRoute: "DOCUMENT_LOCATOR",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(rebased.requirementId).not.toBe(target.requirementId);
    expect(rebased.eligibleLocators).toHaveLength(2);
    expect(rebased.acquisitionScopeIdentity).toBe(donor.acquisitionScopeIdentity);
    expect(rebaseEvidenceRequirementToRetainedLocatorCapabilities(
      target,
      [donor],
    )).toEqual(rebased);

    const oracleTarget = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs: refs,
      listings: withoutLocators,
      drafts: [{ ...draft("ORACLE_SOURCE", refs), temporalPosture: "CURRENT" }],
    })[0]!;
    expect(rebaseEvidenceRequirementToRetainedLocatorCapabilities(
      oracleTarget,
      [donor],
    )).toBe(oracleTarget);

    const changedProtocolListings = contractListings.map((item) => {
      const protocolIdentity = "polymarket-us:v2";
      const locator = buildDiscoveryEvidenceLocator({
        venueId: item.venueId,
        protocolIdentity,
        role: "CONTRACT_RULE_DOCUMENT",
        url: item.evidenceLocators![0]!.url,
      });
      if (locator === null) throw new Error("missing changed-protocol locator");
      return Object.freeze({
        ...item,
        protocolIdentity,
        evidenceLocators: Object.freeze([locator]),
      });
    });
    const changedProtocolDonor = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId: hashCanonical({ proposal: "changed-protocol" }),
      proposalListingRefs: refs,
      listings: changedProtocolListings,
      drafts: [{ ...draft("TIME_BOUNDARY", refs), temporalPosture: "CURRENT" }],
    })[0]!;
    expect(rebaseEvidenceRequirementToRetainedLocatorCapabilities(
      target,
      [changedProtocolDonor],
    )).toBe(target);

    const oneRefCurrent = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs: refs,
      listings: withoutLocators,
      drafts: [{
        ...draft("TIME_BOUNDARY", [refs[0]!]),
        temporalPosture: "CURRENT",
      }],
    })[0]!;
    if (oneRefCurrent.schemaVersion !== "pmh.evidence-requirement.v2") {
      throw new Error("expected current evidence requirement schema");
    }
    const {
      proposalListingRefs: _proposalListingRefs,
      requirementId: _requirementId,
      schemaVersion: _schemaVersion,
      ...legacyFields
    } = oneRefCurrent;
    const legacyBody = Object.freeze({
      ...legacyFields,
      schemaVersion: "pmh.evidence-requirement.v1" as const,
    });
    const oneRefLegacy = assertEvidenceRequirement(Object.freeze({
      ...legacyBody,
      requirementId: hashCanonical(legacyBody),
    }));
    expect(rebaseEvidenceRequirementToRetainedLocatorCapabilities(
      oneRefLegacy,
      [donor],
    )).toBe(oneRefLegacy);
  });

  it("keeps contract rules and venue policy as separate evidence routes", () => {
    const contract = listing("venue-a", "CONTRACT_RULE_DOCUMENT", {
      listingRef: "venue-a:contract",
    });
    const venuePolicy = listing("venue-a", "VENUE_RULE_DOCUMENT", {
      listingRef: "venue-a:venue-policy",
    });
    const scopedListings = Object.freeze([contract, venuePolicy]);
    const refs = scopedListings.map((item) => item.listingRef);
    const requirements = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId,
      proposalListingRefs: refs,
      listings: scopedListings,
      drafts: [
        draft("RESOLUTION_RULE", [contract.listingRef]),
        draft("VENUE_POLICY", [venuePolicy.listingRef]),
      ],
    });
    expect(requirements.find((item) => item.kind === "RESOLUTION_RULE")
      ?.eligibleLocators.map((item) => item.locator.role)).toEqual([
        "CONTRACT_RULE_DOCUMENT",
      ]);
    expect(requirements.find((item) => item.kind === "VENUE_POLICY")
      ?.eligibleLocators.map((item) => item.locator.role)).toEqual([
        "VENUE_RULE_DOCUMENT",
      ]);
  });

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

    if (requirement.schemaVersion !== "pmh.evidence-requirement.v2") {
      throw new Error("expected current evidence requirement schema");
    }
    const narrowedProposalBody = {
      ...body,
      proposalListingRefs: ["venue-b:event"],
    };
    expect(() => assertEvidenceRequirement({
      ...narrowedProposalBody,
      requirementId: hashCanonical(narrowedProposalBody),
    })).toThrow(/proposal scope/);
  });
});
