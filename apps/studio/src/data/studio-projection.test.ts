import { describe, expect, it } from "vitest";
import {
  buildStudioProjection,
  HeuristicDiscoveryWorker,
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
        idempotencyKey: "taskId+catalogContextIdentity",
      },
      records: [],
    });
    expect(JSON.stringify(studioProjection)).not.toContain("apiKey");
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
