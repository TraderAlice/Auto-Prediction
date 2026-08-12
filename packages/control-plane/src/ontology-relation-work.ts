import { hashCanonical, type Hash } from "@pmh/domain";
import type { AgentExecutionSnapshot } from "./agent-execution-substrate.js";
import type { MarketRelationKind } from "./market-archaeologist.js";
import {
  assertMarketOntologyAgentProposal,
  type MarketOntologyAgentProposal,
  type MarketOntologyListingBinding,
} from "./market-ontology-agent-tools.js";
import {
  assertOntologySearchIssueRevision,
  type OntologySearchIssueRevision,
} from "./ontology-search-ecology.js";
import type { MarketOntologyTrailhead } from "./market-ontology.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ISSUE_PROVENANCE_PREFIX = "ontology-issue:";
const MAX_WORK_ITEMS = 200;

export type OntologyRelationWorkKind =
  | "WORLD_PROPOSITION_NEIGHBORHOOD"
  | "ENTITY_ALIAS_NEIGHBORHOOD"
  | "COUNTEREXAMPLE_MEMORY";

export type OntologyRelationWorkDisposition =
  | "RUNNABLE_RESEARCH"
  | "NEGATIVE_EVIDENCE_ONLY"
  | "BLOCKED_MISSING_ISSUE_LINEAGE";

export type OntologyRelationWorkItem = Readonly<{
  schemaVersion: "pmh.ontology-relation-work.v1";
  workItemId: Hash;
  artifactHash: Hash;
  searchScopeIdentity: Hash;
  kind: OntologyRelationWorkKind;
  disposition: OntologyRelationWorkDisposition;
  sourceProposalIds: readonly Hash[];
  sourceAgentRunIds: readonly Hash[];
  sourceIssueIds: readonly Hash[];
  sourceIssueRevisionIds: readonly Hash[];
  sourceOntologyIdentities: readonly Hash[];
  sourceSnapshotIdentities: readonly Hash[];
  sourceRelationPatternIds: readonly Hash[];
  sourceTrailheadIds: readonly Hash[];
  sourceSelectionLanes: readonly MarketOntologyTrailhead["selectionLane"][];
  seedListingBindings: readonly MarketOntologyListingBinding[];
  title: string;
  question: string;
  searchSignals: readonly string[];
  candidateRelationKinds: readonly MarketRelationKind[];
  falsifiers: readonly string[];
  priority: 1 | 2 | 3 | 4 | 5;
  firstProposedAt: string;
  lastProposedAt: string;
  campaignEligible: boolean;
  automaticDispatch: false;
  authority: "RELATION_SEARCH_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type OntologyRelationWorkProjection = Readonly<{
  schemaVersion: "pmh.ontology-relation-work-projection.v1";
  projectionIdentity: Hash;
  sourceProposalCount: number;
  workItemCount: number;
  runnableResearchCount: number;
  negativeMemoryCount: number;
  blockedMissingLineageCount: number;
  consolidatedSourceProposalCount: number;
  proposalToWorkCoverageBps: number | null;
  runnableProposalCoverageBps: number | null;
  items: readonly OntologyRelationWorkItem[];
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
  authority: "RELATION_SEARCH_PROPOSAL_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const RELATION_ORDER = Object.freeze([
  "EQUIVALENT",
  "IMPLIES",
  "SUBSET",
  "MUTUALLY_EXCLUSIVE",
  "EXHAUSTIVE",
  "CONDITIONAL",
  "RELATED",
  "CONFLICTING",
] as const satisfies readonly MarketRelationKind[]);

const LANE_RELATIONS: Readonly<Record<
  MarketOntologyTrailhead["selectionLane"],
  readonly MarketRelationKind[]
>> = Object.freeze({
  CROSS_VENUE: Object.freeze([
    "EQUIVALENT", "IMPLIES", "CONDITIONAL", "CONFLICTING",
  ] as const satisfies readonly MarketRelationKind[]),
  WORLD_DIVERGENCE: Object.freeze([
    "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "CONDITIONAL", "RELATED", "CONFLICTING",
  ] as const satisfies readonly MarketRelationKind[]),
  SETTLEMENT_DIVERGENCE: Object.freeze([
    "EQUIVALENT", "CONDITIONAL", "CONFLICTING",
  ] as const satisfies readonly MarketRelationKind[]),
});

