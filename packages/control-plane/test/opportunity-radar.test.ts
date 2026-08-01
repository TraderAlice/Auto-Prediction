import { describe, expect, it } from "vitest";
import {
  buildOpportunityRadar,
  orderRadarCandidatesForSearch,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const SOURCE_SET = `sha256:${"c".repeat(64)}`;

function listing(
  listingRef: string,
  venueId: string,
  title: string,
  options: Readonly<{
    closesAt?: string;
    rawHash?: string;
    yesPrice?: string;
    noPrice?: string;
    priceScale?: string;
  }> = {},
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
      Object.freeze({ venueOutcomeId: `${listingRef}:yes`, label: "Yes", indicativePrice: options.yesPrice ?? "0.5" }),
      Object.freeze({ venueOutcomeId: `${listingRef}:no`, label: "No", indicativePrice: options.noPrice ?? "0.5" }),
    ]),
    priceScale: options.priceScale ?? "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
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
      algorithmVersion: "pmh.opportunity-radar.semantic-rotation-v3",
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
      semanticScopeIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      routingScopeIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      semanticScoreBps: 10_000,
      sharedTerms: ["bnb", "down", "up"],
      timeframe: "HOURLY",
      effectiveCloseAt: "2026-08-01T05:00:00.000Z",
      temporalAlignment: "ALIGNED",
      indicativeEconomics: {
        status: "NON_POSITIVE_GROSS_HINT",
        grossEdgeBpsFloor: "0",
      },
      status: "READY_FOR_SCOUT",
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      arbitrageVerified: false,
      executionAuthority: false,
    });
  });

  it("ranks a positive mixed-scale pair before a higher lexical non-positive pair", () => {
    const projection = radar([
      listing("venue-a:alpha", "venue-a", "ALPHA election winner", {
        yesPrice: "0.40",
        noPrice: "0.60",
        priceScale: "1000000",
      }),
      listing("venue-b:alpha", "venue-b", "ALPHA election winner", {
        yesPrice: "0.70",
        noPrice: "0.30",
        priceScale: "100000000",
        rawHash: HASH_B,
      }),
      listing("venue-a:beta", "venue-a", "BETA election winner exact", {
        yesPrice: "0.50",
        noPrice: "0.50",
      }),
      listing("venue-c:beta", "venue-c", "BETA election winner exact", {
        yesPrice: "0.50",
        noPrice: "0.50",
        rawHash: HASH_B,
      }),
    ]);

    expect(projection.candidates[0]).toMatchObject({
      sharedTerms: expect.arrayContaining(["alpha"]),
      indicativeEconomics: {
        status: "POSITIVE_GROSS_HINT",
        portfolioLabel: "Left true + right false",
        indicativeCostBpsCeil: "7000",
        grossEdgeBpsFloor: "3000",
        feesIncluded: false,
        depthIncluded: false,
        executable: false,
      },
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
    expect(first.candidates[0]?.semanticScopeIdentity).toBe(
      second.candidates[0]?.semanticScopeIdentity,
    );
    expect(first.candidates[0]?.routingScopeIdentity).toBe(
      second.candidates[0]?.routingScopeIdentity,
    );
  });

  it("keeps equal-score radar ordering stable across source-only refreshes", () => {
    const build = (rawHash: string) => radar([
      listing("venue-a:alpha", "venue-a", "ALPHA election winner"),
      listing("venue-b:alpha", "venue-b", "ALPHA election winner", { rawHash }),
      listing("venue-a:beta", "venue-a", "BETA championship winner"),
      listing("venue-c:beta", "venue-c", "BETA championship winner", { rawHash }),
    ]).candidates
      .filter((candidate) =>
        candidate.sharedTerms.includes("alpha") || candidate.sharedTerms.includes("beta")
      )
      .map((candidate) => candidate.semanticScopeIdentity);

    expect(build(HASH_A)).toEqual(build(HASH_B));
  });

  it("rotates unseen semantic scopes ahead of completed and repeated scopes", () => {
    const projection = radar([
      listing("venue-a:alpha", "venue-a", "ALPHA election winner"),
      listing("venue-b:alpha", "venue-b", "ALPHA election winner", { rawHash: HASH_B }),
      listing("venue-a:beta", "venue-a", "BETA championship winner"),
      listing("venue-c:beta", "venue-c", "BETA championship winner", { rawHash: HASH_B }),
      listing("venue-a:gamma", "venue-a", "GAMMA weather threshold"),
      listing("venue-d:gamma", "venue-d", "GAMMA weather threshold", { rawHash: HASH_B }),
    ]);
    const alpha = projection.candidates.find((candidate) =>
      candidate.sharedTerms.includes("alpha")
    )!;
    const beta = projection.candidates.find((candidate) =>
      candidate.sharedTerms.includes("beta")
    )!;
    const gamma = projection.candidates.find((candidate) =>
      candidate.sharedTerms.includes("gamma")
    )!;

    expect(orderRadarCandidatesForSearch([alpha, beta, gamma], {
      completedSemanticScopeIdentities: [alpha.semanticScopeIdentity],
      attemptedRoutingScopeIdentities: [alpha.routingScopeIdentity, beta.routingScopeIdentity],
    })).toEqual([gamma, beta, alpha]);
  });
});
