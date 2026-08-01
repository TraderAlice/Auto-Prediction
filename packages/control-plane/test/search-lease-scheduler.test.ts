import { hashCanonical } from "@pmh/domain";
import { describe, expect, it, vi } from "vitest";
import {
  assertSearchLeaseRecord,
  buildMarketCorpusSnapshot,
  SearchLeaseScheduler,
  SqliteOperationalStore,
  type DiscoveryCatalogContext,
  type DiscoveryRunRecord,
  type DiscoveryTask,
  type OpportunityHypothesis,
} from "../src/index.js";

const receivedAt = "2026-08-01T00:00:00.000Z";

function listing(venueId: string, suffix: string) {
  return Object.freeze({
    listingRef: `${venueId}:${suffix}`,
    venueId,
    venueInstrumentId: suffix,
    title: "Will Trump eat pizza on stream in August?",
    description: "A bounded public event.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "Resolves yes if the named event occurs.",
    outcomes: Object.freeze([
      Object.freeze({ venueOutcomeId: "yes", label: "Yes", indicativePrice: "0.5" }),
      Object.freeze({ venueOutcomeId: "no", label: "No", indicativePrice: "0.5" }),
    ]),
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: receivedAt,
    sourceRawHash: hashCanonical({ venueId, suffix }),
    protocolIdentity: `protocol:${venueId}`,
  });
}

const listings = Object.freeze([
  listing("venue-a", "pizza-a"),
  listing("venue-b", "pizza-b"),
]);

function snapshot(source = "search-lease") {
  return buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ receivedAt, source }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings,
  });
}

function context(
  question: string,
  venueIds: readonly string[],
): DiscoveryCatalogContext {
  const scoped = listings.filter((item) => venueIds.includes(item.venueId));
  const body = Object.freeze({
    schemaVersion: "pmh.discovery-catalog-context.v2" as const,
    source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
    contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
    listings: Object.freeze(scoped),
  });
  expect(question.length).toBeGreaterThan(0);
  return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
}

function hypothesis(task: DiscoveryTask): OpportunityHypothesis {
  return Object.freeze({
    hypothesisId: `hypothesis:${hashCanonical(task.taskId).slice(7, 23)}`,
    workerId: "model:fast",
    thesis: "The two listings may resolve to the same claim.",
    strategyKind: "SAME_CLAIM_CROSS_VENUE" as const,
    venueIds: Object.freeze(["venue-a", "venue-b"]),
    claimSearchTerms: Object.freeze(["Trump", "pizza", "August"]),
    listingRefs: Object.freeze(["venue-a:pizza-a", "venue-b:pizza-b"]),
    confidenceBps: 5_000,
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
  });
}

function runRecord(task: DiscoveryTask): DiscoveryRunRecord {
  const startedAt = "2026-08-01T00:00:01.000Z";
  const completedAt = "2026-08-01T00:00:02.000Z";
  return Object.freeze({
    runId: hashCanonical({ taskId: task.taskId }),
    taskId: task.taskId,
    startedAt,
    completedAt,
    workerIds: Object.freeze(["heuristic:free", "model:fast"]),
    workerReports: Object.freeze([
      Object.freeze({
        workerId: "heuristic:free",
        kind: "HEURISTIC" as const,
        costTier: "FREE" as const,
        status: "PASS" as const,
        startedAt,
        completedAt,
        durationMs: 1_000,
        hypothesisCount: 0,
        diagnostic: null,
      }),
      Object.freeze({
        workerId: "model:fast",
        kind: "MODEL" as const,
        costTier: "LOW" as const,
        status: "PASS" as const,
        startedAt,
        completedAt,
        durationMs: 1_000,
        hypothesisCount: 1,
        diagnostic: null,
      }),
    ]),
    hypotheses: Object.freeze([hypothesis(task)]),
    diagnostics: Object.freeze([]),
    executionAuthority: false as const,
    question: task.question,
    venueIds: task.venueIds,
    catalogContext: task.catalogContext,
    catalogContextIdentity: task.catalogContext?.contextIdentity,
    catalogListingCount: task.catalogContext?.listings.length,
    catalogContextSource: task.catalogContext?.source,
  });
}

