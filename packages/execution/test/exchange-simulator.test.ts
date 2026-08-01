import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  simulateClobTaker,
  simulateConstantProductAmm,
  type SimulationFee,
} from "../src/index.js";

const SCALE = 100_000_000n;
const BOOK = hashCanonical({ book: "exact" });
const FEE_SCHEDULE = hashCanonical({ fee: "10-bps" });
const fee: SimulationFee = {
  rate: 10n,
  rateScale: 10_000n,
  flat: 0n,
  scheduleHash: FEE_SCHEDULE,
};

describe("exchange microstructure simulation", () => {
  it("walks CLOB asks with conservative bigint rounding and exact identities", () => {
    const report = simulateClobTaker({
      model: "CLOB_TAKER_V1",
      venueId: "venue:a",
      instrumentId: "btc-up",
      side: "BUY",
      fillPolicy: "FILL_OR_KILL",
      requestedQuantity: 150n * SCALE,
      quantityScale: SCALE,
      collateralScale: SCALE,
      levels: [
        {
          price: 42_000_000n,
          quantity: 100n * SCALE,
          levelIdentity: hashCanonical({ level: 2 }),
        },
        {
          price: 40_000_000n,
          quantity: 100n * SCALE,
          levelIdentity: hashCanonical({ level: 1 }),
        },
      ],
      fee,
      bookStateHash: BOOK,
      observedAtEpochMs: 1_000n,
    });

    expect(report).toMatchObject({
      schemaVersion: "pmh.exchange-simulation.v1",
      model: "CLOB_TAKER_V1",
      status: "FULL",
      action: "BUY",
      filledQuantity: 150n * SCALE,
      residualQuantity: 0n,
      grossCollateral: 61n * SCALE,
      feeCollateral: 6_100_000n,
      netCollateral: 6_106_100_000n,
      averageUnitPrice: 40_666_667n,
      referenceUnitPrice: 40_000_000n,
      adversePriceImpactBps: 167n,
      modelQualification: "BOOK_EXACT_TAKER_WALK",
      authority: "SIMULATION_ONLY",
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(report.fills.map((fill) => fill.price)).toEqual([
      40_000_000n,
      42_000_000n,
    ]);
    const { artifactHash, ...body } = report;
    expect(artifactHash).toBe(hashCanonical(body));
  });

  it("distinguishes IOC partial fills from FOK rejection", () => {
    const base = {
      model: "CLOB_TAKER_V1" as const,
      venueId: "venue:a",
      instrumentId: "thin-market",
      side: "SELL" as const,
      requestedQuantity: 10n * SCALE,
      quantityScale: SCALE,
      collateralScale: SCALE,
      levels: [
        {
          price: 60_000_000n,
          quantity: 4n * SCALE,
          levelIdentity: hashCanonical({ level: "bid" }),
        },
      ],
      fee,
      bookStateHash: BOOK,
      observedAtEpochMs: 1_000n,
    };
    expect(
      simulateClobTaker({ ...base, fillPolicy: "IMMEDIATE_OR_CANCEL" }),
    ).toMatchObject({
      status: "PARTIAL",
      filledQuantity: 4n * SCALE,
      residualQuantity: 6n * SCALE,
      grossCollateral: 240_000_000n,
      feeCollateral: 240_000n,
      netCollateral: 239_760_000n,
    });
    expect(
      simulateClobTaker({ ...base, fillPolicy: "FILL_OR_KILL" }),
    ).toMatchObject({
      status: "REJECTED",
      filledQuantity: 0n,
      residualQuantity: 10n * SCALE,
      grossCollateral: 0n,
      feeCollateral: 0n,
      netCollateral: 0n,
      fills: [],
    });
  });

  it("simulates constant-product buy and sell while preserving x*y >= k", () => {
    const poolStateHash = hashCanonical({ pool: "generic" });
    const buy = simulateConstantProductAmm({
      model: "CONSTANT_PRODUCT_AMM_V1",
      venueId: "myriad-model",
      instrumentId: "outcome:yes",
      action: "BUY_EXACT_OUT",
      outcomeQuantity: 10n * SCALE,
      quantityScale: SCALE,
      collateralScale: SCALE,
      collateralReserve: 100n * SCALE,
      outcomeReserve: 200n * SCALE,
      fee,
      poolStateHash,
      observedAtEpochMs: 1_000n,
    });
    expect(buy).toMatchObject({
      status: "FULL",
      action: "BUY",
      requestedQuantity: 10n * SCALE,
      modelQualification: "GENERIC_CONSTANT_PRODUCT_NOT_VENUE_CALIBRATED",
      authority: "SIMULATION_ONLY",
    });
    expect(buy.netCollateral).toBeGreaterThan(buy.grossCollateral);
    expect(buy.averageUnitPrice).toBeGreaterThan(buy.referenceUnitPrice ?? 0n);
    expect(buy.adversePriceImpactBps).toBeGreaterThan(0n);

    const sell = simulateConstantProductAmm({
      model: "CONSTANT_PRODUCT_AMM_V1",
      venueId: "myriad-model",
      instrumentId: "outcome:yes",
      action: "SELL_EXACT_IN",
      outcomeQuantity: 10n * SCALE,
      quantityScale: SCALE,
      collateralScale: SCALE,
      collateralReserve: 100n * SCALE,
      outcomeReserve: 200n * SCALE,
      fee,
      poolStateHash,
      observedAtEpochMs: 1_000n,
    });
    expect(sell).toMatchObject({ status: "FULL", action: "SELL" });
    expect(sell.netCollateral).toBeLessThan(sell.grossCollateral);
    expect(sell.averageUnitPrice).toBeLessThan(sell.referenceUnitPrice ?? SCALE);
    expect(sell.assumptions).toContain(
      "GENERIC_MODEL_REQUIRES_VENUE_CALIBRATION",
    );
  });

  it("rejects invalid fees, reserves, and uneconomic sells", () => {
    expect(() =>
      simulateConstantProductAmm({
        model: "CONSTANT_PRODUCT_AMM_V1",
        venueId: "venue",
        instrumentId: "outcome",
        action: "BUY_EXACT_OUT",
        outcomeQuantity: 100n,
        quantityScale: 100n,
        collateralScale: 100n,
        collateralReserve: 100n,
        outcomeReserve: 100n,
        fee,
        poolStateHash: BOOK,
        observedAtEpochMs: 0n,
      }),
    ).toThrow(/reserves or quantity/);
    expect(() =>
      simulateClobTaker({
        model: "CLOB_TAKER_V1",
        venueId: "venue",
        instrumentId: "outcome",
        side: "BUY",
        fillPolicy: "FILL_OR_KILL",
        requestedQuantity: 1n,
        quantityScale: 1n,
        collateralScale: 1n,
        levels: [
          { price: 1n, quantity: 1n, levelIdentity: hashCanonical({ l: 1 }) },
        ],
        fee: { ...fee, rate: fee.rateScale },
        bookStateHash: BOOK,
        observedAtEpochMs: 0n,
      }),
    ).toThrow(/fee/);
  });
});
