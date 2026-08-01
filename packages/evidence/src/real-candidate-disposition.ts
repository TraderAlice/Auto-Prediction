import { hashCanonical, parseFixed, type Hash } from "@pmh/domain";
import type { VerifiedRawFixture } from "./raw-fixture.js";
import {
  buildRealCandidateDepthEvidence,
  type RealCandidateDepthEvidence,
  type RealCandidateDepthInput,
} from "./real-candidate-depth.js";

const FEE_PERCENT_SCALE = 100n;

export type RealCandidateDispositionEvidence = Readonly<{
  schemaVersion: "pmh.real-candidate-disposition.v1";
  campaignId: "architecture-qualification";
  checkpointId: "three-venue-real-candidate-disposition";
  status: "REJECTED";
  classification: "REJECTED_ECONOMICS";
  scope: "BOUND_BOOK_SNAPSHOT_ONLY";
  depthArtifactHash: Hash;
  claimIdentity: Hash;
  canonicalTitle: string;
  screenQuantity: string;
  quantityScale: string;
  grossFloorUpperBoundBeforeFees: string;
  postFeeFloorUpperBound: string;
  strictlyPositivePostFeeFloorPossible: false;
  feeEvidence: Readonly<{
    venueId: "limitless";
    routeLeg: "SELL_YES_TAKER";
    sourceFixtureHash: Hash;
    sourceReceivedAt: string;
    protocolIdentity: string;
    minimumSellTakerFeeBps: string;
    maximumSellTakerFeeBps: string;
    makerRebateApplicable: false;
    exactFeeAmountBound: false;
  }>;
  decisionRule: "REJECT_WHEN_GROSS_FLOOR_IS_NOT_STRICTLY_POSITIVE";
  rejectionReasons: readonly Readonly<{
    code:
      | "GROSS_FLOOR_NOT_STRICTLY_POSITIVE"
      | "NON_NEGATIVE_TAKER_FEE_CANNOT_IMPROVE_FLOOR";
    detail: string;
  }>[];
  decisionDoesNotRequire: readonly [
    "EXACT_DYNAMIC_FEE_AMOUNT",
    "LIMITLESS_BOOK_GENERATION",
    "VALUE_MOVING_ROUTE_QUALIFICATION",
    "INDEPENDENT_EQUIVALENCE_REVIEW",
    "EXACT_ARBITRAGE_VERIFICATION",
  ];
  terminalForSnapshot: true;
  rescreenRequiredOnBookChange: true;
  stages: readonly Readonly<{
    stage:
      | "QUANTITY_BOUND_ECONOMICS"
      | "TAKER_FEE_POSTURE"
      | "STRICT_POSITIVE_FLOOR"
      | "INDEPENDENT_REVIEW"
      | "EXACT_VERIFICATION"
      | "SNAPSHOT_DISPOSITION";
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

export type RealCandidateDispositionInput = RealCandidateDepthInput &
  Readonly<{
    limitlessFees: VerifiedRawFixture;
  }>;

function feeDocumentText(fixture: VerifiedRawFixture): string {
  if (
    fixture.metadata.venue !== "limitless" ||
    fixture.metadata.name !== "limitless-fees" ||
    fixture.metadata.contentType.toLowerCase().startsWith("text/markdown") ===
      false
  ) {
    throw new Error("Limitless fee document fixture binding is invalid");
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(fixture.bytes);
}

function parseSellTakerFeeRange(document: string): {
  minimumBps: bigint;
  maximumBps: bigint;
} {
  if (
    !document.includes("**Fees only apply to takers**") ||
    !document.includes("**Market orders (takers)** | Fees apply")
  ) {
    throw new Error("Limitless fee document no longer binds taker applicability");
  }
  const match =
    /\| \*\*Sell\*\* \| (\d+(?:\.\d+)?)% – (\d+(?:\.\d+)?)% \|/.exec(
      document,
    );
  if (match === null) {
    throw new Error("Limitless fee document no longer binds the sell fee range");
  }
  const minimumBps = parseFixed(match[1] ?? "", FEE_PERCENT_SCALE);
  const maximumBps = parseFixed(match[2] ?? "", FEE_PERCENT_SCALE);
  if (
    minimumBps < 0n ||
    maximumBps < minimumBps ||
    maximumBps > 10_000n
  ) {
    throw new Error("Limitless sell taker fee range is invalid");
  }
  return { minimumBps, maximumBps };
}

export function buildRealCandidateDispositionEvidence(
  input: RealCandidateDispositionInput,
): RealCandidateDispositionEvidence {
  const depth: RealCandidateDepthEvidence =
    buildRealCandidateDepthEvidence(input);
  const limitlessLeg = depth.legs.find(
    (leg) => leg.venueId === "limitless",
  );
  if (
    limitlessLeg?.route !== "SIMULATED_COMPLETE_SET_AND_SELL_YES" ||
    limitlessLeg.feePosture !==
      "VENUE_REPORTS_ENABLED_DYNAMIC_SCHEDULE_UNBOUND"
  ) {
    throw new Error("depth evidence does not bind the Limitless taker route");
  }
  const grossFloor = BigInt(depth.grossFloorBeforeFees);
  if (grossFloor > 0n) {
    throw new Error(
      "a strictly positive gross floor cannot receive an economic rejection",
    );
  }
  const feeRange = parseSellTakerFeeRange(
    feeDocumentText(input.limitlessFees),
  );
  const feeEvidence = Object.freeze({
    venueId: "limitless" as const,
    routeLeg: "SELL_YES_TAKER" as const,
    sourceFixtureHash: input.limitlessFees.rawHash,
    sourceReceivedAt: input.limitlessFees.metadata.fetchedAt,
    protocolIdentity: input.limitlessFees.metadata.protocolVersion,
    minimumSellTakerFeeBps: feeRange.minimumBps.toString(),
    maximumSellTakerFeeBps: feeRange.maximumBps.toString(),
    makerRebateApplicable: false as const,
    exactFeeAmountBound: false as const,
  });
  const rejectionReasons = Object.freeze([
    Object.freeze({
      code: "GROSS_FLOOR_NOT_STRICTLY_POSITIVE" as const,
      detail:
        "The quantity-bound complete-payout route has no strictly positive floor before fees.",
    }),
    Object.freeze({
      code: "NON_NEGATIVE_TAKER_FEE_CANNOT_IMPROVE_FLOOR" as const,
      detail:
        "The official Limitless sell-taker fee range is non-negative, so an exact fee can only preserve or reduce the gross floor.",
    }),
  ]);
  const decisionDoesNotRequire = [
    "EXACT_DYNAMIC_FEE_AMOUNT",
    "LIMITLESS_BOOK_GENERATION",
    "VALUE_MOVING_ROUTE_QUALIFICATION",
    "INDEPENDENT_EQUIVALENCE_REVIEW",
    "EXACT_ARBITRAGE_VERIFICATION",
  ] as const;
  const stages = Object.freeze([
    Object.freeze({
      stage: "QUANTITY_BOUND_ECONOMICS" as const,
      status: "PASS" as const,
      detail: "Five shares are bound to both route legs and consume the full payout.",
      evidenceHashes: Object.freeze([depth.artifactHash]),
    }),
    Object.freeze({
      stage: "TAKER_FEE_POSTURE" as const,
      status: "PASS" as const,
      detail: `${feeRange.minimumBps}–${feeRange.maximumBps} bps official sell-taker fee range; no maker rebate applies.`,
      evidenceHashes: Object.freeze([input.limitlessFees.rawHash]),
    }),
    Object.freeze({
      stage: "STRICT_POSITIVE_FLOOR" as const,
      status: "REJECTED" as const,
      detail: "The post-fee floor upper bound is 0; strict positivity is impossible for this snapshot.",
      evidenceHashes: Object.freeze([
        depth.artifactHash,
        input.limitlessFees.rawHash,
      ]),
    }),
    Object.freeze({
      stage: "INDEPENDENT_REVIEW" as const,
      status: "NOT_RUN" as const,
      detail: "Review is unnecessary after deterministic economic rejection.",
      evidenceHashes: Object.freeze([depth.preflightArtifactHash]),
    }),
    Object.freeze({
      stage: "EXACT_VERIFICATION" as const,
      status: "NOT_RUN" as const,
      detail: "The arbitrage verifier accepts only candidates with a strictly positive precondition.",
      evidenceHashes: Object.freeze([depth.artifactHash]),
    }),
    Object.freeze({
      stage: "SNAPSHOT_DISPOSITION" as const,
      status: "REJECTED" as const,
      detail: "Current book identities are terminally rejected; changed books require a new screen.",
      evidenceHashes: Object.freeze([depth.artifactHash]),
    }),
  ]);
  const body = {
    schemaVersion: "pmh.real-candidate-disposition.v1" as const,
    campaignId: "architecture-qualification" as const,
    checkpointId: "three-venue-real-candidate-disposition" as const,
    status: "REJECTED" as const,
    classification: "REJECTED_ECONOMICS" as const,
    scope: "BOUND_BOOK_SNAPSHOT_ONLY" as const,
    depthArtifactHash: depth.artifactHash,
    claimIdentity: depth.claimIdentity,
    canonicalTitle: depth.canonicalTitle,
    screenQuantity: depth.screenQuantity,
    quantityScale: depth.quantityScale,
    grossFloorUpperBoundBeforeFees: depth.grossFloorBeforeFees,
    postFeeFloorUpperBound: depth.grossFloorBeforeFees,
    strictlyPositivePostFeeFloorPossible: false as const,
    feeEvidence,
    decisionRule:
      "REJECT_WHEN_GROSS_FLOOR_IS_NOT_STRICTLY_POSITIVE" as const,
    rejectionReasons,
    decisionDoesNotRequire,
    terminalForSnapshot: true as const,
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
