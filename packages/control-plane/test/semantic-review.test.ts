import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import {
  assertSemanticReviewRecord,
  AiUsageLedger,
  buildMarketCorpusSnapshot,
  codexCredentialForTest,
  createSemanticReviewDesk,
  type MarketRelationProposal,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";
import { openAiStreamToolResponse } from "./model-agent-fixtures.js";

const listings = [
  {
    listingRef: "venue-a:btc-up",
    venueId: "venue-a",
    venueInstrumentId: "btc-up",
    title: "BTC up from 09:00 to 10:00 UTC",
    description: "Strict comparison",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-08-01T10:00:00.000Z",
    rulesText: "Up if the Pyth end value is strictly greater than start; tie is Down.",
    outcomes: [
      { venueOutcomeId: "venue-a-up", label: "Up", indicativePrice: "0.50" },
      { venueOutcomeId: "venue-a-down", label: "Down", indicativePrice: "0.50" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-01T09:30:00.000Z",
    sourceRawHash: hashCanonical({ source: "a" }),
    protocolIdentity: hashCanonical({ protocol: "a" }),
  },
  {
    listingRef: "venue-b:btc-up",
    venueId: "venue-b",
    venueInstrumentId: "btc-up",
    title: "BTC up from 09:00 to 10:00 UTC",
    description: "Inclusive comparison",
    status: "OPEN",
    mechanism: "CLOB",
    closesAt: "2026-08-01T10:00:00.000Z",
    rulesText: "Up if the Chainlink end value is greater than or equal to start; tie is Up.",
    outcomes: [
      { venueOutcomeId: "venue-b-up", label: "Up", indicativePrice: "0.52" },
      { venueOutcomeId: "venue-b-down", label: "Down", indicativePrice: "0.48" },
    ],
    priceScale: "1000000",
    quantityScale: "1000000",
    minPriceTick: "10000",
    sourceKind: "LIVE_OBSERVATION" as const,
    sourceReceivedAt: "2026-08-01T09:30:00.000Z",
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

const proposalBody = {
  relationKind: "CONDITIONAL" as const,
  listingRefs: ["venue-a:btc-up", "venue-b:btc-up"],
  statement: "The outcomes align only when the two feeds agree and the hour is non-flat.",
  rationale: "Source and tie semantics differ.",
  falsifiers: ["A flat hour resolves differently."],
  authority: "PROPOSE_ONLY" as const,
  reviewStatus: "UNREVIEWED" as const,
  executionAuthority: false as const,
};
const proposal: MarketRelationProposal = Object.freeze({
  ...proposalBody,
  proposalId: hashCanonical({
    corpusSnapshotIdentity: snapshot.snapshotIdentity,
    ...proposalBody,
  }),
});

function toolCompletion(name: string, payload: unknown, id: string): Response {
  return Response.json({
    id: `chatcmpl-${id}`,
    object: "chat.completion",
    created: 1_785_523_200,
    model: "deepseek-v4-flash",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id,
            type: "function",
            function: { name, arguments: JSON.stringify(payload) },
          }],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
  });
}

function textCompletion(content: string, id: string): Response {
  return Response.json({
    id: `chatcmpl-${id}`,
    object: "chat.completion",
    created: 1_785_523_200,
    model: "deepseek-v4-flash",
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
  });
}

const reviewPayload = {
  recommendation: "ESCALATE",
  relationConclusion: "CONDITIONAL",
  assessments: {
    outcomeMapping: "Up and Down labels map directly only outside the tie case.",
    timingAndClose: "The displayed windows and close times align.",
    voidAndCancellation: "Neither supplied rule binds a complete outage policy.",
    resolutionSources: "Pyth and Chainlink can disagree at either boundary.",
  },
  counterexamples: [
    "A flat hour resolves Down on venue A and Up on venue B.",
    "A boundary feed disagreement can reverse the directional outcomes.",
  ],
  missingEvidence: ["Complete outage and fallback rules."],
  rationale: "The conditional statement is plausible but the supplied rules are incomplete.",
} as const;

const submissionPayload = {
  assessments: reviewPayload.assessments,
  missingEvidence: reviewPayload.missingEvidence,
  evidenceRequirements: [{
    kind: "VOID_CANCELLATION",
    listingRefs: proposal.listingRefs,
    claim: "The outage and fallback clauses must exclude divergent settlement.",
    reason: "The supplied rules omit the complete outage policy.",
    satisfyingObservation: "Both official rule sets specify identical outage handling.",
    contradictingObservation: "Either rule set permits a different fallback outcome.",
    temporalPosture: "HISTORICAL_AT_SOURCE_OBSERVATION",
  }],
  rationale: reviewPayload.rationale,
  constraint: {
    classification: "PROBABILISTIC_DEPENDENCE",
    assumptions: ["Feed agreement is not guaranteed by either venue's rules."],
    truthTable: [
      { truths: [false, false], disposition: "FEASIBLE", rationale: "Both feeds may end down.", evidenceListingRefs: proposal.listingRefs },
      { truths: [false, true], disposition: "FEASIBLE", rationale: "Tie semantics can differ.", evidenceListingRefs: proposal.listingRefs },
      { truths: [true, false], disposition: "FEASIBLE", rationale: "Boundary feeds can differ.", evidenceListingRefs: proposal.listingRefs },
      { truths: [true, true], disposition: "FEASIBLE", rationale: "Both feeds may end up.", evidenceListingRefs: proposal.listingRefs },
    ],
    unresolvedEvidence: reviewPayload.missingEvidence,
  },
} as const;

const assessmentEffectPayload = submissionPayload.assessments;
const truthStateEffectPayloads = submissionPayload.constraint.truthTable;
const evidenceGapEffectPayload = {
  missingEvidence: submissionPayload.missingEvidence[0],
  requirement: submissionPayload.evidenceRequirements[0],
} as const;
const finalizationPayload = {
  classification: submissionPayload.constraint.classification,
  rationale: submissionPayload.rationale,
} as const;

function incrementalCompletionSequence(options: Readonly<{
  counterexampleResult: "FOUND" | "NOT_FOUND" | "INCONCLUSIVE";
  includeEvidenceGap?: boolean;
  classification?: "HARD_SETTLEMENT_CONSTRAINT" | "PROBABILISTIC_DEPENDENCE";
}>): Response[] {
  return [
    toolCompletion("record_counterexample", {
      result: options.counterexampleResult,
      narrative: options.counterexampleResult === "FOUND"
        ? reviewPayload.counterexamples[0]
        : options.counterexampleResult === "INCONCLUSIVE"
          ? "The supplied evidence does not settle the attempted joint state."
          : "No state in the supplied matrix falsifies the relation.",
      truths: [false, true],
    }, `call-counterexample-${options.counterexampleResult}`),
    toolCompletion(
      "record_semantic_assessment",
      assessmentEffectPayload,
      "call-assessment",
    ),
    ...truthStateEffectPayloads.map((state, index) =>
      toolCompletion("record_truth_state", state, `call-truth-${index}`)
    ),
    ...(options.includeEvidenceGap === false
      ? []
      : [toolCompletion(
          "record_evidence_gap",
          evidenceGapEffectPayload,
          "call-evidence-gap",
        )]),
    toolCompletion(
      "submit_semantic_review",
      {
        ...finalizationPayload,
        classification: options.classification ?? finalizationPayload.classification,
      },
      "call-submit",
    ),
  ];
}

describe("adversarial semantic review", () => {
  it("routes current semantic reviews through persisted Codex model and effort", async () => {
    const responses = [
      openAiStreamToolResponse(
        "record_counterexample",
        {
          result: "FOUND",
          narrative: reviewPayload.counterexamples[0],
          truths: [false, true],
        },
        1,
      ),
      openAiStreamToolResponse(
        "record_semantic_assessment",
        assessmentEffectPayload,
        2,
      ),
      ...truthStateEffectPayloads.map((state, index) =>
        openAiStreamToolResponse("record_truth_state", state, index + 3)
      ),
      openAiStreamToolResponse(
        "record_evidence_gap",
        evidenceGapEffectPayload,
        7,
      ),
      openAiStreamToolResponse("submit_semantic_review", finalizationPayload, 8),
    ];
    const bodies: Record<string, unknown>[] = [];
    const desk = createSemanticReviewDesk(
      { PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000" },
      {
        runtimeConfiguration: () => Object.freeze({
          schemaVersion: "pmh.ai-runtime-configuration.v2" as const,
          revision: 7,
          provider: "CODEX" as const,
          codexModel: "gpt-5.6-terra" as const,
          codexReasoningEffort: "high" as const,
          deepseekAutomationEnabled: false,
          updatedAt: "2026-08-10T00:00:00.000Z",
        }),
        codexCredentialProvider: codexCredentialForTest("token", "account"),
        async fetcher(_input, init) {
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return responses[bodies.length - 1]!;
        },
      },
    );
    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;
    expect(record).toMatchObject({
      status: "PASS",
      model: "gpt-5.6-terra",
      engine: {
        provider: "CODEX",
        model: "gpt-5.6-terra",
        reasoningEffort: "high",
        responseStorage: false,
      },
      report: {
        schemaVersion: "pmh.semantic-review-report.v5",
        engine: {
          provider: "CODEX",
          model: "gpt-5.6-terra",
          reasoningEffort: "high",
          responseStorage: false,
        },
        input: { evidencePosture: "ORIGINAL_CORPUS" },
      },
    });
    expect(() => assertSemanticReviewRecord(record)).not.toThrow();
    expect(bodies).toHaveLength(responses.length);
    expect(bodies.every((body) => body.store === false)).toBe(true);
    expect(bodies.every((body) => body.parallel_tool_calls === false)).toBe(true);
    expect(bodies.every((body) => !("max_output_tokens" in body))).toBe(true);
  });

  it("runs one bounded AI SDK review and preserves advisory-only authority", async () => {
    let requestBody = "";
    let requestCount = 0;
    const responses = incrementalCompletionSequence({
      counterexampleResult: "FOUND",
    });
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        async fetcher(_input, init) {
          requestBody += String(init?.body);
          requestCount += 1;
          return responses[requestCount - 1]!;
        },
      },
    );
    const opportunityId = `ai:${proposal.proposalId}`;
    const invocation = desk.begin(opportunityId, proposal, snapshot);
    expect(desk.projection().status).toBe("RUNNING");
    const record = await invocation.promise;

    expect(record).toMatchObject({
      status: "PASS",
      opportunityId,
      report: {
        schemaVersion: "pmh.semantic-review-report.v3",
        engine: {
          transport: "VERCEL_AI_SDK",
          role: "ADVERSARIAL_SEMANTIC_REVIEWER",
          independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER",
        },
        result: {
          recommendation: "ESCALATE",
          relationConclusion: "RELATED",
          semanticConstraint: {
            classification: "PROBABILISTIC_DEPENDENCE",
            exactCompilerAdmission: "RESEARCH_ONLY",
            assumptions: [],
          },
          evidenceRequirements: [{
            kind: "VOID_CANCELLATION",
            acquisitionRoute: "UNSUPPORTED",
            origin: "SEMANTIC_REVIEW",
            fetchAuthority: false,
            providerRequestAuthority: false,
          }],
          authority: "ADVISORY_ONLY",
          productionReviewAuthority: false,
          simulationAuthority: false,
          executionAuthority: false,
        },
        trace: {
          protocol: "AI_SDK_TOOL_LOOP",
          counterexampleEffectCount: 1,
          recommendationPolicy: "FIRST_PARTY_CONSERVATIVE_V1",
          wholeResponseSchemaParsing: false,
          structuredEvidenceRequirements: true,
        },
        effects: {
          externalWrites: false,
          valueMovingActions: false,
          liveExecutionEnabled: false,
        },
      },
    });
    expect(record.report?.input.listingEvidence).toHaveLength(2);
    expect(() => assertSemanticReviewRecord(record)).not.toThrow();
    expect(requestBody).toContain("adversarial semantic reviewer");
    expect(requestBody).toContain("untrusted data");
    expect(requestBody).toContain("submit_semantic_review");
    expect(requestBody).not.toContain('"recommendation"');
    expect(requestBody).not.toContain('"relationConclusion"');
    expect(requestBody).not.toContain('"assumptions"');
    expect(requestCount).toBe(responses.length);
    expect(JSON.stringify(record)).not.toContain("test-only-key");

    const replay = desk.begin(opportunityId, proposal, snapshot);
    expect(replay.idempotentReplay).toBe(true);
    expect((await replay.promise).reviewId).toBe(record.reviewId);
  });

  it.each([
    {
      counterexampleResult: "NOT_FOUND" as const,
      classification: "PROBABILISTIC_DEPENDENCE" as const,
      expectedRecommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
      expectedRelationConclusion: "CONDITIONAL" as const,
    },
    {
      counterexampleResult: "FOUND" as const,
      classification: "PROBABILISTIC_DEPENDENCE" as const,
      expectedRecommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
      expectedRelationConclusion: "CONDITIONAL" as const,
    },
    {
      counterexampleResult: "FOUND" as const,
      classification: "HARD_SETTLEMENT_CONSTRAINT" as const,
      expectedRecommendation: "REJECT" as const,
      expectedRelationConclusion: "CONFLICTING" as const,
    },
  ])(
    "derives $expectedRecommendation outside the Agent tool payload",
    async ({
      counterexampleResult,
      classification,
      expectedRecommendation,
      expectedRelationConclusion,
    }) => {
      let requestCount = 0;
      const responses = incrementalCompletionSequence({
        counterexampleResult,
        classification,
        includeEvidenceGap: false,
      });
      const desk = createSemanticReviewDesk(
        { DEEPSEEK_API_KEY: "test-only-key" },
        {
          async fetcher() {
            requestCount += 1;
            return responses[requestCount - 1]!;
          },
        },
      );

      const record = await desk.begin(
        `ai:${proposal.proposalId}`,
        proposal,
        snapshot,
      ).promise;

      expect(record).toMatchObject({
        status: "PASS",
        report: {
          result: {
            recommendation: expectedRecommendation,
            relationConclusion: expectedRelationConclusion,
          },
          trace: {
            terminalEffect: "SUBMITTED",
            recommendationPolicy: "FIRST_PARTY_CONSERVATIVE_V1",
          },
        },
      });
    },
  );

  it("keeps the tool loop alive after a premature terminal submission", async () => {
    let requestCount = 0;
    const responses = [
      toolCompletion(
        "submit_semantic_review",
        finalizationPayload,
        "call-premature-submit",
      ),
      ...incrementalCompletionSequence({ counterexampleResult: "FOUND" }),
    ];
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        async fetcher() {
          requestCount += 1;
          return responses[requestCount - 1]!;
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(requestCount).toBe(responses.length);
    expect(record).toMatchObject({
      status: "PASS",
      report: {
        trace: {
          counterexampleEffectCount: 1,
          rejectedTerminalEffectCount: 1,
          lastRejectedTerminalDiagnostic: expect.stringContaining(
            "counterexampleEffects",
          ),
        },
      },
    });
  });

  it("returns a field-level repair and accepts the corrected terminal effect", async () => {
    let requestCount = 0;
    const requestBodies: string[] = [];
    const invalidTruthState = {
      ...truthStateEffectPayloads[0],
      evidenceListingRefs: ["venue-z:outside"],
    };
    const responses = [
      toolCompletion("record_counterexample", {
        result: "FOUND",
        narrative: reviewPayload.counterexamples[0],
        truths: [false, true],
      }, "call-repair-counterexample"),
      toolCompletion(
        "record_semantic_assessment",
        assessmentEffectPayload,
        "call-repair-assessment",
      ),
      toolCompletion(
        "record_truth_state",
        invalidTruthState,
        "call-invalid-truth",
      ),
      ...truthStateEffectPayloads.map((state, index) =>
        toolCompletion("record_truth_state", state, `call-repaired-truth-${index}`)
      ),
      toolCompletion(
        "record_evidence_gap",
        evidenceGapEffectPayload,
        "call-repair-gap",
      ),
      toolCompletion(
        "submit_semantic_review",
        finalizationPayload,
        "call-repaired-submit",
      ),
    ];
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        async fetcher(_input, init) {
          requestCount += 1;
          requestBodies.push(String(init?.body));
          return responses[requestCount - 1]!;
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(requestCount).toBe(responses.length);
    expect(requestBodies[3]).toContain("OUT_OF_SCOPE_LISTING");
    expect(requestBodies[3]).toContain(
      "truthState.evidenceListingRefs",
    );
    expect(record).toMatchObject({
      status: "PASS",
      report: {
        trace: {
          terminalEffect: "SUBMITTED",
          rejectedTerminalEffectCount: 1,
          lastRejectedTerminalDiagnostic: expect.stringContaining(
            "truthState.evidenceListingRefs",
          ),
        },
      },
    });
  });

  it("bounds the accumulated counterexample narrative before artifact construction", async () => {
    let requestCount = 0;
    const longNarrative = (label: string) =>
      `${label}: ${"bounded falsification detail ".repeat(34)}`;
    const incremental = incrementalCompletionSequence({
      counterexampleResult: "FOUND",
    }).slice(1);
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        async fetcher() {
          requestCount += 1;
          if (requestCount <= 3) {
            return toolCompletion("record_counterexample", {
              result: requestCount === 1 ? "FOUND" : "INCONCLUSIVE",
              narrative: longNarrative(`attempt-${requestCount}`),
              truths: [false, true],
            }, `call-long-counterexample-${requestCount}`);
          }
          return incremental[requestCount - 4]!;
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(record.status).toBe("PASS");
    expect(
      record.report?.result.semanticConstraint?.counterexampleAttempt.narrative.length,
    ).toBeLessThanOrEqual(2_000);
    expect(record.report?.trace?.counterexampleEffectCount).toBe(3);
  });

  it("retains an explicit abstention as research instead of retryable technical failure", async () => {
    let requestCount = 0;
    const usageLedger = new AiUsageLedger();
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        usageRecorder: usageLedger,
        async fetcher() {
          requestCount += 1;
          return requestCount === 1
            ? toolCompletion("record_counterexample", {
                result: "INCONCLUSIVE",
                narrative: "The supplied evidence does not settle divergent feed behavior.",
                truths: [false, true],
              }, "call-abstain-counterexample")
            : toolCompletion("abstain_semantic_review", {
                reason:
                  "The bounded review cannot classify the complete state space without inventing feed semantics.",
              }, "call-abstain-terminal");
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(requestCount).toBe(2);
    expect(record).toMatchObject({
      status: "PASS",
      report: {
        schemaVersion: "pmh.semantic-review-report.v2",
        result: {
          recommendation: "ESCALATE",
          relationConclusion: "RELATED",
          missingEvidence: [],
          semanticConstraint: {
            classification: "TEXTUAL_RELATEDNESS",
            exactCompilerAdmission: "RESEARCH_ONLY",
            semanticDecisionAuthority: false,
            executionAuthority: false,
          },
        },
        trace: {
          terminalEffect: "ABSTAINED",
          wholeResponseSchemaParsing: false,
        },
      },
    });
    expect(record.report?.result.semanticConstraint?.unresolvedEvidence).toEqual([
      "Agent abstained from semantic classification: The bounded review cannot classify the complete state space without inventing feed semantics.",
    ]);
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      byOutcome: [{ key: "ABSTAINED", invocationCount: "1" }],
      totals: { tokens: { totalTokens: "600" } },
    });
  });

  it("recovers a research-only abstention after a terminal tool protocol violation", async () => {
    let requestCount = 0;
    const usageLedger = new AiUsageLedger();
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        usageRecorder: usageLedger,
        async fetcher() {
          requestCount += 1;
          return requestCount === 1
            ? toolCompletion("record_counterexample", {
                result: "INCONCLUSIVE",
                narrative: "The feeds may diverge at the resolution boundary.",
                truths: [false, true],
              }, "call-protocol-counterexample")
            : textCompletion(
                "I cannot complete the classification.",
                "protocol-violation",
              );
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(record).toMatchObject({
      status: "PASS",
      report: {
        result: {
          recommendation: "ESCALATE",
          relationConclusion: "RELATED",
          semanticConstraint: {
            classification: "TEXTUAL_RELATEDNESS",
            exactCompilerAdmission: "RESEARCH_ONLY",
          },
        },
        trace: { terminalEffect: "RECOVERED_ABSTENTION" },
      },
    });
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      coverage: { complete: 1, unavailable: 0 },
      byOutcome: [{ key: "ABSTAINED", invocationCount: "1" }],
      totals: {
        durableEffectCount: "1",
        tokens: { inputTokens: "400", outputTokens: "200", totalTokens: "600" },
      },
    });
  });

  it("still fails closed when no counterexample effect was recorded", async () => {
    const usageLedger = new AiUsageLedger();
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        usageRecorder: usageLedger,
        async fetcher() {
          return textCompletion(
            "I cannot inspect the proposed relation.",
            "no-counterexample-protocol-violation",
          );
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(record).toMatchObject({
      status: "FAILED",
      diagnostic: expect.stringContaining("without submitting its tool effect"),
      failure: {
        failureClass: "MODEL_PROTOCOL",
        retryPolicy: "ONE_RETRY",
      },
    });
    expect(usageLedger.projection()).toMatchObject({
      eventCount: 1,
      byOutcome: [{ key: "FAILED", invocationCount: "1" }],
      totals: { durableEffectCount: "0" },
    });
  });

  it("turns a first-party constraint validation failure into a durable failed review", async () => {
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        reviewer: {
          review: async () => ({
            ...reviewPayload,
            constraintDraft: {
              ...submissionPayload.constraint,
              relationKind: proposal.relationKind,
              counterexampleAttempt: {
                attempted: false as const,
                result: "INCONCLUSIVE" as const,
                narrative: "The model submitted without a required counterexample attempt.",
                truths: null,
              },
            },
          }),
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;
    expect(record).toMatchObject({
      status: "FAILED",
      diagnostic: expect.stringContaining(
        "semantic constraint draft violates its bounded contract",
      ),
      failure: {
        failureClass: "FIRST_PARTY_CONTRACT",
        retryPolicy: "NO_RETRY",
      },
      report: null,
    });
    expect(desk.projection()).toMatchObject({
      status: "IDLE",
      activeCount: 0,
      failedCount: 1,
    });
    expect(() => assertSemanticReviewRecord(desk.projection().records[0])).not.toThrow();
  });

  it("classifies a retryable provider response without parsing its body as model output", async () => {
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      {
        async fetcher() {
          return new Response("Service unavailable", {
            status: 503,
            headers: { "content-type": "text/plain" },
          });
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(record).toMatchObject({
      status: "FAILED",
      failure: {
        failureClass: "PROVIDER_RETRYABLE",
        retryPolicy: "STANDARD_RETRY",
      },
      report: null,
    });
    expect(() => assertSemanticReviewRecord(record)).not.toThrow();
    expect(() => assertSemanticReviewRecord({
      ...record,
      failure: {
        failureClass: "PROVIDER_RETRYABLE",
        retryPolicy: "NO_RETRY",
      },
    })).toThrow(/classification is inconsistent/);
  });

  it("fails closed when the key or exact listing scope is absent", () => {
    const missing = createSemanticReviewDesk({});
    expect(() =>
      missing.begin(`ai:${proposal.proposalId}`, proposal, snapshot),
    ).toThrow(/DEEPSEEK_API_KEY/);

    const outside: MarketRelationProposal = {
      ...proposal,
      listingRefs: ["venue-a:btc-up", "outside:not-in-corpus"],
    };
    const configured = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      { reviewer: { review: async () => reviewPayload } },
    );
    expect(() =>
      configured.begin(`ai:${outside.proposalId}`, outside, snapshot),
    ).toThrow(/exceeds the current corpus/);
  });

  it("rejects a rehashed advisory report whose inner authority changed", async () => {
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      { reviewer: { review: async () => reviewPayload } },
    );
    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;
    const report = record.report!;
    const tamperedBody = {
      ...report,
      result: { ...report.result, simulationAuthority: true },
    };
    const { artifactHash: _oldHash, ...body } = tamperedBody;
    expect(() =>
      assertSemanticReviewRecord({
        ...record,
        report: { ...tamperedBody, artifactHash: hashCanonical(body) },
      }),
    ).toThrow(/authority|contract/);
  });

  it("retains advisory review evidence for bounded multi-outcome listings", async () => {
    const multiListings = listings.map((listing, index) => ({
      ...listing,
      quantityScale: index === 0 ? listing.quantityScale : undefined,
      outcomes: [
        ...listing.outcomes,
        {
          venueOutcomeId: `venue-${index === 0 ? "a" : "b"}-void`,
          label: "Void",
          indicativePrice: "0.00",
        },
      ],
    }));
    const multiSnapshot = buildMarketCorpusSnapshot({
      sourceSetIdentity: hashCanonical({ sources: "multi" }),
      eligibleSourceCount: 2,
      excludedSourceCount: 0,
      listings: multiListings,
    });
    const multiBody = {
      ...proposalBody,
      statement: "Both listings expose aligned Up, Down, and Void outcomes.",
    };
    const multiProposal: MarketRelationProposal = {
      ...multiBody,
      proposalId: hashCanonical({
        corpusSnapshotIdentity: multiSnapshot.snapshotIdentity,
        ...multiBody,
      }),
    };
    const desk = createSemanticReviewDesk(
      { DEEPSEEK_API_KEY: "test-only-key" },
      { reviewer: { review: async () => reviewPayload } },
    );
    const record = await desk.begin(
      `ai:${multiProposal.proposalId}`,
      multiProposal,
      multiSnapshot,
    ).promise;

    expect(record.status).toBe("PASS");
    expect(record.report?.input.listingEvidence[0]?.outcomes).toHaveLength(3);
    expect(() => assertSemanticReviewRecord(record)).not.toThrow();
  });

  it("restores a content-addressed tool-effect constraint from SQLite without rerunning the model", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-semantic-tool-store-"));
    const path = join(directory, "control-plane.sqlite");
    const constraintDraft = {
      ...submissionPayload.constraint,
      relationKind: proposal.relationKind,
      counterexampleAttempt: {
        attempted: true as const,
        result: "FOUND" as const,
        narrative: reviewPayload.counterexamples[0],
        truths: [false, true],
      },
    };
    try {
      const firstStore = new SqliteOperationalStore(path);
      const firstDesk = createSemanticReviewDesk(
        { DEEPSEEK_API_KEY: "test-only-key" },
        {
          store: firstStore,
          reviewer: { review: async () => ({
            ...reviewPayload,
            constraintDraft,
            evidenceRequirementDrafts: submissionPayload.evidenceRequirements,
          }) },
        },
      );
      const first = await firstDesk.begin(
        `ai:${proposal.proposalId}`,
        proposal,
        snapshot,
      ).promise;
      expect(first.report).toMatchObject({
        schemaVersion: "pmh.semantic-review-report.v3",
        result: {
          semanticConstraint: {
            schemaVersion: "pmh.semantic-constraint-proposal.v3",
            exactCompilerAdmission: "RESEARCH_ONLY",
          },
          evidenceRequirements: [{
            origin: "SEMANTIC_REVIEW",
            kind: "VOID_CANCELLATION",
            acquisitionRoute: "UNSUPPORTED",
          }],
        },
      });
      const constraintHash = first.report?.result.semanticConstraint?.artifactHash;
      const requirementId = first.report?.result.evidenceRequirements?.[0]
        ?.requirementId;
      firstStore.close();

      const secondStore = new SqliteOperationalStore(path);
      const restoredDesk = createSemanticReviewDesk(
        { DEEPSEEK_API_KEY: "test-only-key" },
        {
          store: secondStore,
          reviewer: { review: async () => { throw new Error("must not rerun"); } },
        },
      );
      const restored = restoredDesk.projection().records[0];
      expect(restored?.report?.result.semanticConstraint?.artifactHash).toBe(
        constraintHash,
      );
      expect(restored?.report?.result.evidenceRequirements?.[0]?.requirementId)
        .toBe(requirementId);
      expect(() => assertSemanticReviewRecord(restored)).not.toThrow();
      const replay = restoredDesk.begin(
        `ai:${proposal.proposalId}`,
        proposal,
        snapshot,
      );
      expect(replay.idempotentReplay).toBe(true);
      expect((await replay.promise).reviewId).toBe(first.reviewId);
      secondStore.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
