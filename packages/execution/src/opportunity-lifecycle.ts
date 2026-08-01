import { hashCanonical, type Hash } from "@pmh/domain";
import type { ArbitrageCertificate } from "@pmh/opportunity";
import type { ExchangeSimulationEvidence } from "./exchange-simulator.js";

export type OpportunityLifecycleState =
  | "AWAITING_SEMANTIC_REVIEW"
  | "REJECTED_PREFLIGHT"
  | "REJECTED_SEMANTICS"
  | "AWAITING_EXCHANGE_SIMULATION"
  | "AWAITING_MODEL_CALIBRATION"
  | "REJECTED_SIMULATION"
  | "AWAITING_EXACT_CERTIFICATE"
  | "NOTIFIED_ONLY"
  | "AWAITING_HUMAN_APPROVAL"
  | "REJECTED_BY_OPERATOR"
  | "SHADOW_READY"
  | "SHADOW_RUNNING"
  | "SHADOW_COMPLETE"
  | "ARCHIVED";

export type OpportunityRoutePolicy =
  | "NOTIFY_ONLY"
  | "REQUIRE_HUMAN_APPROVAL"
  | "AUTO_SHADOW";

export type OpportunityLifecyclePolicy = Readonly<{
  routeAfterCertificate: OpportunityRoutePolicy;
  notificationChannel: "IN_APP_ONLY" | "DISABLED";
  liveExecutionEnabled: false;
}>;

export type OpportunityLifecycleEvent = Readonly<{
  eventId: Hash;
  sequence: number;
  occurredAt: string;
  kind:
    | "DISCOVERED"
    | "PREFLIGHT_REJECTED"
    | "SEMANTIC_REVIEW_ACCEPTED"
    | "SEMANTIC_REVIEW_REJECTED"
    | "SIMULATION_ACCEPTED"
    | "SIMULATION_REJECTED"
    | "MODEL_CALIBRATION_REQUIRED"
    | "CERTIFICATE_BOUND"
    | "IN_APP_NOTIFICATION_QUEUED"
    | "HUMAN_APPROVAL_REQUESTED"
    | "HUMAN_APPROVED_SHADOW"
    | "HUMAN_REJECTED"
    | "AUTO_SHADOW_QUEUED"
    | "SHADOW_STARTED"
    | "SHADOW_COMPLETED"
    | "ARCHIVED";
  artifactHash: Hash | null;
  detail: string;
}>;

