import type {
  DiscoveryDeskProjection,
  DiscoveryRun,
  DiscoveryRunRecord,
  DiscoveryTask,
} from "./types.js";

export class DiscoveryLedger {
  readonly #retentionLimit: number;
  #runs: readonly DiscoveryRunRecord[] = [];

  public constructor(retentionLimit = 25) {
    if (!Number.isSafeInteger(retentionLimit) || retentionLimit < 1) {
      throw new Error("discovery retention limit must be a positive integer");
    }
    this.#retentionLimit = retentionLimit;
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
    const record: DiscoveryRunRecord = Object.freeze({
      ...run,
      question: task.question,
      venueIds: Object.freeze([...task.venueIds]),
    });
    this.#runs = Object.freeze([
      record,
      ...this.#runs.filter((item) => item.runId !== run.runId),
    ].slice(0, this.#retentionLimit));
    return record;
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
      runs: this.#runs,
    });
  }
}
