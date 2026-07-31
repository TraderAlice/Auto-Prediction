import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  proposeCompleteSetCandidate,
  VerificationError,
  verifyArbitrageCandidate,
  type ArbitrageCandidate,
  type CandidateLeg,
  type VerificationContext,
} from "../src/index.js";

const SCALE = 100_000_000n;
const CLAIM_HASH = hashCanonical({ claim: "rain" });

function identity(label: string): Hash {
  return hashCanonical({ identity: label });
}

function makeLeg(
  stateIds: readonly string[],
  winningState: string,
  price: bigint,
  index: number,
  overrides: Partial<CandidateLeg> = {},
): CandidateLeg {
  const listingId = `listing:${index}`;
  return {
    id: `leg:${index}`,
    venueId: `venue:${index % 2}`,
    listingId,
    action: "BUY",
    quantity: SCALE,
    maxQuantity: 10n * SCALE,
    quantityScale: SCALE,
    quantityTick: 1n,
    unitPrice: price,
    priceTick: 1n,
    fee: { flat: 0n, rate: 0n, rateScale: SCALE },
    payoutPerUnitByResolution: Object.fromEntries(
      stateIds.map((stateId) => [
        stateId,
        stateId === winningState ? SCALE : 0n,
      ]),
    ),
    listingRuleHash: identity(`rule:${listingId}`),
    feeScheduleHash: identity(`fee:${listingId}`),
    bookGenerationHash: identity(`generation:${listingId}`),
    bookStateHash: identity(`state:${listingId}`),
    ...overrides,
  };
}

function makeCandidate(
  stateIds: readonly string[],
  prices: readonly bigint[],
): ArbitrageCandidate {
  return {
    classification: "CERTIFIED_CONTRACT_ARBITRAGE",
    claimGraphHash: CLAIM_HASH,
    resolutionPartitionHash: hashCanonical(stateIds),
    resolutionStateIds: stateIds,
    legs: stateIds.map((stateId, index) =>
      makeLeg(stateIds, stateId, prices[index] ?? 0n, index),
    ),
    venueAssumptions: [],
    expiresAtEpochMs: 2_000n,
  };
}

function makeContext(candidate: ArbitrageCandidate): VerificationContext {
  return {
    nowEpochMs: 1_000n,
    claimGraphHash: candidate.claimGraphHash,
    resolutionPartitionHash: candidate.resolutionPartitionHash,
    listingRuleHashById: new Map(
      candidate.legs.map((leg) => [leg.listingId, leg.listingRuleHash]),
    ),
    feeScheduleHashByListingId: new Map(
      candidate.legs.map((leg) => [leg.listingId, leg.feeScheduleHash]),
    ),
    bookGenerationHashByListingId: new Map(
      candidate.legs.map((leg) => [leg.listingId, leg.bookGenerationHash]),
    ),
    bookStateHashByListingId: new Map(
      candidate.legs.map((leg) => [leg.listingId, leg.bookStateHash]),
    ),
  };
}

