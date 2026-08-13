import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashCanonical } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildContractSemanticContinuity,
  CatalogObservationDesk,
  catalogObservationSources,
  type CatalogFetchLike,
  type CatalogObservationSource,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pmh-contract-text-"));
  tempDirectories.push(directory);
  return join(directory, "control-plane.sqlite");
}

function geminiSource(): CatalogObservationSource {
  const source = catalogObservationSources.find(
    (candidate) => candidate.venueId === "gemini-predictions",
  );
  if (source === undefined) throw new Error("missing Gemini catalog source");
  return source;
}

function geminiFixtureFetcher(source = geminiSource()): CatalogFetchLike {
  return async (input, init) => {
    expect(input).toBe(source.sourceUrl);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("omit");
    expect(new Headers(init.headers).has("authorization")).toBe(false);
    const bytes = await readFile(resolve(
      import.meta.dirname,
      "../../../projects/fixtures/gemini-predictions/2026-07-31/gemini-binary-catalog.json",
    ));
    return new Response(new Uint8Array(bytes).buffer, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("catalog contract-text evidence", () => {
  it("persists exact field lineage and protects its raw observation from pruning", async () => {
    const path = await databasePath();
    const source = geminiSource();
    const fetcher = geminiFixtureFetcher(source);
    const store = new SqliteOperationalStore(path);
    let observedAt = Date.parse("2026-08-13T01:00:00.000Z");

    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher,
      store,
      contractTextStore: store,
      retentionLimit: 1,
      now: () => observedAt,
    });
    await desk.refresh();
    const listing = desk.corpus().listings[0];
    if (listing === undefined || listing.rulesText === null) {
      throw new Error("Gemini fixture lost its contract text");
    }
    const artifact = desk.materializeContractTextEvidence(listing.listingRef);
    expect(artifact).toMatchObject({
      listingRef: listing.listingRef,
      venueId: "gemini-predictions",
      field: "rulesText",
      fieldDerivationIdentity: expect.stringMatching(/^sha256:/u),
      text: listing.rulesText,
      sourceRawHash: listing.sourceRawHash,
      receivedAt: listing.sourceReceivedAt,
      authority: "UNTRUSTED_CATALOG_CONTRACT_TEXT_ONLY",
      providerRequestsStartedByDerivation: 0,
      modelInvocationsStartedByDerivation: 0,
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(desk.materializeContractTextEvidence(listing.listingRef)).toEqual(
      artifact,
    );

    observedAt += 60_000;
    await desk.refresh();
    observedAt += 60_000;
    await desk.refresh();
    expect(store.loadCatalogObservations(10).map(
      (observation) => observation.record.observationId,
    )).toContain(artifact.catalogObservationId);
    expect(store.loadCatalogObservations(10)).toHaveLength(2);
    store.close();

    const restored = new SqliteOperationalStore(path);
    expect(restored.catalogContractTextEvidenceStorage).toEqual({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 57,
      idempotencyKey: "artifactId",
    });
    expect(restored.loadCatalogContractTextEvidence(10)).toEqual([artifact]);
    restored.close();

    const database = new DatabaseSync(path);
    database.prepare(
      "UPDATE catalog_contract_text_evidence SET record_json = json_set(record_json, '$.text', 'substituted')",
    ).run();
    database.close();
    const tampered = new SqliteOperationalStore(path);
    expect(() => tampered.loadCatalogContractTextEvidence(10)).toThrow(
      /bounded contract|identity mismatch/,
    );
    tampered.close();
  });

  it("keeps listing fields separate and rejects retained truncation", async () => {
    const base = geminiSource();
    const secondText = "This second contract resolves from a different oracle.";
    const twoListingSource: CatalogObservationSource = {
      ...base,
      normalizerIdentity: hashCanonical({
        test: "two-independent-contract-text-fields",
      }),
      decode: (fixture) => {
        const first = base.decode(fixture)[0];
        if (first === undefined) throw new Error("Gemini fixture is empty");
        return [
          first,
          {
            ...first,
            venueInstrumentId: `${first.venueInstrumentId}-SECOND`,
            title: `${first.title} second fixture`,
            rulesText: secondText,
          },
        ];
      },
    };
    const desk = new CatalogObservationDesk({
      sources: [twoListingSource],
      fetcher: geminiFixtureFetcher(twoListingSource),
      now: () => Date.parse("2026-08-13T02:00:00.000Z"),
    });
    await desk.refresh();
    const listings = desk.corpus().listings;
    expect(listings).toHaveLength(2);
    const firstArtifact = desk.materializeContractTextEvidence(
      listings[0]!.listingRef,
    );
    const secondArtifact = desk.materializeContractTextEvidence(
      listings[1]!.listingRef,
    );
    expect(firstArtifact.text).not.toBe(secondArtifact.text);
    expect(secondArtifact.text).toBe(secondText);
    expect(firstArtifact.normalizedListingHash).not.toBe(
      secondArtifact.normalizedListingHash,
    );

    const truncatedSource: CatalogObservationSource = {
      ...base,
      normalizerIdentity: hashCanonical({ test: "truncated-contract-text" }),
      decode: (fixture) => {
        const first = base.decode(fixture)[0];
        if (first === undefined) throw new Error("Gemini fixture is empty");
        return [{ ...first, rulesText: "x".repeat(20_001) }];
      },
    };
    const truncatedDesk = new CatalogObservationDesk({
      sources: [truncatedSource],
      fetcher: geminiFixtureFetcher(truncatedSource),
      now: () => Date.parse("2026-08-13T02:01:00.000Z"),
    });
    await truncatedDesk.refresh();
    expect(truncatedDesk.corpus().listings[0]).toMatchObject({
      rulesTextPosture: "TRUNCATED",
      rulesTextSourceCharacterCount: 20_001,
    });
    expect(() => truncatedDesk.materializeContractTextEvidence(
      truncatedDesk.corpus().listings[0]!.listingRef,
    )).toThrow(/absent or truncated/);
  });

  it("persists and verifies contract semantic continuity independently", async () => {
    const path = await databasePath();
    const base = geminiSource();
    let observedAt = Date.parse("2026-08-13T02:20:00.000Z");
    const source = base;
    const store = new SqliteOperationalStore(path);
    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: geminiFixtureFetcher(source),
      store,
      contractTextStore: store,
      now: () => observedAt,
    });
    await desk.refresh();
    const prior = desk.corpus().listings[0]!;
    observedAt += 60_000;
    await desk.refresh();
    const current = desk.corpus().listings[0]!;
    const evidence = desk.materializeContractTextEvidence(current.listingRef);
    const continuity = buildContractSemanticContinuity({
      priorListing: prior,
      priorSemanticSourceArtifactId: hashCanonical({ bundle: "semantic-source" }),
      currentListing: current,
      currentCatalogTextEvidence: evidence,
    });
    expect(store.saveContractSemanticContinuity(continuity)).toEqual(continuity);
    expect(store.saveContractSemanticContinuity(continuity)).toEqual(continuity);
    store.close();

    const restored = new SqliteOperationalStore(path);
    expect(restored.contractSemanticContinuityStorage).toEqual({
      mode: "SQLITE_WAL",
      durable: true,
      schemaVersion: 57,
      idempotencyKey: "continuityId",
    });
    expect(restored.loadContractSemanticContinuities(10)).toEqual([continuity]);
    restored.close();

    const database = new DatabaseSync(path);
    database.prepare(
      "UPDATE contract_semantic_continuities SET record_json = json_set(record_json, '$.rulesTextHash', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')",
    ).run();
    database.close();
    const tampered = new SqliteOperationalStore(path);
    expect(() => tampered.loadContractSemanticContinuities(10)).toThrow(
      /continuity|identity mismatch/,
    );
    tampered.close();
  });
});