describe("AI-native search lease scheduler", () => {
  it("bounds the cheap lane and escalates only a novel grounded multi-venue candidate", async () => {
    const runFast = vi.fn(async (task: DiscoveryTask, budget: number) => {
      expect(budget).toBe(1);
      return runRecord(task);
    });
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: 1 }),
      status: "PASS" as const,
      proposalIds: Object.freeze([hashCanonical({ proposal: 1 })]),
      evidenceGaps: Object.freeze(["Need authoritative void rules."]),
      diagnostic: null,
    }));
    const scheduler = new SearchLeaseScheduler({
      context,
      graphContext: (_snapshot, lens) => {
        const graphIdentity = hashCanonical({ graph: 1 });
        const items = Object.freeze([Object.freeze({
          proposalId: hashCanonical({ proposal: "prior" }),
          relationKind: "EQUIVALENT" as const,
          listingRefs: Object.freeze(["venue-a:pizza-a", "venue-b:pizza-b"]),
          outcomeCodes: Object.freeze(["MISSING_RULE" as const]),
          summary: "A prior relation is missing authoritative void rules.",
        })]);
        return Object.freeze({
          schemaVersion: "pmh.semantic-graph-search-context.v1" as const,
          graphIdentity,
          neighborhoodIdentity: hashCanonical({ graphIdentity, lens, items }),
          lens,
          relationCount: 1,
          feedbackCount: 1,
          items,
          searchBrief: "Revisit the pizza pair; use MISSING_RULE as falsification evidence.",
          priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS" as const,
          modelConfidenceUsed: false as const,
          authority: "SEARCH_EVIDENCE_ONLY" as const,
          semanticDecisionAuthority: false as const,
          executionAuthority: false as const,
        });
      },
      runFast,
      runDeep,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });

    const first = scheduler.begin(snapshot(), "EQUIVALENCE");
    const record = await first.promise;

    expect(record.status).toBe("PASS");
    expect(record.fastLane.modelRequestCount).toBe(1);
    expect(record.deepLane.reason).toBe("NOVEL_MULTI_LISTING");
    expect(record.deepLane.permittedTools).toEqual(["read", "grep", "find", "ls"]);
    expect(record.trace.chainOfThoughtStored).toBe(false);
    expect(record.lease.graphContext?.feedbackCount).toBe(1);
    expect(record.trace.querySummary).toContain("Graph neighborhood:");
    expect(runFast.mock.calls[0]?.[0].question).toContain("MISSING_RULE");
    expect(record.semanticDecisionAuthority).toBe(false);
    expect(record.certificateAuthority).toBe(false);
    expect(record.executionAuthority).toBe(false);
    expect(runDeep).toHaveBeenCalledTimes(1);
    expect(runDeep.mock.calls[0]?.[1]).toContain("Search assignment:");
    expect(runDeep.mock.calls[0]?.[1]).toContain(record.trace.querySummary);
    expect(runDeep.mock.calls[0]?.[1]).toContain("Obey any exact candidate arity");

    const {
      economicGate: _economicGate,
      semanticScope: _semanticScope,
      ...legacyFastLane
    } = record.fastLane;
    const { artifactHash: _recordHash, ...recordBody } = record;
    const legacyBody = Object.freeze({ ...recordBody, fastLane: legacyFastLane });
    expect(() => assertSearchLeaseRecord(Object.freeze({
      ...legacyBody,
      artifactHash: hashCanonical(legacyBody),
    }))).not.toThrow();

    const replay = scheduler.begin(snapshot(), "EQUIVALENCE");
    expect(replay.idempotentReplay).toBe(true);
    await expect(replay.promise).resolves.toEqual(record);
    expect(runFast).toHaveBeenCalledTimes(1);
    expect(runDeep).toHaveBeenCalledTimes(1);
  });

  it("links duplicate candidate signatures and does not spend a second pi invocation", async () => {
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: 1 }),
      status: "PASS" as const,
      proposalIds: Object.freeze([]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    }));
    const scheduler = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      runDeep,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const first = await scheduler.begin(snapshot(), "EQUIVALENCE").promise;
    const duplicate = await scheduler.begin(snapshot(), "IMPLICATION").promise;

    expect(duplicate.deepLane.reason).toBe("DUPLICATE");
    expect(duplicate.lineage.duplicateOfLeaseId).toBe(first.lease.leaseId);
    expect(duplicate.outcome.novelCandidate).toBe(false);
    expect(runDeep).toHaveBeenCalledTimes(1);
  });

  it("retains deep falsification evidence without calling it an issue-policy hit", async () => {
    const conflictingProposalId = hashCanonical({ proposal: "conflicting" });
    const scheduler = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      runDeep: async () => Object.freeze({
        runId: hashCanonical({ deep: "policy" }),
        status: "PASS" as const,
        proposalIds: Object.freeze([conflictingProposalId]),
        proposalDetails: Object.freeze([Object.freeze({
          proposalId: conflictingProposalId,
          relationKind: "CONFLICTING" as const,
          listingRefs: Object.freeze(["venue-a:pizza-a", "venue-b:pizza-b"]),
        })]),
        evidenceGaps: Object.freeze(["Oracle rules diverge."]),
        diagnostic: null,
      }),
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const record = await scheduler.begin(
      snapshot(),
      "EQUIVALENCE",
      "SCHEDULE",
      {
        issueId: hashCanonical({ issue: "exact-pair" }),
        question: "Find one exact settleable pair.",
        venueIds: [],
        candidatePolicy: Object.freeze({
          allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
          exactListingRefCount: 2,
        }),
      },
    ).promise;

    expect(record).toMatchObject({
      status: "PASS",
      deepLane: {
        status: "PASS",
        reason: "NO_POLICY_MATCH",
        proposalIds: [],
        evidenceGaps: ["Oracle rules diverge."],
      },
      outcome: { novelCandidate: false, proposalCount: 0 },
    });
    expect(record.deepLane.diagnostic).toContain(
      "retained as research evidence; none matched the issue candidate policy",
    );
    expect(record.lineage.noveltySignature).not.toBeNull();
  });

  it("skips pi on a non-positive focused pair and reconsiders it after prices change", async () => {
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: "economic-gate" }),
      status: "PASS" as const,
      proposalIds: Object.freeze([]),
      proposalDetails: Object.freeze([]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    }));
    const contextFromSnapshot = (
      question: string,
      venueIds: readonly string[],
      _lens: unknown,
      current: ReturnType<typeof snapshot>,
    ): DiscoveryCatalogContext => {
      const body = Object.freeze({
        schemaVersion: "pmh.discovery-catalog-context.v2" as const,
        source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
        contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
        listings: Object.freeze(current.listings.filter((item) =>
          venueIds.includes(item.venueId)
        )),
      });
      expect(question).not.toHaveLength(0);
      return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
    };
    const scheduler = new SearchLeaseScheduler({
      context: contextFromSnapshot,
      runFast: async (task) => {
        const run = runRecord(task);
        const first = run.hypotheses[0];
        if (first === undefined) throw new Error("missing focused hypothesis");
        return Object.freeze({
          ...run,
          hypotheses: Object.freeze([
            Object.freeze({
              ...first,
              venueIds: Object.freeze(["venue-a"]),
              listingRefs: Object.freeze(["venue-a:pizza-a"]),
            }),
          ]),
        });
      },
      runDeep,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const issue = {
      issueId: hashCanonical({ issue: "economic-gate" }),
      question: "Find an economically live exact pair.",
      venueIds: Object.freeze([]),
      candidatePolicy: Object.freeze({
        allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
        exactListingRefCount: 2,
        requirePositiveGrossHint: true,
      }),
    };

    const blocked = await scheduler.begin(
      snapshot("non-positive"),
      "EQUIVALENCE",
      "SCHEDULE",
      issue,
    ).promise;
    expect(blocked).toMatchObject({
      status: "PASS",
      fastLane: {
        candidateListingRefs: ["venue-a:pizza-a", "venue-b:pizza-b"],
        economicGate: {
          required: true,
          status: "NON_POSITIVE_GROSS_HINT",
          indicativeCostBpsCeil: "10000",
          grossEdgeBpsFloor: "0",
          executable: false,
        },
      },
      deepLane: { reason: "ECONOMIC_GATE_BLOCKED", runId: null },
      lineage: { duplicateOfLeaseId: null, noveltySignature: null },
      outcome: { novelCandidate: false, proposalCount: 0 },
    });
    expect(runDeep).not.toHaveBeenCalled();

    const positiveListings = Object.freeze(listings.map((item) => Object.freeze({
      ...item,
      outcomes: Object.freeze(item.outcomes.map((outcome) => Object.freeze({
        ...outcome,
        indicativePrice: "0.4",
      }))),
      sourceRawHash: hashCanonical({ listingRef: item.listingRef, prices: "positive" }),
    })));
    const positiveSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "positive" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: positiveListings,
    });
    const passed = await scheduler.begin(
      positiveSnapshot,
      "EQUIVALENCE",
      "SCHEDULE",
      issue,
    ).promise;
    expect(passed.fastLane.economicGate).toMatchObject({
      status: "POSITIVE_GROSS_HINT",
      indicativeCostBpsCeil: "8000",
      grossEdgeBpsFloor: "2000",
    });
    expect(passed.deepLane.runId).not.toBeNull();
    expect(runDeep).toHaveBeenCalledTimes(1);
  });

  it("feeds completed exact semantic scopes back to the same issue on later corpora", async () => {
    const feedbackSeen: unknown[] = [];
    const scheduler = new SearchLeaseScheduler({
      context: (question, venueIds, _lens, _snapshot, feedback) => {
        feedbackSeen.push(feedback);
        return context(question, venueIds);
      },
      runFast: async (task) => {
        const run = runRecord(task);
        return Object.freeze({ ...run, hypotheses: Object.freeze([]) });
      },
      maxPiInvocations: 0,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const issueId = hashCanonical({ issue: "semantic-rotation" });
    const issue = Object.freeze({
      issueId,
      question: "Rotate unchanged semantic scopes.",
      venueIds: Object.freeze([]),
    });

    const first = await scheduler.begin(
      snapshot("semantic-rotation-1"),
      "EQUIVALENCE",
      "SCHEDULE",
      issue,
    ).promise;
    const second = await scheduler.begin(
      snapshot("semantic-rotation-2"),
      "EQUIVALENCE",
      "SCHEDULE",
      issue,
    ).promise;

    expect(first.deepLane.reason).toBe("NO_CANDIDATES");
    expect(first.fastLane.semanticScope).toMatchObject({
      kind: "EXACT_PAIR",
      listingRefs: ["venue-a:pizza-a", "venue-b:pizza-b"],
      priceIndependentSemanticIdentity: true,
      authority: "SEARCH_ROUTING_ONLY",
    });
    expect(feedbackSeen).toHaveLength(2);
    expect(feedbackSeen[0]).toMatchObject({
      issueId,
      completedSemanticScopeIdentities: [],
      attemptedRoutingScopeIdentities: [],
    });
    expect(feedbackSeen[1]).toMatchObject({
      issueId,
      completedSemanticScopeIdentities: [
        first.fastLane.semanticScope?.semanticScopeIdentity,
      ],
      attemptedRoutingScopeIdentities: [
        first.fastLane.semanticScope?.routingScopeIdentity,
      ],
      authority: "SEARCH_ROUTING_ONLY",
    });
    expect(second.fastLane.semanticScope?.semanticScopeIdentity).toBe(
      first.fastLane.semanticScope?.semanticScopeIdentity,
    );
  });

  it("feeds completed bounded contexts back without crossing issue boundaries", async () => {
    const boundedListings = Object.freeze([
      ...listings,
      Object.freeze({
        ...listings[0]!,
        listingRef: "venue-c:pizza-c",
        venueId: "venue-c",
        venueInstrumentId: "pizza-c",
        sourceRawHash: hashCanonical({ venueId: "venue-c" }),
        protocolIdentity: "protocol:venue-c",
      }),
    ]);
    const boundedSnapshot = (source: string) => buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source }),
      eligibleSourceCount: 3,
      excludedSourceCount: 0,
      listings: boundedListings,
    });
    const feedbackSeen: unknown[] = [];
    const scheduler = new SearchLeaseScheduler({
      context: (question, _venueIds, _lens, _snapshot, feedback) => {
        feedbackSeen.push(feedback);
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-catalog-context.v2" as const,
          source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
          contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
          listings: boundedListings,
        });
        expect(question).not.toHaveLength(0);
        return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
      },
      runFast: async (task) => Object.freeze({
        ...runRecord(task),
        hypotheses: Object.freeze([]),
      }),
      maxPiInvocations: 0,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const firstIssueId = hashCanonical({ issue: "bounded-rotation" });
    const firstIssue = Object.freeze({
      issueId: firstIssueId,
      question: "Rotate bounded semantic neighborhoods.",
      venueIds: Object.freeze([]),
    });
    const secondIssue = Object.freeze({
      issueId: hashCanonical({ issue: "independent-bounded-rotation" }),
      question: firstIssue.question,
      venueIds: Object.freeze([]),
    });

    const first = await scheduler.begin(
      boundedSnapshot("bounded-1"),
      "IMPLICATION",
      "SCHEDULE",
      firstIssue,
    ).promise;
    await scheduler.begin(
      boundedSnapshot("bounded-2"),
      "IMPLICATION",
      "SCHEDULE",
      firstIssue,
    ).promise;
    await scheduler.begin(
      boundedSnapshot("bounded-3"),
      "IMPLICATION",
      "SCHEDULE",
      secondIssue,
    ).promise;

    expect(first.fastLane.semanticScope).toMatchObject({
      kind: "BOUNDED_CONTEXT",
      listingRefs: [
        "venue-a:pizza-a",
        "venue-b:pizza-b",
        "venue-c:pizza-c",
      ],
    });
    expect(feedbackSeen[1]).toMatchObject({
      issueId: firstIssueId,
      completedSemanticScopeIdentities: [
        first.fastLane.semanticScope?.semanticScopeIdentity,
      ],
      attemptedRoutingScopeIdentities: [
        first.fastLane.semanticScope?.routingScopeIdentity,
      ],
    });
    expect(feedbackSeen[2]).toMatchObject({
      issueId: secondIssue.issueId,
      completedSemanticScopeIdentities: [],
      attemptedRoutingScopeIdentities: [],
    });
  });

  it("lets a model select one exact pair from a bounded radar batch before economics", async () => {
    const batchedListings = Object.freeze([
      ...listings,
      ...(["venue-c", "venue-d"] as const).map((venueId) => Object.freeze({
        ...listings[0]!,
        listingRef: `${venueId}:pizza-${venueId.at(-1)}`,
        venueId,
        venueInstrumentId: `pizza-${venueId.at(-1)}`,
        outcomes: Object.freeze(listings[0]!.outcomes.map((outcome) =>
          Object.freeze({ ...outcome, indicativePrice: "0.4" })
        )),
        sourceRawHash: hashCanonical({ venueId, price: "0.4" }),
        protocolIdentity: `protocol:${venueId}`,
      })),
    ]);
    const batchedSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "model-selected-batch" }),
      eligibleSourceCount: 4,
      excludedSourceCount: 0,
      listings: batchedListings,
    });
    const batchedContext = (): DiscoveryCatalogContext => {
      const body = Object.freeze({
        schemaVersion: "pmh.discovery-catalog-context.v2" as const,
        source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
        contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
        listings: batchedListings,
      });
      return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
    };
    const selectedRefs = Object.freeze(["venue-c:pizza-c", "venue-d:pizza-d"]);
    const selectedProposalId = hashCanonical({ proposal: "selected-pair" });
    const alternateProposalId = hashCanonical({ proposal: "alternate-pair" });
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: "model-selected-batch" }),
      status: "PASS" as const,
      proposalIds: Object.freeze([alternateProposalId, selectedProposalId]),
      proposalDetails: Object.freeze([
        Object.freeze({
          proposalId: alternateProposalId,
          relationKind: "EQUIVALENT" as const,
          listingRefs: Object.freeze(["venue-a:pizza-a", "venue-b:pizza-b"]),
        }),
        Object.freeze({
          proposalId: selectedProposalId,
          relationKind: "EQUIVALENT" as const,
          listingRefs: selectedRefs,
        }),
      ]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    }));
    const scheduler = new SearchLeaseScheduler({
      context: (_question, _venueIds, _lens, _snapshot, _feedback, policy) => {
        expect(policy?.candidateSelection).toBe("MODEL_HYPOTHESIS");
        return batchedContext();
      },
      runFast: async (task) => {
        const base = runRecord(task);
        const heuristic = Object.freeze({
          ...hypothesis(task),
          hypothesisId: "hypothesis:heuristic-batch",
          workerId: "heuristic:free",
          venueIds: Object.freeze(["venue-a", "venue-b", "venue-c", "venue-d"]),
          listingRefs: Object.freeze(batchedListings.map((item) => item.listingRef)),
        });
        const model = Object.freeze({
          ...hypothesis(task),
          hypothesisId: "hypothesis:model-selected-pair",
          workerId: "model:fast",
          venueIds: Object.freeze(["venue-c", "venue-d"]),
          listingRefs: selectedRefs,
        });
        return Object.freeze({
          ...base,
          hypotheses: Object.freeze([heuristic, model]),
          workerReports: Object.freeze(base.workerReports!.map((report) =>
            Object.freeze({ ...report, hypothesisCount: 1 })
          )),
        });
      },
      runDeep,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const record = await scheduler.begin(
      batchedSnapshot,
      "EQUIVALENCE",
      "SCHEDULE",
      {
        issueId: hashCanonical({ issue: "model-selected-batch" }),
        question: "Let the model select one exact cross-venue pair.",
        venueIds: [],
        candidatePolicy: Object.freeze({
          allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
          exactListingRefCount: 2,
          requirePositiveGrossHint: true,
          candidateSelection: "MODEL_HYPOTHESIS" as const,
          requireDistinctVenues: true,
        }),
      },
    ).promise;

    expect(record.fastLane).toMatchObject({
      candidateListingRefs: selectedRefs,
      semanticScope: { kind: "BOUNDED_CONTEXT" },
      economicGate: {
        status: "POSITIVE_GROSS_HINT",
        listingRefs: selectedRefs,
        indicativeCostBpsCeil: "8000",
        grossEdgeBpsFloor: "2000",
      },
    });
    expect(record.deepLane).toMatchObject({
      reason: "NOVEL_MULTI_LISTING",
      proposalIds: [selectedProposalId],
    });
    expect(record.outcome.novelCandidate).toBe(true);
    expect(runDeep).toHaveBeenCalledTimes(1);
    expect(runDeep.mock.calls[0]?.[1]).toContain(selectedRefs.join(", "));
  });

  it("does not let heuristics or invalid model scope satisfy model selection", async () => {
    const sameVenue = Object.freeze({
      ...listings[0]!,
      listingRef: "venue-a:pizza-second",
      venueInstrumentId: "pizza-second",
      sourceRawHash: hashCanonical({ source: "same-venue" }),
    });
    const batch = Object.freeze([...listings, sameVenue]);
    const current = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "invalid-model-selection" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: batch,
    });
    const runDeep = vi.fn();
    const scheduler = new SearchLeaseScheduler({
      context: () => {
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-catalog-context.v2" as const,
          source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
          contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
          listings: batch,
        });
        return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
      },
      runFast: async (task) => {
        const base = runRecord(task);
        return Object.freeze({
          ...base,
          hypotheses: Object.freeze([
            Object.freeze({
              ...hypothesis(task),
              hypothesisId: "hypothesis:heuristic-valid-pair",
              workerId: "heuristic:free",
            }),
            Object.freeze({
              ...hypothesis(task),
              hypothesisId: "hypothesis:model-same-venue",
              workerId: "model:fast",
              venueIds: Object.freeze(["venue-a"]),
              listingRefs: Object.freeze([
                "venue-a:pizza-a",
                "venue-a:pizza-second",
              ]),
            }),
            Object.freeze({
              ...hypothesis(task),
              hypothesisId: "hypothesis:model-out-of-context",
              workerId: "model:fast",
              venueIds: Object.freeze(["venue-a", "venue-z"]),
              listingRefs: Object.freeze([
                "venue-a:pizza-a",
                "venue-z:not-in-context",
              ]),
            }),
          ]),
          workerReports: Object.freeze(base.workerReports!.map((report) =>
            Object.freeze({
              ...report,
              hypothesisCount: report.kind === "MODEL" ? 2 : 1,
            })
          )),
        });
      },
      runDeep,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const record = await scheduler.begin(
      current,
      "EQUIVALENCE",
      "SCHEDULE",
      {
        issueId: hashCanonical({ issue: "invalid-model-selection" }),
        question: "Require one model-selected cross-venue pair.",
        venueIds: [],
        candidatePolicy: Object.freeze({
          allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
          exactListingRefCount: 2,
          requirePositiveGrossHint: true,
          candidateSelection: "MODEL_HYPOTHESIS" as const,
          requireDistinctVenues: true,
        }),
      },
    ).promise;

    expect(record.fastLane).toMatchObject({
      candidateListingRefs: [],
      economicGate: { required: true, status: "NOT_RUN", listingRefs: [] },
    });
    expect(record.deepLane.reason).toBe("NO_CANDIDATES");
    expect(record.outcome.novelCandidate).toBe(false);
    expect(runDeep).not.toHaveBeenCalled();
  });

  it("enriches only an exact selected pair after the catalog gate is price-unavailable", async () => {
    const priced = Object.freeze({
      ...listing("limitless", "hourly"),
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "201", label: "Up", indicativePrice: "0.4" }),
        Object.freeze({ venueOutcomeId: "202", label: "Down", indicativePrice: "0.6" }),
      ]),
    });
    const unpriced = Object.freeze({
      ...listing("opinion", "hourly"),
      outcomes: Object.freeze([
        Object.freeze({ venueOutcomeId: "101", label: "Up", indicativePrice: null }),
        Object.freeze({ venueOutcomeId: "102", label: "Down", indicativePrice: null }),
      ]),
    });
    const pair = Object.freeze([priced, unpriced]);
    const current = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "quote-enriched-pair" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: pair,
    });
    const selectedRefs = Object.freeze(pair.map((item) => item.listingRef).sort());
    const proposalId = hashCanonical({ proposal: "quote-enriched" });
    const enrichPrices = vi.fn(async (selected: typeof pair) => Object.freeze({
      status: "READY" as const,
      requestedListingCount: 2,
      attemptedOutcomeCount: 2,
      enrichedOutcomeCount: 2,
      listings: Object.freeze(selected.map((item) => item.venueId !== "opinion"
        ? item
        : Object.freeze({
            ...item,
            outcomes: Object.freeze([
              Object.freeze({ ...item.outcomes[0]!, indicativePrice: "0.5" }),
              Object.freeze({ ...item.outcomes[1]!, indicativePrice: "0.4" }),
            ]),
          })
      )),
      observationIds: Object.freeze([
        hashCanonical({ quote: "yes" }),
        hashCanonical({ quote: "no" }),
      ]),
      diagnostics: Object.freeze([]),
      authority: "SEARCH_PRICE_EVIDENCE_ONLY" as const,
      semanticDecisionAuthority: false as const,
      simulationAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      effects: Object.freeze({
        anonymousPublicGets: true,
        credentialsUsed: false as const,
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    }));
    const runDeep = vi.fn(async () => Object.freeze({
      runId: hashCanonical({ deep: "quote-enriched" }),
      status: "PASS" as const,
      proposalIds: Object.freeze([proposalId]),
      proposalDetails: Object.freeze([Object.freeze({
        proposalId,
        relationKind: "EQUIVALENT" as const,
        listingRefs: selectedRefs,
      })]),
      evidenceGaps: Object.freeze([]),
      diagnostic: null,
    }));
    const scheduler = new SearchLeaseScheduler({
      context: () => {
        const body = Object.freeze({
          schemaVersion: "pmh.discovery-catalog-context.v2" as const,
          source: "QUALIFIED_LIVE_OBSERVATIONS" as const,
          contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
          listings: pair,
        });
        return Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
      },
      runFast: async (task) => {
        const base = runRecord(task);
        return Object.freeze({
          ...base,
          hypotheses: Object.freeze([Object.freeze({
            ...hypothesis(task),
            venueIds: Object.freeze(["limitless", "opinion"]),
            listingRefs: selectedRefs,
          })]),
        });
      },
      enrichPrices,
      runDeep,
      now: () => Date.parse("2026-08-02T00:00:00.000Z"),
    });
    const record = await scheduler.begin(current, "EQUIVALENCE", "SCHEDULE", {
      issueId: hashCanonical({ issue: "quote-enriched" }),
      question: "Select and price one exact pair.",
      venueIds: [],
      candidatePolicy: Object.freeze({
        allowedRelationKinds: Object.freeze(["EQUIVALENT"] as const),
        exactListingRefCount: 2,
        requirePositiveGrossHint: true,
        candidateSelection: "MODEL_HYPOTHESIS" as const,
        requireDistinctVenues: true,
      }),
    }).promise;

    expect(enrichPrices).toHaveBeenCalledTimes(1);
    expect(enrichPrices.mock.calls[0]?.[0].map((item) => item.listingRef).sort())
      .toEqual(selectedRefs);
    expect(record.fastLane.economicGate).toMatchObject({
      status: "POSITIVE_GROSS_HINT",
      grossEdgeBpsFloor: "2000",
      feesIncluded: false,
      depthIncluded: false,
      executable: false,
      quoteEnrichment: {
        status: "READY",
        attemptedOutcomeCount: 2,
        enrichedOutcomeCount: 2,
        source: "CATALOG_PLUS_ANONYMOUS_PUBLIC_BOOKS",
        authority: "SEARCH_PRICE_EVIDENCE_ONLY",
        semanticDecisionAuthority: false,
        simulationAuthority: false,
        certificateAuthority: false,
        executionAuthority: false,
      },
    });
    expect(record.deepLane.reason).toBe("NOVEL_MULTI_LISTING");
    expect(runDeep).toHaveBeenCalledTimes(1);
  });

  it("persists issued-to-terminal records and restores idempotent results", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const scheduler = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      maxPiInvocations: 0,
      store,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const completed = await scheduler.begin(snapshot(), "PARTITION").promise;
    expect(completed.deepLane.reason).toBe("PI_DISABLED");
    expect(store.loadSearchLeaseRecords(10)).toEqual([completed]);
    const { artifactHash: _artifactHash, ...completedBody } = completed;
    const rewrittenBody = Object.freeze({
      ...completedBody,
      diagnostic: "attempted terminal rewrite",
    });
    expect(() => store.saveSearchLeaseRecord(Object.freeze({
      ...rewrittenBody,
      artifactHash: hashCanonical(rewrittenBody),
    }), 40)).toThrow(/cannot rewrite/);

    const restored = new SearchLeaseScheduler({
      context,
      runFast: async () => {
        throw new Error("must not rerun");
      },
      maxPiInvocations: 0,
      store,
    });
    const replay = restored.begin(snapshot(), "PARTITION");
    expect(replay.idempotentReplay).toBe(true);
    await expect(replay.promise).resolves.toEqual(completed);
    expect(restored.projection()).toMatchObject({
      retainedCorpusCount: 1,
      recoverableIssuedCount: 0,
      missingCorpusIssuedCount: 0,
      storage: { schemaVersion: 17 },
      corpusStorage: { schemaVersion: 17, idempotencyKey: "snapshotIdentity" },
    });
    store.close();
  });

  it("writes ISSUED before AI work and resumes that exact lease after restart", async () => {
    const store = new SqliteOperationalStore(":memory:");
    let release: ((record: DiscoveryRunRecord) => void) | undefined;
    const pending = new Promise<DiscoveryRunRecord>((resolve) => {
      release = resolve;
    });
    const first = new SearchLeaseScheduler({
      context,
      runFast: async () => pending,
      maxPiInvocations: 0,
      store,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const issueId = hashCanonical({ issue: "restart" });
    const originalSnapshot = snapshot("restart-original");
    const inFlight = first.begin(
      originalSnapshot,
      "MECHANISM",
      "SCHEDULE",
      { issueId, question: "Resume exact evidence.", venueIds: [] },
    ).promise;
    const issued = store.loadSearchLeaseRecords(10)[0];
    expect(issued?.status).toBe("ISSUED");
    expect(first.projection()).toMatchObject({
      retainedCorpusCount: 1,
      recoverableIssuedCount: 1,
      missingCorpusIssuedCount: 0,
    });

    const restored = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      maxPiInvocations: 0,
      store,
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const resumedInvocation = restored.resumeIssued(issueId);
    expect(resumedInvocation).not.toBeNull();
    const resumed = await resumedInvocation!.promise;
    expect(resumed.lease.leaseId).toBe(issued?.lease.leaseId);
    expect(resumed.lease.snapshotIdentity).toBe(originalSnapshot.snapshotIdentity);
    expect(resumed.status).toBe("PASS");

    if (release === undefined) throw new Error("missing pending fast lane");
    release(runRecord({
      taskId: issued!.fastLane.taskId,
      question: issued!.trace.querySummary,
      venueIds: issued!.lease.scope.venueIds,
      maxHypotheses: issued!.lease.budget.maxHypotheses,
      deadlineEpochMs: Date.parse(issued!.lease.deadlineAt),
      catalogContext: context(issued!.trace.querySummary, issued!.lease.scope.venueIds),
    }));
    await expect(inFlight).resolves.toEqual(resumed);
    store.close();
  });

  it("deduplicates retained corpora and prunes them with terminal lease retention", async () => {
    const store = new SqliteOperationalStore(":memory:");
    const scheduler = new SearchLeaseScheduler({
      context,
      runFast: async (task) => runRecord(task),
      maxPiInvocations: 0,
      retentionLimit: 4,
      store,
    });
    const firstSnapshot = snapshot("retention-0");
    await scheduler.begin(firstSnapshot, "EQUIVALENCE").promise;
    await scheduler.begin(firstSnapshot, "IMPLICATION").promise;
    expect(store.countSearchLeaseCorpora()).toBe(1);
    for (let index = 1; index < 5; index += 1) {
      await scheduler.begin(snapshot(`retention-${index}`), "EQUIVALENCE").promise;
    }
    expect(store.countSearchLeaseCorpora()).toBe(4);
    expect(store.loadSearchLeaseCorpus(firstSnapshot.snapshotIdentity)).toBeNull();
    store.close();
  });

  it("finishes each lens once per immutable snapshot and remains opt-in", async () => {
    const scheduler = new SearchLeaseScheduler({
      intervalMs: 60_000,
      context,
      runFast: async (task) => Object.freeze({
        ...runRecord(task),
        hypotheses: Object.freeze([]),
      }),
      now: () => Date.parse("2026-08-01T00:00:00.000Z"),
    });
    const current = snapshot();
    for (let index = 0; index < 4; index += 1) {
      expect(scheduler.shouldSchedule(current)).toBe(true);
      await scheduler.begin(current, undefined, "SCHEDULE").promise;
    }
    expect(scheduler.shouldSchedule(current)).toBe(false);
    expect(scheduler.projection().runCount).toBe(4);
  });
});
