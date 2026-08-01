import { resolve } from "node:path";
import { formatFixed, hashCanonical, type Hash } from "@pmh/domain";
import { loadRawFixture } from "@pmh/evidence";
import type { NormalizedCatalogListing } from "@pmh/protocol";
import { normalizeGeminiCatalog } from "@pmh/venue-gemini";
import { normalizeKalshiCatalog } from "@pmh/venue-kalshi";
import { normalizeLimitlessCatalog } from "@pmh/venue-limitless";
import { normalizeMyriadCatalog } from "@pmh/venue-myriad";
import { normalizeOpinionCatalog } from "@pmh/venue-opinion";
import { normalizePolymarketCatalog } from "@pmh/venue-polymarket";
import type {
  DiscoveryCatalogContext,
  DiscoveryCatalogListing,
  DiscoveryCatalogContextSource,
  DiscoveryCatalogProjection,
} from "./types.js";

export const MAX_LISTINGS_PER_TASK = 30;
const MAX_DESCRIPTION_CHARACTERS = 800;
const MAX_RULE_CHARACTERS = 1_200;

type CatalogSource = Readonly<{
  venueId: string;
  fixtureName: string;
  decode: (
    fixture: Awaited<ReturnType<typeof loadRawFixture>>,
  ) => readonly NormalizedCatalogListing[];
}>;

const sources: readonly CatalogSource[] = [
  {
    venueId: "polymarket-global",
    fixtureName: "polymarket-catalog",
    decode: normalizePolymarketCatalog,
  },
  {
    venueId: "kalshi",
    fixtureName: "kalshi-catalog",
    decode: normalizeKalshiCatalog,
  },
  {
    venueId: "gemini-predictions",
    fixtureName: "gemini-binary-catalog",
    decode: normalizeGeminiCatalog,
  },
  {
    venueId: "gemini-predictions",
    fixtureName: "gemini-range-catalog",
    decode: normalizeGeminiCatalog,
  },
  {
    venueId: "opinion",
    fixtureName: "opinion-catalog",
    decode: normalizeOpinionCatalog,
  },
  {
    venueId: "myriad",
    fixtureName: "myriad-amm-catalog",
    decode: normalizeMyriadCatalog,
  },
  {
    venueId: "limitless",
    fixtureName: "limitless-catalog",
    decode: normalizeLimitlessCatalog,
  },
];

function textOnly(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<\/?(?:p|div|li|br|h[1-6])\b[^>]*>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

function compactText(value: string, limit: number): string {
  const normalized = textOnly(value).trim().replace(/\s+/gu, " ");
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function searchTerms(value: string): ReadonlySet<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9$%°]+/u)
      .filter((term) => term.length >= 3),
  );
}

export function toDiscoveryCatalogListing(
  listing: NormalizedCatalogListing,
  source: Readonly<{
    kind: DiscoveryCatalogListing["sourceKind"];
    receivedAt: string;
  }>,
): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef: `${listing.venueId}:${listing.venueInstrumentId}`,
    venueId: listing.venueId,
    venueInstrumentId: listing.venueInstrumentId,
    title: compactText(listing.title, 500),
    description: compactText(listing.description, MAX_DESCRIPTION_CHARACTERS),
    status: listing.status,
    mechanism: listing.mechanism,
    closesAt: listing.closesAt ?? null,
    rulesText:
      listing.rulesText === undefined
        ? null
        : compactText(listing.rulesText, MAX_RULE_CHARACTERS),
    outcomes: Object.freeze(
      listing.outcomes.map((outcome) =>
        Object.freeze({
          label: compactText(outcome.label, 120),
          indicativePrice:
            outcome.indicativePrice === undefined
              ? null
              : formatFixed(outcome.indicativePrice, listing.priceScale),
        }),
      ),
    ),
    sourceKind: source.kind,
    sourceReceivedAt: source.receivedAt,
    sourceRawHash: listing.sourceFixtureHash,
    protocolIdentity: listing.protocolIdentity,
  });
}

