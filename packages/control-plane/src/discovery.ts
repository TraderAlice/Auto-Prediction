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
const MAX_CATALOG_CONTEXT_CHARACTERS = 50_000;

function hasBoundedCatalogListing(
  listing: NonNullable<DiscoveryTask["catalogContext"]>["listings"][number],
  allowedVenueIds: ReadonlySet<string>,
): boolean {
  return (
    listing.listingRef.trim() !== "" &&
    listing.listingRef.length <= 512 &&
    allowedVenueIds.has(listing.venueId) &&
    listing.venueInstrumentId.trim() !== "" &&
    listing.venueInstrumentId.length <= 256 &&
    listing.title.trim() !== "" &&
    listing.title.length <= 500 &&
    listing.description.length <= 800 &&
    listing.status.trim() !== "" &&
    listing.status.length <= 100 &&
    listing.mechanism.trim() !== "" &&
    listing.mechanism.length <= 100 &&
    (listing.closesAt === null || listing.closesAt.length <= 64) &&
    (listing.rulesText === null || listing.rulesText.length <= 1_200) &&
    (listing.sourceKind === "VERIFIED_FIXTURE" ||
      listing.sourceKind === "LIVE_OBSERVATION") &&
    !Number.isNaN(Date.parse(listing.sourceReceivedAt)) &&
    new Date(listing.sourceReceivedAt).toISOString() ===
      listing.sourceReceivedAt &&
    /^sha256:[0-9a-f]{64}$/.test(listing.sourceRawHash) &&
    listing.protocolIdentity.trim() !== "" &&
    listing.protocolIdentity.length <= 512 &&
    listing.outcomes.length >= 1 &&
    listing.outcomes.length <= 100 &&
    listing.outcomes.every(
      (outcome) =>
        outcome.label.trim() !== "" &&
        outcome.label.length <= 120 &&
        (outcome.indicativePrice === null ||
          outcome.indicativePrice.length <= 100),
    )
  );
}

function assertTask(task: DiscoveryTask): void {
  const allowedVenueIds = new Set(task.venueIds);
  if (
    task.taskId.trim() === "" ||
    task.taskId.length > 256 ||
    task.question.trim() === "" ||
    task.question.length > 500 ||
    task.venueIds.length === 0 ||
    task.venueIds.length > 25 ||
    allowedVenueIds.size !== task.venueIds.length ||
    task.venueIds.some(
      (venueId) => venueId.trim() === "" || venueId.length > 256,
    ) ||
    task.maxHypotheses < 1 ||
    task.maxHypotheses > 50 ||
    !Number.isSafeInteger(task.maxHypotheses) ||
    !Number.isSafeInteger(task.deadlineEpochMs)
  ) {
    throw new Error("discovery task is invalid or unbounded");
  }
  if (task.catalogContext !== undefined) {
    const context = task.catalogContext;
    const body = {
      schemaVersion: context.schemaVersion,
      source: context.source,
      contentPolicy: context.contentPolicy,
      listings: context.listings,
    };
    if (
      context.schemaVersion !== "pmh.discovery-catalog-context.v2" ||
      (context.source !== "VERIFIED_FIXTURE_CATALOGS" &&
        context.source !== "QUALIFIED_LIVE_OBSERVATIONS") ||
      context.contentPolicy !== "UNTRUSTED_VENUE_TEXT_DATA_ONLY" ||
      !/^sha256:[0-9a-f]{64}$/.test(context.contextIdentity) ||
      context.contextIdentity !== hashCanonical(body) ||
      context.listings.length > 30 ||
      JSON.stringify(context).length > MAX_CATALOG_CONTEXT_CHARACTERS ||
      new Set(context.listings.map((listing) => listing.listingRef)).size !==
        context.listings.length ||
      context.listings.some(
        (listing) => !hasBoundedCatalogListing(listing, allowedVenueIds),
      ) ||
      context.listings.some((listing) =>
        context.source === "VERIFIED_FIXTURE_CATALOGS"
          ? listing.sourceKind !== "VERIFIED_FIXTURE"
          : listing.sourceKind !== "LIVE_OBSERVATION",
      )
    ) {
      throw new Error("discovery catalog context is invalid or unbounded");
    }
  }
}

