import { hashCanonical } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  AgentCredentialBroker,
  buildAgentRun,
  buildAgentRuntimeDefinition,
  buildAgentTask,
  buildCredentialBinding,
  buildExecutionProfile,
  buildMarketCorpusSnapshot,
  buildMarketOntologyNormalizationTaskPayload,
  buildMarketOntologySnapshot,
  buildModelProfile,
  EnvironmentCredentialResolver,
  executePreparedAgentRun,
  InProcessAgentRuntimeAdapter,
  MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL,
  MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL_V2,
  MARKET_ONTOLOGY_NORMALIZATION_TASK_PROTOCOL,
  MarketOntologyAgentToolHost,
  materializeOntologySearchIssueRevisions,
  SqliteOperationalStore,
  worldStateMechanismRouteFamilyIdentity,
  type AgentRuntimeSession,
  type DiscoveryCatalogListing,
} from "../src/index.js";

const NOW = "2026-08-12T08:00:00.000Z";
const NEXT = "2026-08-12T08:00:01.000Z";
const LATER = "2026-08-12T08:00:02.000Z";

function listing(listingRef: string, title: string): DiscoveryCatalogListing {
  const venueId = listingRef.split(":")[0]!;
  return Object.freeze({
    listingRef,
    venueId,
    venueInstrumentId: listingRef.split(":")[1]!,
    title,
    description: `Venue description for ${title}`,
    status: "OPEN",
    mechanism: "CENTRALIZED_ORDER_BOOK",
    closesAt: "2028-12-31T00:00:00.000Z",
    rulesText: "Resolves from the named official source.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "400000000000000000" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "600000000000000000" }),
    ]),
    priceScale: "1000000000000000000",
    quantityScale: "1000000000000000000",
    minPriceTick: "1",
    sourceKind: "LIVE_OBSERVATION",
    sourceReceivedAt: NOW,
    sourceRawHash: hashCanonical({ listingRef, title }),
    protocolIdentity: `protocol:${venueId}:v1`,
  });
}

function fixture() {
  const corpus = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ source: "ontology-agent-test" }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings: [
      listing("venue-a:kelly-crime", "Will Mark Kelly be charged with a federal crime in 2026?"),
      listing("venue-b:kelly-nominee", "Will Mark Kelly win the 2028 Democratic presidential nomination?"),
      listing("venue-c:other", "Will Alice win the 2028 election?"),
    ],
  });
  const ontology = buildMarketOntologySnapshot(corpus);
  const trailhead = ontology.trailheads.find((item) =>
    item.listingRefs.includes("venue-a:kelly-crime") &&
    item.listingRefs.includes("venue-b:kelly-nominee")
  )!;
  const payload = buildMarketOntologyNormalizationTaskPayload({
    ontology,
    corpus,
    trailheadIds: [trailhead.trailheadId],
  });
  const task = buildAgentTask({
    kind: "ONTOLOGY_NORMALIZATION",
    protocol: MARKET_ONTOLOGY_NORMALIZATION_TASK_PROTOCOL,
    inputArtifacts: [{
      kind: "MARKET_ONTOLOGY",
      artifactId: ontology.ontologyIdentity,
      artifactHash: ontology.ontologyIdentity,
    }],
    taskPayload: payload,
    requestedEffectProtocol: MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL,
    provenanceRef: `ontology:${trailhead.trailheadId}`,
    priority: 50,
    createdAt: NOW,
  });
  const runtime = buildAgentRuntimeDefinition({ kind: "HARNESS_IN_PROCESS", version: "test-v1" });
  const credential = buildCredentialBinding({
    kind: "DEEPSEEK_API_KEY",
    logicalAccountRef: "deepseek-api-key:test",
    resolverKind: "ENVIRONMENT",
    resolverRef: "env:DEEPSEEK_API_KEY",
  });
  const model = buildModelProfile({
    profileKey: "ontology-test-model",
    revision: 1,
    accessDriver: "DEEPSEEK_OPENAI_COMPATIBLE",
    model: "deepseek-v4-flash",
    configuration: {
      schemaVersion: "pmh.deepseek-flash-model-configuration.v1",
      thinking: { mode: "enabled" },
      responseStorage: false,
    },
    createdAt: NOW,
  });
  const profile = buildExecutionProfile({
    profileKey: "ontology-test-execution",
    revision: 1,
    runtimeDefinition: runtime,
    credentialBinding: credential,
    modelProfile: model,
    toolProtocol: MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL,
    runBudget: {
      maximumModelInvocations: 4,
      maximumToolCalls: 8,
      maximumWallClockMs: 300_000,
      maximumInputTokens: "10000",
      maximumOutputTokens: "2000",
    },
    createdAt: NOW,
  });
  const run = buildAgentRun({
    task,
    executionProfile: profile,
    runOrdinal: 1,
    authorization: {
      kind: "MANUAL",
      authorizationRef: "operator:test",
      authorizedAt: NOW,
    },
    createdAt: NOW,
  });
  const host = new MarketOntologyAgentToolHost(ontology, corpus, payload);
  return { corpus, ontology, trailhead, payload, task, runtime, credential, model, profile, run, host };
}

