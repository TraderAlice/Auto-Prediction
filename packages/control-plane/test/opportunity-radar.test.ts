import { describe, expect, it } from "vitest";
import {
  buildOpportunityRadar,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const SOURCE_SET = `sha256:${"c".repeat(64)}`;

function listing(
  listingRef: string,
  venueId: string,
  title: string,
  options: Readonly<{ closesAt?: string; rawHash?: string }> = {},
): DiscoveryCatalogListing {
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId: listingRef.split(":").at(-1) ?? listingRef,
    title,
    description: "Bounded catalog description",
    status: "OPEN",
    mechanism: "ONCHAIN_CLOB",
    closesAt: options.closesAt ?? null,
    rulesText: null,
    outcomes: Object.freeze([
      Object.freeze({ label: "Yes", indicativePrice: "0.5" }),
      Object.freeze({ label: "No", indicativePrice: "0.5" }),
    ]),
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T04:07:36.000Z",
    sourceRawHash: options.rawHash ?? HASH_A,
    protocolIdentity: `${venueId}:v1`,
  });
}

function radar(listings: readonly DiscoveryCatalogListing[]) {
  return buildOpportunityRadar({
    sourceSetIdentity: SOURCE_SET,
    observedListingCount: listings.length,
    eligibleSourceCount: new Set(listings.map((item) => item.venueId)).size,
    excludedSourceCount: 0,
    listings,
  });
}

describe("opportunity radar", () => {
  it("retains an evidence-bound cross-venue pair with an aligned cadence and close", () => {
    const projection = radar([
      listing(
        "opinion:26312",
        "opinion",
        "BNB Up or Down - Hourly (Aug 01, 2026 05:00 UTC Close)",
        { rawHash: HASH_A },
      ),
      listing("limitless:343040", "limitless", "BNB Up or Down - Hourly", {
        closesAt: "2026-08-01T05:00:00.000Z",
        rawHash: HASH_B,
      }),
    ]);

    expect(projection).toMatchObject({
      algorithmVersion: "pmh.opportunity-radar.lexical-v1",
      candidateCount: 1,
      scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE",
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.candidates[0]).toMatchObject({
      candidateId: expect.stringMatching(/^radar-candidate:[0-9a-f]{64}$/),
      semanticScoreBps: 10_000,
      sharedTerms: ["bnb", "down", "up"],
      timeframe: "HOURLY",
      effectiveCloseAt: "2026-08-01T05:00:00.000Z",
      temporalAlignment: "ALIGNED",
      status: "READY_FOR_SCOUT",
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      arbitrageVerified: false,
      executionAuthority: false,
    });
  });

  it("rejects lookalike minute and daily markets before AI triage", () => {
    const projection = radar([
      listing(
        "opinion:btc-hour",
        "opinion",
        "BTC Up or Down - Hourly (Aug 01, 2026 05:00 UTC Close)",
      ),
      listing("limitless:btc-5m", "limitless", "BTC Up or Down - 5 Min", {
        closesAt: "2026-08-01T04:10:00.000Z",
        rawHash: HASH_B,
      }),
      listing("limitless:btc-day", "limitless", "BTC Up or Down - Daily", {
        closesAt: "2026-08-01T16:00:00.000Z",
        rawHash: HASH_B,
      }),
    ]);

    expect(projection.candidateCount).toBe(0);
  });

  it("does not elevate one shared rare name into a candidate", () => {
    const projection = radar([
      listing(
        "gemini:taylor-moore",
        "gemini-predictions",
        "Rocket Classic Winner — Taylor Moore",
      ),
      listing(
        "polymarket:wes-moore",
        "polymarket-global",
        "Will Wes Moore win the 2028 Democratic presidential nomination?",
        { rawHash: HASH_B },
      ),
    ]);

    expect(projection.candidateCount).toBe(0);
  });

  it("changes candidate identity when bound source evidence changes", () => {
    const first = radar([
      listing("opinion:eth", "opinion", "ETH Up or Down - Hourly"),
      listing("limitless:eth", "limitless", "ETH Up or Down - Hourly", {
        rawHash: HASH_B,
      }),
    ]);
    const second = radar([
      listing("opinion:eth", "opinion", "ETH Up or Down - Hourly", {
        rawHash: `sha256:${"d".repeat(64)}`,
      }),
      listing("limitless:eth", "limitless", "ETH Up or Down - Hourly", {
        rawHash: HASH_B,
      }),
    ]);

    expect(first.candidates[0]?.candidateId).not.toBe(
      second.candidates[0]?.candidateId,
    );
  });
});
