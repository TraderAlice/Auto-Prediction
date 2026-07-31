import type { Fixed, Hash } from "@pmh/domain";

export type OpportunityClassification =
  | "CERTIFIED_CONTRACT_ARBITRAGE"
  | "VENUE_BOUNDED_ARBITRAGE"
  | "CONDITIONAL_BASIS"
  | "SEMANTIC_SPREAD"
  | "MARKET_MAKING";

export type CandidateFee = Readonly<{
  flat: Fixed;
  rate: Fixed;
  rateScale: bigint;
}>;

export type CandidateLeg = Readonly<{
  id: string;
  venueId: string;
  listingId: string;
  action: "BUY" | "SELL";
  quantity: Fixed;
  maxQuantity: Fixed;
  quantityScale: bigint;
  quantityTick: Fixed;
  unitPrice: Fixed;
  priceTick: Fixed;
  fee: CandidateFee;
  payoutPerUnitByResolution: Readonly<Record<string, Fixed>>;
  listingRuleHash: Hash;
  feeScheduleHash: Hash;
  bookGenerationHash: Hash;
  bookStateHash: Hash;
}>;

export type ArbitrageCandidate = Readonly<{
  classification: OpportunityClassification;
  claimGraphHash: Hash;
  resolutionPartitionHash: Hash;
  resolutionStateIds: readonly string[];
  legs: readonly CandidateLeg[];
  venueAssumptions: readonly string[];
  expiresAtEpochMs: bigint;
}>;

export type VerificationContext = Readonly<{
  nowEpochMs: bigint;
  claimGraphHash: Hash;
  resolutionPartitionHash: Hash;
  listingRuleHashById: ReadonlyMap<string, Hash>;
  feeScheduleHashByListingId: ReadonlyMap<string, Hash>;
  bookGenerationHashByListingId: ReadonlyMap<string, Hash>;
  bookStateHashByListingId: ReadonlyMap<string, Hash>;
}>;

export type ArbitrageCertificate = Readonly<{
  id: Hash;
  classification: OpportunityClassification;
  claimGraphHash: Hash;
  resolutionPartitionHash: Hash;
  listingRuleHashes: readonly Hash[];
  bookGenerationHashes: readonly Hash[];
  bookStateHashes: readonly Hash[];
  feeScheduleHashes: readonly Hash[];
  legs: readonly CandidateLeg[];
  grossPayoffByResolution: Readonly<Record<string, Fixed>>;
  payoffByResolution: Readonly<Record<string, Fixed>>;
  worstCaseGross: Fixed;
  worstCaseAfterFees: Fixed;
  capitalRequiredByVenue: Readonly<Record<string, Fixed>>;
  venueAssumptions: readonly string[];
  expiresAtEpochMs: bigint;
}>;
