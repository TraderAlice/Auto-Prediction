import type {
  DiscoveryCatalogContext,
  DiscoveryDeskProjection,
  DiscoveryRun,
  DiscoveryRunRecord,
  DiscoveryTask,
  DiscoveryWorkerReport,
  OperationalStorageProjection,
  OpportunityHypothesis,
} from "./types.js";
import { assertDiscoveryTask } from "./discovery.js";

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

function freezeWorkerReport(value: unknown): DiscoveryWorkerReport {
  if (value === null || typeof value !== "object") {
    throw new Error("stored discovery worker report is malformed");
  }
  const report = value as Record<string, unknown>;
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
      (report.diagnostic === null || report.hypothesisCount !== 0))
  ) {
    throw new Error("stored discovery worker report violates its contract");
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
    diagnostic: report.diagnostic,
  }) as DiscoveryWorkerReport;
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
    !isStringArray(record.diagnostics) ||
    record.executionAuthority !== false ||
    !isNonEmptyString(record.question) ||
    !isStringArray(record.venueIds) ||
    record.venueIds.length === 0
  ) {
    throw new Error("stored discovery run violates its record contract");
  }
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
  return Object.freeze({
    runId: record.runId,
    taskId: record.taskId,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    workerIds: Object.freeze([...record.workerIds]),
    ...(workerReports === undefined ? {} : { workerReports }),
    hypotheses: Object.freeze(record.hypotheses.map(freezeHypothesis)),
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
    return Object.freeze({
      retentionLimit: this.#retentionLimit,
      runCount: this.#runs.length,
      hypothesisCount,
      unreviewedCount: hypothesisCount,
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
