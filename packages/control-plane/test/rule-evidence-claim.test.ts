import { describe, expect, it, vi } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildDiscoveryEvidenceLocator,
  buildEvidenceDocumentFetchPolicy,
  buildEvidenceRequirements,
  buildRuleEvidenceClaim,
  createRuleEvidenceClaimDesk,
  DeepSeekRuleEvidenceClaimModelPort,
  EvidenceDocumentFetcher,
  RuleEvidenceClaimDesk,
  type DiscoveryCatalogListing,
  type EvidenceDocumentCapture,
  type EvidenceDocumentFetchLike,
  type EvidenceRequirement,
  type RuleEvidenceClaimModelPort,
} from "../src/index.js";
import { deepSeekToolResponse } from "./model-agent-fixtures.js";

const now = () => Date.parse("2026-08-02T08:00:00.000Z");
const publicResolver = async () => Object.freeze([
  Object.freeze({ address: "8.8.8.8", family: 4 as const }),
]);

function listing(listingRef: string): DiscoveryCatalogListing {
  const locator = buildDiscoveryEvidenceLocator({
    venueId: "claim-test",
    protocolIdentity: "claim-test:v1",
    role: "CONTRACT_RULE_DOCUMENT",
    url: "https://rules.example.com/contract.txt",
  });
  if (locator === null) throw new Error("claim test locator failed");
  return Object.freeze({
    listingRef,
    venueId: "claim-test",
    venueInstrumentId: listingRef,
    title: "Will the event happen?",
    description: "Claim test listing.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: null,
    evidenceLocators: Object.freeze([locator]),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-02T07:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity: "claim-test:v1",
  });
}

function requirement(): EvidenceRequirement {
  const first = listing("claim-test:first");
  const second = Object.freeze({
    ...listing("claim-test:second"),
    evidenceLocators: undefined,
  });
  return buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId: hashCanonical({ proposal: "claim-test" }),
    proposalListingRefs: [first.listingRef, second.listingRef],
    listings: [first, second],
    drafts: [Object.freeze({
      kind: "VOID_CANCELLATION" as const,
      listingRefs: Object.freeze([first.listingRef]),
      claim: "A cancellation makes the contract resolve No.",
      reason: "The joint settlement state depends on cancellation treatment.",
      satisfyingObservation: "The official rule says cancellation resolves No.",
      contradictingObservation: "The official rule says cancellation voids the contract.",
      temporalPosture: "CURRENT" as const,
    })],
  })[0]!;
}

async function capture(
  text = "Official rule: if the event is cancelled, this contract resolves No.",
): Promise<EvidenceDocumentCapture> {
  const policy = buildEvidenceDocumentFetchPolicy({
    venueId: "claim-test",
    protocolIdentity: "claim-test:v1",
    role: "CONTRACT_RULE_DOCUMENT",
    allowedHostnames: ["rules.example.com"],
    allowedContentTypes: ["text/plain"],
  });
  const fetcher = new EvidenceDocumentFetcher({
    policies: [policy],
    fetch: async () => new Response(text, {
      status: 200,
      headers: { "content-type": "text/plain", etag: "\"claim-v1\"" },
    }),
    resolve: publicResolver,
    now,
  });
  const input = requirement();
  return fetcher.capture({
    requirement: input,
    locatorIdentity: input.eligibleLocators[0]!.locator.locatorIdentity,
  });
}

