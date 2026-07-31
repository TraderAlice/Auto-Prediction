import type { VenueCapitalProjection } from "@pmh/capital";
import type { BookProjection } from "@pmh/market-state";
import type { ArbitrageCertificate } from "@pmh/opportunity";

export type RiskPolicy = Readonly<{
  liveExecutionEnabled: false;
  maxCapitalByVenue: ReadonlyMap<string, bigint>;
  maxUnresolvedCapital: bigint;
  maxResidualExposure: bigint;
  maxCancelLatencyMs: bigint;
  maxHeartbeatAgeMs: bigint;
}>;

export type OpeningRiskInput = Readonly<{
  mode: "SHADOW" | "LIVE";
  nowEpochMs: bigint;
  certificate: ArbitrageCertificate;
  books: readonly BookProjection[];
  capital: readonly VenueCapitalProjection[];
  residualExposure: bigint;
  cancelLatencyMs: bigint;
  heartbeatAgeMs: bigint;
  localVenueStateDiverged: boolean;
}>;

export type RiskDecision = Readonly<{
  allowed: boolean;
  mode: "SHADOW";
  diagnostics: readonly string[];
}>;

const VALID_BOOK_STATES = new Set(["SNAPSHOT_VALID", "APPLYING_DELTAS"]);

export class RiskGovernor {
  readonly #policy: RiskPolicy;

  public constructor(policy: RiskPolicy) {
    if (
      policy.maxUnresolvedCapital < 0n ||
      policy.maxResidualExposure < 0n ||
      policy.maxCancelLatencyMs < 0n ||
      policy.maxHeartbeatAgeMs < 0n
    ) {
      throw new Error("risk limits must be non-negative");
    }
    for (const limit of policy.maxCapitalByVenue.values()) {
      if (limit < 0n) {
        throw new Error("venue capital limits must be non-negative");
      }
    }
    this.#policy = policy;
  }

  public evaluateOpening(input: OpeningRiskInput): RiskDecision {
    const diagnostics: string[] = [];
    if (input.mode === "LIVE") {
      diagnostics.push("LIVE_EXECUTION_DISABLED");
    }
    if (input.nowEpochMs >= input.certificate.expiresAtEpochMs) {
      diagnostics.push("CERTIFICATE_EXPIRED");
    }
    for (const book of input.books) {
      if (!VALID_BOOK_STATES.has(book.lifecycle)) {
        diagnostics.push(`BOOK_${book.instrumentId}_${book.lifecycle}`);
      }
    }
    if (input.residualExposure > this.#policy.maxResidualExposure) {
      diagnostics.push("RESIDUAL_EXPOSURE_LIMIT");
    }
    if (input.cancelLatencyMs > this.#policy.maxCancelLatencyMs) {
      diagnostics.push("CANCEL_LATENCY_KILL");
    }
    if (input.heartbeatAgeMs > this.#policy.maxHeartbeatAgeMs) {
      diagnostics.push("HEARTBEAT_KILL");
    }
    if (input.localVenueStateDiverged) {
      diagnostics.push("LOCAL_VENUE_DIVERGENCE_KILL");
    }

    const capitalByVenue = new Map(
      input.capital.map((projection) => [projection.venueId, projection]),
    );
    const unresolved = input.capital.reduce(
      (total, projection) => total + projection.unresolved,
      0n,
    );
    if (unresolved > this.#policy.maxUnresolvedCapital) {
      diagnostics.push("UNRESOLVED_CAPITAL_LIMIT");
    }
    for (const [venueId, certificateRequirement] of Object.entries(
      input.certificate.capitalRequiredByVenue,
    )) {
      const projection = capitalByVenue.get(venueId);
      const currentAtRisk =
        projection === undefined
          ? 0n
          : projection.reserved +
            projection.deployed +
            projection.unresolved;
      const limit = this.#policy.maxCapitalByVenue.get(venueId);
      if (
        limit === undefined ||
        currentAtRisk + certificateRequirement > limit
      ) {
        diagnostics.push(`VENUE_CAPITAL_LIMIT_${venueId}`);
      }
    }
    return Object.freeze({
      allowed: diagnostics.length === 0,
      mode: "SHADOW",
      diagnostics: Object.freeze(diagnostics),
    });
  }
}
