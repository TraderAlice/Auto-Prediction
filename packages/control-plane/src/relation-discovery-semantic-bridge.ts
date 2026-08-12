import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildProposalEvidenceBundle,
  type DurableProposalEvidenceBundle,
  type MarketRelationKind,
  type MarketRelationProposal,
} from "./market-archaeologist.js";
import {
  assertRelationDiscoveryFinding,
  verifyRelationDiscoveryFindingEvidence,
  verifyRelationDiscoveryFindingEvidenceAgainstVerifiedCorpus,
  type RelationDiscoveryPositiveFinding,
} from "./relation-discovery-agent-tools.js";
import {
  assertRelationDiscoveryTaskRevision,
  relationDiscoveryRevisionWorkItem,
  type RelationDiscoveryTaskRevision,
} from "./relation-discovery-work.js";
import {
  assertMarketCorpusSnapshot,
  type MarketCorpusSnapshot,
} from "./market-corpus.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_SEMANTIC_REVIEW_ISSUES = 20;

export type RelationDiscoveryReviewLane =
  | "ONTOLOGY_ROUTING_ONLY"
  | "SEMANTIC_PAYOFF_REVIEW";

export function relationDiscoveryReviewLane(
  relationKind: MarketRelationKind,
): RelationDiscoveryReviewLane {
  switch (relationKind) {
    case "RELATED":
      return "ONTOLOGY_ROUTING_ONLY";
    case "EQUIVALENT":
    case "IMPLIES":
    case "SUBSET":
    case "MUTUALLY_EXCLUSIVE":
    case "EXHAUSTIVE":
    case "CONDITIONAL":
    case "CONFLICTING":
      return "SEMANTIC_PAYOFF_REVIEW";
    default: {
      const unsupported: never = relationKind;
      throw new Error(`unsupported relation discovery review kind: ${String(unsupported)}`);
    }
  }
}

export type RelationDiscoveryOrigin = Readonly<{
  schemaVersion: "pmh.relation-discovery-origin.v1";
  originId: Hash;
  workItemId: Hash;
  workArtifactHash: Hash;
  sourceOntologyProposalIds: readonly Hash[];
  sourceOntologyIssueIds: readonly Hash[];
  semanticReviewIssueIds: readonly Hash[];
  semanticReviewIssueIdsTruncated: boolean;
  relationDiscoveryTaskRevisionId: Hash;
  relationDiscoveryTaskId: Hash;
  relationDiscoveryRunId: Hash;
  relationDiscoveryFindingId: Hash;
  sourceCorpusSnapshotIdentity: Hash;
  sourceSetIdentity: Hash;
  recordedAt: string;
  authority: "LINEAGE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type RelationDiscoveryProposalCompilation = Readonly<{
  schemaVersion: "pmh.relation-discovery-proposal-compilation.v1";
  compilationId: Hash;
  origin: RelationDiscoveryOrigin;
  proposal: MarketRelationProposal;
  evidenceBundle: DurableProposalEvidenceBundle;
  priority: 1 | 2 | 3 | 4 | 5;
  admission: "SEMANTIC_REVIEW_CANDIDATE";
  authority: "PROPOSE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export function selectRelationDiscoverySemanticReviewCompilations(
  compilations: readonly RelationDiscoveryProposalCompilation[],
): readonly RelationDiscoveryProposalCompilation[] {
  return Object.freeze(compilations.filter((compilation) =>
    relationDiscoveryReviewLane(compilation.proposal.relationKind) ===
      "SEMANTIC_PAYOFF_REVIEW"
  ));
}

function canonicalIso(value: unknown, name: string): string {
  if (typeof value !== "string" || new Date(value).toISOString() !== value) {
    throw new Error(`${name} must be a canonical ISO timestamp`);
  }
  return value;
}

function sortedHashes(values: readonly Hash[]): readonly Hash[] {
  return Object.freeze([...new Set(values)].sort());
}

