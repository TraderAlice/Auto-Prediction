import {
  divideCeil,
  divideFloor,
  hashCanonical,
  type Hash,
} from "@pmh/domain";

export type CollateralRateSimulationFee = Readonly<{
  model?: "COLLATERAL_RATE_V1";
  rate: bigint;
  rateScale: bigint;
  flat: bigint;
  scheduleHash: Hash;
}>;

export type BinaryPriceCurveSimulationFee = Readonly<{
  model: "BINARY_PRICE_CURVE_V1";
  rate: bigint;
  rateScale: bigint;
  exponent: 1;
  roundingQuantum: bigint;
  scheduleHash: Hash;
}>;

export type SimulationFee =
  | CollateralRateSimulationFee
  | BinaryPriceCurveSimulationFee;

export type ClobLevel = Readonly<{
  price: bigint;
  quantity: bigint;
  levelIdentity: Hash;
}>;

export type ClobTakerSimulationRequest = Readonly<{
  model: "CLOB_TAKER_V1";
  venueId: string;
  instrumentId: string;
  side: "BUY" | "SELL";
  fillPolicy: "FILL_OR_KILL" | "IMMEDIATE_OR_CANCEL";
  requestedQuantity: bigint;
  quantityScale: bigint;
  collateralScale: bigint;
  levels: readonly ClobLevel[];
  fee: SimulationFee;
  bookStateHash: Hash;
  observedAtEpochMs: bigint;
}>;

export type ConstantProductSimulationRequest = Readonly<{
  model: "CONSTANT_PRODUCT_AMM_V1";
  venueId: string;
  instrumentId: string;
  action: "BUY_EXACT_OUT" | "SELL_EXACT_IN";
  outcomeQuantity: bigint;
  quantityScale: bigint;
  collateralScale: bigint;
  collateralReserve: bigint;
  outcomeReserve: bigint;
  fee: SimulationFee;
  poolStateHash: Hash;
  observedAtEpochMs: bigint;
}>;

export type ExchangeSimulationRequest =
  | ClobTakerSimulationRequest
  | ConstantProductSimulationRequest;

export type SimulationFill = Readonly<{
  levelIdentity: Hash;
  price: bigint;
  quantity: bigint;
  collateral: bigint;
}>;

