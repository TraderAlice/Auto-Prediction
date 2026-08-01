import type { RealCandidateDispositionEvidence } from "@pmh/evidence";
import {
  OpportunityLifecycleMachine,
  type OpportunityLifecyclePolicy,
  type OpportunityLifecycleProjection,
  type OpportunityLifecycleState,
} from "@pmh/execution";
import type { MarketArchaeologistProjection } from "./market-archaeologist.js";

const DEFAULT_POLICY: OpportunityLifecyclePolicy = Object.freeze({
  routeAfterCertificate: "REQUIRE_HUMAN_APPROVAL",
  notificationChannel: "IN_APP_ONLY",
  liveExecutionEnabled: false,
});

export type OpportunityLifecycleDeskProjection = Readonly<{
  schemaVersion: "pmh.opportunity-lifecycle-desk.v1";
  defaultPolicy: OpportunityLifecyclePolicy;
  routes: readonly Readonly<{
    policy: "NOTIFY_ONLY" | "REQUIRE_HUMAN_APPROVAL" | "AUTO_SHADOW";
    terminalAuthority: "NOTIFY" | "SHADOW_EXECUTION";
    humanDecisionRequired: boolean;
    liveExecutionAvailable: false;
  }>[];
  exchangeModels: readonly Readonly<{
    model: "CLOB_TAKER_V1" | "CONSTANT_PRODUCT_AMM_V1";
    qualification:
      | "BOOK_EXACT_TAKER_WALK"
      | "GENERIC_REQUIRES_VENUE_CALIBRATION";
    arithmetic: "BIGINT_FIXED_POINT";
    certificateAuthority: false;
  }>[];
  caseCount: number;
  stateCounts: readonly Readonly<{
    state: OpportunityLifecycleState;
    count: number;
  }>[];
  cases: readonly OpportunityLifecycleProjection[];
  effects: Readonly<{
    externalMessagesSent: false;
    liveOrdersPlaced: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export class OpportunityLifecycleDesk {
  readonly #machines = new Map<string, OpportunityLifecycleMachine>();

  public constructor(
    private readonly defaultPolicy: OpportunityLifecyclePolicy = DEFAULT_POLICY,
  ) {
    if (defaultPolicy.liveExecutionEnabled !== false) {
      throw new Error("lifecycle desk cannot enable live execution");
    }
  }

  public syncMarketArchaeologist(
    archaeologist: MarketArchaeologistProjection,
  ): void {
    for (const record of archaeologist.records) {
      if (record.status !== "PASS" || record.report === null) continue;
      const occurredAt = Date.parse(record.report.completedAt);
      for (const proposal of record.report.result.proposals) {
        const opportunityId = `ai:${proposal.proposalId}`;
        if (this.#machines.has(opportunityId)) continue;
        this.#machines.set(
          opportunityId,
          new OpportunityLifecycleMachine(
            opportunityId,
            "AI_RELATION_PROPOSAL",
            proposal.proposalId,
            this.defaultPolicy,
            () => occurredAt,
          ),
        );
      }
    }
  }

  public syncRealCandidate(
    disposition: RealCandidateDispositionEvidence | null,
  ): void {
    if (disposition === null) return;
    const opportunityId = `deterministic:${disposition.claimIdentity}:${disposition.depthArtifactHash}`;
    if (this.#machines.has(opportunityId)) return;
    const machine = new OpportunityLifecycleMachine(
      opportunityId,
      "DETERMINISTIC_SEARCH_LEAD",
      disposition.depthArtifactHash,
      this.defaultPolicy,
      () => 0,
    );
    machine.recordPreflightRejection(
      disposition.artifactHash,
      disposition.rejectionReasons.map((reason) => reason.detail).join(" "),
    );
    this.#machines.set(opportunityId, machine);
  }

  public projection(): OpportunityLifecycleDeskProjection {
    const cases = Object.freeze(
      [...this.#machines.values()]
        .map((machine) => machine.projection())
        .sort((left, right) => left.opportunityId.localeCompare(right.opportunityId)),
    );
    const counts = new Map<OpportunityLifecycleState, number>();
    for (const item of cases) {
      counts.set(item.state, (counts.get(item.state) ?? 0) + 1);
    }
    return Object.freeze({
      schemaVersion: "pmh.opportunity-lifecycle-desk.v1",
      defaultPolicy: this.defaultPolicy,
      routes: Object.freeze([
        Object.freeze({
          policy: "NOTIFY_ONLY" as const,
          terminalAuthority: "NOTIFY" as const,
          humanDecisionRequired: false,
          liveExecutionAvailable: false as const,
        }),
        Object.freeze({
          policy: "REQUIRE_HUMAN_APPROVAL" as const,
          terminalAuthority: "SHADOW_EXECUTION" as const,
          humanDecisionRequired: true,
          liveExecutionAvailable: false as const,
        }),
        Object.freeze({
          policy: "AUTO_SHADOW" as const,
          terminalAuthority: "SHADOW_EXECUTION" as const,
          humanDecisionRequired: false,
          liveExecutionAvailable: false as const,
        }),
      ]),
      exchangeModels: Object.freeze([
        Object.freeze({
          model: "CLOB_TAKER_V1" as const,
          qualification: "BOOK_EXACT_TAKER_WALK" as const,
          arithmetic: "BIGINT_FIXED_POINT" as const,
          certificateAuthority: false as const,
        }),
        Object.freeze({
          model: "CONSTANT_PRODUCT_AMM_V1" as const,
          qualification: "GENERIC_REQUIRES_VENUE_CALIBRATION" as const,
          arithmetic: "BIGINT_FIXED_POINT" as const,
          certificateAuthority: false as const,
        }),
      ]),
      caseCount: cases.length,
      stateCounts: Object.freeze(
        [...counts.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([state, count]) => Object.freeze({ state, count })),
      ),
      cases,
      effects: Object.freeze({
        externalMessagesSent: false as const,
        liveOrdersPlaced: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
  }
}