function compact(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function canonicalText(value: string): string {
  return compact(value).toLowerCase();
}

function uniqueStrings(values: readonly string[], maximum = Number.POSITIVE_INFINITY): readonly string[] {
  const seen = new Set<string>();
  const retained: string[] = [];
  for (const raw of values) {
    const value = compact(raw).slice(0, 240);
    const key = value.toLowerCase();
    if (value === "" || seen.has(key)) continue;
    seen.add(key);
    retained.push(value);
    if (retained.length >= maximum) break;
  }
  return Object.freeze(retained);
}

function uniqueHashes(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort());
}

function scopeFor(proposal: MarketOntologyAgentProposal): Readonly<{
  kind: OntologyRelationWorkKind;
  identity: Hash;
}> {
  const scope = proposal.kind === "WORLD_PROPOSITION"
    ? {
        kind: "WORLD_PROPOSITION_NEIGHBORHOOD" as const,
        subjectLabels: [...proposal.subjectLabels].map(canonicalText).sort(),
        predicate: canonicalText(proposal.predicate),
        timeScope: proposal.timeScope === null ? null : canonicalText(proposal.timeScope),
        parameters: [...proposal.parameters].map(canonicalText).sort(),
      }
    : proposal.kind === "ENTITY_ALIAS"
      ? {
          kind: "ENTITY_ALIAS_NEIGHBORHOOD" as const,
          canonicalLabel: canonicalText(proposal.canonicalLabel),
        }
      : {
          kind: "COUNTEREXAMPLE_MEMORY" as const,
          rejectedClaim: canonicalText(proposal.rejectedClaim),
          searchSignals: [...proposal.searchSignals].map(canonicalText).sort(),
        };
  return Object.freeze({ kind: scope.kind, identity: hashCanonical(scope) });
}

function issueIdByRun(execution: AgentExecutionSnapshot): ReadonlyMap<Hash, Hash> {
  const issueByTask = new Map<Hash, Hash>();
  for (const task of execution.tasks) {
    if (!task.provenanceRef.startsWith(ISSUE_PROVENANCE_PREFIX)) continue;
    const issueId = task.provenanceRef.slice(ISSUE_PROVENANCE_PREFIX.length) as Hash;
    if (HASH_PATTERN.test(issueId)) issueByTask.set(task.taskId, issueId);
  }
  return new Map(execution.runs.flatMap((run) => {
    const issueId = issueByTask.get(run.taskId);
    return issueId === undefined ? [] : [[run.runId, issueId] as const];
  }));
}

function revisionForProposal(
  proposal: MarketOntologyAgentProposal,
  issueId: Hash,
  revisions: readonly OntologySearchIssueRevision[],
): OntologySearchIssueRevision | null {
  return [...revisions]
    .filter((item) => item.issueId === issueId)
    .sort((left, right) =>
      Number(right.sourceSnapshotIdentity === proposal.sourceSnapshotIdentity) -
        Number(left.sourceSnapshotIdentity === proposal.sourceSnapshotIdentity) ||
      right.materializedAt.localeCompare(left.materializedAt) ||
      right.revisionId.localeCompare(left.revisionId)
    )[0] ?? null;
}

function relationKinds(
  kind: OntologyRelationWorkKind,
  lanes: readonly MarketOntologyTrailhead["selectionLane"][],
): readonly MarketRelationKind[] {
  const values = new Set<MarketRelationKind>();
  for (const lane of lanes) for (const relation of LANE_RELATIONS[lane]) values.add(relation);
  if (values.size === 0) {
    const fallback = kind === "ENTITY_ALIAS_NEIGHBORHOOD"
      ? ["EQUIVALENT", "IMPLIES", "CONDITIONAL", "CONFLICTING"] as const
      : kind === "COUNTEREXAMPLE_MEMORY"
        ? ["RELATED", "CONFLICTING"] as const
        : RELATION_ORDER;
    for (const relation of fallback) values.add(relation);
  }
  return Object.freeze(RELATION_ORDER.filter((item) => values.has(item)));
}

function signals(proposals: readonly MarketOntologyAgentProposal[]): readonly string[] {
  return uniqueStrings(proposals.flatMap((proposal) => {
    if (proposal.kind === "WORLD_PROPOSITION") {
      return [
        proposal.label,
        ...proposal.subjectLabels,
        proposal.predicate.replace(/_/gu, " "),
        ...(proposal.timeScope === null ? [] : [proposal.timeScope]),
        ...proposal.parameters,
      ];
    }
    if (proposal.kind === "ENTITY_ALIAS") {
      return [proposal.canonicalLabel, ...proposal.aliases];
    }
    return [proposal.rejectedClaim, ...proposal.searchSignals];
  }), 24);
}

