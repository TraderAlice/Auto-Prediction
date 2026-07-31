import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildHedgeCurve,
  generateShadowMakerQuote,
  type HedgeSourceLevel,
} from "../src/index.js";

const SCALE = 100_000_000n;
const HASH = hashCanonical({ book: "state" });

function level(
  venueId: string,
  listingId: string,
  action: "BUY" | "SELL",
  quantity: bigint,
  price: bigint,
): HedgeSourceLevel {
  return {
    venueId,
    listingId,
    action,
    availableQuantity: quantity,
    quantityScale: SCALE,
    unitCollateral: price,
    collateralScale: SCALE,
    feeRate: 100_000n,
    feeRateScale: SCALE,
    executionRiskPerUnit: 200_000n,
    basisRiskPerUnit: 100_000n,
    venueRiskPerUnit: 100_000n,
    capitalLockPerUnit: 100_000n,
    bookStateHash: HASH,
  };
}

describe("executable hedge curves", () => {
  it("walks cheapest executable depth across multiple venues", () => {
    const curve = buildHedgeCurve({
      claimId: "claim:rain",
      outcomeId: "yes",
      action: "BUY",
      asOfEpochMs: 1_000n,
      levels: [
        level("venue:a", "listing:a", "BUY", 50n * SCALE, 40_000_000n),
        level("venue:b", "listing:b", "BUY", 100n * SCALE, 42_000_000n),
      ],
      checkpoints: [25n * SCALE, 100n * SCALE],
    });
    expect(curve.points[0]?.hedgeLegs).toHaveLength(1);
    expect(curve.points[1]?.hedgeLegs).toHaveLength(2);
    expect(curve.points[1]?.quantity).toBe(100n * SCALE);
  });

  it("generates shadow-only quotes bounded by hedge depth, inventory, and risk", () => {
    const checkpoints = [10n * SCALE, 20n * SCALE, 30n * SCALE];
    const buyCurve = buildHedgeCurve({
      claimId: "claim:rain",
      outcomeId: "yes",
      action: "BUY",
      asOfEpochMs: 1_000n,
      levels: [
        level("venue:a", "listing:a", "BUY", 30n * SCALE, 55_000_000n),
      ],
      checkpoints,
    });
    const sellCurve = buildHedgeCurve({
      claimId: "claim:rain",
      outcomeId: "yes",
      action: "SELL",
      asOfEpochMs: 1_000n,
      levels: [
        level("venue:b", "listing:b", "SELL", 30n * SCALE, 45_000_000n),
      ],
      checkpoints,
    });
    const quote = generateShadowMakerQuote({
      venueId: "venue:illiquid",
      listingId: "listing:illiquid",
      outcomeId: "yes",
      buyHedgeCurve: buyCurve,
      sellHedgeCurve: sellCurve,
      premiums: {
        targetVenueFee: 100_000n,
        executionRisk: 100_000n,
        resolutionMismatch: 100_000n,
        venueRisk: 100_000n,
        capitalLock: 100_000n,
        inventory: 100_000n,
      },
      maxQuoteQuantity: 30n * SCALE,
      inventoryCapacity: 20n * SCALE,
      riskBudgetQuantity: 25n * SCALE,
      payoutPerUnit: SCALE,
    });
    expect(quote.quantity).toBe(20n * SCALE);
    expect(quote.bidPrice).toBeLessThan(quote.askPrice);
    expect(quote.liveExecutionEnabled).toBe(false);
    expect(quote.buyHedge.hedgeLegs[0]?.venueId).toBe("venue:a");
    expect(quote.sellHedge.hedgeLegs[0]?.venueId).toBe("venue:b");
  });

  it("rejects quote sizes beyond common executable hedge depth", () => {
    const buyCurve = buildHedgeCurve({
      claimId: "claim:rain",
      outcomeId: "yes",
      action: "BUY",
      asOfEpochMs: 1_000n,
      levels: [level("venue:a", "a", "BUY", 10n * SCALE, 45_000_000n)],
      checkpoints: [10n * SCALE],
    });
    const sellCurve = buildHedgeCurve({
      claimId: "claim:rain",
      outcomeId: "yes",
      action: "SELL",
      asOfEpochMs: 1_000n,
      levels: [level("venue:b", "b", "SELL", 5n * SCALE, 55_000_000n)],
      checkpoints: [5n * SCALE],
    });
    expect(() =>
      generateShadowMakerQuote({
        venueId: "venue:illiquid",
        listingId: "listing:illiquid",
        outcomeId: "yes",
        buyHedgeCurve: buyCurve,
        sellHedgeCurve: sellCurve,
        premiums: {
          targetVenueFee: 0n,
          executionRisk: 0n,
          resolutionMismatch: 0n,
          venueRisk: 0n,
          capitalLock: 0n,
          inventory: 0n,
        },
        maxQuoteQuantity: 10n * SCALE,
        inventoryCapacity: 10n * SCALE,
        riskBudgetQuantity: 10n * SCALE,
        payoutPerUnit: SCALE,
      }),
    ).toThrow(/no common executable hedge quantity/);
  });

  it("rejects negative risk inputs and incompatible collateral scales", () => {
    expect(() =>
      buildHedgeCurve({
        claimId: "claim:rain",
        outcomeId: "yes",
        action: "BUY",
        asOfEpochMs: 1_000n,
        levels: [
          {
            ...level("venue:a", "a", "BUY", SCALE, 45_000_000n),
            basisRiskPerUnit: -1n,
          },
        ],
        checkpoints: [SCALE],
      }),
    ).toThrow(/invalid identities/);

    expect(() =>
      buildHedgeCurve({
        claimId: "claim:rain",
        outcomeId: "yes",
        action: "BUY",
        asOfEpochMs: 1_000n,
        levels: [
          level("venue:a", "a", "BUY", SCALE, 45_000_000n),
          {
            ...level("venue:b", "b", "BUY", SCALE, 46_000_000n),
            collateralScale: 1_000_000n,
          },
        ],
        checkpoints: [SCALE],
      }),
    ).toThrow(/incompatible/);
  });
});
