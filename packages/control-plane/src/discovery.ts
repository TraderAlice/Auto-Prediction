import { hashCanonical } from "@pmh/domain";
import { ModelRequestFailure, modelFailureTelemetry } from "./model-failure.js";
import type {
  DiscoveryAgentPort,
  DiscoveryAgentRunResult,
  DiscoveryFalsification,
  DiscoveryInspiration,
  DiscoveryRun,
  DiscoveryTask,
  DiscoveryWorker,
  OpportunityHypothesis,
} from "./types.js";
import {
  hasBoundedRulesEvidence,
  MAX_AGENT_RULE_CHARACTERS,
  MAX_CATALOG_CONTEXT_CHARACTERS,
} from "./catalog-discovery.js";
import { hasBoundedDiscoveryEvidenceLocators } from "./discovery-evidence-locator.js";

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

const DISCOVERY_RELATION_KINDS = new Set([
  "EQUIVALENT",
  "IMPLIES",
  "SUBSET",
  "MUTUALLY_EXCLUSIVE",
  "EXHAUSTIVE",
  "CONDITIONAL",
  "RELATED",
  "CONFLICTING",
]);

function compactWorkerDiagnostic(error: unknown): string {
  const value =
    error instanceof Error ? error.message : "discovery worker failed";
  const compacted = value.trim().replace(/\s+/gu, " ") ||
    "discovery worker failed";
  return compacted.length <= 500
    ? compacted
    : `${compacted.slice(0, 499).trimEnd()}…`;
}

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
    hasBoundedRulesEvidence(listing, MAX_AGENT_RULE_CHARACTERS) &&
    hasBoundedDiscoveryEvidenceLocators(listing) &&
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

