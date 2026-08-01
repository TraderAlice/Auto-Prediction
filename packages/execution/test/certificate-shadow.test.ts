import { hashCanonical } from "@pmh/domain";
import {
  verifyArbitrageCandidate,
  type ArbitrageCandidate,
} from "@pmh/opportunity";
import { describe, expect, it } from "vitest";
import {
  assertCertificateBoundShadowRun,
  runCertificateBoundShadow,
  runOpportunitySimulation,
  type ClobTakerSimulationRequest,
  type OpportunitySimulationPlan,
} from "../src/index.js";

const NOW = 1_785_523_200_100n;
const OBSERVED = 1_785_523_200_000n;
const SCALE = 1_000n;

function request(venueId: string, price: bigint): ClobTakerSimulationRequest {
  return {
    model: "CLOB_TAKER_V1",
    venueId,
    instrumentId: `${venueId}:outcome-token`,
    side: "BUY",
    fillPolicy: "FILL_OR_KILL",
    requestedQuantity: SCALE,
    quantityScale: SCALE,
    collateralScale: SCALE,
    levels: [
      {
        price,
        quantity: SCALE,
        levelIdentity: hashCanonical({ venueId, price }),
      },
    ],
    fee: {
      rate: 0n,
      rateScale: SCALE,
      flat: 0n,
      scheduleHash: hashCanonical({ venueId, fee: 0 }),
    },
    bookStateHash: hashCanonical({ venueId, book: 1 }),
    observedAtEpochMs: OBSERVED,
  };
}

function fixture() {
  const opportunityId = "ai:certificate-shadow-fixture";
  const requests = [request("venue-a", 400n), request("venue-b", 450n)];
  const plan: OpportunitySimulationPlan = {
    schemaVersion: "pmh.opportunity-simulation-plan.v1",
    opportunityId,
    relationConstraintHash: hashCanonical({ relation: "equivalent" }),
    semanticDecisionId: hashCanonical({ decision: "accepted" }),
    portfolioId: hashCanonical({ portfolio: "complete" }),
    canonicalStates: [
      { stateId: "FF", winningLegIds: ["right-false"] },
      { stateId: "TT", winningLegIds: ["left-true"] },
    ],
    legs: [
      {
        legId: "left-true",
        payoutPerWinningUnit: SCALE,
        request: requests[0]!,
      },
      {
        legId: "right-false",
        payoutPerWinningUnit: SCALE,
        request: requests[1]!,
      },
    ],
  };
  const bundle = runOpportunitySimulation(plan);
  const ruleA = hashCanonical({ rule: "a" });
  const ruleB = hashCanonical({ rule: "b" });
  const generationA = hashCanonical({ generation: "a" });
  const generationB = hashCanonical({ generation: "b" });
  const candidate: ArbitrageCandidate = {
    classification: "VENUE_BOUNDED_ARBITRAGE",
    claimGraphHash: plan.relationConstraintHash,
    resolutionPartitionHash: hashCanonical(plan.canonicalStates),
    resolutionStateIds: ["FF", "TT"],
    legs: [
      {
        id: "left-true",
        venueId: "venue-a",
        listingId: "listing-a",
        action: "BUY",
        quantity: SCALE,
        maxQuantity: SCALE,
        quantityScale: SCALE,
        quantityTick: 1n,
        unitPrice: 400n,
        priceTick: 1n,
        fee: { flat: 0n, rate: 0n, rateScale: SCALE },
        payoutPerUnitByResolution: { FF: 0n, TT: SCALE },
        listingRuleHash: ruleA,
        feeScheduleHash: requests[0]!.fee.scheduleHash,
        bookGenerationHash: generationA,
        bookStateHash: requests[0]!.bookStateHash,
      },
      {
        id: "right-false",
        venueId: "venue-b",
        listingId: "listing-b",
        action: "BUY",
        quantity: SCALE,
        maxQuantity: SCALE,
        quantityScale: SCALE,
        quantityTick: 1n,
        unitPrice: 450n,
        priceTick: 1n,
        fee: { flat: 0n, rate: 0n, rateScale: SCALE },
        payoutPerUnitByResolution: { FF: SCALE, TT: 0n },
        listingRuleHash: ruleB,
        feeScheduleHash: requests[1]!.fee.scheduleHash,
        bookGenerationHash: generationB,
        bookStateHash: requests[1]!.bookStateHash,
      },
    ],
    venueAssumptions: [
      `SIMULATION_BUNDLE=${bundle.artifactHash}`,
      "VISIBLE_PUBLIC_BOOK_DEPTH_ONLY",
    ],
    expiresAtEpochMs: OBSERVED + 15_000n,
  };
  const certificate = verifyArbitrageCandidate(candidate, {
    nowEpochMs: NOW,
    claimGraphHash: candidate.claimGraphHash,
    resolutionPartitionHash: candidate.resolutionPartitionHash,
    listingRuleHashById: new Map([
      ["listing-a", ruleA],
      ["listing-b", ruleB],
    ]),
    feeScheduleHashByListingId: new Map([
      ["listing-a", requests[0]!.fee.scheduleHash],
      ["listing-b", requests[1]!.fee.scheduleHash],
    ]),
    bookGenerationHashByListingId: new Map([
      ["listing-a", generationA],
      ["listing-b", generationB],
    ]),
    bookStateHashByListingId: new Map([
      ["listing-a", requests[0]!.bookStateHash],
      ["listing-b", requests[1]!.bookStateHash],
    ]),
  });
  return { opportunityId, bundle, certificate };
}

describe("certificate-bound shadow replay", () => {
  it("runs exact certificate intents through the existing shadow engine", () => {
    const { opportunityId, bundle, certificate } = fixture();
    const run = runCertificateBoundShadow({
      opportunityId,
      certificate,
      simulationBundle: bundle,
      nowEpochMs: NOW,
    });

    expect(run).toMatchObject({
      status: "LOCKED",
      gatewayCalls: 0,
      authority: "SHADOW_REPLAY_ONLY",
      projection: { lifecycle: "LOCKED" },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(run.observations).toHaveLength(2);
    expect(run.observations.every((item) => item.status === "FILLED")).toBe(true);
    expect(run.capital.map((item) => item.deployed)).toEqual([400n, 450n]);
    expect(() => assertCertificateBoundShadowRun(run)).not.toThrow();
  });

  it("refuses expired certificates before reserving virtual capital", () => {
    const { opportunityId, bundle, certificate } = fixture();
    expect(() =>
      runCertificateBoundShadow({
        opportunityId,
        certificate,
        simulationBundle: bundle,
        nowEpochMs: certificate.expiresAtEpochMs,
      }),
    ).toThrow(/current positive certificate/);
  });
});
