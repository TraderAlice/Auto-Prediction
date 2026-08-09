import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import { runOpportunitySimulation } from "@pmh/execution";
import {
  verifyArbitrageCandidate,
  type ArbitrageCandidate,
} from "@pmh/opportunity";
import {
  OpportunityLifecycleDesk,
  RealCandidatePreflightDesk,
  type ExactOpportunityVerificationRecord,
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
      storage: { mode: "MEMORY", schemaVersion: 28 },
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

    const bindings = simulation.reports.map((simulationReport, index) => ({
      legId: simulation.plan.legs[index]!.legId,
      listingId: simulationReport.instrumentId,
      listingRuleHash: hashCanonical({ listing: index }),
      feeScheduleHash: simulationReport.feeScheduleHash,
      bookGenerationHash: hashCanonical({ generation: index }),
      bookStateHash: simulationReport.inputStateHash,
      priceTick: 1n,
      quantityTick: 1n,
    }));
    const candidate: ArbitrageCandidate = {
      classification: "VENUE_BOUNDED_ARBITRAGE",
      claimGraphHash: hashCanonical({ qualification: "durable" }),
      resolutionPartitionHash: hashCanonical({ states: ["FF", "TT"] }),
      resolutionStateIds: ["FF", "TT"],
      legs: simulation.plan.legs.map((simulationLeg, index) => {
        const simulationReport = simulation.reports[index]!;
        const binding = bindings[index]!;
        return {
          id: simulationLeg.legId,
          venueId: simulationReport.venueId,
          listingId: simulationReport.instrumentId,
          action: "BUY",
          quantity: simulationReport.filledQuantity,
          maxQuantity: simulationReport.filledQuantity,
          quantityScale: simulationReport.quantityScale,
          quantityTick: 1n,
          unitPrice:
            (simulationReport.grossCollateral *
              simulationReport.quantityScale) /
            simulationReport.filledQuantity,
          priceTick: 1n,
          fee: { flat: 0n, rate: 0n, rateScale: 10_000n },
          payoutPerUnitByResolution: Object.fromEntries(
            simulation.plan.canonicalStates.map((state) => [
              state.stateId,
              state.winningLegIds.includes(simulationLeg.legId)
                ? simulationLeg.payoutPerWinningUnit
                : 0n,
            ]),
          ),
          listingRuleHash: binding.listingRuleHash,
          feeScheduleHash: binding.feeScheduleHash,
          bookGenerationHash: binding.bookGenerationHash,
          bookStateHash: binding.bookStateHash,
        };
      }),
      venueAssumptions: [
        `SIMULATION_BUNDLE=${simulation.artifactHash}`,
        `MATERIALIZATION=${hashCanonical({ materialization: "durable" })}`,
      ],
      expiresAtEpochMs: BigInt(
        Date.parse("2026-08-01T00:03:00.000Z"),
      ),
    };
    const verifiedAtEpochMs = BigInt(
      Date.parse("2026-08-01T00:02:00.000Z"),
    );
    const certificate = verifyArbitrageCandidate(candidate, {
      nowEpochMs: verifiedAtEpochMs,
      claimGraphHash: candidate.claimGraphHash,
      resolutionPartitionHash: candidate.resolutionPartitionHash,
      listingRuleHashById: new Map(
        bindings.map((binding) => [binding.listingId, binding.listingRuleHash]),
      ),
      feeScheduleHashByListingId: new Map(
        bindings.map((binding) => [binding.listingId, binding.feeScheduleHash]),
      ),
      bookGenerationHashByListingId: new Map(
        bindings.map((binding) => [binding.listingId, binding.bookGenerationHash]),
      ),
      bookStateHashByListingId: new Map(
        bindings.map((binding) => [binding.listingId, binding.bookStateHash]),
      ),
    });
    const exactBody = {
      schemaVersion: "pmh.exact-opportunity-verification.v1" as const,
      opportunityId,
      qualificationHash: candidate.claimGraphHash,
      materializationId: hashCanonical({ materialization: "durable" }),
      simulationBundleHash: simulation.artifactHash,
      candidateHash: hashCanonical(candidate),
      attemptedAt: "2026-08-01T00:02:00.000Z",
      verifiedAtEpochMs,
      status: "CERTIFIED" as const,
      diagnostic: null,
      bindings,
      candidate,
      certificate,
      authority: "FIRST_PARTY_EXACT_VERIFIER" as const,
      executionAuthority: false as const,
      effects: {
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      },
    };
    const exact: ExactOpportunityVerificationRecord = {
      ...exactBody,
      artifactHash: hashCanonical(exactBody),
    };
    expect(first.recordExactVerification(opportunityId, exact)).toMatchObject({
      state: "AWAITING_HUMAN_APPROVAL",
      certificateId: certificate.id,
    });
    expect(
      first.recordShadowDecision(opportunityId, "APPROVE_SHADOW"),
    ).toMatchObject({
      state: "SHADOW_COMPLETE",
      effects: {
        productionApprovalAccepted: false,
        liveOrdersPlaced: false,
        valueMovingActions: false,
      },
    });
    const observedSimulation = runOpportunitySimulation({
      ...simulation.plan,
      legs: simulation.plan.legs.map((leg, index) => ({
        ...leg,
        request: leg.request.model === "CLOB_TAKER_V1"
          ? {
              ...leg.request,
              levels: index === 0
                ? [{
                    price: 600n,
                    quantity: 1_000n,
                    levelIdentity: hashCanonical({ observed: "more-expensive" }),
                  }]
                : leg.request.levels,
              bookStateHash: hashCanonical({ observed: true, index }),
              observedAtEpochMs: 1_785_523_201_000n,
            }
          : leg.request,
      })),
    });
    const shadowObservation = first.recordShadowMarketObservation(
      opportunityId,
      observedSimulation,
      hashCanonical({ materialization: "shadow-observed" }),
    );
    expect(shadowObservation).toMatchObject({
      status: "DIVERGED",
      reasons: [
        "COST_EXCEEDS_CERTIFICATE_BOUND",
        "NON_POSITIVE_PORTFOLIO_FLOOR",
      ],
      gatewayCalls: 0,
      comparison: {
        publicMarketEvidenceOnly: true,
        actualOrderObserved: false,
        certificateReverificationRequired: true,
      },
    });
    expect(first.projection()).toMatchObject({
      exactVerifications: [
        {
          artifactHash: exact.artifactHash,
          certificateId: certificate.id,
          status: "CERTIFIED",
        },
      ],
      shadowRuns: [
        {
          certificateId: certificate.id,
          status: "LOCKED",
          gatewayCalls: 0,
          executionAuthority: false,
        },
      ],
      shadowObservations: [
        {
          artifactHash: shadowObservation.artifactHash,
          status: "DIVERGED",
          actualOrderObserved: false,
          gatewayCalls: 0,
          authority: "FIRST_PARTY_SHADOW_OBSERVER",
          executionAuthority: false,
        },
      ],
    });

    const restored = new OpportunityLifecycleDesk(undefined, store);
    expect(restored.projection()).toEqual(first.projection());
    restored.syncMarketArchaeologist(archaeologist);
    expect(restored.projection().caseCount).toBe(1);

    const automatic = new OpportunityLifecycleDesk(
      {
        routeAfterCertificate: "AUTO_SHADOW",
        notificationChannel: "IN_APP_ONLY",
        liveExecutionEnabled: false,
      },
      undefined,
      250,
      () => Date.parse("2026-08-01T00:02:00.000Z"),
    );
    automatic.syncMarketArchaeologist(archaeologist);
    automatic.recordResearchSemanticDecision(
      opportunityId,
      review,
      "ACCEPT_FOR_SIMULATION",
      "Operator accepts this exact conditional scope for non-value-moving simulation.",
    );
    automatic.recordOpportunitySimulation(opportunityId, simulation);
    expect(
      automatic.recordExactVerification(opportunityId, exact),
    ).toMatchObject({
      state: "SHADOW_COMPLETE",
      shadowExecutionArtifactHash: expect.stringMatching(/^sha256:/),
      effects: {
        productionApprovalAccepted: false,
        liveOrdersPlaced: false,
        valueMovingActions: false,
      },
    });
    expect(automatic.projection().shadowRuns).toEqual([
      expect.objectContaining({
        certificateId: certificate.id,
        status: "LOCKED",
        gatewayCalls: 0,
        executionAuthority: false,
      }),
    ]);
    store.close();
  });
});
