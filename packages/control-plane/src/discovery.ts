import { hashCanonical } from "@pmh/domain";
import type {
  AiModelPort,
  DiscoveryRun,
  DiscoveryTask,
  DiscoveryWorker,
  OpportunityHypothesis,
} from "./types.js";

const SEARCH_STOPWORDS = new Set([
  "and",
  "are",
  "before",
  "could",
  "for",
  "from",
  "have",
  "into",
  "may",
  "same",
  "that",
  "the",
  "this",
  "will",
  "with",
]);

function assertTask(task: DiscoveryTask): void {
  if (
    task.taskId.trim() === "" ||
    task.question.trim() === "" ||
    task.venueIds.length === 0 ||
    task.maxHypotheses < 1 ||
    task.maxHypotheses > 50 ||
    !Number.isSafeInteger(task.maxHypotheses) ||
    !Number.isSafeInteger(task.deadlineEpochMs)
  ) {
    throw new Error("discovery task is invalid or unbounded");
  }
}

function assertHypothesis(
  hypothesis: OpportunityHypothesis,
  workerId: string,
  task: DiscoveryTask,
): void {
  const allowedVenueIds = new Set(task.venueIds);
  if (
    hypothesis.workerId !== workerId ||
    hypothesis.authority !== "PROPOSE_ONLY" ||
    hypothesis.reviewStatus !== "UNREVIEWED" ||
    hypothesis.thesis.trim() === "" ||
    hypothesis.thesis.length > 500 ||
    hypothesis.venueIds.length === 0 ||
    hypothesis.venueIds.some(
      (venueId) => venueId.trim() === "" || !allowedVenueIds.has(venueId),
    ) ||
    hypothesis.claimSearchTerms.length > 12 ||
    hypothesis.claimSearchTerms.some(
      (term) => term.trim() === "" || term.length > 80,
    ) ||
    hypothesis.confidenceBps < 0 ||
    hypothesis.confidenceBps > 10_000 ||
    !Number.isSafeInteger(hypothesis.confidenceBps)
  ) {
    throw new Error(`worker ${workerId} returned an unsafe hypothesis`);
  }
}

export class HeuristicDiscoveryWorker implements DiscoveryWorker {
  public readonly workerId: string;
  public readonly kind = "HEURISTIC" as const;
  public readonly costTier = "FREE" as const;

  public constructor(workerId = "heuristic-fast-1") {
    this.workerId = workerId;
  }

  public async discover(
    task: DiscoveryTask,
  ): Promise<readonly OpportunityHypothesis[]> {
    const normalizedQuestion = task.question.trim().replace(/\s+/g, " ");
    const venueIds = [...new Set(task.venueIds)].sort();
    const strategyKind =
      venueIds.length >= 2
        ? ("SAME_CLAIM_CROSS_VENUE" as const)
        : ("COMPLETE_SET" as const);
    const identity = hashCanonical({
      workerId: this.workerId,
      normalizedQuestion,
      venueIds,
      strategyKind,
    });
    return [
      Object.freeze({
        hypothesisId: `hypothesis:${identity.slice(7, 23)}`,
        workerId: this.workerId,
        thesis:
          `Search ${venueIds.join(", ")} for listings that may resolve ` +
          `to the same canonical claim: ${normalizedQuestion}`,
        strategyKind,
        venueIds: Object.freeze(venueIds),
        claimSearchTerms: Object.freeze(
          normalizedQuestion
            .toLowerCase()
            .split(/[^a-z0-9$%.]+/)
            .filter(
              (term) => term.length >= 3 && !SEARCH_STOPWORDS.has(term),
            )
            .slice(0, 8),
        ),
        confidenceBps: 2_500,
        authority: "PROPOSE_ONLY" as const,
        reviewStatus: "UNREVIEWED" as const,
      }),
    ];
  }
}

type ModelPayload = Readonly<{
  hypotheses: readonly Readonly<{
    thesis: string;
    strategyKind: OpportunityHypothesis["strategyKind"];
    venueIds: readonly string[];
    claimSearchTerms: readonly string[];
    confidenceBps: number;
  }>[];
}>;

