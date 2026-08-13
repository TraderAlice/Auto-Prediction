import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  ResearchAttentionAllocationProjection,
  ResearchAttentionNoveltyReason,
} from "./research-attention-allocation.js";
import type {
  ResearchDecisionEpisode,
  ResearchDecisionOutcome,
  ResearchDecisionOutcomeProjection,
} from "./research-decision-outcomes.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_SIGNALS = 512;
const COSTLY_NO_MOVEMENT_TOKEN_FLOOR = 50_000n;
const NOVELTY_REASONS: readonly ResearchAttentionNoveltyReason[] = Object.freeze([
  "NEW_STABLE_FAMILY",
  "WORK_ARTIFACT_CHANGED",
  "CORPUS_REVISION_ONLY",
  "DOWNSTREAM_RESEARCH_DEBT",
  "MISSING_COUNTEREXAMPLE",
  "PORTFOLIO_EXHAUSTED",
  "NO_BOUNDED_NOVELTY",
]);
const OUTCOME_STATES: readonly ResearchDecisionOutcome["state"][] = Object.freeze([
  "UNACTED_READY",
  "IN_FLIGHT",
  "ADVANCED",
  "USEFUL_NEGATIVE_MEMORY",
  "SPENT_WITHOUT_MOVEMENT",
  "REGRESSED_OR_RESCOPED",
  "TERMINAL_HOLD",
  "ATTRIBUTION_INCOMPLETE",
]);

export type DiscoverySignalKind =
  | "CAMPAIGN_MEMBERSHIP_ADDED"
  | "STRUCTURED_OUTCOME"
  | "REPEATED_COSTLY_NO_MOVEMENT"
  | "PORTFOLIO_EXHAUSTED";

