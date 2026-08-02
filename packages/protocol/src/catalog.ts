import type { Fixed, Hash } from "@pmh/domain";

export type MarketMechanism =
  | "ONCHAIN_CLOB"
  | "CENTRALIZED_ORDER_BOOK"
  | "AMM"
  | "COMBO_RFQ";

export type NormalizedCatalogOutcome = Readonly<{
  venueOutcomeId: string;
  label: string;
  indicativePrice?: Fixed;
}>;

export type NormalizedCatalogListing = Readonly<{
  venueId: string;
  venueEventId?: string;
  venueInstrumentId: string;
  title: string;
  description: string;
  status: string;
  mechanism: MarketMechanism;
  opensAt?: string;
  closesAt?: string;
  rulesText?: string;
  rulesUrl?: string;
  resolutionSourceUrl?: string;
  outcomes: readonly NormalizedCatalogOutcome[];
  collateralId?: string;
  priceScale: bigint;
  quantityScale: bigint;
  minPriceTick?: Fixed;
  sourceFixtureHash: Hash;
  protocolIdentity: string;
}>;