function falsifiers(proposals: readonly MarketOntologyAgentProposal[]): readonly string[] {
  const values = uniqueStrings(proposals.flatMap((proposal) =>
    proposal.kind === "WORLD_PROPOSITION"
      ? [...proposal.falsifiers, ...proposal.ambiguityNotes]
      : proposal.kind === "ENTITY_ALIAS"
        ? [
            ...proposal.ambiguityNotes,
            "The labels refer to distinct people, organizations, offices, teams, or assets.",
          ]
        : [proposal.reason]
  ), 24);
  return values.length > 0
    ? values
    : Object.freeze(["Exact retained evidence does not support the proposed search scope."]);
}

function titleFor(proposal: MarketOntologyAgentProposal): string {
  if (proposal.kind === "WORLD_PROPOSITION") return `Relation neighborhood · ${proposal.label}`;
  if (proposal.kind === "ENTITY_ALIAS") return `Identity neighborhood · ${proposal.canonicalLabel}`;
  return `Negative ontology memory · ${proposal.rejectedClaim}`;
}

function questionFor(
  proposal: MarketOntologyAgentProposal,
  relations: readonly MarketRelationKind[],
  listingRefs: readonly string[],
): string {
  const refs = listingRefs.join(", ");
  if (proposal.kind === "COUNTEREXAMPLE") {
    return compact(
      `Retain the rejected ontology claim "${proposal.rejectedClaim}" as negative search ` +
      `evidence around ${refs}. Revisit only when source evidence or the bounded scope changes; ` +
      `do not treat this memory as a relation or launch it automatically.`,
    );
  }
  const seed = proposal.kind === "WORLD_PROPOSITION" ? proposal.label : proposal.canonicalLabel;
  return compact(
    `Search current prediction-market contracts around the unreviewed ontology seed ` +
    `"${seed}" for candidate relations ${relations.join(", ")}. Begin from exact seed refs ` +
    `${refs}; inspect current world, settlement, and traded facets before proposing any ` +
    `cross-listing relation. The seed and relation candidates are search hypotheses, not facts.`,
  );
}

function hashBody(item: Omit<OntologyRelationWorkItem, "artifactHash">): Hash {
  return hashCanonical(item);
}

