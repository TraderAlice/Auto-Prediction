import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  admitOfficialSourceCandidate,
  buildEvidenceRequirements,
  buildOfficialSourceCandidate,
  buildOfficialSourceDiscoveryTask,
  hasBoundedDiscoveryEvidenceLocators,
  rebaseEvidenceRequirementToAdmittedLocator,
  type DiscoveryCatalogListing,
} from "../src/index.js";

function listing(
  venueId: string,
  listingRef: string,
  protocolIdentity: string,
): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId: listingRef.split(":").at(-1) ?? listingRef,
    title: "Will Los Angeles FC win the 2026 MLS Cup?",
    description: "A prediction contract requiring exact settlement rules.",
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2026-12-06T00:00:00.000Z",
    rulesText: null,
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.1" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.9" }),
    ]),
    priceScale: "100000000",
    quantityScale: "100000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity,
  });
}

function unsupportedRequirement() {
  const gemini = listing(
    "gemini-predictions",
    "gemini-predictions:mls-lafc",
    "prediction-markets-v1:2026-07-30",
  );
  const peer = listing("kalshi", "kalshi:mls-lafc", "kalshi-v1");
  return buildEvidenceRequirements({
    origin: "PROBABILITY_ESTIMATION",
    proposalId: hashCanonical({ proposal: "mls" }),
    proposalListingRefs: [gemini.listingRef, peer.listingRef],
    listings: [gemini, peer],
    drafts: [Object.freeze({
      kind: "TIME_BOUNDARY" as const,
      listingRefs: [gemini.listingRef],
      claim: "The exact Gemini contract expiry and match scope are known.",
      reason: "The probability relation changes if postseason matches are excluded.",
      satisfyingObservation: "Official contract terms state the exact time boundary.",
      contradictingObservation: "Official terms use a different competition window.",
      temporalPosture: "CURRENT" as const,
    })],
  })[0]!;
}

describe("official source discovery", () => {
  it("keeps Agent URL proposals inert until first-party admission mints a locator", () => {
    const requirement = unsupportedRequirement();
    expect(requirement.acquisitionRoute).toBe("UNSUPPORTED");
    const task = buildOfficialSourceDiscoveryTask({
      requirement,
      priorityTier: "EVIDENCE_ESCALATION",
    });
    expect(task).not.toBeNull();
    const geminiSurface = task!.surfaces.find((item) =>
      item.venueId === "gemini-predictions"
    )!;
    const candidate = buildOfficialSourceCandidate(task!, {
      url: "https://developer.gemini.com/prediction-markets/prediction-markets/contract-terms",
      sourceSurfaceId: geminiSurface.surfaceId,
      title: "Gemini prediction-market contract terms",
      evidenceRole: "CONTRACT_RULE_DOCUMENT",
      evidenceScope: "CONTRACT_SPECIFIC",
      temporalPosture: "CURRENT",
      rationale: "The official page names the contract settlement window.",
    });
    expect(candidate.fetchAuthority).toBe(false);
    const admission = admitOfficialSourceCandidate({
      task: task!,
      candidate,
      admittedAt: "2026-08-10T01:00:00.000Z",
    });
    expect(admission).toMatchObject({ decision: "ADMITTED", reason: "ADMITTED" });
    expect(admission.locator?.schemaVersion).toBe("pmh.discovery-evidence-locator.v3");
    expect(admission.locator?.fetchAuthority).toBe(false);
    expect(hasBoundedDiscoveryEvidenceLocators({
      venueId: admission.venueId!,
      protocolIdentity: admission.protocolIdentity!,
      evidenceLocators: [admission.locator!],
    })).toBe(true);
    const routed = rebaseEvidenceRequirementToAdmittedLocator({
      requirement,
      venueId: admission.venueId!,
      protocolIdentity: admission.protocolIdentity!,
      locator: admission.locator!,
    });
    expect(routed.acquisitionRoute).toBe("DOCUMENT_LOCATOR");
    expect(routed.requirementId).not.toBe(requirement.requirementId);
    expect(routed.eligibleLocators[0]?.locator.locatorIdentity)
      .toBe(admission.locator?.locatorIdentity);
  });

  it("rejects an off-surface candidate without minting fetch capability", () => {
    const requirement = unsupportedRequirement();
    const task = buildOfficialSourceDiscoveryTask({
      requirement,
      priorityTier: "RETAINED_RESEARCH_DEBT",
    })!;
    const candidate = buildOfficialSourceCandidate(task, {
      url: "https://example.com/looks-official.pdf",
      sourceSurfaceId: task.surfaces[0]!.surfaceId,
      title: "Untrusted mirror",
      evidenceRole: "CONTRACT_RULE_DOCUMENT",
      evidenceScope: "CONTRACT_SPECIFIC",
      temporalPosture: "CURRENT",
      rationale: "A search result claimed this was a copy.",
    });
    const admission = admitOfficialSourceCandidate({
      task,
      candidate,
      admittedAt: "2026-08-10T01:00:00.000Z",
    });
    expect(admission).toMatchObject({
      decision: "REJECTED",
      reason: "HOST_OUTSIDE_OFFICIAL_SURFACE",
      locator: null,
      fetchAuthority: false,
    });
  });
});
