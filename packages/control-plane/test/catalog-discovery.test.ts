import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  DiscoveryPool,
  FixtureCatalogDiscoveryDesk,
  HeuristicDiscoveryWorker,
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
});
