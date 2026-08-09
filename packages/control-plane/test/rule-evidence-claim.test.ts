import { describe, expect, it, vi } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  AiUsageLedger,
  assertRuleEvidenceClaim,
  assertRuleEvidenceClaimRecord,
  buildDiscoveryEvidenceLocator,
  buildEvidenceDocumentFetchPolicy,
  buildEvidenceRequirements,
  buildRuleEvidenceClaim,
  createRuleEvidenceClaimDesk,
  DeepSeekRuleEvidenceClaimModelPort,
  EvidenceDocumentFetcher,
  RuleEvidenceClaimDesk,
  ruleEvidenceInterpreterIdentity,
  ruleEvidencePassageIdentity,
  type DiscoveryCatalogListing,
  type EvidenceDocumentCapture,
  type EvidenceDocumentFetchLike,
  type EvidenceRequirement,
  type RuleEvidenceClaimModelPort,
  type RuleEvidenceClaimRecordStore,
} from "../src/index.js";
import { deepSeekTextResponse, deepSeekToolResponse } from "./model-agent-fixtures.js";

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
    expect(buildRuleEvidenceClaim({
      requirement: input,
      capture: observed,
      model: "deepseek-v4-flash",
      completedAt: "2026-08-02T08:00:02.000Z",
      result: {
        draft: {
          disposition: "SUPPORTS",
          rationale: "The clause supports cancellation resolution while retaining a caveat.",
          citations: [{ start, end: start + quote.length, quote }],
          unresolvedEvidence: ["The generic rule does not identify a specific listing."],
        },
        trace: {
          searchEffectCount: 1,
          readEffectCount: 0,
          submittedEffectHash: hashCanonical({ effect: "caveated-support" }),
        },
      },
    })).toMatchObject({
      disposition: "SUPPORTS",
      citations: [{ quote }],
      unresolvedEvidence: ["The generic rule does not identify a specific listing."],
    });
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
    const queryStart = observed.extraction.text.toLocaleLowerCase("en-US").indexOf("cancelled");
    const passageStart = Math.max(0, queryStart - 240);
    const passageEnd = Math.min(
      observed.extraction.text.length,
      queryStart + "cancelled".length + 240,
    );
    const passageId = ruleEvidencePassageIdentity(
      observed.extraction.record.extractionId,
      passageStart,
      passageEnd,
    );
    const bodies: Record<string, unknown>[] = [];
    const validSubmission = {
      disposition: "SUPPORTS",
      rationale: "The exact official clause supplies the satisfying observation.",
      citations: [{ passageId }],
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
            citations: [{ passageId: hashCanonical({ unknown: "passage" }) }],
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
    expect(JSON.stringify(bodies[3])).toContain("passageId was not returned");
    expect(bodies.every((body) => !("response_format" in body))).toBe(true);
    expect(result).toMatchObject({
      draft: {
        disposition: "SUPPORTS",
        citations: [{
          start: passageStart,
          end: passageEnd,
          quote: observed.extraction.text.slice(passageStart, passageEnd),
        }],
      },
      trace: { searchEffectCount: 1, readEffectCount: 0 },
    });
  });

  it("retains provider usage when the interpreter omits its terminal claim effect", async () => {
    const input = requirement();
    const observed = await capture();
    const usageLedger = new AiUsageLedger();
    const port = new DeepSeekRuleEvidenceClaimModelPort(
      "deepseek-v4-flash",
      "test-only-key",
      1_800,
      3_000,
      async () => deepSeekTextResponse("The clause is ambiguous.", 1),
      usageLedger,
    );

    await expect(port.interpret({ requirement: input, capture: observed })).rejects.toThrow(
      /without its terminal claim effect/u,
    );
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      coverage: { complete: 1, unavailable: 0 },
      byPurpose: [{ key: "RULE_EVIDENCE_CLAIM", invocationCount: "1" }],
      byOutcome: [{ key: "FAILED", invocationCount: "1" }],
      totals: {
        durableEffectCount: "0",
        tokens: { inputTokens: "100", outputTokens: "20", totalTokens: "120" },
      },
    });
  });

  it("forces a terminal claim after a bounded document-reading loop", async () => {
    const input = requirement();
    const observed = await capture();
    let requests = 0;
    const port = new DeepSeekRuleEvidenceClaimModelPort(
      "deepseek-v4-flash",
      "test-only-key",
      1_800,
      3_000,
      async () => {
        requests += 1;
        if (requests === 15) {
          return deepSeekToolResponse(
            "submit_rule_evidence_claim",
            {
              disposition: "INCONCLUSIVE",
              rationale: "The retained document does not settle the requirement.",
              citations: [],
              unresolvedEvidence: ["A requirement-specific clause was not found."],
            },
            requests,
          );
        }
        return deepSeekToolResponse(
          "search_evidence_text",
          { query: "cancelled" },
          requests,
        );
      },
    );

    const result = await port.interpret({ requirement: input, capture: observed });
    expect(requests).toBe(15);
    expect(result).toMatchObject({
      draft: {
        disposition: "INCONCLUSIVE",
        citations: [],
        unresolvedEvidence: ["A requirement-specific clause was not found."],
      },
      trace: { searchEffectCount: 14, readEffectCount: 0 },
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

  it("retains legacy protocol records while scheduling the current range-citation protocol", async () => {
    const input = requirement();
    const observed = await capture();
    const quote = "if the event is cancelled, this contract resolves No.";
    const start = observed.extraction.text.indexOf(quote);
    const currentClaim = buildRuleEvidenceClaim({
      requirement: input,
      capture: observed,
      model: "deepseek-v4-flash",
      completedAt: "2026-08-02T08:00:01.000Z",
      result: {
        draft: {
          disposition: "SUPPORTS",
          rationale: "Exact clause supports the requirement.",
          citations: [{ start, end: start + quote.length, quote }],
          unresolvedEvidence: [],
        },
        trace: {
          searchEffectCount: 1,
          readEffectCount: 0,
          submittedEffectHash: hashCanonical({ effect: "legacy" }),
        },
      },
    });
    const legacyIdentity = ruleEvidenceInterpreterIdentity(
      "deepseek-v4-flash",
      "LEGACY_V1",
    );
    const legacyClaimId = hashCanonical({
      schemaVersion: "pmh.rule-evidence-interpretation-run.v1",
      requirementId: input.requirementId,
      documentId: observed.document.record.documentId,
      extractionId: observed.extraction.record.extractionId,
      interpreterIdentity: legacyIdentity,
    });
    const { artifactHash: _currentHash, ...currentBody } = currentClaim;
    const legacyBody = Object.freeze({
      ...currentBody,
      claimId: legacyClaimId,
      interpreter: Object.freeze({ ...currentClaim.interpreter, identity: legacyIdentity }),
    });
    const legacyClaim = assertRuleEvidenceClaim(Object.freeze({
      ...legacyBody,
      artifactHash: hashCanonical(legacyBody),
    }));
    const legacyRecord = assertRuleEvidenceClaimRecord(Object.freeze({
      interpretationId: legacyClaimId,
      requirementId: input.requirementId,
      proposalId: input.proposalId,
      documentId: observed.document.record.documentId,
      extractionId: observed.extraction.record.extractionId,
      interpreterIdentity: legacyIdentity,
      model: "deepseek-v4-flash",
      status: "PASS" as const,
      startedAt: "2026-08-02T08:00:00.000Z",
      completedAt: legacyClaim.completedAt,
      diagnostic: null,
      claim: legacyClaim,
    }));
    const retained = [legacyRecord];
    const store: RuleEvidenceClaimRecordStore = {
      ruleEvidenceClaimStorage: Object.freeze({
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "interpretationId",
      }),
      loadRuleEvidenceClaimRecords: () => retained,
      saveRuleEvidenceClaimRecord: (record) => record,
    };
    const interpret = vi.fn<RuleEvidenceClaimModelPort["interpret"]>(async () => ({
      draft: {
        disposition: currentClaim.disposition,
        rationale: currentClaim.rationale,
        citations: currentClaim.citations.map(({ start, end, quote }) => ({ start, end, quote })),
        unresolvedEvidence: currentClaim.unresolvedEvidence,
      },
      trace: {
        searchEffectCount: 1,
        readEffectCount: 0,
        submittedEffectHash: hashCanonical({ effect: "current" }),
      },
    }));
    const desk = new RuleEvidenceClaimDesk(
      { interpret },
      "deepseek-v4-flash",
      10,
      store,
      3,
      () => Date.parse("2026-08-02T08:00:02.000Z"),
    );

    expect(desk.projection()).toMatchObject({ runCount: 1, passCount: 1 });
    expect(desk.interpreterIdentity).not.toBe(legacyIdentity);
    const currentRun = desk.begin(input, observed);
    expect(currentRun.idempotentReplay).toBe(false);
    const currentRecord = await currentRun.promise;
    expect(interpret).toHaveBeenCalledOnce();
    expect(currentRecord.interpreterIdentity).toBe(desk.interpreterIdentity);
    expect(currentRecord.interpretationId).not.toBe(legacyRecord.interpretationId);
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
