import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildMarketCorpusSnapshot,
  buildDiscoveryEvidenceLocator,
  buildProposalEvidenceBundle,
  deriveSemanticReviewScope,
  selectCurrentSemanticEvidenceBundle,
  type MarketCorpusSnapshot,
  type MarketRelationProposal,
} from "../src/index.js";
import type { DiscoveryCatalogListing } from "../src/types.js";

function listing(
  listingRef: string,
  overrides: Partial<DiscoveryCatalogListing> = {},
): DiscoveryCatalogListing {
  const venueId = listingRef.split(":")[0] ?? "fixture";
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId: listingRef,
    title: `${listingRef} title`,
    description: "Same bounded event description.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-08-31T00:00:00.000Z",
    rulesText: "Resolves Yes if the bounded event occurs.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.4" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.6" }),
    ]),
    priceScale: "10000",
    quantityScale: "1000",
    minPriceTick: "100",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ listingRef, capture: 1 }),
    protocolIdentity: "fixture-v1",
    ...overrides,
  });
}

function snapshot(
  listings: readonly DiscoveryCatalogListing[],
  capture = 1,
): MarketCorpusSnapshot {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "scope-test", capture }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings,
  });
}

function proposal(
  corpus: MarketCorpusSnapshot,
  relationKind: MarketRelationProposal["relationKind"],
  listingRefs: readonly string[],
  variant: string,
): MarketRelationProposal {
  const body = Object.freeze({
    relationKind,
    listingRefs: Object.freeze([...listingRefs]),
    statement: `Bounded relation statement ${variant}.`,
    rationale: `Bounded rationale ${variant}.`,
    falsifiers: Object.freeze([`Bounded falsifier ${variant}.`]),
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  });
  return Object.freeze({
    ...body,
    proposalId: hashCanonical({
      corpusSnapshotIdentity: corpus.snapshotIdentity,
      ...body,
    }),
  });
}

function scope(
  corpus: MarketCorpusSnapshot,
  relationKind: MarketRelationProposal["relationKind"],
  refs: readonly string[],
  variant: string,
) {
  const item = proposal(corpus, relationKind, refs, variant);
  return deriveSemanticReviewScope(
    item,
    buildProposalEvidenceBundle(item, corpus),
  );
}

