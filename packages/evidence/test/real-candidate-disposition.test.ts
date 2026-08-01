import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashBytes } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildRealCandidateDispositionEvidence,
  loadRawFixture,
  type VerifiedRawFixture,
  verifyRawFixture,
} from "../src/index.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

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
    polymarketBook,
    limitlessBook,
    limitlessFees,
  ] = await Promise.all([
    fixture(
      "polymarket-global",
      "2026-07-31",
      "polymarket-trump-out-2027",
    ),
    fixture("opinion", "2026-07-31", "opinion-trump-out-2027"),
    fixture("limitless", "2026-07-31", "limitless-trump-out-2027"),
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
    fixture("limitless", "2026-08-01", "limitless-fees"),
  ]);
  return {
    polymarket,
    opinion,
    limitless,
    polymarketBook,
    limitlessBook,
    limitlessFees,
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

describe("real candidate snapshot disposition", () => {
  it("rejects the zero-floor snapshot without invoking review or verification", async () => {
    const evidence = buildRealCandidateDispositionEvidence(await inputs());
    expect(evidence).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      scope: "BOUND_BOOK_SNAPSHOT_ONLY",
      screenQuantity: "500000000",
      grossFloorUpperBoundBeforeFees: "0",
      postFeeFloorUpperBound: "0",
      strictlyPositivePostFeeFloorPossible: false,
      feeEvidence: {
        venueId: "limitless",
        routeLeg: "SELL_YES_TAKER",
        minimumSellTakerFeeBps: "42",
        maximumSellTakerFeeBps: "150",
        makerRebateApplicable: false,
        exactFeeAmountBound: false,
      },
      terminalForSnapshot: true,
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
    expect(evidence.decisionDoesNotRequire).toEqual([
      "EXACT_DYNAMIC_FEE_AMOUNT",
      "LIMITLESS_BOOK_GENERATION",
      "VALUE_MOVING_ROUTE_QUALIFICATION",
      "INDEPENDENT_EQUIVALENCE_REVIEW",
      "EXACT_ARBITRAGE_VERIFICATION",
    ]);
    expect(evidence.stages.at(-1)).toMatchObject({
      stage: "SNAPSHOT_DISPOSITION",
      status: "REJECTED",
    });
  });

  it("matches the checked-in immutable disposition artifact", async () => {
    const artifactPath = resolve(
      repositoryRoot,
      "projects/campaigns/architecture-qualification/real-candidate-disposition.v1.json",
    );
    const expected = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(buildRealCandidateDispositionEvidence(await inputs())).toEqual(
      expected,
    );
  });

  it("rejects a fee document that loses the official sell-taker range", async () => {
    const original = await inputs();
    const limitlessFees = rewriteFixture(original.limitlessFees, (source) =>
      source.replace(
        "| **Sell** | 0.42% – 1.50% |",
        "| **Sell** | undocumented |",
      ),
    );
    expect(() =>
      buildRealCandidateDispositionEvidence({ ...original, limitlessFees }),
    ).toThrow(/sell fee range/);
  });

  it("refuses to reject a snapshot whose gross floor is positive", async () => {
    const original = await inputs();
    const limitlessBook = rewriteFixture(original.limitlessBook, (source) =>
      source.replace('"price":0.07', '"price":0.08'),
    );
    expect(() =>
      buildRealCandidateDispositionEvidence({ ...original, limitlessBook }),
    ).toThrow(/strictly positive gross floor/);
  });
});
