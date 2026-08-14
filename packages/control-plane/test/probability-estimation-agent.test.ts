import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashCanonical } from "@pmh/domain";
import {
  AiUsageLedger,
  assertProbabilityEstimationEvidenceContext,
  assertProbabilityAdverseStateInterpretation,
  assertProbabilityEstimationJobRecord,
  assertProbabilityEstimationRunRecord,
  buildMarketCorpusSnapshot,
  buildProbabilityEstimationEvidenceContext,
  buildProbabilityAdverseStateInterpretation,
  buildProbabilityCaseChallenge,
  buildProbabilityCaseRepairQueue,
  buildProbabilitySemanticRepairProgress,
  buildProbabilitySemanticRepairRequest,
  buildProbabilityEvidenceNeed,
  buildProbabilityEvidenceDebt,
  buildProbabilitySearchOrigin,
  buildProbabilisticSemanticBound,
  buildProposalEvidenceBundle,
  buildSemanticConstraintArtifact,
  codexCredentialForTest,
  createProbabilityEstimationDesk,
  createSemanticReviewDesk,
  deriveProbabilityAdverseStates,
  ProbabilityEstimationScheduler,
  SemanticReviewScheduler,
  type AiRuntimeConfiguration,
  type MarketRelationProposal,
  type ProbabilityEstimationModelInput,
  type SemanticReviewRecord,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";
import {
  deepSeekTextResponse,
  openAiStreamToolResponse,
} from "./model-agent-fixtures.js";

const listings = [
  {
    listingRef: "venue-a:trump-shot-august",
    venueId: "venue-a",
    venueInstrumentId: "trump-shot-august",
    title: "Will Trump be shot in August?",
    description: "Resolves Yes for a qualifying gunshot injury.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-09-01T00:00:00.000Z",
    rulesText: "A non-fatal gunshot injury counts.",
    outcomes: [
      { venueOutcomeId: "shot-yes", label: "Yes", indicativePrice: "0.60" },
      { venueOutcomeId: "shot-no", label: "No", indicativePrice: "0.40" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "shooting-rules" }),
    protocolIdentity: hashCanonical({ protocol: "venue-a" }),
  },
  {
    listingRef: "venue-b:trump-cola-september",
    venueId: "venue-b",
    venueInstrumentId: "trump-cola-september",
    title: "Will Trump livestream drinking cola in September?",
    description: "Resolves Yes for an in-person public livestream.",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-10-01T00:00:00.000Z",
    rulesText: "Prerecorded footage and proxy appearances do not count.",
    outcomes: [
      { venueOutcomeId: "cola-yes", label: "Yes", indicativePrice: "0.50" },
      { venueOutcomeId: "cola-no", label: "No", indicativePrice: "0.50" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "1000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-02T00:00:00.000Z",
    sourceRawHash: hashCanonical({ source: "cola-rules" }),
    protocolIdentity: hashCanonical({ protocol: "venue-b" }),
  },
];
const snapshot = buildMarketCorpusSnapshot({
  sourceSetIdentity: hashCanonical({ sources: ["venue-a", "venue-b"] }),
  eligibleSourceCount: 2,
  excludedSourceCount: 0,
  listings,
});
const proposalBody = Object.freeze({
  relationKind: "MUTUALLY_EXCLUSIVE" as const,
  listingRefs: listings.map((listing) => listing.listingRef),
  statement: "The August injury suppresses the later live appearance.",
  rationale: "Estimate the surviving joint state instead of declaring it impossible.",
  falsifiers: ["A non-fatal injury followed by recovery permits both events."],
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
});
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({ corpusSnapshotIdentity: snapshot.snapshotIdentity, ...proposalBody }),
});
const constraint = buildSemanticConstraintArtifact({
  proposal,
  proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  evidenceCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  listingEvidence: listings.map((listing) => ({
    listingRef: listing.listingRef,
    listingHash: hashCanonical(listing),
    sourceRawHash: listing.sourceRawHash,
    protocolIdentity: listing.protocolIdentity,
  })),
  draft: {
    classification: "PROBABILISTIC_DEPENDENCE",
    relationKind: "MUTUALLY_EXCLUSIVE",
    assumptions: ["The September contract requires a personal live appearance."],
    counterexampleAttempt: {
      attempted: true,
      result: "FOUND",
      narrative: "Recovery after a non-fatal injury preserves the TT state.",
      truths: [true, true],
    },
    truthTable: [
      [false, false], [false, true], [true, false], [true, true],
    ].map((truths) => ({
      truths,
      disposition: "FEASIBLE" as const,
      rationale: truths[0] && truths[1] ? "Adverse but possible." : "Feasible.",
      evidenceListingRefs: proposal.listingRefs,
    })),
    unresolvedEvidence: ["Recovery time is not specified by either contract."],
  },
});
const reportBody = Object.freeze({
  schemaVersion: "pmh.semantic-review-report.v2" as const,
  status: "PASS" as const,
  startedAt: "2026-08-02T00:00:00.000Z",
  completedAt: "2026-08-02T00:00:01.000Z",
  engine: Object.freeze({
    transport: "VERCEL_AI_SDK" as const,
    provider: "deepseek" as const,
    model: "deepseek-v4-flash",
    role: "ADVERSARIAL_SEMANTIC_REVIEWER" as const,
    independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER" as const,
  }),
  input: Object.freeze({
    opportunityId: `ai:${proposal.proposalId}`,
    proposalId: proposal.proposalId,
    proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
    corpusSnapshotIdentity: snapshot.snapshotIdentity,
    evidencePosture: "ORIGINAL_CORPUS" as const,
    relationKind: proposal.relationKind,
    statement: proposal.statement,
    listingEvidence: Object.freeze(listings.map((listing) => Object.freeze({
      listingRef: listing.listingRef,
      listingHash: hashCanonical(listing),
      sourceRawHash: listing.sourceRawHash,
      protocolIdentity: listing.protocolIdentity,
      venueId: listing.venueId,
      venueInstrumentId: listing.venueInstrumentId,
      outcomes: listing.outcomes.map((outcome) => ({
        venueOutcomeId: outcome.venueOutcomeId,
        label: outcome.label,
      })),
      priceScale: listing.priceScale,
      quantityScale: listing.quantityScale,
      minPriceTick: listing.minPriceTick,
    }))),
  }),
  result: Object.freeze({
    recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
    relationConclusion: "MUTUALLY_EXCLUSIVE" as const,
    assessments: Object.freeze({
      outcomeMapping: "Canonical binary outcomes.",
      timingAndClose: "August precedes September.",
      voidAndCancellation: "No hard exclusion follows.",
      resolutionSources: "Each venue resolves independently.",
    }),
    counterexamples: Object.freeze(["Non-fatal recovery permits TT."]),
    missingEvidence: Object.freeze(["A calibrated recovery reference class."]),
    rationale: "Retain as probabilistic dependence.",
    semanticConstraint: constraint,
    authority: "ADVISORY_ONLY" as const,
    productionReviewAuthority: false as const,
    simulationAuthority: false as const,
    executionAuthority: false as const,
  }),
  trace: Object.freeze({
    protocol: "AI_SDK_TOOL_LOOP" as const,
    maximumSteps: 12 as const,
    counterexampleEffectCount: 1,
    submittedEffectHash: hashCanonical({ review: "shooting-cola" }),
    wholeResponseSchemaParsing: false as const,
  }),
  effects: Object.freeze({
    externalWrites: false as const,
    valueMovingActions: false as const,
    liveExecutionEnabled: false as const,
  }),
});
const report = Object.freeze({ ...reportBody, artifactHash: hashCanonical(reportBody) });
const reviewIdentity = Object.freeze({
  schemaVersion: "pmh.semantic-review-run.v1",
  opportunityId: `ai:${proposal.proposalId}`,
  proposalId: proposal.proposalId,
  proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  corpusSnapshotIdentity: snapshot.snapshotIdentity,
  model: "deepseek-v4-flash",
});
const review: SemanticReviewRecord = Object.freeze({
  reviewId: hashCanonical(reviewIdentity),
  opportunityId: reviewIdentity.opportunityId,
  proposalId: proposal.proposalId,
  proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
  corpusSnapshotIdentity: snapshot.snapshotIdentity,
  model: "deepseek-v4-flash",
  status: "PASS",
  startedAt: report.startedAt,
  completedAt: report.completedAt,
  diagnostic: null,
  report,
});

function toolCompletion(name: string, payload: unknown, id: number): Response {
  return Response.json({
    id: `chatcmpl-probability-${id}`,
    object: "chat.completion",
    created: 1_785_523_200,
    model: "deepseek-v4-flash",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: `call-${id}`,
          type: "function",
          function: { name, arguments: JSON.stringify(payload) },
        }],
      },
      finish_reason: "tool_calls",
    }],
    usage: { prompt_tokens: 300, completion_tokens: 100, total_tokens: 400 },
  });
}

function directInterpretationHash(
  adverseStateIds: readonly string[] = ["TT"],
): string {
  const evidenceContextIdentity = hashCanonical({
    schemaVersion: "pmh.legacy-probability-interpretation-context.v1",
    semanticReviewArtifactHash: review.report!.artifactHash,
    listings,
  });
  return buildProbabilityAdverseStateInterpretation({
    semanticConstraint: constraint,
    evidenceContextIdentity,
    listings,
    adverseStateIds,
  }).artifactHash;
}

