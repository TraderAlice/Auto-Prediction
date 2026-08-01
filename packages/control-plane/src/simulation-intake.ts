import type {
  ClobTakerSimulationRequest,
  ConstantProductSimulationRequest,
  ExchangeSimulationRequest,
  OpportunitySimulationPlan,
} from "@pmh/execution";
import type { ResearchRelationPayoffQualification } from "./relation-payoff.js";

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)$/u;

function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  name: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${name} contains unexpected or missing fields`);
  }
}

function text(value: unknown, name: string, maximum = 500): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > maximum) {
    throw new Error(`${name} must be a bounded string`);
  }
  return value.trim();
}

function bigint(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new Error(`${name} must be an unsigned decimal string`);
  }
  return BigInt(value);
}

function fee(value: unknown, name: string) {
  const raw = object(value, name);
  exactKeys(raw, ["rate", "rateScale", "flat", "scheduleHash"], name);
  return Object.freeze({
    rate: bigint(raw.rate, `${name}.rate`),
    rateScale: bigint(raw.rateScale, `${name}.rateScale`),
    flat: bigint(raw.flat, `${name}.flat`),
    scheduleHash: text(raw.scheduleHash, `${name}.scheduleHash`, 80) as `sha256:${string}`,
  });
}

function clobRequest(raw: Record<string, unknown>): ClobTakerSimulationRequest {
  exactKeys(
    raw,
    [
      "model",
      "venueId",
      "instrumentId",
      "side",
      "fillPolicy",
      "requestedQuantity",
      "quantityScale",
      "collateralScale",
      "levels",
      "fee",
      "bookStateHash",
      "observedAtEpochMs",
    ],
    "CLOB simulation request",
  );
  if (
    raw.model !== "CLOB_TAKER_V1" ||
    raw.side !== "BUY" ||
    raw.fillPolicy !== "FILL_OR_KILL" ||
    !Array.isArray(raw.levels) ||
    raw.levels.length === 0 ||
    raw.levels.length > 10_000
  ) {
    throw new Error("CLOB intake requires bounded BUY FOK depth");
  }
  const levels = Object.freeze(
    raw.levels.map((value, index) => {
      const level = object(value, `levels[${index}]`);
      exactKeys(level, ["price", "quantity", "levelIdentity"], `levels[${index}]`);
      return Object.freeze({
        price: bigint(level.price, `levels[${index}].price`),
        quantity: bigint(level.quantity, `levels[${index}].quantity`),
        levelIdentity: text(
          level.levelIdentity,
          `levels[${index}].levelIdentity`,
          80,
        ) as `sha256:${string}`,
      });
    }),
  );
  return Object.freeze({
    model: "CLOB_TAKER_V1",
    venueId: text(raw.venueId, "venueId", 256),
    instrumentId: text(raw.instrumentId, "instrumentId", 500),
    side: "BUY",
    fillPolicy: "FILL_OR_KILL",
    requestedQuantity: bigint(raw.requestedQuantity, "requestedQuantity"),
    quantityScale: bigint(raw.quantityScale, "quantityScale"),
    collateralScale: bigint(raw.collateralScale, "collateralScale"),
    levels,
    fee: fee(raw.fee, "fee"),
    bookStateHash: text(raw.bookStateHash, "bookStateHash", 80) as `sha256:${string}`,
    observedAtEpochMs: bigint(raw.observedAtEpochMs, "observedAtEpochMs"),
  });
}

function ammRequest(
  raw: Record<string, unknown>,
): ConstantProductSimulationRequest {
  exactKeys(
    raw,
    [
      "model",
      "venueId",
      "instrumentId",
      "action",
      "outcomeQuantity",
      "quantityScale",
      "collateralScale",
      "collateralReserve",
      "outcomeReserve",
      "fee",
      "poolStateHash",
      "observedAtEpochMs",
    ],
    "AMM simulation request",
  );
  if (
    raw.model !== "CONSTANT_PRODUCT_AMM_V1" ||
    raw.action !== "BUY_EXACT_OUT"
  ) {
    throw new Error("AMM intake requires BUY_EXACT_OUT");
  }
  return Object.freeze({
    model: "CONSTANT_PRODUCT_AMM_V1",
    venueId: text(raw.venueId, "venueId", 256),
    instrumentId: text(raw.instrumentId, "instrumentId", 500),
    action: "BUY_EXACT_OUT",
    outcomeQuantity: bigint(raw.outcomeQuantity, "outcomeQuantity"),
    quantityScale: bigint(raw.quantityScale, "quantityScale"),
    collateralScale: bigint(raw.collateralScale, "collateralScale"),
    collateralReserve: bigint(raw.collateralReserve, "collateralReserve"),
    outcomeReserve: bigint(raw.outcomeReserve, "outcomeReserve"),
    fee: fee(raw.fee, "fee"),
    poolStateHash: text(raw.poolStateHash, "poolStateHash", 80) as `sha256:${string}`,
    observedAtEpochMs: bigint(raw.observedAtEpochMs, "observedAtEpochMs"),
  });
}

function request(value: unknown): ExchangeSimulationRequest {
  const raw = object(value, "simulation request");
  return raw.model === "CLOB_TAKER_V1"
    ? clobRequest(raw)
    : raw.model === "CONSTANT_PRODUCT_AMM_V1"
      ? ammRequest(raw)
      : (() => {
          throw new Error("simulation model is unsupported");
        })();
}

export function parseOpportunitySimulationIntake(
  value: unknown,
  qualification: ResearchRelationPayoffQualification,
): OpportunitySimulationPlan {
  if (qualification.status !== "SIMULATION_TEMPLATE_READY") {
    throw new Error("the relation has no deterministic simulation template");
  }
  const raw = object(value, "opportunity simulation intake");
  exactKeys(raw, ["opportunityId", "portfolioId", "legs"], "opportunity simulation intake");
  const opportunityId = text(raw.opportunityId, "opportunityId");
  const portfolioId = text(raw.portfolioId, "portfolioId", 80);
  if (
    opportunityId !== qualification.opportunityId ||
    !Array.isArray(raw.legs)
  ) {
    throw new Error("simulation intake does not bind the qualified opportunity");
  }
  const portfolio = qualification.portfolios.find(
    (item) => item.portfolioId === portfolioId,
  );
  if (portfolio === undefined || raw.legs.length !== portfolio.legs.length) {
    throw new Error("simulation intake does not bind a qualified portfolio");
  }
  const requestsByLeg = new Map(
    raw.legs.map((value, index) => {
      const leg = object(value, `legs[${index}]`);
      exactKeys(leg, ["legId", "request"], `legs[${index}]`);
      return [text(leg.legId, `legs[${index}].legId`, 100), request(leg.request)] as const;
    }),
  );
  if (requestsByLeg.size !== portfolio.legs.length) {
    throw new Error("simulation intake leg IDs must be unique");
  }
  const legs = Object.freeze(
    portfolio.legs.map((leg) => {
      const simulationRequest = requestsByLeg.get(leg.legId);
      const expectedVenue = leg.listingRef.split(":", 1)[0];
      if (
        simulationRequest === undefined ||
        simulationRequest.venueId !== expectedVenue
      ) {
        throw new Error("simulation request venue does not bind the payoff leg");
      }
      return Object.freeze({
        legId: leg.legId,
        payoutPerWinningUnit: simulationRequest.collateralScale,
        request: simulationRequest,
      });
    }),
  );
  const canonicalStates = Object.freeze(
    qualification.canonicalStates.map((state) =>
      Object.freeze({
        stateId: state.stateId,
        winningLegIds: Object.freeze(
          portfolio.legs
            .filter(
              (leg) =>
                state.truthByListingRef[leg.listingRef] ===
                (leg.outcome === "TRUE"),
            )
            .map((leg) => leg.legId),
        ),
      }),
    ),
  );
  return Object.freeze({
    schemaVersion: "pmh.opportunity-simulation-plan.v1",
    opportunityId,
    relationConstraintHash: qualification.artifactHash,
    semanticDecisionId: qualification.semanticDecisionId,
    portfolioId: portfolio.portfolioId,
    canonicalStates,
    legs,
  });
}
