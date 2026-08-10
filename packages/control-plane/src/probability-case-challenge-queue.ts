import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProbabilityCaseChallenge,
  assertProbabilityEstimationRunRecord,
  type ProbabilityCaseChallengeKind,
  type ProbabilityEstimationRunRecord,
  type ProbabilityEstimatorRole,
} from "./probability-estimation-agent.js";

export type ProbabilityCaseRepairItem = Readonly<{
  repairId: Hash;
  interpretationArtifactHash: Hash;
  proposalId: Hash;
  semanticConstraintArtifactHash: Hash;
  kind: ProbabilityCaseChallengeKind;
  stateIds: readonly string[];
  listingRefs: readonly string[];
  explanation: string;
  explanationVariants: readonly string[];
  expectedInterpretations: readonly string[];
  observedConflicts: readonly string[];
  evidenceHashes: readonly Hash[];
  challengeIds: readonly Hash[];
  runIds: readonly Hash[];
  roles: readonly ProbabilityEstimatorRole[];
  engines: readonly string[];
  status: "OPEN";
  nextAction: "NEW_SEMANTIC_REVIEW_REQUIRED";
  authority: "SEMANTIC_REPAIR_PRIORITY_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  executionAuthority: false;
}>;

export type ProbabilityCaseRepairQueue = Readonly<{
  schemaVersion: "pmh.probability-case-repair-queue.v1";
  contentHash: Hash;
  sourceRunCount: number;
  sourceChallengeCount: number;
  itemCount: number;
  items: readonly ProbabilityCaseRepairItem[];
  rankingContract: "ROLE_SUPPORT_DESC_THEN_REPAIR_ID";
  authority: "SEMANTIC_REPAIR_PRIORITY_ONLY";
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  probabilityCertificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    providerRequests: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function engineLabel(run: ProbabilityEstimationRunRecord): string {
  return run.engine === undefined
    ? `DEEPSEEK/${run.model}`
    : `${run.engine.provider}/${run.engine.model}/${run.engine.reasoningEffort ?? "none"}`;
}

function repairGroupId(challenge: ReturnType<typeof assertProbabilityCaseChallenge>): Hash {
  return hashCanonical({
    schemaVersion: "pmh.probability-case-repair-group.v1",
    interpretationArtifactHash: challenge.interpretationArtifactHash,
    kind: challenge.kind,
    stateIds: challenge.stateIds,
    listingRefs: challenge.listingRefs,
  });
}

export function buildProbabilityCaseRepairQueue(input: Readonly<{
  runs: readonly ProbabilityEstimationRunRecord[];
}>): ProbabilityCaseRepairQueue {
  const runs = input.runs.map(assertProbabilityEstimationRunRecord);
  const challenged = runs.flatMap((run) => run.caseChallenge === null ||
      run.caseChallenge === undefined
    ? []
    : [Object.freeze({ run, challenge: assertProbabilityCaseChallenge(run.caseChallenge) })]
  );
  const groups = new Map<Hash, typeof challenged>();
  for (const occurrence of challenged) {
    const groupId = repairGroupId(occurrence.challenge);
    const group = groups.get(groupId) ?? [];
    group.push(occurrence);
    groups.set(groupId, group);
  }
  const items = Object.freeze([...groups.entries()].map(([repairId, group]) => {
    const first = group[0]!.challenge;
    return Object.freeze({
      repairId,
      interpretationArtifactHash: first.interpretationArtifactHash,
      proposalId: first.proposalId,
      semanticConstraintArtifactHash: first.semanticConstraintArtifactHash,
      kind: first.kind,
      stateIds: first.stateIds,
      listingRefs: first.listingRefs,
      explanation: first.explanation,
      explanationVariants: Object.freeze([...new Set(group.map((item) =>
        item.challenge.explanation
      ))].sort()),
      expectedInterpretations: Object.freeze([...new Set(group.map((item) =>
        item.challenge.expectedInterpretation
      ))].sort()),
      observedConflicts: Object.freeze([...new Set(group.map((item) =>
        item.challenge.observedConflict
      ))].sort()),
      evidenceHashes: Object.freeze([...new Set(group.flatMap((item) =>
        item.challenge.evidenceHashes
      ))].sort()) as readonly Hash[],
      challengeIds: Object.freeze(group.map((item) => item.challenge.challengeId).sort()),
      runIds: Object.freeze(group.map((item) => item.run.runId).sort()),
      roles: Object.freeze([...new Set(group.map((item) => item.run.role))].sort()) as
        readonly ProbabilityEstimatorRole[],
      engines: Object.freeze([...new Set(group.map((item) => engineLabel(item.run)))].sort()),
      status: "OPEN" as const,
      nextAction: "NEW_SEMANTIC_REVIEW_REQUIRED" as const,
      authority: "SEMANTIC_REPAIR_PRIORITY_ONLY" as const,
      providerRequestAuthority: false as const,
      semanticDecisionAuthority: false as const,
      probabilityCertificateAuthority: false as const,
      executionAuthority: false as const,
    });
  }).sort((left, right) =>
    right.roles.length - left.roles.length || left.repairId.localeCompare(right.repairId)
  ));
  const content = Object.freeze({
    schemaVersion: "pmh.probability-case-repair-queue.v1" as const,
    sourceRunCount: runs.length,
    sourceChallengeCount: challenged.length,
    itemCount: items.length,
    items,
    rankingContract: "ROLE_SUPPORT_DESC_THEN_REPAIR_ID" as const,
    authority: "SEMANTIC_REPAIR_PRIORITY_ONLY" as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityCertificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      providerRequests: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...content, contentHash: hashCanonical(content) });
}

export function emptyProbabilityCaseRepairQueue(): ProbabilityCaseRepairQueue {
  return buildProbabilityCaseRepairQueue({ runs: [] });
}
