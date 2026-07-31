import { divideCeil, divideFloor, type Fixed } from "@pmh/domain";
import type { HedgeCurve, HedgePoint } from "./hedge-curve.js";

export type MakerPremiums = Readonly<{
  targetVenueFee: Fixed;
  executionRisk: Fixed;
  resolutionMismatch: Fixed;
  venueRisk: Fixed;
  capitalLock: Fixed;
  inventory: Fixed;
}>;

export type ShadowMakerQuote = Readonly<{
  venueId: string;
  listingId: string;
  outcomeId: string;
  bidPrice: Fixed;
  askPrice: Fixed;
  quantity: Fixed;
  buyHedge: HedgePoint;
  sellHedge: HedgePoint;
  premiumPerUnit: Fixed;
  liveExecutionEnabled: false;
}>;

function pointByQuantity(
  curve: HedgeCurve,
  quantity: Fixed,
): HedgePoint | undefined {
  return curve.points.find((point) => point.quantity === quantity);
}

export function generateShadowMakerQuote(input: {
  venueId: string;
  listingId: string;
  outcomeId: string;
  buyHedgeCurve: HedgeCurve;
  sellHedgeCurve: HedgeCurve;
  premiums: MakerPremiums;
  maxQuoteQuantity: Fixed;
  inventoryCapacity: Fixed;
  riskBudgetQuantity: Fixed;
  payoutPerUnit: Fixed;
}): ShadowMakerQuote {
  if (
    input.buyHedgeCurve.action !== "BUY" ||
    input.sellHedgeCurve.action !== "SELL" ||
    input.buyHedgeCurve.claimId !== input.sellHedgeCurve.claimId ||
    input.buyHedgeCurve.outcomeId !== input.outcomeId ||
    input.sellHedgeCurve.outcomeId !== input.outcomeId ||
    input.buyHedgeCurve.quantityScale !== input.sellHedgeCurve.quantityScale ||
    input.buyHedgeCurve.collateralScale !==
      input.sellHedgeCurve.collateralScale ||
    input.payoutPerUnit <= 0n
  ) {
    throw new Error("maker quote hedge curves are incompatible");
  }
  const quantityLimit = [
    input.maxQuoteQuantity,
    input.inventoryCapacity,
    input.riskBudgetQuantity,
  ].reduce((minimum, item) => (item < minimum ? item : minimum));
  const commonQuantities = input.buyHedgeCurve.points
    .map((point) => point.quantity)
    .filter(
      (quantity) =>
        quantity <= quantityLimit &&
        pointByQuantity(input.sellHedgeCurve, quantity) !== undefined,
    )
    .sort((left, right) => (left > right ? -1 : left < right ? 1 : 0));
  const quantity = commonQuantities[0];
  if (quantity === undefined || quantity <= 0n) {
    throw new Error("no common executable hedge quantity fits quote limits");
  }
  const buyHedge = pointByQuantity(input.buyHedgeCurve, quantity);
  const sellHedge = pointByQuantity(input.sellHedgeCurve, quantity);
  if (buyHedge === undefined || sellHedge === undefined) {
    throw new Error("selected hedge point is unavailable");
  }
  const premiums = Object.values(input.premiums);
  if (premiums.some((premium) => premium < 0n)) {
    throw new Error("maker premiums must be non-negative");
  }
  const premiumPerUnit = premiums.reduce(
    (total, premium) => total + premium,
    0n,
  );
  const scale = input.buyHedgeCurve.quantityScale;
  const acquisitionPerUnit = divideCeil(
    buyHedge.allInCollateral * scale,
    quantity,
  );
  const liquidationPerUnit = divideFloor(
    sellHedge.allInCollateral * scale,
    quantity,
  );
  const askPrice = acquisitionPerUnit + premiumPerUnit;
  const bidPrice = liquidationPerUnit - premiumPerUnit;
  if (
    bidPrice < 0n ||
    askPrice > input.payoutPerUnit ||
    bidPrice >= askPrice
  ) {
    throw new Error("risk-covered maker spread is not economically valid");
  }
  return Object.freeze({
    venueId: input.venueId,
    listingId: input.listingId,
    outcomeId: input.outcomeId,
    bidPrice,
    askPrice,
    quantity,
    buyHedge,
    sellHedge,
    premiumPerUnit,
    liveExecutionEnabled: false,
  });
}
