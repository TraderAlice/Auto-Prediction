import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashBytes } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildRealCandidatePreflightEvidence,
  loadRawFixture,
  type VerifiedRawFixture,
  verifyRawFixture,
} from "../src/index.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

async function fixture(
  venue: string,
  name: string,
): Promise<VerifiedRawFixture> {
  const base = resolve(
    repositoryRoot,
    "projects/fixtures",
    venue,
    "2026-07-31",
    name,
  );
  return loadRawFixture(`${base}.json`, `${base}.meta.json`);
}

async function inputs() {
  const [polymarket, opinion, limitless] = await Promise.all([
    fixture("polymarket-global", "polymarket-trump-out-2027"),
    fixture("opinion", "opinion-trump-out-2027"),
    fixture("limitless", "limitless-trump-out-2027"),
  ]);
  return { polymarket, opinion, limitless };
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

describe("real candidate preflight evidence", () => {
  it("stops a 55 bps catalog hint when reported buy quotes consume the payout", async () => {
    const evidence = buildRealCandidatePreflightEvidence(await inputs());
    expect(evidence).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      payoutScale: "1000000",
      catalogIndicativeTotalCost: "994500",
      catalogIndicativeGrossFloor: "5500",
      catalogIndicativeGrossEdgeBps: "55",
      venueReportedBuyTotalCost: "1000000",
      venueReportedBuyGrossFloor: "0",
      venueReportedBuyGrossEdgeBps: "0",
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
        catalogIndicativeCost: "65000",
        venueReportedBuyCost: "70000",
      }),
      expect.objectContaining({
        venueId: "limitless",
        outcome: "NO",
        catalogIndicativeCost: "929500",
        venueReportedBuyCost: "930000",
      }),
    ]);
    expect(evidence.blockers.map((blocker) => blocker.code)).toEqual([
      "NON_POSITIVE_REPORTED_BUY_FLOOR",
      "EXECUTABLE_DEPTH_MISSING",
      "FEE_SCHEDULE_INCOMPLETE",
      "INDEPENDENT_REVIEW_AUTHORITY_ABSENT",
    ]);
    expect(evidence.stages.at(-1)).toMatchObject({
      stage: "EXACT_VERIFICATION",
      status: "BLOCKED",
    });
  });

  it("matches the checked-in immutable qualification artifact", async () => {
    const artifactPath = resolve(
      repositoryRoot,
      "projects/campaigns/architecture-qualification/real-candidate-preflight.v1.json",
    );
    const expected = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(buildRealCandidatePreflightEvidence(await inputs())).toEqual(expected);
  });

  it("rejects monetary lexemes that exceed the fixed-point precision", async () => {
    const original = await inputs();
    const limitless = rewriteFixture(original.limitless, (source) =>
      source.replace('"prices":[0.0705,0.9295]', '"prices":[0.0705,0.9295001]'),
    );
    expect(() =>
      buildRealCandidatePreflightEvidence({ ...original, limitless }),
    ).toThrow(/decimal has 7 places/);
  });

  it("rejects a quote fixture that breaks the exact claim mapping", async () => {
    const original = await inputs();
    const polymarket = rewriteFixture(original.polymarket, (source) =>
      source.replace(
        '"question":"Trump out as President before 2027?"',
        '"question":"Substituted claim?"',
      ),
    );
    expect(() =>
      buildRealCandidatePreflightEvidence({ ...original, polymarket }),
    ).toThrow(/claim titles are not identical/);
  });
});
