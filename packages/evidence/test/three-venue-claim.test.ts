import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashBytes } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildThreeVenueClaimEvidence,
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

async function build() {
  const [polymarket, opinion, limitless] = await Promise.all([
    fixture("polymarket-global", "polymarket-trump-out-2027"),
    fixture("opinion", "opinion-trump-out-2027"),
    fixture("limitless", "limitless-trump-out-2027"),
  ]);
  return buildThreeVenueClaimEvidence({ polymarket, opinion, limitless });
}

function rewriteFixture(
  fixture: VerifiedRawFixture,
  rewrite: (decoded: Record<string, unknown>) => void,
): VerifiedRawFixture {
  const decoded = JSON.parse(new TextDecoder().decode(fixture.bytes)) as Record<
    string,
    unknown
  >;
  rewrite(decoded);
  const bytes = new TextEncoder().encode(JSON.stringify(decoded));
  return verifyRawFixture(bytes, {
    ...fixture.metadata,
    rawHash: hashBytes(bytes),
    byteLength: String(bytes.byteLength),
  });
}

describe("three-venue exact claim evidence", () => {
  it("binds identical resolution rules without conflating listing windows", async () => {
    const evidence = await build();
    expect(evidence.status).toBe("PASS");
    expect(evidence.mappingGrade).toBe("EXACT");
    expect(evidence.listings.map((listing) => listing.venueId)).toEqual([
      "limitless",
      "opinion",
      "polymarket-global",
    ]);
    expect(new Set(evidence.listings.map((listing) => listing.closesAt)).size).toBe(3);
    expect(new Set(evidence.listings.map((listing) => listing.ruleTextHash)).size).toBe(1);
    expect(evidence.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
  });

  it("matches the checked-in immutable qualification artifact", async () => {
    const artifactPath = resolve(
      repositoryRoot,
      "projects/campaigns/architecture-qualification/three-venue-claim.v1.json",
    );
    const expected = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(await build()).toEqual(expected);
  });

  it("rejects a venue-specific resolution-rule substitution", async () => {
    const [polymarket, originalOpinion, limitless] = await Promise.all([
      fixture("polymarket-global", "polymarket-trump-out-2027"),
      fixture("opinion", "opinion-trump-out-2027"),
      fixture("limitless", "limitless-trump-out-2027"),
    ]);
    const opinion = rewriteFixture(originalOpinion, (decoded) => {
      const result = decoded.result as { data: { rules: string } };
      result.data.rules += " A venue-specific exception applies.";
    });
    expect(() =>
      buildThreeVenueClaimEvidence({ polymarket, opinion, limitless }),
    ).toThrow(/resolution rules are not identical/);
  });

  it("rejects a substituted cross-venue slug", async () => {
    const [polymarket, opinion, originalLimitless] = await Promise.all([
      fixture("polymarket-global", "polymarket-trump-out-2027"),
      fixture("opinion", "opinion-trump-out-2027"),
      fixture("limitless", "limitless-trump-out-2027"),
    ]);
    const limitless = rewriteFixture(originalLimitless, (decoded) => {
      const metadata = decoded.metadata as { externalSlug: string };
      metadata.externalSlug = "substituted-market";
    });
    expect(() =>
      buildThreeVenueClaimEvidence({ polymarket, opinion, limitless }),
    ).toThrow(/external slug/);
  });
});