export function assertRelationDiscoveryOrigin(value: unknown): RelationDiscoveryOrigin {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("relation discovery origin is malformed");
  }
  const origin = value as RelationDiscoveryOrigin;
  const { originId, ...body } = origin;
  const hashLists = [
    origin.sourceOntologyProposalIds,
    origin.sourceOntologyIssueIds,
    origin.semanticReviewIssueIds,
  ];
  if (
    origin.schemaVersion !== "pmh.relation-discovery-origin.v1" ||
    ![originId, origin.workItemId, origin.workArtifactHash,
      origin.relationDiscoveryTaskRevisionId, origin.relationDiscoveryTaskId,
      origin.relationDiscoveryRunId, origin.relationDiscoveryFindingId,
      origin.sourceCorpusSnapshotIdentity, origin.sourceSetIdentity]
      .every((item) => HASH_PATTERN.test(String(item))) ||
    originId !== hashCanonical(body) ||
    hashLists.some((items) => !Array.isArray(items) || items.some((item) =>
      !HASH_PATTERN.test(String(item))) || new Set(items).size !== items.length ||
      [...items].sort().join("\n") !== items.join("\n")) ||
    origin.sourceOntologyProposalIds.length === 0 ||
    origin.sourceOntologyIssueIds.length === 0 ||
    origin.semanticReviewIssueIds.length === 0 ||
    origin.semanticReviewIssueIds.length > MAX_SEMANTIC_REVIEW_ISSUES ||
    origin.semanticReviewIssueIds.some((item) =>
      !origin.sourceOntologyIssueIds.includes(item)) ||
    origin.semanticReviewIssueIdsTruncated !==
      (origin.sourceOntologyIssueIds.length > origin.semanticReviewIssueIds.length) ||
    canonicalIso(origin.recordedAt, "relation discovery origin recordedAt") !==
      origin.recordedAt ||
    origin.authority !== "LINEAGE_ONLY" ||
    origin.semanticDecisionAuthority !== false || origin.probabilityAuthority !== false ||
    origin.certificateAuthority !== false || origin.executionAuthority !== false
  ) throw new Error("relation discovery origin violates its bounded contract");
  return Object.freeze(origin);
}

export function assertRelationDiscoveryProposalCompilation(
  value: unknown,
): RelationDiscoveryProposalCompilation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("relation discovery proposal compilation is malformed");
  }
  const compilation = value as RelationDiscoveryProposalCompilation;
  const origin = assertRelationDiscoveryOrigin(compilation.origin);
  const { compilationId, ...body } = compilation;
  if (
    compilation.schemaVersion !== "pmh.relation-discovery-proposal-compilation.v1" ||
    !HASH_PATTERN.test(String(compilationId)) || compilationId !== hashCanonical(body) ||
    compilation.evidenceBundle.proposalId !== compilation.proposal.proposalId ||
    compilation.evidenceBundle.proposal !== compilation.proposal ||
    compilation.evidenceBundle.proposalCorpusSnapshotIdentity !==
      origin.sourceCorpusSnapshotIdentity ||
    ![1, 2, 3, 4, 5].includes(compilation.priority) ||
    compilation.admission !== "SEMANTIC_REVIEW_CANDIDATE" ||
    compilation.authority !== "PROPOSE_ONLY" ||
    compilation.semanticDecisionAuthority !== false || compilation.probabilityAuthority !== false ||
    compilation.certificateAuthority !== false || compilation.executionAuthority !== false
  ) throw new Error("relation discovery proposal compilation violates its bounded contract");
  return Object.freeze(compilation);
}

