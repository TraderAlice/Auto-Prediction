import { divideFloor, hashCanonical, type Hash } from "@pmh/domain";
import {
  simulateExchange,
  type ExchangeSimulationEvidence,
  type ExchangeSimulationRequest,
} from "./exchange-simulator.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type OpportunitySimulationPlan = Readonly<{
  schemaVersion: "pmh.opportunity-simulation-plan.v1";
  opportunityId: string;
  relationConstraintHash: Hash;
  semanticDecisionId: Hash;
  portfolioId: Hash;
  canonicalStates: readonly Readonly<{
    stateId: string;
    winningLegIds: readonly string[];
  }>[];
  legs: readonly Readonly<{
    legId: string;
    payoutPerWinningUnit: bigint;
    request: ExchangeSimulationRequest;
  }>[];
}>;

export type OpportunitySimulationBundle = Readonly<{
  schemaVersion: "pmh.opportunity-simulation-bundle.v1";
  artifactHash: Hash;
  planHash: Hash;
  opportunityId: string;
  relationConstraintHash: Hash;
  semanticDecisionId: Hash;
  portfolioId: Hash;
  reports: readonly ExchangeSimulationEvidence[];
  reportHashes: readonly Hash[];
  payoutCollateralByState: Readonly<Record<string, bigint>>;
  minimumPayoutCollateral: bigint;
  simulatedCostCollateral: bigint;
  floorAfterSimulatedFees: bigint;
  status:
    | "POSITIVE_SIMULATED_FLOOR"
    | "NO_POSITIVE_SIMULATED_FLOOR"
    | "INCOMPLETE_LEG_SIMULATION"
    | "MODEL_CALIBRATION_REQUIRED";
  assumptions: readonly [
    "BUY_ONLY_COMPLETE_PAYOUT_PORTFOLIO",
    "PAYOUT_PER_WINNING_UNIT_EXPLICIT",
    "SIMULATION_IS_NOT_A_CERTIFICATE",
  ];
  authority: "SIMULATION_ONLY";
  verifierEligible: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  plan: OpportunitySimulationPlan;
}>;

function assertIdentifier(value: string, name: string): void {
  if (value.trim() === "" || value.length > 500) {
    throw new Error(`${name} is invalid`);
  }
}

function assertHash(value: string, name: string): asserts value is Hash {
  if (!HASH_PATTERN.test(value)) throw new Error(`${name} must be a SHA-256 hash`);
}

function quantityFor(request: ExchangeSimulationRequest): bigint {
  return request.model === "CLOB_TAKER_V1"
    ? request.requestedQuantity
    : request.outcomeQuantity;
}

function assertOpportunitySimulationPlan(
  value: OpportunitySimulationPlan,
): OpportunitySimulationPlan {
  if (
    value.schemaVersion !== "pmh.opportunity-simulation-plan.v1" ||
    !Array.isArray(value.canonicalStates) ||
    !Array.isArray(value.legs) ||
    value.canonicalStates.length < 2 ||
    value.canonicalStates.length > 64 ||
    value.legs.length < 2 ||
    value.legs.length > 20
  ) {
    throw new Error("opportunity simulation plan is malformed or unbounded");
  }
  assertIdentifier(value.opportunityId, "opportunity simulation ID");
  assertHash(value.relationConstraintHash, "relation constraint identity");
  assertHash(value.semanticDecisionId, "semantic decision identity");
  assertHash(value.portfolioId, "payoff portfolio identity");
  const legIds = value.legs.map((leg) => leg.legId);
  const stateIds = value.canonicalStates.map((state) => state.stateId);
  if (
    new Set(legIds).size !== legIds.length ||
    new Set(stateIds).size !== stateIds.length ||
    legIds.some((legId) => legId.trim() === "") ||
    stateIds.some((stateId) => stateId.trim() === "")
  ) {
    throw new Error("opportunity simulation plan identities must be unique");
  }
  const knownLegs = new Set(legIds);
  for (const state of value.canonicalStates) {
    if (
      new Set(state.winningLegIds).size !== state.winningLegIds.length ||
      state.winningLegIds.some((legId: string) => !knownLegs.has(legId))
    ) {
      throw new Error("opportunity simulation state references an unknown leg");
    }
  }
  const first = value.legs[0]!;
  const quantity = quantityFor(first.request);
  if (quantity <= 0n || first.payoutPerWinningUnit <= 0n) {
    throw new Error("opportunity simulation quantity and payout must be positive");
  }
  for (const leg of value.legs) {
    const buyOnly =
      leg.request.model === "CLOB_TAKER_V1"
        ? leg.request.side === "BUY" && leg.request.fillPolicy === "FILL_OR_KILL"
        : leg.request.action === "BUY_EXACT_OUT";
    if (
      leg.payoutPerWinningUnit <= 0n ||
      !buyOnly ||
      quantityFor(leg.request) !== quantity ||
      leg.request.quantityScale !== first.request.quantityScale ||
      leg.request.collateralScale !== first.request.collateralScale
    ) {
      throw new Error(
        "opportunity simulation requires equal-scale, equal-size, buy-only complete-payout legs",
      );
    }
  }
  return value;
}

