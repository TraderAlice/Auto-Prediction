import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashCanonical } from "@pmh/domain";
import {
  assertSemanticReviewRecord,
  buildMarketCorpusSnapshot,
  createSemanticReviewDesk,
  type MarketRelationProposal,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

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
  recommendation: reviewPayload.recommendation,
  relationConclusion: reviewPayload.relationConclusion,
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

describe("adversarial semantic review", () => {
  it("runs one bounded AI SDK review and preserves advisory-only authority", async () => {
    let requestBody = "";
    let requestCount = 0;
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        async fetcher(_input, init) {
          requestBody += String(init?.body);
          requestCount += 1;
          return requestCount === 1
            ? toolCompletion("record_counterexample", {
                result: "FOUND",
                narrative: reviewPayload.counterexamples[0],
                truths: [false, true],
              }, "call-counterexample")
            : toolCompletion(
                "submit_semantic_review",
                submissionPayload,
                "call-submit",
              );
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
          semanticConstraint: {
            classification: "PROBABILISTIC_DEPENDENCE",
            exactCompilerAdmission: "RESEARCH_ONLY",
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
    expect(requestCount).toBe(2);
    expect(JSON.stringify(record)).not.toContain("test-only-key");

    const replay = desk.begin(opportunityId, proposal, snapshot);
    expect(replay.idempotentReplay).toBe(true);
    expect((await replay.promise).reviewId).toBe(record.reviewId);
  });

  it("keeps the tool loop alive after a premature terminal submission", async () => {
    let requestCount = 0;
    const desk = createSemanticReviewDesk(
      {
        DEEPSEEK_API_KEY: "test-only-key",
        PMH_SEMANTIC_REVIEW_TIMEOUT_MS: "3000",
      },
      {
        async fetcher() {
          requestCount += 1;
          if (requestCount === 1) {
            return toolCompletion(
              "submit_semantic_review",
              submissionPayload,
              "call-premature-submit",
            );
          }
          if (requestCount === 2) {
            return toolCompletion("record_counterexample", {
              result: "FOUND",
              narrative: reviewPayload.counterexamples[0],
              truths: [false, true],
            }, "call-corrective-counterexample");
          }
          return toolCompletion(
            "submit_semantic_review",
            submissionPayload,
            "call-corrected-submit",
          );
        },
      },
    );

    const record = await desk.begin(
      `ai:${proposal.proposalId}`,
      proposal,
      snapshot,
    ).promise;

    expect(requestCount).toBe(3);
    expect(record).toMatchObject({
      status: "PASS",
      report: {
        trace: { counterexampleEffectCount: 1 },
      },
    });
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
            schemaVersion: "pmh.semantic-constraint-proposal.v2",
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