export function buildDiscoveryCatalogContext(
  source: DiscoveryCatalogContextSource,
  listingsInput: readonly DiscoveryCatalogListing[],
  question: string,
  venueIds: readonly string[],
): DiscoveryCatalogContext {
  const allowedVenues = new Set(venueIds);
  const queryTerms = searchTerms(question);
  const ranked = listingsInput
    .filter((listing) => allowedVenues.has(listing.venueId))
    .map((listing) => {
      const listingTerms = searchTerms(
        `${listing.title} ${listing.description} ${listing.rulesText ?? ""}`,
      );
      const score = [...queryTerms].filter((term) => listingTerms.has(term)).length;
      return { listing, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.listing.listingRef.localeCompare(right.listing.listingRef),
    );
  const positive = ranked.filter((item) => item.score > 0);
  const strongestScore = positive[0]?.score ?? 0;
  const relevant = positive.filter(
    (item) => item.score >= Math.max(1, strongestScore - 1),
  );
  const listings = Object.freeze(
    (relevant.length > 0 ? relevant : ranked)
      .slice(0, MAX_LISTINGS_PER_TASK)
      .map((item) => item.listing),
  );
  if (new Set(listings.map((listing) => listing.listingRef)).size !== listings.length) {
    throw new Error("catalog context has duplicate listing references");
  }
  const body = {
    schemaVersion: "pmh.discovery-catalog-context.v2" as const,
    source,
    contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
    listings,
  };
  return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
}

export class FixtureCatalogDiscoveryDesk {
  readonly #fixtureRoot: string;
  #listings: readonly DiscoveryCatalogListing[] = Object.freeze([]);
  #sourceFixtureHashes: readonly Hash[] = Object.freeze([]);
  #corpusIdentity: string = hashCanonical({ listings: [], sourceFixtureHashes: [] });
  #inFlight: Promise<DiscoveryCatalogProjection> | undefined;
  #loaded = false;

  public constructor(
    fixtureRoot = resolve(import.meta.dirname, "../../../projects/fixtures"),
  ) {
    this.#fixtureRoot = fixtureRoot;
  }

  public load(): Promise<DiscoveryCatalogProjection> {
    if (this.#loaded) return Promise.resolve(this.projection());
    if (this.#inFlight !== undefined) return this.#inFlight;
    const operation = this.#performLoad().finally(() => {
      this.#inFlight = undefined;
    });
    this.#inFlight = operation;
    return operation;
  }

  async #performLoad(): Promise<DiscoveryCatalogProjection> {
    const decoded = await Promise.all(
      sources.map(async (source) => {
        const base = resolve(
          this.#fixtureRoot,
          source.venueId,
          "2026-07-31",
          source.fixtureName,
        );
        const fixture = await loadRawFixture(`${base}.json`, `${base}.meta.json`);
        return {
          sourceFixtureHash: fixture.rawHash,
          listings: source.decode(fixture).map((listing) =>
            toDiscoveryCatalogListing(listing, {
              kind: "VERIFIED_FIXTURE",
              receivedAt: fixture.metadata.fetchedAt,
            }),
          ),
        };
      }),
    );
    const listings = decoded
      .flatMap((item) => item.listings)
      .sort((left, right) => left.listingRef.localeCompare(right.listingRef));
    if (new Set(listings.map((listing) => listing.listingRef)).size !== listings.length) {
      throw new Error("catalog discovery corpus has duplicate listing references");
    }
    this.#listings = Object.freeze(listings);
    this.#sourceFixtureHashes = Object.freeze(
      decoded.map((item) => item.sourceFixtureHash).sort(),
    );
    this.#corpusIdentity = hashCanonical({
      listings: this.#listings,
      sourceFixtureHashes: this.#sourceFixtureHashes,
    });
    this.#loaded = true;
    return this.projection();
  }

  public projection(): DiscoveryCatalogProjection {
    return Object.freeze({
      mode: "VERIFIED_FIXTURE_CATALOGS",
      corpusIdentity: this.#corpusIdentity,
      listingCount: this.#listings.length,
      venueCount: new Set(this.#listings.map((listing) => listing.venueId)).size,
      sourceFixtureCount: this.#sourceFixtureHashes.length,
      maxListingsPerTask: MAX_LISTINGS_PER_TASK,
    });
  }

  public context(
    question: string,
    venueIds: readonly string[],
  ): DiscoveryCatalogContext {
    if (!this.#loaded) {
      throw new Error("catalog discovery corpus is not loaded");
    }
    return buildDiscoveryCatalogContext(
      "VERIFIED_FIXTURE_CATALOGS",
      this.#listings,
      question,
      venueIds,
    );
  }
}
