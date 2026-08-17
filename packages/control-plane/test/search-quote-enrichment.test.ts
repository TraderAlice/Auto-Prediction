import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applySearchQuoteObservations,
  buildMarketCorpusSnapshot,
  buildSearchQuoteOverlayCorpus,
  SearchQuoteEnrichmentDesk,
  SqliteOperationalStore,
  verifyStoredSearchQuoteObservation,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const receivedAt = "2026-08-02T00:00:00.000Z";
const temporaryDirectories: string[] = [];

function listing(input: {
  venueId: string;
  suffix: string;
  prices: readonly [string | null, string | null];
}): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef: `${input.venueId}:${input.suffix}`,
    venueId: input.venueId,
    venueInstrumentId: input.suffix,
    title: "BTC Up or Down - Hourly",
    description: "Resolves Up when the end price exceeds the start price.",
    status: "ACTIVE",
    mechanism: "ONCHAIN_CLOB",
    closesAt: "2026-08-02T01:00:00.000Z",
    rulesText: "Resolves Up when the end price exceeds the start price.",
    outcomes: Object.freeze([
      Object.freeze({
        venueOutcomeId: input.venueId === "opinion" ? "101" : "201",
        label: "Up",
        indicativePrice: input.prices[0],
      }),
      Object.freeze({
        venueOutcomeId: input.venueId === "opinion" ? "102" : "202",
        label: "Down",
        indicativePrice: input.prices[1],
      }),
    ]),
    priceScale: "100000000",
    quantityScale: "1000000000000000000",
    minPriceTick: null,
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: receivedAt,
    sourceRawHash: hashCanonical(input),
    protocolIdentity: `protocol:${input.venueId}`,
  });
}