export type DiscoverySignalRecord = Readonly<{
  schemaVersion: "pmh.discovery-signal.v1";
  signalId: Hash;
  dedupeIdentity: Hash;
  kind: DiscoverySignalKind;
  status: "UNREAD" | "READ";
  severity: "INFO" | "ATTENTION" | "WARNING";
  title: string;
  summary: string;
  observedAt: string;
  readAt: string | null;
  workItemId: Hash | null;
  episodeId: Hash | null;
  allocationActionId: Hash | null;
  outcomeState: ResearchDecisionOutcome["state"] | null;
  noveltyReason: ResearchAttentionNoveltyReason | null;
  artifactRefs: readonly Hash[];
  knownTokenDelta: string;
  authority: "DISCOVERY_SIGNAL_ONLY";
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  campaignsActivated: 0;
  runsStarted: 0;
  automaticDispatch: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface DiscoverySignalStore {
  loadDiscoverySignalRecords(limit: number): readonly DiscoverySignalRecord[];
  loadDiscoverySignalRecord(signalId: Hash): DiscoverySignalRecord | null;
  saveDiscoverySignalRecord(record: DiscoverySignalRecord): DiscoverySignalRecord;
}

export type DiscoverySignalProjection = Readonly<{
  schemaVersion: "pmh.discovery-signal-projection.v1";
  projectionIdentity: Hash;
  observedAt: string;
  signalCount: number;
  unreadCount: number;
  kindCounts: Readonly<Record<DiscoverySignalKind, number>>;
  signals: readonly DiscoverySignalRecord[];
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DISCOVERY_SIGNAL_ONLY";
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

type SignalCandidate = Omit<DiscoverySignalRecord,
  "signalId" | "dedupeIdentity" | "status" | "readAt"> & Readonly<{
    dedupeSource: unknown;
  }>;

function signal(candidate: SignalCandidate): DiscoverySignalRecord {
  const dedupeIdentity = hashCanonical({
    schemaVersion: "pmh.discovery-signal-dedupe.v1",
    kind: candidate.kind,
    source: candidate.dedupeSource,
  });
  const { dedupeSource: _dedupeSource, ...body } = candidate;
  return assertDiscoverySignalRecord(Object.freeze({
    ...body,
    signalId: hashCanonical({
      schemaVersion: "pmh.discovery-signal-id.v1",
      dedupeIdentity,
    }),
    dedupeIdentity,
    status: "UNREAD" as const,
    readAt: null,
  }));
}

function common(input: Readonly<{
  kind: DiscoverySignalKind;
  severity: DiscoverySignalRecord["severity"];
  title: string;
  summary: string;
  observedAt: string;
  workItemId: Hash | null;
  episodeId: Hash | null;
  allocationActionId: Hash | null;
  outcomeState: ResearchDecisionOutcome["state"] | null;
  noveltyReason: ResearchAttentionNoveltyReason | null;
  artifactRefs: readonly Hash[];
  knownTokenDelta: string;
  dedupeSource: unknown;
}>): SignalCandidate {
  return Object.freeze({
    schemaVersion: "pmh.discovery-signal.v1" as const,
    ...input,
    artifactRefs: Object.freeze([...new Set(input.artifactRefs)].sort()),
    authority: "DISCOVERY_SIGNAL_ONLY" as const,
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    campaignsActivated: 0 as const,
    runsStarted: 0 as const,
    automaticDispatch: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
}

function knownTokens(outcome: ResearchDecisionOutcome): bigint {
  return BigInt(outcome.costDelta.knownInputTokens) +
    BigInt(outcome.costDelta.knownOutputTokens) +
    BigInt(outcome.costDelta.knownReasoningTokens);
}

export function deriveDiscoverySignals(input: Readonly<{
  observedAt: string;
  episodes: readonly ResearchDecisionEpisode[];
  outcomes: ResearchDecisionOutcomeProjection;
  allocation: ResearchAttentionAllocationProjection;
}>): readonly DiscoverySignalRecord[] {
  if (!Number.isFinite(Date.parse(input.observedAt))) {
    throw new Error("discovery signal observation time is invalid");
  }
  const outcomesByEpisode = new Map(input.outcomes.outcomes.map((item) =>
    [item.episodeId, item] as const
  ));
  const candidates: SignalCandidate[] = [];
  for (const episode of input.episodes) {
    if (episode.captureRef.startsWith("agent-campaign:")) {
      candidates.push(common({
        kind: "CAMPAIGN_MEMBERSHIP_ADDED",
        severity: "INFO",
        title: "New semantic neighborhood entered the discovery lineage",
        summary: `${episode.noveltyReason.replaceAll("_", " ")} authorized one exact task membership; no signal read can activate it.`,
        observedAt: episode.capturedAt,
        workItemId: episode.workItemId,
        episodeId: episode.episodeId,
        allocationActionId: episode.allocationActionId,
        outcomeState: null,
        noveltyReason: episode.noveltyReason,
        artifactRefs: episode.baseline.exactTargetArtifactRefs,
        knownTokenDelta: "0",
        dedupeSource: episode.episodeId,
      }));
    }
    const outcome = outcomesByEpisode.get(episode.episodeId);
    if (outcome === undefined) continue;
    const negativeDelta = outcome.antiLoopMemory.newCounterexampleCount +
      outcome.antiLoopMemory.newNoFindingTerminalRunCount;
    if ((outcome.state === "ADVANCED" && outcome.newArtifactRefs.length > 0) ||
        (outcome.state === "USEFUL_NEGATIVE_MEMORY" && negativeDelta > 0)) {
      candidates.push(common({
        kind: "STRUCTURED_OUTCOME",
        severity: "ATTENTION",
        title: outcome.state === "USEFUL_NEGATIVE_MEMORY"
          ? "Discovery retained reusable negative memory"
          : "Discovery advanced to a new evidence state",
        summary: outcome.state === "USEFUL_NEGATIVE_MEMORY"
          ? `${outcome.antiLoopMemory.newCounterexampleCount} counterexample and ${outcome.antiLoopMemory.newNoFindingTerminalRunCount} terminal no-yield memories were added.`
          : `${outcome.newArtifactRefs.length} exact downstream artifacts were added to the selected lineage.`,
        observedAt: input.observedAt,
        workItemId: outcome.workItemId,
        episodeId: outcome.episodeId,
        allocationActionId: outcome.allocationActionId,
        outcomeState: outcome.state,
        noveltyReason: outcome.noveltyReason,
        artifactRefs: outcome.newArtifactRefs,
        knownTokenDelta: knownTokens(outcome).toString(),
        dedupeSource: {
          episodeId: outcome.episodeId,
          state: outcome.state,
          artifacts: outcome.newArtifactRefs,
          newCounterexampleCount: outcome.antiLoopMemory.newCounterexampleCount,
          newNoFindingTerminalRunCount:
            outcome.antiLoopMemory.newNoFindingTerminalRunCount,
          newSuccessfulWithoutAcceptedResultCount:
            outcome.antiLoopMemory.newSuccessfulWithoutAcceptedResultCount,
        },
      }));
    }
  }
  const spentByWork = new Map<Hash, ResearchDecisionOutcome[]>();
  for (const outcome of input.outcomes.outcomes) {
    if (outcome.state !== "SPENT_WITHOUT_MOVEMENT" || outcome.workItemId === null ||
        knownTokens(outcome) < COSTLY_NO_MOVEMENT_TOKEN_FLOOR) continue;
    const retained = spentByWork.get(outcome.workItemId) ?? [];
    retained.push(outcome);
    spentByWork.set(outcome.workItemId, retained);
  }
  for (const [workItemId, outcomes] of spentByWork) {
    if (outcomes.length < 2) continue;
    const episodeIds = outcomes.map((item) => item.episodeId).sort();
    const tokens = outcomes.reduce((sum, item) => sum + knownTokens(item), 0n);
    candidates.push(common({
      kind: "REPEATED_COSTLY_NO_MOVEMENT",
      severity: "WARNING",
      title: "Repeated Agent spend produced no evidence-stage movement",
      summary: `${outcomes.length} attributable decisions spent ${tokens} known tokens without advancing this stable family.`,
      observedAt: input.observedAt,
      workItemId,
      episodeId: outcomes.at(-1)?.episodeId ?? null,
      allocationActionId: outcomes.at(-1)?.allocationActionId ?? null,
      outcomeState: "SPENT_WITHOUT_MOVEMENT",
      noveltyReason: outcomes.at(-1)?.noveltyReason ?? null,
      artifactRefs: outcomes.flatMap((item) => item.newArtifactRefs),
      knownTokenDelta: tokens.toString(),
      dedupeSource: { workItemId, episodeIds },
    }));
  }
  for (const action of input.allocation.portfolio.filter((item) =>
    item.kind === "PROPOSE_ONTOLOGY_MUTATION" &&
    item.noveltyReason === "PORTFOLIO_EXHAUSTED"
  )) {
    candidates.push(common({
      kind: "PORTFOLIO_EXHAUSTED",
      severity: "ATTENTION",
      title: "The retained semantic portfolio is exhausted",
      summary: "No bounded successor work differs enough from retained attempts; a materially different ontology thesis is due.",
      observedAt: input.allocation.observedAt,
      workItemId: null,
      episodeId: null,
      allocationActionId: action.actionId,
      outcomeState: null,
      noveltyReason: action.noveltyReason,
      artifactRefs: action.targetArtifactRefs,
      knownTokenDelta: "0",
      dedupeSource: action.actionId,
    }));
  }
  return Object.freeze([...new Map(candidates.map((item) => {
    const record = signal(item);
    return [record.dedupeIdentity, record] as const;
  })).values()].sort((left, right) =>
    right.observedAt.localeCompare(left.observedAt) ||
    left.signalId.localeCompare(right.signalId)
  ));
}

export function buildDiscoverySignalProjection(input: Readonly<{
  observedAt: string;
  signals: readonly DiscoverySignalRecord[];
}>): DiscoverySignalProjection {
  const signals = Object.freeze(input.signals.map(assertDiscoverySignalRecord)
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt) ||
      left.signalId.localeCompare(right.signalId)).slice(0, MAX_SIGNALS));
  const kinds: readonly DiscoverySignalKind[] = Object.freeze([
    "CAMPAIGN_MEMBERSHIP_ADDED", "STRUCTURED_OUTCOME",
    "REPEATED_COSTLY_NO_MOVEMENT", "PORTFOLIO_EXHAUSTED",
  ]);
  const body = Object.freeze({
    schemaVersion: "pmh.discovery-signal-projection.v1" as const,
    observedAt: input.observedAt,
    signalCount: signals.length,
    unreadCount: signals.filter((item) => item.status === "UNREAD").length,
    kindCounts: Object.freeze(Object.fromEntries(kinds.map((kind) =>
      [kind, signals.filter((item) => item.kind === kind).length]
    )) as Record<DiscoverySignalKind, number>),
    signals,
    providerRequestsStartedByRead: 0 as const,
    modelInvocationsStartedByRead: 0 as const,
    writesStartedByRead: 0 as const,
    automaticDispatch: false as const,
    authority: "DISCOVERY_SIGNAL_ONLY" as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}

export function acknowledgeDiscoverySignal(
  record: DiscoverySignalRecord,
  readAt: string,
): DiscoverySignalRecord {
  assertDiscoverySignalRecord(record);
  if (!Number.isFinite(Date.parse(readAt))) throw new Error("signal read time is invalid");
  return assertDiscoverySignalRecord(Object.freeze({
    ...record,
    status: "READ" as const,
    readAt,
  }));
}

export function assertDiscoverySignalRecord(value: unknown): DiscoverySignalRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("discovery signal is malformed");
  }
  const item = value as DiscoverySignalRecord;
  if (item.schemaVersion !== "pmh.discovery-signal.v1" ||
      !HASH_PATTERN.test(String(item.signalId)) ||
      !HASH_PATTERN.test(String(item.dedupeIdentity)) ||
      !["CAMPAIGN_MEMBERSHIP_ADDED", "STRUCTURED_OUTCOME",
        "REPEATED_COSTLY_NO_MOVEMENT", "PORTFOLIO_EXHAUSTED"].includes(item.kind) ||
      !["UNREAD", "READ"].includes(item.status) ||
      !["INFO", "ATTENTION", "WARNING"].includes(item.severity) ||
      typeof item.title !== "string" || item.title.length < 1 || item.title.length > 160 ||
      typeof item.summary !== "string" || item.summary.length < 1 || item.summary.length > 500 ||
      !Number.isFinite(Date.parse(String(item.observedAt))) ||
      (item.status === "READ") !== (item.readAt !== null) ||
      (item.readAt !== null && !Number.isFinite(Date.parse(item.readAt))) ||
      (item.noveltyReason !== null && !NOVELTY_REASONS.includes(item.noveltyReason)) ||
      (item.outcomeState !== null && !OUTCOME_STATES.includes(item.outcomeState)) ||
      [item.workItemId, item.episodeId, item.allocationActionId].some((id) =>
        id !== null && !HASH_PATTERN.test(String(id))) ||
      !Array.isArray(item.artifactRefs) || item.artifactRefs.length > 512 ||
      item.artifactRefs.some((id) => !HASH_PATTERN.test(String(id))) ||
      new Set(item.artifactRefs).size !== item.artifactRefs.length ||
      item.artifactRefs.join("\n") !== [...item.artifactRefs].sort().join("\n") ||
      !/^(0|[1-9][0-9]*)$/u.test(String(item.knownTokenDelta)) ||
      item.authority !== "DISCOVERY_SIGNAL_ONLY" || item.providerRequestsStarted !== 0 ||
      item.modelInvocationsStarted !== 0 || item.campaignsActivated !== 0 ||
      item.runsStarted !== 0 || item.automaticDispatch !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false ||
      item.signalId !== hashCanonical({
        schemaVersion: "pmh.discovery-signal-id.v1",
        dedupeIdentity: item.dedupeIdentity,
      })) {
    throw new Error("discovery signal violates its bounded contract");
  }
  return Object.freeze(item);
}
