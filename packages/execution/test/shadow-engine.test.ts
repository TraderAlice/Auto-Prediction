import { describe, expect, it } from "vitest";
import { CapitalLedger } from "@pmh/capital";
import { hashCanonical } from "@pmh/domain";
import type {
  ArbitrageCertificate,
  CandidateLeg,
} from "@pmh/opportunity";
import { RiskGovernor, type OpeningRiskInput } from "@pmh/risk";
import {
  ShadowExecutionEngine,
  validateExecutionPlan,
  type ExecutionPlan,
} from "../src/index.js";

const HASH = hashCanonical({ shadow: true });
const SCALE = 100n;

function certificateLeg(
  id: string,
  venueId: string,
  listingId: string,
  price: bigint,
): CandidateLeg {
  return {
    id,
    venueId,
    listingId,
    action: "BUY",
    quantity: SCALE,
    maxQuantity: SCALE,
    quantityScale: SCALE,
    quantityTick: 1n,
    unitPrice: price,
    priceTick: 1n,
    fee: { flat: 0n, rate: 0n, rateScale: SCALE },
    payoutPerUnitByResolution: { yes: SCALE, no: 0n },
    listingRuleHash: HASH,
    feeScheduleHash: HASH,
    bookGenerationHash: HASH,
    bookStateHash: HASH,
  };
}

const legs = [
  certificateLeg("leg:a", "venue:a", "listing:a", 40n),
  certificateLeg("leg:b", "venue:b", "listing:b", 50n),
];

const certificate: ArbitrageCertificate = {
  id: HASH,
  classification: "CERTIFIED_CONTRACT_ARBITRAGE",
  claimGraphHash: HASH,
  resolutionPartitionHash: HASH,
  listingRuleHashes: [HASH],
  bookGenerationHashes: [HASH],
  bookStateHashes: [HASH],
  feeScheduleHashes: [HASH],
  legs,
  grossPayoffByResolution: { yes: 10n, no: 10n },
  payoffByResolution: { yes: 10n, no: 10n },
  worstCaseGross: 10n,
  worstCaseAfterFees: 10n,
  capitalRequiredByVenue: { "venue:a": 40n, "venue:b": 50n },
  venueAssumptions: [],
  expiresAtEpochMs: 2_000n,
};

const plan: ExecutionPlan = {
  id: "plan:1",
  certificateId: certificate.id,
  intents: [
    {
      id: "intent:a",
      certificateLegId: "leg:a",
      venueId: "venue:a",
      listingId: "listing:a",
      clientOrderId: "client:a",
      side: "BUY",
      quantity: SCALE,
      quantityScale: SCALE,
      limitPrice: 40n,
      maxDebit: 40n,
    },
    {
      id: "intent:b",
      certificateLegId: "leg:b",
      venueId: "venue:b",
      listingId: "listing:b",
      clientOrderId: "client:b",
      side: "BUY",
      quantity: SCALE,
      quantityScale: SCALE,
      limitPrice: 50n,
      maxDebit: 50n,
    },
  ],
  dependencies: [
    {
      beforeIntentId: "intent:a",
      afterIntentId: "intent:b",
      condition: "PARTIAL_OR_FILLED",
    },
  ],
  hedgeCheckpoints: [
    {
      afterIntentId: "intent:a",
      maxResidualExposure: 50n,
      alternativeIntentIds: ["intent:b"],
    },
  ],
  abortPolicies: [
    { trigger: "UNKNOWN", action: "RECONCILE" },
    { trigger: "RISK_KILL", action: "CANCEL_OPEN" },
  ],
};

function governor(): RiskGovernor {
  return new RiskGovernor({
    liveExecutionEnabled: false,
    maxCapitalByVenue: new Map([
      ["venue:a", 100n],
      ["venue:b", 100n],
    ]),
    maxUnresolvedCapital: 100n,
    maxResidualExposure: 100n,
    maxCancelLatencyMs: 1_000n,
    maxHeartbeatAgeMs: 5_000n,
  });
}

function riskInput(): OpeningRiskInput {
  return {
    mode: "SHADOW",
    nowEpochMs: 1_000n,
    certificate,
    books: [
      {
        instrumentId: "listing:a",
        lifecycle: "SNAPSHOT_VALID",
        generation: 1n,
        bids: [],
        asks: [],
      },
      {
        instrumentId: "listing:b",
        lifecycle: "APPLYING_DELTAS",
        generation: 1n,
        bids: [],
        asks: [],
      },
    ],
    capital: [],
    residualExposure: 0n,
    cancelLatencyMs: 0n,
    heartbeatAgeMs: 0n,
    localVenueStateDiverged: false,
  };
}