describe("Agent-native rule evidence claims", () => {
  it("binds exact passages to requirement and immutable capture lineage", async () => {
    const input = requirement();
    const observed = await capture();
    const quote = "if the event is cancelled, this contract resolves No.";
    const start = observed.extraction.text.indexOf(quote);
    const claim = buildRuleEvidenceClaim({
      requirement: input,
      capture: observed,
      model: "deepseek-v4-flash",
      completedAt: "2026-08-02T08:00:01.000Z",
      result: {
        draft: {
          disposition: "SUPPORTS",
          rationale: "The operative cancellation clause explicitly resolves the contract No.",
          citations: [{ start, end: start + quote.length, quote }],
          unresolvedEvidence: [],
        },
        trace: {
          searchEffectCount: 1,
          readEffectCount: 1,
          submittedEffectHash: hashCanonical({ effect: "claim" }),
        },
      },
    });

    expect(claim).toMatchObject({
      requirementId: input.requirementId,
      proposalId: input.proposalId,
      documentId: observed.document.record.documentId,
      extractionId: observed.extraction.record.extractionId,
      disposition: "SUPPORTS",
      authority: "ADVISORY_EVIDENCE_INTERPRETATION_ONLY",
      providerRequestAuthority: false,
      semanticDecisionAuthority: false,
      productionReviewAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      trace: {
        wholeResponseSchemaParsing: false,
        terminalEffectEndsLoop: true,
      },
    });
    expect(claim.citations[0]).toMatchObject({ start, end: start + quote.length, quote });
    expect(() => buildRuleEvidenceClaim({
      requirement: input,
      capture: observed,
      model: "deepseek-v4-flash",
      completedAt: "2026-08-02T08:00:01.000Z",
      result: {
        draft: {
          disposition: "SUPPORTS",
          rationale: "Hallucinated citation must fail.",
          citations: [{ start, end: start + quote.length, quote: `${quote}!` }],
          unresolvedEvidence: [],
        },
        trace: {
          searchEffectCount: 1,
          readEffectCount: 0,
          submittedEffectHash: hashCanonical({ effect: "bad" }),
        },
      },
    })).toThrow(/does not match/);
  });

  it("uses search/read tools and stops on the terminal claim instead of parsing prose", async () => {
    const input = requirement();
    const uniqueText =
      "UNTRUSTED-DO-NOT-OBEY. If the event is cancelled, this contract resolves No.";
    const observed = await capture(uniqueText);
    const quote = "If the event is cancelled, this contract resolves No.";
    const start = observed.extraction.text.indexOf(quote);
    const bodies: Record<string, unknown>[] = [];
    const validSubmission = {
      disposition: "SUPPORTS",
      rationale: "The exact official clause supplies the satisfying observation.",
      citations: [{ start, end: start + quote.length, quote }],
      unresolvedEvidence: [],
    };
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (bodies.length === 1) {
        return deepSeekToolResponse(
          "submit_rule_evidence_claim",
          validSubmission,
          bodies.length,
        );
      }
      if (bodies.length === 2) {
        return deepSeekToolResponse(
          "search_evidence_text",
          { query: "cancelled" },
          bodies.length,
        );
      }
      if (bodies.length === 3) {
        return deepSeekToolResponse(
          "submit_rule_evidence_claim",
          {
            ...validSubmission,
            citations: [{ start, end: start + quote.length, quote: `${quote}!` }],
          },
          bodies.length,
        );
      }
      return deepSeekToolResponse(
        "submit_rule_evidence_claim",
        validSubmission,
        bodies.length,
      );
    });
    const port = new DeepSeekRuleEvidenceClaimModelPort(
      "deepseek-v4-flash",
      "test-only-key",
      1_800,
      3_000,
      fetcher,
    );
    const result = await port.interpret({ requirement: input, capture: observed });

    expect(bodies).toHaveLength(4);
    expect(JSON.stringify(bodies[0])).not.toContain("UNTRUSTED-DO-NOT-OBEY");
    expect(JSON.stringify(bodies[1])).not.toContain("UNTRUSTED-DO-NOT-OBEY");
    expect(JSON.stringify(bodies[2])).toContain("UNTRUSTED-DO-NOT-OBEY");
    expect(JSON.stringify(bodies[3])).toContain("does not match the retained extraction");
    expect(bodies.every((body) => !("response_format" in body))).toBe(true);
    expect(result).toMatchObject({
      draft: { disposition: "SUPPORTS" },
      trace: { searchEffectCount: 1, readEffectCount: 0 },
    });
  });

  it("persists only validated terminal claims and replays an identical run", async () => {
    const input = requirement();
    const observed = await capture();
    const quote = "if the event is cancelled, this contract resolves No.";
    const start = observed.extraction.text.indexOf(quote);
    const interpret = vi.fn<RuleEvidenceClaimModelPort["interpret"]>(async () => ({
      draft: {
        disposition: "SUPPORTS",
        rationale: "Exact clause supports the requirement.",
        citations: [{ start, end: start + quote.length, quote }],
        unresolvedEvidence: [],
      },
      trace: {
        searchEffectCount: 1,
        readEffectCount: 0,
        submittedEffectHash: hashCanonical({ effect: "desk" }),
      },
    }));
    const desk = new RuleEvidenceClaimDesk(
      { interpret },
      "deepseek-v4-flash",
      10,
      undefined,
      3,
      now,
    );
    const first = desk.begin(input, observed);
    const second = desk.begin(input, observed);
    expect(first.idempotentReplay).toBe(false);
    expect(second.idempotentReplay).toBe(true);
    const [firstRecord, secondRecord] = await Promise.all([first.promise, second.promise]);
    expect(firstRecord).toEqual(secondRecord);
    expect(firstRecord).toMatchObject({ status: "PASS", claim: { disposition: "SUPPORTS" } });
    expect(interpret).toHaveBeenCalledOnce();
    expect(desk.projection()).toMatchObject({
      configured: true,
      status: "IDLE",
      runCount: 1,
      passCount: 1,
      failedCount: 0,
    });
  });

  it("defaults to a five-minute configurable DeepSeek desk without requiring a key", () => {
    expect(createRuleEvidenceClaimDesk({}).projection()).toMatchObject({
      configured: false,
      model: "deepseek-v4-flash",
      status: "NEEDS_KEY",
    });
    expect(() => createRuleEvidenceClaimDesk({
      DEEPSEEK_API_KEY: "test-key",
      PMH_EVIDENCE_CLAIM_TIMEOUT_MS: "999",
    })).toThrow(/PMH_EVIDENCE_CLAIM_TIMEOUT_MS/);
  });
});
