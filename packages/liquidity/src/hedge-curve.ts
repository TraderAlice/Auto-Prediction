import { divideCeil, divideFloor, type Fixed, type Hash } from "@pmh/domain";

export type HedgeSourceLevel = Readonly<{
  venueId: string;
  listingId: string;
  action: "BUY" | "SELL";
  availableQuantity: Fixed;
  quantityScale: bigint;
  unitCollateral: Fixed;
  collateralScale: bigint;
  feeRate: Fixed;
  feeRateScale: bigint;
  executionRiskPerUnit: Fixed;
  basisRiskPerUnit: Fixed;
  venueRiskPerUnit: Fixed;
  capitalLockPerUnit: Fixed;
  bookStateHash: Hash;
}>;

export type HedgeAllocation = Readonly<{
  venueId: string;
  listingId: string;
  quantity: Fixed;
  unitCollateral: Fixed;
  bookStateHash: Hash;
}>;

export type HedgePoint = Readonly<{
  quantity: Fixed;
  allInCollateral: Fixed;
  basisRisk: Fixed;
  hedgeLegs: readonly HedgeAllocation[];
}>;

export type HedgeCurve = Readonly<{
  claimId: string;
  outcomeId: string;
  action: "BUY" | "SELL";
  quantityScale: bigint;
  collateralScale: bigint;
  asOfEpochMs: bigint;
  points: readonly HedgePoint[];
}>;

function marginalCollateral(level: HedgeSourceLevel): Fixed {
  const feePerUnit = divideCeil(
    level.unitCollateral * level.feeRate,
    level.feeRateScale,
  );
  const friction =
    feePerUnit +
    level.executionRiskPerUnit +
    level.basisRiskPerUnit +
    level.venueRiskPerUnit +
    level.capitalLockPerUnit;
  return level.action === "BUY"
    ? level.unitCollateral + friction
    : level.unitCollateral - friction;
}

export function buildHedgeCurve(input: {
  claimId: string;
  outcomeId: string;
  action: "BUY" | "SELL";
  asOfEpochMs: bigint;
  levels: readonly HedgeSourceLevel[];
  checkpoints: readonly Fixed[];
}): HedgeCurve {
  if (input.levels.length === 0) {
    throw new Error("hedge curve requires executable levels");
  }
  const quantityScale = input.levels[0]?.quantityScale;
  const collateralScale = input.levels[0]?.collateralScale;
  if (
    quantityScale === undefined ||
    quantityScale <= 0n ||
    collateralScale === undefined ||
    collateralScale <= 0n ||
    input.levels.some(
      (level) =>
        level.quantityScale !== quantityScale ||
        level.collateralScale !== collateralScale ||
        level.action !== input.action ||
        level.availableQuantity <= 0n ||
        level.unitCollateral < 0n ||
        level.feeRate < 0n ||
        level.feeRateScale <= 0n ||
        level.executionRiskPerUnit < 0n ||
        level.basisRiskPerUnit < 0n ||
        level.venueRiskPerUnit < 0n ||
        level.capitalLockPerUnit < 0n ||
        marginalCollateral(level) < 0n,
    )
  ) {
    throw new Error("hedge levels have incompatible or invalid identities");
  }
  const sortedLevels = [...input.levels].sort((left, right) => {
    const leftCost = marginalCollateral(left);
    const rightCost = marginalCollateral(right);
    if (leftCost === rightCost) {
      return left.listingId.localeCompare(right.listingId);
    }
    if (input.action === "BUY") {
      return leftCost < rightCost ? -1 : 1;
    }
    return leftCost > rightCost ? -1 : 1;
  });
  const totalDepth = sortedLevels.reduce(
    (total, level) => total + level.availableQuantity,
    0n,
  );
  const checkpoints = [...new Set(input.checkpoints)]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (
    checkpoints.length === 0 ||
    checkpoints.some(
      (quantity) => quantity <= 0n || quantity > totalDepth,
    )
  ) {
    throw new Error("hedge checkpoints exceed executable depth");
  }

  const points = checkpoints.map((quantity): HedgePoint => {
    let remaining = quantity;
    let collateral = 0n;
    let basisRisk = 0n;
    const hedgeLegs: HedgeAllocation[] = [];
    for (const level of sortedLevels) {
      if (remaining === 0n) {
        break;
      }
      const allocated =
        level.availableQuantity < remaining
          ? level.availableQuantity
          : remaining;
      collateral +=
        input.action === "BUY"
          ? divideCeil(
              allocated * marginalCollateral(level),
              quantityScale,
            )
          : divideFloor(
              allocated * marginalCollateral(level),
              quantityScale,
            );
      basisRisk += divideCeil(
        allocated * level.basisRiskPerUnit,
        quantityScale,
      );
      hedgeLegs.push({
        venueId: level.venueId,
        listingId: level.listingId,
        quantity: allocated,
        unitCollateral: level.unitCollateral,
        bookStateHash: level.bookStateHash,
      });
      remaining -= allocated;
    }
    if (remaining !== 0n) {
      throw new Error("hedge allocation failed to cover checkpoint");
    }
    return Object.freeze({
      quantity,
      allInCollateral: collateral,
      basisRisk,
      hedgeLegs: Object.freeze(hedgeLegs),
    });
  });

  return Object.freeze({
    claimId: input.claimId,
    outcomeId: input.outcomeId,
    action: input.action,
    quantityScale,
    collateralScale,
    asOfEpochMs: input.asOfEpochMs,
    points: Object.freeze(points),
  });
}