function assertHypothesis(
  hypothesis: OpportunityHypothesis,
  workerId: string,
  task: DiscoveryTask,
): void {
  const allowedVenueIds = new Set(task.venueIds);
  const allowedListingRefs = new Set(
    task.catalogContext?.listings.map((listing) => listing.listingRef) ?? [],
  );
  const listingRefs = hypothesis.listingRefs ?? [];
  const hypothesisVenueIds = new Set(hypothesis.venueIds);
  const referencedVenueIds = new Set(
    listingRefs
      .map((listingRef) =>
        task.catalogContext?.listings.find(
          (listing) => listing.listingRef === listingRef,
        )?.venueId,
      )
      .filter((venueId): venueId is string => venueId !== undefined),
  );
  if (
    hypothesis.workerId !== workerId ||
    hypothesis.authority !== "PROPOSE_ONLY" ||
    hypothesis.reviewStatus !== "UNREVIEWED" ||
    hypothesis.thesis.trim() === "" ||
    hypothesis.thesis.length > 500 ||
    hypothesis.venueIds.length === 0 ||
    hypothesisVenueIds.size !== hypothesis.venueIds.length ||
    hypothesis.venueIds.some(
      (venueId) => venueId.trim() === "" || !allowedVenueIds.has(venueId),
    ) ||
    hypothesis.claimSearchTerms.length > 12 ||
    hypothesis.claimSearchTerms.some(
      (term) => term.trim() === "" || term.length > 80,
    ) ||
    listingRefs.length > 20 ||
    (task.catalogContext !== undefined && listingRefs.length === 0) ||
    new Set(listingRefs).size !== listingRefs.length ||
    listingRefs.some(
      (listingRef) =>
        listingRef.trim() === "" ||
        (task.catalogContext === undefined
          ? listingRefs.length > 0
          : !allowedListingRefs.has(listingRef)),
    ) ||
    (task.catalogContext !== undefined &&
      (referencedVenueIds.size !== hypothesisVenueIds.size ||
        [...referencedVenueIds].some(
          (venueId) => !hypothesisVenueIds.has(venueId),
        ))) ||
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
    const claimSearchTerms = normalizedQuestion
      .toLowerCase()
      .split(/[^a-z0-9$%.°]+/u)
      .filter((term) => term.length >= 3 && !SEARCH_STOPWORDS.has(term))
      .slice(0, 8);
    const queryTerms = new Set(claimSearchTerms);
    const relevantListings =
      task.catalogContext?.listings.filter((listing) => {
        const listingTerms = new Set(
          `${listing.title} ${listing.description} ${listing.rulesText ?? ""}`
            .toLowerCase()
            .split(/[^a-z0-9$%.°]+/u)
            .filter((term) => term.length >= 3),
        );
        return [...queryTerms].some((term) => listingTerms.has(term));
      }) ?? [];
    if (task.catalogContext !== undefined && relevantListings.length === 0) {
      return [];
    }
    const titleGroups = new Map<string, typeof relevantListings>();
    for (const listing of relevantListings) {
      const baseTitle = listing.title.split(" — ")[0]?.trim().toLowerCase() ?? "";
      titleGroups.set(baseTitle, [
        ...(titleGroups.get(baseTitle) ?? []),
        listing,
      ]);
    }
    const groupedListings = [...titleGroups.values()].sort(
      (left, right) =>
        right.length - left.length ||
        (left[0]?.listingRef ?? "").localeCompare(right[0]?.listingRef ?? ""),
    )[0];
    const selectedListings =
      (groupedListings?.length ?? 0) >= 2
        ? groupedListings ?? []
        : relevantListings.slice(0, 6);
    const venueIds = [
      ...new Set(
        selectedListings.length > 0
          ? selectedListings.map((listing) => listing.venueId)
          : task.venueIds,
      ),
    ].sort();
    const strategyKind =
      venueIds.length >= 2 && selectedListings.length >= 2
        ? ("SAME_CLAIM_CROSS_VENUE" as const)
        : selectedListings.length >= 3
          ? ("EXHAUSTIVE_RANGE" as const)
          : ("COMPLETE_SET" as const);
    const listingRefs = selectedListings.map((listing) => listing.listingRef);
    const identity = hashCanonical({
      workerId: this.workerId,
      normalizedQuestion,
      venueIds,
      listingRefs,
      strategyKind,
    });
    return [
      Object.freeze({
        hypothesisId: `hypothesis:${identity.slice(7, 23)}`,
        workerId: this.workerId,
        thesis:
          listingRefs.length === 0
            ? `Search ${venueIds.join(", ")} for listings that may resolve ` +
              `to the same canonical claim: ${normalizedQuestion}`
            : `Review ${listingRefs.length} bounded catalog listings from ` +
              `${venueIds.join(", ")} as a possible ${strategyKind.toLowerCase().replaceAll("_", " ")} candidate for: ${normalizedQuestion}`,
        strategyKind,
        venueIds: Object.freeze(venueIds),
        claimSearchTerms: Object.freeze(claimSearchTerms),
        listingRefs: Object.freeze(listingRefs),
        confidenceBps: listingRefs.length === 0 ? 2_500 : 4_000,
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
    listingRefs: readonly string[];
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
        !Array.isArray((item as { listingRefs?: unknown }).listingRefs) ||
        typeof (item as { confidenceBps?: unknown }).confidenceBps !== "number" ||
        (item as { thesis: string }).thesis.trim() === "" ||
        (item as { thesis: string }).thesis.length > 500 ||
        Object.keys(item).length !== 6 ||
        ![
          "thesis",
          "strategyKind",
          "venueIds",
          "claimSearchTerms",
          "listingRefs",
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
      const listingRefs = (item as { listingRefs: unknown[] }).listingRefs;
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
        listingRefs.length > 20 ||
        listingRefs.some(
          (listingRef) =>
            typeof listingRef !== "string" ||
            listingRef.trim() === "" ||
            listingRef.length > 512,
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
        listingRefs: listingRefs as string[],
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
    const allowedListingRefs = new Set(
      task.catalogContext?.listings.map((listing) => listing.listingRef) ?? [],
    );
    const catalogVenueByListingRef = new Map(
      task.catalogContext?.listings.map((listing) => [
        listing.listingRef,
        listing.venueId,
      ]) ?? [],
    );
    return payload.hypotheses.slice(0, task.maxHypotheses).map((item, index) => {
      if (task.catalogContext !== undefined && item.listingRefs.length === 0) {
        throw new Error("model hypothesis is not grounded in a catalog listing");
      }
      const venueIds = [...new Set(item.venueIds)].sort().map((venueId) => {
        if (!allowedVenueIds.has(venueId)) {
          throw new Error("model hypothesis references an out-of-scope venue");
        }
        return venueId;
      });
      const listingRefs = [...new Set(item.listingRefs)]
        .sort()
        .map((listingRef) => {
          if (!allowedListingRefs.has(listingRef)) {
            throw new Error("model hypothesis references an out-of-scope listing");
          }
          return listingRef;
        });
      const referencedVenueIds = new Set(
        listingRefs.map((listingRef) =>
          catalogVenueByListingRef.get(listingRef),
        ),
      );
      if (
        task.catalogContext !== undefined &&
        (referencedVenueIds.size !== venueIds.length ||
          venueIds.some((venueId) => !referencedVenueIds.has(venueId)))
      ) {
        throw new Error("model hypothesis venue scope does not match its listings");
      }
      return {
        hypothesisId: `hypothesis:${hashCanonical({
          workerId: this.workerId,
          taskId: task.taskId,
          index,
          item,
        }).slice(7, 23)}`,
        workerId: this.workerId,
        thesis: item.thesis,
        strategyKind: item.strategyKind,
        venueIds: Object.freeze(venueIds),
        claimSearchTerms: Object.freeze(item.claimSearchTerms),
        listingRefs: Object.freeze(listingRefs),
        confidenceBps: item.confidenceBps,
        authority: "PROPOSE_ONLY",
        reviewStatus: "UNREVIEWED",
      };
    });
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
          listingRefs: [...(hypothesis.listingRefs ?? [])].sort(),
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
