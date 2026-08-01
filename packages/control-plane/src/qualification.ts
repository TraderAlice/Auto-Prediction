import { hashCanonical, type Hash } from "@pmh/domain";
import type { ReplayChaosReport } from "@pmh/market-state";
import type { BookDeskProjection } from "./types.js";

export type CampaignEvidenceAssertion = Readonly<{
  assertionId:
    | "VERIFIED_BOOK_REPLAY"
    | "REPLAY_CHAOS_FAILS_CLOSED"
    | "LIVE_EXECUTION_DISABLED";
  status: "PASS" | "FAIL";
  detail: string;
  evidenceHashes: readonly Hash[];
}>;

export type CampaignEvidenceBundle = Readonly<{
  schemaVersion: "pmh.campaign-evidence.v1";
  campaignId: "architecture-qualification";
  checkpointId: "replay-integrity";
  status: "PASS" | "FAIL";
  sourceArtifacts: readonly Readonly<{
    venueId: string;
    bookId: string;
    lifecycle: string;
    generation: string;
    sequencePolicy: string;
    evidenceHash: Hash;
    stateHash: Hash;
  }>[];
  replayChaosSuiteHash: Hash;
  assertions: readonly CampaignEvidenceAssertion[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
  artifactHash: Hash;
}>;

function isHash(value: string | null): value is Hash {
  return value !== null && /^sha256:[0-9a-f]{64}$/.test(value);
}

const REPLAY_INTEGRITY_CAMPAIGN_VENUES = new Set([
  "gemini-predictions",
  "limitless",
  "polymarket-global",
]);

export function buildCampaignEvidence(
  bookDesk: BookDeskProjection,
  replayChaos: ReplayChaosReport,
): CampaignEvidenceBundle {
  const sourceArtifacts = bookDesk.books
    .filter(
      (book) =>
        REPLAY_INTEGRITY_CAMPAIGN_VENUES.has(book.venueId) &&
        isHash(book.stateHash) &&
        isHash(book.evidenceHash),
    )
    .map((book) => ({
      venueId: book.venueId,
      bookId: book.bookId,
      lifecycle: book.lifecycle,
      generation: book.generation,
      sequencePolicy: book.sequencePolicy,
      evidenceHash: book.evidenceHash as Hash,
      stateHash: book.stateHash as Hash,
    }))
    .sort((left, right) => left.venueId.localeCompare(right.venueId));
  const replayPassed =
    sourceArtifacts.length === 3 &&
    sourceArtifacts.every((book) => book.lifecycle === "SNAPSHOT_VALID");
  const bookEvidenceHashes = sourceArtifacts
    .flatMap((book) => [book.evidenceHash, book.stateHash])
    .sort();
  const assertions: readonly CampaignEvidenceAssertion[] = [
    {
      assertionId: "VERIFIED_BOOK_REPLAY",
      status: replayPassed ? "PASS" : "FAIL",
      detail: `${sourceArtifacts.length}/3 venue books have verified evidence and state identities`,
      evidenceHashes: bookEvidenceHashes,
    },
    {
      assertionId: "REPLAY_CHAOS_FAILS_CLOSED",
      status: replayChaos.status,
      detail: `${replayChaos.passCount}/${replayChaos.caseCount} hazards reached their fail-closed posture`,
      evidenceHashes: [
        replayChaos.suiteHash,
        ...replayChaos.cases.map((item) => item.evidenceHash),
      ],
    },
    {
      assertionId: "LIVE_EXECUTION_DISABLED",
      status: replayChaos.effects.liveExecutionEnabled ? "FAIL" : "PASS",
      detail: "qualification has no external writes, value movement, or live execution",
      evidenceHashes: [replayChaos.suiteHash],
    },
  ];
  const body = {
    schemaVersion: "pmh.campaign-evidence.v1" as const,
    campaignId: "architecture-qualification" as const,
    checkpointId: "replay-integrity" as const,
    status: assertions.every((item) => item.status === "PASS")
      ? ("PASS" as const)
      : ("FAIL" as const),
    sourceArtifacts,
    replayChaosSuiteHash: replayChaos.suiteHash,
    assertions,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}
