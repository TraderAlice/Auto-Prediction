import { describe, expect, it, vi } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildDiscoveryEvidenceLocator,
  buildEvidenceDocumentFetchPolicy,
  buildEvidenceEnrichedSemanticScope,
  buildEvidenceRequirements,
  buildMarketCorpusSnapshot,
  buildProposalEvidenceBundle,
  buildRuleEvidenceClaim,
  createSemanticReviewDesk,
  deriveSemanticReviewScope,
  EvidenceDocumentFetcher,
  SemanticReviewScheduler,
  type DiscoveryCatalogListing,
  type EvidenceRequirementDraft,
  type MarketRelationProposal,
  type SemanticReviewCandidate,
  type SemanticReviewModelInput,
} from "../src/index.js";

const timestamp = "2026-08-02T10:00:00.000Z";
const now = () => Date.parse(timestamp);

function listing(listingRef: string, locator = false): DiscoveryCatalogListing {
  const evidenceLocator = locator ? buildDiscoveryEvidenceLocator({
    venueId: listingRef.split(":")[0]!,
    protocolIdentity: "enriched-test:v1",
    role: "CONTRACT_RULE_DOCUMENT",
    url: "https://rules.example.com/enriched.txt",
  }) : null;
  if (locator && evidenceLocator === null) throw new Error("enriched locator failed");
  return Object.freeze({
    listingRef,
    venueId: listingRef.split(":")[0]!,
    venueInstrumentId: listingRef,
    title: `${listingRef} bounded event`,
    description: "Two contracts with a disputed cancellation relationship.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: locator ? null : "Resolves Yes if the named event occurs.",
    ...(evidenceLocator === null
      ? {}
      : { evidenceLocators: Object.freeze([evidenceLocator]) }),
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: null }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: null }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: timestamp,
    sourceRawHash: hashCanonical({ listingRef }),
    protocolIdentity: "enriched-test:v1",
  });
}