export function assertOntologyRelationWorkItem(value: unknown): OntologyRelationWorkItem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ontology relation work item is malformed");
  }
  const item = value as OntologyRelationWorkItem;
  const { artifactHash, ...body } = item;
  const expectedWorkId = hashCanonical({
    schemaVersion: "pmh.ontology-relation-work-id.v1",
    searchScopeIdentity: item.searchScopeIdentity,
  });
  const arrays = [
    item.sourceProposalIds,
    item.sourceAgentRunIds,
    item.sourceIssueRevisionIds,
    item.sourceOntologyIdentities,
    item.sourceSnapshotIdentities,
    item.sourceRelationPatternIds,
    item.sourceTrailheadIds,
  ];
  if (
    item.schemaVersion !== "pmh.ontology-relation-work.v1" ||
    !HASH_PATTERN.test(String(item.workItemId)) || item.workItemId !== expectedWorkId ||
    !HASH_PATTERN.test(String(item.artifactHash)) || item.artifactHash !== hashBody(body) ||
    !HASH_PATTERN.test(String(item.searchScopeIdentity)) ||
    !["WORLD_PROPOSITION_NEIGHBORHOOD", "ENTITY_ALIAS_NEIGHBORHOOD",
      "COUNTEREXAMPLE_MEMORY"].includes(item.kind) ||
    !["RUNNABLE_RESEARCH", "NEGATIVE_EVIDENCE_ONLY",
      "BLOCKED_MISSING_ISSUE_LINEAGE"].includes(item.disposition) ||
    arrays.some((array) => !Array.isArray(array) || array.some((id) =>
      !HASH_PATTERN.test(String(id))) || new Set(array).size !== array.length) ||
    item.sourceProposalIds.length === 0 || item.sourceAgentRunIds.length === 0 ||
    !Array.isArray(item.sourceIssueIds) || item.sourceIssueIds.some((id) =>
      !HASH_PATTERN.test(String(id))) || new Set(item.sourceIssueIds).size !== item.sourceIssueIds.length ||
    !Array.isArray(item.sourceSelectionLanes) || item.sourceSelectionLanes.some((lane) =>
      !["CROSS_VENUE", "WORLD_DIVERGENCE", "SETTLEMENT_DIVERGENCE"].includes(lane)) ||
    new Set(item.sourceSelectionLanes).size !== item.sourceSelectionLanes.length ||
    !Array.isArray(item.seedListingBindings) || item.seedListingBindings.length === 0 ||
    item.seedListingBindings.length > 32 ||
    item.seedListingBindings.some((binding) => typeof binding.listingRef !== "string" ||
      ![binding.nodeId, binding.worldFacetId, binding.settlementFacetId, binding.tradedFacetId]
        .every((id) => HASH_PATTERN.test(String(id)))) ||
    typeof item.title !== "string" || item.title.trim() === "" || item.title.length > 240 ||
    typeof item.question !== "string" || item.question.trim() === "" || item.question.length > 2_000 ||
    !Array.isArray(item.searchSignals) || item.searchSignals.length === 0 ||
    item.searchSignals.length > 24 || item.searchSignals.some((signal) =>
      typeof signal !== "string" || signal.trim() === "" || signal.length > 240) ||
    !Array.isArray(item.candidateRelationKinds) || item.candidateRelationKinds.length === 0 ||
    item.candidateRelationKinds.some((kind) => !RELATION_ORDER.includes(kind)) ||
    !Array.isArray(item.falsifiers) || item.falsifiers.length === 0 ||
    item.falsifiers.length > 24 || item.falsifiers.some((item) =>
      typeof item !== "string" || item.trim() === "" || item.length > 240) ||
    ![1, 2, 3, 4, 5].includes(item.priority) ||
    Number.isNaN(Date.parse(item.firstProposedAt)) || Number.isNaN(Date.parse(item.lastProposedAt)) ||
    item.firstProposedAt > item.lastProposedAt ||
    item.campaignEligible !== (item.disposition === "RUNNABLE_RESEARCH") ||
    item.automaticDispatch !== false ||
    item.authority !== "RELATION_SEARCH_PROPOSAL_ONLY" ||
    item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
    item.certificateAuthority !== false || item.executionAuthority !== false ||
    item.externalWriteAuthority !== false || item.valueMovingAuthority !== false ||
    (item.disposition === "RUNNABLE_RESEARCH" &&
      (item.sourceIssueIds.length === 0 || item.sourceSelectionLanes.length === 0)) ||
    (item.kind === "COUNTEREXAMPLE_MEMORY" &&
      item.disposition !== "NEGATIVE_EVIDENCE_ONLY")
  ) throw new Error("ontology relation work item violates its bounded contract");
  return Object.freeze(item);
}

