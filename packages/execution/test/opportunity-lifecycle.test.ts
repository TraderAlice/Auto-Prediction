import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import type { ArbitrageCertificate } from "@pmh/opportunity";
import {
  OpportunityLifecycleMachine,
  simulateClobTaker,
  simulateConstantProductAmm,
  type OpportunityLifecyclePolicy,
} from "../src/index.js";

const DISCOVERY = hashCanonical({ discovery: "ai-proposal" });
const REVIEW = hashCanonical({ review: "independent" });
const EXECUTION = hashCanonical({ execution: "shadow" });
const SCALE = 100n;

const certificateBody: Omit<ArbitrageCertificate, "id"> = {
  classification: "CERTIFIED_CONTRACT_ARBITRAGE",
  claimGraphHash: hashCanonical({ claim: "graph" }),
  resolutionPartitionHash: hashCanonical({ resolution: "partition" }),
  listingRuleHashes: [],
  bookGenerationHashes: [],
  bookStateHashes: [],
  feeScheduleHashes: [],
  legs: [],
  grossPayoffByResolution: { YES: 1n },
  payoffByResolution: { YES: 1n },
  worstCaseGross: 1n,
  worstCaseAfterFees: 1n,
  capitalRequiredByVenue: {},
  venueAssumptions: [],
  expiresAtEpochMs: 100_000n,
};
const CERTIFICATE: ArbitrageCertificate = Object.freeze({
  id: hashCanonical(certificateBody),
  ...certificateBody,
});

const policies: Readonly<Record<string, OpportunityLifecyclePolicy>> = {
  auto: {
    routeAfterCertificate: "AUTO_SHADOW",
    notificationChannel: "IN_APP_ONLY",
    liveExecutionEnabled: false,
  },
  approval: {
    routeAfterCertificate: "REQUIRE_HUMAN_APPROVAL",
    notificationChannel: "IN_APP_ONLY",
    liveExecutionEnabled: false,
  },
  notify: {
    routeAfterCertificate: "NOTIFY_ONLY",
    notificationChannel: "IN_APP_ONLY",
    liveExecutionEnabled: false,
  },
};

function fullClobSimulation() {
  return simulateClobTaker({
    model: "CLOB_TAKER_V1",
    venueId: "venue:a",
    instrumentId: "listing:a",
    side: "BUY",
    fillPolicy: "FILL_OR_KILL",
    requestedQuantity: SCALE,
    quantityScale: SCALE,
    collateralScale: SCALE,
    levels: [
      {
        price: 40n,
        quantity: SCALE,
        levelIdentity: hashCanonical({ level: 1 }),
      },
    ],
    fee: {
      rate: 0n,
      rateScale: 10_000n,
      flat: 0n,
      scheduleHash: hashCanonical({ fee: 0 }),
    },
    bookStateHash: hashCanonical({ book: 1 }),
    observedAtEpochMs: 1_000n,
  });
}

function reviewedMachine(policy: OpportunityLifecyclePolicy) {
  let now = 1_000;
  const machine = new OpportunityLifecycleMachine(
    "opportunity:test",
    "AI_RELATION_PROPOSAL",
    DISCOVERY,
    policy,
    () => now++,
  );
  machine.recordSemanticReview(REVIEW, "ACCEPT");
  machine.recordExchangeSimulation([fullClobSimulation()]);
  return machine;
}

