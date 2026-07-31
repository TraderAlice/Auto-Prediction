import type { EventEnvelope } from "./envelope.js";

export type CatalogQuery = Readonly<{
  cursor?: string;
  limit: bigint;
  status?: string;
}>;

export type CatalogPage<T> = Readonly<{
  items: readonly T[];
  nextCursor?: string;
  sourceIdentity: string;
}>;

export interface MarketCatalogPort<TListing> {
  listMarkets(query: CatalogQuery): Promise<CatalogPage<TListing>>;
}

export interface ContractRulesPort<TRules> {
  getRules(venueInstrumentId: string): Promise<TRules>;
}

export interface RealtimeBookPort<TBookEvent> {
  subscribeBook(
    venueInstrumentIds: readonly string[],
  ): AsyncIterable<EventEnvelope<TBookEvent>>;
}

export interface TradeTapePort<TTrade> {
  subscribeTrades(
    venueInstrumentIds: readonly string[],
  ): AsyncIterable<EventEnvelope<TTrade>>;
}

export interface OrderGatewayPort<TIntent, TAcknowledgement> {
  readonly liveExecutionEnabled: false;
  submit(intent: TIntent): Promise<TAcknowledgement>;
  cancel(orderIdentity: string): Promise<TAcknowledgement>;
  reconcile(orderIdentity: string): Promise<TAcknowledgement>;
}

export interface PositionGatewayPort<TPosition> {
  listPositions(): Promise<readonly TPosition[]>;
}

export interface BalanceGatewayPort<TBalance> {
  listBalances(): Promise<readonly TBalance[]>;
}

export interface SettlementGatewayPort<TSettlement> {
  getSettlement(venueInstrumentId: string): Promise<TSettlement>;
}

export interface ConditionalTokenPort<TConditionalAction> {
  simulateConditionalAction(action: TConditionalAction): Promise<unknown>;
}

export interface LiquidityProvisionPort<TQuote> {
  validateShadowQuote(quote: TQuote): Promise<unknown>;
}

export interface ComboRfqPort<TCombo> {
  inspectCombo(comboId: string): Promise<TCombo>;
}

export interface AmmPoolPort<TPool> {
  inspectPool(venueInstrumentId: string): Promise<TPool>;
}
