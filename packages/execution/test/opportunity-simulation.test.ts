import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertOpportunitySimulationBundle,
  OpportunityLifecycleMachine,
  runOpportunitySimulation,
  type ClobTakerSimulationRequest,
  type OpportunitySimulationPlan,
} from "../src/index.js";

const opportunityId = `ai:${hashCanonical({ proposal: "simulation" })}`;
const policy = {
  routeAfterCertificate: "REQUIRE_HUMAN_APPROVAL" as const,
  notificationChannel: "IN_APP_ONLY" as const,
  liveExecutionEnabled: false as const,
};

function clobRequest(
  venueId: string,
  price: bigint,
  quantity = 1_000n,
): ClobTakerSimulationRequest {
  return {
    model: "CLOB_TAKER_V1",
    venueId,
    instrumentId: `${venueId}:binary-outcome`,
    side: "BUY",
    fillPolicy: "FILL_OR_KILL",
    requestedQuantity: 1_000n,
    quantityScale: 1_000n,
    collateralScale: 1_000n,
    levels: [
      {
        price,
        quantity,
        levelIdentity: hashCanonical({ venueId, price, quantity }),
      },
    ],
    fee: {
      rate: 0n,
      rateScale: 10_000n,
      flat: 0n,
      scheduleHash: hashCanonical({ venueId, fee: 0 }),
    },
    bookStateHash: hashCanonical({ venueId, book: 1 }),
    observedAtEpochMs: 1_785_523_200_000n,
  };
}

function plan(leftPrice = 400n, rightPrice = 450n): OpportunitySimulationPlan {
  return {
    schemaVersion: "pmh.opportunity-simulation-plan.v1",
    opportunityId,
    relationConstraintHash: hashCanonical({ relation: "EQUIVALENT" }),
    semanticDecisionId: hashCanonical({ decision: "research-only" }),
    portfolioId: hashCanonical({ portfolio: "left-true-right-false" }),
    canonicalStates: [
      { stateId: "FF", winningLegIds: ["right-false"] },
      { stateId: "TT", winningLegIds: ["left-true"] },
    ],
    legs: [
      {
        legId: "left-true",
        payoutPerWinningUnit: 1_000n,
        request: clobRequest("venue-a", leftPrice),
      },
      {
        legId: "right-false",
        payoutPerWinningUnit: 1_000n,
        request: clobRequest("venue-b", rightPrice),
      },
    ],
  };
}

function machine(): OpportunityLifecycleMachine {
  const lifecycle = new OpportunityLifecycleMachine(
    opportunityId,
    "AI_RELATION_PROPOSAL",
    hashCanonical({ discovery: true }),
    policy,
    () => 1_785_523_300_000,
  );
  lifecycle.recordSemanticReview(hashCanonical({ accepted: true }), "ACCEPT");
  return lifecycle;
}

describe("complete-payout opportunity simulation", () => {
  it("binds full CLOB walks to a positive simulated floor without certifying", () => {
    const bundle = runOpportunitySimulation(plan());
    expect(bundle).toMatchObject({
      status: "POSITIVE_SIMULATED_FLOOR",
      minimumPayoutCollateral: 1_000n,
      simulatedCostCollateral: 850n,
      floorAfterSimulatedFees: 150n,
      authority: "SIMULATION_ONLY",
      verifierEligible: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(bundle.reports).toHaveLength(2);
    expect(() => assertOpportunitySimulationBundle(bundle)).not.toThrow();
    expect(machine().recordOpportunitySimulation(bundle)).toMatchObject({
      state: "AWAITING_EXACT_CERTIFICATE",
      nextAction: "RUN_EXACT_VERIFIER",
      simulationBundleHash: bundle.artifactHash,
      certificateId: null,
    });
  });

  it("rejects a fully filled portfolio with no positive post-fee floor", () => {
    const bundle = runOpportunitySimulation(plan(600n, 600n));
    expect(bundle).toMatchObject({
      status: "NO_POSITIVE_SIMULATED_FLOOR",
      floorAfterSimulatedFees: -200n,
    });
    expect(machine().recordOpportunitySimulation(bundle)).toMatchObject({
      state: "REJECTED_SIMULATION",
      nextAction: "NONE",
    });
  });

  it("rejects incomplete FOK legs before payoff promotion", () => {
    const incomplete = plan();
    const bundle = runOpportunitySimulation({
      ...incomplete,
      legs: [
        incomplete.legs[0]!,
        {
          ...incomplete.legs[1]!,
          request: clobRequest("venue-b", 450n, 999n),
        },
      ],
    });
    expect(bundle.status).toBe("INCOMPLETE_LEG_SIMULATION");
    expect(machine().recordOpportunitySimulation(bundle).state).toBe(
      "REJECTED_SIMULATION",
    );
  });

  it("stops generic constant-product evidence at venue calibration", () => {
    const base = plan();
    const bundle = runOpportunitySimulation({
      ...base,
      legs: base.legs.map((leg, index) => ({
        ...leg,
        request: {
          model: "CONSTANT_PRODUCT_AMM_V1" as const,
          venueId: `amm-${index}`,
          instrumentId: `amm-${index}:outcome`,
          action: "BUY_EXACT_OUT" as const,
          outcomeQuantity: 1_000n,
          quantityScale: 1_000n,
          collateralScale: 1_000n,
          collateralReserve: 100_000n,
          outcomeReserve: 100_000n,
          fee: {
            rate: 0n,
            rateScale: 10_000n,
            flat: 0n,
            scheduleHash: hashCanonical({ amm: index, fee: 0 }),
          },
          poolStateHash: hashCanonical({ amm: index, pool: 1 }),
          observedAtEpochMs: 1_785_523_200_000n,
        },
      })),
    });
    expect(bundle.status).toBe("MODEL_CALIBRATION_REQUIRED");
    expect(machine().recordOpportunitySimulation(bundle)).toMatchObject({
      state: "AWAITING_MODEL_CALIBRATION",
      nextAction: "CALIBRATE_VENUE_MODEL",
    });
  });

  it("rejects a rehashed bundle whose derived report authority was changed", () => {
    const bundle = runOpportunitySimulation(plan());
    const tampered = {
      ...bundle,
      reports: [{ ...bundle.reports[0]!, authority: "CERTIFICATE" }, bundle.reports[1]!],
    };
    const { artifactHash: _old, ...body } = tampered;
    expect(() =>
      assertOpportunitySimulationBundle({
        ...tampered,
        artifactHash: hashCanonical(body),
      }),
    ).toThrow(/contract/);
  });
});