export type OpportunityLifecycleProjection = Readonly<{
  schemaVersion: "pmh.opportunity-lifecycle.v1";
  opportunityId: string;
  discoveryKind: "AI_RELATION_PROPOSAL" | "DETERMINISTIC_SEARCH_LEAD";
  state: OpportunityLifecycleState;
  policy: OpportunityLifecyclePolicy;
  discoveryArtifactHash: Hash;
  semanticReviewArtifactHash: Hash | null;
  simulationBundleHash: Hash | null;
  certificateId: Hash | null;
  shadowExecutionArtifactHash: Hash | null;
  nextAction:
    | "INDEPENDENT_SEMANTIC_REVIEW"
    | "RUN_EXCHANGE_SIMULATION"
    | "CALIBRATE_VENUE_MODEL"
    | "RUN_EXACT_VERIFIER"
    | "DISPLAY_NOTIFICATION"
    | "WAIT_FOR_HUMAN_APPROVAL"
    | "START_SHADOW_EXECUTION"
    | "MONITOR_SHADOW_EXECUTION"
    | "NONE";
  events: readonly OpportunityLifecycleEvent[];
  effects: Readonly<{
    externalMessagesSent: false;
    productionApprovalAccepted: false;
    liveOrdersPlaced: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function checkedHash(value: string, name: string): Hash {
  if (!HASH_PATTERN.test(value)) throw new Error(`${name} must be a SHA-256 hash`);
  return value as Hash;
}

function iso(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("lifecycle clock returned an invalid epoch");
  }
  return new Date(value).toISOString();
}

function nextActionFor(
  state: OpportunityLifecycleState,
): OpportunityLifecycleProjection["nextAction"] {
  switch (state) {
    case "AWAITING_SEMANTIC_REVIEW":
      return "INDEPENDENT_SEMANTIC_REVIEW";
    case "AWAITING_EXCHANGE_SIMULATION":
      return "RUN_EXCHANGE_SIMULATION";
    case "AWAITING_MODEL_CALIBRATION":
      return "CALIBRATE_VENUE_MODEL";
    case "AWAITING_EXACT_CERTIFICATE":
      return "RUN_EXACT_VERIFIER";
    case "NOTIFIED_ONLY":
      return "DISPLAY_NOTIFICATION";
    case "AWAITING_HUMAN_APPROVAL":
      return "WAIT_FOR_HUMAN_APPROVAL";
    case "SHADOW_READY":
      return "START_SHADOW_EXECUTION";
    case "SHADOW_RUNNING":
      return "MONITOR_SHADOW_EXECUTION";
    default:
      return "NONE";
  }
}

export class OpportunityLifecycleMachine {
  #state: OpportunityLifecycleState = "AWAITING_SEMANTIC_REVIEW";
  #semanticReviewArtifactHash: Hash | null = null;
  #simulationBundleHash: Hash | null = null;
  #certificateId: Hash | null = null;
  #shadowExecutionArtifactHash: Hash | null = null;
  readonly #events: OpportunityLifecycleEvent[] = [];

  public constructor(
    public readonly opportunityId: string,
    public readonly discoveryKind: OpportunityLifecycleProjection["discoveryKind"],
    public readonly discoveryArtifactHash: Hash,
    public readonly policy: OpportunityLifecyclePolicy,
    private readonly now: () => number = Date.now,
  ) {
    if (opportunityId.trim() === "" || opportunityId.length > 500) {
      throw new Error("opportunity lifecycle ID is invalid");
    }
    checkedHash(discoveryArtifactHash, "discovery artifact");
    if (
      policy.liveExecutionEnabled !== false ||
      !["NOTIFY_ONLY", "REQUIRE_HUMAN_APPROVAL", "AUTO_SHADOW"].includes(
        policy.routeAfterCertificate,
      ) ||
      !["IN_APP_ONLY", "DISABLED"].includes(policy.notificationChannel)
    ) {
      throw new Error("opportunity lifecycle policy is invalid");
    }
    this.#append("DISCOVERED", discoveryArtifactHash, "Unreviewed opportunity entered the research lifecycle.");
  }

  public recordSemanticReview(
    reviewArtifactHash: Hash,
    decision: "ACCEPT" | "REJECT",
  ): OpportunityLifecycleProjection {
    this.#expect("AWAITING_SEMANTIC_REVIEW");
    this.#semanticReviewArtifactHash = checkedHash(
      reviewArtifactHash,
      "semantic review artifact",
    );
    if (decision === "ACCEPT") {
      this.#state = "AWAITING_EXCHANGE_SIMULATION";
      this.#append(
        "SEMANTIC_REVIEW_ACCEPTED",
        reviewArtifactHash,
        "Independent semantic review accepted the exact relation scope.",
      );
    } else {
      this.#state = "REJECTED_SEMANTICS";
      this.#append(
        "SEMANTIC_REVIEW_REJECTED",
        reviewArtifactHash,
        "Independent semantic review rejected the relation.",
      );
    }
    return this.projection();
  }

  public recordPreflightRejection(
    artifactHash: Hash,
    detail: string,
  ): OpportunityLifecycleProjection {
    this.#expect("AWAITING_SEMANTIC_REVIEW");
    if (detail.trim() === "" || detail.length > 1_000) {
      throw new Error("opportunity preflight diagnostic is invalid");
    }
    this.#state = "REJECTED_PREFLIGHT";
    this.#append(
      "PREFLIGHT_REJECTED",
      checkedHash(artifactHash, "preflight artifact"),
      detail.trim(),
    );
    return this.projection();
  }

  public recordExchangeSimulation(
    reports: readonly ExchangeSimulationEvidence[],
  ): OpportunityLifecycleProjection {
    this.#expect("AWAITING_EXCHANGE_SIMULATION");
    if (reports.length === 0 || reports.length > 50) {
      throw new Error("opportunity lifecycle requires a bounded simulation bundle");
    }
    for (const report of reports) {
      checkedHash(report.artifactHash, "exchange simulation artifact");
      const { artifactHash, ...reportBody } = report;
      if (
        artifactHash !== hashCanonical(reportBody) ||
        report.authority !== "SIMULATION_ONLY" ||
        report.effects.externalWrites !== false ||
        report.effects.valueMovingActions !== false ||
        report.effects.liveExecutionEnabled !== false
      ) {
        throw new Error("exchange simulation crossed its authority boundary");
      }
    }
    this.#simulationBundleHash = hashCanonical({
      schemaVersion: "pmh.exchange-simulation-bundle.v1",
      opportunityId: this.opportunityId,
      reportHashes: reports.map((report) => report.artifactHash).sort(),
    });
    if (reports.some((report) => report.status !== "FULL")) {
      this.#state = "REJECTED_SIMULATION";
      this.#append(
        "SIMULATION_REJECTED",
        this.#simulationBundleHash,
        "The exchange simulation could not fully execute every required leg.",
      );
    } else if (
      reports.some(
        (report) =>
          report.modelQualification ===
          "GENERIC_CONSTANT_PRODUCT_NOT_VENUE_CALIBRATED",
      )
    ) {
      this.#state = "AWAITING_MODEL_CALIBRATION";
      this.#append(
        "MODEL_CALIBRATION_REQUIRED",
        this.#simulationBundleHash,
        "At least one generic exchange model lacks venue calibration.",
      );
    } else {
      this.#state = "AWAITING_EXACT_CERTIFICATE";
      this.#append(
        "SIMULATION_ACCEPTED",
        this.#simulationBundleHash,
        "Every exchange-model leg fully executed under bound assumptions.",
      );
    }
    return this.projection();
  }

  public bindExactCertificate(
    certificate: ArbitrageCertificate,
  ): OpportunityLifecycleProjection {
    this.#expect("AWAITING_EXACT_CERTIFICATE");
    const { id: certificateId, ...certificateBody } = certificate;
    this.#certificateId = checkedHash(certificateId, "exact certificate");
    if (
      certificateId !== hashCanonical(certificateBody) ||
      (certificate.classification !== "CERTIFIED_CONTRACT_ARBITRAGE" &&
        certificate.classification !== "VENUE_BOUNDED_ARBITRAGE") ||
      certificate.worstCaseAfterFees <= 0n ||
      certificate.expiresAtEpochMs <= BigInt(this.now())
    ) {
      throw new Error("exact certificate is invalid, non-arbitrage, or expired");
    }
    this.#append(
      "CERTIFICATE_BOUND",
      certificateId,
      "The first-party exact verifier certificate is bound to this lifecycle.",
    );
    if (this.policy.routeAfterCertificate === "NOTIFY_ONLY") {
      this.#state = "NOTIFIED_ONLY";
      if (this.policy.notificationChannel === "IN_APP_ONLY") {
        this.#append(
          "IN_APP_NOTIFICATION_QUEUED",
          certificateId,
          "A Studio notification is queued; no external message was sent.",
        );
      }
    } else if (this.policy.routeAfterCertificate === "REQUIRE_HUMAN_APPROVAL") {
      this.#state = "AWAITING_HUMAN_APPROVAL";
      this.#append(
        "HUMAN_APPROVAL_REQUESTED",
        certificateId,
        "An operator decision is required before shadow execution.",
      );
    } else {
      this.#state = "SHADOW_READY";
      this.#append(
        "AUTO_SHADOW_QUEUED",
        certificateId,
        "Policy permits automatic shadow execution only.",
      );
    }
    return this.projection();
  }

  public recordHumanDecision(
    decision: "APPROVE_SHADOW" | "REJECT",
  ): OpportunityLifecycleProjection {
    this.#expect("AWAITING_HUMAN_APPROVAL");
    if (decision === "APPROVE_SHADOW") {
      this.#state = "SHADOW_READY";
      this.#append(
        "HUMAN_APPROVED_SHADOW",
        this.#certificateId,
        "Operator approved shadow execution; live execution remains unavailable.",
      );
    } else {
      this.#state = "REJECTED_BY_OPERATOR";
      this.#append(
        "HUMAN_REJECTED",
        this.#certificateId,
        "Operator rejected further lifecycle progression.",
      );
    }
    return this.projection();
  }

  public beginShadowExecution(): OpportunityLifecycleProjection {
    this.#expect("SHADOW_READY");
    this.#state = "SHADOW_RUNNING";
    this.#append(
      "SHADOW_STARTED",
      this.#certificateId,
      "Certificate-bound shadow execution started without an order gateway.",
    );
    return this.projection();
  }

  public completeShadowExecution(
    executionArtifactHash: Hash,
  ): OpportunityLifecycleProjection {
    this.#expect("SHADOW_RUNNING");
    this.#shadowExecutionArtifactHash = checkedHash(
      executionArtifactHash,
      "shadow execution artifact",
    );
    this.#state = "SHADOW_COMPLETE";
    this.#append(
      "SHADOW_COMPLETED",
      executionArtifactHash,
      "Shadow execution completed and remains non-value-moving evidence.",
    );
    return this.projection();
  }

  public archive(): OpportunityLifecycleProjection {
    if (this.#state === "SHADOW_RUNNING") {
      throw new Error("cannot archive a running shadow execution");
    }
    this.#state = "ARCHIVED";
    this.#append("ARCHIVED", null, "Opportunity lifecycle archived.");
    return this.projection();
  }

  public projection(): OpportunityLifecycleProjection {
    return Object.freeze({
      schemaVersion: "pmh.opportunity-lifecycle.v1",
      opportunityId: this.opportunityId,
      discoveryKind: this.discoveryKind,
      state: this.#state,
      policy: this.policy,
      discoveryArtifactHash: this.discoveryArtifactHash,
      semanticReviewArtifactHash: this.#semanticReviewArtifactHash,
      simulationBundleHash: this.#simulationBundleHash,
      certificateId: this.#certificateId,
      shadowExecutionArtifactHash: this.#shadowExecutionArtifactHash,
      nextAction: nextActionFor(this.#state),
      events: Object.freeze([...this.#events]),
      effects: Object.freeze({
        externalMessagesSent: false as const,
        productionApprovalAccepted: false as const,
        liveOrdersPlaced: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
  }

  #expect(expected: OpportunityLifecycleState): void {
    if (this.#state !== expected) {
      throw new Error(`opportunity lifecycle expected ${expected}, received ${this.#state}`);
    }
  }

  #append(
    kind: OpportunityLifecycleEvent["kind"],
    artifactHash: Hash | null,
    detail: string,
  ): void {
    const sequence = this.#events.length + 1;
    const body = Object.freeze({
      sequence,
      occurredAt: iso(this.now()),
      kind,
      artifactHash,
      detail,
    });
    this.#events.push(
      Object.freeze({
        ...body,
        eventId: hashCanonical({ opportunityId: this.opportunityId, ...body }),
      }),
    );
  }
}