export function compileRelationDiscoveryFindingForSemanticReview(input: Readonly<{
  finding: RelationDiscoveryPositiveFinding;
  taskRevision: RelationDiscoveryTaskRevision;
  corpus: MarketCorpusSnapshot;
  verifiedInput?: true;
}>): RelationDiscoveryProposalCompilation {
  const finding = input.verifiedInput === true
    ? input.finding
    : assertRelationDiscoveryFinding(input.finding);
  if (finding.kind !== "RELATION_HYPOTHESIS") {
    throw new Error("counterexamples cannot enter semantic review automatically");
  }
  const revision = assertRelationDiscoveryTaskRevision(input.taskRevision);
  const corpus = input.verifiedInput === true
    ? input.corpus
    : assertMarketCorpusSnapshot(input.corpus);
  if (input.verifiedInput !== true) {
    verifyRelationDiscoveryFindingEvidenceAgainstVerifiedCorpus(finding, corpus);
  }
  if (
    finding.sourceTaskId !== revision.task.taskId ||
    finding.workItemId !== revision.workItemId ||
    finding.workArtifactHash !== revision.workArtifactHash ||
    finding.sourceCorpusSnapshotIdentity !== revision.sourceCorpusSnapshotIdentity
  ) throw new Error("relation discovery finding and task revision lineage are inconsistent");

  const work = relationDiscoveryRevisionWorkItem(revision);
  const sourceOntologyProposalIds = sortedHashes(work.sourceProposalIds);
  const sourceOntologyIssueIds = sortedHashes(work.sourceIssueIds);
  const semanticReviewIssueIds = Object.freeze(
    sourceOntologyIssueIds.slice(0, MAX_SEMANTIC_REVIEW_ISSUES),
  );
  const originBody = Object.freeze({
    schemaVersion: "pmh.relation-discovery-origin.v1" as const,
    workItemId: finding.workItemId,
    workArtifactHash: finding.workArtifactHash,
    sourceOntologyProposalIds,
    sourceOntologyIssueIds,
    semanticReviewIssueIds,
    semanticReviewIssueIdsTruncated:
      sourceOntologyIssueIds.length > semanticReviewIssueIds.length,
    relationDiscoveryTaskRevisionId: revision.revisionId,
    relationDiscoveryTaskId: finding.sourceTaskId,
    relationDiscoveryRunId: finding.sourceAgentRunId,
    relationDiscoveryFindingId: finding.findingId,
    sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
    sourceSetIdentity: corpus.sourceSetIdentity,
    recordedAt: finding.recordedAt,
    authority: "LINEAGE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  const origin = assertRelationDiscoveryOrigin(Object.freeze({
    ...originBody,
    originId: hashCanonical(originBody),
  }));
  const proposalBody = Object.freeze({
    relationKind: finding.relationKind,
    listingRefs: Object.freeze([...finding.listingRefs]),
    statement: finding.statement,
    rationale: finding.rationale,
    falsifiers: Object.freeze([...finding.falsifiers]),
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  });
  const proposal = Object.freeze({
    proposalId: hashCanonical({
      corpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
      ...proposalBody,
    }),
    ...proposalBody,
  });
  const evidenceBundle = buildProposalEvidenceBundle(
    proposal,
    corpus,
    finding.sourceCorpusSnapshotIdentity,
  );
  const compilationBody = Object.freeze({
    schemaVersion: "pmh.relation-discovery-proposal-compilation.v1" as const,
    origin,
    proposal,
    evidenceBundle,
    priority: work.priority,
    admission: "SEMANTIC_REVIEW_CANDIDATE" as const,
    authority: "PROPOSE_ONLY" as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertRelationDiscoveryProposalCompilation(Object.freeze({
    ...compilationBody,
    compilationId: hashCanonical(compilationBody),
  }));
}

export function compileRelationDiscoveryFindingsForSemanticReview(input: Readonly<{
  findings: readonly RelationDiscoveryPositiveFinding[];
  taskRevisions: readonly RelationDiscoveryTaskRevision[];
  loadCorpus: (snapshotIdentity: Hash) => MarketCorpusSnapshot | null;
}>): readonly RelationDiscoveryProposalCompilation[] {
  const revisionLineageKey = (value: Readonly<{
    taskId: Hash;
    workItemId: Hash;
    workArtifactHash: Hash;
    sourceCorpusSnapshotIdentity: Hash;
  }>) => [
    value.taskId,
    value.workItemId,
    value.workArtifactHash,
    value.sourceCorpusSnapshotIdentity,
  ].join("\n");
  const revisions = new Map<string, RelationDiscoveryTaskRevision>();
  for (const item of input.taskRevisions) {
    const revision = assertRelationDiscoveryTaskRevision(item);
    const key = revisionLineageKey({
      taskId: revision.task.taskId,
      workItemId: revision.workItemId,
      workArtifactHash: revision.workArtifactHash,
      sourceCorpusSnapshotIdentity: revision.sourceCorpusSnapshotIdentity,
    });
    const prior = revisions.get(key);
    if (prior !== undefined && prior.revisionId !== revision.revisionId) {
      throw new Error("relation discovery finding task revision lineage is ambiguous");
    }
    revisions.set(key, revision);
  }
  const verifiedCorpusByIdentity = new Map<Hash, MarketCorpusSnapshot>();
  return Object.freeze(input.findings.map((candidate) => {
    const finding = assertRelationDiscoveryFinding(candidate);
    if (finding.kind !== "RELATION_HYPOTHESIS") {
      throw new Error("counterexamples cannot enter semantic review automatically");
    }
    const revision = revisions.get(revisionLineageKey({
      taskId: finding.sourceTaskId,
      workItemId: finding.workItemId,
      workArtifactHash: finding.workArtifactHash,
      sourceCorpusSnapshotIdentity: finding.sourceCorpusSnapshotIdentity,
    }));
    if (revision === undefined) {
      throw new Error("relation discovery finding exact task revision is unavailable");
    }
    let corpus = verifiedCorpusByIdentity.get(finding.sourceCorpusSnapshotIdentity) ?? null;
    if (corpus === null) {
      const loaded = input.loadCorpus(finding.sourceCorpusSnapshotIdentity);
      corpus = loaded === null ? null : assertMarketCorpusSnapshot(loaded);
      if (corpus !== null) {
        verifiedCorpusByIdentity.set(finding.sourceCorpusSnapshotIdentity, corpus);
      }
    }
    if (corpus === null) {
      throw new Error("relation discovery finding corpus is unavailable");
    }
    verifyRelationDiscoveryFindingEvidence(finding, corpus);
    return compileRelationDiscoveryFindingForSemanticReview({
      finding,
      taskRevision: revision,
      corpus,
      verifiedInput: true,
    });
  }).sort((left, right) =>
    left.proposal.proposalId.localeCompare(right.proposal.proposalId)
  ));
}
