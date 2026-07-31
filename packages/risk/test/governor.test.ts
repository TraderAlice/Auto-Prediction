import { describe, expect, it } from "vitest";
import type { ArbitrageCertificate } from "@pmh/opportunity";
import { hashCanonical } from "@pmh/domain";
import { RiskGovernor, type OpeningRiskInput } from "../src/index.js";

const HASH = hashCanonical({ test: true });

const certificate: ArbitrageCertificate = {
  id: HASH,
  classification: "CERTIFIED_CONTRACT_ARBITRAGE",
  claimGraphHash: HASH,
  resolutionPartitionHash: HASH,
  listingRuleHashes: [HASH],
  bookGenerationHashes: [HASH],
  bookStateHashes: [HASH],
  feeScheduleHashes: [HASH],
  legs: [],
  grossPayoffByResolution: { yes: 10n, no: 10n },
  payoffByResolution: { yes: 10n, no: 10n },
  worstCaseGross: 10n,
  worstCaseAfterFees: 10n,
  capitalRequiredByVenue: { "venue:a": 50n },
  venueAssumptions: [],
  expiresAtEpochMs: 2_000n,
};

const governor = new RiskGovernor({
  liveExecutionEnabled: false,
  maxCapitalByVenue: new Map([["venue:a", 100n]]),
  maxUnresolvedCapital: 50n,
  maxResidualExposure: 10n,
  maxCancelLatencyMs: 1_000n,
  maxHeartbeatAgeMs: 5_000n,
});

function safeInput(): OpeningRiskInput {
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
    ],
    capital: [
      {
        venueId: "venue:a",
        initialCapital: 100n,
        realizedPnl: 0n,
        available: 100n,
        reserved: 0n,
        deployed: 0n,
        unresolved: 0n,
        receivable: 0n,
      },
    ],
    residualExposure: 0n,
    cancelLatencyMs: 0n,
    heartbeatAgeMs: 0n,
    localVenueStateDiverged: false,
  };
}

describe("fixed risk governor", () => {
  it("allows only a bounded shadow opening", () => {
    expect(governor.evaluateOpening(safeInput())).toEqual({
      allowed: true,
      mode: "SHADOW",
      diagnostics: [],
    });
  });

  it("proves live execution is disabled", () => {
    const decision = governor.evaluateOpening({
      ...safeInput(),
      mode: "LIVE",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.diagnostics).toContain("LIVE_EXECUTION_DISABLED");
  });

  it.each(["STALE", "GAP_DETECTED", "REBUILDING"] as const)(
    "fails closed for a %s book",
    (lifecycle) => {
      const decision = governor.evaluateOpening({
        ...safeInput(),
        books: [{ ...safeInput().books[0]!, lifecycle }],
      });
      expect(decision.allowed).toBe(false);
      expect(decision.diagnostics.join(",")).toContain(lifecycle);
    },
  );

  it("kills expired, divergent, disconnected, and over-limit openings", () => {
    const decision = governor.evaluateOpening({
      ...safeInput(),
      nowEpochMs: 2_000n,
      residualExposure: 11n,
      cancelLatencyMs: 1_001n,
      heartbeatAgeMs: 5_001n,
      localVenueStateDiverged: true,
    });
    expect(decision.diagnostics).toEqual(
      expect.arrayContaining([
        "CERTIFICATE_EXPIRED",
        "RESIDUAL_EXPOSURE_LIMIT",
        "CANCEL_LATENCY_KILL",
        "HEARTBEAT_KILL",
        "LOCAL_VENUE_DIVERGENCE_KILL",
      ]),
    );
  });
});
