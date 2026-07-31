import type { Hash } from "@pmh/domain";

export type OrderLifecycle =
  | "INTENT"
  | "SUBMITTING"
  | "ACKNOWLEDGED"
  | "PARTIAL"
  | "FILLED"
  | "CANCELED"
  | "REJECTED"
  | "UNKNOWN";

export type ExecutionLifecycle =
  | "PLANNED"
  | "RESERVED"
  | "SUBMITTING"
  | "ACKNOWLEDGED"
  | "PARTIALLY_HEDGED"
  | "LOCKED"
  | "UNWINDING"
  | "SETTLED"
  | "FAILED"
  | "UNKNOWN";

export type OrderIntent = Readonly<{
  id: string;
  certificateLegId: string;
  venueId: string;
  listingId: string;
  clientOrderId: string;
  side: "BUY" | "SELL";
  quantity: bigint;
  quantityScale: bigint;
  limitPrice: bigint;
  maxDebit: bigint;
}>;

export type ExecutionDependency = Readonly<{
  beforeIntentId: string;
  afterIntentId: string;
  condition: "ACKNOWLEDGED" | "PARTIAL_OR_FILLED" | "FILLED";
}>;

export type HedgeCheckpoint = Readonly<{
  afterIntentId: string;
  maxResidualExposure: bigint;
  alternativeIntentIds: readonly string[];
}>;

export type AbortPolicy = Readonly<{
  trigger: "REJECTED" | "UNKNOWN" | "TIMEOUT" | "RISK_KILL";
  action: "CANCEL_OPEN" | "UNWIND" | "RECONCILE";
}>;

export type ExecutionPlan = Readonly<{
  id: string;
  certificateId: Hash;
  intents: readonly OrderIntent[];
  dependencies: readonly ExecutionDependency[];
  hedgeCheckpoints: readonly HedgeCheckpoint[];
  abortPolicies: readonly AbortPolicy[];
}>;

export type OrderProjection = Readonly<{
  intentId: string;
  clientOrderId: string;
  lifecycle: OrderLifecycle;
  venueOrderId?: string;
  filledQuantity: bigint;
  totalQuantity: bigint;
}>;

export type ExecutionProjection = Readonly<{
  planId: string;
  lifecycle: ExecutionLifecycle;
  orders: readonly OrderProjection[];
}>;