function buildBundle(planValue: OpportunitySimulationPlan): OpportunitySimulationBundle {
  const plan = assertOpportunitySimulationPlan(planValue);
  const reports = Object.freeze(plan.legs.map((leg) => simulateExchange(leg.request)));
  const reportHashes = Object.freeze(reports.map((report) => report.artifactHash));
  const reportByLeg = new Map(
    plan.legs.map((leg, index) => [leg.legId, reports[index]!] as const),
  );
  const legById = new Map(plan.legs.map((leg) => [leg.legId, leg] as const));
  const payoutCollateralByState = Object.freeze(
    Object.fromEntries(
      plan.canonicalStates.map((state) => [
        state.stateId,
        state.winningLegIds.reduce((total, legId) => {
          const leg = legById.get(legId)!;
          const report = reportByLeg.get(legId)!;
          return (
            total +
            divideFloor(
              report.filledQuantity * leg.payoutPerWinningUnit,
              report.quantityScale,
            )
          );
        }, 0n),
      ]),
    ),
  );
  const payoutValues = Object.values(payoutCollateralByState);
  const minimumPayoutCollateral = payoutValues.reduce((minimum, value) =>
    value < minimum ? value : minimum,
  );
  const simulatedCostCollateral = reports.reduce(
    (total, report) => total + report.netCollateral,
    0n,
  );
  const floorAfterSimulatedFees =
    minimumPayoutCollateral - simulatedCostCollateral;
  const status = reports.some((report) => report.status !== "FULL")
    ? ("INCOMPLETE_LEG_SIMULATION" as const)
    : reports.some(
          (report) =>
            report.modelQualification ===
            "GENERIC_CONSTANT_PRODUCT_NOT_VENUE_CALIBRATED",
        )
      ? ("MODEL_CALIBRATION_REQUIRED" as const)
      : floorAfterSimulatedFees > 0n
        ? ("POSITIVE_SIMULATED_FLOOR" as const)
        : ("NO_POSITIVE_SIMULATED_FLOOR" as const);
  const body = Object.freeze({
    schemaVersion: "pmh.opportunity-simulation-bundle.v1" as const,
    planHash: hashCanonical(plan),
    opportunityId: plan.opportunityId,
    relationConstraintHash: plan.relationConstraintHash,
    semanticDecisionId: plan.semanticDecisionId,
    portfolioId: plan.portfolioId,
    reports,
    reportHashes,
    payoutCollateralByState,
    minimumPayoutCollateral,
    simulatedCostCollateral,
    floorAfterSimulatedFees,
    status,
    assumptions: Object.freeze([
      "BUY_ONLY_COMPLETE_PAYOUT_PORTFOLIO",
      "PAYOUT_PER_WINNING_UNIT_EXPLICIT",
      "SIMULATION_IS_NOT_A_CERTIFICATE",
    ] as const),
    authority: "SIMULATION_ONLY" as const,
    verifierEligible: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
    plan,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function runOpportunitySimulation(
  plan: OpportunitySimulationPlan,
): OpportunitySimulationBundle {
  return buildBundle(plan);
}

export function assertOpportunitySimulationBundle(
  value: unknown,
): OpportunitySimulationBundle {
  if (value === null || typeof value !== "object") {
    throw new Error("opportunity simulation bundle is malformed");
  }
  const bundle = value as OpportunitySimulationBundle;
  const expected = buildBundle(bundle.plan);
  if (
    bundle.schemaVersion !== "pmh.opportunity-simulation-bundle.v1" ||
    !HASH_PATTERN.test(bundle.artifactHash) ||
    bundle.artifactHash !== expected.artifactHash ||
    bundle.authority !== "SIMULATION_ONLY" ||
    bundle.verifierEligible !== false ||
    bundle.certificateAuthority !== false ||
    bundle.executionAuthority !== false ||
    bundle.effects.externalWrites !== false ||
    bundle.effects.valueMovingActions !== false ||
    bundle.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("opportunity simulation bundle violates its contract");
  }
  return bundle;
}
