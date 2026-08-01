import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import { runOpportunitySimulation } from "@pmh/execution";
import {
  OpportunityLifecycleDesk,
  RealCandidatePreflightDesk,
  type SemanticReviewRecord,
  type MarketArchaeologistProjection,
} from "../src/index.js";
import { SqliteOperationalStore } from "../src/operational-store.js";

describe("opportunity lifecycle desk", () => {
  it("places AI proposals and deterministic rejections in one live-disabled queue", async () => {
    const proposalId = hashCanonical({ proposal: "ai-relation" });
    const archaeologist = {
      records: [
        {
          status: "PASS",
          report: {
            completedAt: "2026-08-01T00:00:00.000Z",
            result: { proposals: [{ proposalId }] },
          },
        },
      ],
    } as unknown as MarketArchaeologistProjection;
    const realCandidate = new RealCandidatePreflightDesk();
    await realCandidate.load();

    const desk = new OpportunityLifecycleDesk();
    desk.syncMarketArchaeologist(archaeologist);
    desk.syncRealCandidate(realCandidate.dispositionProjection());
    desk.syncMarketArchaeologist(archaeologist);
    desk.syncRealCandidate(realCandidate.dispositionProjection());

    const projection = desk.projection();
    expect(projection).toMatchObject({
      defaultPolicy: {
        routeAfterCertificate: "REQUIRE_HUMAN_APPROVAL",
        liveExecutionEnabled: false,
      },
      caseCount: 2,
      effects: {
        externalMessagesSent: false,
        liveOrdersPlaced: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opportunityId: `ai:${proposalId}`,
          discoveryKind: "AI_RELATION_PROPOSAL",
          state: "AWAITING_SEMANTIC_REVIEW",
          nextAction: "INDEPENDENT_SEMANTIC_REVIEW",
        }),
        expect.objectContaining({
          discoveryKind: "DETERMINISTIC_SEARCH_LEAD",
          state: "REJECTED_PREFLIGHT",
          nextAction: "NONE",
        }),
      ]),
    );
    expect(projection.exchangeModels).toEqual([
      expect.objectContaining({
        model: "CLOB_TAKER_V1",
        qualification: "BOOK_EXACT_TAKER_WALK",
      }),
      expect.objectContaining({
        model: "CONSTANT_PRODUCT_AMM_V1",
        qualification: "GENERIC_REQUIRES_VENUE_CALIBRATION",
      }),
    ]);
    expect(projection.routes.every((route) => !route.liveExecutionAvailable)).toBe(
      true,
    );
  });

  it("persists a research-only semantic decision and restores its event journal", () => {
    const proposalId = hashCanonical({ proposal: "durable-ai-relation" });
    const opportunityId = `ai:${proposalId}`;
    const archaeologist = {
      records: [
        {
          status: "PASS",
          report: {
            completedAt: "2026-08-01T00:00:00.000Z",
            result: { proposals: [{ proposalId }] },
          },
        },
      ],
    } as unknown as MarketArchaeologistProjection;
    const reportBody = {
      schemaVersion: "pmh.semantic-review-report.v1" as const,
      status: "PASS" as const,
      startedAt: "2026-08-01T00:01:00.000Z",
      completedAt: "2026-08-01T00:01:01.000Z",
      engine: {
        transport: "VERCEL_AI_SDK" as const,
        provider: "deepseek" as const,
        model: "deepseek-v4-flash",
        role: "ADVERSARIAL_SEMANTIC_REVIEWER" as const,
        independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER" as const,
      },
      input: {
        opportunityId,
        proposalId,
        proposalCorpusSnapshotIdentity: hashCanonical({ corpus: "durable" }),
        corpusSnapshotIdentity: hashCanonical({ corpus: "durable" }),
        evidencePosture: "ORIGINAL_CORPUS" as const,
        relationKind: "CONDITIONAL" as const,
        statement: "The relationship is conditional.",
        listingEvidence: [
          {
            listingRef: "venue-a:one",
            listingHash: hashCanonical({ listing: "a" }),
            sourceRawHash: hashCanonical({ source: "a" }),
            protocolIdentity: "protocol:a",
          },
          {
            listingRef: "venue-b:two",
            listingHash: hashCanonical({ listing: "b" }),
            sourceRawHash: hashCanonical({ source: "b" }),
            protocolIdentity: "protocol:b",
          },
        ],
      },
      result: {
        recommendation: "ACCEPT_FOR_RESEARCH_SIMULATION" as const,
        relationConclusion: "CONDITIONAL" as const,
        assessments: {
          outcomeMapping: "Bound.",
          timingAndClose: "Bound.",
          voidAndCancellation: "Bound.",
          resolutionSources: "Conditional source agreement is explicit.",
        },
        counterexamples: ["Feed disagreement invalidates the relation."],
        missingEvidence: [],
        rationale: "Sufficiently scoped for research simulation.",
        authority: "ADVISORY_ONLY" as const,
        productionReviewAuthority: false as const,
        simulationAuthority: false as const,
        executionAuthority: false as const,
      },
      effects: {
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      },
    };
    const report = {
      ...reportBody,
      artifactHash: hashCanonical(reportBody),
    };
    const reviewIdentityBody = {
      schemaVersion: "pmh.semantic-review-run.v1",
      opportunityId,
      proposalId,
      proposalCorpusSnapshotIdentity:
        report.input.proposalCorpusSnapshotIdentity,
      corpusSnapshotIdentity: report.input.corpusSnapshotIdentity,
      model: "deepseek-v4-flash",
    };
    const review: SemanticReviewRecord = {
      reviewId: hashCanonical(reviewIdentityBody),
      opportunityId,
      proposalId,
      proposalCorpusSnapshotIdentity:
        report.input.proposalCorpusSnapshotIdentity,
      corpusSnapshotIdentity: report.input.corpusSnapshotIdentity,
      model: "deepseek-v4-flash",
      status: "PASS",
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      diagnostic: null,
      report,
    };
    const store = new SqliteOperationalStore(":memory:");
    const first = new OpportunityLifecycleDesk(
      undefined,
      store,
      250,
      () => Date.parse("2026-08-01T00:02:00.000Z"),
    );
    first.syncMarketArchaeologist(archaeologist);
    const decision = first.recordResearchSemanticDecision(
      opportunityId,
      review,
      "ACCEPT_FOR_SIMULATION",
      "Operator accepts this exact conditional scope for non-value-moving simulation.",
    );
    expect(decision).toMatchObject({
      authority: "LOCAL_OPERATOR_RESEARCH_ONLY",
      productionReviewAuthority: false,
      productionPromotionEligible: false,
      executionAuthority: false,
    });
    const simulation = runOpportunitySimulation({
      schemaVersion: "pmh.opportunity-simulation-plan.v1",
      opportunityId,
      relationConstraintHash: hashCanonical({ relation: "EQUIVALENT" }),
      semanticDecisionId: decision.decisionId,
      portfolioId: hashCanonical({ portfolio: "opposites" }),
      canonicalStates: [
        { stateId: "FF", winningLegIds: ["right-false"] },
        { stateId: "TT", winningLegIds: ["left-true"] },
      ],
      legs: [
        ["left-true", "venue-a", 400n],
        ["right-false", "venue-b", 450n],
      ].map(([legId, venueId, price]) => ({
        legId: String(legId),
        payoutPerWinningUnit: 1_000n,
        request: {
          model: "CLOB_TAKER_V1" as const,
          venueId: String(venueId),
          instrumentId: `${venueId}:outcome`,
          side: "BUY" as const,
          fillPolicy: "FILL_OR_KILL" as const,
          requestedQuantity: 1_000n,
          quantityScale: 1_000n,
          collateralScale: 1_000n,
          levels: [
            {
              price: BigInt(price),
              quantity: 1_000n,
              levelIdentity: hashCanonical({ venueId, price }),
            },
          ],
          fee: {
            rate: 0n,
            rateScale: 10_000n,
            flat: 0n,
            scheduleHash: hashCanonical({ venueId, fee: 0 }),
          },
          bookStateHash: hashCanonical({ venueId, book: 1 }),
          observedAtEpochMs: 1_785_523_200_000n,
        },
      })),
    });
    first.recordOpportunitySimulation(opportunityId, simulation);
    expect(first.projection()).toMatchObject({
      storage: { mode: "MEMORY", schemaVersion: 8 },
      semanticDecisions: [{ decisionId: decision.decisionId }],
      simulationBundles: [{ artifactHash: simulation.artifactHash }],
      cases: [
        {
          opportunityId,
          state: "AWAITING_EXACT_CERTIFICATE",
          nextAction: "RUN_EXACT_VERIFIER",
        },
      ],
    });

    const restored = new OpportunityLifecycleDesk(undefined, store);
    expect(restored.projection()).toEqual(first.projection());
    restored.syncMarketArchaeologist(archaeologist);
    expect(restored.projection().caseCount).toBe(1);
    store.close();
  });
});
