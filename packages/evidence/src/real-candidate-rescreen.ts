import { hashCanonical, type Hash } from "@pmh/domain";
import type { VerifiedRawFixture } from "./raw-fixture.js";
import {
  buildRealCandidateDepthEvidence,
  type RealCandidateBookFixtureNames,
  type RealCandidateDepthEvidence,
} from "./real-candidate-depth.js";
import {
  buildRealCandidateDispositionEvidence,
  type RealCandidateDispositionEvidence,
} from "./real-candidate-disposition.js";

type BookBinding = RealCandidateDepthEvidence["books"][number];

export type RealCandidateRescreenEvidence = Readonly<{
  schemaVersion: "pmh.real-candidate-rescreen.v1";
  campaignId: "architecture-qualification";
  checkpointId: "three-venue-real-candidate-rescreen";
  status: "REJECTED";
  classification: "REJECTED_ECONOMICS";
  scope: "CURRENT_BOUND_BOOK_SNAPSHOT_ONLY";
  rescreenSequence: 2;
  claimIdentity: Hash;
  canonicalTitle: string;
  previousSnapshot: Readonly<{
    bookSnapshotIdentity: Hash;
    depthArtifactHash: Hash;
    dispositionArtifactHash: Hash;
    status: "REJECTED";
    books: readonly BookBinding[];
  }>;
  currentSnapshot: Readonly<{
    bookSnapshotIdentity: Hash;
    depthArtifactHash: Hash;
    dispositionArtifactHash: Hash;
    status: "REJECTED";
    books: readonly BookBinding[];
  }>;
  changedBooks: readonly Readonly<{
    venueId: "limitless" | "polymarket-global";
    previousSourceFixtureHash: Hash;
    currentSourceFixtureHash: Hash;
    previousVenueGeneration: string | null;
    currentVenueGeneration: string | null;
    rawContentChanged: boolean;
    venueGenerationChanged: boolean;
  }>[];
  previousDispositionInvalidated: true;
  conclusionRecomputed: true;
  priorDecisionReused: false;
  decisionContinuity: "REJECTED_TO_REJECTED";
  currentScreenQuantity: string;
  quantityScale: string;
  currentGrossFloorUpperBoundBeforeFees: string;
  currentPostFeeFloorUpperBound: string;
  strictlyPositivePostFeeFloorPossible: false;
  currentFeeEvidenceHash: Hash;
  terminalForCurrentSnapshot: true;
  rescreenRequiredOnBookChange: true;
  stages: readonly Readonly<{
    stage:
      | "PRIOR_SNAPSHOT_BINDING"
      | "BOOK_IDENTITY_CHANGE"
      | "PRIOR_DISPOSITION_INVALIDATION"
      | "CURRENT_SNAPSHOT_RECOMPUTATION"
      | "CURRENT_SNAPSHOT_DISPOSITION"
      | "INDEPENDENT_REVIEW"
      | "EXACT_VERIFICATION";
    status: "PASS" | "REJECTED" | "NOT_RUN";
    detail: string;
    evidenceHashes: readonly Hash[];
  }>[];
  independentReviewInvoked: false;
  verifierInvoked: false;
  arbitrageVerified: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: Hash;
}>;

export type RealCandidateRescreenInput = Readonly<{
  polymarket: VerifiedRawFixture;
  opinion: VerifiedRawFixture;
  limitless: VerifiedRawFixture;
  limitlessFees: VerifiedRawFixture;
  previousPolymarketBook: VerifiedRawFixture;
  previousLimitlessBook: VerifiedRawFixture;
  currentPolymarketBook: VerifiedRawFixture;
  currentLimitlessBook: VerifiedRawFixture;
  currentBookFixtureNames: RealCandidateBookFixtureNames;
}>;

function sortedBooks(
  books: RealCandidateDepthEvidence["books"],
): readonly BookBinding[] {
  return Object.freeze(
    [...books].sort((left, right) =>
      left.venueId.localeCompare(right.venueId),
    ),
  );
}

function snapshotIdentity(books: readonly BookBinding[]): Hash {
  return hashCanonical({
    schemaVersion: "pmh.real-candidate-book-snapshot.v1",
    books,
  });
}

