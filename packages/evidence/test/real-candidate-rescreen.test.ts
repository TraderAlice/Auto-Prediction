import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashBytes } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildRealCandidateRescreenEvidence,
  loadRawFixture,
  type VerifiedRawFixture,
  verifyRawFixture,
} from "../src/index.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const currentBookFixtureNames = Object.freeze({
  polymarket: "polymarket-trump-out-2027-book-rescreen-1",
  limitless: "limitless-trump-out-2027-book-rescreen-1",
});

async function fixture(
  venue: string,
  date: string,
  name: string,
): Promise<VerifiedRawFixture> {
  const base = resolve(
    repositoryRoot,
    "projects/fixtures",
    venue,
    date,
    name,
  );
  return loadRawFixture(`${base}.json`, `${base}.meta.json`);
}

async function inputs() {
  const [
    polymarket,
    opinion,
    limitless,
    limitlessFees,
    previousPolymarketBook,
    previousLimitlessBook,
    currentPolymarketBook,
    currentLimitlessBook,
  ] = await Promise.all([
    fixture(
      "polymarket-global",
      "2026-07-31",
      "polymarket-trump-out-2027",
    ),
    fixture("opinion", "2026-07-31", "opinion-trump-out-2027"),
    fixture("limitless", "2026-07-31", "limitless-trump-out-2027"),
    fixture("limitless", "2026-08-01", "limitless-fees"),
    fixture(
      "polymarket-global",
      "2026-08-01",
      "polymarket-trump-out-2027-book",
    ),
    fixture(
      "limitless",
      "2026-08-01",
      "limitless-trump-out-2027-book",
    ),
    fixture(
      "polymarket-global",
      "2026-08-01",
      currentBookFixtureNames.polymarket,
    ),
    fixture(
      "limitless",
      "2026-08-01",
      currentBookFixtureNames.limitless,
    ),
  ]);
  return {
    polymarket,
    opinion,
    limitless,
    limitlessFees,
    previousPolymarketBook,
    previousLimitlessBook,
    currentPolymarketBook,
    currentLimitlessBook,
    currentBookFixtureNames,
  };
}

function rewriteFixture(
  fixture: VerifiedRawFixture,
  rewrite: (source: string) => string,
): VerifiedRawFixture {
  const source = new TextDecoder().decode(fixture.bytes);
  const bytes = new TextEncoder().encode(rewrite(source));
  return verifyRawFixture(bytes, {
    ...fixture.metadata,
    rawHash: hashBytes(bytes),
    byteLength: String(bytes.byteLength),
  });
}

function reboundFixture(
  fixture: VerifiedRawFixture,
  name: string,
  fetchedAt: string,
): VerifiedRawFixture {
  return {
    ...fixture,
    metadata: { ...fixture.metadata, name, fetchedAt },
  };
}

describe("real candidate rescreen lineage", () => {
  it("invalidates the prior snapshot and recomputes the same rejection", async () => {
    const evidence = buildRealCandidateRescreenEvidence(await inputs());
    expect(evidence).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      scope: "CURRENT_BOUND_BOOK_SNAPSHOT_ONLY",
      rescreenSequence: 2,
      previousDispositionInvalidated: true,
      conclusionRecomputed: true,
      priorDecisionReused: false,
      decisionContinuity: "REJECTED_TO_REJECTED",
      currentScreenQuantity: "500000000",
      currentGrossFloorUpperBoundBeforeFees: "0",
      currentPostFeeFloorUpperBound: "0",
      strictlyPositivePostFeeFloorPossible: false,
      terminalForCurrentSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(evidence.previousSnapshot.bookSnapshotIdentity).not.toBe(
      evidence.currentSnapshot.bookSnapshotIdentity,
    );
    expect(evidence.previousSnapshot.dispositionArtifactHash).not.toBe(
      evidence.currentSnapshot.dispositionArtifactHash,
    );
    expect(evidence.changedBooks).toEqual([
      expect.objectContaining({
        venueId: "polymarket-global",
        rawContentChanged: true,
        venueGenerationChanged: true,
      }),
    ]);
    expect(evidence.stages.map((stage) => stage.status)).toEqual([
      "PASS",
      "PASS",
      "PASS",
      "PASS",
      "REJECTED",
      "NOT_RUN",
      "NOT_RUN",
    ]);
  });

  it("matches the checked-in immutable rescreen artifact", async () => {
    const artifactPath = resolve(
      repositoryRoot,
      "projects/campaigns/architecture-qualification/real-candidate-rescreen.v1.json",
    );
    const expected = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(buildRealCandidateRescreenEvidence(await inputs())).toEqual(expected);
  });

  it("refuses a rescreen when raw content and venue generations are unchanged", async () => {
    const original = await inputs();
    const currentPolymarketBook = reboundFixture(
      original.previousPolymarketBook,
      currentBookFixtureNames.polymarket,
      "2026-08-01T05:50:59.000Z",
    );
    const currentLimitlessBook = reboundFixture(
      original.previousLimitlessBook,
      currentBookFixtureNames.limitless,
      "2026-08-01T05:50:59.341Z",
    );
    expect(() =>
      buildRealCandidateRescreenEvidence({
        ...original,
        currentPolymarketBook,
        currentLimitlessBook,
      }),
    ).toThrow(/changed raw book or venue generation/);
  });

  it("refuses captures that do not follow the prior snapshot", async () => {
    const original = await inputs();
    const currentPolymarketBook = reboundFixture(
      original.currentPolymarketBook,
      currentBookFixtureNames.polymarket,
      original.previousPolymarketBook.metadata.fetchedAt,
    );
    expect(() =>
      buildRealCandidateRescreenEvidence({
        ...original,
        currentPolymarketBook,
      }),
    ).toThrow(/not newer than the prior capture/);
  });

  it("cannot carry an old rejection onto newly positive gross economics", async () => {
    const original = await inputs();
    const currentLimitlessBook = rewriteFixture(
      original.currentLimitlessBook,
      (source) => source.replace('"price":0.07', '"price":0.08'),
    );
    expect(() =>
      buildRealCandidateRescreenEvidence({
        ...original,
        currentLimitlessBook,
      }),
    ).toThrow(/strictly positive gross floor/);
  });
});
