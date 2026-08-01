import {
  divideCeil,
  hashCanonical,
  type Hash,
} from "@pmh/domain";
import {
  assertOpportunitySimulationBundle,
  type OpportunitySimulationBundle,
} from "@pmh/execution";
import {
  VerificationError,
  verifyArbitrageCandidate,
  type ArbitrageCandidate,
  type ArbitrageCertificate,
  type CandidateLeg,
  type VerificationContext,
} from "@pmh/opportunity";
import {
  assertAnonymousSimulationMaterializationRecord,
  type AnonymousSimulationMaterializationRecord,
} from "./anonymous-simulation-materializer.js";
import {
  assertResearchRelationPayoff,
  type ResearchRelationPayoffQualification,
} from "./relation-payoff.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DEFAULT_MAX_EVIDENCE_AGE_MS = 15_000n;
const MAX_DATE_EPOCH_MS = 8_640_000_000_000_000n;

export type ExactVerificationBinding = Readonly<{
  legId: string;
  listingId: string;
  listingRuleHash: Hash;
  feeScheduleHash: Hash;
  bookGenerationHash: Hash;
  bookStateHash: Hash;
  priceTick: bigint;
  quantityTick: bigint;
}>;

export type ExactOpportunityVerificationRecord = Readonly<{
  schemaVersion: "pmh.exact-opportunity-verification.v1";
  artifactHash: Hash;
  opportunityId: string;
  qualificationHash: Hash;
  materializationId: Hash;
  simulationBundleHash: Hash;
  candidateHash: Hash;
  attemptedAt: string;
  verifiedAtEpochMs: bigint;
  status: "CERTIFIED" | "REJECTED";
  diagnostic: string | null;
  bindings: readonly ExactVerificationBinding[];
  candidate: ArbitrageCandidate;
  certificate: ArbitrageCertificate | null;
  authority: "FIRST_PARTY_EXACT_VERIFIER";
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function minimum(values: readonly bigint[]): bigint {
  const first = values[0];
  if (first === undefined) throw new Error("exact promotion has no values");
  return values.slice(1).reduce(
    (current, value) => (value < current ? value : current),
    first,
  );
}

function roundUpToTick(value: bigint, tick: bigint): bigint {
  if (tick <= 0n) throw new Error("exact promotion price tick is invalid");
  return divideCeil(value, tick) * tick;
}

function verificationContext(
  candidate: ArbitrageCandidate,
  bindings: readonly ExactVerificationBinding[],
  nowEpochMs: bigint,
): VerificationContext {
  return Object.freeze({
    nowEpochMs,
    claimGraphHash: candidate.claimGraphHash,
    resolutionPartitionHash: candidate.resolutionPartitionHash,
    listingRuleHashById: new Map(
      bindings.map((binding) => [
        binding.listingId,
        binding.listingRuleHash,
      ]),
    ),
    feeScheduleHashByListingId: new Map(
      bindings.map((binding) => [
        binding.listingId,
        binding.feeScheduleHash,
      ]),
    ),
    bookGenerationHashByListingId: new Map(
      bindings.map((binding) => [
        binding.listingId,
        binding.bookGenerationHash,
      ]),
    ),
    bookStateHashByListingId: new Map(
      bindings.map((binding) => [
        binding.listingId,
        binding.bookStateHash,
      ]),
    ),
  });
}

function assertBinding(binding: ExactVerificationBinding): void {
  if (
    binding.legId.trim() === "" ||
    binding.listingId.trim() === "" ||
    !HASH_PATTERN.test(binding.listingRuleHash) ||
    !HASH_PATTERN.test(binding.feeScheduleHash) ||
    !HASH_PATTERN.test(binding.bookGenerationHash) ||
    !HASH_PATTERN.test(binding.bookStateHash) ||
    binding.priceTick <= 0n ||
    binding.quantityTick <= 0n
  ) {
    throw new Error("exact verification binding is malformed");
  }
}

function buildCandidate(input: {
  qualification: ResearchRelationPayoffQualification;
  materialization: AnonymousSimulationMaterializationRecord;
  bundle: OpportunitySimulationBundle;
  maxEvidenceAgeMs: bigint;
}): Readonly<{
  candidate: ArbitrageCandidate;
  bindings: readonly ExactVerificationBinding[];
}> {
  const qualification = assertResearchRelationPayoff(input.qualification);
  const materialization = assertAnonymousSimulationMaterializationRecord(
    input.materialization,
  );
  const bundle = assertOpportunitySimulationBundle(input.bundle);
  if (
    qualification.status !== "SIMULATION_TEMPLATE_READY" ||
    materialization.status !== "READY" ||
    bundle.status !== "POSITIVE_SIMULATED_FLOOR" ||
    input.maxEvidenceAgeMs <= 0n ||
    qualification.opportunityId !== bundle.opportunityId ||
    qualification.opportunityId !== materialization.opportunityId ||
    qualification.artifactHash !== bundle.relationConstraintHash ||
    qualification.artifactHash !== materialization.relationConstraintHash ||
    qualification.semanticDecisionId !== bundle.semanticDecisionId ||
    qualification.semanticDecisionId !== materialization.semanticDecisionId ||
    bundle.portfolioId !== materialization.portfolioId
  ) {
    throw new Error(
      "exact promotion requires one positive, materialized, qualification-bound simulation",
    );
  }
  const portfolio = qualification.portfolios.find(
    (item) => item.portfolioId === bundle.portfolioId,
  );
  if (
    portfolio === undefined ||
    portfolio.legs.length !== bundle.plan.legs.length ||
    bundle.reports.length !== bundle.plan.legs.length ||
    materialization.legs.length !== bundle.plan.legs.length
  ) {
    throw new Error("exact promotion portfolio binding is incomplete");
  }
  const canonicalStates = qualification.canonicalStates.map((state) => {
    const winningLegIds = portfolio.legs
      .filter(
        (leg) =>
          state.truthByListingRef[leg.listingRef] ===
          (leg.outcome === "TRUE"),
      )
      .map((leg) => leg.legId)
      .sort();
    return Object.freeze({ stateId: state.stateId, winningLegIds });
  });
  if (
    hashCanonical(canonicalStates) !==
    hashCanonical(
      bundle.plan.canonicalStates.map((state) =>
        Object.freeze({
          stateId: state.stateId,
          winningLegIds: [...state.winningLegIds].sort(),
        }),
      ),
    )
  ) {
    throw new Error("exact promotion resolution partition changed");
  }

  const bindings: ExactVerificationBinding[] = [];
  const candidateLegs: CandidateLeg[] = [];
  for (const [index, simulationLeg] of bundle.plan.legs.entries()) {
    const report = bundle.reports[index]!;
    const portfolioLeg = portfolio.legs.find(
      (leg) => leg.legId === simulationLeg.legId,
    );
    const materializedLeg = materialization.legs.find(
      (leg) => leg.legId === simulationLeg.legId,
    );
    const listing = qualification.listingBindings.find(
      (item) => item.listingRef === portfolioLeg?.listingRef,
    );
    const bookSource = materialization.sources.find(
      (source) => source.sourceId === materializedLeg?.bookSourceId,
    );
    const feeSource = materialization.sources.find(
      (source) => source.sourceId === materializedLeg?.feeSourceId,
    );
    const request = simulationLeg.request;
    if (
      portfolioLeg === undefined ||
      materializedLeg === undefined ||
      listing === undefined ||
      bookSource?.kind !== "BOOK" ||
      feeSource?.kind !== "FEE" ||
      listing.minPriceTick === null ||
      materializedLeg.status !== "READY" ||
      materializedLeg.feeQualification !== "EXACT" ||
      report.status !== "FULL" ||
      report.modelQualification !== "BOOK_EXACT_TAKER_WALK" ||
      request.model !== "CLOB_TAKER_V1" ||
      request.fee.model === "BINARY_PRICE_CURVE_V1" ||
      report.model !== "CLOB_TAKER_V1" ||
      report.venueId !== listing.venueId ||
      report.venueId !== materializedLeg.venueId ||
      report.instrumentId !== materializedLeg.instrumentId ||
      report.instrumentId !== request.instrumentId ||
      report.inputStateHash !== request.bookStateHash ||
      report.feeScheduleHash !== request.fee.scheduleHash ||
      report.filledQuantity !== request.requestedQuantity ||
      report.filledQuantity <= 0n ||
      report.quantityScale !== request.quantityScale ||
      report.collateralScale !== request.collateralScale ||
      BigInt(materialization.requestedQuantity) !== request.requestedQuantity
    ) {
      throw new Error(
        `exact promotion leg ${simulationLeg.legId} is not raw-evidence bound`,
      );
    }
    const priceTick = BigInt(listing.minPriceTick);
    const conservativeAveragePrice = roundUpToTick(
      divideCeil(
        report.grossCollateral * report.quantityScale,
        report.filledQuantity,
      ),
      priceTick,
    );
    const binding = Object.freeze({
      legId: simulationLeg.legId,
      listingId: listing.listingRef,
      listingRuleHash: listing.listingHash,
      feeScheduleHash: report.feeScheduleHash,
      bookGenerationHash: hashCanonical({
        sourceId: bookSource.sourceId,
        rawHash: bookSource.rawHash,
        nativeGeneration: bookSource.nativeGeneration,
        protocolIdentity: bookSource.protocolIdentity,
      }),
      bookStateHash: report.inputStateHash,
      priceTick,
      quantityTick: 1n,
    });
    assertBinding(binding);
    bindings.push(binding);
    candidateLegs.push(
      Object.freeze({
        id: simulationLeg.legId,
        venueId: report.venueId,
        listingId: listing.listingRef,
        action: "BUY" as const,
        quantity: report.filledQuantity,
        maxQuantity: report.filledQuantity,
        quantityScale: report.quantityScale,
        quantityTick: binding.quantityTick,
        unitPrice: conservativeAveragePrice,
        priceTick: binding.priceTick,
        fee: Object.freeze({
          flat: request.fee.flat,
          rate: request.fee.rate,
          rateScale: request.fee.rateScale,
        }),
        payoutPerUnitByResolution: Object.freeze(
          Object.fromEntries(
            bundle.plan.canonicalStates.map((state) => [
              state.stateId,
              state.winningLegIds.includes(simulationLeg.legId)
                ? simulationLeg.payoutPerWinningUnit
                : 0n,
            ]),
          ),
        ),
        listingRuleHash: binding.listingRuleHash,
        feeScheduleHash: binding.feeScheduleHash,
        bookGenerationHash: binding.bookGenerationHash,
        bookStateHash: binding.bookStateHash,
      }),
    );
  }
  if (new Set(bindings.map((binding) => binding.listingId)).size !== bindings.length) {
    throw new Error("exact promotion listing identities must be unique");
  }
  const expiresAtEpochMs = minimum(
    bundle.reports.map(
      (report) => report.observedAtEpochMs + input.maxEvidenceAgeMs,
    ),
  );
  const candidate = Object.freeze({
    classification: "VENUE_BOUNDED_ARBITRAGE" as const,
    claimGraphHash: qualification.artifactHash,
    resolutionPartitionHash: hashCanonical({
      relationConstraintHash: qualification.artifactHash,
      canonicalStates,
    }),
    resolutionStateIds: Object.freeze(
      bundle.plan.canonicalStates.map((state) => state.stateId),
    ),
    legs: Object.freeze(candidateLegs),
    venueAssumptions: Object.freeze([
      `SIMULATION_BUNDLE=${bundle.artifactHash}`,
      `MATERIALIZATION=${materialization.materializationId}`,
      "VISIBLE_PUBLIC_BOOK_DEPTH_ONLY",
      "CAPTURE_IDENTITY_USED_AS_BOOK_GENERATION",
      "LIMIT_PRICE_ROUNDED_UP_FROM_AGGREGATE_GROSS",
      "ONE_AGGREGATE_TAKER_FEE_PER_LEG",
      "NO_LATENCY_OR_ADVERSE_SELECTION",
    ]),
    expiresAtEpochMs,
  });
  return Object.freeze({ candidate, bindings: Object.freeze(bindings) });
}

export function assertExactOpportunityVerificationRecord(
  value: unknown,
): ExactOpportunityVerificationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("exact opportunity verification record is malformed");
  }
  const record = value as ExactOpportunityVerificationRecord;
  const { artifactHash, ...body } = record;
  if (
    record.schemaVersion !== "pmh.exact-opportunity-verification.v1" ||
    !HASH_PATTERN.test(artifactHash) ||
    artifactHash !== hashCanonical(body) ||
    record.opportunityId.trim() === "" ||
    !HASH_PATTERN.test(record.qualificationHash) ||
    !HASH_PATTERN.test(record.materializationId) ||
    !HASH_PATTERN.test(record.simulationBundleHash) ||
    record.candidateHash !== hashCanonical(record.candidate) ||
    record.qualificationHash !== record.candidate.claimGraphHash ||
    !record.candidate.venueAssumptions.includes(
      `SIMULATION_BUNDLE=${record.simulationBundleHash}`,
    ) ||
    !record.candidate.venueAssumptions.includes(
      `MATERIALIZATION=${record.materializationId}`,
    ) ||
    typeof record.verifiedAtEpochMs !== "bigint" ||
    record.verifiedAtEpochMs < 0n ||
    record.verifiedAtEpochMs > MAX_DATE_EPOCH_MS ||
    typeof record.attemptedAt !== "string" ||
    Number.isNaN(Date.parse(record.attemptedAt)) ||
    new Date(record.attemptedAt).toISOString() !== record.attemptedAt ||
    BigInt(Date.parse(record.attemptedAt)) !== record.verifiedAtEpochMs ||
    !Array.isArray(record.bindings) ||
    record.bindings.length !== record.candidate.legs.length ||
    new Set(record.bindings.map((binding) => binding.legId)).size !==
      record.bindings.length ||
    new Set(record.bindings.map((binding) => binding.listingId)).size !==
      record.bindings.length ||
    record.bindings.some((binding, index) => {
      const leg = record.candidate.legs[index];
      return (
        leg === undefined ||
        binding.legId !== leg.id ||
        binding.listingId !== leg.listingId ||
        binding.listingRuleHash !== leg.listingRuleHash ||
        binding.feeScheduleHash !== leg.feeScheduleHash ||
        binding.bookGenerationHash !== leg.bookGenerationHash ||
        binding.bookStateHash !== leg.bookStateHash ||
        binding.priceTick !== leg.priceTick ||
        binding.quantityTick !== leg.quantityTick
      );
    }) ||
    !["CERTIFIED", "REJECTED"].includes(record.status) ||
    (record.status === "CERTIFIED") !== (record.certificate !== null) ||
    (record.status === "CERTIFIED"
      ? record.diagnostic !== null
      : typeof record.diagnostic !== "string" || record.diagnostic === "") ||
    record.authority !== "FIRST_PARTY_EXACT_VERIFIER" ||
    record.executionAuthority !== false ||
    record.effects.externalWrites !== false ||
    record.effects.valueMovingActions !== false ||
    record.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("exact opportunity verification record violates its contract");
  }
  record.bindings.forEach(assertBinding);
  const context = verificationContext(
    record.candidate,
    record.bindings,
    record.verifiedAtEpochMs,
  );
  try {
    const certificate = verifyArbitrageCandidate(record.candidate, context);
    if (
      record.status !== "CERTIFIED" ||
      record.certificate === null ||
      hashCanonical(certificate) !== hashCanonical(record.certificate)
    ) {
      throw new Error("exact verification result does not match its certificate");
    }
  } catch (error) {
    if (
      !(error instanceof VerificationError) ||
      record.status !== "REJECTED" ||
      record.certificate !== null ||
      record.diagnostic !== error.message
    ) {
      throw error;
    }
  }
  return record;
}

