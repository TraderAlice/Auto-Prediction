import {
  divideCeil,
  divideFloor,
  hashCanonical,
  type Fixed,
  type Hash,
} from "@pmh/domain";
import type {
  ArbitrageCandidate,
  ArbitrageCertificate,
  CandidateLeg,
  VerificationContext,
} from "./types.js";

export class VerificationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "VerificationError";
  }
}

function minimum(values: readonly bigint[]): bigint {
  const [first, ...rest] = values;
  if (first === undefined) {
    throw new VerificationError("cannot take the minimum of an empty set");
  }
  return rest.reduce((current, item) => (item < current ? item : current), first);
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort();
}

function assertExactStateCoverage(
  stateIds: readonly string[],
  leg: CandidateLeg,
): void {
  const expected = uniqueSorted(stateIds);
  const actual = uniqueSorted(Object.keys(leg.payoutPerUnitByResolution));
  if (
    expected.length !== actual.length ||
    expected.some((stateId, index) => stateId !== actual[index])
  ) {
    throw new VerificationError(
      `leg ${leg.id} payout vector does not cover the exact resolution partition`,
    );
  }
}

function assertHashBinding(
  label: string,
  listingId: string,
  candidateHash: Hash,
  currentHashes: ReadonlyMap<string, Hash>,
): void {
  const current = currentHashes.get(listingId);
  if (current === undefined) {
    throw new VerificationError(
      `${label} identity is unavailable for listing ${listingId}`,
    );
  }
  if (current !== candidateHash) {
    throw new VerificationError(
      `${label} identity changed for listing ${listingId}`,
    );
  }
}

function assertLeg(
  leg: CandidateLeg,
  stateIds: readonly string[],
  context: VerificationContext,
): void {
  if (leg.quantity <= 0n || leg.maxQuantity <= 0n) {
    throw new VerificationError(`leg ${leg.id} quantity must be positive`);
  }
  if (leg.quantity > leg.maxQuantity) {
    throw new VerificationError(`leg ${leg.id} exceeds bounded depth`);
  }
  if (
    leg.quantityScale <= 0n ||
    leg.quantityTick <= 0n ||
    leg.priceTick <= 0n
  ) {
    throw new VerificationError(`leg ${leg.id} has invalid scale or tick`);
  }
  if (leg.quantity % leg.quantityTick !== 0n) {
    throw new VerificationError(`leg ${leg.id} quantity is off tick`);
  }
  if (leg.unitPrice < 0n || leg.unitPrice % leg.priceTick !== 0n) {
    throw new VerificationError(`leg ${leg.id} price is invalid or off tick`);
  }
  if (
    leg.fee.flat < 0n ||
    leg.fee.rate < 0n ||
    leg.fee.rateScale <= 0n ||
    leg.fee.rate > leg.fee.rateScale
  ) {
    throw new VerificationError(`leg ${leg.id} has an invalid fee schedule`);
  }

  assertExactStateCoverage(stateIds, leg);
  assertHashBinding(
    "listing rule",
    leg.listingId,
    leg.listingRuleHash,
    context.listingRuleHashById,
  );
  assertHashBinding(
    "fee schedule",
    leg.listingId,
    leg.feeScheduleHash,
    context.feeScheduleHashByListingId,
  );
  assertHashBinding(
    "book generation",
    leg.listingId,
    leg.bookGenerationHash,
    context.bookGenerationHashByListingId,
  );
  assertHashBinding(
    "book state",
    leg.listingId,
    leg.bookStateHash,
    context.bookStateHashByListingId,
  );
}

function legNotional(leg: CandidateLeg): Fixed {
  const product = leg.quantity * leg.unitPrice;
  return leg.action === "BUY"
    ? divideCeil(product, leg.quantityScale)
    : divideFloor(product, leg.quantityScale);
}

function legFee(leg: CandidateLeg, notional: Fixed): Fixed {
  return (
    leg.fee.flat +
    divideCeil(notional * leg.fee.rate, leg.fee.rateScale)
  );
}

function legPayout(
  leg: CandidateLeg,
  stateId: string,
): Fixed {
  const perUnit = leg.payoutPerUnitByResolution[stateId];
  if (perUnit === undefined) {
    throw new VerificationError(
      `leg ${leg.id} is missing payout state ${stateId}`,
    );
  }
  const product = leg.quantity * perUnit;
  return leg.action === "BUY"
    ? divideFloor(product, leg.quantityScale)
    : -divideCeil(product, leg.quantityScale);
}

function capitalForLeg(
  leg: CandidateLeg,
  stateIds: readonly string[],
  notional: Fixed,
  fee: Fixed,
): Fixed {
  const initial = leg.action === "BUY" ? -notional : notional;
  const worst = minimum(
    stateIds.map((stateId) => initial - fee + legPayout(leg, stateId)),
  );
  return worst < 0n ? -worst : 0n;
}

