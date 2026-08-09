import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertMarketCorpusSnapshot,
  buildDiscoveryEvidenceLocator,
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
  const protocolIdentity = hashCanonical({ protocol: venueId });
  const evidenceLocator = buildDiscoveryEvidenceLocator({
    venueId,
    protocolIdentity,
    role: "CONTRACT_RULE_DOCUMENT",
    url: `https://rules.example/${venueId}/${listingRef.split(":").at(-1)}.html`,
  });
  if (evidenceLocator === null) throw new Error("missing test evidence locator");
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
    evidenceLocators: [evidenceLocator],
    outcomes: [
      { label: "Yes", indicativePrice: "0.40" },
      { label: "No", indicativePrice: "0.60" },
    ],
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T00:00:00.000Z",
    sourceRawHash: hashCanonical({ venueId }),
    protocolIdentity,
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
    const withoutLocators = snapshot.listings.map((item) => {
      const { evidenceLocators: _evidenceLocators, ...rest } = item;
      return rest;
    });
    expect(buildMarketCorpusSnapshot({
      sourceSetIdentity: snapshot.sourceSetIdentity,
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: withoutLocators,
    }).snapshotIdentity).not.toBe(snapshot.snapshotIdentity);
    expect(assertMarketCorpusSnapshot(JSON.parse(JSON.stringify(snapshot))))
      .toEqual(snapshot);
  });

  it("rejects contradictory retained rules completeness metadata", () => {
    const malformed = {
      ...snapshot.listings[0]!,
      rulesTextPosture: "COMPLETE" as const,
      rulesTextSourceCharacterCount: snapshot.listings[0]!.rulesText!.length + 1,
    };
    expect(() => buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ malformed: true }),
      eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: [malformed],
    })).toThrow("rules evidence");
  });

  it("fails closed when a locator no longer matches its bound venue and protocol", () => {
    const first = snapshot.listings[0]!;
    const tampered = {
      ...first,
      evidenceLocators: first.evidenceLocators?.map((locator) => ({
        ...locator,
        url: "https://substituted.example/rules.html",
      })),
    };
    expect(() => buildMarketCorpusSnapshot({
      sourceSetIdentity: snapshot.sourceSetIdentity,
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: [tampered, snapshot.listings[1]!],
    })).toThrow(/evidence locators/);
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
      const indexed = index.trim().split("\n").map((line) =>
        JSON.parse(line) as { listingRef: string; path: string }
      );
      const entry = indexed.find((item) => item.listingRef === "venue-a:pizza-video");
      expect(entry).toBeDefined();
      const file = JSON.parse(
        await readFile(`${root}/${entry?.path}`, "utf8"),
      ) as DiscoveryCatalogListing;
      expect(file.evidenceLocators).toEqual(
        snapshot.listings.find((item) => item.listingRef === entry?.listingRef)
          ?.evidenceLocators,
      );
    } finally {
      const { rm } = await import("node:fs/promises");
      await rm(root, { recursive: true, force: true });
      await expect(access(root)).rejects.toThrow();
    }
  });
});
