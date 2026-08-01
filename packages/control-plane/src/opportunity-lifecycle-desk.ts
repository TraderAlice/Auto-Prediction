import type { RealCandidateDispositionEvidence } from "@pmh/evidence";
import {
  assertOpportunityLifecycleProjection,
  OpportunityLifecycleMachine,
  type OpportunityLifecyclePolicy,
  type OpportunityLifecycleProjection,
  type OpportunityLifecycleState,
} from "@pmh/execution";
import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketArchaeologistProjection } from "./market-archaeologist.js";
import {
  assertSemanticReviewRecord,
  type SemanticReviewRecord,
  type SemanticReviewRecommendation,
} from "./semantic-review.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

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
  storage: OperationalStorageProjection<"opportunityId">;
  stateCounts: readonly Readonly<{
    state: OpportunityLifecycleState;
    count: number;
  }>[];
  cases: readonly OpportunityLifecycleProjection[];
  semanticDecisions: readonly ResearchSemanticDecision[];
  effects: Readonly<{
    externalMessagesSent: false;
    liveOrdersPlaced: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ResearchSemanticDecision = Readonly<{
  schemaVersion: "pmh.research-semantic-decision.v1";
  decisionId: Hash;
  opportunityId: string;
  semanticReviewArtifactHash: Hash;
  reviewRecommendation: SemanticReviewRecommendation;
  decision: "ACCEPT_FOR_SIMULATION" | "REJECT";
  rationale: string;
  decidedAt: string;
  authority: "LOCAL_OPERATOR_RESEARCH_ONLY";
  productionReviewAuthority: false;
  productionPromotionEligible: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type OpportunityLifecycleJournal = Readonly<{
  schemaVersion: "pmh.opportunity-lifecycle-journal.v1";
  artifactHash: Hash;
  opportunityId: string;
  updatedAt: string;
  lifecycle: OpportunityLifecycleProjection;
  semanticDecisions: readonly ResearchSemanticDecision[];
}>;

export interface OpportunityLifecycleJournalStore {
  readonly opportunityLifecycleStorage: OperationalStorageProjection<"opportunityId">;
  loadOpportunityLifecycleJournals(
    limit: number,
  ): readonly OpportunityLifecycleJournal[];
  saveOpportunityLifecycleJournal(
    journal: OpportunityLifecycleJournal,
    retentionLimit: number,
  ): OpportunityLifecycleJournal;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function assertResearchSemanticDecision(
  value: unknown,
): ResearchSemanticDecision {
  if (value === null || typeof value !== "object") {
    throw new Error("research semantic decision is malformed");
  }
  const decision = value as ResearchSemanticDecision;
  const { decisionId, ...body } = decision;
  if (
    decision.schemaVersion !== "pmh.research-semantic-decision.v1" ||
    !HASH_PATTERN.test(decisionId) ||
    decisionId !== hashCanonical(body) ||
    decision.opportunityId.trim() === "" ||
    !HASH_PATTERN.test(decision.semanticReviewArtifactHash) ||
    !["REJECT", "ESCALATE", "ACCEPT_FOR_RESEARCH_SIMULATION"].includes(
      decision.reviewRecommendation,
    ) ||
    !["ACCEPT_FOR_SIMULATION", "REJECT"].includes(decision.decision) ||
    decision.rationale.trim() === "" ||
    decision.rationale.length > 2_000 ||
    !isIsoDate(decision.decidedAt) ||
    decision.authority !== "LOCAL_OPERATOR_RESEARCH_ONLY" ||
    decision.productionReviewAuthority !== false ||
    decision.productionPromotionEligible !== false ||
    decision.executionAuthority !== false ||
    decision.effects.externalWrites !== false ||
    decision.effects.valueMovingActions !== false ||
    decision.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("research semantic decision violates its contract");
  }
  return decision;
}

export function assertOpportunityLifecycleJournal(
  value: unknown,
): OpportunityLifecycleJournal {
  if (value === null || typeof value !== "object") {
    throw new Error("opportunity lifecycle journal is malformed");
  }
  const journal = value as OpportunityLifecycleJournal;
  const lifecycle = assertOpportunityLifecycleProjection(journal.lifecycle);
  if (
    journal.schemaVersion !== "pmh.opportunity-lifecycle-journal.v1" ||
    !HASH_PATTERN.test(journal.artifactHash) ||
    journal.opportunityId !== lifecycle.opportunityId ||
    !isIsoDate(journal.updatedAt) ||
    journal.updatedAt !== lifecycle.events.at(-1)?.occurredAt ||
    !Array.isArray(journal.semanticDecisions) ||
    journal.semanticDecisions.length > 10 ||
    new Set(journal.semanticDecisions.map((item) => item.decisionId)).size !==
      journal.semanticDecisions.length
  ) {
    throw new Error("opportunity lifecycle journal violates its contract");
  }
  for (const decision of journal.semanticDecisions) {
    assertResearchSemanticDecision(decision);
    if (
      decision.opportunityId !== journal.opportunityId ||
      !lifecycle.events.some(
        (event) =>
          event.artifactHash === decision.decisionId &&
          (event.kind === "SEMANTIC_REVIEW_ACCEPTED" ||
            event.kind === "SEMANTIC_REVIEW_REJECTED"),
      )
    ) {
      throw new Error("lifecycle journal does not bind its semantic decision");
    }
  }
  const { artifactHash, ...body } = journal;
  if (artifactHash !== hashCanonical(body)) {
    throw new Error("opportunity lifecycle journal identity mismatch");
  }
  return journal;
}

type LifecycleEntry = {
  machine: OpportunityLifecycleMachine;
  decisions: ResearchSemanticDecision[];
};

export class OpportunityLifecycleDesk {
  readonly #entries = new Map<string, LifecycleEntry>();

  public constructor(
    private readonly defaultPolicy: OpportunityLifecyclePolicy = DEFAULT_POLICY,
    private readonly store?: OpportunityLifecycleJournalStore,
    private readonly retentionLimit = 250,
    private readonly now: () => number = Date.now,
  ) {
    if (
      defaultPolicy.liveExecutionEnabled !== false ||
      !Number.isSafeInteger(retentionLimit) ||
      retentionLimit < 1
    ) {
      throw new Error("lifecycle desk cannot enable live execution");
    }
    for (const journal of store?.loadOpportunityLifecycleJournals(
      retentionLimit,
    ) ?? []) {
      const validated = assertOpportunityLifecycleJournal(journal);
      this.#entries.set(validated.opportunityId, {
        machine: OpportunityLifecycleMachine.restore(
          validated.lifecycle,
          this.now,
        ),
        decisions: [...validated.semanticDecisions],
      });
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
        if (this.#entries.has(opportunityId)) continue;
        let discoveryEvent = true;
        const entry = {
          machine: new OpportunityLifecycleMachine(
            opportunityId,
            "AI_RELATION_PROPOSAL",
            proposal.proposalId,
            this.defaultPolicy,
            () => {
              if (discoveryEvent) {
                discoveryEvent = false;
                return occurredAt;
              }
              return this.now();
            },
          ),
          decisions: [],
        };
        this.#entries.set(opportunityId, entry);
        this.#persist(entry);
      }
    }
  }

  public syncRealCandidate(
    disposition: RealCandidateDispositionEvidence | null,
  ): void {
    if (disposition === null) return;
    const opportunityId = `deterministic:${disposition.claimIdentity}:${disposition.depthArtifactHash}`;
    if (this.#entries.has(opportunityId)) return;
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
    const entry = { machine, decisions: [] };
    this.#entries.set(opportunityId, entry);
    this.#persist(entry);
  }

  public recordResearchSemanticDecision(
    opportunityId: string,
    semanticReview: SemanticReviewRecord,
    decision: "ACCEPT_FOR_SIMULATION" | "REJECT",
    rationale: string,
  ): ResearchSemanticDecision {
    const review = assertSemanticReviewRecord(semanticReview);
    const entry = this.#entries.get(opportunityId);
    if (
      entry === undefined ||
      review.status !== "PASS" ||
      review.report === null ||
      review.opportunityId !== opportunityId ||
      entry.machine.projection().state !== "AWAITING_SEMANTIC_REVIEW" ||
      entry.decisions.length > 0 ||
      rationale.trim() === "" ||
      rationale.length > 2_000
    ) {
      throw new Error("research semantic decision input is invalid or stale");
    }
    const body = Object.freeze({
      schemaVersion: "pmh.research-semantic-decision.v1" as const,
      opportunityId,
      semanticReviewArtifactHash: review.report.artifactHash,
      reviewRecommendation: review.report.result.recommendation,
      decision,
      rationale: rationale.trim(),
      decidedAt: new Date(this.now()).toISOString(),
      authority: "LOCAL_OPERATOR_RESEARCH_ONLY" as const,
      productionReviewAuthority: false as const,
      productionPromotionEligible: false as const,
      executionAuthority: false as const,
      effects: Object.freeze({
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
    const retained = Object.freeze({
      ...body,
      decisionId: hashCanonical(body),
    });
    entry.machine.recordSemanticReview(
      retained.decisionId,
      decision === "ACCEPT_FOR_SIMULATION" ? "ACCEPT" : "REJECT",
    );
    entry.decisions.push(retained);
    this.#persist(entry);
    return retained;
  }

  public recordShadowDecision(
    opportunityId: string,
    decision: "APPROVE_SHADOW" | "REJECT",
  ): OpportunityLifecycleProjection {
    const entry = this.#entries.get(opportunityId);
    if (entry === undefined) {
      throw new Error("unknown opportunity lifecycle");
    }
    const projection = entry.machine.recordHumanDecision(decision);
    this.#persist(entry);
    return projection;
  }

  #journal(entry: LifecycleEntry): OpportunityLifecycleJournal {
    const lifecycle = entry.machine.projection();
    const body = Object.freeze({
      schemaVersion: "pmh.opportunity-lifecycle-journal.v1" as const,
      opportunityId: lifecycle.opportunityId,
      updatedAt: lifecycle.events.at(-1)!.occurredAt,
      lifecycle,
      semanticDecisions: Object.freeze([...entry.decisions]),
    });
    return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
  }

  #persist(entry: LifecycleEntry): void {
    if (this.store === undefined) return;
    const saved = this.store.saveOpportunityLifecycleJournal(
      this.#journal(entry),
      this.retentionLimit,
    );
    assertOpportunityLifecycleJournal(saved);
  }

  public projection(): OpportunityLifecycleDeskProjection {
    const cases = Object.freeze(
      [...this.#entries.values()]
        .map((entry) => entry.machine.projection())
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
      storage:
        this.store?.opportunityLifecycleStorage ??
        Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "opportunityId" as const,
        }),
      stateCounts: Object.freeze(
        [...counts.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([state, count]) => Object.freeze({ state, count })),
      ),
      cases,
      semanticDecisions: Object.freeze(
        [...this.#entries.values()]
          .flatMap((entry) => entry.decisions)
          .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt)),
      ),
      effects: Object.freeze({
        externalMessagesSent: false as const,
        liveOrdersPlaced: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
  }
}