function recordFromSortedEntries(
  entries: readonly (readonly [string, Fixed])[],
): Readonly<Record<string, Fixed>> {
  return Object.freeze(
    Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right))),
  );
}

export function verifyArbitrageCandidate(
  candidate: ArbitrageCandidate,
  context: VerificationContext,
): ArbitrageCertificate {
  if (candidate.claimGraphHash !== context.claimGraphHash) {
    throw new VerificationError("claim graph identity changed");
  }
  if (candidate.resolutionPartitionHash !== context.resolutionPartitionHash) {
    throw new VerificationError("resolution partition identity changed");
  }
  if (candidate.expiresAtEpochMs <= context.nowEpochMs) {
    throw new VerificationError("candidate is expired");
  }
  if (candidate.resolutionStateIds.length === 0) {
    throw new VerificationError("resolution partition is empty");
  }
  if (
    new Set(candidate.resolutionStateIds).size !==
    candidate.resolutionStateIds.length
  ) {
    throw new VerificationError("resolution state ids must be unique");
  }
  if (candidate.legs.length === 0) {
    throw new VerificationError("candidate has no executable legs");
  }
  if (
    candidate.classification === "VENUE_BOUNDED_ARBITRAGE" &&
    candidate.venueAssumptions.length === 0
  ) {
    throw new VerificationError(
      "venue-bounded arbitrage requires explicit venue assumptions",
    );
  }

  candidate.legs.forEach((leg) =>
    assertLeg(leg, candidate.resolutionStateIds, context),
  );

  const notionals = candidate.legs.map(legNotional);
  const fees = candidate.legs.map((leg, index) =>
    legFee(leg, notionals[index] ?? 0n),
  );
  const initialGross = candidate.legs.reduce(
    (total, leg, index) =>
      total +
      (leg.action === "BUY"
        ? -(notionals[index] ?? 0n)
        : (notionals[index] ?? 0n)),
    0n,
  );
  const totalFees = fees.reduce((total, fee) => total + fee, 0n);

  const grossPayoffByResolution = recordFromSortedEntries(
    candidate.resolutionStateIds.map((stateId) => [
      stateId,
      initialGross +
        candidate.legs.reduce(
          (total, leg) => total + legPayout(leg, stateId),
          0n,
        ),
    ]),
  );
  const payoffByResolution = recordFromSortedEntries(
    Object.entries(grossPayoffByResolution).map(([stateId, payoff]) => [
      stateId,
      payoff - totalFees,
    ]),
  );
  const worstCaseGross = minimum(Object.values(grossPayoffByResolution));
  const worstCaseAfterFees = minimum(Object.values(payoffByResolution));

  if (
    (candidate.classification === "CERTIFIED_CONTRACT_ARBITRAGE" ||
      candidate.classification === "VENUE_BOUNDED_ARBITRAGE") &&
    worstCaseAfterFees <= 0n
  ) {
    throw new VerificationError(
      "arbitrage classification requires strictly positive worst-case payoff after fees",
    );
  }

  const capital = new Map<string, Fixed>();
  candidate.legs.forEach((leg, index) => {
    const required = capitalForLeg(
      leg,
      candidate.resolutionStateIds,
      notionals[index] ?? 0n,
      fees[index] ?? 0n,
    );
    capital.set(leg.venueId, (capital.get(leg.venueId) ?? 0n) + required);
  });

  const certificateBody = {
    classification: candidate.classification,
    claimGraphHash: candidate.claimGraphHash,
    resolutionPartitionHash: candidate.resolutionPartitionHash,
    listingRuleHashes: uniqueSorted(
      candidate.legs.map((leg) => leg.listingRuleHash),
    ),
    bookGenerationHashes: uniqueSorted(
      candidate.legs.map((leg) => leg.bookGenerationHash),
    ),
    bookStateHashes: uniqueSorted(
      candidate.legs.map((leg) => leg.bookStateHash),
    ),
    feeScheduleHashes: uniqueSorted(
      candidate.legs.map((leg) => leg.feeScheduleHash),
    ),
    legs: candidate.legs,
    grossPayoffByResolution,
    payoffByResolution,
    worstCaseGross,
    worstCaseAfterFees,
    capitalRequiredByVenue: recordFromSortedEntries([...capital.entries()]),
    venueAssumptions: candidate.venueAssumptions,
    expiresAtEpochMs: candidate.expiresAtEpochMs,
  } satisfies Omit<ArbitrageCertificate, "id">;

  return Object.freeze({
    id: hashCanonical(certificateBody),
    ...certificateBody,
  });
}