export function buildOntologyRelationWorkProjection(input: Readonly<{
  proposals: readonly MarketOntologyAgentProposal[];
  revisions: readonly OntologySearchIssueRevision[];
  execution: AgentExecutionSnapshot;
}>): OntologyRelationWorkProjection {
  const proposals = Object.freeze(input.proposals.map(assertMarketOntologyAgentProposal));
  const revisions = Object.freeze(input.revisions.map(assertOntologySearchIssueRevision));
  const runIssueIds = issueIdByRun(input.execution);
  const groups = new Map<Hash, MarketOntologyAgentProposal[]>();
  for (const proposal of proposals) {
    const scope = scopeFor(proposal);
    const values = groups.get(scope.identity) ?? [];
    values.push(proposal);
    groups.set(scope.identity, values);
  }
  const items = Object.freeze([...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_WORK_ITEMS).map(
    ([searchScopeIdentity, grouped]) => {
      const sorted = Object.freeze([...grouped].sort((left, right) =>
        left.proposedAt.localeCompare(right.proposedAt) ||
        left.proposalId.localeCompare(right.proposalId)
      ));
      const representative = sorted[0]!;
      const scope = scopeFor(representative);
      const lineage = sorted.map((proposal) => {
        const issueId = runIssueIds.get(proposal.sourceAgentRunId) ?? null;
        const revision = issueId === null
          ? null
          : revisionForProposal(proposal, issueId, revisions);
        return Object.freeze({ issueId, revision });
      });
      const issueIds = uniqueHashes(lineage.flatMap((item) =>
        item.issueId === null ? [] : [item.issueId]
      ));
      const lanes = Object.freeze([...new Set(lineage.flatMap((item) =>
        item.revision === null ? [] : [item.revision.selectionLane]
      ))].sort());
      const relations = relationKinds(scope.kind, lanes);
      const disposition: OntologyRelationWorkDisposition = scope.kind === "COUNTEREXAMPLE_MEMORY"
        ? "NEGATIVE_EVIDENCE_ONLY"
        : issueIds.length === 0 || lanes.length === 0
          ? "BLOCKED_MISSING_ISSUE_LINEAGE"
          : "RUNNABLE_RESEARCH";
      const bindings = Object.freeze([...new Map(sorted.flatMap((proposal) =>
        proposal.listingBindings.map((binding) => [
          `${binding.listingRef}:${binding.nodeId}:${binding.settlementFacetId}`,
          binding,
        ] as const)
      )).values()].sort((left, right) => left.listingRef.localeCompare(right.listingRef)));
      const relationWorkId = hashCanonical({
        schemaVersion: "pmh.ontology-relation-work-id.v1",
        searchScopeIdentity,
      });
      const sourceTimes = sorted.map((proposal) => proposal.proposedAt).sort();
      const body = Object.freeze({
        schemaVersion: "pmh.ontology-relation-work.v1" as const,
        workItemId: relationWorkId,
        searchScopeIdentity,
        kind: scope.kind,
        disposition,
        sourceProposalIds: uniqueHashes(sorted.map((item) => item.proposalId)),
        sourceAgentRunIds: uniqueHashes(sorted.map((item) => item.sourceAgentRunId)),
        sourceIssueIds: issueIds,
        sourceIssueRevisionIds: uniqueHashes(lineage.flatMap((item) =>
          item.revision === null ? [] : [item.revision.revisionId]
        )),
        sourceOntologyIdentities: uniqueHashes(sorted.map((item) => item.ontologyIdentity)),
        sourceSnapshotIdentities: uniqueHashes(sorted.map((item) => item.sourceSnapshotIdentity)),
        sourceRelationPatternIds: uniqueHashes(sorted.flatMap((item) =>
          item.sourceRelationPatternIds
        )),
        sourceTrailheadIds: uniqueHashes(sorted.flatMap((item) => item.sourceTrailheadIds)),
        sourceSelectionLanes: lanes,
        seedListingBindings: bindings,
        title: titleFor(representative).slice(0, 240),
        question: questionFor(
          representative,
          relations,
          bindings.map((item) => item.listingRef),
        ).slice(0, 2_000),
        searchSignals: signals(sorted),
        candidateRelationKinds: relations,
        falsifiers: falsifiers(sorted),
        priority: (scope.kind === "COUNTEREXAMPLE_MEMORY"
          ? 2
          : lanes.includes("WORLD_DIVERGENCE")
            ? 5
            : lanes.includes("CROSS_VENUE") ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
        firstProposedAt: sourceTimes[0]!,
        lastProposedAt: sourceTimes.at(-1)!,
        campaignEligible: disposition === "RUNNABLE_RESEARCH",
        automaticDispatch: false as const,
        authority: "RELATION_SEARCH_PROPOSAL_ONLY" as const,
        semanticDecisionAuthority: false as const,
        probabilityAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
        externalWriteAuthority: false as const,
        valueMovingAuthority: false as const,
      });
      return assertOntologyRelationWorkItem(Object.freeze({
        ...body,
        artifactHash: hashCanonical(body),
      }));
    },
  ).sort((left, right) =>
    right.priority - left.priority || left.workItemId.localeCompare(right.workItemId)
  ));
  const attributedProposalIds = new Set(items.flatMap((item) => item.sourceProposalIds));
  const runnableProposalIds = new Set(items.filter((item) => item.campaignEligible)
    .flatMap((item) => item.sourceProposalIds));
  const ratio = (count: number) => proposals.length === 0
    ? null
    : Math.floor((count * 10_000) / proposals.length);
  const body = Object.freeze({
    schemaVersion: "pmh.ontology-relation-work-projection.v1" as const,
    sourceProposalCount: proposals.length,
    workItemCount: items.length,
    runnableResearchCount: items.filter((item) => item.disposition === "RUNNABLE_RESEARCH").length,
    negativeMemoryCount: items.filter((item) =>
      item.disposition === "NEGATIVE_EVIDENCE_ONLY"
    ).length,
    blockedMissingLineageCount: items.filter((item) =>
      item.disposition === "BLOCKED_MISSING_ISSUE_LINEAGE"
    ).length,
    consolidatedSourceProposalCount: items.reduce(
      (sum, item) => sum + Math.max(0, item.sourceProposalIds.length - 1),
      0,
    ),
    proposalToWorkCoverageBps: ratio(attributedProposalIds.size),
    runnableProposalCoverageBps: ratio(runnableProposalIds.size),
    items,
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    automaticDispatch: false as const,
    authority: "RELATION_SEARCH_PROPOSAL_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, projectionIdentity: hashCanonical(body) });
}
