import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  DiscoveryPool,
  FixtureCatalogDiscoveryDesk,
  HeuristicDiscoveryWorker,
  buildDiscoveryCatalogContext,
  buildRotatingDiscoveryCatalogContext,
  buildSearchScopeIdentity,
  type DiscoveryTask,
} from "../src/index.js";

describe("verified catalog discovery context", () => {
  it("loads a bounded content-addressed corpus from verified fixtures", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    expect(() => desk.context("not ready", ["kalshi"])).toThrow(/not loaded/);
    const projection = await desk.load();
    expect(projection).toEqual({
      mode: "VERIFIED_FIXTURE_CATALOGS",
      corpusIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      listingCount: 32,
      venueCount: 7,
      sourceFixtureCount: 8,
      maxListingsPerTask: 30,
    });
    expect(await desk.load()).toEqual(projection);
  });

  it("grounds Polymarket US separately from the Global protocol", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const context = desk.context("New York Mets National League champion", [
      "polymarket-us",
    ]);

    expect(context.listings[0]).toMatchObject({
      listingRef:
        "polymarket-us:tec-mlb-nlchamp-2026-09-27-nym",
      venueId: "polymarket-us",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      rulesText: expect.stringContaining("settle"),
      sourceKind: "VERIFIED_FIXTURE",
      protocolIdentity: "gateway-rest-v1:2026-08-01",
    });
    expect(
      context.listings.every((listing) =>
        listing.listingRef.startsWith("polymarket-us:")
      ),
    ).toBe(true);
  });

  it("grounds a range hypothesis in six concrete Gemini listings", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const context = desk.context(
      "Highest temperature in Boston on July 31, 2026?",
      ["gemini-predictions"],
    );
    expect(context).toMatchObject({
      schemaVersion: "pmh.discovery-catalog-context.v2",
      source: "VERIFIED_FIXTURE_CATALOGS",
      contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
    });
    expect(context.contextIdentity).toMatch(/^sha256:/);
    expect(context.listings).toHaveLength(6);
    expect(
      context.listings.every(
        (listing) =>
          listing.venueId === "gemini-predictions" &&
          listing.sourceKind === "VERIFIED_FIXTURE" &&
          listing.sourceReceivedAt.startsWith("2026-07-31T") &&
          listing.sourceRawHash.startsWith("sha256:") &&
          listing.listingRef.startsWith("gemini-predictions:GEMI-WXHIGH"),
      ),
    ).toBe(true);
    const task: DiscoveryTask = {
      taskId: "task:grounded-weather",
      question: "Highest temperature in Boston on July 31, 2026?",
      venueIds: ["gemini-predictions"],
      maxHypotheses: 5,
      deadlineEpochMs: 2_000,
      catalogContext: context,
    };
    const run = await new DiscoveryPool(
      [new HeuristicDiscoveryWorker()],
      () => 1_000,
    ).run(task);
    expect(run.hypotheses).toHaveLength(1);
    expect(run.hypotheses[0]).toMatchObject({
      strategyKind: "EXHAUSTIVE_RANGE",
      listingRefs: expect.arrayContaining(
        context.listings.map((listing) => listing.listingRef),
      ),
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    });
  });

  it("fails closed when context content no longer matches its identity", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const context = desk.context("Rihanna album", ["polymarket-global"]);
    const task: DiscoveryTask = {
      taskId: "task:tampered-context",
      question: "Rihanna album",
      venueIds: ["polymarket-global"],
      maxHypotheses: 5,
      deadlineEpochMs: 2_000,
      catalogContext: {
        ...context,
        listings: [],
      },
    };
    await expect(
      new DiscoveryPool([new HeuristicDiscoveryWorker()], () => 1_000).run(task),
    ).rejects.toThrow(/catalog context/);
  });

  it("rejects an oversized catalog field even with a matching identity", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const context = desk.context("Rihanna album", ["polymarket-global"]);
    const body = {
      schemaVersion: context.schemaVersion,
      source: context.source,
      contentPolicy: context.contentPolicy,
      listings: context.listings.map((listing, index) =>
        index === 0 ? { ...listing, description: "x".repeat(801) } : listing,
      ),
    };
    const task: DiscoveryTask = {
      taskId: "task:oversized-context",
      question: "Rihanna album",
      venueIds: ["polymarket-global"],
      maxHypotheses: 5,
      deadlineEpochMs: 2_000,
      catalogContext: {
        ...body,
        contextIdentity: hashCanonical(body),
      },
    };
    await expect(
      new DiscoveryPool([new HeuristicDiscoveryWorker()], () => 1_000).run(task),
    ).rejects.toThrow(/catalog context/);
  });

  it("shrinks a rule-dense ranked context before crossing the 50KB task boundary", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const seed = desk.context("Rihanna album", ["polymarket-global"]).listings[0]!;
    const dense = Array.from({ length: 30 }, (_, index) => ({
      ...seed,
      listingRef: `polymarket-global:dense-${index}`,
      venueInstrumentId: `dense-${index}`,
      description: "d".repeat(800),
      rulesText: "r".repeat(1_200),
    }));
    const context = buildDiscoveryCatalogContext(
      "VERIFIED_FIXTURE_CATALOGS",
      dense,
      "Rihanna album",
      ["polymarket-global"],
    );
    expect(context.listings.length).toBeLessThan(30);
    expect(JSON.stringify(context).length).toBeLessThanOrEqual(50_000);
    await expect(new DiscoveryPool(
      [new HeuristicDiscoveryWorker()],
      () => 1_000,
    ).run({
      taskId: "task:dense-context",
      question: "Rihanna album",
      venueIds: ["polymarket-global"],
      maxHypotheses: 5,
      deadlineEpochMs: 2_000,
      catalogContext: context,
    })).resolves.toMatchObject({ executionAuthority: false });
  });

  it("rotates a general issue through stable anchor neighborhoods", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const seed = desk.context("Rihanna album", ["polymarket-global"]).listings[0]!;
    const corpus = Object.freeze(Array.from({ length: 40 }, (_, index) => ({
      ...seed,
      listingRef: `venue-${index % 2}:${index}`,
      venueId: `venue-${index % 2}`,
      venueInstrumentId: `${index}`,
      title: `Marker${Math.floor(index / 2)}`,
      description: `Contract ${index} in a paired event family.`,
      sourceReceivedAt: "2026-08-01T00:00:00.000Z",
      sourceRawHash: hashCanonical({ source: "first", index }),
    })));
    const question = "Find grounded implication and subset structures.";
    const venueIds = ["venue-0", "venue-1"];
    const emptyFeedback = Object.freeze({
      completedSemanticScopeIdentities: Object.freeze([]),
      attemptedRoutingScopeIdentities: Object.freeze([]),
    });
    const primary = buildDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      corpus,
      question,
      venueIds,
    );
    expect(buildRotatingDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      corpus,
      question,
      venueIds,
      emptyFeedback,
    )).toEqual(primary);

    const primaryScope = buildSearchScopeIdentity(primary.listings);
    const refreshed = Object.freeze(corpus.map((listing, index) => ({
      ...listing,
      sourceReceivedAt: "2026-08-01T00:05:00.000Z",
      sourceRawHash: hashCanonical({ source: "second", index }),
      outcomes: Object.freeze(listing.outcomes.map((outcome) => ({
        ...outcome,
        indicativePrice: outcome.indicativePrice === null ? null : "0.4",
      }))),
    })));
    const rotated = buildRotatingDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      refreshed,
      question,
      venueIds,
      Object.freeze({
        completedSemanticScopeIdentities: Object.freeze([
          primaryScope.semanticScopeIdentity,
        ]),
        attemptedRoutingScopeIdentities: Object.freeze([
          primaryScope.routingScopeIdentity,
        ]),
      }),
    );
    const rotatedScope = buildSearchScopeIdentity(rotated.listings);
    expect(buildSearchScopeIdentity(
      buildDiscoveryCatalogContext(
        "QUALIFIED_LIVE_OBSERVATIONS",
        refreshed,
        question,
        venueIds,
      ).listings,
    ).semanticScopeIdentity).toBe(primaryScope.semanticScopeIdentity);
    expect(rotatedScope.semanticScopeIdentity).not.toBe(
      primaryScope.semanticScopeIdentity,
    );
    expect(rotated.listings).toHaveLength(2);
    expect(new Set(rotated.listings.map((listing) => listing.venueId)).size).toBe(2);

    // Feedback belongs to the caller's issue. With no feedback, another issue
    // still receives the primary context on the same refreshed corpus.
    expect(buildSearchScopeIdentity(buildRotatingDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      refreshed,
      question,
      venueIds,
      emptyFeedback,
    ).listings).semanticScopeIdentity).toBe(primaryScope.semanticScopeIdentity);
  });

  it("falls back deterministically after every anchor neighborhood is complete", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const seed = desk.context("Rihanna album", ["polymarket-global"]).listings[0]!;
    const corpus = Object.freeze(Array.from({ length: 8 }, (_, index) => ({
      ...seed,
      listingRef: `venue-${index % 2}:${index}`,
      venueId: `venue-${index % 2}`,
      venueInstrumentId: `${index}`,
      title: `Marker${Math.floor(index / 2)}`,
      description: `Listing ${index}`,
      sourceRawHash: hashCanonical({ index }),
    })));
    const completed: Hash[] = [];
    const attempted: Hash[] = [];
    let repeated: Hash | null = null;
    for (let index = 0; index < 12; index += 1) {
      const context = buildRotatingDiscoveryCatalogContext(
        "QUALIFIED_LIVE_OBSERVATIONS",
        corpus,
        "Find a logical implication.",
        ["venue-0", "venue-1"],
        {
          completedSemanticScopeIdentities: completed,
          attemptedRoutingScopeIdentities: attempted,
        },
      );
      const scope = buildSearchScopeIdentity(context.listings);
      if (completed.includes(scope.semanticScopeIdentity)) {
        repeated = scope.semanticScopeIdentity;
        break;
      }
      completed.push(scope.semanticScopeIdentity);
      attempted.push(scope.routingScopeIdentity);
    }
    expect(completed.length).toBeGreaterThan(1);
    expect(repeated).toBe(completed[0]);
  });
});