describe("Agent-first probability estimation", () => {
  it("uses counter-scenario and estimate tools instead of whole-response parsing", async () => {
    const allowedEvidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const bodies: Record<string, unknown>[] = [];
    const desk = createProbabilityEstimationDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_PROBABILITY_ESTIMATION_TIMEOUT_MS: "3000",
      },
      {
        now: () => Date.parse("2026-08-02T00:02:00.000Z"),
        async fetcher(_request, init) {
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return bodies.length === 1
            ? toolCompletion("record_counter_scenario", {
                stateId: "TT",
                narrative: "This premature effect must be rejected.",
                evidenceHashes: [allowedEvidenceHash],
              }, 1)
            : bodies.length === 2
              ? toolCompletion("accept_probability_case", {
                interpretationArtifactHash: directInterpretationHash(),
              }, 2)
            : bodies.length === 3
              ? toolCompletion("record_counter_scenario", {
                stateId: "TT",
                narrative: "A non-fatal wound followed by recovery permits both events.",
                evidenceHashes: [allowedEvidenceHash],
              }, 3)
            : toolCompletion("submit_probability_estimate", {
                lowerPpm: "20000",
                upperPpm: "50000",
                evidenceHashes: [allowedEvidenceHash],
                assumptions: ["Recorded appearances do not count."],
                validForMs: 3_600_000,
                rationale: "Causal recovery path gives a small but non-zero joint-state interval.",
              }, 4);
        },
      },
    );
    const record = await desk.begin(review, snapshot, ["TT"], "CAUSAL").promise;

    expect(record).toMatchObject({
      status: "PASS",
      role: "CAUSAL",
      estimate: {
        estimator: "DEEPSEEK:deepseek-v4-flash:CAUSAL",
        method: "CAUSAL_MODEL",
        lowerPpm: "20000",
        upperPpm: "50000",
        completedAt: "2026-08-02T00:02:00.000Z",
        expiresAt: "2026-08-02T01:02:00.000Z",
      },
      trace: {
        protocol: "AI_SDK_TOOL_LOOP",
        stepCount: 4,
        toolCallCount: 4,
        providerRequestAttemptCount: 4,
        counterScenarioEffectCount: 1,
        evidenceNeedEffectCount: 0,
        caseAcknowledgementEffectCount: 1,
        caseChallengeEffectCount: 0,
        wholeResponseSchemaParsing: false,
      },
      authority: "ESTIMATE_ONLY",
      certificateAuthority: false,
      executionAuthority: false,
    });
    expect(record.allowedEvidenceHashes).toEqual(
      [...new Set(constraint.ruleEvidence.flatMap(
        (item) => [item.listingHash, item.sourceRawHash],
      ))].sort(),
    );
    expect(() => assertProbabilityEstimationRunRecord(record)).not.toThrow();
    expect(() => assertProbabilityEstimationRunRecord({
      ...record,
      counterScenarios: [{
        ...record.counterScenarios[0]!,
        evidenceHashes: [hashCanonical({ outside: true })],
      }],
      artifactHash: record.artifactHash,
    })).toThrow(/lineage or authority/u);
    expect(bodies).toHaveLength(4);
    expect(bodies.every((body) => !("response_format" in body))).toBe(true);
    expect(JSON.stringify(bodies[0])).toContain("record_counter_scenario");
    expect(JSON.stringify(bodies[0])).toContain("abstain_probability_estimate");
    expect(JSON.stringify(bodies[0])).toContain("pmh.probability-estimation-input.v4");
    expect(JSON.stringify(bodies[0])).toContain("probability-adverse-state-interpretation.v1");
    expect(JSON.stringify(bodies[0])).toContain("truthByListingRef");
    expect(JSON.stringify(bodies[0])).toContain("Recovery after a non-fatal injury");
    expect(JSON.stringify(record)).not.toContain("test-only-key");
  });

  it("expands compact state symbols into exact outcome assignments and rejects tampering", () => {
    const artifact = buildProbabilityAdverseStateInterpretation({
      semanticConstraint: constraint,
      evidenceContextIdentity: hashCanonical({ context: "interpretation-test" }),
      listings,
      adverseStateIds: ["TT"],
    });
    expect(artifact).toMatchObject({
      schemaVersion: "pmh.probability-adverse-state-interpretation.v1",
      adverseStateIds: ["TT"],
      outcomeMappingPosture: "EXACT_BINARY_LABELS",
      states: [{
        stateId: "TT",
        claimedByCounterexample: true,
        assignments: [
          {
            ordinal: 0,
            listingRef: listings[0]!.listingRef,
            truth: true,
            selectedOutcome: { venueOutcomeId: "shot-yes", label: "Yes" },
          },
          {
            ordinal: 1,
            listingRef: listings[1]!.listingRef,
            truth: true,
            selectedOutcome: { venueOutcomeId: "cola-yes", label: "Yes" },
          },
        ],
      }],
      authority: "CASE_INTERPRETATION_ONLY",
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
    expect(() => assertProbabilityAdverseStateInterpretation(artifact)).not.toThrow();
    expect(() => assertProbabilityAdverseStateInterpretation({
      ...artifact,
      states: [{
        ...artifact.states[0]!,
        assignments: [{
          ...artifact.states[0]!.assignments[0]!,
          truth: false,
        }, artifact.states[0]!.assignments[1]!],
      }],
    })).toThrow(/bounded contract/u);

    const input: ProbabilityEstimationModelInput = Object.freeze({
      role: "INDEPENDENT",
      model: "deepseek-v4-flash",
      semanticReviewArtifactHash: review.report!.artifactHash,
      semanticConstraintArtifactHash: constraint.artifactHash,
      semanticConstraint: constraint,
      adverseStateInterpretation: artifact,
      adverseStateIds: artifact.adverseStateIds,
      listings,
      allowedEvidenceHashes: Object.freeze([...new Set(
        constraint.ruleEvidence.flatMap((item) => [item.listingHash, item.sourceRawHash]),
      )].sort()),
    });
    const challengeDraft = {
      interpretationArtifactHash: artifact.artifactHash,
      kind: "COUNTEREXAMPLE_STATE_CONFLICT" as const,
      stateIds: ["TT"],
      listingRefs: listings.map((listing) => listing.listingRef),
      explanation: "The retained prose reverses the structured state.",
      expectedInterpretation: "TT selects both exact YES outcomes.",
      observedConflict: "The prose describes one venue settling NO.",
      evidenceHashes: [constraint.ruleEvidence[0]!.sourceRawHash],
    };
    expect(() => buildProbabilityCaseChallenge({
      ...challengeDraft,
      stateIds: ["TF"],
    }, input)).toThrow(/exceeds its estimation case scope/u);
    expect(() => buildProbabilityCaseChallenge({
      ...challengeDraft,
      listingRefs: ["invented:contract"],
    }, input)).toThrow(/exceeds its estimation case scope/u);
    expect(() => buildProbabilityCaseChallenge({
      ...challengeDraft,
      evidenceHashes: [hashCanonical({ invented: "evidence" })],
    }, input)).toThrow(/exceeds its estimation case scope/u);
  });

  it("terminates through a structured semantic challenge before probability work", async () => {
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    let calls = 0;
    const usageLedger = new AiUsageLedger();
    const desk = createProbabilityEstimationDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_PROBABILITY_ESTIMATION_TIMEOUT_MS: "3000",
      },
      {
        usageRecorder: usageLedger,
        now: () => Date.parse("2026-08-02T00:02:15.000Z"),
        async fetcher() {
          calls += 1;
          return toolCompletion("challenge_probability_case", {
            interpretationArtifactHash: directInterpretationHash(),
            kind: "COUNTEREXAMPLE_STATE_CONFLICT",
            stateIds: ["TT"],
            listingRefs: listings.map((listing) => listing.listingRef),
            explanation: "The retained prose describes the reverse truth direction.",
            expectedInterpretation: "TT means both exact YES outcomes settle true.",
            observedConflict: "The counterexample narrative describes one listing settling NO.",
            evidenceHashes: [evidenceHash],
          }, calls);
        },
      },
    );
    const record = await desk.begin(review, snapshot, ["TT"], "INDEPENDENT").promise;
    expect(record).toMatchObject({
      schemaVersion: "pmh.probability-estimation-run.v4",
      status: "CHALLENGED",
      estimate: null,
      counterScenarios: [],
      evidenceNeeds: [],
      caseChallenge: {
        kind: "COUNTEREXAMPLE_STATE_CONFLICT",
        stateIds: ["TT"],
        authority: "SEMANTIC_REPAIR_REQUEST_ONLY",
        semanticDecisionAuthority: false,
      },
      trace: {
        stepCount: 1,
        toolCallCount: 1,
        caseAcknowledgementEffectCount: 0,
        caseChallengeEffectCount: 1,
      },
    });
    expect(calls).toBe(1);
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      byOutcome: [{ key: "CHALLENGED", durableEffectCount: "1" }],
      recentEvents: [{ outcome: "CHALLENGED", durableEffect: true }],
    });
    expect(() => assertProbabilityEstimationRunRecord(record)).not.toThrow();
    expect(buildProbabilityCaseRepairQueue({ runs: [record] })).toMatchObject({
      sourceChallengeCount: 1,
      itemCount: 1,
      items: [{
        kind: "COUNTEREXAMPLE_STATE_CONFLICT",
        roles: ["INDEPENDENT"],
        nextAction: "NEW_SEMANTIC_REVIEW_REQUIRED",
        providerRequestAuthority: false,
      }],
    });
  });

  it("retains provider usage when the estimator omits its terminal effect", async () => {
    const usageLedger = new AiUsageLedger();
    const desk = createProbabilityEstimationDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_PROBABILITY_ESTIMATION_TIMEOUT_MS: "3000",
      },
      {
        usageRecorder: usageLedger,
        now: () => Date.parse("2026-08-02T00:02:00.000Z"),
        async fetcher() {
          return deepSeekTextResponse("A numeric interval is not ready.", 1);
        },
      },
    );

    const record = await desk.begin(review, snapshot, ["TT"], "CAUSAL").promise;
    expect(record).toMatchObject({
      status: "FAILED",
      diagnostic: expect.stringContaining("without a terminal tool effect"),
    });
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      coverage: { complete: 1, unavailable: 0 },
      byPurpose: [{ key: "PROBABILITY_ESTIMATION", invocationCount: "1" }],
      byOutcome: [{ key: "FAILED", invocationCount: "1" }],
      totals: {
        durableEffectCount: "0",
        tokens: { inputTokens: "100", outputTokens: "20", totalTokens: "120" },
      },
    });
  });

  it("records typed evidence debt before abstaining through accepted need identities", async () => {
    const allowedEvidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    let callCount = 0;
    const desk = createProbabilityEstimationDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_PROBABILITY_ESTIMATION_TIMEOUT_MS: "3000",
      },
      {
        now: () => Date.parse("2026-08-02T00:02:30.000Z"),
        async fetcher(_request, init) {
          callCount += 1;
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          if (callCount === 1) return toolCompletion("accept_probability_case", {
            interpretationArtifactHash: directInterpretationHash(),
          }, callCount);
          if (callCount === 2) return toolCompletion("record_counter_scenario", {
            stateId: "TT",
            narrative: "Recovery can preserve the later live appearance.",
            evidenceHashes: [allowedEvidenceHash],
          }, callCount);
          if (callCount === 3) return toolCompletion("abstain_probability_estimate", {
            reason: "Premature abstention should be rejected.",
            evidenceNeedIds: [hashCanonical({ notAccepted: true })],
          }, callCount);
          if (callCount === 4) return toolCompletion("request_probability_evidence", {
            kind: "REFERENCE_CLASS",
            listingRefs: listings.map((listing) => listing.listingRef),
            adverseStateIds: ["TT"],
            question: "How often does a non-fatal injury permit a public appearance within one month?",
            reason: "The joint-state upper bound depends on recovery frequency.",
            satisfyingObservation: "A source-bound comparable cohort supplies an empirical rate.",
            contradictingObservation: "No comparable cohort with a usable denominator exists.",
            temporalPosture: "HISTORICAL_AT_SOURCE_OBSERVATION",
          }, callCount);
          const needId = JSON.stringify(body).match(
            /needId.{0,80}(sha256:[0-9a-f]{64})/u,
          )?.[1];
          expect(needId).toBeDefined();
          return toolCompletion("abstain_probability_estimate", {
            reason: "A numeric interval would fabricate the missing recovery base rate.",
            evidenceNeedIds: [needId],
          }, callCount);
        },
      },
    );

    const record = await desk.begin(review, snapshot, ["TT"], "REFERENCE_CLASS").promise;
    expect(record).toMatchObject({
      schemaVersion: "pmh.probability-estimation-run.v4",
      inputProtocol: "pmh.probability-estimation-input.v4",
      status: "ABSTAINED",
      evidenceNeeds: [{
        kind: "REFERENCE_CLASS",
        route: "REFERENCE_DATA_RESEARCH",
        acquisitionRequirement: null,
        fetchAuthority: false,
      }],
      trace: {
        stepCount: 5,
        toolCallCount: 5,
        evidenceNeedEffectCount: 1,
        caseAcknowledgementEffectCount: 1,
        caseChallengeEffectCount: 0,
      },
    });
    expect(record.blockingEvidenceNeedIds).toEqual([
      record.evidenceNeeds![0]!.needId,
    ]);
    expect(callCount).toBe(5);
  });

  it("binds Codex OAuth, Terra effort, streaming posture, and usage to each run", async () => {
    const secret = "test-only-codex-probability-token";
    const bodies: Record<string, unknown>[] = [];
    let configuration: AiRuntimeConfiguration = Object.freeze({
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 1,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: "2026-08-02T00:00:00.000Z",
    });
    const usageLedger = new AiUsageLedger();
    const allowedEvidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const desk = createProbabilityEstimationDesk(
      { PMH_PROBABILITY_ESTIMATION_TIMEOUT_MS: "3000" },
      {
        runtimeConfiguration: () => configuration,
        usageRecorder: usageLedger,
        now: () => Date.parse("2026-08-02T00:02:00.000Z"),
        codexCredentialProvider: codexCredentialForTest(
          secret,
          "probability-account-test",
        ),
        async codexFetcher(request, init) {
          expect(String(request)).toBe("https://chatgpt.com/backend-api/codex/responses");
          const headers = new Headers(init?.headers);
          expect(headers.get("authorization")).toBe(`Bearer ${secret}`);
          expect(headers.get("chatgpt-account-id")).toBe("probability-account-test");
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          bodies.push(body);
          const ordinal = bodies.length;
          const phase = (ordinal - 1) % 3;
          return phase === 0
            ? openAiStreamToolResponse("accept_probability_case", {
                interpretationArtifactHash: directInterpretationHash(),
              }, ordinal)
            : phase === 1
              ? openAiStreamToolResponse("record_counter_scenario", {
                stateId: "TT",
                narrative: "A non-fatal wound followed by recovery permits both events.",
                evidenceHashes: [allowedEvidenceHash],
              }, ordinal)
            : openAiStreamToolResponse("submit_probability_estimate", {
                lowerPpm: "20000",
                upperPpm: configuration.codexReasoningEffort === "high"
                  ? "50000"
                  : "60000",
                evidenceHashes: [allowedEvidenceHash],
                assumptions: ["Recorded appearances do not count."],
                validForMs: 3_600_000,
                rationale: "Bounded Terra estimate.",
              }, ordinal);
        },
      },
    );

    const high = await desk.begin(review, snapshot, ["TT"], "CAUSAL").promise;
    expect(high).toMatchObject({
      schemaVersion: "pmh.probability-estimation-run.v4",
      status: "PASS",
      model: "gpt-5.6-terra",
      engine: {
        provider: "CODEX",
        model: "gpt-5.6-terra",
        reasoningEffort: "high",
        responseStorage: false,
      },
      estimate: { estimator: "CODEX:gpt-5.6-terra:CAUSAL", upperPpm: "50000" },
    });
    expect(bodies).toHaveLength(3);
    expect(bodies.every((body) =>
      body.stream === true && body.store === false &&
      !("max_output_tokens" in body) && !("response_format" in body)
    )).toBe(true);
    expect(bodies[0]).toMatchObject({
      model: "gpt-5.6-terra",
      reasoning: { effort: "high" },
      parallel_tool_calls: false,
      tool_choice: "required",
    });
    expect(usageLedger.projection().recentEvents[0]).toMatchObject({
      purpose: "PROBABILITY_ESTIMATION",
      provider: "CODEX",
      model: "gpt-5.6-terra",
      outcome: "SUCCEEDED",
      providerRequestCount: "3",
    });
    expect(JSON.stringify({ high, projection: desk.projection() })).not.toContain(secret);

    configuration = Object.freeze({
      ...configuration,
      revision: 2,
      codexReasoningEffort: "max",
      updatedAt: "2026-08-02T00:01:00.000Z",
    });
    const max = await desk.begin(review, snapshot, ["TT"], "CAUSAL").promise;
    expect(max.runId).not.toBe(high.runId);
    expect(max).toMatchObject({
      engine: { provider: "CODEX", reasoningEffort: "max" },
      estimate: { upperPpm: "60000" },
    });
    expect(bodies[3]).toMatchObject({ reasoning: { effort: "max" } });
  });

  it("aggregates separate role runs conservatively and replays idempotently", async () => {
    let calls = 0;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        now: () => Date.parse("2026-08-02T00:03:00.000Z"),
        estimator: {
          async estimate(input) {
            calls += 1;
            const upperPpm = input.role === "REFERENCE_CLASS" ? "40000" : "60000";
            const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
            return Object.freeze({
              status: "SUBMITTED" as const,
              lowerPpm: "10000",
              upperPpm,
              evidenceHashes: Object.freeze([evidenceHash]),
              assumptions: Object.freeze(["Bounded fixture assumption."]),
              validForMs: 3_600_000,
              rationale: `${input.role} estimate.`,
              counterScenarios: Object.freeze([{
                stateId: "TT",
                narrative: "Recovery preserves the adverse state.",
                evidenceHashes: Object.freeze([evidenceHash]),
              }]),
              trace: Object.freeze({
                protocol: "AI_SDK_TOOL_LOOP" as const,
                maximumSteps: 10 as const,
                stepCount: 3,
                toolCallCount: 3,
                providerRequestAttemptCount: 3,
                counterScenarioEffectCount: 1,
                evidenceNeedEffectCount: 0,
                caseAcknowledgementEffectCount: 1,
                caseChallengeEffectCount: 0,
                submittedEffectHash: hashCanonical({ role: input.role }),
                wholeResponseSchemaParsing: false as const,
              }),
            });
          },
        },
      },
    );
    const reference = await desk.begin(review, snapshot, ["TT"], "REFERENCE_CLASS").promise;
    const independent = await desk.begin(review, snapshot, ["TT"], "INDEPENDENT").promise;
    const replay = desk.begin(review, snapshot, ["TT"], "REFERENCE_CLASS");
    expect(replay.idempotentReplay).toBe(true);
    expect((await replay.promise).runId).toBe(reference.runId);
    expect(calls).toBe(2);

    const bound = buildProbabilisticSemanticBound({
      semanticConstraint: constraint,
      adverseStateIds: ["TT"],
      estimates: [reference.estimate!, independent.estimate!],
      counterScenarios: [
        ...reference.counterScenarios.map((item) => item.narrative),
        ...independent.counterScenarios.map((item) => item.narrative),
      ],
    });
    expect(bound).toMatchObject({
      lowerPpm: "10000",
      epsilonPpm: "60000",
      estimates: [
        { method: "REFERENCE_CLASS" },
        { method: "INDEPENDENT_JUDGMENT" },
      ],
    });
    expect(desk.projection()).toMatchObject({
      configured: true,
      runCount: 2,
      passCount: 2,
      abstainedCount: 0,
      authority: "ESTIMATION_ORCHESTRATION_ONLY",
    });
  });

  it("makes abstention a successful bounded effect instead of fabricating a number", async () => {
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        now: () => Date.parse("2026-08-02T00:04:00.000Z"),
        estimator: {
          async estimate(input) {
            const need = buildProbabilityEvidenceNeed({
              kind: "REFERENCE_CLASS",
              listingRefs: input.listings.map((listing) => listing.listingRef),
              adverseStateIds: ["TT"],
              question: "What is the recovery-to-public-appearance reference rate?",
              reason: "The supplied rules establish possibility but not frequency.",
              satisfyingObservation: "A source-bound cohort quantifies recovery before appearance.",
              contradictingObservation: "No comparable historical cohort can be constructed.",
              temporalPosture: "HISTORICAL_AT_SOURCE_OBSERVATION",
            }, input);
            return Object.freeze({
              status: "ABSTAINED" as const,
              lowerPpm: null,
              upperPpm: null,
              evidenceHashes: Object.freeze([]),
              assumptions: Object.freeze(["Missing recovery reference class."]),
              validForMs: null,
              rationale: "The supplied rules establish possibility but not a numeric frequency bound.",
              counterScenarios: Object.freeze([{
                stateId: "TT",
                narrative: "A fast recovery remains possible.",
                evidenceHashes: Object.freeze([evidenceHash]),
              }]),
              evidenceNeeds: Object.freeze([need]),
              blockingEvidenceNeedIds: Object.freeze([need.needId]),
              trace: Object.freeze({
                protocol: "AI_SDK_TOOL_LOOP" as const,
                maximumSteps: 10 as const,
                stepCount: 3,
                toolCallCount: 4,
                providerRequestAttemptCount: 3,
                counterScenarioEffectCount: 1,
                evidenceNeedEffectCount: 1,
                caseAcknowledgementEffectCount: 1,
                caseChallengeEffectCount: 0,
                submittedEffectHash: hashCanonical({ abstain: true }),
                wholeResponseSchemaParsing: false as const,
              }),
            });
          },
        },
      },
    );
    const record = await desk.begin(review, snapshot, ["TT"], "INDEPENDENT").promise;
    expect(record).toMatchObject({
      status: "ABSTAINED",
      estimate: null,
      diagnostic: "The supplied rules establish possibility but not a numeric frequency bound.",
      authority: "ESTIMATE_ONLY",
    });
    expect(() => assertProbabilityEstimationRunRecord(record)).not.toThrow();
  });

  it("deduplicates cross-role research debt and compiles official gaps for acquisition", async () => {
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        now: () => Date.parse("2026-08-02T00:04:30.000Z"),
        estimator: {
          async estimate(input) {
            const official = input.role === "INDEPENDENT";
            if (input.role === "REFERENCE_CLASS") {
              expect(() => buildProbabilityEvidenceNeed({
                kind: "REFERENCE_CLASS",
                listingRefs: ["invented:listing"],
                adverseStateIds: ["TT"],
                question: "Invented scope?",
                reason: "Must fail.",
                satisfyingObservation: "None.",
                contradictingObservation: "None.",
                temporalPosture: "CURRENT",
              }, input)).toThrow(/case scope/u);
              expect(() => buildProbabilityEvidenceNeed({
                kind: "REFERENCE_CLASS",
                listingRefs: [input.listings[0]!.listingRef],
                adverseStateIds: ["FF"],
                question: "Invented adverse state?",
                reason: "Must fail.",
                satisfyingObservation: "None.",
                contradictingObservation: "None.",
                temporalPosture: "CURRENT",
              }, input)).toThrow(/case scope/u);
            }
            const need = buildProbabilityEvidenceNeed({
              kind: official ? "RESOLUTION_RULE" : "REFERENCE_CLASS",
              listingRefs: input.listings.map((listing) => listing.listingRef),
              adverseStateIds: ["TT"],
              question: official
                ? "What exact venue rule governs cancellation and delayed resolution?"
                : "What is the recovery-to-public-appearance reference rate?",
              reason: official
                ? "Settlement treatment changes whether TT is observable."
                : "The joint-state upper bound depends on a historical frequency.",
              satisfyingObservation: official
                ? "An official contract rule states the treatment."
                : "A source-bound cohort supplies an empirical rate.",
              contradictingObservation: official
                ? "The official rule explicitly leaves the treatment discretionary."
                : "No comparable cohort with a denominator exists.",
              temporalPosture: official
                ? "CURRENT"
                : "HISTORICAL_AT_SOURCE_OBSERVATION",
            }, input);
            return Object.freeze({
              status: "ABSTAINED" as const,
              lowerPpm: null,
              upperPpm: null,
              evidenceHashes: Object.freeze([]),
              assumptions: Object.freeze([need.question]),
              validForMs: null,
              rationale: "The requested evidence is required before a numeric interval.",
              counterScenarios: Object.freeze([{
                stateId: "TT",
                narrative: "Recovery preserves the adverse state.",
                evidenceHashes: Object.freeze([evidenceHash]),
              }]),
              evidenceNeeds: Object.freeze([need]),
              blockingEvidenceNeedIds: Object.freeze([need.needId]),
              trace: Object.freeze({
                protocol: "AI_SDK_TOOL_LOOP" as const,
                maximumSteps: 10 as const,
                stepCount: 4,
                toolCallCount: 4,
                providerRequestAttemptCount: 4,
                counterScenarioEffectCount: 1,
                evidenceNeedEffectCount: 1,
                caseAcknowledgementEffectCount: 1,
                caseChallengeEffectCount: 0,
                submittedEffectHash: hashCanonical({ role: input.role, need: need.needId }),
                wholeResponseSchemaParsing: false as const,
              }),
            });
          },
        },
      },
    );
    await Promise.all([
      desk.begin(review, snapshot, ["TT"], "REFERENCE_CLASS").promise,
      desk.begin(review, snapshot, ["TT"], "CAUSAL").promise,
      desk.begin(review, snapshot, ["TT"], "INDEPENDENT").promise,
    ]);
    const debt = buildProbabilityEvidenceDebt({
      runs: desk.projection().records,
      estimatorJobs: [],
      acquisitionJobs: [],
    });
    expect(debt).toMatchObject({
      sourceRunCount: 3,
      sourceNeedCount: 3,
      itemCount: 2,
      blockingItemCount: 2,
      counts: {
        ACQUISITION_ROUTE_MISSING: 1,
        EXTERNAL_SOURCE_POLICY_REQUIRED: 1,
      },
      authority: "RESEARCH_PRIORITY_ONLY",
      fetchAuthority: false,
      providerRequestAuthority: false,
    });
    const reference = debt.items.find((item) => item.kind === "REFERENCE_CLASS")!;
    expect(reference.roles).toEqual(["CAUSAL", "REFERENCE_CLASS"]);
    expect(reference.runIds).toHaveLength(2);
    const official = debt.items.find((item) => item.kind === "RESOLUTION_RULE")!;
    expect(official.acquisitionRequirementIds).toHaveLength(1);
    expect(desk.projection().records.find((record) =>
      record.role === "INDEPENDENT"
    )?.evidenceNeeds?.[0]?.acquisitionRequirement).toMatchObject({
      origin: "PROBABILITY_ESTIMATION",
      kind: "RESOLUTION_RULE",
      acquisitionRoute: "UNSUPPORTED",
      fetchAuthority: false,
    });
  });

  it("persists terminal runs and converts interrupted work into retryable failure on restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-probability-estimation-"));
    const path = join(directory, "operations.sqlite");
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: firstStore,
          now: () => Date.parse("2026-08-02T00:05:00.000Z"),
          estimator: {
            async estimate() {
              return await new Promise<never>(() => undefined);
            },
          },
        },
      );
      firstDesk.begin(review, snapshot, ["TT"], "CAUSAL");
      expect(firstDesk.projection().records[0]).toMatchObject({ status: "RUNNING" });
      expect(firstStore.loadProbabilityEstimationRunRecords(10)[0]).toMatchObject({
        status: "RUNNING",
      });
      firstStore.close();

      const legacyVersion = new DatabaseSync(path);
      legacyVersion.exec("PRAGMA user_version = 32");
      legacyVersion.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: secondStore,
          now: () => Date.parse("2026-08-02T00:06:00.000Z"),
          estimator: {
            async estimate(input) {
              return Object.freeze({
                status: "SUBMITTED" as const,
                lowerPpm: "10000",
                upperPpm: "70000",
                evidenceHashes: Object.freeze([evidenceHash]),
                assumptions: Object.freeze([
                  "The historical cohort must match the contract time window.",
                ]),
                validForMs: 3_600_000,
                rationale: "Restarted estimate.",
                counterScenarios: Object.freeze([{
                  stateId: "TT",
                  narrative: "Non-fatal recovery remains the adverse route.",
                  evidenceHashes: Object.freeze([evidenceHash]),
                }]),
                trace: Object.freeze({
                  protocol: "AI_SDK_TOOL_LOOP" as const,
                  maximumSteps: 10 as const,
                  stepCount: 3,
                  toolCallCount: 3,
                  providerRequestAttemptCount: 3,
                  counterScenarioEffectCount: 1,
                  evidenceNeedEffectCount: 0,
                  caseAcknowledgementEffectCount: 1,
                  caseChallengeEffectCount: 0,
                  submittedEffectHash: hashCanonical({ restarted: input.role }),
                  wholeResponseSchemaParsing: false as const,
                }),
              });
            },
          },
        },
      );
      expect(secondDesk.projection().records[0]).toMatchObject({
        status: "FAILED",
        diagnostic: "probability estimation was interrupted by process restart",
      });
      const retried = secondDesk.begin(review, snapshot, ["TT"], "CAUSAL");
      expect(retried.idempotentReplay).toBe(false);
      expect(await retried.promise).toMatchObject({ status: "PASS" });
      expect(secondStore.loadProbabilityEstimationRunRecords(10)[0]).toMatchObject({
        status: "PASS",
        estimate: { upperPpm: "70000" },
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("replays typed evidence debt from SQLite without invoking an estimator", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-probability-debt-"));
    const path = join(directory, "operations.sqlite");
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: firstStore,
          now: () => Date.parse("2026-08-02T00:07:00.000Z"),
          estimator: {
            async estimate(input) {
              const need = buildProbabilityEvidenceNeed({
                kind: "REFERENCE_CLASS",
                listingRefs: input.listings.map((listing) => listing.listingRef),
                adverseStateIds: ["TT"],
                question: "What fraction of comparable injuries permit a later public appearance?",
                reason: "The semantic relationship does not identify the empirical recovery rate.",
                satisfyingObservation: "A source-bound cohort supplies a numerator and denominator.",
                contradictingObservation: "No cohort comparable on injury severity and time window exists.",
                temporalPosture: "HISTORICAL_AT_SOURCE_OBSERVATION",
              }, input);
              return Object.freeze({
                status: "ABSTAINED" as const,
                lowerPpm: null,
                upperPpm: null,
                evidenceHashes: Object.freeze([]),
                assumptions: Object.freeze([
                  "The historical cohort must match the contract time window.",
                ]),
                validForMs: null,
                rationale: "A numeric interval requires a calibrated reference class.",
                counterScenarios: Object.freeze([{
                  stateId: "TT",
                  narrative: "Recovery preserves the joint state.",
                  evidenceHashes: Object.freeze([evidenceHash]),
                }]),
                evidenceNeeds: Object.freeze([need]),
                blockingEvidenceNeedIds: Object.freeze([need.needId]),
                trace: Object.freeze({
                  protocol: "AI_SDK_TOOL_LOOP" as const,
                  maximumSteps: 10 as const,
                  stepCount: 3,
                  toolCallCount: 4,
                  providerRequestAttemptCount: 3,
                  counterScenarioEffectCount: 1,
                  evidenceNeedEffectCount: 1,
                  caseAcknowledgementEffectCount: 1,
                  caseChallengeEffectCount: 0,
                  submittedEffectHash: hashCanonical({ persistedNeed: need.needId }),
                  wholeResponseSchemaParsing: false as const,
                }),
              });
            },
          },
        },
      );
      const original = await firstDesk.begin(
        review,
        snapshot,
        ["TT"],
        "REFERENCE_CLASS",
      ).promise;
      expect(original).toMatchObject({ status: "ABSTAINED" });
      firstStore.close();

      let estimatorInvoked = false;
      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: secondStore,
          estimator: {
            async estimate() {
              estimatorInvoked = true;
              throw new Error("durable replay must not invoke the estimator");
            },
          },
        },
      );
      const replayed = secondDesk.projection().records[0]!;
      expect(replayed).toEqual(original);
      expect(estimatorInvoked).toBe(false);
      expect(buildProbabilityEvidenceDebt({
        runs: [replayed],
        estimatorJobs: [],
        acquisitionJobs: [],
      })).toMatchObject({
        sourceNeedCount: 1,
        itemCount: 1,
        blockingItemCount: 1,
        items: [{
          needId: original.evidenceNeeds![0]!.needId,
          status: "EXTERNAL_SOURCE_POLICY_REQUIRED",
          fetchAuthority: false,
          providerRequestAuthority: false,
        }],
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("durable probability estimation scheduling", () => {
  it("derives relation-specific adverse states and assembles two independent roles", async () => {
    expect(deriveProbabilityAdverseStates(constraint)).toEqual({
      status: "SUPPORTED",
      adverseStateIds: ["TT"],
      diagnostic: null,
    });
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        now: () => Date.parse("2026-08-02T00:10:00.000Z"),
        estimator: {
          async estimate(input) {
            const abstained = input.role === "CAUSAL";
            const need = abstained ? buildProbabilityEvidenceNeed({
              kind: "REFERENCE_CLASS",
              listingRefs: input.listings.map((listing) => listing.listingRef),
              adverseStateIds: ["TT"],
              question: "What fraction of non-fatal injuries permit a later public appearance?",
              reason: "The causal branch lacks a calibrated recovery cohort.",
              satisfyingObservation: "A source-bound comparable cohort supplies the rate.",
              contradictingObservation: "No comparable cohort can be defined.",
              temporalPosture: "HISTORICAL_AT_SOURCE_OBSERVATION",
            }, input) : null;
            return Object.freeze({
              status: abstained ? "ABSTAINED" as const : "SUBMITTED" as const,
              lowerPpm: abstained ? null : "10000",
              upperPpm: abstained ? null : input.role === "REFERENCE_CLASS"
                ? "40000"
                : "60000",
              evidenceHashes: abstained ? Object.freeze([]) : Object.freeze([evidenceHash]),
              assumptions: Object.freeze(abstained
                ? ["Missing a calibrated recovery cohort."]
                : ["The public appearance requires Trump in person."]),
              validForMs: abstained ? null : 3_600_000,
              rationale: abstained
                ? "The causal role abstains without a recovery reference class."
                : `${input.role} bounded the surviving TT state.`,
              counterScenarios: Object.freeze([{
                stateId: "TT",
                narrative: "A non-fatal wound followed by recovery permits both events.",
                evidenceHashes: Object.freeze([evidenceHash]),
              }]),
              evidenceNeeds: Object.freeze(need === null ? [] : [need]),
              blockingEvidenceNeedIds: Object.freeze(
                need === null ? [] : [need.needId],
              ),
              trace: Object.freeze({
                protocol: "AI_SDK_TOOL_LOOP" as const,
                maximumSteps: 10 as const,
                stepCount: abstained ? 4 : 3,
                toolCallCount: abstained ? 4 : 3,
                providerRequestAttemptCount: 3,
                counterScenarioEffectCount: 1,
                evidenceNeedEffectCount: abstained ? 1 : 0,
                caseAcknowledgementEffectCount: 1,
                caseChallengeEffectCount: 0,
                submittedEffectHash: hashCanonical({ role: input.role }),
                wholeResponseSchemaParsing: false as const,
              }),
            });
          },
        },
      },
    );
    const scheduler = new ProbabilityEstimationScheduler({
      desk,
      tickIntervalMs: 1_000,
      maxRequestsPerTick: 3,
      concurrencyLimit: 3,
      now: () => Date.parse("2026-08-02T00:10:00.000Z"),
    });
    const issueId = hashCanonical({ issue: "physical co-occurrence scheduler" });
    const searchOrigin = buildProbabilitySearchOrigin({
      issueIds: [issueId],
      semanticFamilies: ["PHYSICAL_CO_OCCURRENCE"],
    });
    const runs = scheduler.tick([{ review, searchOrigin }], snapshot);
    expect(runs).toHaveLength(3);
    await Promise.all(runs);

    const projection = scheduler.projection();
    expect(projection).toMatchObject({
      caseCount: 1,
      passedCount: 2,
      abstainedCount: 1,
      boundReadyCount: 1,
      freshBoundCount: 1,
      unreadNotificationCount: 1,
      authority: "ESTIMATION_ORCHESTRATION_ONLY",
      probabilityCertificateAuthority: false,
      executionAuthority: false,
    });
    expect(projection.bounds[0]).toMatchObject({
      schemaVersion: "pmh.probabilistic-semantic-bound.v2",
      adverseStateIds: ["TT"],
      epsilonPpm: "60000",
      searchOrigin: {
        issueIds: [issueId],
        semanticFamilies: ["PHYSICAL_CO_OCCURRENCE"],
      },
      authority: "ESTIMATE_ONLY",
      probabilityCertificateAuthority: false,
    });
    expect(projection.jobs.every((job) =>
      job.schemaVersion === "pmh.probability-estimation-job.v7" &&
      job.engine?.provider === "DEEPSEEK" &&
      job.evidenceContext?.sourceKind === "CURRENT_CATALOG_EXACT" &&
      job.searchOrigin?.originIdentity === searchOrigin.originIdentity
    )).toBe(true);
    expect(projection.bounds[0]!.estimates.map((item) => item.method).sort()).toEqual([
      "INDEPENDENT_JUDGMENT",
      "REFERENCE_CLASS",
    ]);
    expect(projection.notifications[0]).toMatchObject({
      kind: "BOUND_READY",
      status: "UNREAD",
      boundArtifactHash: projection.bounds[0]!.artifactHash,
    });
    scheduler.acknowledge(projection.notifications[0]!.notificationId);
    expect(scheduler.projection().unreadNotificationCount).toBe(0);
  });

  it("persists a challenged case as semantic repair instead of retrying or bounding", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-probability-challenge-"));
    const path = join(directory, "operations.sqlite");
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    let calls = 0;
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: firstStore,
          now: () => Date.parse("2026-08-02T00:12:00.000Z"),
          estimator: {
            async estimate(input) {
              calls += 1;
              const challenge = buildProbabilityCaseChallenge({
                interpretationArtifactHash:
                  input.adverseStateInterpretation.artifactHash,
                kind: "COUNTEREXAMPLE_STATE_CONFLICT",
                stateIds: ["TT"],
                listingRefs: input.listings.map((listing) => listing.listingRef),
                explanation: "The retained counterexample prose reverses the structured state.",
                expectedInterpretation: "TT selects both exact YES outcomes.",
                observedConflict: "The prose describes one venue settling NO.",
                evidenceHashes: [evidenceHash],
              }, input);
              return Object.freeze({
                status: "CHALLENGED" as const,
                lowerPpm: null,
                upperPpm: null,
                evidenceHashes: Object.freeze([]),
                assumptions: Object.freeze([]),
                validForMs: null,
                rationale: challenge.explanation,
                counterScenarios: Object.freeze([]),
                evidenceNeeds: Object.freeze([]),
                blockingEvidenceNeedIds: Object.freeze([]),
                caseChallenge: challenge,
                trace: Object.freeze({
                  protocol: "AI_SDK_TOOL_LOOP" as const,
                  maximumSteps: 10 as const,
                  stepCount: 1,
                  toolCallCount: 1,
                  providerRequestAttemptCount: 1,
                  counterScenarioEffectCount: 0,
                  evidenceNeedEffectCount: 0,
                  caseAcknowledgementEffectCount: 0,
                  caseChallengeEffectCount: 1,
                  submittedEffectHash: challenge.challengeId,
                  wholeResponseSchemaParsing: false as const,
                }),
              });
            },
          },
        },
      );
      const firstScheduler = new ProbabilityEstimationScheduler({
        desk: firstDesk,
        store: firstStore,
        tickIntervalMs: 1_000,
        concurrencyLimit: 3,
        maxRequestsPerTick: 3,
        now: () => Date.parse("2026-08-02T00:12:00.000Z"),
      });
      await Promise.all(firstScheduler.tick([{ review }], snapshot));
      expect(firstScheduler.projection()).toMatchObject({
        challengedCount: 3,
        passedCount: 0,
        abstainedCount: 0,
        boundReadyCount: 0,
        notifications: [{ kind: "SEMANTIC_REPAIR_REQUIRED" }],
      });
      const challengedCaseIdentity = firstScheduler.projection().jobs[0]!.caseIdentity;
      expect(() => firstScheduler.retryExhaustedCase(challengedCaseIdentity)).toThrow(
        /requires a new semantic review/u,
      );
      const repairQueue = buildProbabilityCaseRepairQueue({
        runs: firstDesk.projection().records,
      });
      expect(repairQueue).toMatchObject({
        sourceChallengeCount: 3,
        itemCount: 1,
        items: [{ roles: ["CAUSAL", "INDEPENDENT", "REFERENCE_CLASS"] }],
      });
      const repairRequest = buildProbabilitySemanticRepairRequest({
        item: repairQueue.items[0]!,
        sourceReviewId: review.reviewId,
        sourceSemanticConstraint: constraint,
      });
      expect(repairRequest).toMatchObject({
        generation: 1,
        admission: "AUTOMATIC_MULTI_ROLE",
        sourceReviewId: review.reviewId,
        sourceSemanticReviewArtifactHash: review.report!.artifactHash,
        sourceSemanticConstraint: { artifactHash: constraint.artifactHash },
        adverseStateInterpretation: {
          artifactHash: repairQueue.items[0]!.interpretationArtifactHash,
        },
        roles: ["CAUSAL", "INDEPENDENT", "REFERENCE_CLASS"],
        authority: "SEMANTIC_REVIEW_INPUT_ONLY",
        providerRequestAuthority: false,
      });
      expect(() => buildProbabilitySemanticRepairRequest({
        item: { ...repairQueue.items[0]!, stateIds: ["TF"] },
        sourceReviewId: review.reviewId,
        sourceSemanticConstraint: constraint,
      })).toThrow(/input lineage/u);
      const singleRoleRequest = buildProbabilitySemanticRepairRequest({
        item: {
          ...repairQueue.items[0]!,
          roles: Object.freeze(["CAUSAL" as const]),
        },
        sourceReviewId: review.reviewId,
        sourceSemanticConstraint: constraint,
      });
      expect(singleRoleRequest).toMatchObject({
        generation: 1,
        admission: "MANUAL_SINGLE_ROLE",
      });

      const successorRequest = (
        parent: typeof repairRequest,
        generation: number,
      ): typeof repairRequest => {
        const { artifactHash: _artifactHash, ...constraintFields } = constraint;
        const constraintBody = Object.freeze({
          ...constraintFields,
          assumptions: Object.freeze([`semantic repair generation ${generation}`]),
        });
        const successorConstraint = Object.freeze({
          ...constraintBody,
          artifactHash: hashCanonical(constraintBody),
        });
        const successorInterpretation = buildProbabilityAdverseStateInterpretation({
          semanticConstraint: successorConstraint,
          evidenceContextIdentity: hashCanonical({ repairEvidence: generation }),
          listings,
          adverseStateIds: ["TT"],
        });
        return buildProbabilitySemanticRepairRequest({
          item: {
            ...repairQueue.items[0]!,
            repairId: hashCanonical({ repairGroup: generation }),
            sourceSemanticReviewArtifactHash: hashCanonical({ repairReport: generation }),
            semanticConstraintArtifactHash: successorConstraint.artifactHash,
            interpretationArtifactHash: successorInterpretation.artifactHash,
            adverseStateInterpretation: successorInterpretation,
          },
          sourceReviewId: hashCanonical({ repairedReview: generation }),
          sourceSemanticConstraint: successorConstraint,
          parentRepairRequest: parent,
        });
      };
      const generationTwo = successorRequest(repairRequest, 2);
      const generationThree = successorRequest(generationTwo, 3);
      const generationFour = successorRequest(generationThree, 4);
      expect([
        generationTwo.admission,
        generationThree.admission,
        generationFour.admission,
      ]).toEqual([
        "AUTOMATIC_MULTI_ROLE",
        "AUTOMATIC_MULTI_ROLE",
        "MANUAL_GENERATION_LIMIT",
      ]);
      expect(() => successorRequest(generationFour, 5)).toThrow(/input lineage/u);

      let repairProviderCalls = 0;
      let observedRepairRequestId: string | null = null;
      const semanticDesk = createSemanticReviewDesk({}, {
        store: firstStore,
        reviewer: {
          async review(input) {
            repairProviderCalls += 1;
            observedRepairRequestId = input.repairRequest?.requestId ?? null;
            return Object.freeze({
              recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
              relationConclusion: "MUTUALLY_EXCLUSIVE" as const,
              assessments: Object.freeze({
                outcomeMapping: "The exact binary labels map directly.",
                timingAndClose: "The later public act follows the earlier event window.",
                voidAndCancellation: "No hard exclusion is claimed.",
                resolutionSources: "Each venue retains independent resolution authority.",
              }),
              counterexamples: Object.freeze([
                "A non-fatal injury followed by recovery concretely preserves TT.",
              ]),
              missingEvidence: Object.freeze([]),
              evidenceRequirementDrafts: Object.freeze([]),
              rationale: "The repaired state direction retains a probabilistic relation.",
              constraintDraft: Object.freeze({
                classification: "PROBABILISTIC_DEPENDENCE" as const,
                relationKind: "MUTUALLY_EXCLUSIVE" as const,
                assumptions: Object.freeze([]),
                counterexampleAttempt: Object.freeze({
                  attempted: true,
                  result: "FOUND" as const,
                  narrative: "A non-fatal injury followed by recovery concretely preserves TT.",
                  truths: Object.freeze([true, true]),
                }),
                truthTable: Object.freeze([
                  [false, false], [false, true], [true, false], [true, true],
                ].map((truths) => Object.freeze({
                  truths: Object.freeze(truths),
                  disposition: "FEASIBLE" as const,
                  rationale: truths[0] && truths[1]
                    ? "This is the repaired adverse recovery state."
                    : "The joint state remains feasible.",
                  evidenceListingRefs: Object.freeze([...proposal.listingRefs]),
                }))),
                unresolvedEvidence: Object.freeze([]),
              }),
            });
          },
        },
      });
      const semanticScheduler = new SemanticReviewScheduler({
        reviewDesk: semanticDesk,
        store: firstStore,
        tickIntervalMs: 1_000,
        now: () => Date.parse("2026-08-02T00:12:30.000Z"),
      });
      const semanticCandidate = Object.freeze({
        proposal,
        proposalCorpusSnapshotIdentity: snapshot.snapshotIdentity,
        evidenceBundle: buildProposalEvidenceBundle(proposal, snapshot),
        issueIds: Object.freeze([hashCanonical({ issue: "repair-loop" })]),
        priority: 5 as const,
      });
      semanticScheduler.reconcile([semanticCandidate], [review]);
      const singleRoleQueue = Object.freeze({
        ...repairQueue,
        items: Object.freeze([Object.freeze({
          ...repairQueue.items[0]!,
          roles: Object.freeze(["CAUSAL" as const]),
        })]),
      });
      expect(semanticScheduler.reconcileProbabilityCaseRepairs(singleRoleQueue, [review]))
        .toMatchObject({
          enqueuedRequestIds: [],
          manualRequestIds: [singleRoleRequest.requestId],
          providerRequestsStarted: 0,
        });
      const enqueue = semanticScheduler.reconcileProbabilityCaseRepairs(
        repairQueue,
        [],
        firstScheduler.projection().jobs,
      );
      expect(enqueue).toMatchObject({
        sourceItemCount: 1,
        enqueuedRequestIds: [repairRequest.requestId],
        providerRequestsStarted: 0,
        authority: "REPAIR_ENQUEUE_ONLY",
      });
      expect(semanticScheduler.projection().jobs[0]).toMatchObject({
        schemaVersion: "pmh.semantic-review-job.v5",
        status: "PENDING",
        attemptCount: 0,
        lastReviewId: null,
        repairRequest: { requestId: repairRequest.requestId, generation: 1 },
      });
      expect(buildProbabilitySemanticRepairProgress({
        queue: repairQueue,
        jobs: semanticScheduler.projection().jobs,
        reviews: [review],
      })).toMatchObject({
        pendingCount: 1,
        runningCount: 0,
        repairedCount: 0,
        items: [{
          status: "REVIEW_PENDING",
          nextAction: "WAIT_FOR_SEMANTIC_REVIEW",
          generation: 1,
          requestId: repairRequest.requestId,
        }],
      });
      expect(semanticScheduler.reconcileProbabilityCaseRepairs(repairQueue, [review]))
        .toMatchObject({
          enqueuedRequestIds: [],
          retainedRequestIds: [repairRequest.requestId],
          providerRequestsStarted: 0,
        });
      expect(repairProviderCalls).toBe(0);
      const repairRuns = semanticScheduler.tick([semanticCandidate], snapshot);
      expect(repairRuns).toHaveLength(1);
      await Promise.all(repairRuns);
      expect(repairProviderCalls).toBe(1);
      expect(observedRepairRequestId).toBe(repairRequest.requestId);
      const repairedJob = semanticScheduler.projection().jobs[0]!;
      expect(repairedJob).toMatchObject({
        schemaVersion: "pmh.semantic-review-job.v5",
        status: "PASS",
        repairRequest: { requestId: repairRequest.requestId },
        reviewOutcome: { reportSchemaVersion: "pmh.semantic-review-report.v5" },
      });
      const repairedReview = semanticDesk.projection().records.find((item) =>
        item.reviewId === repairedJob.lastReviewId
      )!;
      expect(repairedReview).toMatchObject({
        status: "PASS",
        repairRequest: { requestId: repairRequest.requestId },
        report: {
          schemaVersion: "pmh.semantic-review-report.v5",
          input: {
            evidencePosture: "SEMANTIC_REPAIR_SCOPE",
            repairRequest: { requestId: repairRequest.requestId },
          },
          result: {
            semanticConstraint: { classification: "PROBABILISTIC_DEPENDENCE" },
          },
        },
      });
      expect(repairedReview.report!.result.semanticConstraint!.artifactHash)
        .not.toBe(constraint.artifactHash);
      expect(buildProbabilitySemanticRepairProgress({
        queue: repairQueue,
        jobs: semanticScheduler.projection().jobs,
        reviews: [review, ...semanticDesk.projection().records],
      })).toMatchObject({
        pendingCount: 0,
        repairedCount: 1,
        manualAttentionCount: 0,
        items: [{
          status: "REPAIRED",
          nextAction: "REENTER_PROBABILITY_ESTIMATION",
          successorReviewId: repairedReview.reviewId,
          successorSemanticConstraintArtifactHash:
            repairedReview.report!.result.semanticConstraint!.artifactHash,
        }],
      });
      firstScheduler.reconcile([{ review: repairedReview }], snapshot);
      expect(firstScheduler.projection()).toMatchObject({
        caseCount: 2,
        challengedCount: 3,
        pendingCount: 3,
      });
      firstStore.close();

      const legacyVersion = new DatabaseSync(path);
      legacyVersion.exec("PRAGMA user_version = 32");
      legacyVersion.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: secondStore,
          estimator: {
            async estimate() {
              throw new Error("SQLite challenge replay must not invoke an estimator");
            },
          },
        },
      );
      const secondScheduler = new ProbabilityEstimationScheduler({
        desk: secondDesk,
        store: secondStore,
        tickIntervalMs: 1_000,
      });
      expect(secondScheduler.projection()).toMatchObject({
        challengedCount: 3,
        boundReadyCount: 0,
        notifications: [{ kind: "SEMANTIC_REPAIR_REQUIRED" }],
      });
      expect(secondDesk.projection().challengedCount).toBe(3);
      const restoredSemanticScheduler = new SemanticReviewScheduler({
        reviewDesk: createSemanticReviewDesk({}, {
          store: secondStore,
          reviewer: {
            async review() {
              throw new Error("restart replay must not call the semantic reviewer");
            },
          },
        }),
        store: secondStore,
        tickIntervalMs: 1_000,
      });
      expect(restoredSemanticScheduler.projection().jobs[0]).toMatchObject({
        schemaVersion: "pmh.semantic-review-job.v5",
        status: "PASS",
        repairRequest: { requestId: repairRequest.requestId },
      });
      expect(calls).toBe(3);
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reopens only exhausted roles without starting a provider request", async () => {
    let calls = 0;
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        estimator: {
          async estimate() {
            calls += 1;
            throw new Error("synthetic provider interruption");
          },
        },
      },
    );
    const scheduler = new ProbabilityEstimationScheduler({
      desk,
      maxAttempts: 1,
      concurrencyLimit: 3,
      maxRequestsPerTick: 3,
      tickIntervalMs: 1_000,
      now: () => Date.parse("2026-08-02T00:13:00.000Z"),
    });
    await Promise.all(scheduler.tick([{ review }], snapshot));
    const exhausted = scheduler.projection().jobs;
    expect(exhausted).toHaveLength(3);
    expect(exhausted.every((job) =>
      job.status === "EXHAUSTED" && job.attemptCount === 1
    )).toBe(true);
    expect(calls).toBe(3);

    const reopened = scheduler.retryExhaustedCase(exhausted[0]!.caseIdentity);
    expect(reopened).toHaveLength(3);
    expect(reopened.every((job) =>
      job.status === "PENDING" && job.attemptCount === 0 && job.lastRunId === null
    )).toBe(true);
    expect(calls).toBe(3);
    expect(() => scheduler.retryExhaustedCase(exhausted[0]!.caseIdentity)).toThrow(
      /no exhausted roles/u,
    );
  });

  it("does not rewrite retained provider-bound jobs when search origin becomes available", () => {
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        estimator: {
          async estimate() {
            throw new Error("compatibility replay must not call the estimator");
          },
        },
      },
    );
    const scheduler = new ProbabilityEstimationScheduler({ desk });
    scheduler.reconcile([{ review }], snapshot);
    const retainedJobIds = scheduler.projection().jobs.map((job) => job.jobId);
    expect(scheduler.projection().jobs.every((job) =>
      job.schemaVersion === "pmh.probability-estimation-job.v7" &&
      job.engine?.provider === "DEEPSEEK" &&
      job.evidenceContext?.sourceKind === "CURRENT_CATALOG_EXACT" &&
      job.searchOrigin === undefined
    )).toBe(true);

    scheduler.reconcile([{
      review,
      searchOrigin: buildProbabilitySearchOrigin({
        issueIds: [hashCanonical({ issue: "late origin" })],
        semanticFamilies: ["PHYSICAL_CO_OCCURRENCE"],
      }),
    }], snapshot);
    expect(scheduler.projection().jobs.map((job) => job.jobId)).toEqual(retainedJobIds);
    expect(scheduler.projection().jobs.every((job) =>
      job.schemaVersion === "pmh.probability-estimation-job.v7" &&
      job.engine?.provider === "DEEPSEEK" &&
      job.evidenceContext?.sourceKind === "CURRENT_CATALOG_EXACT" &&
      job.searchOrigin === undefined
    )).toBe(true);
  });

  it("replays the previous V5 input protocol without rewriting its identity", () => {
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      { estimator: { async estimate() { throw new Error("must not run"); } } },
    );
    const scheduler = new ProbabilityEstimationScheduler({ desk });
    scheduler.reconcile([{ review }], snapshot);
    const current = scheduler.projection().jobs[0]!;
    const legacyCaseIdentity = hashCanonical({
      schemaVersion: "pmh.probability-estimation-case-id.v4",
      semanticReviewArtifactHash: current.semanticReviewArtifactHash,
      semanticConstraintArtifactHash: current.semanticConstraintArtifactHash,
      evidenceScopeIdentity: current.evidenceScopeIdentity,
      adverseStateIds: current.adverseStateIds,
      model: current.model,
      engine: current.engine,
      evidenceContextIdentity: current.evidenceContext!.contextIdentity,
      inputProtocol: "pmh.probability-estimation-input.v2",
    });
    const {
      artifactHash: _artifactHash,
      adverseStateInterpretation: _adverseStateInterpretation,
      ...currentBody
    } = current;
    const body = Object.freeze({
      ...currentBody,
      schemaVersion: "pmh.probability-estimation-job.v5" as const,
      caseIdentity: legacyCaseIdentity,
      jobId: hashCanonical({
        schemaVersion: "pmh.probability-estimation-job-id.v1",
        caseIdentity: legacyCaseIdentity,
        role: current.role,
      }),
      inputProtocol: "pmh.probability-estimation-input.v2" as const,
    });
    const legacy = Object.freeze({ ...body, artifactHash: hashCanonical(body) });
    expect(assertProbabilityEstimationJobRecord(legacy)).toEqual(legacy);
  });

  it("creates a new case when provider effort changes without rewriting queued work", () => {
    let configuration: AiRuntimeConfiguration = Object.freeze({
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 1,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: "2026-08-02T00:00:00.000Z",
    });
    const desk = createProbabilityEstimationDesk({}, {
      runtimeConfiguration: () => configuration,
      codexCredentialProvider: codexCredentialForTest("token", "account"),
    });
    const scheduler = new ProbabilityEstimationScheduler({ desk });
    scheduler.reconcile([{ review }], snapshot);
    const highJobs = scheduler.projection().jobs;
    const highJobHashes = highJobs.map((job) => job.artifactHash).sort();
    expect(highJobs).toHaveLength(3);
    expect(highJobs.every((job) =>
      job.schemaVersion === "pmh.probability-estimation-job.v7" &&
      job.engine?.provider === "CODEX" &&
      job.evidenceContext?.sourceKind === "CURRENT_CATALOG_EXACT" &&
      job.engine.reasoningEffort === "high"
    )).toBe(true);

    configuration = Object.freeze({
      ...configuration,
      revision: 2,
      codexReasoningEffort: "max",
      updatedAt: "2026-08-02T00:01:00.000Z",
    });
    scheduler.reconcile([{ review }], snapshot);
    const allJobs = scheduler.projection().jobs;
    expect(allJobs).toHaveLength(6);
    expect(allJobs.filter((job) => job.engine?.reasoningEffort === "high"))
      .toHaveLength(3);
    expect(allJobs.filter((job) => job.engine?.reasoningEffort === "max"))
      .toHaveLength(3);
    expect(allJobs
      .filter((job) => job.engine?.reasoningEffort === "high")
      .map((job) => job.artifactHash)
      .sort()).toEqual(highJobHashes);
  });

  it("holds automatic provider work behind an engine-specific spending policy", () => {
    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      {
        estimator: {
          async estimate() {
            throw new Error("policy-blocked work must not call the estimator");
          },
        },
      },
    );
    const scheduler = new ProbabilityEstimationScheduler({
      desk,
      tickIntervalMs: 1_000,
      engineAllowed: (engine) => engine.provider !== "DEEPSEEK",
    });
    expect(scheduler.tick([{ review }], snapshot)).toHaveLength(0);
    expect(scheduler.projection()).toMatchObject({
      policyBlockedCount: 3,
      dueCount: 3,
      budget: { providerAttemptsStarted: 0 },
    });
  });

  it("owns exact reviewed listings across catalog rotation and SQLite restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-probability-context-"));
    const path = join(directory, "operations.sqlite");
    const bundle = buildProposalEvidenceBundle(proposal, snapshot);
    const evidenceContext = buildProbabilityEstimationEvidenceContext({
      review,
      listings: bundle.listings,
      sourceKind: "DURABLE_REVIEW_BUNDLE",
      sourceArtifactHash: bundle.bundleId,
    });
    const rotatedSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ source: "rotated-probability-context" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: [Object.freeze({
        ...listings[0]!,
        title: "Changed title after the reviewed catalog rotated",
        sourceReceivedAt: "2026-08-03T00:00:00.000Z",
      }), listings[1]!],
    });
    const observedListingHashes: string[] = [];
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: firstStore,
          estimator: { async estimate() { throw new Error("first process only persists work"); } },
        },
      );
      const firstScheduler = new ProbabilityEstimationScheduler({
        desk: firstDesk,
        store: firstStore,
        now: () => Date.parse("2026-08-02T00:20:00.000Z"),
      });
      firstScheduler.reconcile([{ review, evidenceContext }], rotatedSnapshot);
      expect(firstScheduler.projection()).toMatchObject({
        caseCount: 1,
        pendingCount: 3,
        blockedEvidenceCount: 0,
      });
      expect(firstScheduler.projection().jobs.every((job) =>
        job.schemaVersion === "pmh.probability-estimation-job.v7" &&
        job.evidenceContext?.contextIdentity === evidenceContext.contextIdentity
      )).toBe(true);
      expect(firstStore.loadProbabilityEstimationJobRecordsByProposalIds([
        proposal.proposalId,
      ])).toHaveLength(3);
      expect(firstStore.loadProbabilityEstimationJobRecordsByProposalIds([
        hashCanonical({ proposal: "absent" }),
      ])).toEqual([]);
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: secondStore,
          now: () => Date.parse("2026-08-02T00:21:00.000Z"),
          estimator: {
            async estimate(input) {
              observedListingHashes.push(hashCanonical(input.listings));
              return Object.freeze({
                status: "SUBMITTED" as const,
                lowerPpm: "10000",
                upperPpm: input.role === "REFERENCE_CLASS" ? "40000" : "50000",
                evidenceHashes: Object.freeze([evidenceHash]),
                assumptions: Object.freeze(["The retained review bytes remain authoritative."]),
                validForMs: 3_600_000,
                rationale: `${input.role} used retained reviewed listings.`,
                counterScenarios: Object.freeze([{
                  stateId: "TT",
                  narrative: "Recovery preserves the adverse state.",
                  evidenceHashes: Object.freeze([evidenceHash]),
                }]),
                trace: Object.freeze({
                  protocol: "AI_SDK_TOOL_LOOP" as const,
                  maximumSteps: 10 as const,
                  stepCount: 3,
                  toolCallCount: 3,
                  providerRequestAttemptCount: 3,
                  counterScenarioEffectCount: 1,
                  evidenceNeedEffectCount: 0,
                  caseAcknowledgementEffectCount: 1,
                  caseChallengeEffectCount: 0,
                  submittedEffectHash: hashCanonical({ retained: input.role }),
                  wholeResponseSchemaParsing: false as const,
                }),
              });
            },
          },
        },
      );
      const secondScheduler = new ProbabilityEstimationScheduler({
        desk: secondDesk,
        store: secondStore,
        tickIntervalMs: 1_000,
        maxRequestsPerTick: 3,
        concurrencyLimit: 3,
        now: () => Date.parse("2026-08-02T00:21:00.000Z"),
      });
      await Promise.all(secondScheduler.tick([], rotatedSnapshot));
      expect(observedListingHashes).toEqual(Array(3).fill(hashCanonical(listings)));
      expect(secondScheduler.projection()).toMatchObject({
        caseCount: 1,
        passedCount: 3,
        boundReadyCount: 1,
        blockedEvidenceCount: 0,
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects tampered durable evidence before provider dispatch", () => {
    const bundle = buildProposalEvidenceBundle(proposal, snapshot);
    const context = buildProbabilityEstimationEvidenceContext({
      review,
      listings: bundle.listings,
      sourceKind: "DURABLE_REVIEW_BUNDLE",
      sourceArtifactHash: bundle.bundleId,
    });
    expect(() => assertProbabilityEstimationEvidenceContext({
      ...context,
      listings: [{ ...context.listings[0]!, title: "tampered" }, context.listings[1]],
    })).toThrow(/evidence context/u);

    const relinkedBody = {
      ...context,
      listings: [{ ...context.listings[0]!, title: "tampered" }, context.listings[1]],
      listingHashes: [
        hashCanonical({ ...context.listings[0]!, title: "tampered" }),
        context.listingHashes[1]!,
      ],
    };
    const { contextIdentity: _contextIdentity, ...body } = relinkedBody;
    const relinked = Object.freeze({ ...body, contextIdentity: hashCanonical(body) });
    expect(() => assertProbabilityEstimationEvidenceContext(relinked)).not.toThrow();

    const desk = createProbabilityEstimationDesk(
      { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
      { estimator: { async estimate() { throw new Error("must not dispatch"); } } },
    );
    const scheduler = new ProbabilityEstimationScheduler({ desk, tickIntervalMs: 1_000 });
    expect(() => scheduler.reconcile([{ review, evidenceContext: relinked }], snapshot))
      .toThrow(/lineage mismatch/u);
    expect(scheduler.projection().jobs).toHaveLength(0);
  });

  it("rebuilds deterministic bounds from SQLite jobs and estimator runs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-probability-scheduler-"));
    const path = join(directory, "operations.sqlite");
    const evidenceHash = constraint.ruleEvidence[0]!.sourceRawHash;
    const searchOrigin = buildProbabilitySearchOrigin({
      issueIds: [hashCanonical({ issue: "durable probability origin" })],
      semanticFamilies: ["PHYSICAL_CO_OCCURRENCE"],
    });
    const makeEstimator = () => ({
      async estimate(input: { role: "REFERENCE_CLASS" | "CAUSAL" | "INDEPENDENT" }) {
        return Object.freeze({
          status: "SUBMITTED" as const,
          lowerPpm: "10000",
          upperPpm: input.role === "REFERENCE_CLASS" ? "40000" : "50000",
          evidenceHashes: Object.freeze([evidenceHash]),
          assumptions: Object.freeze(["Bounded fixture assumption."]),
          validForMs: 3_600_000,
          rationale: `${input.role} estimate.`,
          counterScenarios: Object.freeze([{
            stateId: "TT",
            narrative: "Recovery preserves the adverse state.",
            evidenceHashes: Object.freeze([evidenceHash]),
          }]),
          trace: Object.freeze({
            protocol: "AI_SDK_TOOL_LOOP" as const,
            maximumSteps: 10 as const,
            stepCount: 3,
            toolCallCount: 3,
            providerRequestAttemptCount: 3,
            counterScenarioEffectCount: 1,
            evidenceNeedEffectCount: 0,
            caseAcknowledgementEffectCount: 1,
            caseChallengeEffectCount: 0,
            submittedEffectHash: hashCanonical({ role: input.role }),
            wholeResponseSchemaParsing: false as const,
          }),
        });
      },
    });
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        {
          store: firstStore,
          estimator: makeEstimator(),
          now: () => Date.parse("2026-08-02T00:11:00.000Z"),
        },
      );
      const firstScheduler = new ProbabilityEstimationScheduler({
        desk: firstDesk,
        store: firstStore,
        tickIntervalMs: 1_000,
        maxRequestsPerTick: 2,
        concurrencyLimit: 2,
        now: () => Date.parse("2026-08-02T00:11:00.000Z"),
      });
      await Promise.all(firstScheduler.tick([{ review, searchOrigin }], snapshot));
      expect(firstScheduler.projection().boundReadyCount).toBe(1);
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const secondDesk = createProbabilityEstimationDesk(
        { DEEPSEEK_API_KEY: "ignored-by-injected-port" },
        { store: secondStore, estimator: makeEstimator() },
      );
      const secondScheduler = new ProbabilityEstimationScheduler({
        desk: secondDesk,
        store: secondStore,
        tickIntervalMs: 1_000,
      });
      secondScheduler.reconcile([{ review, searchOrigin }], snapshot);
      expect(secondScheduler.projection()).toMatchObject({
        boundReadyCount: 1,
        passedCount: 2,
        unreadNotificationCount: 1,
        storage: {
          jobs: { durable: true, schemaVersion: 64 },
          notifications: { durable: true, schemaVersion: 64 },
        },
      });
      expect(secondScheduler.projection().jobs.every((job) =>
        job.schemaVersion === "pmh.probability-estimation-job.v7" &&
        job.engine?.provider === "DEEPSEEK" &&
        job.evidenceContext?.sourceKind === "CURRENT_CATALOG_EXACT" &&
        job.searchOrigin?.originIdentity === searchOrigin.originIdentity
      )).toBe(true);
      expect(secondScheduler.projection().bounds[0]).toMatchObject({
        schemaVersion: "pmh.probabilistic-semantic-bound.v2",
        searchOrigin: { originIdentity: searchOrigin.originIdentity },
      });
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
