import { hashCanonical, type Hash } from "@pmh/domain";
import {
  captureBookIdentity,
  DeterministicBook,
  evaluateBookIdentity,
  type BookDelta,
  type BookSnapshot,
} from "./book.js";

export type ReplayChaosCaseId =
  | "SEQUENCE_GAP"
  | "STALE_MARK"
  | "RECONNECT_WITHOUT_SNAPSHOT"
  | "OFF_TICK_DELTA"
  | "TICK_SIZE_CHANGE"
  | "GENERATION_MISMATCH";

export type ReplayChaosCaseResult = Readonly<{
  caseId: ReplayChaosCaseId;
  label: string;
  expectedPosture: string;
  observedPosture: string;
  passed: boolean;
  diagnostic: string;
  evidenceHash: Hash;
}>;

export type ReplayChaosReport = Readonly<{
  schemaVersion: "pmh.replay-chaos.v1";
  suiteId: "architecture-qualification/replay-chaos";
  fixtureIdentity: Hash;
  status: "PASS" | "FAIL";
  caseCount: number;
  passCount: number;
  cases: readonly ReplayChaosCaseResult[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  suiteHash: Hash;
}>;

const snapshot: BookSnapshot = {
  kind: "SNAPSHOT",
  sequence: 10n,
  tickSize: 1_000_000n,
  bids: [{ price: 45_000_000n, size: 200_000_000n }],
  asks: [{ price: 47_000_000n, size: 100_000_000n }],
  sourceHash: hashCanonical({ fixture: "replay-chaos-snapshot" }),
};

const delta: BookDelta = {
  kind: "DELTA",
  previousSequence: 10n,
  sequence: 11n,
  changes: [{ side: "BID", price: 46_000_000n, size: 50_000_000n }],
  sourceHash: hashCanonical({ fixture: "replay-chaos-delta" }),
};

const fixtureIdentity = hashCanonical({ snapshot, delta });

function result(input: {
  caseId: ReplayChaosCaseId;
  label: string;
  expectedPosture: string;
  observedPosture: string;
  diagnostic: string;
}): ReplayChaosCaseResult {
  const body = {
    ...input,
    fixtureIdentity,
    passed: input.expectedPosture === input.observedPosture,
  };
  return Object.freeze({
    caseId: input.caseId,
    label: input.label,
    expectedPosture: input.expectedPosture,
    observedPosture: input.observedPosture,
    passed: body.passed,
    diagnostic: input.diagnostic,
    evidenceHash: hashCanonical(body),
  });
}

function sequenceGapCase(): ReplayChaosCaseResult {
  const book = new DeterministicBook("chaos:sequence-gap");
  book.apply(snapshot);
  const projection = book.apply({
    ...delta,
    previousSequence: 11n,
    sequence: 12n,
  });
  return result({
    caseId: "SEQUENCE_GAP",
    label: "Sequence gap fails closed",
    expectedPosture: "GAP_DETECTED",
    observedPosture: projection.lifecycle,
    diagnostic: projection.diagnostic ?? "missing diagnostic",
  });
}

function staleCase(): ReplayChaosCaseResult {
  const book = new DeterministicBook("chaos:stale");
  book.apply(snapshot);
  const projection = book.apply({
    kind: "MARK_STALE",
    reason: "heartbeat deadline exceeded",
  });
  return result({
    caseId: "STALE_MARK",
    label: "Stale mark invalidates book",
    expectedPosture: "STALE",
    observedPosture: projection.lifecycle,
    diagnostic: projection.diagnostic ?? "missing diagnostic",
  });
}

function reconnectCase(): ReplayChaosCaseResult {
  const book = new DeterministicBook("chaos:reconnect");
  book.apply(snapshot);
  book.apply({ kind: "BEGIN_REBUILD", reason: "transport reconnected" });
  const projection = book.apply(delta);
  return result({
    caseId: "RECONNECT_WITHOUT_SNAPSHOT",
    label: "Reconnect delta requires fresh snapshot",
    expectedPosture: "GAP_DETECTED",
    observedPosture: projection.lifecycle,
    diagnostic: projection.diagnostic ?? "missing diagnostic",
  });
}

function offTickCase(): ReplayChaosCaseResult {
  const book = new DeterministicBook("chaos:off-tick");
  book.apply(snapshot);
  const projection = book.apply({
    ...delta,
    changes: [
      { side: "BID", price: 46_000_000n, size: 1n },
      { side: "ASK", price: 47_000_001n, size: 1n },
    ],
  });
  return result({
    caseId: "OFF_TICK_DELTA",
    label: "Off-tick delta rejects atomically",
    expectedPosture: "GAP_DETECTED",
    observedPosture: projection.lifecycle,
    diagnostic: projection.diagnostic ?? "missing diagnostic",
  });
}

function generationMismatchCase(): ReplayChaosCaseResult {
  const book = new DeterministicBook("chaos:generation");
  const binding = captureBookIdentity(book.apply(snapshot));
  book.apply({ kind: "BEGIN_REBUILD", reason: "replacement snapshot" });
  const rebuilt = book.apply({
    ...snapshot,
    sequence: 20n,
    sourceHash: hashCanonical({ fixture: "replay-chaos-rebuilt" }),
  });
  const verdict = evaluateBookIdentity(binding, rebuilt);
  return result({
    caseId: "GENERATION_MISMATCH",
    label: "Rebuild invalidates prior identity",
    expectedPosture: "GENERATION_CHANGED",
    observedPosture: verdict.reason,
    diagnostic: verdict.valid
      ? "stale binding unexpectedly matched"
      : "prior generation binding rejected",
  });
}

function tickSizeChangeCase(): ReplayChaosCaseResult {
  const book = new DeterministicBook("chaos:tick-size");
  const binding = captureBookIdentity(book.apply(snapshot));
  book.apply({ kind: "BEGIN_REBUILD", reason: "venue tick size changed" });
  const rebuilt = book.apply({
    ...snapshot,
    sequence: 20n,
    tickSize: 500_000n,
    sourceHash: hashCanonical({ fixture: "replay-chaos-new-tick" }),
  });
  const verdict = evaluateBookIdentity(binding, rebuilt);
  return result({
    caseId: "TICK_SIZE_CHANGE",
    label: "Tick-size change invalidates prior book",
    expectedPosture: "GENERATION_CHANGED",
    observedPosture: verdict.reason,
    diagnostic: verdict.valid
      ? "old tick binding unexpectedly matched"
      : "prior tick and generation binding rejected",
  });
}

export function runReplayChaosSuite(): ReplayChaosReport {
  const cases = Object.freeze([
    sequenceGapCase(),
    staleCase(),
    reconnectCase(),
    offTickCase(),
    tickSizeChangeCase(),
    generationMismatchCase(),
  ]);
  const passCount = cases.filter((item) => item.passed).length;
  const body = {
    schemaVersion: "pmh.replay-chaos.v1" as const,
    suiteId: "architecture-qualification/replay-chaos" as const,
    fixtureIdentity,
    status: passCount === cases.length ? ("PASS" as const) : ("FAIL" as const),
    caseCount: cases.length,
    passCount,
    cases,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ ...body, suiteHash: hashCanonical(body) });
}