function fixtureTime(fixture: VerifiedRawFixture): number {
  return Date.parse(fixture.metadata.fetchedAt);
}

function assertFreshCapture(
  previous: VerifiedRawFixture,
  current: VerifiedRawFixture,
): void {
  if (fixtureTime(current) <= fixtureTime(previous)) {
    throw new Error(`${current.metadata.name} is not newer than the prior capture`);
  }
}

function changedBookBindings(
  previousBooks: readonly BookBinding[],
  currentBooks: readonly BookBinding[],
): RealCandidateRescreenEvidence["changedBooks"] {
  const changes = previousBooks.flatMap((previous) => {
    const current = currentBooks.find(
      (book) => book.venueId === previous.venueId,
    );
    if (current === undefined) {
      throw new Error(`current ${previous.venueId} book binding is missing`);
    }
    const rawContentChanged =
      current.sourceFixtureHash !== previous.sourceFixtureHash;
    const venueGenerationChanged =
      current.venueGeneration !== previous.venueGeneration;
    if (!rawContentChanged && !venueGenerationChanged) return [];
    return [
      Object.freeze({
        venueId: previous.venueId,
        previousSourceFixtureHash: previous.sourceFixtureHash,
        currentSourceFixtureHash: current.sourceFixtureHash,
        previousVenueGeneration: previous.venueGeneration,
        currentVenueGeneration: current.venueGeneration,
        rawContentChanged,
        venueGenerationChanged,
      }),
    ];
  });
  if (changes.length === 0) {
    throw new Error("rescreen requires a changed raw book or venue generation");
  }
  return Object.freeze(changes);
}