describe("opportunity product lifecycle", () => {
  it("routes an exact certificate into automatic shadow, never live execution", () => {
    const machine = reviewedMachine(policies.auto!);
    expect(machine.projection()).toMatchObject({
      state: "AWAITING_EXACT_CERTIFICATE",
      nextAction: "RUN_EXACT_VERIFIER",
    });
    expect(machine.bindExactCertificate(CERTIFICATE)).toMatchObject({
      state: "SHADOW_READY",
      nextAction: "START_SHADOW_EXECUTION",
      effects: {
        externalMessagesSent: false,
        productionApprovalAccepted: false,
        liveOrdersPlaced: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    machine.beginShadowExecution();
    const completed = machine.completeShadowExecution(EXECUTION);
    expect(completed).toMatchObject({
      state: "SHADOW_COMPLETE",
      shadowExecutionArtifactHash: EXECUTION,
      nextAction: "NONE",
    });
    expect(completed.events.map((event) => event.kind)).toEqual([
      "DISCOVERED",
      "SEMANTIC_REVIEW_ACCEPTED",
      "SIMULATION_ACCEPTED",
      "CERTIFICATE_BOUND",
      "AUTO_SHADOW_QUEUED",
      "SHADOW_STARTED",
      "SHADOW_COMPLETED",
    ]);
    expect(
      new Set(completed.events.map((event) => event.eventId)).size,
    ).toBe(completed.events.length);
  });

  it("requires an explicit operator decision when policy says approval", () => {
    const machine = reviewedMachine(policies.approval!);
    expect(machine.bindExactCertificate(CERTIFICATE)).toMatchObject({
      state: "AWAITING_HUMAN_APPROVAL",
      nextAction: "WAIT_FOR_HUMAN_APPROVAL",
    });
    expect(machine.recordHumanDecision("APPROVE_SHADOW")).toMatchObject({
      state: "SHADOW_READY",
      effects: { productionApprovalAccepted: false },
    });

    const rejected = reviewedMachine(policies.approval!);
    rejected.bindExactCertificate(CERTIFICATE);
    expect(rejected.recordHumanDecision("REJECT")).toMatchObject({
      state: "REJECTED_BY_OPERATOR",
      nextAction: "NONE",
    });
  });

  it("supports notify-only product routing without sending an external message", () => {
    const machine = reviewedMachine(policies.notify!);
    const projection = machine.bindExactCertificate(CERTIFICATE);
    expect(projection).toMatchObject({
      state: "NOTIFIED_ONLY",
      nextAction: "DISPLAY_NOTIFICATION",
      effects: { externalMessagesSent: false, liveOrdersPlaced: false },
    });
    expect(projection.events.at(-1)).toMatchObject({
      kind: "IN_APP_NOTIFICATION_QUEUED",
    });
    expect(() => machine.beginShadowExecution()).toThrow(
      /expected SHADOW_READY/,
    );
  });

  it("separates generic AMM exploration from venue-calibrated simulation", () => {
    const machine = new OpportunityLifecycleMachine(
      "opportunity:amm",
      "DETERMINISTIC_SEARCH_LEAD",
      DISCOVERY,
      policies.approval!,
      () => 1_000,
    );
    machine.recordSemanticReview(REVIEW, "ACCEPT");
    const genericAmm = simulateConstantProductAmm({
      model: "CONSTANT_PRODUCT_AMM_V1",
      venueId: "myriad",
      instrumentId: "market:1",
      action: "BUY_EXACT_OUT",
      outcomeQuantity: 10n,
      quantityScale: SCALE,
      collateralScale: SCALE,
      collateralReserve: 100n,
      outcomeReserve: 200n,
      fee: {
        rate: 0n,
        rateScale: 10_000n,
        flat: 0n,
        scheduleHash: hashCanonical({ fee: 0 }),
      },
      poolStateHash: hashCanonical({ pool: 1 }),
      observedAtEpochMs: 1_000n,
    });
    expect(machine.recordExchangeSimulation([genericAmm])).toMatchObject({
      state: "AWAITING_MODEL_CALIBRATION",
      nextAction: "CALIBRATE_VENUE_MODEL",
      certificateId: null,
    });
    expect(() => machine.bindExactCertificate(CERTIFICATE)).toThrow(
      /expected AWAITING_EXACT_CERTIFICATE/,
    );
  });

  it("fails closed on rejected semantics, partial fills, and out-of-order actions", () => {
    const rejected = new OpportunityLifecycleMachine(
      "opportunity:rejected",
      "AI_RELATION_PROPOSAL",
      DISCOVERY,
      policies.auto!,
      () => 1_000,
    );
    expect(rejected.recordSemanticReview(REVIEW, "REJECT")).toMatchObject({
      state: "REJECTED_SEMANTICS",
    });
    expect(() => rejected.recordExchangeSimulation([fullClobSimulation()])).toThrow(
      /expected AWAITING_EXCHANGE_SIMULATION/,
    );

    const partial = new OpportunityLifecycleMachine(
      "opportunity:partial",
      "AI_RELATION_PROPOSAL",
      DISCOVERY,
      policies.auto!,
      () => 1_000,
    );
    partial.recordSemanticReview(REVIEW, "ACCEPT");
    const partialReport = simulateClobTaker({
      model: "CLOB_TAKER_V1",
      venueId: "venue",
      instrumentId: "thin",
      side: "BUY",
      fillPolicy: "IMMEDIATE_OR_CANCEL",
      requestedQuantity: 10n,
      quantityScale: SCALE,
      collateralScale: SCALE,
      levels: [
        {
          price: 40n,
          quantity: 5n,
          levelIdentity: hashCanonical({ level: "thin" }),
        },
      ],
      fee: {
        rate: 0n,
        rateScale: 10_000n,
        flat: 0n,
        scheduleHash: hashCanonical({ fee: 0 }),
      },
      bookStateHash: hashCanonical({ book: "thin" }),
      observedAtEpochMs: 1_000n,
    });
    expect(partial.recordExchangeSimulation([partialReport])).toMatchObject({
      state: "REJECTED_SIMULATION",
      nextAction: "NONE",
    });

    const tampered = new OpportunityLifecycleMachine(
      "opportunity:tampered",
      "AI_RELATION_PROPOSAL",
      DISCOVERY,
      policies.auto!,
      () => 1_000,
    );
    tampered.recordSemanticReview(REVIEW, "ACCEPT");
    const simulation = fullClobSimulation();
    expect(() =>
      tampered.recordExchangeSimulation([
        { ...simulation, netCollateral: simulation.netCollateral + 1n },
      ]),
    ).toThrow(/authority boundary/);
  });

  it("can retire a deterministic lead before spending semantic-review budget", () => {
    const machine = new OpportunityLifecycleMachine(
      "opportunity:preflight-rejected",
      "DETERMINISTIC_SEARCH_LEAD",
      DISCOVERY,
      policies.approval!,
      () => 1_000,
    );
    const preflight = hashCanonical({ preflight: "negative-edge" });
    expect(
      machine.recordPreflightRejection(
        preflight,
        "Conservative depth costs exceed the maximum payout.",
      ),
    ).toMatchObject({
      state: "REJECTED_PREFLIGHT",
      nextAction: "NONE",
      effects: { liveOrdersPlaced: false, valueMovingActions: false },
    });
    expect(machine.projection().events.at(-1)).toMatchObject({
      kind: "PREFLIGHT_REJECTED",
      artifactHash: preflight,
    });
    expect(() => machine.recordSemanticReview(REVIEW, "ACCEPT")).toThrow(
      /expected AWAITING_SEMANTIC_REVIEW/,
    );
  });

  it("does not admit an AUTO_LIVE policy", () => {
    expect(
      () =>
        new OpportunityLifecycleMachine(
          "opportunity:invalid",
          "AI_RELATION_PROPOSAL",
          DISCOVERY,
          {
            routeAfterCertificate: "AUTO_LIVE",
            notificationChannel: "IN_APP_ONLY",
            liveExecutionEnabled: false,
          } as unknown as OpportunityLifecyclePolicy,
        ),
    ).toThrow(/policy is invalid/);
  });

  it("rejects a content-invalid or expired certificate", () => {
    const invalid = reviewedMachine(policies.auto!);
    expect(() =>
      invalid.bindExactCertificate({
        ...CERTIFICATE,
        worstCaseAfterFees: 2n,
      }),
    ).toThrow(/certificate is invalid/);

    const expiredBody = { ...certificateBody, expiresAtEpochMs: 1n };
    const expired: ArbitrageCertificate = {
      id: hashCanonical(expiredBody),
      ...expiredBody,
    };
    expect(() => reviewedMachine(policies.auto!).bindExactCertificate(expired)).toThrow(
      /expired/,
    );
  });
});