function opinionBook(tokenId: string, ask: string): Response {
  return new Response(JSON.stringify({
    errmsg: "",
    errno: 0,
    result: {
      asks: [{ price: ask, size: "5000" }],
      bids: [{ price: "0.01", size: "7000" }],
      market: "market-id",
      timestamp: 1785621964877,
      tokenId,
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function geminiEvent(ticker: string, instrumentSymbol: string,
  yes: string, no: string): Response {
  return new Response(JSON.stringify({ id: ticker, ticker,
    title: ticker, type: "categorical", status: "active",
    expiryDate: "2026-11-10T00:00:00.000Z", contracts: [{ id: `${ticker}-1`,
      label: instrumentSymbol, ticker: instrumentSymbol.split("-").at(-1),
      instrumentSymbol, status: "active", marketState: "open",
      prices: { buy: { yes, no } } }] }), { status: 200,
    headers: { "content-type": "application/json; charset=utf-8" } });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("selected-pair anonymous quote enrichment", () => {
  it("does not invoke the network when leased catalog prices are complete", async () => {
    const fetch = vi.fn();
    const desk = new SearchQuoteEnrichmentDesk({ fetch });
    const result = await desk.enrich([
      listing({ venueId: "limitless", suffix: "a", prices: ["0.4", "0.6"] }),
      listing({ venueId: "opinion", suffix: "b", prices: ["0.5", "0.5"] }),
    ]);

    expect(result.status).toBe("NOT_REQUIRED");
    expect(result.effects.anonymousPublicGets).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches only the missing Opinion outcome books and persists raw bytes", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      const tokenId = new URL(url).searchParams.get("token_id")!;
      expect(init).toMatchObject({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        headers: { accept: "application/json" },
      });
      expect((init.headers as Record<string, string>).apikey).toBeUndefined();
      return opinionBook(tokenId, tokenId === "101" ? "0.51" : "0.39");
    });
    const directory = mkdtempSync(join(tmpdir(), "pmh-search-quotes-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "operations.sqlite");
    const store = new SqliteOperationalStore(databasePath);
    const desk = new SearchQuoteEnrichmentDesk({
      fetch,
      store,
      now: () => Date.parse(receivedAt),
    });

    const result = await desk.enrich([
      listing({ venueId: "limitless", suffix: "a", prices: ["0.4", "0.6"] }),
      listing({ venueId: "opinion", suffix: "b", prices: [null, null] }),
    ]);

    expect(result).toMatchObject({
      status: "READY",
      attemptedOutcomeCount: 2,
      enrichedOutcomeCount: 2,
      authority: "SEARCH_PRICE_EVIDENCE_ONLY",
      semanticDecisionAuthority: false,
      simulationAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: {
        anonymousPublicGets: true,
        credentialsUsed: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.listings[1]?.outcomes.map((outcome) => outcome.indicativePrice))
      .toEqual(["0.51", "0.39"]);
    expect(result.observationIds).toHaveLength(2);
    expect(store.loadSearchQuoteObservations(10).map((item) =>
      verifyStoredSearchQuoteObservation(item).record.observationId
    )).toEqual([...result.observationIds].reverse());
    store.close();

    const reopened = new SqliteOperationalStore(databasePath);
    const restored = new SearchQuoteEnrichmentDesk({ fetch, store: reopened });
    expect(restored.projection()).toMatchObject({
      retainedObservationCount: 2,
      storage: { mode: "SQLITE_WAL", durable: true, schemaVersion: 65 },
    });
    expect(restored.projection().observations.every((record) =>
      record.acquisition.credentialsUsed === false &&
      record.acquisition.valueMovingOperation === false
    )).toBe(true);
    reopened.close();
  });

  it("fails closed on a token mismatch without manufacturing a price", async () => {
    const fetch = vi.fn(async (url: string) => {
      const tokenId = new URL(url).searchParams.get("token_id")!;
      return opinionBook(tokenId === "101" ? "wrong" : tokenId, "0.5");
    });
    const result = await new SearchQuoteEnrichmentDesk({ fetch }).enrich([
      listing({ venueId: "limitless", suffix: "a", prices: ["0.4", "0.6"] }),
      listing({ venueId: "opinion", suffix: "b", prices: [null, null] }),
    ]);

    expect(result.status).toBe("PARTIAL");
    expect(result.enrichedOutcomeCount).toBe(1);
    expect(result.diagnostics.join(" ")).toContain("token id does not match");
    expect(result.listings[1]?.outcomes[0]?.indicativePrice).toBeNull();
    expect(result.executionAuthority).toBe(false);
  });

  it("does not make a request for an unsupported missing-price venue", async () => {
    const fetch = vi.fn();
    const result = await new SearchQuoteEnrichmentDesk({ fetch }).enrich([
      listing({ venueId: "limitless", suffix: "a", prices: ["0.4", "0.6"] }),
      listing({ venueId: "unknown", suffix: "b", prices: [null, null] }),
    ]);

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.attemptedOutcomeCount).toBe(0);
    expect(result.effects.anonymousPublicGets).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes Gemini event details once per listing and overlays retained semantics", async () => {
    const fetch = vi.fn(async (url: string) => {
      const ticker = new URL(url).pathname.split("/").at(-1)!;
      return ticker === "SEN26IA"
        ? geminiEvent(ticker, "GEMI-SEN26IA-JOSHTUREK", "0.48", "0.56")
        : geminiEvent(ticker, "GEMI-CTRLUSSEN-DEM", "0.47", "0.54");
    });
    const directory = mkdtempSync(join(tmpdir(), "pmh-gemini-quotes-"));
    temporaryDirectories.push(directory);
    const store = new SqliteOperationalStore(join(directory, "operations.sqlite"));
    const yesNo = (item: DiscoveryCatalogListing): DiscoveryCatalogListing =>
      Object.freeze({ ...item, outcomes: Object.freeze(item.outcomes.map((outcome, index) =>
        Object.freeze({ ...outcome, label: index === 0 ? "Yes" : "No" }))) });
    const iowa = yesNo(listing({ venueId: "gemini-predictions",
      suffix: "GEMI-SEN26IA-JOSHTUREK", prices: [null, null] }));
    const national = yesNo(listing({ venueId: "gemini-predictions",
      suffix: "GEMI-CTRLUSSEN-DEM", prices: [null, null] }));
    const result = await new SearchQuoteEnrichmentDesk({ fetch, store,
      now: () => Date.parse(receivedAt) }).enrich([iowa, national]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: "READY", attemptedOutcomeCount: 4,
      enrichedOutcomeCount: 4 });
    expect(result.listings.map((item) => item.outcomes.map((outcome) =>
      outcome.indicativePrice))).toEqual([["0.48", "0.56"], ["0.47", "0.54"]]);
    const observations = store.loadSearchQuoteObservations(10).map((item) =>
      verifyStoredSearchQuoteObservation(item).record);
    expect(observations).toHaveLength(4);
    expect(observations.every((item) => item.venueId === "gemini-predictions" &&
      item.schemaVersion === "pmh.search-quote-observation.v2")).toBe(true);
    expect(applySearchQuoteObservations(iowa, observations)).toMatchObject({
      outcomes: [{ indicativePrice: "0.48" }, { indicativePrice: "0.56" }],
      sourceKind: "LIVE_OBSERVATION", protocolIdentity: "search-quote-overlay.v1",
    });
    const semanticCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ fixture: "semantic" }),
      eligibleSourceCount: 1, excludedSourceCount: 0,
      listings: [iowa, national],
    });
    const emptyCurrentCorpus = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ fixture: "current-empty" }),
      eligibleSourceCount: 0, excludedSourceCount: 1, listings: [],
    });
    const overlay = buildSearchQuoteOverlayCorpus({ semanticCorpus,
      currentCorpus: emptyCurrentCorpus, observations });
    expect(overlay.listings.map((item) => item.outcomes.map((outcome) =>
      outcome.indicativePrice))).toEqual([["0.47", "0.54"], ["0.48", "0.56"]]);
    expect(overlay.listings.every((item) =>
      item.protocolIdentity === "search-quote-overlay.v1")).toBe(true);
    store.close();
  });
});