function parseModelPayload(value: unknown): ModelPayload {
  if (
    value === null ||
    typeof value !== "object" ||
    !Array.isArray((value as { hypotheses?: unknown }).hypotheses) ||
    Object.keys(value).length !== 1 ||
    (value as { hypotheses: unknown[] }).hypotheses.length > 50
  ) {
    throw new Error("model output does not match pmh.discovery-output.v1");
  }
  const hypotheses = (value as { hypotheses: unknown[] }).hypotheses.map(
    (item) => {
      if (
        item === null ||
        typeof item !== "object" ||
        typeof (item as { thesis?: unknown }).thesis !== "string" ||
        !Array.isArray((item as { venueIds?: unknown }).venueIds) ||
        !Array.isArray((item as { claimSearchTerms?: unknown }).claimSearchTerms) ||
        typeof (item as { confidenceBps?: unknown }).confidenceBps !== "number" ||
        (item as { thesis: string }).thesis.trim() === "" ||
        (item as { thesis: string }).thesis.length > 500 ||
        Object.keys(item).length !== 5 ||
        ![
          "thesis",
          "strategyKind",
          "venueIds",
          "claimSearchTerms",
          "confidenceBps",
        ].every((key) => Object.hasOwn(item, key))
      ) {
        throw new Error("model hypothesis has an invalid shape");
      }
      const strategyKind = (item as { strategyKind?: unknown }).strategyKind;
      if (
        strategyKind !== "COMPLETE_SET" &&
        strategyKind !== "EXHAUSTIVE_RANGE" &&
        strategyKind !== "SAME_CLAIM_CROSS_VENUE"
      ) {
        throw new Error("model hypothesis has an invalid strategy kind");
      }
      const normalizedStrategyKind: OpportunityHypothesis["strategyKind"] =
        strategyKind;
      const venueIds = (item as { venueIds: unknown[] }).venueIds;
      const claimSearchTerms = (item as { claimSearchTerms: unknown[] })
        .claimSearchTerms;
      const confidenceBps = (item as { confidenceBps: number }).confidenceBps;
      if (
        venueIds.length === 0 ||
        venueIds.length > 25 ||
        venueIds.some(
          (venueId) =>
            typeof venueId !== "string" ||
            venueId.trim() === "" ||
            venueId.length > 256,
        ) ||
        claimSearchTerms.length > 12 ||
        claimSearchTerms.some(
          (term) =>
            typeof term !== "string" || term.trim() === "" || term.length > 80,
        ) ||
        !Number.isSafeInteger(confidenceBps) ||
        confidenceBps < 0 ||
        confidenceBps > 10_000
      ) {
        throw new Error("model hypothesis exceeds its bounded contract");
      }
      return {
        thesis: (item as { thesis: string }).thesis.trim(),
        strategyKind: normalizedStrategyKind,
        venueIds: venueIds as string[],
        claimSearchTerms: claimSearchTerms as string[],
        confidenceBps,
      };
    },
  );
  return { hypotheses };
}

export class StructuredModelDiscoveryWorker implements DiscoveryWorker {
  public readonly kind = "MODEL" as const;
  public readonly costTier = "LOW" as const;

  public constructor(
    public readonly workerId: string,
    private readonly model: string,
    private readonly modelPort: AiModelPort,
  ) {}

  public async discover(
    task: DiscoveryTask,
  ): Promise<readonly OpportunityHypothesis[]> {
    const payload = parseModelPayload(
      await this.modelPort.completeStructured({
        model: this.model,
        schemaVersion: "pmh.discovery-output.v1",
        system:
          "Propose market-search hypotheses only. Never claim a verified " +
          "arbitrage, certificate, semantic equivalence, or execution authority.",
        task,
      }),
    );
    const allowedVenueIds = new Set(task.venueIds);
    return payload.hypotheses.slice(0, task.maxHypotheses).map((item, index) => ({
      hypothesisId: `hypothesis:${hashCanonical({
        workerId: this.workerId,
        taskId: task.taskId,
        index,
        item,
      }).slice(7, 23)}`,
      workerId: this.workerId,
      thesis: item.thesis,
      strategyKind: item.strategyKind,
      venueIds: Object.freeze(
        [...new Set(item.venueIds)].sort().map((venueId) => {
          if (!allowedVenueIds.has(venueId)) {
            throw new Error("model hypothesis references an out-of-scope venue");
          }
          return venueId;
        }),
      ),
      claimSearchTerms: Object.freeze(item.claimSearchTerms),
      confidenceBps: item.confidenceBps,
      authority: "PROPOSE_ONLY",
      reviewStatus: "UNREVIEWED",
    }));
  }
}

export class DiscoveryPool {
  public constructor(
    public readonly workers: readonly DiscoveryWorker[],
    private readonly now: () => number = Date.now,
  ) {
    if (workers.length === 0) {
      throw new Error("discovery pool requires at least one worker");
    }
  }

  public async run(task: DiscoveryTask): Promise<DiscoveryRun> {
    assertTask(task);
    const startedAtMs = this.now();
    if (startedAtMs > task.deadlineEpochMs) {
      throw new Error("discovery task deadline has expired");
    }
    const results = await Promise.allSettled(
      this.workers.map(async (worker) => ({
        worker,
        hypotheses: await worker.discover(task),
      })),
    );
    const diagnostics: string[] = [];
    const hypotheses = new Map<string, OpportunityHypothesis>();
    for (const result of results) {
      if (result.status === "rejected") {
        diagnostics.push(
          result.reason instanceof Error
            ? result.reason.message
            : "discovery worker failed",
        );
        continue;
      }
      for (const hypothesis of result.value.hypotheses) {
        assertHypothesis(hypothesis, result.value.worker.workerId, task);
        const identity = hashCanonical({
          thesis: hypothesis.thesis.trim().toLowerCase(),
          strategyKind: hypothesis.strategyKind,
          venueIds: [...hypothesis.venueIds].sort(),
        });
        if (!hypotheses.has(identity)) {
          hypotheses.set(identity, hypothesis);
        }
      }
    }
    const completedAtMs = this.now();
    return Object.freeze({
      runId: `run:${hashCanonical({
        taskId: task.taskId,
        startedAtMs,
        workerIds: this.workers.map((worker) => worker.workerId),
      }).slice(7)}`,
      taskId: task.taskId,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      workerIds: Object.freeze(
        this.workers.map((worker) => worker.workerId),
      ),
      hypotheses: Object.freeze(
        [...hypotheses.values()].slice(0, task.maxHypotheses),
      ),
      diagnostics: Object.freeze(diagnostics),
      executionAuthority: false,
    });
  }
}
