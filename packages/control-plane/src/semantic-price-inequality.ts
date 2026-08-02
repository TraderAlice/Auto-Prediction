import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertResearchRelationPayoff,
  type ResearchRelationPayoffQualification,
} from "./relation-payoff.js";

const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/u;

export type SemanticPortfolioQuote = Readonly<{
  listingRef: string;
  outcome: "TRUE" | "FALSE";
  askPriceUnits: string;
  feeUnitsPerContract: string;
  priceScale: string;
  availableQuantityUnits: string;
  requiredQuantityUnits: string;
  quantityScale: string;
}>;

export type SemanticPriceInequalityEvaluation = Readonly<{
  schemaVersion: "pmh.semantic-price-inequality-evaluation.v1";
  artifactHash: Hash;
  relationConstraintHash: Hash;
  semanticConstraintArtifactHash: Hash;
  portfolioId: Hash;
  status: "POSITIVE_GROSS_FLOOR" | "NO_GROSS_EDGE" | "DEPTH_INSUFFICIENT";
  commonPriceScale: string;
  totalAskAndFeeUnits: string;
  guaranteedPayoutUnits: string;
  grossEdgeUnits: string;
  requestedNormalizedQuantityNumerator: string;
  requestedNormalizedQuantityDenominator: string;
  quotes: readonly SemanticPortfolioQuote[];
  arithmetic: "BIGINT_RATIONAL_FIXED_POINT";
  feesIncluded: true;
  depthIncluded: true;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function lcm(left: bigint, right: bigint): bigint {
  if (left === 0n || right === 0n) return 0n;
  return (left / gcd(left, right)) * right;
}

function parseUnsigned(value: string, name: string, positive = false): bigint {
  if (!UNSIGNED_INTEGER.test(value)) throw new Error(`${name} must be an unsigned integer`);
  const parsed = BigInt(value);
  if (positive && parsed <= 0n) throw new Error(`${name} must be positive`);
  return parsed;
}

export function evaluateSemanticPriceInequality(input: {
  qualification: ResearchRelationPayoffQualification;
  portfolioId: Hash;
  quotes: readonly SemanticPortfolioQuote[];
}): SemanticPriceInequalityEvaluation {
  const qualification = assertResearchRelationPayoff(input.qualification);
  if (
    qualification.schemaVersion !== "pmh.research-relation-payoff.v2" ||
    qualification.status !== "SIMULATION_TEMPLATE_READY" ||
    qualification.semanticConstraintArtifactHash === undefined
  ) throw new Error("semantic price evaluation requires a v2 compiler-ready constraint");
  const portfolio = qualification.portfolios.find(
    (candidate) => candidate.portfolioId === input.portfolioId,
  );
  if (portfolio === undefined || input.quotes.length !== portfolio.legs.length) {
    throw new Error("semantic price evaluation portfolio binding is incomplete");
  }
  const quoteByLeg = new Map(input.quotes.map((quote) => [
    `${quote.listingRef}\n${quote.outcome}`,
    quote,
  ] as const));
  const bindingsByRef = new Map(
    qualification.listingBindings.map((binding) => [binding.listingRef, binding] as const),
  );
  const parsed = portfolio.legs.map((leg) => {
    const quote = quoteByLeg.get(`${leg.listingRef}\n${leg.outcome}`);
    const binding = bindingsByRef.get(leg.listingRef);
    if (
      quote === undefined || binding === undefined ||
      quote.priceScale !== binding.priceScale ||
      quote.quantityScale !== binding.quantityScale
    ) throw new Error("semantic price evaluation quote does not match its compiler binding");
    return Object.freeze({
      quote,
      price: parseUnsigned(quote.askPriceUnits, "ask price"),
      fee: parseUnsigned(quote.feeUnitsPerContract, "fee"),
      priceScale: parseUnsigned(quote.priceScale, "price scale", true),
      available: parseUnsigned(quote.availableQuantityUnits, "available quantity"),
      required: parseUnsigned(quote.requiredQuantityUnits, "required quantity", true),
      quantityScale: parseUnsigned(quote.quantityScale, "quantity scale", true),
    });
  });
  const first = parsed[0]!;
  for (const leg of parsed.slice(1)) {
    if (
      leg.required * first.quantityScale !==
      first.required * leg.quantityScale
    ) throw new Error("semantic price evaluation requires equal normalized leg quantities");
  }
  const commonPriceScale = parsed.reduce(
    (common, leg) => lcm(common, leg.priceScale),
    1n,
  );
  const totalAskAndFeeUnits = parsed.reduce(
    (total, leg) =>
      total + (leg.price + leg.fee) * (commonPriceScale / leg.priceScale),
    0n,
  );
  const guaranteedPayoutUnits =
    BigInt(portfolio.minimumPayoutUnits) * commonPriceScale;
  const enoughDepth = parsed.every((leg) => leg.available >= leg.required);
  const grossEdgeUnits = guaranteedPayoutUnits - totalAskAndFeeUnits;
  const status = !enoughDepth
    ? "DEPTH_INSUFFICIENT" as const
    : grossEdgeUnits > 0n
      ? "POSITIVE_GROSS_FLOOR" as const
      : "NO_GROSS_EDGE" as const;
  const body = Object.freeze({
    schemaVersion: "pmh.semantic-price-inequality-evaluation.v1" as const,
    relationConstraintHash: qualification.artifactHash,
    semanticConstraintArtifactHash: qualification.semanticConstraintArtifactHash,
    portfolioId: portfolio.portfolioId,
    status,
    commonPriceScale: commonPriceScale.toString(),
    totalAskAndFeeUnits: totalAskAndFeeUnits.toString(),
    guaranteedPayoutUnits: guaranteedPayoutUnits.toString(),
    grossEdgeUnits: grossEdgeUnits.toString(),
    requestedNormalizedQuantityNumerator: first.required.toString(),
    requestedNormalizedQuantityDenominator: first.quantityScale.toString(),
    quotes: Object.freeze([...input.quotes]),
    arithmetic: "BIGINT_RATIONAL_FIXED_POINT" as const,
    feesIncluded: true as const,
    depthIncluded: true as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
