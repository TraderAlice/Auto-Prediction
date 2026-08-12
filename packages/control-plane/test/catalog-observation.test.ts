import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertCatalogContextCoverage,
  buildSearchScopeIdentity,
  CatalogContextCoverageError,
  CatalogObservationDesk,
  catalogObservationSources,
  type CatalogFetchLike,
  type CatalogObservationStore,
  type StoredCatalogObservation,
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
  it("retains prior source-URL evidence without restoring it as the current slice", async () => {
    const currentSource = catalogObservationSources.find(
      (candidate) => candidate.venueId === "polymarket-us",
    );
    if (currentSource === undefined) {
      throw new Error("missing Polymarket US source");
    }
    const priorSource = {
      ...currentSource,
      sourceUrl: currentSource.sourceUrl.replace(
        "limit=500&offset=0",
        "limit=20",
      ),
    };
    const observations: StoredCatalogObservation[] = [];
    const store: CatalogObservationStore = {
      catalogObservationStorage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 42,
        idempotencyKey: "observationId",
      },
      loadCatalogObservations: (limit) => observations.slice(0, limit),
      saveCatalogObservation: (observation) => {
        observations.unshift(observation);
        return observation;
      },
    };
    const fixtureBytes = await readFile(
      resolve(
        import.meta.dirname,
        "../../../projects/fixtures/polymarket-us/2026-08-01/polymarket-us-catalog.json",
      ),
    );
    const fetcher: CatalogFetchLike = async (input) =>
      input === priorSource.sourceUrl || input === currentSource.sourceUrl
        ? new Response(new Uint8Array(fixtureBytes).buffer, {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : new Response(null, { status: 404 });
    const priorDesk = new CatalogObservationDesk({
      sources: [priorSource],
      fetcher,
      store,
      now: () => Date.parse("2026-08-02T03:59:00.000Z"),
    });
    await priorDesk.refresh();
    expect(observations).toHaveLength(1);

    const currentDesk = new CatalogObservationDesk({
      sources: [currentSource],
      fetcher,
      store,
      now: () => Date.parse("2026-08-02T04:00:00.000Z"),
    });
    expect(currentDesk.projection()).toMatchObject({
      status: "IDLE",
      listingCount: 0,
      sources: [
        {
          sourceUrl: currentSource.sourceUrl,
          status: "NEVER_REFRESHED",
        },
      ],
    });
    const refreshed = await currentDesk.refresh();
    expect(refreshed).toMatchObject({
      status: "READY",
      listingCount: 20,
      sources: [
        { sourceUrl: currentSource.sourceUrl, status: "CURRENT" },
      ],
    });
    expect(observations).toHaveLength(2);
    expect(observations[0]?.record.schemaVersion).toBe(
      "pmh.catalog-observation.v2",
    );
    expect(() => new CatalogObservationDesk({
      sources: [{
        ...currentSource,
        normalizerIdentity: hashCanonical({ substitutedNormalizer: true }),
      }],
      store,
      now: () => Date.parse("2026-08-02T04:00:00.000Z"),
    })).toThrow(/normalizer identity mismatch/);
  });

  it("retires the venue-rule-only Polymarket US normalization until a fresh capture", async () => {
    const currentSource = catalogObservationSources.find(
      (candidate) => candidate.venueId === "polymarket-us",
    );
    if (currentSource === undefined) throw new Error("missing Polymarket US source");
    const observations: StoredCatalogObservation[] = [];
    const store: CatalogObservationStore = {
      catalogObservationStorage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 42,
        idempotencyKey: "observationId",
      },
      loadCatalogObservations: (limit) => observations.slice(0, limit),
      saveCatalogObservation: (observation) => {
        observations.unshift(observation);
        return observation;
      },
    };
    const legacySource = {
      ...currentSource,
      normalizerIdentity: hashCanonical({
        schemaVersion: "pmh.catalog-normalizer-identity.v1",
        venueId: "polymarket-us",
        revision: "gateway-catalog.v2:cftc-rulebook-locator",
      }),
      decode: (fixture: Parameters<typeof currentSource.decode>[0]) =>
        currentSource.decode(fixture).map((listing) => {
          const {
            rulesUrl: _contractRulesUrl,
            venueRulesUrl,
            ...legacyListing
          } = listing;
          return { ...legacyListing, rulesUrl: venueRulesUrl };
        }),
    };
    await new CatalogObservationDesk({
      sources: [legacySource],
      fetcher: fixtureFetcher(),
      store,
      now: () => Date.parse("2026-08-02T03:59:00.000Z"),
    }).refresh();

    const restored = new CatalogObservationDesk({
      sources: [currentSource],
      fetcher: fixtureFetcher(),
      store,
      now: () => Date.parse("2026-08-02T04:00:00.000Z"),
    });
    expect(restored.projection()).toMatchObject({
      status: "DEGRADED",
      listingCount: 0,
      sources: [{
        venueId: "polymarket-us",
        status: "FAILED",
        diagnostic: "stored observation uses retired normalization; fresh capture required",
        contextEligible: false,
      }],
    });
    await restored.refresh();
    expect(restored.projection()).toMatchObject({
      status: "READY",
      listingCount: 20,
      sources: [{
        venueId: "polymarket-us",
        status: "CURRENT",
        diagnostic: null,
        contextEligible: true,
      }],
    });
    expect(restored.corpus().listings.every((listing) => {
      const roles = listing.evidenceLocators?.map((locator) => locator.role);
      return roles?.includes("CONTRACT_RULE_DOCUMENT") === true &&
        roles.includes("VENUE_RULE_DOCUMENT");
    })).toBe(true);
  });

  it("retires Gemini observations that predate contract rich-text evidence", async () => {
    const currentSource = catalogObservationSources.find(
      (candidate) => candidate.venueId === "gemini-predictions",
    );
    if (currentSource === undefined) throw new Error("missing Gemini source");
    expect(currentSource.sourceUrl).toBe(
      "https://api.gemini.com/v1/prediction-markets/events?status=active&limit=500&offset=0",
    );
    const observations: StoredCatalogObservation[] = [];
    const store: CatalogObservationStore = {
      catalogObservationStorage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 42,
        idempotencyKey: "observationId",
      },
      loadCatalogObservations: (limit) => observations.slice(0, limit),
      saveCatalogObservation: (observation) => {
        observations.unshift(observation);
        return observation;
      },
    };
    const legacySource = {
      ...currentSource,
      normalizerIdentity: hashCanonical({
        schemaVersion: "pmh.catalog-normalizer-identity.v1",
        venueId: "gemini-predictions",
        revision: "predictions-catalog.v1",
      }),
      decode: (fixture: Parameters<typeof currentSource.decode>[0]) =>
        currentSource.decode(fixture).map((listing) => {
          const { rulesText: _rulesText, ...legacyListing } = listing;
          return legacyListing;
        }),
    };
    await new CatalogObservationDesk({
      sources: [legacySource],
      fetcher: fixtureFetcher(),
      store,
      now: () => Date.parse("2026-08-10T09:00:00.000Z"),
    }).refresh();

    const restored = new CatalogObservationDesk({
      sources: [currentSource],
      fetcher: fixtureFetcher(),
      store,
      now: () => Date.parse("2026-08-10T09:01:00.000Z"),
    });
    expect(restored.projection()).toMatchObject({
      status: "DEGRADED",
      listingCount: 0,
      sources: [{
        venueId: "gemini-predictions",
        status: "FAILED",
        diagnostic: "stored observation uses retired normalization; fresh capture required",
      }],
    });
    await restored.refresh();
    expect(restored.corpus().listings[0]).toMatchObject({
      venueId: "gemini-predictions",
      rulesTextPosture: "COMPLETE",
    });
    expect(restored.corpus().listings[0]?.evidenceLocators?.some((locator) =>
      locator.role === "CONTRACT_RULE_DOCUMENT"
    )).toBe(true);
  });

  it("replays pre-role normalizations from raw evidence into the current projection", async () => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "myriad",
    );
    if (source === undefined) throw new Error("missing Myriad source");
    const observations: StoredCatalogObservation[] = [];
    const legacyStore: CatalogObservationStore = {
      catalogObservationStorage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 42,
        idempotencyKey: "observationId",
      },
      loadCatalogObservations: (limit) => observations.slice(0, limit),
      saveCatalogObservation: (observation) => {
        if (observation.record.schemaVersion !== "pmh.catalog-observation.v2") {
          throw new Error("expected current observation record");
        }
        const {
          observationId: _observationId,
          normalizerIdentity: _normalizerIdentity,
          schemaVersion: _schemaVersion,
          ...recordFields
        } = observation.record;
        const body = {
          schemaVersion: "pmh.catalog-observation.v1" as const,
          ...recordFields,
        };
        const stored: StoredCatalogObservation = {
          record: {
            ...body,
            observationId:
              `catalog-observation:${hashCanonical(body).slice(7)}`,
          },
          bytes: new Uint8Array(observation.bytes),
        };
        observations.unshift(stored);
        return stored;
      },
    };
    const legacySource = {
      ...source,
      decode: (fixture: Parameters<typeof source.decode>[0]) =>
        source.decode(fixture).map((listing) => {
          const {
            rulesText: _rulesText,
            resolutionSourceUrl,
            ...legacyListing
          } = listing;
          return {
            ...legacyListing,
            ...(resolutionSourceUrl === undefined
              ? {}
              : { rulesUrl: resolutionSourceUrl }),
          };
        }),
    };
    const receivedAt = "2026-08-01T03:15:00.000Z";
    await new CatalogObservationDesk({
      sources: [legacySource],
      fetcher: fixtureFetcher(),
      store: legacyStore,
      now: () => Date.parse(receivedAt),
    }).refresh();
    expect(observations[0]?.record.schemaVersion).toBe(
      "pmh.catalog-observation.v1",
    );

    const restored = new CatalogObservationDesk({
      sources: [source],
      store: legacyStore,
      now: () => Date.parse(receivedAt),
    });
    const corpus = restored.corpus();
    expect(corpus.listingCount).toBeGreaterThan(0);
    expect(corpus.listings.some((listing) =>
      listing.rulesText !== null &&
      listing.evidenceLocators?.some(
        (locator) => locator.role === "OUTCOME_RESOLUTION_SOURCE",
      ) === true
    )).toBe(true);

    const legacy = observations[0]!;
    const { observationId: _observationId, ...legacyRecordBody } = legacy.record;
    const invalidBody = {
      ...legacyRecordBody,
      listingIdentity: hashCanonical({ substituted: true }),
    };
    const invalid: StoredCatalogObservation = {
      record: {
        ...invalidBody,
        observationId:
          `catalog-observation:${hashCanonical(invalidBody).slice(7)}`,
      },
      bytes: new Uint8Array(legacy.bytes),
    };
    expect(() => new CatalogObservationDesk({
      sources: [source],
      store: {
        ...legacyStore,
        loadCatalogObservations: () => [invalid],
      },
      now: () => Date.parse(receivedAt),
    })).toThrow(/normalization mismatch/);
  });

  it("qualifies the bounded 500-market Polymarket US live slice without widening Agent context", async () => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "polymarket-us",
    );
    if (source === undefined) throw new Error("missing Polymarket US source");
    expect(source.sourceUrl).toBe(
      "https://gateway.polymarket.us/v1/markets?active=true&closed=false&archived=false&limit=500&offset=0",
    );

    const fixture = JSON.parse(
      await readFile(
        resolve(
          import.meta.dirname,
          "../../../projects/fixtures/polymarket-us/2026-08-01/polymarket-us-catalog.json",
        ),
        "utf8",
      ),
    ) as { markets: Record<string, unknown>[] };
    const markets = Array.from({ length: 500 }, (_, index) => {
      const seed = fixture.markets[index % fixture.markets.length];
      if (seed === undefined) throw new Error("missing fixture market");
      const slug = `${String(seed.slug)}-breadth-${index}`;
      const marketSides = (seed.marketSides as Record<string, unknown>[]).map(
        (side, sideIndex) => ({
          id: `${String(side.id)}-breadth-${index}-${sideIndex}`,
          identifier: slug,
          description: side.description,
          price: side.price,
          long: side.long,
          quote: side.quote,
          tradable: side.tradable,
        }),
      );
      return {
        id: `${String(seed.id)}-breadth-${index}`,
        slug,
        question: `${String(seed.question)} breadth ${index}`,
        title: seed.title,
        description: seed.description,
        active: seed.active,
        closed: seed.closed,
        archived: seed.archived,
        status: seed.status,
        startDate: seed.startDate,
        endDate: seed.endDate,
        orderPriceMinTickSize: seed.orderPriceMinTickSize,
        minimumTradeQty: seed.minimumTradeQty,
        feeCoefficient: seed.feeCoefficient,
        marketSides,
      };
    });
    const bytes = new TextEncoder().encode(JSON.stringify({ markets }));
    expect(bytes.byteLength).toBeLessThan(2_000_000);

    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: async (input, init) => {
        expect(input).toBe(source.sourceUrl);
        expect(init).toMatchObject({ method: "GET", credentials: "omit" });
        return new Response(bytes, {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": String(bytes.byteLength),
          },
        });
      },
      now: () => Date.parse("2026-08-02T04:00:00.000Z"),
    });

    const projection = await desk.refresh();
    expect(projection).toMatchObject({
      status: "READY",
      listingCount: 500,
      maxResponseBytes: 10_000_000,
      sources: [
        {
          venueId: "polymarket-us",
          sourceUrl: source.sourceUrl,
          status: "CURRENT",
          byteLength: String(bytes.byteLength),
          listingCount: 500,
          contextEligible: true,
        },
      ],
    });
    const context = desk.context("champion breadth", [source.venueId]);
    expect(context.listings.length).toBeGreaterThan(0);
    expect(context.listings.length).toBeLessThanOrEqual(30);
    expect(JSON.stringify(context).length).toBeLessThanOrEqual(50_000);
  });

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

    const requestedVenueIds = catalogObservationSources.map(
      (source) => source.venueId,
    );
    const selection = desk.resilientContext(
      requestedVenueIds,
      2,
      (eligibleVenueIds) => desk.context("rates", eligibleVenueIds),
    );
    expect(selection.coverage).toMatchObject({
      status: "DEGRADED",
      requestedVenueIds: [...requestedVenueIds].sort(),
      minimumEligibleVenueCount: 2,
      omittedSources: [{
        venueId: "kalshi",
        reason: "LATEST_REFRESH_FAILED",
        lastObservationRawHash: prior?.rawHash,
        lastAttemptAt: "2026-08-01T03:16:00.000Z",
      }],
      authority: "SEARCH_COVERAGE_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(selection.coverage.eligibleVenueIds).not.toContain("kalshi");
    expect(selection.catalogContext.listings.every(
      (listing) => listing.venueId !== "kalshi",
    )).toBe(true);
    expect(assertCatalogContextCoverage(
      JSON.parse(JSON.stringify(selection.coverage)),
      requestedVenueIds,
    )).toEqual(selection.coverage);
    const tamperedCoverage = JSON.parse(JSON.stringify(selection.coverage));
    tamperedCoverage.omittedSources[0].reason = "STALE";
    expect(() => assertCatalogContextCoverage(
      tamperedCoverage,
      requestedVenueIds,
    )).toThrow(/violates its contract/);

    try {
      desk.resilientContext(
        ["kalshi"],
        1,
        (eligibleVenueIds) => desk.context("rates", eligibleVenueIds),
      );
      throw new Error("expected insufficient coverage");
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogContextCoverageError);
      expect((error as CatalogContextCoverageError).coverage).toMatchObject({
        status: "DEGRADED",
        requestedVenueIds: ["kalshi"],
        eligibleVenueIds: [],
        contextVenueIds: [],
        minimumEligibleVenueCount: 1,
      });
    }
  });

  it("distinguishes a successful empty observation from a source never refreshed", async () => {
    const source = catalogObservationSources[0];
    if (source === undefined) throw new Error("missing catalog source");
    const emptySource = Object.freeze({
      ...source,
      decode: () => Object.freeze([]),
    });
    const desk = new CatalogObservationDesk({
      sources: [emptySource],
      now: () => Date.parse("2026-08-01T03:16:00.000Z"),
      fetcher: async () => new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });
    await desk.refresh();

    try {
      desk.resilientContext(
        desk.registeredVenueIds(),
        1,
        () => { throw new Error("must not build an empty context"); },
      );
      throw new Error("expected insufficient coverage");
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogContextCoverageError);
      expect((error as CatalogContextCoverageError).coverage.omittedSources).toEqual([
        expect.objectContaining({
          venueId: source.venueId,
          reason: "EMPTY_OBSERVATION",
          lastObservationRawHash: expect.stringMatching(/^sha256:/u),
        }),
      ]);
    }
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