describe("market ontology Agent tools", () => {
  it("exposes exact assigned evidence and retains proposals as non-authoritative effects", async () => {
    const work = fixture();
    const context = {
      run: work.run,
      task: work.task,
      executionProfile: work.profile,
      callId: "call:proposal:1",
      toolName: "propose_world_proposition",
      input: {
        label: "Mark Kelly wins the 2028 Democratic presidential nomination",
        subjectLabels: ["Mark Kelly"],
        predicate: "wins a party presidential nomination",
        timeScope: "2028 Democratic nomination cycle",
        parameters: ["Democratic Party", "presidential nominee"],
        ambiguityNotes: ["The crime market concerns a different event and time window."],
        falsifiers: ["The listing refers to a different Mark Kelly."],
        listingRefs: ["venue-b:kelly-nominee"],
        rationale: "Bind the candidate-specific proposition without equating it to the crime contract.",
      },
    } as const;
    const evidence = await work.host.execute({
      ...context,
      callId: "call:read:1",
      toolName: "read_ontology_trailhead_evidence",
      input: { trailheadId: work.trailhead.trailheadId },
    });
    expect(evidence).toMatchObject({
      status: "ACCEPTED",
      output: {
        contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
        authority: "EVIDENCE_INSPECTION_ONLY",
      },
    });

    await expect(work.host.execute(context)).resolves.toMatchObject({
      status: "ACCEPTED",
      output: { reviewStatus: "UNREVIEWED" },
    });
    expect(work.host.proposals()).toHaveLength(1);
    expect(work.host.proposals()[0]).toMatchObject({
      kind: "WORLD_PROPOSITION",
      ontologyIdentity: work.ontology.ontologyIdentity,
      sourceSnapshotIdentity: work.corpus.snapshotIdentity,
      sourceAgentRunId: work.run.runId,
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(work.host.proposals()[0]?.listingBindings[0]).toMatchObject({
      listingRef: "venue-b:kelly-nominee",
      worldFacetId: expect.stringMatching(/^sha256:/u),
      settlementFacetId: expect.stringMatching(/^sha256:/u),
      tradedFacetId: expect.stringMatching(/^sha256:/u),
    });
  });

  it("rejects evidence refs outside the assigned trailhead", async () => {
    const work = fixture();
    await expect(work.host.execute({
      run: work.run,
      task: work.task,
      executionProfile: work.profile,
      callId: "call:alias:1",
      toolName: "propose_entity_alias",
      input: {
        canonicalLabel: "Alice",
        aliases: ["Alice"],
        ambiguityNotes: [],
        listingRefs: ["venue-c:other"],
        rationale: "Out of scope on purpose.",
      },
    })).rejects.toThrow(
      /listingRefs must use assigned evidence only; received 1 outside assignment/iu,
    );
    expect(work.host.proposals()).toHaveLength(0);
  });

  it("declares validator bounds and repairs a rejected result inside one Agent thread", async () => {
    const work = fixture();
    const revision = materializeOntologySearchIssueRevisions({
      corpus: work.corpus,
      ontology: work.ontology,
      proposals: [],
    }).find((item) => item.trailheadIds.includes(work.trailhead.trailheadId))!;
    if (revision.schemaVersion !== "pmh.ontology-search-issue-revision.v3") {
      throw new Error("test requires the successor issue revision");
    }
    const profile = buildExecutionProfile({
      profileKey: "ontology-repair-congruence-test",
      revision: 1,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      toolProtocol: MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL_V2,
      runBudget: work.profile.runBudget,
      createdAt: NOW,
    });
    const run = buildAgentRun({
      task: revision.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:repair-congruence-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const host = MarketOntologyAgentToolHost.fromIssueRevision(
      revision.taskContract,
      revision.taskPayload,
      undefined,
      undefined,
      undefined,
      revision.revisionId,
    );
    const counterexampleSchema = host.manifest(MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL_V2)
      .find((item) => item.name === "record_ontology_counterexample")!
      .inputSchema as {
        properties: { listingRefs: Record<string, unknown> };
      };
    expect(counterexampleSchema.properties.listingRefs).toMatchObject({
      type: "array",
      minItems: 2,
      maxItems: 16,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 500,
        enum: ["venue-a:kelly-crime", "venue-b:kelly-nominee"],
      },
    });

    let turn = 0;
    const session: AgentRuntimeSession = {
      advance: async (results) => {
        turn += 1;
        if (turn === 1) return {
          invocation: {
            status: "SUCCEEDED" as const,
            startedAt: NOW,
            completedAt: NEXT,
            inputTokens: "100",
            outputTokens: "20",
            reasoningTokens: "5",
            failureCategory: null,
          },
          toolCalls: [{
            callId: "call:repair:rejected",
            toolName: "record_ontology_counterexample",
            input: {
              rejectedClaim: "The two contracts are equivalent.",
              reason: "They concern different predicates.",
              searchSignals: ["Mark Kelly"],
              listingRefs: ["venue-a:kelly-crime"],
              rationale: "Deliberately exercise first-party count rejection.",
            },
          }],
          completed: false,
          finalArtifact: null,
        };
        expect(results).toEqual([expect.objectContaining({
          status: "REJECTED",
          output: {
            diagnostic: "listingRefs must contain 2..16 items; received 1",
          },
        })]);
        return {
          invocation: {
            status: "SUCCEEDED" as const,
            startedAt: NEXT,
            completedAt: LATER,
            inputTokens: "120",
            outputTokens: "30",
            reasoningTokens: "8",
            failureCategory: null,
          },
          toolCalls: [{
            callId: "call:repair:accepted",
            toolName: "record_ontology_counterexample",
            input: {
              rejectedClaim: "The two contracts are equivalent.",
              reason: "They concern distinct predicates and time windows.",
              searchSignals: ["Mark Kelly"],
              listingRefs: ["venue-a:kelly-crime", "venue-b:kelly-nominee"],
              rationale: "Correct the exact item-count violation without widening scope.",
            },
          }],
          completed: false,
          finalArtifact: null,
        };
      },
    };
    const result = await executePreparedAgentRun({
      run,
      task: revision.task,
      taskPayload: revision.taskContract,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      executionProfile: profile,
      adapter: new InProcessAgentRuntimeAdapter(async () => session),
      credentialBroker: new AgentCredentialBroker([
        new EnvironmentCredentialResolver({ DEEPSEEK_API_KEY: "test-secret" }),
      ]),
      toolHost: host,
      now: () => Date.parse("2026-08-12T08:00:03.000Z"),
    });
    expect(result.run.status).toBe("SUCCEEDED");
    expect(result.toolEffects.map((item) => [item.status, item.diagnostic])).toEqual([
      ["REJECTED", "listingRefs must contain 2..16 items; received 1"],
      ["ACCEPTED", null],
    ]);
    expect(result.modelInvocations.map((item) => item.purpose)).toEqual([
      "PRIMARY_REASONING",
      "RESULT_REPAIR",
    ]);
    expect(host.proposals()).toHaveLength(1);
  });

  it("replays an assigned tool host from its durable payload after the corpus rotates", async () => {
    const work = fixture();
    const replayed = MarketOntologyAgentToolHost.fromTaskPayload(work.payload);
    const evidence = await replayed.execute({
      run: work.run,
      task: work.task,
      executionProfile: work.profile,
      callId: "call:durable-replay:1",
      toolName: "read_ontology_trailhead_evidence",
      input: { trailheadId: work.trailhead.trailheadId },
    });

    expect(evidence).toEqual(await work.host.execute({
      run: work.run,
      task: work.task,
      executionProfile: work.profile,
      callId: "call:current-corpus:1",
      toolName: "read_ontology_trailhead_evidence",
      input: { trailheadId: work.trailhead.trailheadId },
    }));
  });

  it("binds a stable issue task to the selected revision's exact evidence", async () => {
    const work = fixture();
    const revision = materializeOntologySearchIssueRevisions({
      corpus: work.corpus,
      ontology: work.ontology,
      proposals: [],
    }).find((item) => item.trailheadIds.includes(work.trailhead.trailheadId))!;
    if (revision.schemaVersion !== "pmh.ontology-search-issue-revision.v3") {
      throw new Error("test requires the successor issue revision");
    }
    const profile = buildExecutionProfile({
      profileKey: "ontology-successor-test-execution",
      revision: 1,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      toolProtocol: MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL_V2,
      runBudget: work.profile.runBudget,
      createdAt: NOW,
    });
    const run = buildAgentRun({
      task: revision.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:issue-revision-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const host = MarketOntologyAgentToolHost.fromIssueRevision(
      revision.taskContract,
      revision.taskPayload,
      undefined,
      undefined,
      undefined,
      revision.revisionId,
    );

    await expect(host.execute({
      run,
      task: revision.task,
      executionProfile: profile,
      callId: "call:issue-revision:1",
      toolName: "propose_world_proposition",
      input: {
        label: "Mark Kelly wins the 2028 Democratic presidential nomination",
        subjectLabels: ["Mark Kelly"],
        predicate: "wins a party presidential nomination",
        timeScope: "2028",
        parameters: ["Democratic Party"],
        ambiguityNotes: [],
        falsifiers: ["The listing names another candidate."],
        listingRefs: ["venue-b:kelly-nominee"],
        rationale: "The stable task resolves its exact current input through the revision.",
      },
    })).resolves.toMatchObject({ status: "ACCEPTED" });
    expect(host.proposals()[0]).toMatchObject({
      ontologyIdentity: revision.ontologyIdentity,
      sourceSnapshotIdentity: revision.sourceSnapshotIdentity,
      sourceTrailheadIds: expect.arrayContaining([work.trailhead.trailheadId]),
    });

    const legacyBoundHost = MarketOntologyAgentToolHost.fromTaskPayload(revision.taskPayload);
    await expect(legacyBoundHost.execute({
      run,
      task: revision.task,
      executionProfile: profile,
      callId: "call:wrong-payload-binding",
      toolName: "propose_world_proposition",
      input: {
        label: "Wrong identity binding",
        subjectLabels: ["Mark Kelly"],
        predicate: "invalid binding",
        timeScope: null,
        parameters: [],
        ambiguityNotes: [],
        falsifiers: ["Task hash differs."],
        listingRefs: ["venue-b:kelly-nominee"],
        rationale: "A stable contract task cannot be executed as a legacy payload-bound task.",
      },
    })).rejects.toThrow(/task lineage/iu);
  });

  it("runs through the provider-neutral long-loop adapter as tool effects", async () => {
    const work = fixture();
    let turn = 0;
    const session: AgentRuntimeSession = {
      advance: async (results) => {
        turn += 1;
        if (turn === 1) return {
          invocation: {
            status: "SUCCEEDED" as const,
            startedAt: NOW,
            completedAt: NEXT,
            inputTokens: "120",
            outputTokens: "40",
            reasoningTokens: "10",
            failureCategory: null,
          },
          toolCalls: [{
            callId: "call:counterexample:1",
            toolName: "record_ontology_counterexample",
            input: {
              rejectedClaim: "The two Mark Kelly contracts are equivalent.",
              reason: "They concern distinct predicates and time windows.",
              searchSignals: ["Mark Kelly", "federal crime", "nomination"],
              listingRefs: ["venue-a:kelly-crime", "venue-b:kelly-nominee"],
              rationale: "Retain this as negative evidence while preserving the related-entity trailhead.",
            },
          }],
          completed: false,
          finalArtifact: null,
        };
        expect(results).toHaveLength(1);
        expect(results[0]?.status).toBe("ACCEPTED");
        return {
          invocation: {
            status: "SUCCEEDED" as const,
            startedAt: NEXT,
            completedAt: LATER,
            inputTokens: "80",
            outputTokens: "20",
            reasoningTokens: "5",
            failureCategory: null,
          },
          toolCalls: [],
          completed: true,
          finalArtifact: { retainedProposalIds: work.host.proposals().map((item) => item.proposalId) },
        };
      },
    };
    const result = await executePreparedAgentRun({
      run: work.run,
      task: work.task,
      taskPayload: work.payload,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      executionProfile: work.profile,
      adapter: new InProcessAgentRuntimeAdapter(async () => session),
      credentialBroker: new AgentCredentialBroker([
        new EnvironmentCredentialResolver({ DEEPSEEK_API_KEY: "test-secret" }),
      ]),
      toolHost: work.host,
      now: () => Date.parse("2026-08-12T08:00:03.000Z"),
    });

    expect(result.run.status).toBe("SUCCEEDED");
    expect(result.modelInvocations).toHaveLength(1);
    expect(result.toolEffects).toHaveLength(1);
    expect(result.toolEffects[0]).toMatchObject({
      toolProtocol: MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL,
      toolName: "record_ontology_counterexample",
      status: "ACCEPTED",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      externalWriteAuthority: false,
      valueMovingAuthority: false,
    });
    expect(work.host.proposals()[0]).toMatchObject({
      kind: "COUNTEREXAMPLE",
      reviewStatus: "UNREVIEWED",
    });
  });

  it("persists accepted proposal content with Agent-run and evidence lineage", async () => {
    const work = fixture();
    const store = new SqliteOperationalStore(":memory:");
    store.saveAgentExecutionBatch({
      runtimeDefinitions: [work.runtime],
      credentialBindings: [work.credential],
      modelProfiles: [work.model],
      executionProfiles: [work.profile],
      tasks: [work.task],
      runs: [work.run],
    });
    await work.host.execute({
      run: work.run,
      task: work.task,
      executionProfile: work.profile,
      callId: "call:alias:persist",
      toolName: "propose_entity_alias",
      input: {
        canonicalLabel: "Mark Kelly",
        aliases: ["Mark Kelly", "Sen. Mark Kelly"],
        ambiguityNotes: ["Confirm that both contracts reference the Arizona senator."],
        listingRefs: ["venue-a:kelly-crime", "venue-b:kelly-nominee"],
        rationale: "The exact titles share the complete person name.",
      },
    });
    const proposal = work.host.proposals()[0]!;

    expect(store.saveMarketOntologyAgentProposals([proposal])).toEqual([proposal]);
    expect(store.saveMarketOntologyAgentProposals([proposal])).toEqual([proposal]);
    expect(store.loadMarketOntologyAgentProposals(10)).toEqual([proposal]);
    expect(store.marketOntologyAgentProposalStorage).toMatchObject({
      durable: false,
      schemaVersion: 63,
      idempotencyKey: "proposalId",
    });
    store.close();
  });

  it("authors, admits, inspects, and falsifies world-state mechanism memory through v2 tools", async () => {
    const work = fixture();
    const revision = materializeOntologySearchIssueRevisions({
      corpus: work.corpus,
      ontology: work.ontology,
      proposals: [],
    }).find((item) => {
      const refs = new Set(item.taskPayload.listingEvidence
        .map((evidence) => evidence.listingRef));
      return refs.has("venue-a:kelly-crime") && refs.has("venue-b:kelly-nominee");
    })!;
    expect(revision.schemaVersion).toBe("pmh.ontology-search-issue-revision.v3");
    if (revision.schemaVersion !== "pmh.ontology-search-issue-revision.v3") {
      throw new Error("test requires the world-state mechanism issue protocol");
    }
    const profile = buildExecutionProfile({
      profileKey: "ontology-mechanism-test-execution",
      revision: 1,
      runtimeDefinition: work.runtime,
      credentialBinding: work.credential,
      modelProfile: work.model,
      toolProtocol: MARKET_ONTOLOGY_AGENT_TOOL_PROTOCOL_V2,
      runBudget: {
        maximumModelInvocations: 4,
        maximumToolCalls: 12,
        maximumWallClockMs: 300_000,
        maximumInputTokens: "10000",
        maximumOutputTokens: "4000",
      },
      createdAt: NOW,
    });
    const run = buildAgentRun({
      task: revision.task,
      executionProfile: profile,
      runOrdinal: 1,
      authorization: {
        kind: "MANUAL",
        authorizationRef: "operator:world-state-mechanism-tool-test",
        authorizedAt: NOW,
      },
      createdAt: NOW,
    });
    const host = MarketOntologyAgentToolHost.fromIssueRevision(
      revision.taskContract,
      revision.taskPayload,
      undefined,
      undefined,
      undefined,
      revision.revisionId,
    );
    const context = {
      run,
      task: revision.task,
      executionProfile: profile,
    } as const;
    await expect(host.execute({
      ...context,
      callId: "call:mechanism:1",
      toolName: "propose_world_state_mechanism",
      input: {
        subjectLabel: "Mark Kelly",
        subjectAliases: ["Mark Kelly"],
        subjectAmbiguityNotes: ["The evidence must refer to the Arizona senator."],
        trigger: {
          predicateLabel: "is charged with a federal crime in 2026",
          searchSignals: ["charged"],
          influence: "MAY_DEGRADE_STATE",
          listingRefs: ["venue-a:kelly-crime"],
        },
        state: {
          dimension: "LEGAL_ELIGIBILITY",
          label: "eligible and viable for a party presidential nomination",
        },
        dependent: {
          predicateLabel: "wins the 2028 Democratic presidential nomination",
          searchSignals: ["nomination"],
          requirement: "STATE_INFLUENCES_LIKELIHOOD",
          listingRefs: ["venue-b:kelly-nominee"],
        },
        temporalPosture: "TRIGGER_PRECEDES_DEPENDENT",
        counterScenarios: [
          "A charge may be dismissed or may not make the candidate legally ineligible.",
        ],
        rationale: "The legal event may alter later candidacy viability without logically deciding it.",
      },
    })).resolves.toMatchObject({
      status: "ACCEPTED",
      output: {
        classification: "NOVEL_MECHANISM_FAMILY",
        authority: "WORLD_STATE_SEARCH_ROUTING_PROPOSAL_ONLY",
      },
    });
    const proposal = host.mechanismProposals()[0]!;
    await expect(host.execute({
      ...context,
      callId: "call:mechanism:duplicate",
      toolName: "propose_world_state_mechanism",
      input: {
        subjectLabel: proposal.subjectLabel,
        subjectAliases: proposal.subjectAliases,
        subjectAmbiguityNotes: proposal.subjectAmbiguityNotes,
        trigger: {
          predicateLabel: proposal.trigger.predicateLabel,
          searchSignals: proposal.trigger.searchSignals,
          influence: proposal.trigger.influence,
          listingRefs: proposal.trigger.evidenceBindings.map((item) => item.listingRef),
        },
        state: proposal.state,
        dependent: {
          predicateLabel: proposal.dependent.predicateLabel,
          searchSignals: proposal.dependent.searchSignals,
          requirement: proposal.dependent.requirement,
          listingRefs: proposal.dependent.evidenceBindings.map((item) => item.listingRef),
        },
        temporalPosture: proposal.temporalPosture,
        counterScenarios: proposal.counterScenarios,
        rationale: "Changing prose alone must not buy another memory slot.",
      },
    })).resolves.toMatchObject({
      status: "REJECTED",
      output: {
        classification: "REDUNDANT_MECHANISM_MEMORY",
        overlappingProposalIds: [proposal.proposalId],
      },
    });
    await expect(host.execute({
      ...context,
      callId: "call:mechanism:coverage",
      toolName: "list_world_state_mechanism_coverage",
      input: {},
    })).resolves.toMatchObject({
      status: "ACCEPTED",
      output: {
        routeCount: 1,
        routes: [{ routeFamilyId: worldStateMechanismRouteFamilyIdentity(proposal) }],
        providerRequests: 0,
        modelInvocations: 0,
      },
    });
    await expect(host.execute({
      ...context,
      callId: "call:mechanism:counterexample",
      toolName: "record_world_state_mechanism_counterexample",
      input: {
        targetRouteFamilyId: worldStateMechanismRouteFamilyIdentity(proposal),
        targetProposalIds: [proposal.proposalId],
        scenario: "A charged candidate remains legally eligible and wins the nomination.",
        reason: "The state is influential rather than a hard prerequisite.",
        searchSignals: ["charged"],
        listingRefs: ["venue-a:kelly-crime"],
      },
    })).resolves.toMatchObject({
      status: "ACCEPTED",
      output: {
        targetRouteFamilyId: worldStateMechanismRouteFamilyIdentity(proposal),
        authority: "WORLD_STATE_MECHANISM_FALSIFICATION_PROPOSAL_ONLY",
      },
    });
    expect(host.mechanismCounterexamples()).toHaveLength(1);
  });
});
