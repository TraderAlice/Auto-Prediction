import { CapitalLedger, type VenueCapitalProjection } from "@pmh/capital";
import { divideCeil, hashCanonical, type Hash } from "@pmh/domain";
import type { ArbitrageCertificate, CandidateLeg } from "@pmh/opportunity";
import { RiskGovernor } from "@pmh/risk";
import {
  assertOpportunitySimulationBundle,
  type OpportunitySimulationBundle,
} from "./opportunity-simulation.js";
import { ShadowExecutionEngine } from "./shadow-engine.js";
import type {
  ExecutionPlan,
  ExecutionProjection,
  OrderIntent,
} from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type CertificateBoundShadowObservation = Readonly<{
  intentId: string;
  certificateLegId: string;
  venueId: string;
  listingId: string;
  plannedQuantity: bigint;
  observedQuantity: bigint;
  plannedLimitPrice: bigint;
  plannedMaxDebit: bigint;
  observedDebit: bigint;
  debitHeadroom: bigint;
  sourceSimulationReportHash: Hash;
  status: "FILLED";
}>;

export type CertificateBoundShadowRun = Readonly<{
  schemaVersion: "pmh.certificate-bound-shadow-run.v1";
  artifactHash: Hash;
  opportunityId: string;
  certificateId: Hash;
  simulationBundleHash: Hash;
  executionPlan: ExecutionPlan;
  projection: ExecutionProjection;
  observations: readonly CertificateBoundShadowObservation[];
  capital: readonly VenueCapitalProjection[];
  status: "LOCKED";
  gatewayCalls: 0;
  authority: "SHADOW_REPLAY_ONLY";
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function certificateDebit(leg: CandidateLeg): bigint {
  const notional = divideCeil(
    leg.quantity * leg.unitPrice,
    leg.quantityScale,
  );
  return (
    notional +
    leg.fee.flat +
    divideCeil(notional * leg.fee.rate, leg.fee.rateScale)
  );
}

function assertCertificate(certificate: ArbitrageCertificate): void {
  const { id, ...body } = certificate;
  if (
    !HASH_PATTERN.test(id) ||
    id !== hashCanonical(body) ||
    (certificate.classification !== "CERTIFIED_CONTRACT_ARBITRAGE" &&
      certificate.classification !== "VENUE_BOUNDED_ARBITRAGE") ||
    certificate.worstCaseAfterFees <= 0n ||
    certificate.legs.length < 2
  ) {
    throw new Error("certificate-bound shadow input is not an exact arbitrage");
  }
}

function buildExecutionPlan(
  certificate: ArbitrageCertificate,
): ExecutionPlan {
  const intents: OrderIntent[] = certificate.legs.map((leg) => {
    const intentIdentity = hashCanonical({
      certificateId: certificate.id,
      certificateLegId: leg.id,
      kind: "SHADOW_ORDER_INTENT",
    });
    const maxDebit = certificateDebit(leg);
    if (maxDebit <= 0n) {
      throw new Error("zero-debit certificate legs require another shadow model");
    }
    return Object.freeze({
      id: intentIdentity,
      certificateLegId: leg.id,
      venueId: leg.venueId,
      listingId: leg.listingId,
      clientOrderId: `shadow:${intentIdentity.slice(7, 31)}`,
      side: leg.action,
      quantity: leg.quantity,
      quantityScale: leg.quantityScale,
      limitPrice: leg.unitPrice,
      maxDebit,
    });
  });
  const planBody = Object.freeze({
    certificateId: certificate.id,
    intents: Object.freeze(intents),
    dependencies: Object.freeze([]),
    hedgeCheckpoints: Object.freeze(
      intents.map((intent) =>
        Object.freeze({
          afterIntentId: intent.id,
          maxResidualExposure: intents.reduce(
            (total, item) => total + item.maxDebit,
            0n,
          ),
          alternativeIntentIds: Object.freeze(
            intents
              .filter((item) => item.id !== intent.id)
              .map((item) => item.id),
          ),
        }),
      ),
    ),
    abortPolicies: Object.freeze([
      Object.freeze({ trigger: "REJECTED" as const, action: "CANCEL_OPEN" as const }),
      Object.freeze({ trigger: "UNKNOWN" as const, action: "RECONCILE" as const }),
      Object.freeze({ trigger: "TIMEOUT" as const, action: "CANCEL_OPEN" as const }),
      Object.freeze({ trigger: "RISK_KILL" as const, action: "CANCEL_OPEN" as const }),
    ]),
  });
  return Object.freeze({ id: hashCanonical(planBody), ...planBody });
}

export function assertCertificateBoundShadowRun(
  value: unknown,
): CertificateBoundShadowRun {
  if (value === null || typeof value !== "object") {
    throw new Error("certificate-bound shadow run is malformed");
  }
  const run = value as CertificateBoundShadowRun;
  const { artifactHash, ...body } = run;
  if (
    run.schemaVersion !== "pmh.certificate-bound-shadow-run.v1" ||
    !HASH_PATTERN.test(artifactHash) ||
    artifactHash !== hashCanonical(body) ||
    run.opportunityId.trim() === "" ||
    !HASH_PATTERN.test(run.certificateId) ||
    !HASH_PATTERN.test(run.simulationBundleHash) ||
    run.executionPlan.certificateId !== run.certificateId ||
    run.projection.planId !== run.executionPlan.id ||
    run.projection.lifecycle !== "LOCKED" ||
    run.status !== "LOCKED" ||
    run.gatewayCalls !== 0 ||
    !Array.isArray(run.observations) ||
    run.observations.length !== run.executionPlan.intents.length ||
    run.observations.some(
      (observation) =>
        observation.status !== "FILLED" ||
        observation.observedQuantity !== observation.plannedQuantity ||
        observation.observedDebit <= 0n ||
        observation.observedDebit > observation.plannedMaxDebit ||
        observation.debitHeadroom !==
          observation.plannedMaxDebit - observation.observedDebit ||
        !HASH_PATTERN.test(observation.sourceSimulationReportHash),
    ) ||
    run.authority !== "SHADOW_REPLAY_ONLY" ||
    run.effects.externalWrites !== false ||
    run.effects.valueMovingActions !== false ||
    run.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("certificate-bound shadow run violates its contract");
  }
  return run;
}

export function runCertificateBoundShadow(input: {
  opportunityId: string;
  certificate: ArbitrageCertificate;
  simulationBundle: OpportunitySimulationBundle;
  nowEpochMs?: bigint;
}): CertificateBoundShadowRun {
  assertCertificate(input.certificate);
  const bundle = assertOpportunitySimulationBundle(input.simulationBundle);
  const nowEpochMs = input.nowEpochMs ?? BigInt(Date.now());
  if (
    input.opportunityId.trim() === "" ||
    input.opportunityId !== bundle.opportunityId ||
    bundle.status !== "POSITIVE_SIMULATED_FLOOR" ||
    input.certificate.expiresAtEpochMs <= nowEpochMs ||
    !input.certificate.venueAssumptions.includes(
      `SIMULATION_BUNDLE=${bundle.artifactHash}`,
    ) ||
    input.certificate.legs.length !== bundle.reports.length
  ) {
    throw new Error("shadow replay does not bind a current positive certificate");
  }
  const plan = buildExecutionPlan(input.certificate);
  const initialCapitalByVenue = new Map<string, bigint>();
  for (const intent of plan.intents) {
    initialCapitalByVenue.set(
      intent.venueId,
      (initialCapitalByVenue.get(intent.venueId) ?? 0n) + intent.maxDebit,
    );
  }
  const totalCapital = [...initialCapitalByVenue.values()].reduce(
    (total, amount) => total + amount,
    0n,
  );
  const capital = new CapitalLedger(initialCapitalByVenue);
  const risk = new RiskGovernor({
    liveExecutionEnabled: false,
    maxCapitalByVenue: new Map(initialCapitalByVenue),
    maxUnresolvedCapital: totalCapital,
    maxResidualExposure: totalCapital,
    maxCancelLatencyMs: 0n,
    maxHeartbeatAgeMs: 0n,
  });
  const engine = new ShadowExecutionEngine(capital, risk);
  engine.reservePlan(plan, {
    mode: "SHADOW",
    nowEpochMs,
    certificate: input.certificate,
    books: bundle.reports.map((report, index) =>
      Object.freeze({
        instrumentId: input.certificate.legs[index]!.listingId,
        lifecycle: "SNAPSHOT_VALID" as const,
        generation: 1n,
        bids: Object.freeze([]),
        asks: Object.freeze([]),
      }),
    ),
    capital: Object.freeze([]),
    residualExposure: 0n,
    cancelLatencyMs: 0n,
    heartbeatAgeMs: 0n,
    localVenueStateDiverged: false,
  });
  const observations: CertificateBoundShadowObservation[] = [];
  for (const [index, intent] of plan.intents.entries()) {
    const report = bundle.reports[index]!;
    const certificateLeg = input.certificate.legs[index]!;
    if (
      intent.certificateLegId !== certificateLeg.id ||
      report.status !== "FULL" ||
      report.action !== certificateLeg.action ||
      report.venueId !== intent.venueId ||
      report.inputStateHash !== certificateLeg.bookStateHash ||
      report.feeScheduleHash !== certificateLeg.feeScheduleHash ||
      report.filledQuantity !== intent.quantity ||
      report.netCollateral <= 0n ||
      report.netCollateral > intent.maxDebit
    ) {
      throw new Error("shadow observation diverges from its certificate intent");
    }
    engine.submit(plan.id, intent.id);
    engine.acknowledge(
      plan.id,
      intent.id,
      `shadow-order:${intent.id.slice(7, 23)}`,
    );
    engine.fill(
      plan.id,
      intent.id,
      report.filledQuantity,
      report.netCollateral,
    );
    observations.push(
      Object.freeze({
        intentId: intent.id,
        certificateLegId: certificateLeg.id,
        venueId: intent.venueId,
        listingId: intent.listingId,
        plannedQuantity: intent.quantity,
        observedQuantity: report.filledQuantity,
        plannedLimitPrice: intent.limitPrice,
        plannedMaxDebit: intent.maxDebit,
        observedDebit: report.netCollateral,
        debitHeadroom: intent.maxDebit - report.netCollateral,
        sourceSimulationReportHash: report.artifactHash,
        status: "FILLED" as const,
      }),
    );
  }
  const projection = engine.projection(plan.id);
  if (projection.lifecycle !== "LOCKED") {
    throw new Error("certificate-bound shadow replay did not lock every leg");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.certificate-bound-shadow-run.v1" as const,
    opportunityId: input.opportunityId,
    certificateId: input.certificate.id,
    simulationBundleHash: bundle.artifactHash,
    executionPlan: plan,
    projection,
    observations: Object.freeze(observations),
    capital: Object.freeze(capital.projections()),
    status: "LOCKED" as const,
    gatewayCalls: 0 as const,
    authority: "SHADOW_REPLAY_ONLY" as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return assertCertificateBoundShadowRun({
    ...body,
    artifactHash: hashCanonical(body),
  });
}
