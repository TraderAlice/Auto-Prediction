import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hashCanonical, type Hash } from "@pmh/domain";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCatalogRuleEvidenceClaim,
  buildContractSemanticContinuity,
  buildEvidenceEnrichedSemanticScope,
  buildEvidenceRequirements,
  buildMarketCorpusSnapshot,
  buildProposalEvidenceBundle,
  buildRuleEvidenceAgentTask,
  buildRuleEvidenceAgentTaskPayload,
  AgentExecutionRegistry,
  CatalogObservationDesk,
  catalogObservationSources,
  emptyAgentExecutionSnapshot,
  RuleEvidenceAgentToolHost,
  validateRuleEvidenceTextInput,
  type CatalogFetchLike,
  type CatalogRuleEvidenceClaimRecord,
  type DiscoveryCatalogListing,
  type EvidenceRequirementDraft,
  type MarketRelationProposal,
  type RuleEvidenceInterpreterEngine,
  type AgentExecutionStore,
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
    let additiveWrites = 0;
    const emptySnapshot = emptyAgentExecutionSnapshot();
    const store: AgentExecutionStore = {
      agentExecutionStorage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 62,
        idempotencyKey: "recordId",
      },
      loadAgentExecutionSnapshot: () => emptySnapshot,
      saveAgentExecutionBatch: () => {
        throw new Error("incremental reconciliation used the full-ledger write path");
      },
      saveAgentTaskAdditions: (tasks) => {
        additiveWrites += 1;
        expect(tasks).toEqual([task]);
      },
    };
    const registry = new AgentExecutionRegistry(store);
    expect(registry.reconcileRuleEvidenceTasks([input])).toEqual([task]);
    expect(registry.reconcileRuleEvidenceTasks([input])).toEqual([task]);
    expect(additiveWrites).toBe(1);

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

  it("keeps one semantic task across quote observations and rejects contract drift", async () => {
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "gemini-predictions",
    );
    if (source === undefined) throw new Error("missing Gemini source");
    let receivedAt = Date.parse("2026-08-13T03:20:00.000Z");
    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: geminiFetcher(),
      now: () => receivedAt,
    });
    await desk.refresh();
    const prior = desk.corpus().listings[0]!;
    const peer = {
      ...prior,
      listingRef: `${prior.listingRef}:peer`,
      venueInstrumentId: `${prior.venueInstrumentId}:peer`,
    };
    const requirement = requirementFor(prior, peer);
    receivedAt += 60_000;
    await desk.refresh();
    const current = desk.corpus().listings[0]!;
    const evidence = desk.materializeContractTextEvidence(current.listingRef);
    const firstContinuity = buildContractSemanticContinuity({
      priorListing: prior,
      priorSemanticSourceArtifactId: hashCanonical({ bundle: "prior" }),
      currentListing: current,
      currentCatalogTextEvidence: evidence,
    });
    const firstInput = {
      requirement,
      catalogTextEvidence: evidence,
      semanticContinuity: firstContinuity,
    } as const;
    const firstTask = buildRuleEvidenceAgentTask(firstInput);
    expect(buildRuleEvidenceAgentTaskPayload(firstInput)).toMatchObject({
      claim: requirement.claim,
      satisfyingObservation: requirement.satisfyingObservation,
      contradictingObservation: requirement.contradictingObservation,
      contractSemanticIdentity: firstContinuity.contractSemanticIdentity,
    });
    expect(firstTask.taskPayloadHash).toBe(
      hashCanonical(buildRuleEvidenceAgentTaskPayload(firstInput)),
    );
    expect(firstTask).toMatchObject({
      protocol: "RULE_EVIDENCE_TASK_V3",
      inputArtifacts: [
        { kind: "CATALOG_CONTRACT_TEXT_FIELD" },
        { kind: "CONTRACT_SEMANTICS" },
        { kind: "EVIDENCE_REQUIREMENT" },
      ],
    });

    receivedAt += 60_000;
    await desk.refresh();
    const successor = desk.corpus().listings[0]!;
    const successorEvidence = desk.materializeContractTextEvidence(successor.listingRef);
    const successorContinuity = buildContractSemanticContinuity({
      priorListing: prior,
      priorSemanticSourceArtifactId: hashCanonical({ bundle: "prior" }),
      currentListing: successor,
      currentCatalogTextEvidence: successorEvidence,
    });
    expect(successorContinuity.continuityId).not.toBe(firstContinuity.continuityId);
    expect(buildRuleEvidenceAgentTask({
      requirement,
      catalogTextEvidence: successorEvidence,
      semanticContinuity: successorContinuity,
    }).taskId).toBe(firstTask.taskId);
    expect(() => buildContractSemanticContinuity({
      priorListing: prior,
      priorSemanticSourceArtifactId: hashCanonical({ bundle: "prior" }),
      currentListing: { ...successor, rulesText: `${successor.rulesText} changed` },
      currentCatalogTextEvidence: successorEvidence,
    })).toThrow(/not continuous/);
  });

  it("resolves citations against catalog text and persists a v3 claim separately", async () => {
    const path = await databasePath();
    const store = new SqliteOperationalStore(path);
    const source = catalogObservationSources.find(
      (candidate) => candidate.venueId === "gemini-predictions",
    );
    if (source === undefined) throw new Error("missing Gemini source");
    let observedAt = Date.parse("2026-08-13T03:10:00.000Z");
    const desk = new CatalogObservationDesk({
      sources: [source],
      fetcher: geminiFetcher(),
      store,
      contractTextStore: store,
      now: () => observedAt,
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
    observedAt += 60_000;
    await desk.refresh();
    const currentListing = desk.corpus().listings.find((item) =>
      item.listingRef === listing.listingRef
    )!;
    const currentEvidence = desk.materializeContractTextEvidence(listing.listingRef);
    const continuity = store.saveContractSemanticContinuity(
      buildContractSemanticContinuity({
        priorListing: listing,
        priorSemanticSourceArtifactId: bundle.bundleId,
        currentListing,
        currentCatalogTextEvidence: currentEvidence,
      }),
    );
    const continuityValidated = validateRuleEvidenceTextInput({
      requirement: validated.requirement,
      catalogTextEvidence: currentEvidence,
      semanticContinuity: continuity,
    });
    const continuityClaim = buildCatalogRuleEvidenceClaim({
      validated: continuityValidated,
      model: engine.model,
      engine,
      completedAt: "2026-08-13T03:12:00.000Z",
      result,
    });
    expect(continuityClaim).toMatchObject({
      schemaVersion: "pmh.rule-evidence-claim.v4",
      continuityId: continuity.continuityId,
      contractSemanticIdentity: continuity.contractSemanticIdentity,
      sourceArtifactId: currentEvidence.artifactId,
    });
    const continuityRecord: CatalogRuleEvidenceClaimRecord = {
      interpretationId: continuityClaim.claimId,
      requirementId: continuityClaim.requirementId,
      proposalId: continuityClaim.proposalId,
      sourceKind: continuityClaim.sourceKind,
      sourceArtifactId: continuityClaim.sourceArtifactId,
      textArtifactId: continuityClaim.textArtifactId,
      interpreterIdentity: continuityClaim.interpreter.identity,
      model: continuityClaim.interpreter.model,
      status: "PASS",
      startedAt: "2026-08-13T03:11:30.000Z",
      completedAt: continuityClaim.completedAt,
      diagnostic: null,
      claim: continuityClaim,
    };
    expect(store.saveCatalogRuleEvidenceClaimRecord(continuityRecord, 10))
      .toEqual(continuityRecord);
    store.close();
    const restored = new SqliteOperationalStore(path);
    expect(restored.loadCatalogRuleEvidenceClaimRecords(10)).toEqual([
      continuityRecord,
      record,
    ]);

    const task = buildRuleEvidenceAgentTask({
      requirement: validated.requirement,
      catalogTextEvidence: evidence,
    });
    restored.saveAgentTaskAdditions([task]);
    restored.saveAgentTaskAdditions([task]);
    expect(restored.loadAgentExecutionSnapshot().tasks).toContainEqual(task);
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