export function verifyMaterializedOpportunity(input: {
  qualification: ResearchRelationPayoffQualification;
  materialization: AnonymousSimulationMaterializationRecord;
  bundle: OpportunitySimulationBundle;
  nowEpochMs?: bigint;
  maxEvidenceAgeMs?: bigint;
}): ExactOpportunityVerificationRecord {
  const nowEpochMs = input.nowEpochMs ?? BigInt(Date.now());
  if (nowEpochMs < 0n) throw new Error("exact verifier time is invalid");
  const { candidate, bindings } = buildCandidate({
    qualification: input.qualification,
    materialization: input.materialization,
    bundle: input.bundle,
    maxEvidenceAgeMs:
      input.maxEvidenceAgeMs ?? DEFAULT_MAX_EVIDENCE_AGE_MS,
  });
  let certificate: ArbitrageCertificate | null = null;
  let diagnostic: string | null = null;
  try {
    certificate = verifyArbitrageCandidate(
      candidate,
      verificationContext(candidate, bindings, nowEpochMs),
    );
    if (certificate.worstCaseAfterFees > input.bundle.floorAfterSimulatedFees) {
      throw new Error(
        "exact certificate is less conservative than its simulation bundle",
      );
    }
  } catch (error) {
    if (!(error instanceof VerificationError)) throw error;
    diagnostic = error.message;
  }
  const body = Object.freeze({
    schemaVersion: "pmh.exact-opportunity-verification.v1" as const,
    opportunityId: input.bundle.opportunityId,
    qualificationHash: input.qualification.artifactHash,
    materializationId: input.materialization.materializationId,
    simulationBundleHash: input.bundle.artifactHash,
    candidateHash: hashCanonical(candidate),
    attemptedAt: new Date(Number(nowEpochMs)).toISOString(),
    verifiedAtEpochMs: nowEpochMs,
    status: certificate === null ? ("REJECTED" as const) : ("CERTIFIED" as const),
    diagnostic,
    bindings,
    candidate,
    certificate,
    authority: "FIRST_PARTY_EXACT_VERIFIER" as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return assertExactOpportunityVerificationRecord({
    ...body,
    artifactHash: hashCanonical(body),
  });
}
