import { hashCanonical } from "@pmh/domain";
import type {
  DiscoveryCatalogContext,
  DiscoveryAgentEffect,
  DiscoveryAgentTrace,
  DiscoveryFalsification,
  DiscoveryDeskProjection,
  DiscoveryRun,
  DiscoveryRunRecord,
  DiscoveryTask,
  DiscoveryWorkerReport,
  OperationalStorageProjection,
  OpportunityHypothesis,
} from "./types.js";
import { assertDiscoveryTask } from "./discovery.js";
import { MODEL_FAILURE_CATEGORIES } from "./model-failure.js";

export interface DiscoveryRunStore {
  readonly storage: OperationalStorageProjection;
  load(limit: number): readonly DiscoveryRunRecord[];
  findByTaskId(taskId: string): DiscoveryRunRecord | undefined;
  save(record: DiscoveryRunRecord, retentionLimit: number): DiscoveryRunRecord;
  close(): void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

const AGENT_TOOL_NAMES = Object.freeze([
  "search_catalog",
  "inspect_listings",
  "record_hypothesis",
  "record_falsification",
  "complete_search",
  "unknown_tool",
] as const);
const AGENT_EFFECT_STATUSES = Object.freeze([
  "ACCEPTED",
  "REJECTED",
  "IDEMPOTENT_REPLAY",
] as const);
const AGENT_EFFECT_REASONS = Object.freeze([
  "CATALOG_RESULTS",
  "LISTINGS_INSPECTED",
  "HYPOTHESIS_RECORDED",
  "FALSIFICATION_RECORDED",
  "SEARCH_COMPLETED",
  "INVALID_INPUT",
  "INPUT_TOO_LARGE",
  "OUT_OF_SCOPE",
  "UNKNOWN_LISTING",
  "INSPECTION_REQUIRED",
  "SEARCH_REQUIRED",
  "PROTOCOL_INVALID",
  "DUPLICATE",
  "PROPOSAL_LIMIT",
  "TOOL_CALL_LIMIT",
  "ALREADY_COMPLETED",
] as const);
const AGENT_TERMINATION_REASONS = Object.freeze([
  "EXPLICIT_COMPLETION",
  "PROPOSAL_LIMIT",
  "STEP_LIMIT",
  "TOOL_CALL_LIMIT",
  "MODEL_FINISHED",
  "TIMEOUT",
  "TASK_DEADLINE",
  "PROVIDER_FAILURE",
  "PROTOCOL_FAILURE",
] as const);

function freezeAgentEffect(value: unknown, ordinal: number): DiscoveryAgentEffect {
  if (value === null || typeof value !== "object") {
    throw new Error("stored discovery agent effect is malformed");
  }
  const effect = value as Record<string, unknown>;
  const successfulReason = effect.reason === "CATALOG_RESULTS" ||
    effect.reason === "LISTINGS_INSPECTED" ||
    effect.reason === "HYPOTHESIS_RECORDED" ||
    effect.reason === "FALSIFICATION_RECORDED" ||
    effect.reason === "SEARCH_COMPLETED";
  if (
    effect.ordinal !== ordinal ||
    !AGENT_TOOL_NAMES.includes(effect.toolName as never) ||
    !AGENT_EFFECT_STATUSES.includes(effect.status as never) ||
    !AGENT_EFFECT_REASONS.includes(effect.reason as never) ||
    !/^sha256:[0-9a-f]{64}$/.test(String(effect.inputIdentity)) ||
    !/^sha256:[0-9a-f]{64}$/.test(String(effect.outputIdentity)) ||
    !isStringArray(effect.listingRefs) || effect.listingRefs.length > 20 ||
    effect.listingRefs.some((item) => item.length > 512) ||
    (effect.hypothesisId !== null && !isNonEmptyString(effect.hypothesisId)) ||
    (effect.falsificationId !== undefined && effect.falsificationId !== null &&
      !/^sha256:[0-9a-f]{64}$/.test(String(effect.falsificationId))) ||
    (effect.status === "ACCEPTED") !== successfulReason ||
    (effect.status === "IDEMPOTENT_REPLAY" && effect.reason !== "DUPLICATE") ||
    (effect.status === "REJECTED" && successfulReason) ||
    (effect.hypothesisId !== null && effect.toolName !== "record_hypothesis") ||
    (effect.falsificationId !== undefined && effect.falsificationId !== null &&
      effect.toolName !== "record_falsification") ||
    (effect.toolName === "record_falsification" &&
      effect.status === "ACCEPTED" &&
      (effect.reason !== "FALSIFICATION_RECORDED" ||
        effect.falsificationId === undefined || effect.falsificationId === null))
  ) {
    throw new Error("stored discovery agent effect violates its contract");
  }
  return Object.freeze({
    ordinal,
    toolName: effect.toolName,
    status: effect.status,
    reason: effect.reason,
    inputIdentity: effect.inputIdentity,
    outputIdentity: effect.outputIdentity,
    listingRefs: Object.freeze([...effect.listingRefs]),
    hypothesisId: effect.hypothesisId,
    ...(effect.falsificationId === undefined
      ? {}
      : { falsificationId: effect.falsificationId }),
  }) as DiscoveryAgentEffect;
}

function freezeAgentTrace(value: unknown): DiscoveryAgentTrace {
  if (value === null || typeof value !== "object") {
    throw new Error("stored discovery agent trace is malformed");
  }
  const trace = value as Record<string, unknown>;
  if (!Array.isArray(trace.effects) || trace.effects.length > 64) {
    throw new Error("stored discovery agent trace has invalid effects");
  }
  const effects = Object.freeze(
    trace.effects.map((effect, index) => freezeAgentEffect(effect, index + 1)),
  );
  const acceptedCatalogReadCount = effects.filter((effect) =>
    (effect.toolName === "search_catalog" || effect.toolName === "inspect_listings") &&
    effect.status === "ACCEPTED"
  ).length;
  // v1 counted every read-tool effect, including a rejected call. v2 tightened
  // the metric to successful reads while retaining exact replay of old ledgers.
  const catalogReadCount = trace.schemaVersion === "pmh.discovery-agent-trace.v1"
    ? effects.filter((effect) =>
      effect.toolName === "search_catalog" || effect.toolName === "inspect_listings"
    ).length
    : acceptedCatalogReadCount;
  const acceptedProposalCount = effects.filter((effect) =>
    effect.toolName === "record_hypothesis" && effect.status === "ACCEPTED"
  ).length;
  const rejectedProposalCount = effects.filter((effect) =>
    effect.toolName === "record_hypothesis" && effect.status === "REJECTED"
  ).length;
  const acceptedFalsificationCount = effects.filter((effect) =>
    effect.toolName === "record_falsification" && effect.status === "ACCEPTED"
  ).length;
  const rejectedFalsificationCount = effects.filter((effect) =>
    effect.toolName === "record_falsification" && effect.status === "REJECTED"
  ).length;
  if (
    (trace.schemaVersion !== "pmh.discovery-agent-trace.v1" &&
      trace.schemaVersion !== "pmh.discovery-agent-trace.v2" &&
      trace.schemaVersion !== "pmh.discovery-agent-trace.v3") ||
    trace.protocol !== "PMH_BOUNDED_TOOL_LOOP_V1" ||
    !Number.isSafeInteger(trace.stepCount) || Number(trace.stepCount) < 0 ||
    Number(trace.stepCount) > 20 ||
    !Number.isSafeInteger(trace.providerRequestAttemptCount) ||
    Number(trace.providerRequestAttemptCount) < 0 ||
    Number(trace.providerRequestAttemptCount) > 20 ||
    !Number.isSafeInteger(trace.toolCallCount) || Number(trace.toolCallCount) < 0 ||
    Number(trace.toolCallCount) > 64 || Number(trace.toolCallCount) < effects.length ||
    trace.catalogReadCount !== catalogReadCount ||
    trace.acceptedProposalCount !== acceptedProposalCount ||
    trace.rejectedProposalCount !== rejectedProposalCount ||
    (trace.schemaVersion === "pmh.discovery-agent-trace.v3" &&
      (trace.acceptedFalsificationCount !== acceptedFalsificationCount ||
        trace.rejectedFalsificationCount !== rejectedFalsificationCount)) ||
    (trace.schemaVersion !== "pmh.discovery-agent-trace.v3" &&
      (acceptedFalsificationCount !== 0 ||
        trace.acceptedFalsificationCount !== undefined ||
        trace.rejectedFalsificationCount !== undefined)) ||
    !AGENT_TERMINATION_REASONS.includes(trace.terminationReason as never) ||
    trace.semanticDecisionAuthority !== false ||
    trace.certificateAuthority !== false ||
    trace.executionAuthority !== false ||
    trace.externalWriteAuthority !== false ||
    trace.valueMovingAuthority !== false
  ) {
    throw new Error("stored discovery agent trace violates its contract");
  }
  return Object.freeze({
    schemaVersion: trace.schemaVersion,
    protocol: "PMH_BOUNDED_TOOL_LOOP_V1",
    stepCount: trace.stepCount,
    providerRequestAttemptCount: trace.providerRequestAttemptCount,
    toolCallCount: trace.toolCallCount,
    catalogReadCount,
    acceptedProposalCount,
    rejectedProposalCount,
    ...(trace.schemaVersion === "pmh.discovery-agent-trace.v3"
      ? { acceptedFalsificationCount, rejectedFalsificationCount }
      : {}),
    terminationReason: trace.terminationReason,
    effects,
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
  }) as DiscoveryAgentTrace;
}

function freezeWorkerReport(value: unknown): DiscoveryWorkerReport {
  if (value === null || typeof value !== "object") {
    throw new Error("stored discovery worker report is malformed");
  }
  const report = value as Record<string, unknown>;
  const telemetryAbsent = report.providerRequestAttemptCount === undefined &&
    report.providerFailureCategory === undefined;
  const falsificationTelemetryAbsent = report.falsificationCount === undefined;
  const falsificationTelemetryPresent =
    Number.isSafeInteger(report.falsificationCount) &&
    Number(report.falsificationCount) >= 0 &&
    Number(report.falsificationCount) <= 64;
  const telemetryPresent = Number.isSafeInteger(report.providerRequestAttemptCount) &&
    Number(report.providerRequestAttemptCount) >= 0 &&
    Number(report.providerRequestAttemptCount) <= 20 &&
    (report.providerFailureCategory === null ||
      MODEL_FAILURE_CATEGORIES.includes(
        report.providerFailureCategory as (typeof MODEL_FAILURE_CATEGORIES)[number],
      )) &&
    (report.kind !== "HEURISTIC" ||
      (report.providerRequestAttemptCount === 0 &&
        report.providerFailureCategory === null)) &&
    (report.status !== "PASS" || report.providerFailureCategory === null) &&
    (report.status !== "FAILED" || report.kind !== "MODEL" ||
      report.providerFailureCategory !== null);
  if (
    !isNonEmptyString(report.workerId) ||
    (report.kind !== "HEURISTIC" && report.kind !== "MODEL") ||
    (report.costTier !== "FREE" && report.costTier !== "LOW") ||
    (report.status !== "PASS" && report.status !== "FAILED") ||
    !isNonEmptyString(report.startedAt) ||
    !isNonEmptyString(report.completedAt) ||
    Number.isNaN(Date.parse(report.startedAt)) ||
    Number.isNaN(Date.parse(report.completedAt)) ||
    Date.parse(report.completedAt) < Date.parse(report.startedAt) ||
    typeof report.durationMs !== "number" ||
    !Number.isSafeInteger(report.durationMs) ||
    report.durationMs < 0 ||
    report.durationMs !==
      Date.parse(String(report.completedAt)) -
        Date.parse(String(report.startedAt)) ||
    typeof report.hypothesisCount !== "number" ||
    !Number.isSafeInteger(report.hypothesisCount) ||
    report.hypothesisCount < 0 ||
    report.hypothesisCount > 50 ||
    (report.diagnostic !== null &&
      (!isNonEmptyString(report.diagnostic) || report.diagnostic.length > 500)) ||
    (report.status === "PASS" && report.diagnostic !== null) ||
    (report.status === "FAILED" &&
      (report.diagnostic === null || report.hypothesisCount !== 0)) ||
    (!telemetryAbsent && !telemetryPresent) ||
    (!falsificationTelemetryAbsent && !falsificationTelemetryPresent)
  ) {
    throw new Error("stored discovery worker report violates its contract");
  }
  const agentTrace = report.agentTrace === undefined
    ? undefined
    : freezeAgentTrace(report.agentTrace);
  if (
    agentTrace !== undefined &&
    (report.kind !== "MODEL" || !telemetryPresent ||
      report.providerRequestAttemptCount !==
        agentTrace.providerRequestAttemptCount ||
      (report.status === "PASS" &&
        (report.hypothesisCount !== agentTrace.acceptedProposalCount ||
          (agentTrace.schemaVersion === "pmh.discovery-agent-trace.v3" &&
            report.falsificationCount !==
              agentTrace.acceptedFalsificationCount))))
  ) {
    throw new Error("stored discovery worker report does not bind its agent trace");
  }
  return Object.freeze({
    workerId: report.workerId,
    kind: report.kind,
    costTier: report.costTier,
    status: report.status,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    durationMs: report.durationMs,
    hypothesisCount: report.hypothesisCount,
    ...(falsificationTelemetryAbsent
      ? {}
      : { falsificationCount: report.falsificationCount }),
    diagnostic: report.diagnostic,
    ...(telemetryPresent
      ? {
          providerRequestAttemptCount: report.providerRequestAttemptCount,
          providerFailureCategory: report.providerFailureCategory,
        }
      : {}),
    ...(agentTrace === undefined ? {} : { agentTrace }),
  }) as DiscoveryWorkerReport;
}

function freezeFalsification(value: unknown): DiscoveryFalsification {
  if (value === null || typeof value !== "object") {
    throw new Error("stored discovery falsification is malformed");
  }
  const falsification = value as Record<string, unknown>;
  const legacyBody = {
    schemaVersion: falsification.schemaVersion,
    workerId: falsification.workerId,
    taskId: falsification.taskId,
    claim: falsification.claim,
    reason: falsification.reason,
    listingRefs: falsification.listingRefs,
    claimSearchTerms: falsification.claimSearchTerms,
    authority: falsification.authority,
    semanticDecisionAuthority: falsification.semanticDecisionAuthority,
    certificateAuthority: falsification.certificateAuthority,
    executionAuthority: falsification.executionAuthority,
    externalWriteAuthority: falsification.externalWriteAuthority,
    valueMovingAuthority: falsification.valueMovingAuthority,
  };
  const body = falsification.schemaVersion === "pmh.discovery-falsification.v2"
    ? {
        ...legacyBody,
        findingIdentity: falsification.findingIdentity,
        relationKind: falsification.relationKind,
      }
    : legacyBody;
  if (
    (falsification.schemaVersion !== "pmh.discovery-falsification.v1" &&
      falsification.schemaVersion !== "pmh.discovery-falsification.v2") ||
    !/^sha256:[0-9a-f]{64}$/.test(String(falsification.falsificationId)) ||
    (falsification.schemaVersion === "pmh.discovery-falsification.v2" &&
      (!/^sha256:[0-9a-f]{64}$/.test(String(falsification.findingIdentity)) ||
        falsification.findingIdentity !== hashCanonical({
          schemaVersion: "pmh.discovery-falsification-finding.v1",
          relationKind: falsification.relationKind,
          listingRefs: falsification.listingRefs,
        }))) ||
    (falsification.schemaVersion === "pmh.discovery-falsification.v1" &&
      (falsification.findingIdentity !== undefined ||
        falsification.relationKind !== undefined)) ||
    falsification.falsificationId !== hashCanonical(body) ||
    !isNonEmptyString(falsification.workerId) ||
    !isNonEmptyString(falsification.taskId) ||
    !isNonEmptyString(falsification.claim) ||
    falsification.claim.length > 500 ||
    !isNonEmptyString(falsification.reason) ||
    falsification.reason.length > 500 ||
    (falsification.schemaVersion === "pmh.discovery-falsification.v2" &&
      !["EQUIVALENCE", "IMPLICATION", "MUTUAL_EXCLUSION", "EXHAUSTIVENESS", "MECHANISM"]
        .includes(String(falsification.relationKind))) ||
    !isStringArray(falsification.listingRefs) ||
    falsification.listingRefs.length < 2 ||
    falsification.listingRefs.length > 6 ||
    new Set(falsification.listingRefs).size !== falsification.listingRefs.length ||
    !isStringArray(falsification.claimSearchTerms) ||
    falsification.claimSearchTerms.length < 1 ||
    falsification.claimSearchTerms.length > 12 ||
    falsification.authority !== "SEARCH_NEGATIVE_EVIDENCE_ONLY" ||
    falsification.semanticDecisionAuthority !== false ||
    falsification.certificateAuthority !== false ||
    falsification.executionAuthority !== false ||
    falsification.externalWriteAuthority !== false ||
    falsification.valueMovingAuthority !== false
  ) {
    throw new Error("stored discovery falsification violates its authority boundary");
  }
  return Object.freeze({
    ...body,
    falsificationId: falsification.falsificationId,
    listingRefs: Object.freeze([...falsification.listingRefs]),
    claimSearchTerms: Object.freeze([...falsification.claimSearchTerms]),
  }) as DiscoveryFalsification;
}

function freezeHypothesis(value: unknown): OpportunityHypothesis {
  if (value === null || typeof value !== "object") {
    throw new Error("stored discovery hypothesis is malformed");
  }
  const hypothesis = value as Record<string, unknown>;
  if (
    !isNonEmptyString(hypothesis.hypothesisId) ||
    !isNonEmptyString(hypothesis.workerId) ||
    !isNonEmptyString(hypothesis.thesis) ||
    (hypothesis.strategyKind !== "COMPLETE_SET" &&
      hypothesis.strategyKind !== "EXHAUSTIVE_RANGE" &&
      hypothesis.strategyKind !== "SAME_CLAIM_CROSS_VENUE") ||
    !isStringArray(hypothesis.venueIds) ||
    hypothesis.venueIds.length === 0 ||
    !isStringArray(hypothesis.claimSearchTerms) ||
    (hypothesis.listingRefs !== undefined &&
      !isStringArray(hypothesis.listingRefs)) ||
    typeof hypothesis.confidenceBps !== "number" ||
    !Number.isSafeInteger(hypothesis.confidenceBps) ||
    hypothesis.confidenceBps < 0 ||
    hypothesis.confidenceBps > 10_000 ||
    hypothesis.authority !== "PROPOSE_ONLY" ||
    hypothesis.reviewStatus !== "UNREVIEWED"
  ) {
    throw new Error("stored discovery hypothesis violates its authority boundary");
  }
  return Object.freeze({
    hypothesisId: hypothesis.hypothesisId,
    workerId: hypothesis.workerId,
    thesis: hypothesis.thesis,
    strategyKind: hypothesis.strategyKind,
    venueIds: Object.freeze([...hypothesis.venueIds]),
    claimSearchTerms: Object.freeze([...hypothesis.claimSearchTerms]),
    ...(hypothesis.listingRefs === undefined
      ? {}
      : { listingRefs: Object.freeze([...hypothesis.listingRefs]) }),
    confidenceBps: hypothesis.confidenceBps,
    authority: "PROPOSE_ONLY",
    reviewStatus: "UNREVIEWED",
  });
}

function freezeCatalogContext(
  value: DiscoveryCatalogContext,
): DiscoveryCatalogContext {
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    source: value.source,
    contentPolicy: value.contentPolicy,
    contextIdentity: value.contextIdentity,
    listings: Object.freeze(
      value.listings.map((listing) =>
        Object.freeze({
          ...listing,
          outcomes: Object.freeze(
            listing.outcomes.map((outcome) => Object.freeze({ ...outcome })),
          ),
        }),
      ),
    ),
  });
}

