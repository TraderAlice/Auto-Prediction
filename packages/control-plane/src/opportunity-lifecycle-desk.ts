import type { RealCandidateDispositionEvidence } from "@pmh/evidence";
import {
  assertOpportunityLifecycleProjection,
  assertOpportunitySimulationBundle,
  assertCertificateBoundShadowRun,
  assertCertificateBoundShadowMarketObservation,
  observeCertificateBoundShadowMarket,
  OpportunityLifecycleMachine,
  runCertificateBoundShadow,
  type CertificateBoundShadowRun,
  type CertificateBoundShadowMarketObservation,
  type OpportunitySimulationBundle,
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
import {
  assertExactOpportunityVerificationRecord,
  type ExactOpportunityVerificationRecord,
} from "./exact-promotion.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const DEFAULT_POLICY: OpportunityLifecyclePolicy = Object.freeze({
  routeAfterCertificate: "REQUIRE_HUMAN_APPROVAL",
  notificationChannel: "IN_APP_ONLY",
  liveExecutionEnabled: false,
});

export type OpportunitySimulationSummary = Readonly<{
  artifactHash: Hash;
  opportunityId: string;
  relationConstraintHash: Hash;
  semanticDecisionId: Hash;
  portfolioId: Hash;
  status: OpportunitySimulationBundle["status"];
  reportCount: number;
  models: readonly OpportunitySimulationBundle["reports"][number]["model"][];
  minimumPayoutCollateral: string;
  simulatedCostCollateral: string;
  floorAfterSimulatedFees: string;
  authority: "SIMULATION_ONLY";
  verifierEligible: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

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
  simulationBundles: readonly OpportunitySimulationSummary[];
  exactVerifications: readonly Readonly<{
    artifactHash: Hash;
    opportunityId: string;
    simulationBundleHash: Hash;
    status: "CERTIFIED" | "REJECTED";
    certificateId: Hash | null;
    worstCaseAfterFees: string | null;
    expiresAtEpochMs: string | null;
    diagnostic: string | null;
    authority: "FIRST_PARTY_EXACT_VERIFIER";
    executionAuthority: false;
  }>[];
  shadowRuns: readonly Readonly<{
    artifactHash: Hash;
    opportunityId: string;
    certificateId: Hash;
    simulationBundleHash: Hash;
    status: "LOCKED";
    plannedIntentCount: number;
    filledIntentCount: number;
    gatewayCalls: 0;
    authority: "SHADOW_REPLAY_ONLY";
    executionAuthority: false;
  }>[];
  shadowObservations: readonly Readonly<{
    artifactHash: Hash;
    opportunityId: string;
    baselineShadowArtifactHash: Hash;
    sourceMaterializationId: Hash;
    observedSimulationBundleHash: Hash;
    observedAtEpochMs: string;
    status: "MATCHED_BOUNDS" | "DIVERGED";
    reasons: readonly string[];
    changedStateCount: number;
    gatewayCalls: 0;
    actualOrderObserved: false;
    authority: "FIRST_PARTY_SHADOW_OBSERVER";
    executionAuthority: false;
  }>[];
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
  simulationBundles?: readonly OpportunitySimulationBundle[];
  exactVerifications?: readonly ExactOpportunityVerificationRecord[];
  shadowRuns?: readonly CertificateBoundShadowRun[];
  shadowObservations?: readonly CertificateBoundShadowMarketObservation[];
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
  const simulationBundles = journal.simulationBundles ?? [];
  if (
    !Array.isArray(simulationBundles) ||
    simulationBundles.length > 20 ||
    new Set(simulationBundles.map((item) => item.artifactHash)).size !==
      simulationBundles.length
  ) {
    throw new Error("lifecycle journal simulation history is malformed");
  }
  for (const bundle of simulationBundles) {
    assertOpportunitySimulationBundle(bundle);
    if (
      bundle.opportunityId !== journal.opportunityId ||
      !lifecycle.events.some(
        (event) =>
          event.artifactHash === bundle.artifactHash &&
          [
            "SIMULATION_ACCEPTED",
            "SIMULATION_REJECTED",
            "MODEL_CALIBRATION_REQUIRED",
          ].includes(event.kind),
      )
    ) {
      throw new Error("lifecycle journal does not bind its simulation bundle");
    }
  }
  const exactVerifications = journal.exactVerifications ?? [];
  if (
    !Array.isArray(exactVerifications) ||
    exactVerifications.length > 20 ||
    new Set(exactVerifications.map((item) => item.artifactHash)).size !==
      exactVerifications.length
  ) {
    throw new Error("lifecycle journal exact-verification history is malformed");
  }
  for (const exact of exactVerifications) {
    assertExactOpportunityVerificationRecord(exact);
    const certificateId = exact.certificate?.id ?? null;
    if (
      exact.opportunityId !== journal.opportunityId ||
      !simulationBundles.some(
        (bundle) => bundle.artifactHash === exact.simulationBundleHash,
      ) ||
      (exact.status === "CERTIFIED"
        ? certificateId === null ||
          certificateId !== lifecycle.certificateId ||
          !lifecycle.events.some(
            (event) =>
              event.kind === "CERTIFICATE_BOUND" &&
              event.artifactHash === certificateId,
          )
        : !lifecycle.events.some(
            (event) =>
              event.kind === "EXACT_VERIFICATION_REJECTED" &&
              event.artifactHash === exact.artifactHash,
          ))
    ) {
      throw new Error("lifecycle journal does not bind exact verification");
    }
  }
  const shadowRuns = journal.shadowRuns ?? [];
  if (
    !Array.isArray(shadowRuns) ||
    shadowRuns.length > 20 ||
    new Set(shadowRuns.map((item) => item.artifactHash)).size !==
      shadowRuns.length
  ) {
    throw new Error("lifecycle journal shadow history is malformed");
  }
  for (const shadow of shadowRuns) {
    assertCertificateBoundShadowRun(shadow);
    if (
      shadow.opportunityId !== journal.opportunityId ||
      !exactVerifications.some(
        (exact) => exact.certificate?.id === shadow.certificateId,
      ) ||
      !simulationBundles.some(
        (bundle) => bundle.artifactHash === shadow.simulationBundleHash,
      ) ||
      !lifecycle.events.some(
        (event) =>
          event.kind === "SHADOW_COMPLETED" &&
          event.artifactHash === shadow.artifactHash,
      )
    ) {
      throw new Error("lifecycle journal does not bind its shadow run");
    }
  }
  const shadowObservations = journal.shadowObservations ?? [];
  if (
    !Array.isArray(shadowObservations) ||
    shadowObservations.length > 100 ||
    new Set(shadowObservations.map((item) => item.artifactHash)).size !==
      shadowObservations.length
  ) {
    throw new Error("lifecycle journal shadow observation history is malformed");
  }
  for (const observation of shadowObservations) {
    assertCertificateBoundShadowMarketObservation(observation);
    const baselineShadow = shadowRuns.find(
      (shadow) => shadow.artifactHash === observation.baselineShadowArtifactHash,
    );
    const baselineBundle = simulationBundles.find(
      (bundle) =>
        bundle.artifactHash === observation.baselineSimulationBundleHash,
    );
    if (
      observation.opportunityId !== journal.opportunityId ||
      baselineShadow === undefined ||
      baselineBundle === undefined ||
      baselineShadow.certificateId !== observation.certificateId ||
      observeCertificateBoundShadowMarket({
        baselineShadow,
        baselineSimulationBundle: baselineBundle,
        observedSimulationBundle: observation.observedSimulationBundle,
        sourceMaterializationId: observation.sourceMaterializationId,
      }).artifactHash !== observation.artifactHash
    ) {
      throw new Error("lifecycle journal does not bind its shadow observation");
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
  simulationBundles: OpportunitySimulationBundle[];
  exactVerifications: ExactOpportunityVerificationRecord[];
  shadowRuns: CertificateBoundShadowRun[];
  shadowObservations: CertificateBoundShadowMarketObservation[];
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
        simulationBundles: [...(validated.simulationBundles ?? [])],
        exactVerifications: [...(validated.exactVerifications ?? [])],
        shadowRuns: [...(validated.shadowRuns ?? [])],
        shadowObservations: [...(validated.shadowObservations ?? [])],
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
          simulationBundles: [],
          exactVerifications: [],
          shadowRuns: [],
          shadowObservations: [],
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
    const entry = {
      machine,
      decisions: [],
      simulationBundles: [],
      exactVerifications: [],
      shadowRuns: [],
      shadowObservations: [],
    };
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
    const run =
      decision === "APPROVE_SHADOW" ? this.#createShadowRun(entry) : null;
    entry.machine.recordHumanDecision(decision);
    if (run !== null) {
      entry.machine.beginShadowExecution();
      entry.machine.completeShadowExecution(run.artifactHash);
      entry.shadowRuns.push(run);
    }
    this.#persist(entry);
    return entry.machine.projection();
  }

  public recordShadowMarketObservation(
    opportunityId: string,
    observedSimulationBundle: OpportunitySimulationBundle,
    sourceMaterializationId: Hash,
  ): CertificateBoundShadowMarketObservation {
    const entry = this.#entries.get(opportunityId);
    const baselineShadow = entry?.shadowRuns.at(-1);
    const baselineBundle = entry?.simulationBundles.find(
      (bundle) => bundle.artifactHash === baselineShadow?.simulationBundleHash,
    );
    if (
      entry === undefined ||
      entry.machine.projection().state !== "SHADOW_COMPLETE" ||
      baselineShadow === undefined ||
      baselineBundle === undefined ||
      observedSimulationBundle.opportunityId !== opportunityId
    ) {
      throw new Error("shadow market observation requires a completed bound shadow");
    }
    const observation = observeCertificateBoundShadowMarket({
      baselineShadow,
      baselineSimulationBundle: baselineBundle,
      observedSimulationBundle,
      sourceMaterializationId,
    });
    if (
      entry.shadowObservations.some(
        (item) => item.artifactHash === observation.artifactHash,
      )
    ) {
      return observation;
    }
    entry.shadowObservations.push(observation);
    this.#persist(entry);
    return observation;
  }

  public recordOpportunitySimulation(
    opportunityId: string,
    bundleValue: OpportunitySimulationBundle,
  ): OpportunityLifecycleProjection {
    const entry = this.#entries.get(opportunityId);
    const bundle = assertOpportunitySimulationBundle(bundleValue);
    if (
      entry === undefined ||
      bundle.opportunityId !== opportunityId ||
      entry.simulationBundles.length > 0
    ) {
      throw new Error("opportunity simulation input is invalid or stale");
    }
    const projection = entry.machine.recordOpportunitySimulation(bundle);
    entry.simulationBundles.push(bundle);
    this.#persist(entry);
    return projection;
  }

  public recordExactVerification(
    opportunityId: string,
    recordValue: ExactOpportunityVerificationRecord,
  ): OpportunityLifecycleProjection {
    const entry = this.#entries.get(opportunityId);
    const record = assertExactOpportunityVerificationRecord(recordValue);
    if (
      entry === undefined ||
      record.opportunityId !== opportunityId ||
      entry.exactVerifications.length > 0 ||
      !entry.simulationBundles.some(
        (bundle) => bundle.artifactHash === record.simulationBundleHash,
      )
    ) {
      throw new Error("exact verification input is invalid or stale");
    }
    const autoShadowRun =
      record.status === "CERTIFIED" &&
      entry.machine.projection().policy.routeAfterCertificate === "AUTO_SHADOW"
        ? this.#createShadowRun(entry, record)
        : null;
    if (record.status === "CERTIFIED") {
      entry.machine.bindExactCertificate(record.certificate!);
    } else {
      entry.machine.recordExactVerificationRejection(
        record.artifactHash,
        record.diagnostic!,
      );
    }
    entry.exactVerifications.push(record);
    if (autoShadowRun !== null) {
      entry.machine.beginShadowExecution();
      entry.machine.completeShadowExecution(autoShadowRun.artifactHash);
      entry.shadowRuns.push(autoShadowRun);
    }
    this.#persist(entry);
    return entry.machine.projection();
  }

  #createShadowRun(
    entry: LifecycleEntry,
    pendingExact?: ExactOpportunityVerificationRecord,
  ): CertificateBoundShadowRun {
    const exact = pendingExact ?? entry.exactVerifications.at(-1);
    const certificate = exact?.certificate;
    const bundle = entry.simulationBundles.find(
      (item) => item.artifactHash === exact?.simulationBundleHash,
    );
    if (
      certificate === null ||
      certificate === undefined ||
      bundle === undefined ||
      entry.shadowRuns.length > 0
    ) {
      throw new Error("shadow route has no unique certificate-bound simulation");
    }
    return runCertificateBoundShadow({
      opportunityId: entry.machine.opportunityId,
      certificate,
      simulationBundle: bundle,
      nowEpochMs: BigInt(this.now()),
    });
  }

  #journal(entry: LifecycleEntry): OpportunityLifecycleJournal {
    const lifecycle = entry.machine.projection();
    const body = Object.freeze({
      schemaVersion: "pmh.opportunity-lifecycle-journal.v1" as const,
      opportunityId: lifecycle.opportunityId,
      updatedAt: lifecycle.events.at(-1)!.occurredAt,
      lifecycle,
      semanticDecisions: Object.freeze([...entry.decisions]),
      simulationBundles: Object.freeze([...entry.simulationBundles]),
      exactVerifications: Object.freeze([...entry.exactVerifications]),
      shadowRuns: Object.freeze([...entry.shadowRuns]),
      shadowObservations: Object.freeze([...entry.shadowObservations]),
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
      simulationBundles: Object.freeze(
        [...this.#entries.values()]
          .flatMap((entry) => entry.simulationBundles)
          .sort((left, right) =>
            left.opportunityId.localeCompare(right.opportunityId),
          )
          .map((bundle) =>
            Object.freeze({
              artifactHash: bundle.artifactHash,
              opportunityId: bundle.opportunityId,
              relationConstraintHash: bundle.relationConstraintHash,
              semanticDecisionId: bundle.semanticDecisionId,
              portfolioId: bundle.portfolioId,
              status: bundle.status,
              reportCount: bundle.reports.length,
              models: Object.freeze(bundle.reports.map((report) => report.model)),
              minimumPayoutCollateral:
                bundle.minimumPayoutCollateral.toString(),
              simulatedCostCollateral:
                bundle.simulatedCostCollateral.toString(),
              floorAfterSimulatedFees:
                bundle.floorAfterSimulatedFees.toString(),
              authority: "SIMULATION_ONLY" as const,
              verifierEligible: false as const,
              certificateAuthority: false as const,
              executionAuthority: false as const,
            }),
          ),
      ),
      exactVerifications: Object.freeze(
        [...this.#entries.values()]
          .flatMap((entry) => entry.exactVerifications)
          .sort((left, right) =>
            left.opportunityId.localeCompare(right.opportunityId),
          )
          .map((record) =>
            Object.freeze({
              artifactHash: record.artifactHash,
              opportunityId: record.opportunityId,
              simulationBundleHash: record.simulationBundleHash,
              status: record.status,
              certificateId: record.certificate?.id ?? null,
              worstCaseAfterFees:
                record.certificate?.worstCaseAfterFees.toString() ?? null,
              expiresAtEpochMs:
                record.certificate?.expiresAtEpochMs.toString() ?? null,
              diagnostic: record.diagnostic,
              authority: "FIRST_PARTY_EXACT_VERIFIER" as const,
              executionAuthority: false as const,
            }),
          ),
      ),
      shadowRuns: Object.freeze(
        [...this.#entries.values()]
          .flatMap((entry) => entry.shadowRuns)
          .sort((left, right) =>
            left.opportunityId.localeCompare(right.opportunityId),
          )
          .map((run) =>
            Object.freeze({
              artifactHash: run.artifactHash,
              opportunityId: run.opportunityId,
              certificateId: run.certificateId,
              simulationBundleHash: run.simulationBundleHash,
              status: run.status,
              plannedIntentCount: run.executionPlan.intents.length,
              filledIntentCount: run.observations.filter(
                (item) => item.status === "FILLED",
              ).length,
              gatewayCalls: 0 as const,
              authority: "SHADOW_REPLAY_ONLY" as const,
              executionAuthority: false as const,
            }),
          ),
      ),
      shadowObservations: Object.freeze(
        [...this.#entries.values()]
          .flatMap((entry) => entry.shadowObservations)
          .sort((left, right) =>
            left.observedAtEpochMs === right.observedAtEpochMs
              ? left.artifactHash.localeCompare(right.artifactHash)
              : left.observedAtEpochMs > right.observedAtEpochMs ? -1 : 1,
          )
          .map((observation) => Object.freeze({
            artifactHash: observation.artifactHash,
            opportunityId: observation.opportunityId,
            baselineShadowArtifactHash:
              observation.baselineShadowArtifactHash,
            sourceMaterializationId: observation.sourceMaterializationId,
            observedSimulationBundleHash:
              observation.observedSimulationBundle.artifactHash,
            observedAtEpochMs: observation.observedAtEpochMs.toString(),
            status: observation.status,
            reasons: observation.reasons,
            changedStateCount: observation.legs.filter(
              (leg) => leg.inputStateChanged || leg.feeScheduleChanged,
            ).length,
            gatewayCalls: 0 as const,
            actualOrderObserved: false as const,
            authority: "FIRST_PARTY_SHADOW_OBSERVER" as const,
            executionAuthority: false as const,
          })),
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
