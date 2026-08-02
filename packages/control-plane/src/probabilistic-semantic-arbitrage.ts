import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertSemanticConstraintArtifact,
  type SemanticConstraintArtifact,
} from "./semantic-constraint.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/u;
const SIGNED_INTEGER = /^-?(?:0|[1-9]\d*)$/u;
const PROBABILITY_SCALE = 1_000_000n;
const MAX_TAIL_LOSS_PPM = 4_000_000n;
const MAX_FIXED_INPUT = 10n ** 18n;
const MAX_COMMON_PRICE_SCALE = 10n ** 24n;

export const PROBABILITY_ESTIMATION_METHODS = Object.freeze([
  "REFERENCE_CLASS",
  "CAUSAL_MODEL",
  "INDEPENDENT_JUDGMENT",
  "MARKET_IMPLIED_BOUND",
] as const);

export type ProbabilityEstimationMethod =
  (typeof PROBABILITY_ESTIMATION_METHODS)[number];

export type ProbabilityEstimateInput = Readonly<{
  estimator: string;
  method: ProbabilityEstimationMethod;
  lowerPpm: string;
  upperPpm: string;
  evidenceHashes: readonly Hash[];
  assumptions: readonly string[];
  completedAt: string;
  expiresAt: string;
}>;

export type ProbabilityEstimate = ProbabilityEstimateInput & Readonly<{
  estimateIdentity: Hash;
}>;