export function assertDiscoveryRunRecord(value: unknown): DiscoveryRunRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored discovery run is malformed");
  }
  const record = value as Record<string, unknown>;
  if (
    !isNonEmptyString(record.runId) ||
    !isNonEmptyString(record.taskId) ||
    !isNonEmptyString(record.startedAt) ||
    !isNonEmptyString(record.completedAt) ||
    Number.isNaN(Date.parse(record.startedAt)) ||
    Number.isNaN(Date.parse(record.completedAt)) ||
    Date.parse(record.completedAt) < Date.parse(record.startedAt) ||
    !isStringArray(record.workerIds) ||
    record.workerIds.length === 0 ||
    !Array.isArray(record.hypotheses) ||
    (record.falsifications !== undefined &&
      !Array.isArray(record.falsifications)) ||
    !isStringArray(record.diagnostics) ||
    record.executionAuthority !== false ||
    !isNonEmptyString(record.question) ||
    !isStringArray(record.venueIds) ||
    record.venueIds.length === 0
  ) {
    throw new Error("stored discovery run violates its record contract");
  }
  const workerIds = record.workerIds as readonly string[];
  if (
    (record.catalogContextIdentity === undefined) !==
      (record.catalogListingCount === undefined) ||
    (record.catalogContextIdentity !== undefined &&
      (!/^sha256:[0-9a-f]{64}$/.test(String(record.catalogContextIdentity)) ||
        typeof record.catalogListingCount !== "number" ||
        !Number.isSafeInteger(record.catalogListingCount) ||
        record.catalogListingCount < 0 ||
        record.catalogListingCount > 30))
  ) {
    throw new Error("stored discovery run has an invalid catalog context");
  }
  if (
    record.catalogContextSource !== undefined &&
    (record.catalogContextIdentity === undefined ||
      (record.catalogContextSource !== "VERIFIED_FIXTURE_CATALOGS" &&
        record.catalogContextSource !== "QUALIFIED_LIVE_OBSERVATIONS"))
  ) {
    throw new Error("stored discovery run has an invalid catalog source");
  }
  let catalogContext: DiscoveryCatalogContext | undefined;
  if (record.catalogContext !== undefined) {
    assertDiscoveryTask({
      taskId: record.taskId,
      question: record.question,
      venueIds: record.venueIds,
      maxHypotheses: 1,
      deadlineEpochMs: 0,
      catalogContext: record.catalogContext as DiscoveryCatalogContext,
    });
    catalogContext = freezeCatalogContext(
      record.catalogContext as DiscoveryCatalogContext,
    );
    if (
      record.catalogContextIdentity !== catalogContext.contextIdentity ||
      record.catalogListingCount !== catalogContext.listings.length ||
      record.catalogContextSource !== catalogContext.source
    ) {
      throw new Error("stored discovery run context summary does not match snapshot");
    }
  }
  let workerReports: readonly DiscoveryWorkerReport[] | undefined;
  if (record.workerReports !== undefined) {
    if (!Array.isArray(record.workerReports)) {
      throw new Error("stored discovery worker reports are malformed");
    }
    workerReports = Object.freeze(record.workerReports.map(freezeWorkerReport));
    const reportIds = workerReports.map((report) => report.workerId);
    if (
      reportIds.length !== record.workerIds.length ||
      new Set(reportIds).size !== reportIds.length ||
      record.workerIds.some((workerId) => !reportIds.includes(workerId))
    ) {
      throw new Error("stored discovery worker reports do not bind the run");
    }
  }
  const falsifications = record.falsifications === undefined
    ? undefined
    : Object.freeze(record.falsifications.map(freezeFalsification));
  if (
    falsifications !== undefined &&
    (new Set(falsifications.map((item) => item.falsificationId)).size !==
        falsifications.length ||
      falsifications.some((item) =>
        item.taskId !== record.taskId || !workerIds.includes(item.workerId)
      ))
  ) {
    throw new Error("stored discovery falsifications do not bind the run");
  }
  if (falsifications !== undefined && workerReports !== undefined) {
    const tracedIds = workerReports.flatMap((report) =>
      report.status !== "PASS" || report.agentTrace === undefined
        ? []
        : report.agentTrace.effects.flatMap((effect) =>
            effect.toolName === "record_falsification" &&
              effect.status === "ACCEPTED" && effect.falsificationId != null
              ? [effect.falsificationId]
              : []
          )
    );
    const retainedIds = falsifications.map((item) => item.falsificationId);
    if (
      new Set(tracedIds).size !== retainedIds.length ||
      retainedIds.some((item) => !tracedIds.includes(item))
    ) {
      throw new Error("stored discovery falsifications do not bind agent effects");
    }
  }
  return Object.freeze({
    runId: record.runId,
    taskId: record.taskId,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    workerIds: Object.freeze([...workerIds]),
    ...(workerReports === undefined ? {} : { workerReports }),
    hypotheses: Object.freeze(record.hypotheses.map(freezeHypothesis)),
    ...(falsifications === undefined ? {} : { falsifications }),
    diagnostics: Object.freeze([...record.diagnostics]),
    executionAuthority: false,
    question: record.question,
    venueIds: Object.freeze([...record.venueIds]),
    ...(record.catalogContextIdentity === undefined
      ? {}
      : {
          catalogContextIdentity: String(record.catalogContextIdentity),
          catalogListingCount: record.catalogListingCount as number,
          ...(record.catalogContextSource === undefined
            ? {}
            : {
                catalogContextSource: record.catalogContextSource as
                  | "VERIFIED_FIXTURE_CATALOGS"
                  | "QUALIFIED_LIVE_OBSERVATIONS",
              }),
          ...(catalogContext === undefined ? {} : { catalogContext }),
        }),
  });
}

