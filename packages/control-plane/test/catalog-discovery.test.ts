import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  DiscoveryPool,
  FixtureCatalogDiscoveryDesk,
  HeuristicDiscoveryWorker,
  buildDiscoveryCatalogContext,
  buildDiscoveryEvidenceLocator,
  buildDiscoveryEvidenceLocators,
  buildExactDiscoveryCatalogContext,
  buildMarketCorpusSnapshot,
  buildProposalEvidenceBundle,
  buildRotatingDiscoveryCatalogContext,
  buildSearchScopeIdentity,
  toDiscoveryCatalogListing,
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

  it("retains complete contract rules while bounding the Agent context preview", () => {
    const prefix = "Seats are attributed to the party under which the member was elected. ";
    const completeRules = `${prefix}${"x".repeat(1_896 - prefix.length)}`;
    const normalized = (instrument: string) => toDiscoveryCatalogListing({
      venueId: "polymarket-us",
      venueInstrumentId: instrument,
      title: `House control ${instrument}`,
      description: completeRules,
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      rulesText: completeRules,
      outcomes: [
        { venueOutcomeId: `${instrument}-yes`, label: "Yes", indicativePrice: 45_000_000n },
        { venueOutcomeId: `${instrument}-no`, label: "No", indicativePrice: 55_000_000n },
      ],
      priceScale: 100_000_000n,
      quantityScale: 10_000n,
      minPriceTick: 100_000n,
      sourceFixtureHash: hashCanonical({ instrument, completeRules }),
      protocolIdentity: "gateway-rest-v1:test",
    }, {
      kind: "LIVE_OBSERVATION",
      receivedAt: "2026-08-09T00:00:00.000Z",
    });
    const retained = [normalized("dem"), normalized("rep")];
    const corpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "complete-rules" }),
      eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: retained,
    });
    const context = buildExactDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      retained,
    );
    const proposalBody = {
      relationKind: "EXHAUSTIVE" as const,
      listingRefs: retained.map((listing) => listing.listingRef),
      statement: "The two party outcomes may form an exhaustive partition.",
      rationale: "The complete rules assign control to exactly one party.",
      falsifiers: ["An unaffiliated outcome could leave both No."],
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      executionAuthority: false as const,
    };
    const proposal = Object.freeze({
      ...proposalBody,
      proposalId: hashCanonical({
        corpusSnapshotIdentity: corpus.snapshotIdentity,
        ...proposalBody,
      }),
    });
    const bundle = buildProposalEvidenceBundle(proposal, corpus);

    expect(retained[0]).toMatchObject({
      rulesText: completeRules,
      rulesTextPosture: "COMPLETE",
      rulesTextSourceCharacterCount: 1_896,
    });
    expect(context.listings[0]).toMatchObject({
      rulesTextPosture: "TRUNCATED",
      rulesTextSourceCharacterCount: 1_896,
    });
    expect(context.listings[0]?.rulesText).toHaveLength(1_200);
    expect(context.listings[0]?.rulesText).toMatch(/…$/u);
    expect(bundle.listings[0]?.rulesText).toBe(completeRules);
    expect(bundle.listings[0]?.rulesTextPosture).toBe("COMPLETE");

    const changed = retained.map((listing, index) => index === 0
      ? Object.freeze({
          ...listing,
          rulesText: `${completeRules.slice(0, -1)}y`,
          sourceRawHash: hashCanonical({ changed: true }),
        })
      : listing);
    expect(buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "complete-rules" }),
      eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: changed,
    }).snapshotIdentity).not.toBe(corpus.snapshotIdentity);
  });

  it("marks retained rules beyond the evidence bound as truncated", () => {
    const sourceRules = "r".repeat(20_001);
    const retained = toDiscoveryCatalogListing({
      venueId: "polymarket-us",
      venueInstrumentId: "bounded-rule",
      title: "Bounded rule",
      description: "Bounded evidence fixture",
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      rulesText: sourceRules,
      outcomes: [{ venueOutcomeId: "yes", label: "Yes" }],
      priceScale: 100_000_000n,
      quantityScale: 10_000n,
      sourceFixtureHash: hashCanonical({ sourceRules }),
      protocolIdentity: "gateway-rest-v1:test",
    }, {
      kind: "LIVE_OBSERVATION",
      receivedAt: "2026-08-09T00:00:00.000Z",
    });
    expect(retained).toMatchObject({
      rulesTextPosture: "TRUNCATED",
      rulesTextSourceCharacterCount: 20_001,
    });
    expect(retained.rulesText).toHaveLength(20_000);
    expect(retained.rulesText).toMatch(/…$/u);
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

  it("preserves typed evidence roles without granting retrieval authority", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const context = desk.context("Myriad", ["myriad"]);
    const sourced = context.listings.find(
      (listing) => (listing.evidenceLocators?.length ?? 0) > 0,
    );
    expect(sourced?.evidenceLocators).toEqual([
      expect.objectContaining({
        schemaVersion: "pmh.discovery-evidence-locator.v1",
        role: "OUTCOME_RESOLUTION_SOURCE",
        url: expect.stringMatching(/^https:\/\//u),
        locatorIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        authority: "EVIDENCE_LOCATOR_ONLY",
        fetchAuthority: false,
      }),
    ]);

    const locators = buildDiscoveryEvidenceLocators({
      venueId: "venue-a",
      protocolIdentity: "venue-a:v1",
      rulesUrl: " https://rules.example/contract.pdf ",
      resolutionSourceUrl: "https://oracle.example/result",
    });
    expect(locators.map((locator) => locator.role)).toEqual([
      "CONTRACT_RULE_DOCUMENT",
      "OUTCOME_RESOLUTION_SOURCE",
    ]);
    expect(locators.every((locator) => locator.fetchAuthority === false)).toBe(true);
    expect(buildDiscoveryEvidenceLocator({
      venueId: "venue-a",
      protocolIdentity: "venue-a:v1",
      role: "CONTRACT_RULE_DOCUMENT",
      url: "http://rules.example/contract.pdf",
    })).toBeNull();
  });

  it("rejects a content-addressed context with a tampered evidence locator", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const context = desk.context("Myriad", ["myriad"]);
    const locatorIndex = context.listings.findIndex(
      (listing) => (listing.evidenceLocators?.length ?? 0) > 0,
    );
    expect(locatorIndex).toBeGreaterThanOrEqual(0);
    const listings = context.listings.map((listing, index) => index !== locatorIndex
      ? listing
      : {
          ...listing,
          evidenceLocators: listing.evidenceLocators?.map((locator) => ({
            ...locator,
            url: "https://substituted.example/result",
          })),
        });
    const body = {
      schemaVersion: context.schemaVersion,
      source: context.source,
      contentPolicy: context.contentPolicy,
      listings,
    };
    await expect(new DiscoveryPool(
      [new HeuristicDiscoveryWorker()],
      () => 1_000,
    ).run({
      taskId: "task:tampered-evidence-locator",
      question: "Myriad",
      venueIds: ["myriad"],
      maxHypotheses: 5,
      deadlineEpochMs: 2_000,
      catalogContext: { ...body, contextIdentity: hashCanonical(body) },
    })).rejects.toThrow(/catalog context/);
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
      rulesTextPosture: "COMPLETE" as const,
      rulesTextSourceCharacterCount: 1_200,
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

  it("reserves cross-venue representatives before relevance fills the context", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const seed = desk.context("Rihanna album", ["polymarket-global"]).listings[0]!;
    const {
      rulesTextPosture: _rulesTextPosture,
      rulesTextSourceCharacterCount: _rulesTextSourceCharacterCount,
      ...seedWithoutRulesMetadata
    } = seed;
    const dominant = Array.from({ length: 35 }, (_, index) => Object.freeze({
      ...seedWithoutRulesMetadata,
      listingRef: `venue-a:album-${index}`,
      venueId: "venue-a",
      venueInstrumentId: `album-${index}`,
      title: `Rihanna album release ${index}`,
      rulesText: null,
    }));
    const secondVenue = Object.freeze({
      ...seedWithoutRulesMetadata,
      listingRef: "venue-b:unrelated",
      venueId: "venue-b",
      venueInstrumentId: "unrelated",
      title: "Unrelated weather contract",
      description: "No query term overlaps this listing.",
      rulesText: null,
    });

    const context = buildDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      Object.freeze([...dominant, secondVenue]),
      "Rihanna album release",
      ["venue-a", "venue-b"],
    );
    expect(context.listings).toHaveLength(30);
    expect(new Set(context.listings.map((listing) => listing.venueId))).toEqual(
      new Set(["venue-a", "venue-b"]),
    );
    expect(context.listings).toContainEqual(secondVenue);
  });

  it("retains an explicitly selected listing set without a second lexical filter", async () => {
    const desk = new FixtureCatalogDiscoveryDesk();
    await desk.load();
    const seed = desk.context("Rihanna album", ["polymarket-global"]).listings[0]!;
    const selected = Object.freeze([
      Object.freeze({ ...seed, listingRef: "venue-b:beta", venueId: "venue-b" }),
      Object.freeze({ ...seed, listingRef: "venue-a:alpha", venueId: "venue-a" }),
      Object.freeze({ ...seed, listingRef: "venue-c:gamma", venueId: "venue-c" }),
    ]);
    const context = buildExactDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      selected,
    );

    expect(context.listings.map((listing) => listing.listingRef)).toEqual([
      "venue-b:beta",
      "venue-a:alpha",
      "venue-c:gamma",
    ]);
    expect(context.contextIdentity).toBe(hashCanonical({
      schemaVersion: context.schemaVersion,
      source: context.source,
      contentPolicy: context.contentPolicy,
      listings: context.listings,
    }));
    expect(() => buildExactDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      [...selected, selected[0]!],
    )).toThrow(/duplicate listing references/);
    expect(() => buildExactDiscoveryCatalogContext(
      "QUALIFIED_LIVE_OBSERVATIONS",
      Array.from({ length: 31 }, (_, index) => ({
        ...seed,
        listingRef: `venue-a:${index}`,
      })),
    )).toThrow(/listing limit/);
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
