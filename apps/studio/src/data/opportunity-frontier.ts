import type { StudioProjection } from "@pmh/control-plane";

type EconomicTriage = StudioProjection["ai"]["proposalEconomicTriage"];
export type OpportunityFrontierItem = EconomicTriage["items"][number];

export type OpportunityFrontier = Readonly<{
  totalPositiveCount: number;
  visiblePositiveCount: number;
  omittedPositiveCount: number;
  windowed: boolean;
  items: readonly OpportunityFrontierItem[];
}>;

function grossEdge(item: OpportunityFrontierItem): bigint {
  const value = item.indicativeEconomics.grossEdgeBpsFloor;
  if (value === null || !/^(?:0|[1-9]\d*)$/u.test(value)) return -1n;
  return BigInt(value);
}

export function buildOpportunityFrontier(
  triage: EconomicTriage,
): OpportunityFrontier {
  const items = Object.freeze(triage.items
    .filter((item) => item.status === "POSITIVE_GROSS_HINT")
    .sort((left, right) => {
      const edgeOrder = grossEdge(right) - grossEdge(left);
      if (edgeOrder !== 0n) return edgeOrder > 0n ? 1 : -1;
      return right.currentContractMatchCount - left.currentContractMatchCount ||
        left.proposalId.localeCompare(right.proposalId);
    }));
  const totalPositiveCount = triage.counts.POSITIVE_GROSS_HINT;
  const omittedPositiveCount = Math.max(0, totalPositiveCount - items.length);
  return Object.freeze({
    totalPositiveCount,
    visiblePositiveCount: items.length,
    omittedPositiveCount,
    windowed: omittedPositiveCount > 0,
    items,
  });
}
