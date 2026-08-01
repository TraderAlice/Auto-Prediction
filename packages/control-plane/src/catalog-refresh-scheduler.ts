import type { Hash } from "@pmh/domain";
import type {
  CatalogObservationDesk,
  CatalogObservationProjection,
} from "./catalog-observation.js";

const MIN_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 10 * 60_000;

export type CatalogRefreshTrigger = "STARTUP" | "OPERATOR" | "SCHEDULE";

export type CatalogRefreshSchedulerProjection = Readonly<{
  schemaVersion: "pmh.catalog-refresh-scheduler.v1";
  enabled: boolean;
  status: "DISABLED" | "IDLE" | "REFRESHING";
  intervalMs: number | null;
  nextRefreshAt: string | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastTrigger: CatalogRefreshTrigger | null;
  lastResult: "READY" | "DEGRADED" | "FAILED" | null;
  latestSnapshotIdentity: Hash | null;
  runCount: number;
  readyCount: number;
  degradedCount: number;
  failedCount: number;
  effects: Readonly<{
    anonymousPublicGets: true;
    modelCalls: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type CatalogRefreshResult = Readonly<{
  trigger: CatalogRefreshTrigger;
  catalog: CatalogObservationProjection;
  snapshotIdentity: Hash;
}>;

export type CatalogRefreshInvocation = Readonly<{
  promise: Promise<CatalogRefreshResult>;
  coalesced: boolean;
}>;

export class CatalogRefreshScheduler {
  readonly #desk: CatalogObservationDesk;
  readonly #now: () => number;
  readonly intervalMs: number | null;
  #active: Promise<CatalogRefreshResult> | null = null;
  #nextRefreshAtMs: number | null;
  #lastStartedAt: string | null = null;
  #lastCompletedAt: string | null = null;
  #lastTrigger: CatalogRefreshTrigger | null = null;
  #lastResult: "READY" | "DEGRADED" | "FAILED" | null = null;
  #latestSnapshotIdentity: Hash | null = null;
  #runCount = 0;
  #readyCount = 0;
  #degradedCount = 0;
  #failedCount = 0;

  public constructor(options: Readonly<{
    desk: CatalogObservationDesk;
    intervalMs?: number | null;
    now?: () => number;
  }>) {
    this.#desk = options.desk;
    this.#now = options.now ?? Date.now;
    this.intervalMs = options.intervalMs ?? null;
    if (
      this.intervalMs !== null &&
      (!Number.isSafeInteger(this.intervalMs) || this.intervalMs < 1)
    ) {
      throw new Error("catalog refresh interval must be a positive integer or null");
    }
    this.#nextRefreshAtMs = this.intervalMs === null ? null : this.#now();
  }

  public get refreshing(): boolean {
    return this.#active !== null;
  }

  public tick(): CatalogRefreshInvocation | null {
    if (
      this.intervalMs === null ||
      this.#nextRefreshAtMs === null ||
      this.#now() < this.#nextRefreshAtMs
    ) {
      return null;
    }
    return this.runNow("SCHEDULE");
  }

  public runNow(trigger: CatalogRefreshTrigger): CatalogRefreshInvocation {
    if (this.#active !== null) {
      return Object.freeze({ promise: this.#active, coalesced: true });
    }
    const startedAtMs = this.#now();
    this.#lastStartedAt = new Date(startedAtMs).toISOString();
    this.#lastTrigger = trigger;
    if (this.intervalMs !== null) {
      this.#nextRefreshAtMs = startedAtMs + this.intervalMs;
    }
    const promise = this.#desk.refresh().then(
      (catalog): CatalogRefreshResult => {
        const snapshotIdentity = this.#desk.corpus().snapshotIdentity;
        this.#lastCompletedAt = new Date(this.#now()).toISOString();
        this.#latestSnapshotIdentity = snapshotIdentity;
        this.#runCount += 1;
        if (catalog.status === "READY") {
          this.#lastResult = "READY";
          this.#readyCount += 1;
        } else {
          this.#lastResult = "DEGRADED";
          this.#degradedCount += 1;
        }
        return Object.freeze({ trigger, catalog, snapshotIdentity });
      },
      (error: unknown) => {
        this.#lastCompletedAt = new Date(this.#now()).toISOString();
        this.#lastResult = "FAILED";
        this.#runCount += 1;
        this.#failedCount += 1;
        throw error;
      },
    ).finally(() => {
      this.#active = null;
    });
    this.#active = promise;
    return Object.freeze({ promise, coalesced: false });
  }

  public projection(): CatalogRefreshSchedulerProjection {
    return Object.freeze({
      schemaVersion: "pmh.catalog-refresh-scheduler.v1",
      enabled: this.intervalMs !== null,
      status:
        this.#active !== null
          ? "REFRESHING"
          : this.intervalMs === null
            ? "DISABLED"
            : "IDLE",
      intervalMs: this.intervalMs,
      nextRefreshAt:
        this.#nextRefreshAtMs === null
          ? null
          : new Date(this.#nextRefreshAtMs).toISOString(),
      lastStartedAt: this.#lastStartedAt,
      lastCompletedAt: this.#lastCompletedAt,
      lastTrigger: this.#lastTrigger,
      lastResult: this.#lastResult,
      latestSnapshotIdentity: this.#latestSnapshotIdentity,
      runCount: this.#runCount,
      readyCount: this.#readyCount,
      degradedCount: this.#degradedCount,
      failedCount: this.#failedCount,
      effects: Object.freeze({
        anonymousPublicGets: true,
        modelCalls: false,
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      }),
    });
  }
}

export function parseCatalogRefreshInterval(
  environment: Readonly<Record<string, string | undefined>>,
): number | null {
  const raw = environment.PMH_CATALOG_REFRESH_INTERVAL_MS?.trim() ?? "";
  if (raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (
    !Number.isSafeInteger(value) ||
    value < MIN_INTERVAL_MS ||
    value > MAX_INTERVAL_MS
  ) {
    throw new Error(
      `PMH_CATALOG_REFRESH_INTERVAL_MS must be 0 or an integer from ${MIN_INTERVAL_MS} to ${MAX_INTERVAL_MS}`,
    );
  }
  return value;
}
