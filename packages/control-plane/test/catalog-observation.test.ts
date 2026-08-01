import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSearchScopeIdentity,
  CatalogObservationDesk,
  catalogObservationSources,
  type CatalogFetchLike,
} from "../src/index.js";

const fixtureNames: Readonly<Record<string, string>> = {
  "polymarket-global": "polymarket-catalog",
  "polymarket-us": "polymarket-us-catalog",
  kalshi: "kalshi-catalog",
  "gemini-predictions": "gemini-binary-catalog",
  opinion: "opinion-catalog",
  myriad: "myriad-amm-catalog",
  limitless: "limitless-catalog",
};

function fixtureFetcher(options: Readonly<{ failVenue?: string }> = {}):
  CatalogFetchLike {
  return async (input, init) => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.sourceUrl === input,
    );
    if (source === undefined) return new Response(null, { status: 404 });
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("omit");
    expect(new Headers(init.headers).has("authorization")).toBe(false);
    if (source.venueId === options.failVenue) {
      return new Response("unavailable", { status: 503 });
    }
    const fixtureName = fixtureNames[source.venueId];
    if (fixtureName === undefined) return new Response(null, { status: 404 });
    const fixtureDate = source.venueId === "polymarket-us"
      ? "2026-08-01"
      : "2026-07-31";
    const bytes = await readFile(
      resolve(
        import.meta.dirname,
        `../../../projects/fixtures/${source.venueId}/${fixtureDate}/${fixtureName}.json`,
      ),
    );
    return new Response(new Uint8Array(bytes).buffer, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("anonymous catalog observation desk", () => {
  it("content-addresses bounded public GET responses without promoting them", async () => {
    const desk = new CatalogObservationDesk({
      fetcher: fixtureFetcher(),
      now: () => Date.parse("2026-08-01T03:15:00.000Z"),
    });
    expect(desk.projection()).toMatchObject({
      status: "IDLE",
      listingCount: 0,
      promotion: "OBSERVE_ONLY",
    });
    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      mode: "ANONYMOUS_PUBLIC_GET",
      status: "READY",
      promotion: "OBSERVE_ONLY",
      sourceCount: 7,
      healthySourceCount: 7,
      contextQualification: {
        status: "ELIGIBLE",
        eligibleSourceCount: 7,
        maxAgeMs: 900_000,
        maxListingsPerTask: 30,
        requiresExplicitRequest: true,
        defaultMode: "VERIFIED_FIXTURES",
        authority: "PROPOSE_ONLY",
      },
      storage: { mode: "MEMORY", durable: false },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.listingCount).toBeGreaterThan(0);
    expect(projection.currentSetIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(
      projection.sources.every(
        (source) =>
          source.status === "CURRENT" &&
          source.rawHash?.startsWith("sha256:") === true &&
          source.credentialsUsed === false &&
          source.receivedAt === "2026-08-01T03:15:00.000Z",
      ),
    ).toBe(true);
    const context = desk.context("Rihanna album", ["polymarket-global"]);
    expect(context).toMatchObject({
      schemaVersion: "pmh.discovery-catalog-context.v2",
      source: "QUALIFIED_LIVE_OBSERVATIONS",
      contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
    });
    expect(context.listings.length).toBeGreaterThan(0);
    expect(context.listings.length).toBeLessThanOrEqual(30);
    expect(
      context.listings.every(
        (listing) =>
          listing.venueId === "polymarket-global" &&
          listing.sourceKind === "LIVE_OBSERVATION" &&
          listing.sourceReceivedAt === "2026-08-01T03:15:00.000Z" &&
          listing.sourceRawHash.startsWith("sha256:"),
      ),
    ).toBe(true);

    const venueIds = catalogObservationSources.map((source) => source.venueId);
    const radar = desk.radar();
    expect(radar.candidateCount).toBeGreaterThan(0);
    const firstBatch = desk.radarSearchContext(venueIds, {
      completedSemanticScopeIdentities: [],
      attemptedRoutingScopeIdentities: [],
    });
    const radarRefs = new Set(
      radar.candidates.flatMap((candidate) =>
        candidate.listings.map((listing) => listing.listingRef)
      ),
    );
    expect(firstBatch.listings.length).toBeGreaterThanOrEqual(2);
    expect(firstBatch.listings.length).toBeLessThanOrEqual(4);
    expect(firstBatch.listings.every((listing) =>
      radarRefs.has(listing.listingRef)
    )).toBe(true);
    expect(JSON.stringify(firstBatch).length).toBeLessThanOrEqual(50_000);

    if (radar.candidateCount > 2) {
      const firstScope = buildSearchScopeIdentity(firstBatch.listings);
      const secondBatch = desk.radarSearchContext(venueIds, {
        completedSemanticScopeIdentities: [firstScope.semanticScopeIdentity],
        attemptedRoutingScopeIdentities: [firstScope.routingScopeIdentity],
      });
      expect(buildSearchScopeIdentity(
        secondBatch.listings,
      ).semanticScopeIdentity).not.toBe(firstScope.semanticScopeIdentity);
    }
  });

  it("isolates source failure and retains the last content-addressed success", async () => {
    let fail = false;
    const stableFetcher = fixtureFetcher();
    const desk = new CatalogObservationDesk({
      fetcher: async (input, init) => {
        const source = catalogObservationSources.find(
          (candidate) => candidate.sourceUrl === input,
        );
        if (fail && source?.venueId === "kalshi") {
          return new Response("unavailable", { status: 503 });
        }
        return stableFetcher(input, init);
      },
      now: () => Date.parse("2026-08-01T03:16:00.000Z"),
    });
    const ready = await desk.refresh();
    const prior = ready.sources.find((source) => source.venueId === "kalshi");
    fail = true;
    const degraded = await desk.refresh();
    expect(degraded.status).toBe("DEGRADED");
    expect(degraded.sources.find((source) => source.venueId === "kalshi")).toMatchObject({
      status: "STALE_AFTER_FAILURE",
      rawHash: prior?.rawHash,
      listingCount: prior?.listingCount,
      diagnostic: "anonymous catalog GET returned HTTP 503",
    });
    expect(degraded.healthySourceCount).toBe(6);
    expect(degraded.contextQualification).toMatchObject({
      status: "PARTIAL",
      eligibleSourceCount: 6,
    });
    expect(() => desk.context("rates", ["kalshi"])).toThrow(
      /latest refresh failed/,
    );
  });

  it("expires live context qualification without discarding the observation", async () => {
    let nowMs = Date.parse("2026-08-01T03:15:00.000Z");
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "polymarket-global",
    );
    if (source === undefined) throw new Error("missing Polymarket source");
    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: fixtureFetcher(),
      contextMaxAgeMs: 1_000,
      now: () => nowMs,
    });
    await desk.refresh();
    expect(desk.projection().sources[0]).toMatchObject({
      status: "CURRENT",
      contextEligible: true,
      freshUntil: "2026-08-01T03:15:01.000Z",
    });

    nowMs += 1_001;
    expect(desk.projection()).toMatchObject({
      status: "READY",
      listingCount: expect.any(Number),
      contextQualification: {
        status: "INELIGIBLE",
        eligibleSourceCount: 0,
      },
      sources: [{ status: "CURRENT", contextEligible: false }],
    });
    expect(() => desk.context("Rihanna album", [source.venueId])).toThrow(
      /last observation is stale/,
    );
  });

  it("rejects a response before decoding when it crosses the byte cap", async () => {
    const source = catalogObservationSources[0];
    if (source === undefined) throw new Error("missing test source");
    const desk = new CatalogObservationDesk({
      sources: [source],
      maxResponseBytes: 8,
      fetcher: async () =>
        new Response("0123456789", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      status: "DEGRADED",
      listingCount: 0,
      healthySourceCount: 0,
    });
    expect(projection.sources[0]).toMatchObject({
      status: "FAILED",
      diagnostic: "response exceeds 8 byte limit",
    });
  });
});
