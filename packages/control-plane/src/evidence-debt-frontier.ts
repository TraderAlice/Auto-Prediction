import { hashCanonical, type Hash } from "@pmh/domain";
import type { EvidenceAcquisitionJobRecord } from "./evidence-acquisition-scheduler.js";
import type { EvidenceRequirement, EvidenceRequirementKind } from "./evidence-requirement.js";
import type {
  ProposalEconomicTriageItem,
  ProposalEconomicTriageStatus,
} from "./proposal-economic-triage.js";
import type {
  ReviewAttentionItem,
  ReviewAttentionPosture,
} from "./review-attention.js";

const MAX_ITEMS = 50;
const MAX_REQUIREMENTS_PER_ITEM = 20;

export type EvidenceDebtTier =
  | "POSITIVE_GROSS_BLOCKER"
  | "EVIDENCE_ESCALATION"
  | "ACTIVE_TRIAGE_DEBT"
  | "RETAINED_RESEARCH_DEBT";

export type EvidenceDebtFrontierRequirement = Readonly<{
  requirementId: Hash;
  jobId: Hash;
  kind: EvidenceRequirementKind;
  claim: string;
  listingRefs: readonly string[];
  acquisitionRoute: "UNSUPPORTED";
}>;

export type EvidenceDebtFrontierItem = Readonly<{
  schemaVersion: "pmh.evidence-debt-frontier-item.v1";
  itemId: Hash;
  proposalId: Hash;
  statement: string | null;
  relationKind: string | null;
  listingRefs: readonly string[];
  tier: EvidenceDebtTier;
  economicStatus: ProposalEconomicTriageStatus | null;
  grossEdgeBpsFloor: string | null;
  feesIncluded: false;
  depthIncluded: false;
  effectivePriority: 1 | 2 | 3 | 4 | 5 | null;
  reviewPosture: ReviewAttentionPosture | null;
  reviewNextAction: ReviewAttentionItem["nextAction"] | null;
  reviewMissingEvidenceCount: number | null;
  missingKinds: readonly EvidenceRequirementKind[];
  requirementCount: number;
  includedRequirementCount: number;
  jobCount: number;
  requirements: readonly EvidenceDebtFrontierRequirement[];
  authority: "EVIDENCE_ROUTING_PRIORITY_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    modelCalls: false;
    fetchesStarted: false;
    schedulerChanges: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type EvidenceDebtFrontierProjection = Readonly<{
  schemaVersion: "pmh.evidence-debt-frontier.v1";
  contentHash: Hash;
  sourceUnsupportedJobCount: number;
  sourceRequirementCount: number;
  sourceProposalCount: number;
  itemCount: number;
  truncated: boolean;
  counts: Readonly<Record<EvidenceDebtTier, number>>;
  items: readonly EvidenceDebtFrontierItem[];
  sortContract: "TIER_THEN_GROSS_EDGE_THEN_PRIORITY_THEN_MISSING_BREADTH";
  groupingContract: "ONE_ITEM_PER_PROPOSAL";
  sourceWindow: "EVIDENCE_SCHEDULER_RETAINED_WINDOW";
  authority: "EVIDENCE_ROUTING_PRIORITY_ONLY";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: EvidenceDebtFrontierItem["effects"];
}>;

type EconomicInput = Pick<
  ProposalEconomicTriageItem,
  | "proposalId"
  | "statement"
  | "relationKind"
  | "listingRefs"
  | "status"
  | "effectivePriority"
  | "indicativeEconomics"
>;

type ReviewInput = Pick<
  ReviewAttentionItem,
  | "proposalId"
  | "statement"
  | "listingRefs"
  | "operatorPosture"
  | "nextAction"
  | "missingEvidenceCount"
>;

type UnsupportedJobInput = Pick<
  EvidenceAcquisitionJobRecord,
  "jobId" | "status" | "requirements"
>;

const effects = Object.freeze({
  modelCalls: false as const,
  fetchesStarted: false as const,
  schedulerChanges: false as const,
  externalWrites: false as const,
  valueMovingActions: false as const,
  liveExecutionEnabled: false as const,
});

const tierOrder: Readonly<Record<EvidenceDebtTier, number>> = Object.freeze({
  POSITIVE_GROSS_BLOCKER: 0,
  EVIDENCE_ESCALATION: 1,
  ACTIVE_TRIAGE_DEBT: 2,
  RETAINED_RESEARCH_DEBT: 3,
});

function grossEdge(item: EconomicInput | undefined): string | null {
  return item?.indicativeEconomics.grossEdgeBpsFloor ?? null;
}

function tierFor(
  economic: EconomicInput | undefined,
  review: ReviewInput | undefined,
): EvidenceDebtTier {
  if (economic?.status === "POSITIVE_GROSS_HINT") return "POSITIVE_GROSS_BLOCKER";
  if (
    review?.operatorPosture === "EVIDENCE_ESCALATION" ||
    review?.nextAction === "RESOLVE_EVIDENCE_GAPS"
  ) return "EVIDENCE_ESCALATION";
  if (economic !== undefined) return "ACTIVE_TRIAGE_DEBT";
  return "RETAINED_RESEARCH_DEBT";
}

function compareNullableBigintDesc(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue === rightValue ? 0 : leftValue > rightValue ? -1 : 1;
}

function proposalRefs(requirement: EvidenceRequirement): readonly string[] {
  return requirement.schemaVersion === "pmh.evidence-requirement.v2"
    ? requirement.proposalListingRefs
    : requirement.listingRefs;
}

export function buildEvidenceDebtFrontier(input: Readonly<{
  jobs: readonly UnsupportedJobInput[];
  economicItems: readonly EconomicInput[];
  reviewItems: readonly ReviewInput[];
}>): EvidenceDebtFrontierProjection {
  const economicByProposal = new Map(input.economicItems.map((item) => [item.proposalId, item]));
  const reviewByProposal = new Map(input.reviewItems.map((item) => [item.proposalId, item]));
  const grouped = new Map<Hash, Array<Readonly<{ jobId: Hash; requirement: EvidenceRequirement }>>>();
  let sourceUnsupportedJobCount = 0;
  let sourceRequirementCount = 0;

  for (const job of input.jobs) {
    if (job.status !== "UNSUPPORTED") continue;
    sourceUnsupportedJobCount += 1;
    for (const requirement of job.requirements) {
      if (requirement.acquisitionRoute !== "UNSUPPORTED") continue;
      sourceRequirementCount += 1;
      const entries = grouped.get(requirement.proposalId) ?? [];
      entries.push(Object.freeze({ jobId: job.jobId, requirement }));
      grouped.set(requirement.proposalId, entries);
    }
  }

  const allItems = [...grouped.entries()].map(([proposalId, rawEntries]) => {
    const uniqueEntries = [...new Map(rawEntries.map((entry) => [
      entry.requirement.requirementId,
      entry,
    ])).values()].sort((left, right) =>
      left.requirement.kind.localeCompare(right.requirement.kind) ||
      left.requirement.requirementId.localeCompare(right.requirement.requirementId),
    );
    const economic = economicByProposal.get(proposalId);
    const review = reviewByProposal.get(proposalId);
    const listingRefs = Object.freeze([...(economic?.listingRefs ?? review?.listingRefs ??
      [...new Set(uniqueEntries.flatMap(({ requirement }) => proposalRefs(requirement)))])]);
    const requirements = Object.freeze(uniqueEntries.slice(0, MAX_REQUIREMENTS_PER_ITEM).map(({ jobId, requirement }) =>
      Object.freeze({
        requirementId: requirement.requirementId,
        jobId,
        kind: requirement.kind,
        claim: requirement.claim,
        listingRefs: requirement.listingRefs,
        acquisitionRoute: "UNSUPPORTED" as const,
      }),
    ));
    const body = Object.freeze({
      schemaVersion: "pmh.evidence-debt-frontier-item.v1" as const,
      proposalId,
      statement: economic?.statement ?? review?.statement ?? null,
      relationKind: economic?.relationKind ?? null,
      listingRefs,
      tier: tierFor(economic, review),
      economicStatus: economic?.status ?? null,
      grossEdgeBpsFloor: grossEdge(economic),
      feesIncluded: false as const,
      depthIncluded: false as const,
      effectivePriority: economic?.effectivePriority ?? null,
      reviewPosture: review?.operatorPosture ?? null,
      reviewNextAction: review?.nextAction ?? null,
      reviewMissingEvidenceCount: review?.missingEvidenceCount ?? null,
      missingKinds: Object.freeze([...new Set(uniqueEntries.map(({ requirement }) => requirement.kind))].sort()),
      requirementCount: uniqueEntries.length,
      includedRequirementCount: requirements.length,
      jobCount: new Set(uniqueEntries.map(({ jobId }) => jobId)).size,
      requirements,
      authority: "EVIDENCE_ROUTING_PRIORITY_ONLY" as const,
      semanticDecisionAuthority: false as const,
      simulationAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
      effects,
    });
    return Object.freeze({ ...body, itemId: hashCanonical(body) });
  }).sort((left, right) =>
    tierOrder[left.tier] - tierOrder[right.tier] ||
    compareNullableBigintDesc(left.grossEdgeBpsFloor, right.grossEdgeBpsFloor) ||
    (right.effectivePriority ?? 0) - (left.effectivePriority ?? 0) ||
    (right.reviewMissingEvidenceCount ?? 0) - (left.reviewMissingEvidenceCount ?? 0) ||
    right.requirementCount - left.requirementCount ||
    left.proposalId.localeCompare(right.proposalId),
  );
  const items = Object.freeze(allItems.slice(0, MAX_ITEMS));
  const counts = Object.freeze({
    POSITIVE_GROSS_BLOCKER: allItems.filter((item) => item.tier === "POSITIVE_GROSS_BLOCKER").length,
    EVIDENCE_ESCALATION: allItems.filter((item) => item.tier === "EVIDENCE_ESCALATION").length,
    ACTIVE_TRIAGE_DEBT: allItems.filter((item) => item.tier === "ACTIVE_TRIAGE_DEBT").length,
    RETAINED_RESEARCH_DEBT: allItems.filter((item) => item.tier === "RETAINED_RESEARCH_DEBT").length,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.evidence-debt-frontier.v1" as const,
    sourceUnsupportedJobCount,
    sourceRequirementCount,
    sourceProposalCount: allItems.length,
    itemCount: items.length,
    truncated: items.length < allItems.length,
    counts,
    items,
    sortContract: "TIER_THEN_GROSS_EDGE_THEN_PRIORITY_THEN_MISSING_BREADTH" as const,
    groupingContract: "ONE_ITEM_PER_PROPOSAL" as const,
    sourceWindow: "EVIDENCE_SCHEDULER_RETAINED_WINDOW" as const,
    authority: "EVIDENCE_ROUTING_PRIORITY_ONLY" as const,
    semanticDecisionAuthority: false as const,
    simulationAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects,
  });
  return Object.freeze({ ...body, contentHash: hashCanonical(body) });
}

export function emptyEvidenceDebtFrontier(): EvidenceDebtFrontierProjection {
  return buildEvidenceDebtFrontier({ jobs: [], economicItems: [], reviewItems: [] });
}