export function projectDiscoveryRunRecord(
  record: DiscoveryRunRecord,
): DiscoveryRunRecord {
  const { catalogContext: _catalogContext, ...projection } = record;
  return Object.freeze({
    ...projection,
    catalogContextRetained: record.catalogContext !== undefined,
  });
}

export class DiscoveryLedger {
  readonly #retentionLimit: number;
  readonly #store: DiscoveryRunStore | undefined;
  #runs: readonly DiscoveryRunRecord[];

  public constructor(retentionLimit = 25, store?: DiscoveryRunStore) {
    if (!Number.isSafeInteger(retentionLimit) || retentionLimit < 1) {
      throw new Error("discovery retention limit must be a positive integer");
    }
    this.#retentionLimit = retentionLimit;
    this.#store = store;
    this.#runs = Object.freeze(
      (store?.load(retentionLimit) ?? []).map(assertDiscoveryRunRecord),
    );
  }

  public findByTaskId(taskId: string): DiscoveryRunRecord | undefined {
    return (
      this.#runs.find((item) => item.taskId === taskId) ??
      this.#store?.findByTaskId(taskId)
    );
  }

  public record(task: DiscoveryTask, run: DiscoveryRun): DiscoveryRunRecord {
    if (task.taskId !== run.taskId || run.executionAuthority !== false) {
      throw new Error("discovery run does not bind its task or authority");
    }
    if (
      run.hypotheses.some(
        (hypothesis) =>
          hypothesis.authority !== "PROPOSE_ONLY" ||
          hypothesis.reviewStatus !== "UNREVIEWED",
      )
    ) {
      throw new Error("discovery ledger accepts unreviewed proposals only");
    }
    const record = assertDiscoveryRunRecord({
      ...run,
      question: task.question,
      venueIds: [...task.venueIds],
      ...(task.catalogContext === undefined
        ? {}
        : {
            catalogContextIdentity: task.catalogContext.contextIdentity,
            catalogListingCount: task.catalogContext.listings.length,
            catalogContextSource: task.catalogContext.source,
            catalogContext: task.catalogContext,
          }),
    });
    const stored = this.#store?.save(record, this.#retentionLimit) ?? record;
    if (
      stored.question !== record.question ||
      stored.venueIds.length !== record.venueIds.length ||
      stored.venueIds.some((item, index) => item !== record.venueIds[index]) ||
      stored.catalogContextIdentity !== record.catalogContextIdentity ||
      stored.catalogListingCount !== record.catalogListingCount ||
      stored.catalogContext?.contextIdentity !==
        record.catalogContext?.contextIdentity ||
      (stored.catalogContextSource ?? "VERIFIED_FIXTURE_CATALOGS") !==
        (record.catalogContextSource ?? "VERIFIED_FIXTURE_CATALOGS")
    ) {
      throw new Error("taskId is already bound to another discovery scope");
    }
    this.#runs = Object.freeze([
      stored,
      ...this.#runs.filter((item) => item.taskId !== stored.taskId),
    ].slice(0, this.#retentionLimit));
    return stored;
  }

  public projection(): DiscoveryDeskProjection {
    const hypothesisCount = this.#runs.reduce(
      (total, run) => total + run.hypotheses.length,
      0,
    );
    const falsificationCount = this.#runs.reduce(
      (total, run) => total + (run.falsifications?.length ?? 0),
      0,
    );
    return Object.freeze({
      retentionLimit: this.#retentionLimit,
      runCount: this.#runs.length,
      hypothesisCount,
      unreviewedCount: hypothesisCount,
      falsificationCount,
      storage:
        this.#store?.storage ??
        Object.freeze({
          mode: "MEMORY" as const,
          durable: false,
          schemaVersion: 0,
          idempotencyKey: "taskId" as const,
        }),
      runs: Object.freeze(this.#runs.map(projectDiscoveryRunRecord)),
    });
  }

  public close(): void {
    this.#store?.close();
  }
}
