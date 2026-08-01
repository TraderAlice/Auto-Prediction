import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  buildMarketCorpusSnapshot,
  materializeMarketCorpus,
  searchMarketCorpus,
  type DiscoveryCatalogListing,
} from "../src/index.js";

function listing(
  listingRef: string,
  venueId: string,
  title: string,
  rulesText: string,
): DiscoveryCatalogListing {
  return {
    listingRef,
    venueId,
    venueInstrumentId: listingRef.split(":").at(-1) ?? listingRef,
    title,
    description: "Public prediction market",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-08-31T00:00:00.000Z",
    rulesText,
    outcomes: [
      { label: "Yes", indicativePrice: "0.40" },
      { label: "No", indicativePrice: "0.60" },
    ],
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T00:00:00.000Z",
    sourceRawHash: hashCanonical({ venueId }),
    protocolIdentity: hashCanonical({ protocol: venueId }),
  };
}

describe("Market Corpus", () => {
  const snapshot = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ sources: 2 }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings: [
      listing(
        "venue-b:pizza-stream",
        "venue-b",
        "Will Trump eat pizza on a livestream in August?",
        "Resolves yes for a public livestream during August 2026.",
      ),
      listing(
        "venue-a:pizza-video",
        "venue-a",
        "Trump to eat pizza in a live video before September",
        "Any live video before September 1 qualifies.",
      ),
    ],
  });

  it("freezes a deterministic, sorted, content-addressed corpus", () => {
    expect(snapshot).toMatchObject({
      schemaVersion: "pmh.market-corpus.v1",
      listingCount: 2,
      eligibleSourceCount: 2,
      authority: "OBSERVE_ONLY",
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(snapshot.listings.map((item) => item.listingRef)).toEqual([
      "venue-a:pizza-video",
      "venue-b:pizza-stream",
    ]);
    expect(snapshot.snapshotIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(
      buildMarketCorpusSnapshot({
        sourceSetIdentity: snapshot.sourceSetIdentity,
        eligibleSourceCount: 2,
        excludedSourceCount: 0,
        listings: [...snapshot.listings].reverse(),
      }).snapshotIdentity,
    ).toBe(snapshot.snapshotIdentity);
  });

  it("supports bounded literal and regex searches bound to the snapshot", () => {
    const literal = searchMarketCorpus(snapshot, {
      patterns: ["Trump", "pizza"],
      mode: "ALL",
      fields: ["title"],
    });
    expect(literal).toMatchObject({
      snapshotIdentity: snapshot.snapshotIdentity,
      matchCount: 2,
      truncated: false,
      authority: "SEARCH_EVIDENCE_ONLY",
      executionAuthority: false,
    });
    expect(literal.resultIdentity).toMatch(/^sha256:/u);

    const regex = searchMarketCorpus(snapshot, {
      patterns: ["live(stream| video)"],
      syntax: "REGEX",
      fields: ["title", "rulesText"],
      limit: 1,
    });
    expect(regex.matchCount).toBe(2);
    expect(regex.hits).toHaveLength(1);
    expect(regex.truncated).toBe(true);
    expect(() =>
      searchMarketCorpus(snapshot, { patterns: ["("], syntax: "REGEX" }),
    ).toThrow("invalid regular expression");
  });

  it("materializes stable read-only evidence files for an agent", async () => {
    const root = `${process.cwd()}/.tmp-marketfs-test-${process.pid}`;
    try {
      await materializeMarketCorpus(snapshot, root);
      const readme = await readFile(`${root}/README.md`, "utf8");
      const index = await readFile(`${root}/index/listings.ndjson`, "utf8");
      expect(readme).toContain(snapshot.snapshotIdentity);
      expect(readme).toContain("untrusted data");
      expect(index).toContain("venue-a:pizza-video");
      expect(index).toContain("venues/venue-a/");
    } finally {
      const { rm } = await import("node:fs/promises");
      await rm(root, { recursive: true, force: true });
      await expect(access(root)).rejects.toThrow();
    }
  });
});
