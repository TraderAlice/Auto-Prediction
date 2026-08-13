import { type Hash } from "@pmh/domain";
import type {
  AgentRuntimeExecutionResult,
  AgentRuntimeToolDefinition,
  AgentToolHost,
  AgentToolHostContext,
} from "./agent-runtime-adapter.js";
import { searchMarketCorpus, type MarketCorpusSearchResult, type MarketCorpusSnapshot } from
  "./market-corpus.js";
import {
  buildWorldRelationExperiment,
  type SettlementProjection,
  type WorldRelationExperiment,
} from "./world-history-ontology.js";
import type { WorldRelationFrontierSeed } from "./world-history-ontology-adapter.js";

export const WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL =
  "WORLD_RELATION_EXPERIMENT_TOOLS_V1" as const;

type CounterworldOutcome = "REJECTED" | "SURVIVES" | "INCONCLUSIVE";
type TerminalDisposition = WorldRelationExperiment["terminalDisposition"];

type TerminalDraft = Readonly<{
  disposition: TerminalDisposition;
  rationale: string;
}>;

type ActiveCounterworld = Readonly<{
  description: string;
  truthByPredicateId: Readonly<Record<Hash, boolean>>;
  outcome: CounterworldOutcome | null;
  outcomeDescription: string | null;
}>;

const text = (maximum: number) => Object.freeze({
  type: "string", minLength: 1, maxLength: maximum,
});

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("world relation tool input must be an object");
  }
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join("\n") !== wanted.join("\n")) {
    throw new Error(`world relation tool fields mismatch; expected=${wanted.join(",")}; actual=${actual.join(",")}`);
  }
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const compact = value.trim().replace(/\s+/gu, " ");
  if (compact === "" || compact.length > maximum) {
    throw new Error(`${label} must contain 1..${maximum} characters`);
  }
  return compact;
}

const BASE_MANIFEST = Object.freeze([
  Object.freeze({
    name: "read_world_relation_context",
    description: "Read one exact predicate/relation frontier and bounded negative memory. Predicate identity, settlement projection, probability, and certificate authority remain first-party.",
    inputSchema: Object.freeze({ type: "object", additionalProperties: false, properties: {} }),
  }),
  Object.freeze({
    name: "open_world_relation_hypothesis",
    description: "Open one falsifiable experiment over the exact host-bound relation frontier.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: ["predictedConstraint", "supportingObservation", "falsifyingObservation", "rationale"],
      properties: {
        predictedConstraint: text(2_000), supportingObservation: text(2_000),
        falsifyingObservation: text(2_000), rationale: text(2_000),
      },
    }),
  }),
  Object.freeze({
    name: "search_world_relation_corpus",
    description: "Search a bounded exact corpus neighborhood. Search hits route evidence only and do not establish a relation.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: ["patterns", "syntax", "mode", "fields", "venueIds", "limit"],
      properties: {
        patterns: Object.freeze({ type: "array", minItems: 1, maxItems: 12,
          uniqueItems: true, items: text(500) }),
        syntax: Object.freeze({ enum: ["LITERAL", "REGEX"] }),
        mode: Object.freeze({ enum: ["ANY", "ALL"] }),
        fields: Object.freeze({ type: "array", minItems: 1, maxItems: 4,
          uniqueItems: true, items: Object.freeze({
            enum: ["title", "description", "rulesText", "outcomes"],
          }) }),
        venueIds: Object.freeze({ type: "array", minItems: 0, maxItems: 16,
          uniqueItems: true, items: text(160) }),
        limit: Object.freeze({ type: "integer", minimum: 1, maximum: 50 }),
      },
    }),
  }),
  Object.freeze({
    name: "close_world_relation_search",
    description: "Close heuristic neighborhood expansion after one or more searches. The host then exposes exact evidence inspection or bounded exhaustion.",
    inputSchema: Object.freeze({ type: "object", additionalProperties: false, properties: {} }),
  }),
  Object.freeze({
    name: "inspect_world_relation_listings",
    description: "Inspect exact listings returned by this experiment's search.",
    inputSchema: Object.freeze({ type: "object", additionalProperties: false,
      required: ["listingRefs"], properties: { listingRefs: { type: "array" } } }),
  }),
  Object.freeze({
    name: "select_active_counterworld",
    description: "Select one complete adverse world assignment to try to falsify. True and false predicate IDs must partition the exact host frontier.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: ["truePredicateIds", "falsePredicateIds", "description"],
      properties: {
        truePredicateIds: Object.freeze({ type: "array", uniqueItems: true }),
        falsePredicateIds: Object.freeze({ type: "array", uniqueItems: true }),
        description: text(2_000),
      },
    }),
  }),
  Object.freeze({
    name: "record_active_counterworld_outcome",
    description: "Test the host-bound adverse world. Supply only whether the counterworld was rejected, survived, or remains inconclusive; the host binds exact predicates and inspected evidence.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: ["outcome", "description"],
      properties: {
        outcome: Object.freeze({ enum: ["REJECTED", "SURVIVES", "INCONCLUSIVE"] }),
        description: text(2_000),
      },
    }),
  }),
  Object.freeze({
    name: "submit_world_relation_terminal",
    description: "Close the experiment with a bounded disposition. This is research memory, not a semantic or probability certificate.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: ["disposition", "rationale"],
      properties: {
        disposition: Object.freeze({
          enum: ["SUPPORTED_HARD", "SUPPORTED_PROBABILISTIC", "FALSIFIED", "EXHAUSTED", "UNRESOLVED"],
        }),
        rationale: text(3_000),
      },
    }),
  }),
] satisfies readonly AgentRuntimeToolDefinition[]);