export function buildRealCandidateRescreenEvidence(
  input: RealCandidateRescreenInput,
): RealCandidateRescreenEvidence {
  assertFreshCapture(input.previousPolymarketBook, input.currentPolymarketBook);
  assertFreshCapture(input.previousLimitlessBook, input.currentLimitlessBook);

  const shared = {
    polymarket: input.polymarket,
    opinion: input.opinion,
    limitless: input.limitless,
    limitlessFees: input.limitlessFees,
  };
  const previousDisposition: RealCandidateDispositionEvidence =
    buildRealCandidateDispositionEvidence({
      ...shared,
      polymarketBook: input.previousPolymarketBook,
      limitlessBook: input.previousLimitlessBook,
    });
  const currentDepth = buildRealCandidateDepthEvidence({
    ...shared,
    polymarketBook: input.currentPolymarketBook,
    limitlessBook: input.currentLimitlessBook,
    bookFixtureNames: input.currentBookFixtureNames,
  });
  const currentDisposition: RealCandidateDispositionEvidence =
    buildRealCandidateDispositionEvidence({
      ...shared,
      polymarketBook: input.currentPolymarketBook,
      limitlessBook: input.currentLimitlessBook,
      bookFixtureNames: input.currentBookFixtureNames,
    });
  if (
    currentDepth.claimIdentity !== previousDisposition.claimIdentity ||
    currentDisposition.claimIdentity !== previousDisposition.claimIdentity
  ) {
    throw new Error("rescreen claim identity differs from the prior disposition");
  }

  const previousDepth = buildRealCandidateDepthEvidence({
    ...shared,
    polymarketBook: input.previousPolymarketBook,
    limitlessBook: input.previousLimitlessBook,
  });
  const previousBooks = sortedBooks(previousDepth.books);
  const currentBooks = sortedBooks(currentDepth.books);
  const changedBooks = changedBookBindings(previousBooks, currentBooks);
  const previousSnapshot = Object.freeze({
    bookSnapshotIdentity: snapshotIdentity(previousBooks),
    depthArtifactHash: previousDepth.artifactHash,
    dispositionArtifactHash: previousDisposition.artifactHash,
    status: previousDisposition.status,
    books: previousBooks,
  });
  const currentSnapshot = Object.freeze({
    bookSnapshotIdentity: snapshotIdentity(currentBooks),
    depthArtifactHash: currentDepth.artifactHash,
    dispositionArtifactHash: currentDisposition.artifactHash,
    status: currentDisposition.status,
    books: currentBooks,
  });
  if (currentSnapshot.bookSnapshotIdentity === previousSnapshot.bookSnapshotIdentity) {
    throw new Error("rescreen snapshot identity did not change");
  }

  const stages = Object.freeze([
    Object.freeze({
      stage: "PRIOR_SNAPSHOT_BINDING" as const,
      status: "PASS" as const,
      detail: "The prior depth and economic disposition are rebuilt from their immutable source fixtures.",
      evidenceHashes: Object.freeze([
        previousDepth.artifactHash,
        previousDisposition.artifactHash,
      ]),
    }),
    Object.freeze({
      stage: "BOOK_IDENTITY_CHANGE" as const,
      status: "PASS" as const,
      detail: `${changedBooks.length} venue book binding changed and requires a new screen.`,
      evidenceHashes: Object.freeze(
        changedBooks.flatMap((change) => [
          change.previousSourceFixtureHash,
          change.currentSourceFixtureHash,
        ]),
      ),
    }),
    Object.freeze({
      stage: "PRIOR_DISPOSITION_INVALIDATION" as const,
      status: "PASS" as const,
      detail: "The prior rejection is never reused after a bound book identity changes.",
      evidenceHashes: Object.freeze([
        previousDisposition.artifactHash,
        currentDepth.artifactHash,
      ]),
    }),
    Object.freeze({
      stage: "CURRENT_SNAPSHOT_RECOMPUTATION" as const,
      status: "PASS" as const,
      detail: "Quantity-bound route economics and fee monotonicity are recomputed from the fresh books.",
      evidenceHashes: Object.freeze([
        currentDepth.artifactHash,
        currentDisposition.feeEvidence.sourceFixtureHash,
      ]),
    }),
    Object.freeze({
      stage: "CURRENT_SNAPSHOT_DISPOSITION" as const,
      status: "REJECTED" as const,
      detail: "The fresh snapshot independently remains non-positive before non-negative taker fees.",
      evidenceHashes: Object.freeze([currentDisposition.artifactHash]),
    }),
    Object.freeze({
      stage: "INDEPENDENT_REVIEW" as const,
      status: "NOT_RUN" as const,
      detail: "Economic rejection occurs before scarce equivalence-review authority is needed.",
      evidenceHashes: Object.freeze([currentDepth.preflightArtifactHash]),
    }),
    Object.freeze({
      stage: "EXACT_VERIFICATION" as const,
      status: "NOT_RUN" as const,
      detail: "The exact verifier is not invoked for a non-positive candidate.",
      evidenceHashes: Object.freeze([currentDepth.artifactHash]),
    }),
  ]);
  const body = {
    schemaVersion: "pmh.real-candidate-rescreen.v1" as const,
    campaignId: "architecture-qualification" as const,
    checkpointId: "three-venue-real-candidate-rescreen" as const,
    status: "REJECTED" as const,
    classification: "REJECTED_ECONOMICS" as const,
    scope: "CURRENT_BOUND_BOOK_SNAPSHOT_ONLY" as const,
    rescreenSequence: 2 as const,
    claimIdentity: currentDepth.claimIdentity,
    canonicalTitle: currentDepth.canonicalTitle,
    previousSnapshot,
    currentSnapshot,
    changedBooks,
    previousDispositionInvalidated: true as const,
    conclusionRecomputed: true as const,
    priorDecisionReused: false as const,
    decisionContinuity: "REJECTED_TO_REJECTED" as const,
    currentScreenQuantity: currentDepth.screenQuantity,
    quantityScale: currentDepth.quantityScale,
    currentGrossFloorUpperBoundBeforeFees: currentDepth.grossFloorBeforeFees,
    currentPostFeeFloorUpperBound: currentDisposition.postFeeFloorUpperBound,
    strictlyPositivePostFeeFloorPossible: false as const,
    currentFeeEvidenceHash:
      currentDisposition.feeEvidence.sourceFixtureHash,
    terminalForCurrentSnapshot: true as const,
    rescreenRequiredOnBookChange: true as const,
    stages,
    independentReviewInvoked: false as const,
    verifierInvoked: false as const,
    arbitrageVerified: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
