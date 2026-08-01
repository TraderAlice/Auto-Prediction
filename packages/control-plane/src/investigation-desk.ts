import { hashCanonical } from "@pmh/domain";
import type { PiInvestigationReport, PiInvestigator } from "./pi-investigator.js";
import type { DiscoveryTask } from "./types.js";

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
  storage: Readonly<{
    mode: "MEMORY";
    durable: false;
    idempotencyKey: "taskId+catalogContextIdentity";
  }>;
  records: readonly InvestigationRecord[];
}>;

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

export class InvestigationDesk {
  readonly #records: InvestigationRecord[] = [];
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
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isSafeInteger(retentionLimit) || retentionLimit < 1) {
      throw new Error("investigation retention limit must be positive");
    }
  }

  public begin(task: DiscoveryTask): InvestigationInvocation {
    if (this.investigator === null) {
      throw new InvestigationNotConfiguredError(
        "pi investigator is not configured",
      );
    }
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
    const running = Object.freeze({
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
      storage: Object.freeze({
        mode: "MEMORY" as const,
        durable: false as const,
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
    const completed = Object.freeze({
      ...current,
      ...result,
      completedAt: new Date(this.now()).toISOString(),
    });
    this.#records[index] = completed;
    return completed;
  }

  #trim(): void {
    if (this.#records.length > this.retentionLimit) {
      this.#records.splice(this.retentionLimit);
    }
  }
}