describe("evidence-enriched semantic review", () => {
  it("creates a new durable review scope and reruns the same proposal with exact claims", async () => {
    const left = listing("venue-a:event", true);
    const right = listing("venue-b:event");
    const snapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "enriched-test" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: [left, right],
    });
    const proposalBody = Object.freeze({
      relationKind: "MUTUALLY_EXCLUSIVE" as const,
      listingRefs: Object.freeze([left.listingRef, right.listingRef]),
      statement: "The two contracts cannot both settle Yes.",
      rationale: "A cancellation clause may exclude the disputed joint state.",
      falsifiers: Object.freeze(["Both contracts can resolve Yes after cancellation."]),
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      executionAuthority: false as const,
    });
    const proposal: MarketRelationProposal = Object.freeze({
      ...proposalBody,
      proposalId: hashCanonical({
        corpusSnapshotIdentity: snapshot.snapshotIdentity,
        ...proposalBody,
      }),
    });
    const bundle = buildProposalEvidenceBundle(proposal, snapshot);
    if (bundle.schemaVersion !== "pmh.proposal-evidence-bundle.v2") {
      throw new Error("enriched test requires a durable bundle");
    }
    const requirementDraft: EvidenceRequirementDraft = Object.freeze({
      kind: "VOID_CANCELLATION",
      listingRefs: Object.freeze([left.listingRef]),
      claim: "Cancellation makes the left contract resolve No.",
      reason: "The disputed both-Yes state depends on cancellation treatment.",
      satisfyingObservation: "The official left rule resolves cancellation No.",
      contradictingObservation: "The official left rule allows Yes after cancellation.",
      temporalPosture: "CURRENT",
    });
    const requirement = buildEvidenceRequirements({
      origin: "SEMANTIC_REVIEW",
      proposalId: proposal.proposalId,
      proposalListingRefs: proposal.listingRefs,
      listings: bundle.listings,
      drafts: [requirementDraft],
    })[0]!;
    const fetcher = new EvidenceDocumentFetcher({
      policies: [buildEvidenceDocumentFetchPolicy({
        venueId: left.venueId,
        protocolIdentity: left.protocolIdentity,
        role: "CONTRACT_RULE_DOCUMENT",
        allowedHostnames: ["rules.example.com"],
        allowedContentTypes: ["text/plain"],
      })],
      fetch: async () => new Response(
        "Official rule: cancellation makes the left contract resolve No.",
        { status: 200, headers: { "content-type": "text/plain" } },
      ),
      resolve: async () => Object.freeze([
        Object.freeze({ address: "8.8.8.8", family: 4 as const }),
      ]),
      now,
    });
    const capture = await fetcher.capture({
      requirement,
      locatorIdentity: requirement.eligibleLocators[0]!.locator.locatorIdentity,
    });
    const quote = "cancellation makes the left contract resolve No.";
    const start = capture.extraction.text.indexOf(quote);
    const claim = buildRuleEvidenceClaim({
      requirement,
      capture,
      model: "deepseek-v4-flash",
      completedAt: timestamp,
      result: {
        draft: {
          disposition: "SUPPORTS",
          rationale: "The exact clause supplies the required cancellation observation.",
          citations: [{ start, end: start + quote.length, quote }],
          unresolvedEvidence: [],
        },
        trace: {
          searchEffectCount: 1,
          readEffectCount: 0,
          submittedEffectHash: hashCanonical({ effect: "enriched-claim" }),
        },
      },
    });
    const enrichedArtifact = buildEvidenceEnrichedSemanticScope({
      evidenceBundle: bundle,
      claims: [claim],
    });
    const baseScope = deriveSemanticReviewScope(proposal, bundle);
    const enrichedScope = deriveSemanticReviewScope(proposal, bundle, [claim]);
    expect(enrichedScope).toMatchObject({
      schemaVersion: "pmh.semantic-review-scope.v2",
      evidenceEnrichmentIdentity: enrichedArtifact.scopeIdentity,
    });
    expect(enrichedScope.scopeIdentity).not.toBe(baseScope.scopeIdentity);

    const inputs: SemanticReviewModelInput[] = [];
    const review = vi.fn(async (input: SemanticReviewModelInput) => {
      inputs.push(input);
      const enriched = (input.evidenceClaims?.length ?? 0) > 0;
      return {
        recommendation: enriched
          ? "ACCEPT_FOR_RESEARCH_SIMULATION" as const
          : "ESCALATE" as const,
        relationConclusion: "MUTUALLY_EXCLUSIVE" as const,
        assessments: {
          outcomeMapping: "Binary outcomes map directly.",
          timingAndClose: "The bounded intervals are aligned.",
          voidAndCancellation: enriched
            ? "The exact cited cancellation passage resolves the gap."
            : "The cancellation clause is absent from the base listing.",
          resolutionSources: "The captured document is venue-authored.",
        },
        counterexamples: [],
        missingEvidence: enriched ? [] : ["Official cancellation clause."],
        rationale: enriched
          ? "The new passage rules out the disputed joint state."
          : "The base corpus cannot exclude the joint state.",
        constraintDraft: {
          classification: enriched
            ? "HARD_SETTLEMENT_CONSTRAINT" as const
            : "PROBABILISTIC_DEPENDENCE" as const,
          assumptions: enriched ? ["The captured rule governs the left contract."] : [],
          truthTable: [
            { truths: [false, false], disposition: "FEASIBLE" as const, rationale: "Neither.", evidenceListingRefs: [] },
            { truths: [false, true], disposition: "FEASIBLE" as const, rationale: "Right only.", evidenceListingRefs: [right.listingRef] },
            { truths: [true, false], disposition: "FEASIBLE" as const, rationale: "Left only.", evidenceListingRefs: [left.listingRef] },
            { truths: [true, true], disposition: enriched ? "IMPOSSIBLE" as const : "UNRESOLVED" as const, rationale: "Cancellation controls this state.", evidenceListingRefs: [left.listingRef] },
          ],
          unresolvedEvidence: enriched ? [] : ["Official cancellation clause."],
          relationKind: "MUTUALLY_EXCLUSIVE" as const,
          counterexampleAttempt: {
            attempted: true,
            result: enriched ? "NOT_FOUND" as const : "INCONCLUSIVE" as const,
            narrative: enriched ? "The official passage defeats the both-Yes state." : "Missing rule.",
            truths: [true, true],
          },
        },
        evidenceRequirementDrafts: enriched ? [] : [requirementDraft],
        toolTrace: {
          counterexampleEffectCount: 1,
          submittedEffectHash: hashCanonical({ enriched }),
        },
      };
    });
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-key" },
      { reviewer: { review }, concurrencyLimit: 1 },
    );
    const scheduler = new SemanticReviewScheduler({
      reviewDesk: desk,
      tickIntervalMs: 1_000,
      concurrencyLimit: 1,
      maxRequestsPerTick: 1,
      now,
    });
    const baseCandidate: SemanticReviewCandidate = Object.freeze({
      proposal,
      proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
      evidenceBundle: bundle,
      issueIds: Object.freeze([hashCanonical({ issue: "enriched" })]),
      priority: 5,
    });
    await Promise.all(scheduler.tick([baseCandidate], snapshot));
    expect(scheduler.projection()).toMatchObject({ passedCount: 1 });
    const firstReviewId = scheduler.projection().jobs[0]!.lastReviewId;

    const enrichedCandidate: SemanticReviewCandidate = Object.freeze({
      ...baseCandidate,
      evidenceClaims: Object.freeze([claim]),
    });
    const rerun = scheduler.tick([enrichedCandidate], snapshot);
    expect(rerun).toHaveLength(1);
    await Promise.all(rerun);

    expect(review).toHaveBeenCalledTimes(2);
    expect(inputs[0]!.evidenceClaims).toBeUndefined();
    expect(inputs[1]!.evidenceClaims).toEqual([claim]);
    const job = scheduler.projection().jobs[0]!;
    expect(job).toMatchObject({
      schemaVersion: "pmh.semantic-review-job.v2",
      status: "PASS",
      reviewScopeIdentity: enrichedScope.scopeIdentity,
      recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION",
      evidenceClaims: [{ claimId: claim.claimId }],
    });
    expect(job.lastReviewId).not.toBe(firstReviewId);
    expect(scheduler.projection().unreadNotificationCount).toBe(2);
    expect(desk.projection().records).toHaveLength(2);
    const enrichedReport = desk.projection().records.find((record) =>
      record.report?.schemaVersion === "pmh.semantic-review-report.v4"
    )?.report;
    expect(enrichedReport).toMatchObject({
      input: {
        corpusSnapshotIdentity: enrichedScope.scopeIdentity,
        evidencePosture: "ENRICHED_EVIDENCE_SCOPE",
        semanticReviewScopeIdentity: enrichedScope.scopeIdentity,
        evidenceClaims: [{ claimId: claim.claimId }],
      },
      result: {
        recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION",
        semanticConstraint: {
          classification: "HARD_SETTLEMENT_CONSTRAINT",
          evidenceCorpusSnapshotIdentity: enrichedScope.scopeIdentity,
        },
      },
      trace: {
        structuredRuleEvidenceClaims: true,
        wholeResponseSchemaParsing: false,
      },
    });
  });
});
