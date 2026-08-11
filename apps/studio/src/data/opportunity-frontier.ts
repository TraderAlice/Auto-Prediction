import type { StudioProjection } from "@pmh/control-plane";

type EconomicTriage = StudioProjection["ai"]["proposalEconomicTriage"];
type EconomicTriageItem = EconomicTriage["items"][number];
export type OpportunityFrontierItem = EconomicTriageItem & Readonly<{
  frontierIdentity: string;
  proposalVariantIds: readonly string[];
  collapsedProposalCount: number;
}>;

export type OpportunityFrontier = Readonly<{
  rawPositiveCount: number;
  visibleRawPositiveCount: number;
  visibleUniqueCount: number;
  collapsedVisibleCount: number;
  omittedRawPositiveCount: number;
  windowed: boolean;
  items: readonly OpportunityFrontierItem[];
}>;

function grossEdge(item: EconomicTriageItem): bigint {
  const value = item.indicativeEconomics.grossEdgeBpsFloor;
  if (value === null || !/^(?:0|[1-9]\d*)$/u.test(value)) return -1n;
  return BigInt(value);
}

const SYMMETRIC_RELATIONS = new Set([
  "EQUIVALENT",
  "MUTUALLY_EXCLUSIVE",
  "EXHAUSTIVE",
]);

function frontierIdentity(item: EconomicTriageItem): string {
  const listingRefs = SYMMETRIC_RELATIONS.has(item.relationKind)
    ? [...item.listingRefs].sort()
    : [...item.listingRefs];
  return JSON.stringify([item.relationKind, listingRefs]);
}

export function buildOpportunityFrontier(
  triage: EconomicTriage,
): OpportunityFrontier {
  const ordered = triage.items
    .filter((item) => item.status === "POSITIVE_GROSS_HINT")
    .sort((left, right) => {
      const edgeOrder = grossEdge(right) - grossEdge(left);
      if (edgeOrder !== 0n) return edgeOrder > 0n ? 1 : -1;
      return right.currentContractMatchCount - left.currentContractMatchCount ||
        right.effectivePriority - left.effectivePriority ||
        left.proposalId.localeCompare(right.proposalId);
    });
  const grouped = new Map<string, EconomicTriageItem[]>();
  for (const item of ordered) {
    const identity = frontierIdentity(item);
    grouped.set(identity, [...(grouped.get(identity) ?? []), item]);
  }
  const items = Object.freeze([...grouped.entries()].map(([identity, variants]) => {
    const representative = variants[0]!;
    return Object.freeze({
      ...representative,
      issueIds: Object.freeze([...new Set(variants.flatMap((item) => item.issueIds))].sort()),
      frontierIdentity: identity,
      proposalVariantIds: Object.freeze(variants.map((item) => item.proposalId).sort()),
      collapsedProposalCount: variants.length - 1,
    });
  }));
  const rawPositiveCount = triage.counts.POSITIVE_GROSS_HINT;
  const visibleRawPositiveCount = ordered.length;
  const omittedRawPositiveCount = Math.max(0, rawPositiveCount - visibleRawPositiveCount);
  return Object.freeze({
    rawPositiveCount,
    visibleRawPositiveCount,
    visibleUniqueCount: items.length,
    collapsedVisibleCount: visibleRawPositiveCount - items.length,
    omittedRawPositiveCount,
    windowed: omittedRawPositiveCount > 0,
    items,
  });
}
