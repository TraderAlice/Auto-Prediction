import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  assertProposalEvidenceBundle,
  buildMarketCorpusSnapshot,
  buildProposalEvidenceBundle,
  createMarketArchaeologistDesk,
  type DiscoveryCatalogListing,
  type PiProcessRequest,
  type PiProcessRunner,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const secret = "test-only-deepseek-key";

const listings: readonly DiscoveryCatalogListing[] = [
  {
    listingRef: "venue-a:august-pizza",
    venueId: "venue-a",
    venueInstrumentId: "august-pizza",
    title: "Trump eats pizza live in August",
    description: "A streamed meal",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "Any public livestream in August counts.",
    outcomes: [{ label: "Yes", indicativePrice: "0.40" }],
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "a" }),
    protocolIdentity: hashCanonical({ protocol: "a" }),
  },
  {
    listingRef: "venue-b:august-pizza-youtube",
    venueId: "venue-b",
    venueInstrumentId: "august-pizza-youtube",
    title: "Trump eats pizza on YouTube Live in August",
    description: "A streamed meal on YouTube",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "Only YouTube Live qualifies.",
    outcomes: [{ label: "Yes", indicativePrice: "0.30" }],
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: "2026-08-01T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "b" }),
    protocolIdentity: hashCanonical({ protocol: "b" }),
  },
];

const snapshot = buildMarketCorpusSnapshot({
  sourceSetIdentity: hashCanonical({ sources: 2 }),
  eligibleSourceCount: 2,
  excludedSourceCount: 0,
  listings,
});

