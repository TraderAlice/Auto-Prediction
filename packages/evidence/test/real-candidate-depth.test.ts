import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashBytes } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildRealCandidateDepthEvidence,
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
  const [polymarket, opinion, limitless, polymarketBook, limitlessBook] =
    await Promise.all([
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
    ]);
  return { polymarket, opinion, limitless, polymarketBook, limitlessBook };
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

describe("real candidate depth evidence", () => {
  it("binds five shares to exact book depth and stops at zero gross edge", async () => {
    const evidence = buildRealCandidateDepthEvidence(await inputs());
    expect(evidence).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      priceScale: "100000000",
      quantityScale: "100000000",
      screenQuantity: "500000000",
      quantityBound: true,
      certificateGrade: false,
      totalCostBeforeFees: "500000000",
      grossFloorBeforeFees: "0",
      grossEdgeBpsBeforeFees: "0",
      feeAdjustedFloor: null,
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(evidence.legs).toEqual([
      expect.objectContaining({
        venueId: "polymarket-global",
        outcome: "YES",
        route: "DIRECT_BUY",
        levelsConsumed: 1,
        marginalPrice: "7000000",
        effectiveCost: "35000000",
      }),
      expect.objectContaining({
        venueId: "limitless",
        outcome: "NO",
        route: "SIMULATED_COMPLETE_SET_AND_SELL_YES",
        levelsConsumed: 1,
        marginalPrice: "7000000",
        collateralIn: "500000000",
        proceeds: "35000000",
        effectiveCost: "465000000",
      }),
    ]);
    expect(evidence.blockers.map((blocker) => blocker.code)).toEqual([
      "NON_POSITIVE_DEPTH_BOUND_FLOOR",
      "FEE_SCHEDULE_INCOMPLETE",
      "LIMITLESS_ROUTE_UNQUALIFIED",
      "LIMITLESS_BOOK_GENERATION_UNAVAILABLE",
      "INDEPENDENT_REVIEW_AUTHORITY_ABSENT",
    ]);
  });

  it("matches the checked-in immutable depth artifact", async () => {
    const artifactPath = resolve(
      repositoryRoot,
      "projects/campaigns/architecture-qualification/real-candidate-depth.v1.json",
    );
    const expected = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(buildRealCandidateDepthEvidence(await inputs())).toEqual(expected);
  });

  it("rejects a book for a substituted Polymarket instrument", async () => {
    const original = await inputs();
    const polymarketBook = rewriteFixture(original.polymarketBook, (source) =>
      source.replace(
        '"asset_id":"59252515735652674747158950210016502214756531287333895140318848923768750410355"',
        '"asset_id":"1"',
      ),
    );
    expect(() =>
      buildRealCandidateDepthEvidence({ ...original, polymarketBook }),
    ).toThrow(/exact YES instrument/);
  });

  it("rejects depth prices beyond the fixed-point precision", async () => {
    const original = await inputs();
    const limitlessBook = rewriteFixture(original.limitlessBook, (source) =>
      source.replace('"price":0.07', '"price":0.070000001'),
    );
    expect(() =>
      buildRealCandidateDepthEvidence({ ...original, limitlessBook }),
    ).toThrow(/decimal has 9 places/);
  });
});
