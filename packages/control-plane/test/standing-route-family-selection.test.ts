import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildStandingRouteFamilySelectionProjection,
  type StandingOntologyRouteProjection,
  type StandingOntologyRouteValueProjection,
  type StandingRouteSeedOutcomeProjection,
} from "../src/index.js";

const NOW = "2026-08-13T02:00:00.000Z";
const FAMILY_ID = hashCanonical({ family: "fixture" });
const VALUE_ID = hashCanonical({ value: "fixture" });

function fixture(input: Readonly<{
  state?: "QUIESCENT" | "CHANGED" | "BLOCKED_TOO_BROAD";
  sourceCount?: number;
  wakeCount?: number;
  followupRunCount?: number;
  positiveFindingCount?: number;
  semanticReviewPassCount?: number;
  conflictCount?: number;
  cleanSeedCount?: number;
  totalQuietDurationMs?: string;
}> = {}) {
  const state = input.state ?? "QUIESCENT";
  const routes = {
    families: [{
      family: {
        routeFamilyId: FAMILY_ID,
        sourceCount: input.sourceCount ?? 1,
      },
      observation: { state },
    }],
  } as unknown as StandingOntologyRouteProjection;
  const followupRunIds = Array.from({ length: input.followupRunCount ?? 0 }, (_, index) =>
    hashCanonical({ run: index })
  );
  const positiveFindingIds = Array.from({ length: input.positiveFindingCount ?? 0 }, (_, index) =>
    hashCanonical({ finding: index })
  );
  const value = {
    values: [{
      valueId: VALUE_ID,
      routeFamilyId: FAMILY_ID,
      observedWakeCount: input.wakeCount ?? 0,
      followupRunIds,
      positiveFindingIds,
      semanticReviewPassCount: input.semanticReviewPassCount ?? 0,
      probabilityJobIds: [],
      opportunityIds: [],
      totalQuietDurationMs: input.totalQuietDurationMs ?? "0",
    }],
  } as unknown as StandingOntologyRouteValueProjection;
  const conflictOutcomes = Array.from({ length: input.conflictCount ?? 0 }, (_, index) => ({
    outcomeId: hashCanonical({ outcome: index }),
    stage: "CONFLICTING_TERMINAL_EFFECTS",
    retainedRouteFamilyIds: [FAMILY_ID],
  }));
  const cleanOutcomes = Array.from({ length: input.cleanSeedCount ?? 0 }, (_, index) => ({
    outcomeId: hashCanonical({ cleanOutcome: index }),
    stage: "ROUTE_RETAINED",
    retainedRouteFamilyIds: [FAMILY_ID],
  }));
  const outcomes = [...conflictOutcomes, ...cleanOutcomes];
  const seedOutcomes = { outcomes } as unknown as StandingRouteSeedOutcomeProjection;
  return { routes, value, seedOutcomes };
}

describe("standing route family selection", () => {
  it("holds a single-source family with conflicting terminal seed effects", () => {
    const projection = buildStandingRouteFamilySelectionProjection({
      ...fixture({ conflictCount: 1, semanticReviewPassCount: 1 }),
      observedAt: NOW,
    });
    expect(projection).toMatchObject({
      familyCount: 1,
      adoptCount: 0,
      holdCount: 1,
      retireCount: 0,
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      writesStartedByRead: 0,
      automaticMutation: false,
      automaticDispatch: false,
      selections: [{
        recommendation: "HOLD",
        reason: "HOLD_CONFLICTING_SEED",
        seedConflictCount: 1,
        cleanSeedCount: 0,
      }],
    });
  });

  it("allows a later clean seed to resolve historical terminal conflict", () => {
    const projection = buildStandingRouteFamilySelectionProjection({
      ...fixture({ conflictCount: 1, cleanSeedCount: 1, semanticReviewPassCount: 1 }),
      observedAt: NOW,
    });
    expect(projection.selections[0]).toMatchObject({
      recommendation: "ADOPT",
      reason: "ADOPT_DOWNSTREAM_PROGRESS",
      seedConflictCount: 1,
      cleanSeedCount: 1,
    });
  });

  it("adopts only after independently retained downstream progress", () => {
    const projection = buildStandingRouteFamilySelectionProjection({
      ...fixture({ state: "CHANGED", wakeCount: 1, followupRunCount: 1,
        positiveFindingCount: 1, semanticReviewPassCount: 1 }),
      observedAt: NOW,
    });
    expect(projection.selections[0]).toMatchObject({
      recommendation: "ADOPT",
      reason: "ADOPT_DOWNSTREAM_PROGRESS",
      missingObservation: null,
    });
  });

  it("retires after three attempted wakes without a positive finding", () => {
    const projection = buildStandingRouteFamilySelectionProjection({
      ...fixture({ state: "CHANGED", wakeCount: 3, followupRunCount: 3 }),
      observedAt: NOW,
    });
    expect(projection).toMatchObject({
      adoptCount: 0,
      holdCount: 0,
      retireCount: 1,
      selections: [{
        recommendation: "RETIRE",
        reason: "RETIRE_REPEATED_UNPRODUCTIVE_WAKES",
        observedWakeCount: 3,
        attemptedFollowupRunCount: 3,
      }],
    });
  });

  it("holds quiet memory through a named seven-day review horizon", () => {
    const before = buildStandingRouteFamilySelectionProjection({
      ...fixture({ totalQuietDurationMs: String(7 * 24 * 60 * 60 * 1_000 - 1) }),
      observedAt: NOW,
    });
    const after = buildStandingRouteFamilySelectionProjection({
      ...fixture({ totalQuietDurationMs: String(7 * 24 * 60 * 60 * 1_000) }),
      observedAt: NOW,
    });
    expect(before.selections[0]?.reason).toBe("HOLD_AWAITING_FIRST_WAKE");
    expect(after.selections[0]?.reason).toBe("HOLD_QUIET_HORIZON_REACHED");
    expect(after.selections[0]?.recommendation).toBe("HOLD");
  });
});
