import { hashCanonical } from "@pmh/domain";
import type { PiInvestigationReport, PiInvestigator } from "./pi-investigator.js";
import type {
  DiscoveryTask,
  OperationalStorageProjection,
} from "./types.js";

export type InvestigationRecord = Readonly<{
  investigationId: string;
  taskId: string;
  question: string;
  venueIds: readonly string[];
  catalogContextIdentity: string;
  catalogListingCount: number;
  status: "RUNNING" | "PASS" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  report: PiInvestigationReport | null;
  diagnostic: string | null;
  authority: "PROPOSE_ONLY";
  reviewStatus: "UNREVIEWED";
  executionAuthority: false;
}>;

export type InvestigationDeskProjection = Readonly<{
  retentionLimit: number;
  activeCount: 0 | 1;
  runCount: number;
  passCount: number;
  failedCount: number;
  storage: OperationalStorageProjection<"taskId+catalogContextIdentity">;
  records: readonly InvestigationRecord[];
}>;

export interface InvestigationRecordStore {
  readonly investigationStorage: OperationalStorageProjection<"taskId+catalogContextIdentity">;
  loadInvestigations(limit: number): readonly InvestigationRecord[];
  saveInvestigation(
    record: InvestigationRecord,
    retentionLimit: number,
  ): InvestigationRecord;
}

export class InvestigationNotConfiguredError extends Error {}
export class InvestigationBusyError extends Error {}
export class InvestigationScopeConflictError extends Error {}

type InvestigationInvocation = Readonly<{
  promise: Promise<InvestigationRecord>;
  idempotentReplay: boolean;
}>;

function scopeHash(task: DiscoveryTask): string {
  return hashCanonical({
    taskId: task.taskId,
    question: task.question,
    venueIds: task.venueIds,
    catalogContextIdentity: task.catalogContext?.contextIdentity ?? null,
  });
}

function recordMatchesTask(
  record: InvestigationRecord,
  task: DiscoveryTask,
): boolean {
  return (
    record.question === task.question &&
    record.venueIds.length === task.venueIds.length &&
    record.venueIds.every((venueId, index) => venueId === task.venueIds[index]) &&
    record.catalogContextIdentity === task.catalogContext?.contextIdentity
  );
}

function safeDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^pi investigat(?:or|ion)\b/u.test(message) && message.length <= 500
    ? message
    : "pi investigator failed";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function freezeReport(value: unknown): PiInvestigationReport {
  if (value === null || typeof value !== "object") {
    throw new Error("stored pi investigation report is malformed");
  }
  const report = value as Record<string, unknown>;
  const engine = report.engine as Record<string, unknown> | null;
  const task = report.task as Record<string, unknown> | null;
  const result = report.result as Record<string, unknown> | null;
  const trace = report.trace as Record<string, unknown> | null;
  const effects = report.effects as Record<string, unknown> | null;
  if (
    report.schemaVersion !== "pmh.pi-investigation-report.v1" ||
    report.status !== "PASS" ||
    !isIsoDate(report.startedAt) ||
    !isIsoDate(report.completedAt) ||
    Date.parse(report.completedAt) < Date.parse(report.startedAt) ||
    engine === null ||
    engine.name !== "PI_CLI" ||
    engine.provider !== "deepseek" ||
    !isNonEmptyString(engine.model) ||
    engine.mode !== "TEXT_ONE_SHOT" ||
    task === null ||
    !isNonEmptyString(task.taskId) ||
    !isNonEmptyString(task.question) ||
    !isStringArray(task.venueIds) ||
    task.venueIds.length === 0 ||
    !/^sha256:[0-9a-f]{64}$/.test(String(task.catalogContextIdentity)) ||
    typeof task.catalogListingCount !== "number" ||
    !Number.isSafeInteger(task.catalogListingCount) ||
    task.catalogListingCount < 1 ||
    task.catalogListingCount > 30 ||
    result === null ||
    !isNonEmptyString(result.summary) ||
    result.summary.length > 2_000 ||
    !isStringArray(result.candidateListingRefs) ||
    result.candidateListingRefs.length > 30 ||
    result.candidateListingRefs.some((item) => item.length > 1_000) ||
    !Array.isArray(result.findings) ||
    result.findings.length > 50 ||
    !isStringArray(result.missingEvidence) ||
    result.missingEvidence.length > 30 ||
    result.missingEvidence.some((item) => item.length > 500) ||
    result.authority !== "PROPOSE_ONLY" ||
    result.reviewStatus !== "UNREVIEWED" ||
    result.executionAuthority !== false ||
    trace === null ||
    trace.outputMode !== "FINAL_TEXT" ||
    !Array.isArray(trace.permittedTools) ||
    trace.permittedTools.join(",") !== "read,grep,find,ls" ||
    trace.toolExecutionTraceAvailable !== false ||
    effects === null ||
    effects.sessionPersistence !== false ||
    effects.shellAccess !== false ||
    effects.fileWrites !== false ||
    effects.valueMovingActions !== false ||
    effects.liveExecutionEnabled !== false ||
    !/^sha256:[0-9a-f]{64}$/.test(String(report.artifactHash))
  ) {
    throw new Error("stored pi investigation report violates its contract");
  }
  const findings = result.findings.map((value) => {
    if (value === null || typeof value !== "object") {
      throw new Error("stored pi investigation finding is malformed");
    }
    const finding = value as Record<string, unknown>;
    if (
      !isStringArray(finding.listingRefs) ||
      finding.listingRefs.length === 0 ||
      finding.listingRefs.length > 10 ||
      finding.listingRefs.some((item) => item.length > 1_000) ||
      !isNonEmptyString(finding.statement) ||
      finding.statement.length > 1_000 ||
      (finding.severity !== "INFO" && finding.severity !== "WARNING")
    ) {
      throw new Error("stored pi investigation finding violates its contract");
    }
    return Object.freeze({
      listingRefs: Object.freeze([...finding.listingRefs]),
      statement: finding.statement,
      severity: finding.severity,
    });
  });
  const body = Object.freeze({
    schemaVersion: "pmh.pi-investigation-report.v1" as const,
    status: "PASS" as const,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    engine: Object.freeze({
      name: "PI_CLI" as const,
      provider: "deepseek" as const,
      model: engine.model,
      mode: "TEXT_ONE_SHOT" as const,
    }),
    task: Object.freeze({
      taskId: task.taskId,
      question: task.question,
      venueIds: Object.freeze([...task.venueIds]),
      catalogContextIdentity: String(task.catalogContextIdentity),
      catalogListingCount: task.catalogListingCount,
    }),
    result: Object.freeze({
      summary: result.summary,
      candidateListingRefs: Object.freeze([...result.candidateListingRefs]),
      findings: Object.freeze(findings),
      missingEvidence: Object.freeze([...result.missingEvidence]),
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      executionAuthority: false as const,
    }),
    trace: Object.freeze({
      outputMode: "FINAL_TEXT" as const,
      permittedTools: Object.freeze(["read", "grep", "find", "ls"] as const),
      toolExecutionTraceAvailable: false as const,
    }),
    effects: Object.freeze({
      sessionPersistence: false as const,
      shellAccess: false as const,
      fileWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  if (hashCanonical(body) !== report.artifactHash) {
    throw new Error("stored pi investigation report identity mismatch");
  }
  return Object.freeze({ ...body, artifactHash: report.artifactHash as string });
}

export function assertInvestigationRecord(value: unknown): InvestigationRecord {
  if (value === null || typeof value !== "object") {
    throw new Error("stored investigation record is malformed");
  }
  const record = value as Record<string, unknown>;
  const running = record.status === "RUNNING";
  const passed = record.status === "PASS";
  const failed = record.status === "FAILED";
  if (
    !/^investigation:[0-9a-f]{64}$/.test(String(record.investigationId)) ||
    !isNonEmptyString(record.taskId) ||
    !isNonEmptyString(record.question) ||
    record.question.length > 500 ||
    !isStringArray(record.venueIds) ||
    record.venueIds.length === 0 ||
    record.venueIds.length > 25 ||
    record.venueIds.some((item) => item.length > 256) ||
    !/^sha256:[0-9a-f]{64}$/.test(String(record.catalogContextIdentity)) ||
    typeof record.catalogListingCount !== "number" ||
    !Number.isSafeInteger(record.catalogListingCount) ||
    record.catalogListingCount < 1 ||
    record.catalogListingCount > 30 ||
    (!running && !passed && !failed) ||
    !isIsoDate(record.startedAt) ||
    (running ? record.completedAt !== null : !isIsoDate(record.completedAt)) ||
    (!running &&
      Date.parse(record.completedAt as string) < Date.parse(record.startedAt)) ||
    record.authority !== "PROPOSE_ONLY" ||
    record.reviewStatus !== "UNREVIEWED" ||
    record.executionAuthority !== false ||
    (running &&
      (record.report !== null || record.diagnostic !== null)) ||
    (passed &&
      (record.report === null || record.diagnostic !== null)) ||
    (failed &&
      (record.report !== null || !isNonEmptyString(record.diagnostic) ||
        record.diagnostic.length > 500))
  ) {
    throw new Error("stored investigation record violates its contract");
  }
  const venueIds = record.venueIds as readonly string[];
  const report = passed ? freezeReport(record.report) : null;
  if (
    report !== null &&
    (report.task.taskId !== record.taskId ||
      report.task.question !== record.question ||
      report.task.venueIds.length !== venueIds.length ||
      report.task.venueIds.some(
        (venueId, index) => venueId !== venueIds[index],
      ) ||
      report.task.catalogContextIdentity !== record.catalogContextIdentity ||
      report.task.catalogListingCount !== record.catalogListingCount ||
      Date.parse(report.startedAt) < Date.parse(record.startedAt) ||
      Date.parse(report.completedAt) > Date.parse(record.completedAt as string))
  ) {
    throw new Error("stored investigation report scope mismatch");
  }
  return Object.freeze({
    investigationId: String(record.investigationId),
    taskId: record.taskId,
    question: record.question,
    venueIds: Object.freeze([...venueIds]),
    catalogContextIdentity: String(record.catalogContextIdentity),
    catalogListingCount: record.catalogListingCount,
    status: record.status as InvestigationRecord["status"],
    startedAt: record.startedAt,
    completedAt: running ? null : (record.completedAt as string),
    report,
    diagnostic: failed ? (record.diagnostic as string) : null,
    authority: "PROPOSE_ONLY",
    reviewStatus: "UNREVIEWED",
    executionAuthority: false,
  });
}

export class InvestigationDesk {
  readonly #records: InvestigationRecord[];
  #sequence = 0;
  #active:
    | Readonly<{
        taskId: string;
        scopeHash: string;
        promise: Promise<InvestigationRecord>;
      }>
    | null = null;

  public constructor(
    private readonly investigator: PiInvestigator | null,
    public readonly retentionLimit = 10,
    private readonly store?: InvestigationRecordStore,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isSafeInteger(retentionLimit) || retentionLimit < 1) {
      throw new Error("investigation retention limit must be positive");
    }
    this.#records = [
      ...(store?.loadInvestigations(retentionLimit) ?? []).map(
        assertInvestigationRecord,
      ),
    ];
    if (this.#records.some((record) => record.status === "RUNNING")) {
      throw new Error("persisted investigation store returned an active record");
    }
    this.#sequence = this.#records.length;
  }

  public begin(task: DiscoveryTask): InvestigationInvocation {
    if (task.catalogContext === undefined) {
      throw new InvestigationScopeConflictError(
        "investigation requires a catalog context",
      );
    }
    const requestedScopeHash = scopeHash(task);
    const passed = this.#records.find(
      (record) => record.taskId === task.taskId && record.status === "PASS",
    );
    if (passed !== undefined) {
      if (!recordMatchesTask(passed, task)) {
        throw new InvestigationScopeConflictError(
          "taskId is already bound to another investigation scope",
        );
      }
      return { promise: Promise.resolve(passed), idempotentReplay: true };
    }
    if (this.investigator === null) {
      throw new InvestigationNotConfiguredError(
        "pi investigator is not configured",
      );
    }
    if (this.#active !== null) {
      if (
        this.#active.taskId === task.taskId &&
        this.#active.scopeHash === requestedScopeHash
      ) {
        return { promise: this.#active.promise, idempotentReplay: true };
      }
      throw new InvestigationBusyError(
        "one pi investigation is already running",
      );
    }

    const startedAtMs = this.now();
    this.#sequence += 1;
    const running = assertInvestigationRecord({
      investigationId: `investigation:${hashCanonical({
        taskId: task.taskId,
        scopeHash: requestedScopeHash,
        startedAtMs,
        sequence: this.#sequence,
      }).slice(7)}`,
      taskId: task.taskId,
      question: task.question,
      venueIds: Object.freeze([...task.venueIds]),
      catalogContextIdentity: task.catalogContext.contextIdentity,
      catalogListingCount: task.catalogContext.listings.length,
      status: "RUNNING" as const,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: null,
      report: null,
      diagnostic: null,
      authority: "PROPOSE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      executionAuthority: false as const,
    });
    this.#records.unshift(running);
    this.#trim();

    const promise = this.investigator
      .investigate(task)
      .then((report) =>
        this.#finish(running.investigationId, {
          status: "PASS",
          report,
          diagnostic: null,
        }),
      )
      .catch((error: unknown) =>
        this.#finish(running.investigationId, {
          status: "FAILED",
          report: null,
          diagnostic: safeDiagnostic(error),
        }),
      )
      .finally(() => {
        if (this.#active?.promise === promise) this.#active = null;
      });
    this.#active = {
      taskId: task.taskId,
      scopeHash: requestedScopeHash,
      promise,
    };
    return { promise, idempotentReplay: false };
  }

  public projection(): InvestigationDeskProjection {
    return Object.freeze({
      retentionLimit: this.retentionLimit,
      activeCount: this.#active === null ? 0 : 1,
      runCount: this.#records.length,
      passCount: this.#records.filter((record) => record.status === "PASS").length,
      failedCount: this.#records.filter((record) => record.status === "FAILED").length,
      storage:
        this.store?.investigationStorage ??
        Object.freeze({
          mode: "MEMORY" as const,
          durable: false as const,
          schemaVersion: 0,
          idempotencyKey: "taskId+catalogContextIdentity" as const,
        }),
      records: Object.freeze([...this.#records]),
    });
  }

  #finish(
    investigationId: string,
    result: Readonly<
      | { status: "PASS"; report: PiInvestigationReport; diagnostic: null }
      | { status: "FAILED"; report: null; diagnostic: string }
    >,
  ): InvestigationRecord {
    const index = this.#records.findIndex(
      (record) => record.investigationId === investigationId,
    );
    if (index < 0) throw new Error("active investigation record is missing");
    const current = this.#records[index]!;
    const completed = assertInvestigationRecord({
      ...current,
      ...result,
      completedAt: new Date(this.now()).toISOString(),
    });
    const stored = this.store?.saveInvestigation(
      completed,
      this.retentionLimit,
    ) ?? completed;
    this.#records[index] = assertInvestigationRecord(stored);
    this.#trim();
    return this.#records[index]!;
  }

  #trim(): void {
    if (this.#records.length > this.retentionLimit) {
      this.#records.splice(this.retentionLimit);
    }
  }
}