export class WorldRelationExperimentAgentToolHost implements AgentToolHost {
  #contextRead = false;
  #hypothesis: Readonly<Record<string, string>> | null = null;
  readonly #searches: MarketCorpusSearchResult[] = [];
  readonly #searchedRefs = new Set<string>();
  #searchClosed = false;
  readonly #inspectedRefs = new Set<string>();
  #counterworld: ActiveCounterworld | null = null;
  #terminal: TerminalDraft | null = null;

  public constructor(
    public readonly frontier: WorldRelationFrontierSeed,
    public readonly corpus: MarketCorpusSnapshot,
    public readonly projections: readonly SettlementProjection[] = [],
    public readonly priorExperiments: readonly WorldRelationExperiment[] = [],
  ) {}

  public manifest(protocol: string): readonly AgentRuntimeToolDefinition[] {
    this.#protocol(protocol);
    const legal = new Set(this.completionRecoveryToolNames(protocol));
    const predicateIds = this.frontier.predicates.map((item) => item.predicateId).sort();
    const inspectable = [...this.#searchedRefs].filter((item) => !this.#inspectedRefs.has(item)).sort();
    return Object.freeze(BASE_MANIFEST.filter((item) => legal.has(item.name)).map((item) =>
      item.name === "inspect_world_relation_listings" ? Object.freeze({
        ...item,
        inputSchema: Object.freeze({
          type: "object", additionalProperties: false, required: ["listingRefs"],
          properties: Object.freeze({ listingRefs: Object.freeze({
            type: "array", minItems: 1, maxItems: Math.min(8, inspectable.length),
            uniqueItems: true, items: Object.freeze({ enum: Object.freeze(inspectable) }),
          }) }),
        }),
      }) : item.name === "select_active_counterworld" ? Object.freeze({
        ...item,
        inputSchema: Object.freeze({
          type: "object", additionalProperties: false,
          required: ["truePredicateIds", "falsePredicateIds", "description"],
          properties: Object.freeze({
            truePredicateIds: Object.freeze({ type: "array", minItems: 0,
              maxItems: predicateIds.length, uniqueItems: true,
              items: Object.freeze({ enum: Object.freeze(predicateIds) }) }),
            falsePredicateIds: Object.freeze({ type: "array", minItems: 0,
              maxItems: predicateIds.length, uniqueItems: true,
              items: Object.freeze({ enum: Object.freeze(predicateIds) }) }),
            description: text(2_000),
          }),
        }),
      }) : item
    ));
  }

  public manifestRefreshPolicy(protocol: string): "AFTER_ACCEPTED_EFFECT" {
    this.#protocol(protocol);
    return "AFTER_ACCEPTED_EFFECT";
  }

  public manifestRefreshCheckpoint(protocol: string): unknown {
    this.#protocol(protocol);
    return Object.freeze({
      schemaVersion: "pmh.world-relation-experiment-checkpoint.v1",
      frontierId: this.frontier.frontierId,
      currentTools: this.completionRecoveryToolNames(protocol),
      relationKind: this.frontier.relationKind,
      predicates: this.frontier.predicates.map((item) => ({
        predicateId: item.predicateId, semantic: item.semantic,
        epistemicPosture: item.epistemicPosture,
      })),
      hypothesis: this.#hypothesis,
      searchClosed: this.#searchClosed,
      searchCount: this.#searches.length,
      latestSearch: this.#searches.at(-1) ?? null,
      inspectedListings: [...this.#inspectedRefs].sort().map((listingRef) => {
        const listing = this.corpus.listings.find((item) => item.listingRef === listingRef)!;
        return { listingRef, title: listing.title, description: listing.description,
          rulesText: listing.rulesText, outcomes: listing.outcomes,
          sourceRawHash: listing.sourceRawHash, protocolIdentity: listing.protocolIdentity };
      }),
      counterworld: this.#counterworld,
      priorTerminalMemory: this.priorExperiments.slice(0, 8).map((item) => ({
        experimentId: item.experimentId,
        artifactHash: item.artifactHash,
        terminalDisposition: item.terminalDisposition,
        relationKind: item.relationKind,
        searchedNeighborhoodCount: item.searchNeighborhoods.length,
        counterworldResults: item.counterworlds.map((counterworld) => counterworld.result),
        rationale: item.rationale,
      })),
      authority: "FIRST_PARTY_STATE_ROUTING_CHECKPOINT_ONLY",
      semanticDecisionAuthority: false,
      probabilityAuthority: false,
      executionAuthority: false,
      valueMovingAuthority: false,
    });
  }