export type ProbabilisticSemanticBoundArtifact = Readonly<{
  schemaVersion: "pmh.probabilistic-semantic-bound.v1";
  artifactHash: Hash;
  proposalId: Hash;
  semanticConstraintArtifactHash: Hash;
  semanticConstraint: SemanticConstraintArtifact;
  evidenceCorpusSnapshotIdentity: Hash;
  listingRefs: readonly string[];
  adverseStateIds: readonly string[];
  lowerPpm: string;
  epsilonPpm: string;
  aggregateMethod: "CONSERVATIVE_ESTIMATOR_ENVELOPE";
  estimates: readonly ProbabilityEstimate[];
  counterScenarios: readonly string[];
  validFrom: string;
  expiresAt: string;
  calibration: Readonly<{
    status: "UNCALIBRATED" | "CALIBRATED";
    calibrationArtifactHash: Hash | null;
  }>;
  authority: "ESTIMATE_ONLY";
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  hardArbitrageAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ProbabilisticPortfolioQuote = Readonly<{
  listingRef: string;
  outcome: "TRUE" | "FALSE";
  askPriceUnits: string;
  feeUnitsPerContract: string;
  priceScale: string;
  availableQuantityUnits: string;
  requiredQuantityUnits: string;
  quantityScale: string;
  observedAt: string;
  evidenceHash: Hash;
}>;

export type ProbabilisticRiskPolicy = Readonly<{
  maxQuoteAgeMs: number;
  maxTailLossPpm: string;
  concentrationPpm: string;
  maxConcentrationPpm: string;
}>;

type RiskGate = "PASS" | "BLOCKED";

export type ProbabilisticSemanticArbitrageEvaluation = Readonly<{
  schemaVersion: "pmh.probabilistic-semantic-arbitrage.v1";
  artifactHash: Hash;
  classification: "PROBABILISTIC_SEMANTIC_ARBITRAGE" | "SEMANTIC_WATCH";
  boundArtifactHash: Hash;
  bound: ProbabilisticSemanticBoundArtifact;
  evaluatedAt: string;
  quotes: readonly ProbabilisticPortfolioQuote[];
  riskPolicy: ProbabilisticRiskPolicy;
  commonPriceScale: string;
  adverseProbabilityUpperPpm: string;
  statePayoffs: readonly Readonly<{
    stateId: string;
    adverse: boolean;
    payoutUnits: string;
  }>[];
  minimumNonAdversePayoutUnits: string;
  minimumAdversePayoutUnits: string;
  expectedPayoutFloorUnits: string;
  totalAskUnits: string;
  totalFeeUnits: string;
  totalCostUnits: string;
  preFeeExpectedEdgeFloorUnits: string;
  expectedEdgeFloorUnits: string;
  adverseTailLossUnits: string;
  breakEvenEpsilonPpm: string;
  gates: Readonly<{
    probabilityBoundFresh: RiskGate;
    quoteFreshness: RiskGate;
    depth: RiskGate;
    concentration: RiskGate;
    tailLoss: RiskGate;
    positiveExpectedEdgeFloor: RiskGate;
  }>;
  diagnostics: readonly string[];
  calibrationStatus: "UNCALIBRATED" | "CALIBRATED";
  arithmetic: "BIGINT_RATIONAL_FIXED_POINT";
  guaranteedProfit: false;
  verifierEligible: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function boundedTextArray(
  value: unknown,
  minimumItems: number,
  maximumItems: number,
  maximumLength: number,
): value is readonly string[] {
  return Array.isArray(value) && value.length >= minimumItems &&
    value.length <= maximumItems &&
    value.every((item) => boundedText(item, maximumLength));
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function unsigned(value: string, name: string, maximum = MAX_FIXED_INPUT): bigint {
  if (!UNSIGNED_INTEGER.test(value)) throw new Error(`${name} must be an unsigned integer`);
  const parsed = BigInt(value);
  if (parsed > maximum) throw new Error(`${name} exceeds its bounded range`);
  return parsed;
}

function ppm(value: string, name: string): bigint {
  return unsigned(value, name, PROBABILITY_SCALE);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function lcm(left: bigint, right: bigint): bigint {
  return (left / gcd(left, right)) * right;
}

function estimateWithIdentity(input: ProbabilityEstimateInput): ProbabilityEstimate {
  const body = Object.freeze({
    estimator: input.estimator.trim(),
    method: input.method,
    lowerPpm: input.lowerPpm,
    upperPpm: input.upperPpm,
    evidenceHashes: Object.freeze([...new Set(input.evidenceHashes)].sort()),
    assumptions: Object.freeze(input.assumptions.map((item) => item.trim())),
    completedAt: input.completedAt,
    expiresAt: input.expiresAt,
  });
  return Object.freeze({ ...body, estimateIdentity: hashCanonical(body) });
}

function validateEstimate(value: unknown): ProbabilityEstimate {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probability estimate is malformed");
  }
  const estimate = value as ProbabilityEstimate;
  const { estimateIdentity, ...body } = estimate;
  const lower = ppm(estimate.lowerPpm, "probability lower bound");
  const upper = ppm(estimate.upperPpm, "probability upper bound");
  if (
    !HASH_PATTERN.test(String(estimateIdentity)) || estimateIdentity !== hashCanonical(body) ||
    !boundedText(estimate.estimator, 200) ||
    !PROBABILITY_ESTIMATION_METHODS.includes(estimate.method) || lower > upper ||
    !Array.isArray(estimate.evidenceHashes) || estimate.evidenceHashes.length < 1 ||
    estimate.evidenceHashes.length > 20 ||
    estimate.evidenceHashes.some((item) => !HASH_PATTERN.test(String(item))) ||
    new Set(estimate.evidenceHashes).size !== estimate.evidenceHashes.length ||
    [...estimate.evidenceHashes].sort().join("\n") !== estimate.evidenceHashes.join("\n") ||
    !boundedTextArray(estimate.assumptions, 0, 20, 1_000) ||
    !isIso(estimate.completedAt) || !isIso(estimate.expiresAt) ||
    Date.parse(estimate.expiresAt) <= Date.parse(estimate.completedAt)
  ) throw new Error("probability estimate violates its bounded contract");
  return estimate;
}

function expectedEnvelope(estimates: readonly ProbabilityEstimate[]): Readonly<{
  lowerPpm: string;
  epsilonPpm: string;
  validFrom: string;
  expiresAt: string;
}> {
  const lowers = estimates.map((item) => ppm(item.lowerPpm, "probability lower bound"));
  const uppers = estimates.map((item) => ppm(item.upperPpm, "probability upper bound"));
  return Object.freeze({
    lowerPpm: lowers.reduce((minimum, value) => value < minimum ? value : minimum).toString(),
    epsilonPpm: uppers.reduce((maximum, value) => value > maximum ? value : maximum).toString(),
    validFrom: [...estimates].sort((left, right) =>
      Date.parse(right.completedAt) - Date.parse(left.completedAt)
    )[0]!.completedAt,
    expiresAt: [...estimates].sort((left, right) =>
      Date.parse(left.expiresAt) - Date.parse(right.expiresAt)
    )[0]!.expiresAt,
  });
}

function expectedStateIds(listingCount: number): readonly string[] {
  return Object.freeze(Array.from({ length: 2 ** listingCount }, (_, encoded) =>
    Array.from({ length: listingCount }, (_unused, index) =>
      (encoded & (1 << (listingCount - index - 1))) === 0 ? "F" : "T"
    ).join("")
  ));
}

export function buildProbabilisticSemanticBound(input: Readonly<{
  semanticConstraint: SemanticConstraintArtifact;
  adverseStateIds: readonly string[];
  estimates: readonly ProbabilityEstimateInput[];
  counterScenarios: readonly string[];
  calibration?: Readonly<{
    status: "UNCALIBRATED" | "CALIBRATED";
    calibrationArtifactHash: Hash | null;
  }>;
}>): ProbabilisticSemanticBoundArtifact {
  const constraint = assertSemanticConstraintArtifact(input.semanticConstraint);
  if (
    constraint.classification !== "PROBABILISTIC_DEPENDENCE" ||
    constraint.listingRefs.length < 2 || constraint.listingRefs.length > 4 ||
    constraint.truthTable.map((item) => item.stateId).sort().join("\n") !==
      [...expectedStateIds(constraint.listingRefs.length)].sort().join("\n")
  ) throw new Error("probability bound requires a complete 2–4 listing probabilistic constraint");
  const validStateIds = new Set(constraint.truthTable.map((item) => item.stateId));
  const impossibleStateIds = new Set(constraint.truthTable
    .filter((item) => item.disposition === "IMPOSSIBLE")
    .map((item) => item.stateId));
  const adverseStateIds = Object.freeze([...new Set(input.adverseStateIds)].sort());
  if (
    adverseStateIds.length < 1 || adverseStateIds.length > constraint.truthTable.length - 1 ||
    adverseStateIds.length !== input.adverseStateIds.length ||
    adverseStateIds.some((item) => !validStateIds.has(item) || impossibleStateIds.has(item))
  ) throw new Error("probability bound adverse states are missing, duplicated, or already impossible");
  if (!Array.isArray(input.estimates) || input.estimates.length < 2 || input.estimates.length > 8) {
    throw new Error("probability bound requires 2–8 independent estimates");
  }
  const estimates = Object.freeze(input.estimates.map(estimateWithIdentity));
  estimates.forEach(validateEstimate);
  if (
    new Set(estimates.map((item) => item.estimator)).size !== estimates.length ||
    new Set(estimates.map((item) => item.estimateIdentity)).size !== estimates.length ||
    !boundedTextArray(input.counterScenarios, 1, 30, 2_000)
  ) throw new Error("probability bound estimator independence or counter-scenario evidence is incomplete");
  const envelope = expectedEnvelope(estimates);
  const calibration = input.calibration ?? Object.freeze({
    status: "UNCALIBRATED" as const,
    calibrationArtifactHash: null,
  });
  if (
    (calibration.status === "CALIBRATED") !==
      (calibration.calibrationArtifactHash !== null) ||
    (calibration.calibrationArtifactHash !== null &&
      !HASH_PATTERN.test(calibration.calibrationArtifactHash))
  ) throw new Error("probability bound calibration lineage is inconsistent");
  const body = Object.freeze({
    schemaVersion: "pmh.probabilistic-semantic-bound.v1" as const,
    proposalId: constraint.proposalId,
    semanticConstraintArtifactHash: constraint.artifactHash,
    semanticConstraint: constraint,
    evidenceCorpusSnapshotIdentity: constraint.evidenceCorpusSnapshotIdentity,
    listingRefs: Object.freeze([...constraint.listingRefs]),
    adverseStateIds,
    lowerPpm: envelope.lowerPpm,
    epsilonPpm: envelope.epsilonPpm,
    aggregateMethod: "CONSERVATIVE_ESTIMATOR_ENVELOPE" as const,
    estimates,
    counterScenarios: Object.freeze(input.counterScenarios.map((item) => item.trim())),
    validFrom: envelope.validFrom,
    expiresAt: envelope.expiresAt,
    calibration: Object.freeze({ ...calibration }),
    authority: "ESTIMATE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityCertificateAuthority: false as const,
    hardArbitrageAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return assertProbabilisticSemanticBound(Object.freeze({
    ...body,
    artifactHash: hashCanonical(body),
  }));
}

export function assertProbabilisticSemanticBound(
  value: unknown,
): ProbabilisticSemanticBoundArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probabilistic semantic bound is malformed");
  }
  const artifact = value as ProbabilisticSemanticBoundArtifact;
  const { artifactHash, ...body } = artifact;
  const constraint = assertSemanticConstraintArtifact(artifact.semanticConstraint);
  const estimates = artifact.estimates.map(validateEstimate);
  const envelope = expectedEnvelope(estimates);
  const expectedStates = expectedStateIds(artifact.listingRefs.length);
  const actualStates = constraint.truthTable.map((item) => item.stateId).sort();
  if (
    artifact.schemaVersion !== "pmh.probabilistic-semantic-bound.v1" ||
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body) ||
    artifact.proposalId !== constraint.proposalId ||
    artifact.semanticConstraintArtifactHash !== constraint.artifactHash ||
    artifact.evidenceCorpusSnapshotIdentity !== constraint.evidenceCorpusSnapshotIdentity ||
    constraint.classification !== "PROBABILISTIC_DEPENDENCE" ||
    artifact.listingRefs.length < 2 || artifact.listingRefs.length > 4 ||
    artifact.listingRefs.join("\n") !== constraint.listingRefs.join("\n") ||
    actualStates.join("\n") !== [...expectedStates].sort().join("\n") ||
    !Array.isArray(artifact.adverseStateIds) || artifact.adverseStateIds.length < 1 ||
    artifact.adverseStateIds.length >= expectedStates.length ||
    new Set(artifact.adverseStateIds).size !== artifact.adverseStateIds.length ||
    [...artifact.adverseStateIds].sort().join("\n") !== artifact.adverseStateIds.join("\n") ||
    artifact.adverseStateIds.some((item) =>
      !expectedStates.includes(item) ||
      constraint.truthTable.find((state) => state.stateId === item)?.disposition === "IMPOSSIBLE"
    ) ||
    !Array.isArray(artifact.estimates) || artifact.estimates.length < 2 ||
    artifact.estimates.length > 8 ||
    new Set(artifact.estimates.map((item) => item.estimator)).size !== artifact.estimates.length ||
    new Set(artifact.estimates.map((item) => item.estimateIdentity)).size !== estimates.length ||
    artifact.lowerPpm !== envelope.lowerPpm || artifact.epsilonPpm !== envelope.epsilonPpm ||
    artifact.validFrom !== envelope.validFrom || artifact.expiresAt !== envelope.expiresAt ||
    artifact.aggregateMethod !== "CONSERVATIVE_ESTIMATOR_ENVELOPE" ||
    !boundedTextArray(artifact.counterScenarios, 1, 30, 2_000) ||
    (artifact.calibration.status === "CALIBRATED") !==
      (artifact.calibration.calibrationArtifactHash !== null) ||
    (artifact.calibration.calibrationArtifactHash !== null &&
      !HASH_PATTERN.test(String(artifact.calibration.calibrationArtifactHash))) ||
    artifact.authority !== "ESTIMATE_ONLY" ||
    artifact.semanticDecisionAuthority !== false ||
    artifact.probabilityCertificateAuthority !== false ||
    artifact.hardArbitrageAuthority !== false ||
    artifact.executionAuthority !== false ||
    artifact.effects.externalWrites !== false ||
    artifact.effects.valueMovingActions !== false ||
    artifact.effects.liveExecutionEnabled !== false
  ) throw new Error("probabilistic semantic bound violates its evidence or authority contract");
  return artifact;
}

function validatePolicy(policy: ProbabilisticRiskPolicy): void {
  if (
    !Number.isSafeInteger(policy.maxQuoteAgeMs) || policy.maxQuoteAgeMs < 1_000 ||
    policy.maxQuoteAgeMs > 86_400_000
  ) throw new Error("probabilistic risk policy is malformed");
  ppm(policy.concentrationPpm, "portfolio concentration");
  ppm(policy.maxConcentrationPpm, "maximum concentration");
  unsigned(policy.maxTailLossPpm, "maximum tail loss", MAX_TAIL_LOSS_PPM);
}

function compileEvaluationBody(input: Readonly<{
  bound: ProbabilisticSemanticBoundArtifact;
  quotes: readonly ProbabilisticPortfolioQuote[];
  evaluatedAt: string;
  riskPolicy: ProbabilisticRiskPolicy;
}>): Omit<ProbabilisticSemanticArbitrageEvaluation, "artifactHash"> {
  const bound = assertProbabilisticSemanticBound(input.bound);
  validatePolicy(input.riskPolicy);
  if (!isIso(input.evaluatedAt) || input.quotes.length !== bound.listingRefs.length) {
    throw new Error("probabilistic evaluation time or quote binding is incomplete");
  }
  const quoteByRef = new Map(input.quotes.map((quote) => [quote.listingRef, quote] as const));
  if (quoteByRef.size !== bound.listingRefs.length ||
    bound.listingRefs.some((listingRef) => !quoteByRef.has(listingRef))) {
    throw new Error("probabilistic evaluation requires one quote per bound listing");
  }
  const parsed = bound.listingRefs.map((listingRef) => {
    const quote = quoteByRef.get(listingRef)!;
    const priceScale = unsigned(quote.priceScale, "price scale");
    const quantityScale = unsigned(quote.quantityScale, "quantity scale");
    const price = unsigned(quote.askPriceUnits, "ask price");
    const fee = unsigned(quote.feeUnitsPerContract, "fee");
    const available = unsigned(quote.availableQuantityUnits, "available quantity");
    const required = unsigned(quote.requiredQuantityUnits, "required quantity");
    if (
      priceScale === 0n || quantityScale === 0n || required !== quantityScale ||
      price > priceScale || fee > priceScale ||
      !["TRUE", "FALSE"].includes(quote.outcome) ||
      !isIso(quote.observedAt) || Date.parse(quote.observedAt) > Date.parse(input.evaluatedAt) ||
      !HASH_PATTERN.test(String(quote.evidenceHash))
    ) throw new Error("probabilistic evaluation contains a malformed quote");
    return Object.freeze({ quote, priceScale, quantityScale, price, fee, available, required });
  });
  const first = parsed[0]!;
  if (parsed.some((leg) =>
    leg.required * first.quantityScale !== first.required * leg.quantityScale
  )) throw new Error("probabilistic evaluation requires equal normalized leg quantities");
  const commonPriceScale = parsed.reduce((common, leg) => lcm(common, leg.priceScale), 1n);
  if (commonPriceScale > MAX_COMMON_PRICE_SCALE) {
    throw new Error("probabilistic evaluation common price scale is unbounded");
  }
  const totalAsk = parsed.reduce((sum, leg) =>
    sum + leg.price * (commonPriceScale / leg.priceScale), 0n
  );
  const totalFee = parsed.reduce((sum, leg) =>
    sum + leg.fee * (commonPriceScale / leg.priceScale), 0n
  );
  const totalCost = totalAsk + totalFee;
  const adverse = new Set(bound.adverseStateIds);
  const statePayoffs = Object.freeze(bound.semanticConstraint.truthTable
    .map((state) => Object.freeze({
      stateId: state.stateId,
      adverse: adverse.has(state.stateId),
      payoutUnits: parsed.reduce((sum, leg) =>
        sum + (state.truthByListingRef[leg.quote.listingRef] ===
            (leg.quote.outcome === "TRUE")
          ? commonPriceScale
          : 0n), 0n
      ).toString(),
    }))
    .sort((left, right) => left.stateId.localeCompare(right.stateId)));
  const adversePayouts = statePayoffs.filter((state) => state.adverse)
    .map((state) => BigInt(state.payoutUnits));
  const nonAdversePayouts = statePayoffs.filter((state) => !state.adverse)
    .map((state) => BigInt(state.payoutUnits));
  const minimumAdverse = adversePayouts.reduce((minimum, value) =>
    value < minimum ? value : minimum
  );
  const minimumNonAdverse = nonAdversePayouts.reduce((minimum, value) =>
    value < minimum ? value : minimum
  );
  const epsilon = ppm(bound.epsilonPpm, "adverse probability upper bound");
  const downside = minimumNonAdverse > minimumAdverse
    ? minimumNonAdverse - minimumAdverse
    : 0n;
  const expectedPayoutFloor = minimumNonAdverse -
    (downside * epsilon + PROBABILITY_SCALE - 1n) / PROBABILITY_SCALE;
  const preFeeExpectedEdge = expectedPayoutFloor - totalAsk;
  const expectedEdge = expectedPayoutFloor - totalCost;
  const tailLoss = totalCost > minimumAdverse ? totalCost - minimumAdverse : 0n;
  const breakEven = downside === 0n
    ? minimumNonAdverse > totalCost ? PROBABILITY_SCALE : 0n
    : minimumNonAdverse <= totalCost
      ? 0n
      : ((minimumNonAdverse - totalCost) * PROBABILITY_SCALE / downside) > PROBABILITY_SCALE
        ? PROBABILITY_SCALE
        : (minimumNonAdverse - totalCost) * PROBABILITY_SCALE / downside;
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  const boundFresh = evaluatedAtMs >= Date.parse(bound.validFrom) &&
    evaluatedAtMs < Date.parse(bound.expiresAt);
  const quotesFresh = parsed.every((leg) =>
    evaluatedAtMs - Date.parse(leg.quote.observedAt) <= input.riskPolicy.maxQuoteAgeMs
  );
  const enoughDepth = parsed.every((leg) => leg.available >= leg.required);
  const concentrationPass = ppm(input.riskPolicy.concentrationPpm, "portfolio concentration") <=
    ppm(input.riskPolicy.maxConcentrationPpm, "maximum concentration");
  const maxTailLoss = unsigned(
    input.riskPolicy.maxTailLossPpm,
    "maximum tail loss",
    MAX_TAIL_LOSS_PPM,
  ) *
    commonPriceScale / PROBABILITY_SCALE;
  const tailLossPass = tailLoss <= maxTailLoss;
  const positiveEdge = expectedEdge > 0n;
  const gates = Object.freeze({
    probabilityBoundFresh: boundFresh ? "PASS" as const : "BLOCKED" as const,
    quoteFreshness: quotesFresh ? "PASS" as const : "BLOCKED" as const,
    depth: enoughDepth ? "PASS" as const : "BLOCKED" as const,
    concentration: concentrationPass ? "PASS" as const : "BLOCKED" as const,
    tailLoss: tailLossPass ? "PASS" as const : "BLOCKED" as const,
    positiveExpectedEdgeFloor: positiveEdge ? "PASS" as const : "BLOCKED" as const,
  });
  const diagnostics = Object.freeze([
    ...(boundFresh ? [] : ["PROBABILITY_BOUND_STALE"]),
    ...(quotesFresh ? [] : ["QUOTE_STALE"]),
    ...(enoughDepth ? [] : ["DEPTH_INSUFFICIENT"]),
    ...(concentrationPass ? [] : ["CONCENTRATION_LIMIT"]),
    ...(tailLossPass ? [] : ["TAIL_LOSS_LIMIT"]),
    ...(positiveEdge ? [] : ["NO_POSITIVE_EXPECTED_EDGE_FLOOR"]),
  ]);
  const promotable = Object.values(gates).every((gate) => gate === "PASS");
  return Object.freeze({
    schemaVersion: "pmh.probabilistic-semantic-arbitrage.v1" as const,
    classification: promotable
      ? "PROBABILISTIC_SEMANTIC_ARBITRAGE" as const
      : "SEMANTIC_WATCH" as const,
    boundArtifactHash: bound.artifactHash,
    bound,
    evaluatedAt: input.evaluatedAt,
    quotes: Object.freeze([...input.quotes]),
    riskPolicy: Object.freeze({ ...input.riskPolicy }),
    commonPriceScale: commonPriceScale.toString(),
    adverseProbabilityUpperPpm: epsilon.toString(),
    statePayoffs,
    minimumNonAdversePayoutUnits: minimumNonAdverse.toString(),
    minimumAdversePayoutUnits: minimumAdverse.toString(),
    expectedPayoutFloorUnits: expectedPayoutFloor.toString(),
    totalAskUnits: totalAsk.toString(),
    totalFeeUnits: totalFee.toString(),
    totalCostUnits: totalCost.toString(),
    preFeeExpectedEdgeFloorUnits: preFeeExpectedEdge.toString(),
    expectedEdgeFloorUnits: expectedEdge.toString(),
    adverseTailLossUnits: tailLoss.toString(),
    breakEvenEpsilonPpm: breakEven.toString(),
    gates,
    diagnostics,
    calibrationStatus: bound.calibration.status,
    arithmetic: "BIGINT_RATIONAL_FIXED_POINT" as const,
    guaranteedProfit: false as const,
    verifierEligible: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
}

export function compileProbabilisticSemanticArbitrage(input: Readonly<{
  bound: ProbabilisticSemanticBoundArtifact;
  quotes: readonly ProbabilisticPortfolioQuote[];
  evaluatedAt: string;
  riskPolicy: ProbabilisticRiskPolicy;
}>): ProbabilisticSemanticArbitrageEvaluation {
  const body = compileEvaluationBody(input);
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertProbabilisticSemanticArbitrageEvaluation(
  value: unknown,
): ProbabilisticSemanticArbitrageEvaluation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probabilistic semantic arbitrage evaluation is malformed");
  }
  const evaluation = value as ProbabilisticSemanticArbitrageEvaluation;
  const { artifactHash, ...body } = evaluation;
  if (
    !HASH_PATTERN.test(String(artifactHash)) || artifactHash !== hashCanonical(body) ||
    evaluation.schemaVersion !== "pmh.probabilistic-semantic-arbitrage.v1" ||
    !SIGNED_INTEGER.test(evaluation.expectedEdgeFloorUnits) ||
    evaluation.guaranteedProfit !== false || evaluation.verifierEligible !== false ||
    evaluation.certificateAuthority !== false || evaluation.executionAuthority !== false ||
    evaluation.effects.externalWrites !== false ||
    evaluation.effects.valueMovingActions !== false ||
    evaluation.effects.liveExecutionEnabled !== false
  ) throw new Error("probabilistic semantic arbitrage evaluation violates its authority contract");
  const replay = compileEvaluationBody({
    bound: evaluation.bound,
    quotes: evaluation.quotes,
    evaluatedAt: evaluation.evaluatedAt,
    riskPolicy: evaluation.riskPolicy,
  });
  if (hashCanonical(replay) !== hashCanonical(body)) {
    throw new Error("probabilistic semantic arbitrage evaluation does not replay");
  }
  return evaluation;
}
