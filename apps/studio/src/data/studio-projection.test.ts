import { describe, expect, it } from "vitest";
import {
  buildStudioProjection,
  HeuristicDiscoveryWorker,
  RealCandidatePreflightDesk,
  ReplayBookDesk,
} from "@pmh/control-plane";

describe("Studio projection safety", () => {
  const studioProjection = buildStudioProjection({
    workers: [new HeuristicDiscoveryWorker()],
    activeRuns: 0,
  });

  it("keeps live execution disabled", () => {
    expect(studioProjection.system.liveExecutionEnabled).toBe(false);
    expect(studioProjection.identity.mode).toBe("CONTROL_PLANE");
  });

  it("shows the fail-closed model budget without exposing credentials", () => {
    expect(studioProjection.ai.modelProvider).toMatchObject({
      provider: "DEEPSEEK_CHAT_COMPLETIONS",
      transport: "VERCEL_AI_SDK",
      configured: false,
      credentialEnv: "DEEPSEEK_API_KEY",
      model: "deepseek-v4-flash",
      maxOutputTokens: 800,
      timeoutMs: 8_000,
      responseStorage: "PROVIDER_POLICY",
      authority: "PROPOSE_ONLY",
    });
    expect(studioProjection.ai.workers).toContainEqual(
      expect.objectContaining({
        workerId: "model-fast-lane",
        status: "NEEDS_KEY",
      }),
    );
    expect(studioProjection.ai.investigator).toMatchObject({
      engine: "PI_CLI",
      configured: false,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      mode: "TEXT_ONE_SHOT",
      tools: ["read", "grep", "find", "ls"],
      sessionPersistence: false,
      timeoutMs: 300_000,
      authority: "PROPOSE_ONLY",
    });
    expect(studioProjection.ai.investigationDesk).toMatchObject({
      activeCount: 0,
      runCount: 0,
      passCount: 0,
      failedCount: 0,
      storage: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "taskId+catalogContextIdentity",
      },
      records: [],
    });
    expect(studioProjection.ai.researchDesk).toEqual({
      caseCount: 0,
      activeCount: 0,
      evidenceGapCount: 0,
      awaitingReviewCount: 0,
      needsContextCount: 0,
      needsInvestigationCount: 0,
      cases: [],
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(studioProjection.ai.opportunityRadar).toEqual({
      algorithmVersion: "pmh.opportunity-radar.lexical-v1",
      sourceSetIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      observedListingCount: 0,
      eligibleSourceCount: 0,
      excludedSourceCount: 0,
      candidateCount: 0,
      candidates: [],
      scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE",
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(studioProjection.qualification.realCandidatePreflight).toBeNull();
    expect(studioProjection.qualification.realCandidateDepth).toBeNull();
    expect(studioProjection.qualification.realCandidateDisposition).toBeNull();
    expect(studioProjection.qualification.realCandidateRescreen).toBeNull();
    expect(studioProjection.qualification.candidateWatch).toMatchObject({
      status: "IDLE",
      authority: "OBSERVE_AND_SCREEN_ONLY",
      latestRefreshId: null,
      decision: null,
      storage: { mode: "MEMORY", durable: false, schemaVersion: 0 },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(JSON.stringify(studioProjection)).not.toContain("apiKey");
  });

  it("keeps live observations explicit and ineligible until refreshed", () => {
    expect(studioProjection.ai.catalogObservation).toMatchObject({
      status: "IDLE",
      promotion: "OBSERVE_ONLY",
      contextQualification: {
        status: "INELIGIBLE",
        eligibleSourceCount: 0,
        maxAgeMs: 900_000,
        maxListingsPerTask: 30,
        requiresExplicitRequest: true,
        defaultMode: "VERIFIED_FIXTURES",
        authority: "PROPOSE_ONLY",
      },
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
  });

  it("exposes demo and sandbox order shapes as inert posture only", () => {
    const inertVenues = studioProjection.venues.filter(
      (venue) => venue.gatewayPosture !== "ABSENT",
    );
    expect(studioProjection.system.inertOrderGateways).toBe(2);
    expect(inertVenues.map((venue) => venue.gatewayPosture).sort()).toEqual([
      "INERT_DEMO",
      "INERT_SANDBOX",
    ]);
    expect(inertVenues.every((venue) => !venue.liveExecutionEnabled)).toBe(
      true,
    );
  });

  it("labels every displayed opportunity as exact fixture evidence", () => {
    expect(
      studioProjection.opportunities.every(
        (opportunity) => opportunity.confidence === "EXACT",
      ),
    ).toBe(true);
    expect(
      studioProjection.opportunities.every(
        (opportunity) =>
          opportunity.source === "SYNTHETIC_QUALIFICATION_FIXTURE",
      ),
    ).toBe(true);
    expect(studioProjection.opportunities).toHaveLength(1);
    expect(studioProjection.opportunities[0]?.certificate).toBe(
      studioProjection.qualification.reviewedCompilation.certificate.id,
    );
    expect(studioProjection.capitalScope).toBe(
      "SYNTHETIC_QUALIFICATION_FIXTURE",
    );
  });

  it("shows a fully bound review-to-verifier qualification path", () => {
    const qualification = studioProjection.qualification.reviewedCompilation;
    expect(qualification.status).toBe("PASS");
    expect(qualification.stages.map((stage) => stage.stage)).toEqual([
      "DISCOVERY",
      "INDEPENDENT_REVIEW",
      "DETERMINISTIC_COMPILATION",
      "EXACT_VERIFICATION",
      "EXECUTION_AUTHORITY",
    ]);
    expect(qualification.stages.at(-1)).toMatchObject({
      status: "BLOCKED",
      detail: "fixture certificate · shadow only",
    });
    expect(qualification.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
  });

  it("projects the real candidate as a stopped preflight rather than an opportunity", async () => {
    const preflightDesk = new RealCandidatePreflightDesk();
    await preflightDesk.load();
    const projection = buildStudioProjection({
      workers: [new HeuristicDiscoveryWorker()],
      activeRuns: 0,
      realCandidatePreflight: preflightDesk.projection(),
      realCandidateDepth: preflightDesk.depthProjection(),
      realCandidateDisposition: preflightDesk.dispositionProjection(),
      realCandidateRescreen: preflightDesk.rescreenProjection(),
    });
    expect(projection.qualification.realCandidatePreflight).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      catalogIndicativeGrossEdgeBps: "55",
      venueReportedBuyGrossEdgeBps: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
    });
    expect(projection.qualification.realCandidateDepth).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      screenQuantity: "500000000",
      quantityBound: true,
      grossEdgeBpsBeforeFees: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
    });
    expect(projection.qualification.realCandidateDisposition).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      postFeeFloorUpperBound: "0",
      strictlyPositivePostFeeFloorPossible: false,
      terminalForSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
    });
    expect(projection.qualification.realCandidateRescreen).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      rescreenSequence: 2,
      previousDispositionInvalidated: true,
      conclusionRecomputed: true,
      priorDecisionReused: false,
      decisionContinuity: "REJECTED_TO_REJECTED",
      currentGrossFloorUpperBoundBeforeFees: "0",
      currentPostFeeFloorUpperBound: "0",
      terminalForCurrentSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
    });
    expect(projection.opportunities).toHaveLength(1);
    expect(
      projection.opportunities.every(
        (opportunity) =>
          opportunity.source === "SYNTHETIC_QUALIFICATION_FIXTURE",
      ),
    ).toBe(true);
  });

  it("binds the projection to a state identity", () => {
    expect(studioProjection.identity.stateHash).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
  });

  it("carries verified replay books without adding execution authority", async () => {
    const bookDesk = await new ReplayBookDesk().replay();
    const projection = buildStudioProjection({
      workers: [new HeuristicDiscoveryWorker()],
      activeRuns: 0,
      bookDesk,
    });
    expect(projection.bookDesk.books).toHaveLength(3);
    expect(
      projection.bookDesk.books.every(
        (book) => book.lifecycle === "SNAPSHOT_VALID",
      ),
    ).toBe(true);
    expect(projection.system.liveExecutionEnabled).toBe(false);
    expect(projection.qualification.replayChaos).toMatchObject({
      status: "PASS",
      caseCount: 6,
      passCount: 6,
      effects: { liveExecutionEnabled: false },
    });
    expect(projection.qualification.campaignEvidence).toMatchObject({
      status: "PASS",
      effects: { liveExecutionEnabled: false },
    });
    expect(projection.qualification.campaignEvidence.artifactHash).toMatch(
      /^sha256:/,
    );
  });
});