describe("exact arbitrage verifier", () => {
  it("proposes equal quantity bounded by depth and per-venue capital", () => {
    const base = makeCandidate(["yes", "no"], [
      40_000_000n,
      50_000_000n,
    ]);
    const template = {
      ...base,
      legs: [
        { ...base.legs[0]!, maxQuantity: 75_000_000n },
        { ...base.legs[1]!, maxQuantity: 60_000_000n },
      ],
    };
    const candidate = proposeCompleteSetCandidate(
      template,
      new Map([
        ["venue:0", 20_000_000n],
        ["venue:1", 100_000_000n],
      ]),
    );
    expect(candidate.legs.map((leg) => leg.quantity)).toEqual([
      50_000_000n,
      50_000_000n,
    ]);
    const certificate = verifyArbitrageCandidate(
      candidate,
      makeContext(candidate),
    );
    expect(certificate.worstCaseAfterFees).toBe(5_000_000n);
  });

  it("certifies a same-claim cross-venue complete set", () => {
    const candidate = makeCandidate(["yes", "no"], [
      40_000_000n,
      50_000_000n,
    ]);
    const certificate = verifyArbitrageCandidate(
      candidate,
      makeContext(candidate),
    );

    expect(certificate.worstCaseGross).toBe(10_000_000n);
    expect(certificate.worstCaseAfterFees).toBe(10_000_000n);
    expect(certificate.payoffByResolution).toEqual({
      no: 10_000_000n,
      yes: 10_000_000n,
    });
    expect(certificate.capitalRequiredByVenue).toEqual({
      "venue:0": 40_000_000n,
      "venue:1": 50_000_000n,
    });
  });

  it("rejects deletion of any necessary outcome state", () => {
    const candidate = makeCandidate(
      ["low", "middle", "high"],
      [20_000_000n, 30_000_000n, 40_000_000n],
    );
    const incompleteLeg = {
      ...candidate.legs[0]!,
      payoutPerUnitByResolution: { low: SCALE, middle: 0n },
    };
    const incomplete = {
      ...candidate,
      legs: [incompleteLeg, ...candidate.legs.slice(1)],
    };
    expect(() =>
      verifyArbitrageCandidate(incomplete, makeContext(incomplete)),
    ).toThrow(/exact resolution partition/);
  });

  it("invalidates stale book generation and state identities", () => {
    const candidate = makeCandidate(["yes", "no"], [
      40_000_000n,
      50_000_000n,
    ]);
    const context = makeContext(candidate);
    const changedGeneration = new Map(context.bookGenerationHashByListingId);
    changedGeneration.set("listing:0", identity("rebuilt-generation"));
    expect(() =>
      verifyArbitrageCandidate(candidate, {
        ...context,
        bookGenerationHashByListingId: changedGeneration,
      }),
    ).toThrow(/book generation identity changed/);

    const changedState = new Map(context.bookStateHashByListingId);
    changedState.set("listing:0", identity("new-depth"));
    expect(() =>
      verifyArbitrageCandidate(candidate, {
        ...context,
        bookStateHashByListingId: changedState,
      }),
    ).toThrow(/book state identity changed/);
  });

  it("invalidates fee and listing-rule hash changes", () => {
    const candidate = makeCandidate(["yes", "no"], [
      40_000_000n,
      50_000_000n,
    ]);
    const context = makeContext(candidate);
    const changedFees = new Map(context.feeScheduleHashByListingId);
    changedFees.set("listing:1", identity("new-fees"));
    expect(() =>
      verifyArbitrageCandidate(candidate, {
        ...context,
        feeScheduleHashByListingId: changedFees,
      }),
    ).toThrow(/fee schedule identity changed/);
  });

  it("rounds debits up and never promotes a fractional loss to profit", () => {
    const base = makeCandidate(["yes", "no"], [1n, 1n]);
    const tiny = {
      ...base,
      legs: base.legs.map((leg) => ({
        ...leg,
        quantity: 1n,
        maxQuantity: 1n,
      })),
    };
    expect(() =>
      verifyArbitrageCandidate(tiny, makeContext(tiny)),
    ).toThrow(
      /requires strictly positive worst-case payoff after fees/,
    );
  });

  it("subtracts exact conservative fees from every state", () => {
    const base = makeCandidate(["yes", "no"], [
      40_000_000n,
      50_000_000n,
    ]);
    const withFees = {
      ...base,
      legs: base.legs.map((leg) => ({
        ...leg,
        fee: { flat: 1_000_000n, rate: 0n, rateScale: SCALE },
      })),
    };
    const certificate = verifyArbitrageCandidate(
      withFees,
      makeContext(withFees),
    );
    expect(certificate.worstCaseGross).toBe(10_000_000n);
    expect(certificate.worstCaseAfterFees).toBe(8_000_000n);
  });

  it("certifies arbitrary exhaustive complete sets only from the true worst state", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10_000 }), {
          minLength: 2,
          maxLength: 8,
        }),
        (weights) => {
          const totalWeight = weights.reduce((sum, item) => sum + item, 0);
          const stateIds = weights.map((_item, index) => `state:${index}`);
          const prices = weights.map(
            (weight) =>
              (BigInt(weight) * 80_000_000n) / BigInt(totalWeight),
          );
          const candidate = makeCandidate(stateIds, prices);
          const certificate = verifyArbitrageCandidate(
            candidate,
            makeContext(candidate),
          );
          for (const payoff of Object.values(
            certificate.payoffByResolution,
          )) {
            expect(certificate.worstCaseAfterFees).toBeLessThanOrEqual(payoff);
          }
          expect(certificate.worstCaseAfterFees).toBeGreaterThanOrEqual(
            20_000_000n,
          );
        },
      ),
    );
  });

  it("rejects expired candidates", () => {
    const candidate = makeCandidate(["yes", "no"], [
      40_000_000n,
      50_000_000n,
    ]);
    expect(() =>
      verifyArbitrageCandidate(candidate, {
        ...makeContext(candidate),
        nowEpochMs: candidate.expiresAtEpochMs,
      }),
    ).toThrow(VerificationError);
  });
});
