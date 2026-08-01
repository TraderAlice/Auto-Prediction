import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  AnonymousSimulationMaterializerDesk,
  type AnonymousMaterializerFetchLike,
  type ResearchRelationPayoffQualification,
} from "../src/index.js";

function qualification(
  venueId: "polymarket-global" | "limitless" | "opinion" =
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
        priceScale: "1000",
        quantityScale: "1000",
        minPriceTick: "1",
        trueOutcome: { venueOutcomeId: "left-yes", label: "Yes" },
        falseOutcome: { venueOutcomeId: "left-no", label: "No" },
      },
      {
        position: "RIGHT" as const,
        listingRef: rightRef,
        listingHash: hashCanonical({ listing: "right" }),
        venueId,
        venueInstrumentId: "right-market",
        priceScale: "1000",
        quantityScale: "1000",
        minPriceTick: "1",
        trueOutcome: { venueOutcomeId: "right-yes", label: "Yes" },
        falseOutcome: { venueOutcomeId: "right-no", label: "No" },
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

describe("anonymous simulation materializer", () => {
  it("binds zero-fee Polymarket books into an exact bigint simulation plan", async () => {
    const calls: Array<Readonly<{ url: string; init: Parameters<AnonymousMaterializerFetchLike>[1] }>> = [];
    const fetcher: AnonymousMaterializerFetchLike = async (url, init) => {
      calls.push({ url, init });
      const token = new URL(url).searchParams.get("token_id")!;
      if (url.includes("/fee-rate")) return jsonResponse({ base_fee: 0 });
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
      requestedQuantity: "1000",
    });

    expect(result.record).toMatchObject({
      status: "READY",
      opportunityId: qualified.opportunityId,
      portfolioId,
      requestedQuantity: "1000",
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
    ).toEqual([400n, 500n]);
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
      requestedQuantity: "1000",
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
      requestedQuantity: "1000",
    });

    expect(result.record.status).toBe("BLOCKED");
    expect(result.record.legs[0]).toMatchObject({
      blocker: "BOOK_INSTRUMENT_MISMATCH",
      bookSourceId: expect.stringMatching(/^sha256:/),
    });
    expect(result.record.legs[1]?.blocker).toBe("DYNAMIC_FEE_MODEL_UNSUPPORTED");
  });

  it("blocks non-zero Polymarket fees instead of treating the base rate as linear", async () => {
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      const token = new URL(url).searchParams.get("token_id")!;
      return url.includes("/fee-rate")
        ? jsonResponse({ base_fee: 30 })
        : jsonResponse({
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
      requestedQuantity: "1000",
    });

    expect(result.plan).toBeNull();
    expect(result.record.legs.every(
      (leg) => leg.blocker === "NON_ZERO_CURVED_FEE_UNSUPPORTED",
    )).toBe(true);
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
      requestedQuantity: "1000",
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
        : { ...binding, quantityScale: "100", priceScale: "100" },
    );
    const { artifactHash: _artifactHash, ...body } = original;
    const qualified = Object.freeze({
      ...body,
      listingBindings: mismatchedBindings,
      artifactHash: hashCanonical({ ...body, listingBindings: mismatchedBindings }),
    });
    const fetcher: AnonymousMaterializerFetchLike = async (url) => {
      const token = new URL(url).searchParams.get("token_id")!;
      return url.includes("/fee-rate")
        ? jsonResponse({ base_fee: 0 })
        : jsonResponse({
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
      requestedQuantity: "1000",
    });

    expect(result.plan).toBeNull();
    expect(result.record.legs.every(
      (leg) => leg.blocker === "INCOMPATIBLE_PORTFOLIO_SCALE",
    )).toBe(true);
  });
});