  public resultToolNames(protocol: string): readonly string[] {
    this.#protocol(protocol);
    return Object.freeze(["submit_world_relation_terminal"]);
  }

  public completionRecoveryToolNames(protocol: string): readonly string[] {
    this.#protocol(protocol);
    if (!this.#contextRead) return Object.freeze(["read_world_relation_context"]);
    if (this.#hypothesis === null) return Object.freeze(["open_world_relation_hypothesis"]);
    if (!this.#searchClosed) return this.#searches.length === 0
      ? Object.freeze(["search_world_relation_corpus"])
      : this.#searches.length < 8
        ? Object.freeze(["search_world_relation_corpus", "close_world_relation_search"])
        : Object.freeze(["close_world_relation_search"]);
    if (this.#searchedRefs.size === 0) return Object.freeze(["submit_world_relation_terminal"]);
    const inspectableCount = [...this.#searchedRefs]
      .filter((item) => !this.#inspectedRefs.has(item)).length;
    if (this.#inspectedRefs.size === 0) return Object.freeze(["inspect_world_relation_listings"]);
    if (this.#counterworld === null) return inspectableCount > 0
      ? Object.freeze(["inspect_world_relation_listings", "select_active_counterworld"])
      : Object.freeze(["select_active_counterworld"]);
    if (this.#counterworld.outcome === null) {
      return Object.freeze(["record_active_counterworld_outcome"]);
    }
    return Object.freeze(["submit_world_relation_terminal"]);
  }

  public terminalDraft(): TerminalDraft | null {
    return this.#terminal;
  }

  public inspectedListingRefs(): readonly string[] {
    return Object.freeze([...this.#inspectedRefs].sort());
  }

  public counterworld(): ActiveCounterworld | null {
    return this.#counterworld;
  }

  public searches(): readonly MarketCorpusSearchResult[] {
    return Object.freeze([...this.#searches]);
  }

  #protocol(protocol: string): void {
    if (protocol !== WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL) {
      throw new Error("world relation experiment tool protocol is unsupported");
    }
  }

  #accepted(output: unknown) {
    return Object.freeze({ status: "ACCEPTED" as const, output });
  }

  #rejected(diagnostic: string) {
    return Object.freeze({ status: "REJECTED" as const, output: Object.freeze({ diagnostic }) });
  }

  public async execute(context: AgentToolHostContext) {
    if (context.task.kind !== "WORLD_RELATION_EXPERIMENT" ||
        context.task.requestedEffectProtocol !== WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL ||
        context.executionProfile.toolPolicy.protocol !== WORLD_RELATION_EXPERIMENT_TOOL_PROTOCOL) {
      throw new Error("world relation experiment tool lineage is invalid");
    }
    if (!this.completionRecoveryToolNames(context.task.requestedEffectProtocol)
      .includes(context.toolName)) {
      throw new Error(`world relation tool ${context.toolName} is not legal in the current state`);
    }
    const input = object(context.input);
    if (context.toolName === "read_world_relation_context") {
      exactKeys(input, []);
      this.#contextRead = true;
      return this.#accepted(Object.freeze({
        schemaVersion: "pmh.world-relation-reasoning-context.v1",
        frontier: this.frontier,
        corpusSnapshotIdentity: this.corpus.snapshotIdentity,
        priorTerminalMemory: this.priorExperiments.slice(0, 8).map((item) => ({
          experimentId: item.experimentId,
          artifactHash: item.artifactHash,
          terminalDisposition: item.terminalDisposition,
          relationKind: item.relationKind,
          searchNeighborhoods: item.searchNeighborhoods,
          counterworlds: item.counterworlds.map((counterworld) => ({
            description: counterworld.description,
            result: counterworld.result,
          })),
          rationale: item.rationale,
        })),
        authority: "RELATION_EXPERIMENT_REASONING_INPUT_ONLY",
      }));
    }
    if (context.toolName === "open_world_relation_hypothesis") {
      exactKeys(input, ["predictedConstraint", "supportingObservation", "falsifyingObservation", "rationale"]);
      if (this.#hypothesis !== null) return this.#rejected("an experiment hypothesis is already active");
      this.#hypothesis = Object.freeze({
        predictedConstraint: boundedText(input.predictedConstraint, "predictedConstraint", 2_000),
        supportingObservation: boundedText(input.supportingObservation, "supportingObservation", 2_000),
        falsifyingObservation: boundedText(input.falsifyingObservation, "falsifyingObservation", 2_000),
        rationale: boundedText(input.rationale, "rationale", 2_000),
      });
      return this.#accepted(Object.freeze({ frontierId: this.frontier.frontierId,
        status: "ACTIVE", relationKind: this.frontier.relationKind }));
    }
    if (context.toolName === "search_world_relation_corpus") {
      exactKeys(input, ["patterns", "syntax", "mode", "fields", "venueIds", "limit"]);
      const result = searchMarketCorpus(this.corpus, input as unknown as Parameters<typeof searchMarketCorpus>[1]);
      this.#searches.push(result);
      result.hits.forEach((item) => this.#searchedRefs.add(item.listingRef));
      return this.#accepted(result);
    }
    if (context.toolName === "close_world_relation_search") {
      exactKeys(input, []);
      this.#searchClosed = true;
      return this.#accepted(Object.freeze({ searchCount: this.#searches.length,
        uniqueListingCount: this.#searchedRefs.size, status: "SEARCH_CLOSED" }));
    }
    if (context.toolName === "inspect_world_relation_listings") {
      exactKeys(input, ["listingRefs"]);
      const refs = Array.isArray(input.listingRefs) ? [...new Set(input.listingRefs)] : [];
      if (refs.length < 1 || refs.length > 8 || refs.some((item) =>
        typeof item !== "string" || !this.#searchedRefs.has(item)
      )) throw new Error("world relation inspection requires exact searched refs");
      const listings = refs.map((listingRef) => {
        const listing = this.corpus.listings.find((item) => item.listingRef === listingRef as string);
        if (listing === undefined) throw new Error("world relation inspected listing is unavailable");
        this.#inspectedRefs.add(listing.listingRef);
        return listing;
      });
      return this.#accepted(Object.freeze({ listings }));
    }
    if (context.toolName === "select_active_counterworld") {
      exactKeys(input, ["truePredicateIds", "falsePredicateIds", "description"]);
      const trueIds = Array.isArray(input.truePredicateIds) ? input.truePredicateIds : [];
      const falseIds = Array.isArray(input.falsePredicateIds) ? input.falsePredicateIds : [];
      if (![...trueIds, ...falseIds].every((item) => typeof item === "string")) {
        throw new Error("counterworld predicate IDs must be text");
      }
      const selected = [...trueIds, ...falseIds] as string[];
      const expected = this.frontier.predicates.map((item) => item.predicateId).sort();
      if (new Set(selected).size !== selected.length ||
          [...selected].sort().join("\n") !== expected.join("\n")) {
        throw new Error("counterworld truth assignment must partition every frontier predicate exactly once");
      }
      const trueSet = new Set(trueIds as Hash[]);
      this.#counterworld = Object.freeze({
        description: boundedText(input.description, "description", 2_000),
        truthByPredicateId: Object.freeze(Object.fromEntries(expected.map((predicateId) => [
          predicateId, trueSet.has(predicateId as Hash),
        ])) as Record<Hash, boolean>),
        outcome: null,
        outcomeDescription: null,
      });
      return this.#accepted(Object.freeze({
        stateId: expected.map((predicateId) => this.#counterworld!.truthByPredicateId[predicateId as Hash]
          ? "T" : "F").join(""),
        truthByPredicateId: this.#counterworld.truthByPredicateId,
        status: "ACTIVE_COUNTERWORLD_BOUND",
      }));
    }
    if (context.toolName === "record_active_counterworld_outcome") {
      exactKeys(input, ["outcome", "description"]);
      const outcome = input.outcome as CounterworldOutcome;
      if (!["REJECTED", "SURVIVES", "INCONCLUSIVE"].includes(outcome)) {
        throw new Error("world relation counterworld outcome is unsupported");
      }
      this.#counterworld = Object.freeze({ ...this.#counterworld!, outcome,
        outcomeDescription: boundedText(input.description, "description", 2_000) });
      return this.#accepted(Object.freeze({ outcome,
        adverseAssignmentBoundByHost: this.#counterworld.truthByPredicateId,
        evidenceBoundByHost: [...this.#inspectedRefs].sort() }));
    }
    if (context.toolName === "submit_world_relation_terminal") {
      exactKeys(input, ["disposition", "rationale"]);
      const disposition = input.disposition as TerminalDisposition;
      if (!["SUPPORTED_HARD", "SUPPORTED_PROBABILISTIC", "FALSIFIED", "EXHAUSTED", "UNRESOLVED"]
        .includes(disposition)) throw new Error("world relation terminal disposition is unsupported");
      if (this.#searchedRefs.size === 0 && disposition !== "EXHAUSTED") {
        return this.#rejected("an empty search can close only as EXHAUSTED");
      }
      if (this.#counterworld === null && disposition !== "EXHAUSTED") {
        return this.#rejected("a non-exhaustion terminal requires one counterworld outcome");
      }
      if (disposition === "SUPPORTED_HARD" && this.#counterworld?.outcome !== "REJECTED") {
        return this.#rejected("SUPPORTED_HARD requires the active counterworld to be rejected");
      }
      if (disposition === "SUPPORTED_PROBABILISTIC" && this.#counterworld?.outcome === "REJECTED") {
        return this.#rejected("SUPPORTED_PROBABILISTIC requires a surviving or inconclusive counterworld");
      }
      this.#terminal = Object.freeze({ disposition,
        rationale: boundedText(input.rationale, "rationale", 3_000) });
      return this.#accepted(Object.freeze({ disposition,
        authority: "WORLD_RELATION_TERMINAL_DRAFT_ONLY" }));
    }
    throw new Error("world relation experiment tool is unsupported");
  }
}