describe("semantic review scope identity", () => {
  const left = listing("venue-a:event");
  const right = listing("venue-b:event");
  const corpus = snapshot([left, right]);

  it("ignores model phrasing and canonicalizes symmetric relation order", () => {
    const first = scope(corpus, "EQUIVALENT", [left.listingRef, right.listingRef], "one");
    const second = scope(corpus, "EQUIVALENT", [right.listingRef, left.listingRef], "two");

    expect(first.proposalId).not.toBe(second.proposalId);
    expect(first.scopeIdentity).toBe(second.scopeIdentity);
    expect(first.canonicalListingRefs).toEqual([left.listingRef, right.listingRef]);
    expect(first.priceIndependent).toBe(true);
  });

  it.each(["IMPLIES", "SUBSET"] as const)(
    "preserves direction for %s",
    (relationKind) => {
      const forward = scope(corpus, relationKind, [left.listingRef, right.listingRef], "forward");
      const reverse = scope(corpus, relationKind, [right.listingRef, left.listingRef], "reverse");
      expect(forward.scopeIdentity).not.toBe(reverse.scopeIdentity);
    },
  );

  it("ignores price, receive-time, raw-response, tick, and status churn", () => {
    const changedListings = [left, right].map((item) => listing(item.listingRef, {
      status: "CLOSED",
      minPriceTick: "10",
      sourceReceivedAt: "2026-08-03T00:00:00.000Z",
      sourceRawHash: hashCanonical({ listingRef: item.listingRef, capture: 2 }),
      outcomes: Object.freeze(item.outcomes.map((outcome) => Object.freeze({
        ...outcome,
        indicativePrice: outcome.venueOutcomeId === "yes" ? "0.9" : "0.1",
      }))),
    }));
    const changedCorpus = snapshot(changedListings, 2);

    expect(
      scope(corpus, "EQUIVALENT", [left.listingRef, right.listingRef], "first").scopeIdentity,
    ).toBe(
      scope(changedCorpus, "EQUIVALENT", [left.listingRef, right.listingRef], "second").scopeIdentity,
    );
  });

  it("changes when contract semantics or protocol identity changes", () => {
    const changedCorpus = snapshot([
      left,
      listing(right.listingRef, {
        rulesText: "Resolves Yes only if the bounded event occurs before noon.",
        protocolIdentity: "fixture-v2",
      }),
    ], 3);
    expect(
      scope(corpus, "IMPLIES", [left.listingRef, right.listingRef], "first").scopeIdentity,
    ).not.toBe(
      scope(changedCorpus, "IMPLIES", [left.listingRef, right.listingRef], "second").scopeIdentity,
    );
  });

  it("rebases only when current evidence capability materially improves", () => {
    const item = proposal(
      corpus,
      "MUTUALLY_EXCLUSIVE",
      [left.listingRef, right.listingRef],
      "evidence upgrade",
    );
    const retainedBundle = buildProposalEvidenceBundle(item, corpus);
    const priceOnlyCorpus = snapshot([left, listing(right.listingRef, {
      sourceReceivedAt: "2026-08-04T00:00:00.000Z",
      sourceRawHash: hashCanonical({ listingRef: right.listingRef, capture: 4 }),
      outcomes: Object.freeze(right.outcomes.map((outcome) => Object.freeze({
        ...outcome,
        indicativePrice: outcome.venueOutcomeId === "yes" ? "0.8" : "0.2",
      }))),
    })], 4);
    expect(selectCurrentSemanticEvidenceBundle({
      proposal: item,
      retainedBundle,
      currentSnapshot: priceOnlyCorpus,
      proposalCorpusSnapshotIdentity: corpus.snapshotIdentity,
    })).toBe(retainedBundle);

    const locator = buildDiscoveryEvidenceLocator({
      venueId: right.venueId,
      protocolIdentity: right.protocolIdentity,
      role: "CONTRACT_RULE_DOCUMENT",
      url: "https://rules.example.test/current.docx",
    });
    if (locator === null) throw new Error("fixture locator should be valid");
    const improvedCorpus = snapshot([left, listing(right.listingRef, {
      evidenceLocators: Object.freeze([locator]),
      rulesTextPosture: "TRUNCATED",
      rulesTextSourceCharacterCount: 42_000,
    })], 5);
    const rebased = selectCurrentSemanticEvidenceBundle({
      proposal: item,
      retainedBundle,
      currentSnapshot: improvedCorpus,
      proposalCorpusSnapshotIdentity: corpus.snapshotIdentity,
    });
    expect(rebased).toMatchObject({
      captureKind: "EXACT_CURRENT_REBASE",
      proposalCorpusSnapshotIdentity: corpus.snapshotIdentity,
      evidenceCorpusSnapshotIdentity: improvedCorpus.snapshotIdentity,
    });
    const oldScope = deriveSemanticReviewScope(item, retainedBundle);
    const newScope = deriveSemanticReviewScope(item, rebased);
    expect(oldScope.schemaVersion).toBe("pmh.semantic-review-scope.v1");
    expect(newScope.schemaVersion).toBe("pmh.semantic-review-scope.v3");
    expect(newScope.scopeIdentity).not.toBe(oldScope.scopeIdentity);
  });

  it("leaves missing and legacy evidence unscoped", () => {
    const item = proposal(corpus, "EQUIVALENT", [left.listingRef, right.listingRef], "none");
    expect(deriveSemanticReviewScope(item, null)).toMatchObject({
      status: "UNSCOPED_EVIDENCE",
      contractSemanticIdentity: null,
      scopeIdentity: null,
    });
  });
});
