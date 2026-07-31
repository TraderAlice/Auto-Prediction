import { divideCeil, type Fixed } from "@pmh/domain";
import type { ArbitrageCandidate, CandidateLeg } from "./types.js";
import { VerificationError } from "./verifier.js";

export type CapitalLimits = ReadonlyMap<string, Fixed>;

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function leastCommonMultiple(left: bigint, right: bigint): bigint {
  if (left === 0n || right === 0n) {
    return 0n;
  }
  return (left / greatestCommonDivisor(left, right)) * right;
}

function debitAtQuantity(leg: CandidateLeg, quantity: Fixed): Fixed {
  const notional = divideCeil(
    quantity * leg.unitPrice,
    leg.quantityScale,
  );
  const fee =
    leg.fee.flat +
    divideCeil(notional * leg.fee.rate, leg.fee.rateScale);
  return notional + fee;
}

function capitalFits(
  legs: readonly CandidateLeg[],
  quantity: Fixed,
  limits: CapitalLimits,
): boolean {
  const required = new Map<string, Fixed>();
  for (const leg of legs) {
    required.set(
      leg.venueId,
      (required.get(leg.venueId) ?? 0n) + debitAtQuantity(leg, quantity),
    );
  }
  for (const [venueId, amount] of required) {
    const limit = limits.get(venueId);
    if (limit === undefined || limit < 0n || amount > limit) {
      return false;
    }
  }
  return true;
}

/**
 * Proposes the largest equal-quantity exhaustive-set candidate permitted by
 * selected depth, venue capital silos, and all quantity ticks. This compiler
 * has no authority: the returned candidate must still pass the independent
 * exact verifier.
 */
export function proposeCompleteSetCandidate(
  template: ArbitrageCandidate,
  capitalLimits: CapitalLimits,
): ArbitrageCandidate {
  if (template.legs.length === 0) {
    throw new VerificationError("complete-set template has no legs");
  }
  if (template.legs.some((leg) => leg.action !== "BUY")) {
    throw new VerificationError(
      "complete-set compiler currently accepts BUY legs only",
    );
  }
  const quantityScale = template.legs[0]?.quantityScale;
  if (
    quantityScale === undefined ||
    template.legs.some((leg) => leg.quantityScale !== quantityScale)
  ) {
    throw new VerificationError(
      "complete-set legs must share one quantity scale",
    );
  }
  const commonTick = template.legs.reduce(
    (tick, leg) => leastCommonMultiple(tick, leg.quantityTick),
    1n,
  );
  if (commonTick <= 0n) {
    throw new VerificationError("complete-set quantity tick is invalid");
  }
  const depthBound = template.legs.reduce(
    (bound, leg) => (leg.maxQuantity < bound ? leg.maxQuantity : bound),
    template.legs[0]?.maxQuantity ?? 0n,
  );
  const maxUnits = depthBound / commonTick;
  if (maxUnits <= 0n) {
    throw new VerificationError("complete-set depth is below one common tick");
  }

  let lower = 0n;
  let upper = maxUnits;
  while (lower < upper) {
    const middle = (lower + upper + 1n) / 2n;
    const quantity = middle * commonTick;
    if (capitalFits(template.legs, quantity, capitalLimits)) {
      lower = middle;
    } else {
      upper = middle - 1n;
    }
  }
  if (lower === 0n) {
    throw new VerificationError(
      "venue capital limits cannot fund one common quantity tick",
    );
  }
  const quantity = lower * commonTick;
  return {
    ...template,
    legs: template.legs.map((leg) => ({ ...leg, quantity })),
  };
}
