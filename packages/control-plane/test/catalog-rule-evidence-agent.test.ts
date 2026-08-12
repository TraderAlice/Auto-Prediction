import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hashCanonical, type Hash } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCatalogRuleEvidenceClaim,
  buildEvidenceEnrichedSemanticScope,
  buildEvidenceRequirements,
  buildMarketCorpusSnapshot,
  buildProposalEvidenceBundle,
  buildRuleEvidenceAgentTask,
  CatalogObservationDesk,
  catalogObservationSources,
  RuleEvidenceAgentToolHost,
  validateRuleEvidenceTextInput,
  type CatalogFetchLike,
  type CatalogRuleEvidenceClaimRecord,
  type DiscoveryCatalogListing,
  type EvidenceRequirementDraft,
  type MarketRelationProposal,
  type RuleEvidenceInterpreterEngine,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pmh-catalog-agent-"));
  tempDirectories.push(directory);
  return join(directory, "control-plane.sqlite");
}

function geminiFetcher(): CatalogFetchLike {
  return async () => {
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

function requirementFor(
  listing: DiscoveryCatalogListing,
  peer: DiscoveryCatalogListing,
  temporalPosture: EvidenceRequirementDraft["temporalPosture"] = "CURRENT",
  proposalId: Hash = hashCanonical({ proposal: "catalog-rule-evidence" }),
) {
  return buildEvidenceRequirements({
    origin: "SEMANTIC_REVIEW",
    proposalId,
    proposalListingRefs: [listing.listingRef, peer.listingRef],
    listings: [listing, peer],
    drafts: [{
      kind: "ORACLE_SOURCE",
      listingRefs: [listing.listingRef],
      claim: "The contract resolves from the named price index.",
      reason: "Oracle identity changes the event meaning.",
      satisfyingObservation: "Official text names the index.",
      contradictingObservation: "Official text names another source.",
      temporalPosture,
    }],
  })[0]!;
}

describe("catalog contract text as provider-neutral Agent work", () => {
  it("creates a v2 Agent task only for an exact current listing observation", async () => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "gemini-predictions",
    );
    if (source === undefined) throw new Error("missing Gemini source");
    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: geminiFetcher(),
      now: () => Date.parse("2026-08-13T03:00:00.000Z"),
    });
    await desk.refresh();
    const listing = desk.corpus().listings[0]!;
    const peer = {
      ...listing,
      listingRef: `${listing.listingRef}:peer`,
      venueInstrumentId: `${listing.venueInstrumentId}:peer`,
    };
    const evidence = desk.materializeContractTextEvidence(listing.listingRef);
    const requirement = requirementFor(listing, peer);
    const input = { requirement, catalogTextEvidence: evidence } as const;
    const validated = validateRuleEvidenceTextInput(input);
    const task = buildRuleEvidenceAgentTask(input);

    expect(task).toMatchObject({
      kind: "RULE_EVIDENCE_CLAIM",
      protocol: "RULE_EVIDENCE_TASK_V2",
      requestedEffectProtocol: "RULE_EVIDENCE_TOOLS_V1",
      authority: {
        modelInvocations: false,
        externalWrites: false,
        semanticDecision: false,
        certificatePublication: false,
        valueMovingActions: false,
      },
    });
    expect(task.inputArtifacts.map((artifact) => artifact.kind)).toEqual([
      "CATALOG_CONTRACT_TEXT",
      "CATALOG_OBSERVATION",
      "EVIDENCE_REQUIREMENT",
    ]);
    expect(validated.source).toMatchObject({
      kind: "CATALOG_CONTRACT_TEXT",
      sourceArtifactId: evidence.artifactId,
      textArtifactId: evidence.textHash,
      listingRef: listing.listingRef,
    });

    expect(() => validateRuleEvidenceTextInput({
      requirement: requirementFor(listing, peer, "HISTORICAL_AT_SOURCE_OBSERVATION"),
      catalogTextEvidence: evidence,
    })).toThrow(/exactly satisfy the current requirement/);
    const changedListing = { ...listing, title: `${listing.title} changed` };
    expect(() => validateRuleEvidenceTextInput({
      requirement: requirementFor(changedListing, peer),
      catalogTextEvidence: evidence,
    })).toThrow(/exactly satisfy the current requirement/);
  });

  it("resolves citations against catalog text and persists a v3 claim separately", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "gemini-predictions",
    );
    if (source === undefined) throw new Error("missing Gemini source");
    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: geminiFetcher(),
      store,
      contractTextStore: store,
      now: () => Date.parse("2026-08-13T03:10:00.000Z"),
    });
    await desk.refresh();
    const listing = desk.corpus().listings[0]!;
    const peer = {
      ...listing,
      listingRef: `${listing.listingRef}:peer`,
      venueInstrumentId: `${listing.venueInstrumentId}:peer`,
    };
    const snapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "catalog-rule-evidence" }),
      eligibleSourceCount: 1,
      excludedSourceCount: 0,
      listings: [listing, peer],
    });
    const proposalBody = Object.freeze({
      relationKind: "MUTUALLY_EXCLUSIVE" as const,
      listingRefs: Object.freeze([listing.listingRef, peer.listingRef]),
      statement: "The two contracts cannot both settle Yes.",
      rationale: "The oracle clause may make their settlement states exclusive.",
      falsifiers: Object.freeze(["Both contracts can settle Yes."]),
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      executionAuthority: false as const,
    });
    const proposal: MarketRelationProposal = Object.freeze({
      ...proposalBody,
      proposalId: hashCanonical({
        corpusSnapshotIdentity: snapshot.snapshotIdentity,
        ...proposalBody,
      }),
    });
    const bundle = buildProposalEvidenceBundle(proposal, snapshot);
    if (bundle.schemaVersion !== "pmh.proposal-evidence-bundle.v2") {
      throw new Error("catalog rule evidence test requires a durable bundle");
    }
    const evidence = desk.materializeContractTextEvidence(listing.listingRef);
    const validated = validateRuleEvidenceTextInput({
      requirement: requirementFor(listing, peer, "CURRENT", proposal.proposalId),
      catalogTextEvidence: evidence,
    });
    const quote = "Outcome verified against the GRR-KAIKO_RFR_BTCUSD_60S index.";
    const start = evidence.text.indexOf(quote);
    expect(start).toBeGreaterThanOrEqual(0);
    const engine: RuleEvidenceInterpreterEngine = {
      provider: "CODEX",
      transport: "AGENT_RUNTIME",
      model: "gpt-5.6-terra",
      reasoningEffort: "high",
      responseStorage: false,
    };
    const result = {
      draft: {
        disposition: "SUPPORTS" as const,
        rationale: "The retained contract field explicitly names the oracle.",
        citations: [{ start, end: start + quote.length, quote }],
        unresolvedEvidence: [],
      },
      trace: {
        searchEffectCount: 1,
        readEffectCount: 1,
        submittedEffectHash: hashCanonical({ effect: "catalog-claim" }),
      },
    };
    const claim = buildCatalogRuleEvidenceClaim({
      validated,
      model: engine.model,
      engine,
      completedAt: "2026-08-13T03:11:00.000Z",
      result,
    });
    const record: CatalogRuleEvidenceClaimRecord = {
      interpretationId: claim.claimId,
      requirementId: claim.requirementId,
      proposalId: claim.proposalId,
      sourceKind: claim.sourceKind,
      sourceArtifactId: claim.sourceArtifactId,
      textArtifactId: claim.textArtifactId,
      interpreterIdentity: claim.interpreter.identity,
      model: claim.interpreter.model,
      status: "PASS",
      startedAt: "2026-08-13T03:10:30.000Z",
      completedAt: claim.completedAt,
      diagnostic: null,
      claim,
    };
    expect(buildEvidenceEnrichedSemanticScope({
      evidenceBundle: bundle,
      claims: [claim],
    })).toMatchObject({
      schemaVersion: "pmh.evidence-enriched-semantic-scope.v2",
      claimBindings: [{
        sourceKind: "CATALOG_CONTRACT_TEXT",
        sourceArtifactId: evidence.artifactId,
        textArtifactId: evidence.textHash,
      }],
    });
    expect(store.saveCatalogRuleEvidenceClaimRecord(record, 10)).toEqual(record);
    store.close();
    const restored = new SqliteOperationalStore(path);
    expect(restored.loadCatalogRuleEvidenceClaimRecords(10)).toEqual([record]);

    const task = buildRuleEvidenceAgentTask({
      requirement: validated.requirement,
      catalogTextEvidence: evidence,
    });
    const host = new RuleEvidenceAgentToolHost((taskId) =>
      taskId === task.taskId ? validated : null
    );
    expect(host.manifest("RULE_EVIDENCE_TOOLS_V1").map((tool) => tool.name))
      .toEqual([
        "search_evidence_text",
        "read_evidence_text",
        "submit_rule_evidence_claim",
      ]);
    restored.close();
  });
});