function tokenSum(
  values: readonly (string | null)[],
): string {
  return values.reduce<bigint>((sum, value) => sum + BigInt(value ?? "0"), 0n).toString();
}

export function compileWorldRelationExperimentFromRun(input: Readonly<{
  host: WorldRelationExperimentAgentToolHost;
  execution: AgentRuntimeExecutionResult;
}>): WorldRelationExperiment {
  const terminal = input.host.terminalDraft();
  if (terminal === null || input.execution.run.status !== "SUCCEEDED") {
    throw new Error("world relation experiment requires a successful terminal run");
  }
  const frontier = input.host.frontier;
  const counterworld = input.host.counterworld();
  const inspectedProjectionIds = input.host.projections.filter((item) =>
    input.host.inspectedListingRefs().includes(item.listing.listingRef)
  ).map((item) => item.projectionId);
  return buildWorldRelationExperiment({
    relationKind: frontier.relationKind,
    predicateArtifacts: frontier.predicates,
    antecedentPredicateIds: frontier.antecedentPredicateIds,
    consequentPredicateIds: frontier.consequentPredicateIds,
    latentPredicateIds: frontier.latentPredicateIds,
    temporalPosture: frontier.temporalPosture,
    adverseAssignments: terminal.disposition === "EXHAUSTED" || counterworld === null ? [] : [{
      truthByPredicateId: counterworld.truthByPredicateId,
      rationale: counterworld.description,
    }],
    searchNeighborhoods: [...new Set(input.host.searches()
      .map((item) => item.query.patterns.join(" ")))],
    inspectedProjectionIds,
    counterworlds: counterworld === null ? [] : [{
      description: `${counterworld.description} Test outcome: ${counterworld.outcomeDescription}`,
      truthByPredicateId: counterworld.truthByPredicateId,
      result: counterworld.outcome!,
      // A catalog response may be the one immutable raw source for many
      // listings. Bind that shared evidence once rather than treating repeated
      // listing-level references as malformed duplicate evidence.
      evidenceBindingHashes: [...new Set(input.host.inspectedListingRefs().map((listingRef) =>
        input.host.corpus.listings.find((item) => item.listingRef === listingRef)!.sourceRawHash as Hash
      ))],
    }],
    terminalDisposition: terminal.disposition,
    rationale: terminal.rationale,
    sourceAgentRunId: input.execution.run.runId,
    sourceToolEffectIds: input.execution.toolEffects.filter((item) =>
      item.status === "ACCEPTED"
    ).map((item) => item.effectId),
    invocationIds: input.execution.modelInvocations.map((item) => item.invocationId),
    usage: {
      inputTokens: tokenSum(input.execution.modelInvocations.map((item) => item.inputTokens)),
      outputTokens: tokenSum(input.execution.modelInvocations.map((item) => item.outputTokens)),
      reasoningTokens: tokenSum(input.execution.modelInvocations.map((item) => item.reasoningTokens)),
    },
    closedAt: input.execution.run.completedAt!,
  });
}