export function assertDiscoveryTask(task: DiscoveryTask): void {
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
  if (task.searchAssignment !== undefined) {
    const assignment = task.searchAssignment;
    if (
      !["EQUIVALENCE", "IMPLICATION", "PARTITION", "MECHANISM"]
        .includes(assignment.lens) ||
      (assignment.semanticFamily !== null &&
        ![
          "TEMPORAL_IMPOSSIBILITY", "EVENT_CONTAINMENT",
          "PARTITION_COMPLETENESS", "IDENTITY_SUCCESSION",
          "PHYSICAL_CO_OCCURRENCE",
        ].includes(assignment.semanticFamily)) ||
      (assignment.sourceTrailheadIdentity !== null &&
        !/^sha256:[0-9a-f]{64}$/u.test(assignment.sourceTrailheadIdentity)) ||
      (assignment.inspirationDepth !== 0 && assignment.inspirationDepth !== 1)
    ) throw new Error("discovery search assignment is invalid or unbounded");
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
    (hypothesis.relationKind !== undefined &&
      !DISCOVERY_RELATION_KINDS.has(hypothesis.relationKind)) ||
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

function assertFalsification(
  falsification: DiscoveryFalsification,
  workerId: string,
  task: DiscoveryTask,
): void {
  const listingRefs = falsification.listingRefs;
  const allowedListingRefs = new Set(
    task.catalogContext?.listings.map((listing) => listing.listingRef) ?? [],
  );
  const { falsificationId: _falsificationId, ...body } = falsification;
  if (
    (falsification.schemaVersion !== "pmh.discovery-falsification.v1" &&
      falsification.schemaVersion !== "pmh.discovery-falsification.v2") ||
    falsification.falsificationId !== hashCanonical(body) ||
    (falsification.schemaVersion === "pmh.discovery-falsification.v2" &&
      falsification.findingIdentity !== hashCanonical({
        schemaVersion: "pmh.discovery-falsification-finding.v1",
        relationKind: falsification.relationKind,
        listingRefs,
      })) ||
    (falsification.schemaVersion === "pmh.discovery-falsification.v1" &&
      (falsification.findingIdentity !== undefined ||
        falsification.relationKind !== undefined)) ||
    falsification.workerId !== workerId ||
    falsification.taskId !== task.taskId ||
    falsification.claim.trim() === "" || falsification.claim.length > 500 ||
    falsification.reason.trim() === "" || falsification.reason.length > 500 ||
    (falsification.schemaVersion === "pmh.discovery-falsification.v2" &&
      !["EQUIVALENCE", "IMPLICATION", "MUTUAL_EXCLUSION", "EXHAUSTIVENESS", "MECHANISM"]
        .includes(String(falsification.relationKind))) ||
    listingRefs.length < 2 || listingRefs.length > 6 ||
    new Set(listingRefs).size !== listingRefs.length ||
    listingRefs.some((listingRef) =>
      listingRef.trim() === "" || !allowedListingRefs.has(listingRef)
    ) ||
    falsification.claimSearchTerms.length < 1 ||
    falsification.claimSearchTerms.length > 12 ||
    falsification.claimSearchTerms.some((term) =>
      term.trim() === "" || term.length > 80
    ) ||
    falsification.authority !== "SEARCH_NEGATIVE_EVIDENCE_ONLY" ||
    falsification.semanticDecisionAuthority !== false ||
    falsification.certificateAuthority !== false ||
    falsification.executionAuthority !== false ||
    falsification.externalWriteAuthority !== false ||
    falsification.valueMovingAuthority !== false
  ) {
    throw new Error(`worker ${workerId} returned an unsafe falsification`);
  }
}

function assertInspiration(
  inspiration: DiscoveryInspiration,
  workerId: string,
  task: DiscoveryTask,
): void {
  const assignment = task.searchAssignment;
  const allowedListingRefs = new Set(
    task.catalogContext?.listings.map((listing) => listing.listingRef) ?? [],
  );
  const { inspirationId: _inspirationId, ...body } = inspiration;
  const expectedContentIdentity = hashCanonical({
    schemaVersion: "pmh.discovery-inspiration-content.v1",
    listingRefs: inspiration.listingRefs,
    suggestedLens: inspiration.suggestedLens,
    suggestedSemanticFamily: inspiration.suggestedSemanticFamily,
    sourceTrailheadIdentity: inspiration.sourceTrailheadIdentity,
  });
  if (
    assignment === undefined || assignment.inspirationDepth >= 1 ||
    inspiration.schemaVersion !== "pmh.discovery-inspiration.v1" ||
    inspiration.inspirationId !== hashCanonical(body) ||
    inspiration.contentIdentity !== expectedContentIdentity ||
    inspiration.workerId !== workerId || inspiration.taskId !== task.taskId ||
    inspiration.observation.trim() === "" || inspiration.observation.length > 500 ||
    inspiration.listingRefs.length < 2 || inspiration.listingRefs.length > 6 ||
    new Set(inspiration.listingRefs).size !== inspiration.listingRefs.length ||
    inspiration.listingRefs.some((listingRef) => !allowedListingRefs.has(listingRef)) ||
    inspiration.searchSignals.length < 1 || inspiration.searchSignals.length > 8 ||
    inspiration.searchSignals.some((signal) => signal.trim() === "" || signal.length > 80) ||
    inspiration.sourceLens !== assignment.lens ||
    inspiration.sourceSemanticFamily !== assignment.semanticFamily ||
    inspiration.sourceTrailheadIdentity !== assignment.sourceTrailheadIdentity ||
    inspiration.inspirationDepth !== assignment.inspirationDepth ||
    (inspiration.suggestedLens === assignment.lens &&
      inspiration.suggestedSemanticFamily === assignment.semanticFamily) ||
    inspiration.authority !== "SEARCH_ROUTING_ONLY" ||
    inspiration.semanticDecisionAuthority !== false ||
    inspiration.probabilityAuthority !== false ||
    inspiration.certificateAuthority !== false ||
    inspiration.executionAuthority !== false ||
    inspiration.externalWriteAuthority !== false ||
    inspiration.valueMovingAuthority !== false
  ) throw new Error(`worker ${workerId} returned an unsafe inspiration`);
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
    if (task.catalogContext !== undefined && relevantListings.length < 2) {
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
    const unboundedThesis =
      listingRefs.length === 0
        ? `Search ${venueIds.join(", ")} for listings that may resolve ` +
          `to the same canonical claim: ${normalizedQuestion}`
        : `Review ${listingRefs.length} bounded catalog listings from ` +
          `${venueIds.join(", ")} as a possible ${strategyKind.toLowerCase().replaceAll("_", " ")} candidate for: ${normalizedQuestion}`;
    const thesis = unboundedThesis.length <= 500
      ? unboundedThesis
      : `${unboundedThesis.slice(0, 499).trimEnd()}…`;
    const identity = hashCanonical({
      workerId: this.workerId,
      normalizedQuestion,
      venueIds,
      listingRefs,
      strategyKind,
      relationKind: "RELATED",
    });
    return [
      Object.freeze({
        hypothesisId: `hypothesis:${identity.slice(7, 23)}`,
        workerId: this.workerId,
        thesis,
        strategyKind,
        relationKind: "RELATED" as const,
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

export class AgenticModelDiscoveryWorker implements DiscoveryWorker {
  public readonly kind = "MODEL" as const;
  public readonly costTier = "LOW" as const;

  public constructor(
    public readonly workerId: string,
    private readonly model: string,
    private readonly agentPort: DiscoveryAgentPort,
    private readonly searchLens?: string,
  ) {}

  public async runWithTrace(task: DiscoveryTask): Promise<DiscoveryAgentRunResult> {
    return this.agentPort.run({
      workerId: this.workerId,
      model: this.model,
      system:
        "Propose market-search hypotheses only. Never claim a verified " +
        "arbitrage, certificate, semantic equivalence, or execution authority.",
      ...(this.searchLens === undefined ? {} : { searchLens: this.searchLens }),
      task,
    });
  }

  public async discover(
    task: DiscoveryTask,
  ): Promise<readonly OpportunityHypothesis[]> {
    return (await this.runWithTrace(task)).hypotheses;
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

  public async run(
    task: DiscoveryTask,
    options: Readonly<{ maxModelWorkers?: number }> = {},
  ): Promise<DiscoveryRun> {
    assertDiscoveryTask(task);
    const maxModelWorkers = options.maxModelWorkers;
    if (
      maxModelWorkers !== undefined &&
      (!Number.isSafeInteger(maxModelWorkers) ||
        maxModelWorkers < 0 ||
        maxModelWorkers > 4)
    ) {
      throw new Error("discovery model worker budget must be an integer from 0 to 4");
    }
    let selectedModelWorkers = 0;
    const selectedWorkers = this.workers.filter((worker) => {
      if (worker.kind === "HEURISTIC") return true;
      if (
        maxModelWorkers !== undefined &&
        selectedModelWorkers >= maxModelWorkers
      ) return false;
      selectedModelWorkers += 1;
      return true;
    });
    if (selectedWorkers.length === 0) {
      throw new Error("discovery run requires at least one worker within budget");
    }
    const startedAtMs = this.now();
    if (startedAtMs > task.deadlineEpochMs) {
      throw new Error("discovery task deadline has expired");
    }
    const results = await Promise.all(
      selectedWorkers.map(async (worker) => {
        const workerStartedAtMs = this.now();
        try {
          const execution = worker.runWithTrace === undefined
            ? Object.freeze({
                hypotheses: await worker.discover(task),
                falsifications: Object.freeze([]),
                inspirations: Object.freeze([]),
                trace: undefined,
              })
            : await worker.runWithTrace(task);
          const hypotheses = execution.hypotheses;
          const falsifications = execution.falsifications;
          const inspirations = execution.inspirations;
          const workerCompletedAtMs = Math.max(this.now(), workerStartedAtMs);
          return {
            worker,
            hypotheses,
            falsifications,
            inspirations,
            report: Object.freeze({
              workerId: worker.workerId,
              kind: worker.kind,
              costTier: worker.costTier,
              status: "PASS" as const,
              startedAt: new Date(workerStartedAtMs).toISOString(),
              completedAt: new Date(workerCompletedAtMs).toISOString(),
              durationMs: workerCompletedAtMs - workerStartedAtMs,
              hypothesisCount: hypotheses.length,
              falsificationCount: falsifications.length,
              inspirationCount: inspirations.length,
              diagnostic: null,
              providerRequestAttemptCount:
                execution.trace?.providerRequestAttemptCount ??
                (worker.kind === "MODEL" ? 1 : 0),
              providerFailureCategory: null,
              ...(execution.trace === undefined
                ? {}
                : { agentTrace: execution.trace }),
            }),
          };
        } catch (error) {
          const workerCompletedAtMs = Math.max(this.now(), workerStartedAtMs);
          const diagnostic = compactWorkerDiagnostic(error);
          const providerTelemetry = modelFailureTelemetry(error, worker.kind);
          const agentTrace = ModelRequestFailure.isInstance(error)
            ? error.agentTrace
            : undefined;
          return {
            worker,
            hypotheses: Object.freeze([]),
            falsifications: Object.freeze([]),
            inspirations: Object.freeze([]),
            report: Object.freeze({
              workerId: worker.workerId,
              kind: worker.kind,
              costTier: worker.costTier,
              status: "FAILED" as const,
              startedAt: new Date(workerStartedAtMs).toISOString(),
              completedAt: new Date(workerCompletedAtMs).toISOString(),
              durationMs: workerCompletedAtMs - workerStartedAtMs,
              hypothesisCount: 0,
              falsificationCount: agentTrace?.acceptedFalsificationCount ?? 0,
              inspirationCount: agentTrace?.acceptedInspirationCount ?? 0,
              diagnostic,
              providerRequestAttemptCount:
                providerTelemetry.requestAttemptCount,
              providerFailureCategory: providerTelemetry.category,
              ...(agentTrace === undefined ? {} : { agentTrace }),
            }),
          };
        }
      }),
    );
    const diagnostics: string[] = [];
    const hypotheses = new Map<string, OpportunityHypothesis>();
    const falsifications = new Map<string, DiscoveryFalsification>();
    const inspirations = new Map<string, DiscoveryInspiration>();
    for (const result of results) {
      if (result.report.status === "FAILED") {
        diagnostics.push(result.report.diagnostic ?? "discovery worker failed");
        continue;
      }
      for (const hypothesis of result.hypotheses) {
        assertHypothesis(hypothesis, result.worker.workerId, task);
        const identity = hashCanonical({
          thesis: hypothesis.thesis.trim().toLowerCase(),
          strategyKind: hypothesis.strategyKind,
          relationKind: hypothesis.relationKind ?? null,
          venueIds: [...hypothesis.venueIds].sort(),
          listingRefs: [...(hypothesis.listingRefs ?? [])].sort(),
        });
        if (!hypotheses.has(identity)) {
          hypotheses.set(identity, hypothesis);
        }
      }
      for (const falsification of result.falsifications) {
        assertFalsification(falsification, result.worker.workerId, task);
        if (!falsifications.has(falsification.falsificationId)) {
          falsifications.set(falsification.falsificationId, falsification);
        }
      }
      for (const inspiration of result.inspirations) {
        assertInspiration(inspiration, result.worker.workerId, task);
        if (!inspirations.has(inspiration.contentIdentity)) {
          inspirations.set(inspiration.contentIdentity, inspiration);
        }
      }
    }
    const completedAtMs = this.now();
    return Object.freeze({
      runId: `run:${hashCanonical({
        taskId: task.taskId,
        startedAtMs,
        workerIds: selectedWorkers.map((worker) => worker.workerId),
      }).slice(7)}`,
      taskId: task.taskId,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      workerIds: Object.freeze(
        selectedWorkers.map((worker) => worker.workerId),
      ),
      workerReports: Object.freeze(results.map((result) => result.report)),
      hypotheses: Object.freeze(
        [...hypotheses.values()].slice(0, task.maxHypotheses),
      ),
      falsifications: Object.freeze([...falsifications.values()]),
      inspirations: Object.freeze([...inspirations.values()]),
      diagnostics: Object.freeze(diagnostics),
      executionAuthority: false,
    });
  }
}