export type ExchangeSimulationEvidence = Readonly<{
  schemaVersion: "pmh.exchange-simulation.v1";
  artifactHash: Hash;
  model: ExchangeSimulationRequest["model"];
  venueId: string;
  instrumentId: string;
  action: "BUY" | "SELL";
  status: "FULL" | "PARTIAL" | "REJECTED";
  requestedQuantity: bigint;
  filledQuantity: bigint;
  residualQuantity: bigint;
  quantityScale: bigint;
  collateralScale: bigint;
  grossCollateral: bigint;
  feeCollateral: bigint;
  netCollateral: bigint;
  averageUnitPrice: bigint | null;
  referenceUnitPrice: bigint | null;
  adversePriceImpactBps: bigint | null;
  fills: readonly SimulationFill[];
  inputStateHash: Hash;
  feeScheduleHash: Hash;
  observedAtEpochMs: bigint;
  modelQualification:
    | "BOOK_EXACT_TAKER_WALK"
    | "BOOK_PRICE_CURVE_AGGREGATE_LEVELS_REQUIRES_MATCH_CALIBRATION"
    | "GENERIC_CONSTANT_PRODUCT_NOT_VENUE_CALIBRATED";
  assumptions: readonly string[];
  authority: "SIMULATION_ONLY";
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function assertHash(value: string, name: string): asserts value is Hash {
  if (!HASH_PATTERN.test(value)) throw new Error(`${name} must be a SHA-256 hash`);
}

function assertFee(fee: SimulationFee): void {
  const commonInvalid =
    fee.rate < 0n || fee.rateScale <= 0n || fee.rate >= fee.rateScale;
  const modelInvalid =
    fee.model === "BINARY_PRICE_CURVE_V1"
      ? fee.exponent !== 1 || fee.roundingQuantum <= 0n
      : fee.flat < 0n;
  if (commonInvalid || modelInvalid) {
    throw new Error("simulation fee must be non-negative and below its scale");
  }
  assertHash(fee.scheduleHash, "fee schedule identity");
}

function commonValidation(input: ExchangeSimulationRequest): void {
  if (
    input.venueId.trim() === "" ||
    input.instrumentId.trim() === "" ||
    input.quantityScale <= 0n ||
    input.collateralScale <= 0n ||
    input.observedAtEpochMs < 0n
  ) {
    throw new Error("exchange simulation request has invalid identities or scales");
  }
  assertFee(input.fee);
}

function feeOnCollateral(collateral: bigint, fee: SimulationFee): bigint {
  if (fee.model === "BINARY_PRICE_CURVE_V1") {
    throw new Error("binary price-curve fees require fill price and quantity");
  }
  return divideCeil(collateral * fee.rate, fee.rateScale) + fee.flat;
}

function feeOnBinaryPriceCurveFill(
  fill: SimulationFill,
  input: ClobTakerSimulationRequest,
  fee: BinaryPriceCurveSimulationFee,
): bigint {
  if (fill.price < 0n || fill.price > input.collateralScale) {
    throw new Error("binary price-curve fee requires price inside [0, 1]");
  }
  const complement = input.collateralScale - fill.price;
  const numerator =
    fill.quantity *
    fee.rate *
    fill.price *
    complement *
    input.collateralScale;
  const denominator =
    input.quantityScale *
    fee.rateScale *
    input.collateralScale *
    input.collateralScale *
    fee.roundingQuantum;
  return divideCeil(numerator, denominator) * fee.roundingQuantum;
}

function feeOnClobFills(
  fills: readonly SimulationFill[],
  grossCollateral: bigint,
  input: ClobTakerSimulationRequest,
): bigint {
  if (input.fee.model !== "BINARY_PRICE_CURVE_V1") {
    return feeOnCollateral(grossCollateral, input.fee);
  }
  const curveFee = input.fee;
  return fills.reduce(
    (total, fill) =>
      total + feeOnBinaryPriceCurveFill(fill, input, curveFee),
    0n,
  );
}

function averagePrice(
  collateral: bigint,
  quantity: bigint,
  quantityScale: bigint,
  round: "UP" | "DOWN",
): bigint {
  return round === "UP"
    ? divideCeil(collateral * quantityScale, quantity)
    : divideFloor(collateral * quantityScale, quantity);
}

function adverseImpactBps(
  action: "BUY" | "SELL",
  average: bigint,
  reference: bigint,
): bigint {
  if (reference <= 0n) return 0n;
  const adverse =
    action === "BUY"
      ? average > reference
        ? average - reference
        : 0n
      : reference > average
        ? reference - average
        : 0n;
  return divideCeil(adverse * 10_000n, reference);
}

function finalize(
  body: Omit<ExchangeSimulationEvidence, "artifactHash">,
): ExchangeSimulationEvidence {
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function simulateClobTaker(
  input: ClobTakerSimulationRequest,
): ExchangeSimulationEvidence {
  commonValidation(input);
  if (
    input.requestedQuantity <= 0n ||
    input.levels.length === 0 ||
    input.levels.length > 10_000
  ) {
    throw new Error("CLOB simulation requires bounded positive depth and quantity");
  }
  assertHash(input.bookStateHash, "book state identity");
  if (
    input.levels.some((level) => {
      assertHash(level.levelIdentity, "book level identity");
      return level.price < 0n || level.quantity <= 0n;
    })
  ) {
    throw new Error("CLOB simulation level is invalid");
  }
  const sorted = [...input.levels].sort((left, right) => {
    if (left.price === right.price) {
      return left.levelIdentity.localeCompare(right.levelIdentity);
    }
    if (input.side === "BUY") return left.price < right.price ? -1 : 1;
    return left.price > right.price ? -1 : 1;
  });
  const available = sorted.reduce((total, level) => total + level.quantity, 0n);
  const canFullyFill = available >= input.requestedQuantity;
  const target =
    input.fillPolicy === "FILL_OR_KILL" && !canFullyFill
      ? 0n
      : available < input.requestedQuantity
        ? available
        : input.requestedQuantity;
  let remaining = target;
  let grossCollateral = 0n;
  const fills: SimulationFill[] = [];
  for (const level of sorted) {
    if (remaining === 0n) break;
    const quantity = remaining < level.quantity ? remaining : level.quantity;
    const collateral =
      input.side === "BUY"
        ? divideCeil(quantity * level.price, input.quantityScale)
        : divideFloor(quantity * level.price, input.quantityScale);
    fills.push(
      Object.freeze({
        levelIdentity: level.levelIdentity,
        price: level.price,
        quantity,
        collateral,
      }),
    );
    grossCollateral += collateral;
    remaining -= quantity;
  }
  const filledQuantity = target - remaining;
  const feeCollateral =
    filledQuantity === 0n
      ? 0n
      : feeOnClobFills(fills, grossCollateral, input);
  if (input.side === "SELL" && feeCollateral > grossCollateral) {
    throw new Error("CLOB sell fee exceeds simulated proceeds");
  }
  const netCollateral =
    input.side === "BUY"
      ? grossCollateral + feeCollateral
      : grossCollateral - feeCollateral;
  const averageUnitPrice =
    filledQuantity === 0n
      ? null
      : averagePrice(
          grossCollateral,
          filledQuantity,
          input.quantityScale,
          input.side === "BUY" ? "UP" : "DOWN",
        );
  const referenceUnitPrice =
    filledQuantity === 0n ? null : sorted[0]?.price ?? null;
  const status =
    filledQuantity === 0n
      ? "REJECTED"
      : filledQuantity === input.requestedQuantity
        ? "FULL"
        : "PARTIAL";
  return finalize({
    schemaVersion: "pmh.exchange-simulation.v1",
    model: input.model,
    venueId: input.venueId,
    instrumentId: input.instrumentId,
    action: input.side,
    status,
    requestedQuantity: input.requestedQuantity,
    filledQuantity,
    residualQuantity: input.requestedQuantity - filledQuantity,
    quantityScale: input.quantityScale,
    collateralScale: input.collateralScale,
    grossCollateral,
    feeCollateral,
    netCollateral,
    averageUnitPrice,
    referenceUnitPrice,
    adversePriceImpactBps:
      averageUnitPrice === null || referenceUnitPrice === null
        ? null
        : adverseImpactBps(input.side, averageUnitPrice, referenceUnitPrice),
    fills: Object.freeze(fills),
    inputStateHash: input.bookStateHash,
    feeScheduleHash: input.fee.scheduleHash,
    observedAtEpochMs: input.observedAtEpochMs,
    modelQualification:
      input.fee.model === "BINARY_PRICE_CURVE_V1"
        ? "BOOK_PRICE_CURVE_AGGREGATE_LEVELS_REQUIRES_MATCH_CALIBRATION"
        : "BOOK_EXACT_TAKER_WALK",
    assumptions: Object.freeze([
      "VISIBLE_LEVELS_ONLY",
      "TAKER_ONLY",
      "NO_QUEUE_POSITION",
      "NO_LATENCY_OR_ADVERSE_SELECTION",
      ...(input.fee.model === "BINARY_PRICE_CURVE_V1"
        ? [
            "BINARY_FEE_CURVE_PER_AGGREGATED_PRICE_LEVEL",
            "FEE_ROUNDED_UP_TO_VENUE_QUANTUM",
            "UNDERLYING_MATCH_COUNT_UNAVAILABLE",
          ]
        : []),
    ]),
    authority: "SIMULATION_ONLY",
    effects: Object.freeze({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    }),
  });
}

export function simulateConstantProductAmm(
  input: ConstantProductSimulationRequest,
): ExchangeSimulationEvidence {
  commonValidation(input);
  if (input.fee.model === "BINARY_PRICE_CURVE_V1") {
    throw new Error("binary price-curve fees are not calibrated for AMM simulation");
  }
  assertHash(input.poolStateHash, "pool state identity");
  if (
    input.outcomeQuantity <= 0n ||
    input.collateralReserve <= 0n ||
    input.outcomeReserve <= 0n ||
    (input.action === "BUY_EXACT_OUT" &&
      input.outcomeQuantity >= input.outcomeReserve)
  ) {
    throw new Error("constant-product simulation reserves or quantity are invalid");
  }
  const invariant = input.collateralReserve * input.outcomeReserve;
  const action = input.action === "BUY_EXACT_OUT" ? "BUY" : "SELL";
  let grossCollateral: bigint;
  let feeCollateral: bigint;
  let netCollateral: bigint;
  let postCollateralReserve: bigint;
  let postOutcomeReserve: bigint;
  if (input.action === "BUY_EXACT_OUT") {
    postOutcomeReserve = input.outcomeReserve - input.outcomeQuantity;
    const netToPool =
      divideCeil(invariant, postOutcomeReserve) - input.collateralReserve;
    const grossBeforeFlat = divideCeil(
      netToPool * input.fee.rateScale,
      input.fee.rateScale - input.fee.rate,
    );
    feeCollateral = grossBeforeFlat - netToPool + input.fee.flat;
    grossCollateral = netToPool;
    netCollateral = grossCollateral + feeCollateral;
    postCollateralReserve = input.collateralReserve + netToPool;
  } else {
    postOutcomeReserve = input.outcomeReserve + input.outcomeQuantity;
    postCollateralReserve = divideCeil(invariant, postOutcomeReserve);
    grossCollateral = input.collateralReserve - postCollateralReserve;
    feeCollateral = feeOnCollateral(grossCollateral, input.fee);
    if (grossCollateral <= 0n || feeCollateral >= grossCollateral) {
      throw new Error("constant-product sell produces no positive net collateral");
    }
    netCollateral = grossCollateral - feeCollateral;
  }
  if (postCollateralReserve * postOutcomeReserve < invariant) {
    throw new Error("constant-product rounding violated the invariant");
  }
  const averageUnitPrice = averagePrice(
    input.action === "BUY_EXACT_OUT" ? netCollateral : netCollateral,
    input.outcomeQuantity,
    input.quantityScale,
    input.action === "BUY_EXACT_OUT" ? "UP" : "DOWN",
  );
  const referenceUnitPrice =
    action === "BUY"
      ? divideCeil(
          input.collateralReserve * input.quantityScale,
          input.outcomeReserve,
        )
      : divideFloor(
          input.collateralReserve * input.quantityScale,
          input.outcomeReserve,
        );
  const syntheticLevel = hashCanonical({
    model: input.model,
    poolStateHash: input.poolStateHash,
    pre: {
      collateralReserve: input.collateralReserve,
      outcomeReserve: input.outcomeReserve,
    },
    post: { collateralReserve: postCollateralReserve, outcomeReserve: postOutcomeReserve },
  });
  return finalize({
    schemaVersion: "pmh.exchange-simulation.v1",
    model: input.model,
    venueId: input.venueId,
    instrumentId: input.instrumentId,
    action,
    status: "FULL",
    requestedQuantity: input.outcomeQuantity,
    filledQuantity: input.outcomeQuantity,
    residualQuantity: 0n,
    quantityScale: input.quantityScale,
    collateralScale: input.collateralScale,
    grossCollateral,
    feeCollateral,
    netCollateral,
    averageUnitPrice,
    referenceUnitPrice,
    adversePriceImpactBps: adverseImpactBps(
      action,
      averageUnitPrice,
      referenceUnitPrice,
    ),
    fills: Object.freeze([
      Object.freeze({
        levelIdentity: syntheticLevel,
        price: averageUnitPrice,
        quantity: input.outcomeQuantity,
        collateral: netCollateral,
      }),
    ]),
    inputStateHash: input.poolStateHash,
    feeScheduleHash: input.fee.scheduleHash,
    observedAtEpochMs: input.observedAtEpochMs,
    modelQualification: "GENERIC_CONSTANT_PRODUCT_NOT_VENUE_CALIBRATED",
    assumptions: Object.freeze([
      "CONSTANT_PRODUCT_XY_K",
      "ATOMIC_SINGLE_POOL_TRADE",
      "NO_GAS_OR_NETWORK_LATENCY",
      "GENERIC_MODEL_REQUIRES_VENUE_CALIBRATION",
    ]),
    authority: "SIMULATION_ONLY",
    effects: Object.freeze({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    }),
  });
}

export function simulateExchange(
  request: ExchangeSimulationRequest,
): ExchangeSimulationEvidence {
  return request.model === "CLOB_TAKER_V1"
    ? simulateClobTaker(request)
    : simulateConstantProductAmm(request);
}