describe("multi-leg shadow execution", () => {
  it("handles partial fills, UNKNOWN reconciliation, and locks only fully hedged plans", () => {
    const capital = new CapitalLedger(
      new Map([
        ["venue:a", 100n],
        ["venue:b", 100n],
      ]),
    );
    const engine = new ShadowExecutionEngine(capital, governor());
    expect(engine.reservePlan(plan, riskInput()).lifecycle).toBe("RESERVED");

    expect(() => engine.submit(plan.id, "intent:b")).toThrow(
      /dependency .* is not satisfied/,
    );
    engine.submit(plan.id, "intent:a");
    engine.submit(plan.id, "intent:a");
    engine.acknowledge(plan.id, "intent:a", "shadow-order:a");
    expect(engine.fill(plan.id, "intent:a", 50n, 20n).lifecycle).toBe(
      "PARTIALLY_HEDGED",
    );
    engine.fill(plan.id, "intent:a", 50n, 20n);

    engine.submit(plan.id, "intent:b");
    engine.markUnknown(plan.id, "intent:b");
    expect(() => engine.submit(plan.id, "intent:b")).toThrow(/expected order/);
    engine.reconcileUnknown(
      plan.id,
      "intent:b",
      "PARTIAL",
      50n,
      25n,
      "shadow-order:b",
    );
    const locked = engine.fill(plan.id, "intent:b", 50n, 25n);
    expect(locked.lifecycle).toBe("LOCKED");
    expect(capital.venueProjection("venue:a").deployed).toBe(40n);
    expect(capital.venueProjection("venue:b").deployed).toBe(50n);
    engine.lockCapitalForResolution(plan.id);
    expect(capital.venueProjection("venue:a").unresolved).toBe(40n);
    const settled = engine.settlePlan(
      plan.id,
      new Map([
        ["venue:a", 55n],
        ["venue:b", 50n],
      ]),
    );
    expect(settled.lifecycle).toBe("SETTLED");
    expect(capital.venueProjection("venue:a").realizedPnl).toBe(15n);
    capital.assertConservation();
  });

  it("releases unfilled reservation after cancel", () => {
    const capital = new CapitalLedger(
      new Map([
        ["venue:a", 100n],
        ["venue:b", 100n],
      ]),
    );
    const engine = new ShadowExecutionEngine(capital, governor());
    engine.reservePlan(plan, riskInput());
    engine.submit(plan.id, "intent:a");
    engine.acknowledge(plan.id, "intent:a", "shadow-order:a");
    engine.fill(plan.id, "intent:a", 25n, 10n);
    expect(engine.cancel(plan.id, "intent:a").lifecycle).toBe("FAILED");
    expect(capital.venueProjection("venue:a")).toMatchObject({
      available: 90n,
      reserved: 0n,
      deployed: 10n,
    });
  });

  it("rolls back earlier reservations when a later venue cannot fund", () => {
    const capital = new CapitalLedger(
      new Map([
        ["venue:a", 100n],
        ["venue:b", 10n],
      ]),
    );
    const engine = new ShadowExecutionEngine(capital, governor());
    expect(() => engine.reservePlan(plan, riskInput())).toThrow(/insufficient/);
    expect(capital.venueProjection("venue:a").available).toBe(100n);
    expect(capital.venueProjection("venue:a").reserved).toBe(0n);
  });

  it("rejects cyclic execution DAGs", () => {
    expect(() =>
      validateExecutionPlan({
        ...plan,
        dependencies: [
          {
            beforeIntentId: "intent:a",
            afterIntentId: "intent:b",
            condition: "ACKNOWLEDGED",
          },
          {
            beforeIntentId: "intent:b",
            afterIntentId: "intent:a",
            condition: "ACKNOWLEDGED",
          },
        ],
      }),
    ).toThrow(/cycle/);
  });

  it("rejects an intent that is not bound to a certificate leg", () => {
    const capital = new CapitalLedger(
      new Map([
        ["venue:a", 100n],
        ["venue:b", 100n],
      ]),
    );
    const engine = new ShadowExecutionEngine(capital, governor());
    const tampered = {
      ...plan,
      intents: [
        { ...plan.intents[0]!, limitPrice: 39n },
        plan.intents[1]!,
      ],
    };
    expect(() => engine.reservePlan(tampered, riskInput())).toThrow(
      /does not bind/,
    );
  });
});