describe("Market Archaeologist", () => {
  it("lets pi recursively inspect an ephemeral full-corpus workspace", async () => {
    let captured: PiProcessRequest | undefined;
    let indexText = "";
    const runner: PiProcessRunner = async (request) => {
      captured = request;
      indexText = await readFile(`${request.cwd}/index/listings.ndjson`, "utf8");
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          summary: "The YouTube-specific claim may imply the broader live claim.",
          proposals: [
            {
              relationKind: "IMPLIES",
              listingRefs: [
                "venue-b:august-pizza-youtube",
                "venue-a:august-pizza",
              ],
              statement: "YouTube Live qualification implies public livestream qualification.",
              rationale: "The second rule is a platform-specific subset of the first.",
              falsifiers: ["The broad venue excludes YouTube streams."],
            },
          ],
          missingEvidence: ["Independent exact rule review is absent."],
        }),
        stderr: "",
        timedOut: false,
        outputLimitExceeded: false,
      };
    };
    const desk = createMarketArchaeologistDesk(
      { DEEPSEEK_API_KEY: secret },
      { command: "/test/pi", runner },
    );
    const invocation = desk.begin(snapshot, "Search for pizza event relations");
    expect(desk.projection().status).toBe("RUNNING");
    const record = await invocation.promise;

    expect(indexText).toContain("venue-b:august-pizza-youtube");
    expect(captured?.args).toContain("read,grep,find,ls");
    expect(captured?.args.at(-1)).toContain("Generate your own aliases");
    expect(captured?.args.at(-1)).toContain(
      "listingRefs must be a JSON array of 2–8 unique exact listingRef strings",
    );
    expect(captured?.environment.DEEPSEEK_API_KEY).toBe(secret);
    await expect(access(captured?.cwd ?? "")).rejects.toThrow();
    expect(record).toMatchObject({
      status: "PASS",
      trigger: "OPERATOR",
      report: {
        task: {
          corpusSnapshotIdentity: snapshot.snapshotIdentity,
          corpusListingCount: 2,
        },
        result: {
          authority: "PROPOSE_ONLY",
          reviewStatus: "UNREVIEWED",
          executionAuthority: false,
          proposals: [
            {
              relationKind: "IMPLIES",
              authority: "PROPOSE_ONLY",
              executionAuthority: false,
            },
          ],
        },
        trace: {
          workspace: "EPHEMERAL_MARKETFS",
          recursiveSearchAvailable: true,
          corpusRemovedAfterRun: true,
        },
      },
    });
    expect(JSON.stringify(record)).not.toContain(secret);
    const bundle = record.report?.result.proposalEvidenceBundles?.[0];
    expect(bundle).toMatchObject({
      proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
      evidenceCorpusSnapshotIdentity: snapshot.snapshotIdentity,
      captureKind: "PROPOSAL_CORPUS",
      authority: "SEMANTIC_REVIEW_EVIDENCE_ONLY",
      executionAuthority: false,
      listingRefs: [
        "venue-b:august-pizza-youtube",
        "venue-a:august-pizza",
      ],
    });
    expect(bundle?.listings.map((listing) => listing.listingRef)).toEqual(
      bundle?.listingRefs,
    );
    expect(desk.projection()).toMatchObject({
      status: "IDLE",
      runCount: 1,
      passCount: 1,
      authority: "PROPOSE_ONLY",
    });
    const replay = desk.begin(snapshot, "Search for pizza event relations");
    expect(replay.idempotentReplay).toBe(true);
    expect((await replay.promise).runId).toBe(record.runId);
  });

  it("content-addresses exact proposal evidence and rejects tampering", () => {
    const proposalBody = {
      relationKind: "IMPLIES" as const,
      listingRefs: [
        "venue-b:august-pizza-youtube",
        "venue-a:august-pizza",
      ],
      statement: "The platform-specific claim may imply the broad claim.",
      rationale: "YouTube is a public livestream platform.",
      falsifiers: ["The broad rule excludes YouTube."],
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      executionAuthority: false as const,
    };
    const proposal = Object.freeze({
      ...proposalBody,
      proposalId: hashCanonical({
        corpusSnapshotIdentity: snapshot.snapshotIdentity,
        ...proposalBody,
      }),
    });
    const bundle = buildProposalEvidenceBundle(proposal, snapshot);
    expect(assertProposalEvidenceBundle(bundle)).toBe(bundle);
    expect(bundle.listingHashes).toEqual(bundle.listings.map(hashCanonical));

    const {
      bundleId: _durableBundleId,
      proposal: _embeddedProposal,
      schemaVersion: _durableSchemaVersion,
      ...legacyFields
    } = bundle;
    const legacyBody = {
      schemaVersion: "pmh.proposal-evidence-bundle.v1" as const,
      ...legacyFields,
    };
    expect(assertProposalEvidenceBundle({
      ...legacyBody,
      bundleId: hashCanonical(legacyBody),
    }).schemaVersion).toBe("pmh.proposal-evidence-bundle.v1");

    const tampered = {
      ...bundle,
      listings: bundle.listings.map((listing, index) =>
        index === 0 ? { ...listing, title: "substituted title" } : listing
      ),
    };
    expect(() => assertProposalEvidenceBundle(tampered)).toThrow(
      /bounded contract|identity mismatch/,
    );

    const { bundleId: _bundleId, ...bundleBody } = bundle;
    const oversizedListings = bundle.listings.map((listing, index) =>
      index === 0 ? { ...listing, title: "x".repeat(512_000) } : listing
    );
    const oversizedBody = {
      ...bundleBody,
      listings: oversizedListings,
      listingHashes: oversizedListings.map(hashCanonical),
    };
    expect(() => assertProposalEvidenceBundle({
      ...oversizedBody,
      bundleId: hashCanonical(oversizedBody),
    })).toThrow(/bounded contract/);
  });

  it("keeps scheduling opt-in and changed-corpus only", () => {
    const disabled = createMarketArchaeologistDesk({ DEEPSEEK_API_KEY: secret });
    expect(disabled.projection().scheduler).toMatchObject({ enabled: false });
    expect(disabled.shouldSchedule(snapshot)).toBe(false);

    const enabled = createMarketArchaeologistDesk({
      DEEPSEEK_API_KEY: secret,
      PMH_ARCHAEOLOGIST_INTERVAL_MS: "60000",
    });
    expect(enabled.projection().scheduler).toMatchObject({
      enabled: true,
      intervalMs: 60_000,
      changedCorpusOnly: true,
    });
    expect(enabled.shouldSchedule(snapshot)).toBe(true);
  });

  it("visibly bounds oversized model prose without dropping grounded proposals", async () => {
    const runner: PiProcessRunner = async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        summary: "summary",
        proposals: [
          {
            relationKind: "IMPLIES",
            listingRefs: [
              "venue-b:august-pizza-youtube",
              "venue-a:august-pizza",
            ],
            statement: "A platform-specific stream implies a public stream.",
            rationale: "Both rules identify the same event with different scope.",
            falsifiers: [`The broad rule excludes the platform. ${"x".repeat(600)}`],
          },
        ],
        missingEvidence: [],
      }),
      stderr: "",
      timedOut: false,
      outputLimitExceeded: false,
    });
    const desk = createMarketArchaeologistDesk(
      { DEEPSEEK_API_KEY: secret },
      { runner },
    );
    const record = await desk.begin(snapshot, "Bound long prose").promise;

    expect(record.status).toBe("PASS");
    expect(record.report?.result.proposals[0]?.falsifiers[0]).toHaveLength(500);
    expect(record.report?.result.proposals[0]?.falsifiers[0]).toMatch(/…$/u);
  });

  it("restores content-verified reports and run idempotency from SQLite", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-archaeologist-store-"));
    const path = join(directory, "control-plane.sqlite");
    const runner: PiProcessRunner = async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        summary: "The platform-specific event may imply the broad event.",
        proposals: [
          {
            relationKind: "IMPLIES",
            listingRefs: [
              "venue-b:august-pizza-youtube",
              "venue-a:august-pizza",
            ],
            statement: "The YouTube event implies the broad live event.",
            rationale: "The named platform is a narrower delivery channel.",
            falsifiers: ["The broad rule excludes YouTube."],
          },
        ],
        missingEvidence: ["Independent exact rule review."],
      }),
      stderr: "",
      timedOut: false,
      outputLimitExceeded: false,
    });
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createMarketArchaeologistDesk(
        { DEEPSEEK_API_KEY: secret },
        { runner, store: firstStore },
      );
      const first = await firstDesk.begin(snapshot, "Durable search").promise;
      expect(first.status).toBe("PASS");
      expect(firstDesk.projection().storage).toMatchObject({
        mode: "SQLITE_WAL",
        durable: true,
        schemaVersion: 13,
        idempotencyKey: "runId",
      });
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const restored = createMarketArchaeologistDesk(
        { DEEPSEEK_API_KEY: secret },
        {
          runner: async () => {
            throw new Error("durable replay must not invoke pi");
          },
          store: secondStore,
        },
      );
      expect(restored.projection()).toMatchObject({
        runCount: 1,
        passCount: 1,
        records: [{ runId: first.runId, status: "PASS" }],
      });
      const replay = restored.begin(snapshot, "Durable search");
      expect(replay.idempotentReplay).toBe(true);
      expect((await replay.promise).runId).toBe(first.runId);
      secondStore.close();

      const tamper = new DatabaseSync(path);
      tamper
        .prepare(
          `UPDATE market_archaeologist_records
           SET record_json = json_set(
             record_json,
             '$.report.result.summary',
             'substituted summary'
           )
           WHERE run_id = ?`,
        )
        .run(first.runId);
      tamper.close();
      const tamperedStore = new SqliteOperationalStore(path);
      expect(() =>
        createMarketArchaeologistDesk(
          { DEEPSEEK_API_KEY: secret },
          { runner, store: tamperedStore },
        ),
      ).toThrow(/report identity mismatch|record identity mismatch/);
      tamperedStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed without a key and rejects out-of-corpus proposals", async () => {
    const missing = createMarketArchaeologistDesk({});
    expect(missing.projection().status).toBe("NEEDS_KEY");
    expect(() => missing.begin(snapshot, "Search")).toThrow("DEEPSEEK_API_KEY");

    const invalid = createMarketArchaeologistDesk(
      { DEEPSEEK_API_KEY: secret },
      {
        runner: async () => ({
          exitCode: 0,
          stdout: JSON.stringify({
            summary: "invalid",
            proposals: [
              {
                relationKind: "EQUIVALENT",
                listingRefs: ["venue-a:august-pizza", "outside:not-present"],
                statement: "invalid",
                rationale: "invalid",
                falsifiers: [],
              },
            ],
            missingEvidence: [],
          }),
          stderr: "",
          timedOut: false,
          outputLimitExceeded: false,
        }),
      },
    );
    const failed = await invalid.begin(snapshot, "Search").promise;
    expect(failed).toMatchObject({
      status: "FAILED",
      report: null,
      diagnostic: "market archaeologist proposal exceeds corpus scope",
    });
  });
});
