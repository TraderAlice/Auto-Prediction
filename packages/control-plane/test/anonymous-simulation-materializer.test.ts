import { hashCanonical } from "@pmh/domain";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runOpportunitySimulation } from "@pmh/execution";
import {
  AnonymousSimulationMaterializerDesk,
  SqliteOperationalStore,
  verifyMaterializedOpportunity,
  type AnonymousMaterializerFetchLike,
  type ResearchRelationPayoffQualification,
} from "../src/index.js";

function qualification(
  venueId: "polymarket-global" | "polymarket-us" | "limitless" | "opinion" =
    "polymarket-global",
): ResearchRelationPayoffQualification {
  const leftRef = `${venueId}:left-market`;
  const rightRef = `${venueId}:right-market`;
  const portfolioBody = {
    label: "Left false + right true",
    legs: [
      {
        legId: "left:FALSE",
        listingRef: leftRef,
        outcome: "FALSE" as const,
      },
      {
        legId: "right:TRUE",
        listingRef: rightRef,
        outcome: "TRUE" as const,
      },
    ],
    payoutUnitsByState: { FF: 1, FT: 2, TT: 1 },
    minimumPayoutUnits: 1,
  };
  const portfolio = Object.freeze({
    ...portfolioBody,
    portfolioId: hashCanonical(portfolioBody),
  });
  const body = {
    schemaVersion: "pmh.research-relation-payoff.v1" as const,
    opportunityId: "ai:materializer-fixture",
    proposalId: hashCanonical({ proposal: "fixture" }),
    semanticReviewArtifactHash: hashCanonical({ review: "fixture" }),
    semanticDecisionId: hashCanonical({ decision: "fixture" }),
    relationKind: "IMPLIES" as const,
    status: "SIMULATION_TEMPLATE_READY" as const,
    diagnostic: null,
    listingBindings: [
      {
        position: "LEFT" as const,
        listingRef: leftRef,
        listingHash: hashCanonical({ listing: "left" }),
        venueId,
        venueInstrumentId: "left-market",
        priceScale: "100000000",
        quantityScale: venueId === "polymarket-us" ? "10000" : "100000000",
        minPriceTick: venueId === "polymarket-us" ? "100000" : "1000000",
        trueOutcome: { venueOutcomeId: venueId === "polymarket-us" ? "left-yes-side" : "left-yes", label: "Yes" },
        falseOutcome: { venueOutcomeId: venueId === "polymarket-us" ? "left-no-side" : "left-no", label: "No" },
      },
      {
        position: "RIGHT" as const,
        listingRef: rightRef,
        listingHash: hashCanonical({ listing: "right" }),
        venueId,
        venueInstrumentId: "right-market",
        priceScale: "100000000",
        quantityScale: venueId === "polymarket-us" ? "10000" : "100000000",
        minPriceTick: venueId === "polymarket-us" ? "100000" : "1000000",
        trueOutcome: { venueOutcomeId: venueId === "polymarket-us" ? "right-yes-side" : "right-yes", label: "Yes" },
        falseOutcome: { venueOutcomeId: venueId === "polymarket-us" ? "right-no-side" : "right-no", label: "No" },
      },
    ],
    canonicalStates: [
      { stateId: "FF", truthByListingRef: { [leftRef]: false, [rightRef]: false } },
      { stateId: "FT", truthByListingRef: { [leftRef]: false, [rightRef]: true } },
      { stateId: "TT", truthByListingRef: { [leftRef]: true, [rightRef]: true } },
    ],
    portfolios: [portfolio],
    authority: "DETERMINISTIC_RESEARCH_COMPILER" as const,
    verifierEligible: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function polymarketUsMarket(slug: string, theta = 0.06, minimumTradeQty = 1) {
  return {
    market: {
      id: slug === "left-market" ? "101" : "102",
      slug,
      active: true,
      closed: false,
      archived: false,
      status: "MARKET_STATUS_OPEN",
      orderPriceMinTickSize: 0.001,
      minimumTradeQty,
      feeCoefficient: theta,
      marketSides: [
        {
          id: `${slug.replace("-market", "")}-yes-side`,
          identifier: slug,
          description: "Yes",
          long: true,
        },
        {
          id: `${slug.replace("-market", "")}-no-side`,
          identifier: slug,
          description: "No",
          long: false,
        },
      ],
    },
  };
}

function polymarketUsBook(slug: string, input?: {
  bid?: string;
  offer?: string;
  bidQuantity?: string;
  offerQuantity?: string;
  state?: string;
}) {
  return {
    marketData: {
      marketSlug: slug,
      bids: [
        {
          px: { value: input?.bid ?? "0.2000", currency: "USD" },
          qty: input?.bidQuantity ?? "2.0000",
        },
      ],
      offers: [
        {
          px: { value: input?.offer ?? "0.1500", currency: "USD" },
          qty: input?.offerQuantity ?? "2.0000",
        },
      ],
      state: input?.state ?? "MARKET_STATE_OPEN",
      transactTime: slug === "left-market"
        ? "2026-08-02T00:00:00.100000000Z"
        : "2026-08-02T00:00:00.200000000Z",
    },
  };
}

function polymarketUsRequestSlug(url: string): string {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return url.includes("/market/slug/") ? parts.at(-1)! : parts.at(-2)!;
}

describe("anonymous simulation materializer", () => {
  it("binds zero-fee Polymarket books into an exact bigint simulation plan", async () => {
    const calls: Array<Readonly<{ url: string; init: Parameters<AnonymousMaterializerFetchLike>[1] }>> = [];
    const fetcher: AnonymousMaterializerFetchLike = async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/clob-markets/")) {
        const condition = new URL(url).pathname.split("/").at(-1)!;
        const token = condition.replace(/-condition$/u, "");
        return jsonResponse({
          t: [{ t: token, o: "bound" }, { t: `${token}-other`, o: "other" }],
          mts: 0.01,
          fd: null,
        });
      }
      const token = new URL(url).searchParams.get("token_id")!;
      return jsonResponse({
        market: `${token}-condition`,
        asset_id: token,
        timestamp: "1785556800000",
        hash: `generation:${token}`,
        bids: [],
        asks: [
          { price: token === "left-no" ? "0.4" : "0.5", size: "2.5" },
        ],
      });
    };
    const qualified = qualification();
    const portfolioId = qualified.portfolios[0]!.portfolioId;
    const desk = new AnonymousSimulationMaterializerDesk({
      fetcher,
      now: () => new Date("2026-08-01T08:00:00.000Z"),
    });

    const result = await desk.materialize({
      qualification: qualified,
      portfolioId,
      requestedQuantity: "100000000",
    });

    expect(result.record).toMatchObject({
      status: "READY",
      opportunityId: qualified.opportunityId,
      portfolioId,
      requestedQuantity: "100000000",
      certificateAuthority: false,
      executionAuthority: false,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(result.record.legs).toHaveLength(2);
    expect(result.record.legs.every((leg) => leg.status === "READY")).toBe(true);
    expect(result.rawSources).toHaveLength(4);
    expect(result.plan?.legs.map((leg) => leg.request.instrumentId)).toEqual([
      "left-no",
      "right-yes",
    ]);
    expect(
      result.plan?.legs.map((leg) =>
        leg.request.model === "CLOB_TAKER_V1"
          ? leg.request.levels[0]?.price
          : null,
      ),
    ).toEqual([40_000_000n, 50_000_000n]);
    expect(result.record.legs.every(
      (leg) =>
        leg.feeModel === "COLLATERAL_RATE_V1" &&
        leg.feeQualification === "EXACT",
    )).toBe(true);
    expect(calls).toHaveLength(4);
    expect(
      calls.every(
        ({ init }) =>
          init.method === "GET" &&
          init.credentials === "omit" &&
          init.redirect === "error",
      ),
    ).toBe(true);
    expect(desk.projection()).toMatchObject({
      status: "READY",
      runCount: 1,
      readyCount: 1,
      retainedRawSourceCount: 4,
    });
  });

  it("materializes Polymarket US YES offers and complemented NO bids with an exact fee bound", async () => {
    const calls: string[] = [];
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      calls.push(url);
      const slug = polymarketUsRequestSlug(url);
      return url.includes("/market/slug/")
        ? jsonResponse(polymarketUsMarket(slug))
        : jsonResponse(polymarketUsBook(slug));
    };
    const qualified = qualification("polymarket-us");
    const result = await new AnonymousSimulationMaterializerDesk({
      fetcher,
      now: () => new Date("2026-08-02T00:00:00.300Z"),
    }).materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "10000",
    });
    expect(result.record.status).toBe("READY");
    expect(result.rawSources).toHaveLength(4);
    expect(result.record.legs).toEqual([
      expect.objectContaining({
        outcome: "FALSE",
        instrumentId: "left-no-side",
        feeModel: "BINARY_THETA_ORDER_BOUND_V1",
        feeQualification: "EXACT",
      }),
      expect.objectContaining({
        outcome: "TRUE",
        instrumentId: "right-yes-side",
        feeModel: "BINARY_THETA_ORDER_BOUND_V1",
        feeQualification: "EXACT",
      }),
    ]);
    expect(
      result.plan?.legs.map((leg) =>
        leg.request.model === "CLOB_TAKER_V1"
          ? {
              instrumentId: leg.request.instrumentId,
              price: leg.request.levels[0]?.price,
              fee: leg.request.fee.model === "COLLATERAL_RATE_V1"
                ? leg.request.fee.flat
                : null,
            }
          : null,
      ),
    ).toEqual([
      { instrumentId: "left-no-side", price: 80_000_000n, fee: 1_000_000n },
      { instrumentId: "right-yes-side", price: 15_000_000n, fee: 1_000_000n },
    ]);
    const bundle = runOpportunitySimulation(result.plan!);
    expect(bundle.status).toBe(
      "POSITIVE_SIMULATED_FLOOR",
    );
    const verification = verifyMaterializedOpportunity({
      qualification: qualified,
      materialization: result.record,
      bundle,
      nowEpochMs: BigInt(Date.parse("2026-08-02T00:00:00.400Z")),
    });
    expect(verification).toMatchObject({
      status: "CERTIFIED",
      certificate: { worstCaseAfterFees: 3_000_000n },
      authority: "FIRST_PARTY_EXACT_VERIFIER",
      executionAuthority: false,
    });
    expect(calls).toHaveLength(4);
    expect(calls.every((url) => url.startsWith("https://gateway.polymarket.us/"))).toBe(true);
  });

  it("uses half-to-even rounding for the Polymarket US cumulative theta-fee cap", async () => {
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      const slug = polymarketUsRequestSlug(url);
      return url.includes("/market/slug/")
        ? jsonResponse(polymarketUsMarket(slug, 0.1))
        : jsonResponse(polymarketUsBook(slug, { bid: "0.5000", offer: "0.5000" }));
    };
    const qualified = qualification("polymarket-us");
    const result = await new AnonymousSimulationMaterializerDesk({ fetcher }).materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "10000",
    });

    expect(result.plan?.legs.map((leg) =>
      leg.request.model === "CLOB_TAKER_V1" &&
      leg.request.fee.model === "COLLATERAL_RATE_V1"
        ? leg.request.fee.flat
        : null,
    )).toEqual([2_000_000n, 2_000_000n]);
  });

  it("blocks Polymarket US quantities that are not aligned to current market metadata", async () => {
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      const slug = polymarketUsRequestSlug(url);
      return url.includes("/market/slug/")
        ? jsonResponse(polymarketUsMarket(slug, 0.06, 1))
        : jsonResponse(polymarketUsBook(slug));
    };
    const qualified = qualification("polymarket-us");
    const result = await new AnonymousSimulationMaterializerDesk({ fetcher }).materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "5000",
    });

    expect(result.plan).toBeNull();
    expect(result.record.legs.every(
      (leg) => leg.blocker === "ORDER_QUANTITY_UNSUPPORTED",
    )).toBe(true);
  });

  it("fails closed when Polymarket US market detail changes the bound side IDs", async () => {
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      const slug = polymarketUsRequestSlug(url);
      if (!url.includes("/market/slug/")) return jsonResponse(polymarketUsBook(slug));
      const detail = polymarketUsMarket(slug);
      detail.market.marketSides[0]!.id = "different-yes-side";
      return jsonResponse(detail);
    };
    const qualified = qualification("polymarket-us");
    const result = await new AnonymousSimulationMaterializerDesk({ fetcher }).materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "10000",
    });

    expect(result.plan).toBeNull();
    expect(result.record.legs.every(
      (leg) => leg.blocker === "FEE_ACQUISITION_FAILED",
    )).toBe(true);
    expect(result.record.diagnostic).toContain("side mapping");
  });

  it("restores ready Polymarket US raw evidence and fee bounds across SQLite restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-us-materializer-"));
    const databasePath = join(directory, "control-plane.sqlite");
    let store: SqliteOperationalStore | undefined;
    try {
      const fetcher: AnonymousMaterializerFetchLike = async (url) => {
        const slug = polymarketUsRequestSlug(url);
        return url.includes("/market/slug/")
          ? jsonResponse(polymarketUsMarket(slug))
          : jsonResponse(polymarketUsBook(slug));
      };
      const qualified = qualification("polymarket-us");
      store = new SqliteOperationalStore(databasePath);
      const materialized = await new AnonymousSimulationMaterializerDesk({
        fetcher,
        store,
        now: () => new Date("2026-08-02T00:00:00.300Z"),
      }).materialize({
        qualification: qualified,
        portfolioId: qualified.portfolios[0]!.portfolioId,
        requestedQuantity: "10000",
      });
      const sourceId = materialized.rawSources[0]!.record.sourceId;
      const sourceBytes = materialized.rawSources[0]!.bytes;
      store.close();

      store = new SqliteOperationalStore(databasePath);
      const restored = new AnonymousSimulationMaterializerDesk({ store });
      expect(restored.projection()).toMatchObject({
        runCount: 1,
        readyCount: 1,
        retainedRawSourceCount: 4,
        records: [{
          materializationId: materialized.record.materializationId,
          legs: [
            { feeModel: "BINARY_THETA_ORDER_BOUND_V1", feeQualification: "EXACT" },
            { feeModel: "BINARY_THETA_ORDER_BOUND_V1", feeQualification: "EXACT" },
          ],
        }],
      });
      expect(restored.rawSource(sourceId)?.bytes).toEqual(sourceBytes);
    } finally {
      store?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("captures Limitless books but blocks the undocumented linearization of dynamic taker fees", async () => {
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      const slug = new URL(url).pathname.split("/").at(-2)!;
      const tokenId = slug === "left-market" ? "left-no" : "right-yes";
      return jsonResponse({
        bids: [],
        asks: [{ price: "0.45", size: "2000", side: "SELL" }],
        tokenId,
        minSize: "1000",
      });
    };
    const qualified = qualification("limitless");
    const desk = new AnonymousSimulationMaterializerDesk({
      fetcher,
      now: () => new Date("2026-08-01T08:00:00.000Z"),
    });
    const result = await desk.materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "100000000",
    });

    expect(result.plan).toBeNull();
    expect(result.rawSources).toHaveLength(2);
    expect(result.record.legs.map((leg) => leg.blocker)).toEqual([
      "DYNAMIC_FEE_MODEL_UNSUPPORTED",
      "DYNAMIC_FEE_MODEL_UNSUPPORTED",
    ]);
    expect(result.record.diagnostic).toContain("taker fees vary");
  });

  it("fails visibly when a venue book returns another outcome instrument", async () => {
    const fetcher: AnonymousMaterializerFetchLike = async (url) =>
      url.includes("left-market")
        ? jsonResponse({
            bids: [],
            asks: [{ price: "0.4", size: "1000", side: "SELL" }],
            tokenId: "wrong-token",
          })
        : jsonResponse({
            bids: [],
            asks: [{ price: "0.5", size: "1000", side: "SELL" }],
            tokenId: "right-yes",
          });
    const qualified = qualification("limitless");
    const desk = new AnonymousSimulationMaterializerDesk({ fetcher });
    const result = await desk.materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "100000000",
    });

    expect(result.record.status).toBe("BLOCKED");
    expect(result.record.legs[0]).toMatchObject({
      blocker: "BOOK_INSTRUMENT_MISMATCH",
      bookSourceId: expect.stringMatching(/^sha256:/),
    });
    expect(result.record.legs[1]?.blocker).toBe("DYNAMIC_FEE_MODEL_UNSUPPORTED");
  });

  it("materializes non-zero Polymarket fees as a calibrated price curve", async () => {
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      if (url.includes("/clob-markets/")) {
        const condition = new URL(url).pathname.split("/").at(-1)!;
        const token = condition.replace(/-condition$/u, "");
        return jsonResponse({
          t: [{ t: token, o: "bound" }, { t: `${token}-other`, o: "other" }],
          mts: 0.01,
          mbf: 1000,
          tbf: 1000,
          fd: { r: 0.05, e: 1, to: true },
        });
      }
      const token = new URL(url).searchParams.get("token_id")!;
      return jsonResponse({
        market: `${token}-condition`,
        asset_id: token,
        hash: `generation:${token}`,
        asks: [{ price: "0.5", size: "2" }],
      });
    };
    const qualified = qualification();
    const result = await new AnonymousSimulationMaterializerDesk({
      fetcher,
    }).materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "100000000",
    });

    expect(result.plan).not.toBeNull();
    expect(result.record.status).toBe("READY");
    expect(result.record.legs.every(
      (leg) =>
        leg.feeModel === "BINARY_PRICE_CURVE_V1" &&
        leg.feeQualification === "REQUIRES_MATCH_CALIBRATION",
    )).toBe(true);
    expect(runOpportunitySimulation(result.plan!).status).toBe(
      "MODEL_CALIBRATION_REQUIRED",
    );
  });

  it("does not perform network calls for venues without anonymous book authority", async () => {
    let callCount = 0;
    const qualified = qualification("opinion");
    const result = await new AnonymousSimulationMaterializerDesk({
      fetcher: async () => {
        callCount += 1;
        return jsonResponse({});
      },
    }).materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "100000000",
    });

    expect(callCount).toBe(0);
    expect(result.record.legs.every(
      (leg) => leg.blocker === "UNSUPPORTED_ANONYMOUS_BOOK",
    )).toBe(true);
  });

  it("blocks base-unit quantities when portfolio legs use incompatible fixed-point scales", async () => {
    const original = qualification();
    const mismatchedBindings = original.listingBindings.map((binding, index) =>
      index === 0
        ? binding
        : {
            ...binding,
            quantityScale: "1000000",
            priceScale: "1000000",
            minPriceTick: "10000",
          },
    );
    const { artifactHash: _artifactHash, ...body } = original;
    const qualified = Object.freeze({
      ...body,
      listingBindings: mismatchedBindings,
      artifactHash: hashCanonical({ ...body, listingBindings: mismatchedBindings }),
    });
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      if (url.includes("/clob-markets/")) {
        const condition = new URL(url).pathname.split("/").at(-1)!;
        const token = condition.replace(/-condition$/u, "");
        const second = token === "right-yes";
        return jsonResponse({
          t: [{ t: token, o: "bound" }, { t: `${token}-other`, o: "other" }],
          mts: second ? 0.01 : 0.01,
          fd: null,
        });
      }
      const token = new URL(url).searchParams.get("token_id")!;
      return jsonResponse({
        market: `${token}-condition`,
        asset_id: token,
        hash: `generation:${token}`,
        asks: [{ price: "0.5", size: "20" }],
      });
    };
    const result = await new AnonymousSimulationMaterializerDesk({
      fetcher,
      now: () => new Date("2026-08-01T08:00:00.000Z"),
    }).materialize({
      qualification: qualified,
      portfolioId: qualified.portfolios[0]!.portfolioId,
      requestedQuantity: "100000000",
    });

    expect(result.plan).toBeNull();
    expect(result.record.legs.every(
      (leg) => leg.blocker === "INCOMPATIBLE_PORTFOLIO_SCALE",
    )).toBe(true);
  });
});
