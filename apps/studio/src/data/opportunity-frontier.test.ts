import { describe, expect, it } from "vitest";
import type { StudioProjection } from "@pmh/control-plane";
import { buildOpportunityFrontier } from "./opportunity-frontier.js";

type EconomicTriage = StudioProjection["ai"]["proposalEconomicTriage"];
type EconomicItem = EconomicTriage["items"][number];

function item(
  proposalId: string,
  status: EconomicItem["status"],
  grossEdgeBpsFloor: string | null,
  options: Readonly<{
    relationKind?: string;
    listingRefs?: readonly string[];
    effectivePriority?: number;
    issueIds?: readonly string[];
  }> = {},
): EconomicItem {
  return {
    proposalId,
    status,
    currentContractMatchCount: 2,
    relationKind: options.relationKind ?? "EQUIVALENT",
    listingRefs: options.listingRefs ?? ["venue-a:a", "venue-b:b"],
    effectivePriority: options.effectivePriority ?? 3,
    issueIds: options.issueIds ?? [],
    indicativeEconomics: { grossEdgeBpsFloor },
  } as EconomicItem;
}

function triage(
  totalPositiveCount: number,
  items: readonly EconomicItem[],
): EconomicTriage {
  return {
    counts: { POSITIVE_GROSS_HINT: totalPositiveCount },
    items,
  } as EconomicTriage;
}

describe("opportunity frontier", () => {
  it("shows only positive current hints and orders them by gross edge", () => {
    const frontier = buildOpportunityFrontier(triage(3, [
      item("sha256:c", "POSITIVE_GROSS_HINT", "20", { listingRefs: ["a:c", "b:c"] }),
      item("sha256:ignored", "SETTLEMENT_INELIGIBLE", null),
      item("sha256:a", "POSITIVE_GROSS_HINT", "210", { listingRefs: ["a:a", "b:a"] }),
      item("sha256:b", "POSITIVE_GROSS_HINT", "100", { listingRefs: ["a:b", "b:b"] }),
    ]));
    expect(frontier).toMatchObject({
      rawPositiveCount: 3,
      visibleRawPositiveCount: 3,
      visibleUniqueCount: 3,
      collapsedVisibleCount: 0,
      omittedRawPositiveCount: 0,
      windowed: false,
    });
    expect(frontier.items.map((candidate) => candidate.proposalId)).toEqual([
      "sha256:a", "sha256:b", "sha256:c",
    ]);
  });

  it("keeps missing bounded detail explicit instead of treating it as zero", () => {
    expect(buildOpportunityFrontier(triage(6, [
      item("sha256:visible", "POSITIVE_GROSS_HINT", "50"),
    ]))).toMatchObject({
      rawPositiveCount: 6,
      visibleRawPositiveCount: 1,
      visibleUniqueCount: 1,
      collapsedVisibleCount: 0,
      omittedRawPositiveCount: 5,
      windowed: true,
    });
    expect(buildOpportunityFrontier(triage(0, []))).toMatchObject({
      rawPositiveCount: 0,
      visibleRawPositiveCount: 0,
      visibleUniqueCount: 0,
      collapsedVisibleCount: 0,
      omittedRawPositiveCount: 0,
      windowed: false,
      items: [],
    });
  });

  it("collapses symmetric proposal variants without deleting their lineage", () => {
    const frontier = buildOpportunityFrontier(triage(3, [
      item("sha256:b", "POSITIVE_GROSS_HINT", "190", {
        relationKind: "MUTUALLY_EXCLUSIVE",
        listingRefs: ["house:rep", "house:dem"],
        effectivePriority: 4,
        issueIds: ["sha256:issue-b"],
      }),
      item("sha256:a", "POSITIVE_GROSS_HINT", "190", {
        relationKind: "MUTUALLY_EXCLUSIVE",
        listingRefs: ["house:dem", "house:rep"],
        effectivePriority: 5,
        issueIds: ["sha256:issue-a"],
      }),
      item("sha256:c", "POSITIVE_GROSS_HINT", "110", {
        relationKind: "EQUIVALENT",
        listingRefs: ["mls:lafc", "mls:lafc-other"],
      }),
    ]));
    expect(frontier).toMatchObject({
      rawPositiveCount: 3,
      visibleRawPositiveCount: 3,
      visibleUniqueCount: 2,
      collapsedVisibleCount: 1,
    });
    expect(frontier.items[0]).toMatchObject({
      proposalId: "sha256:a",
      collapsedProposalCount: 1,
      proposalVariantIds: ["sha256:a", "sha256:b"],
      issueIds: ["sha256:issue-a", "sha256:issue-b"],
    });
  });

  it("preserves direction and relation kind in frontier identity", () => {
    const frontier = buildOpportunityFrontier(triage(3, [
      item("sha256:forward", "POSITIVE_GROSS_HINT", "80", {
        relationKind: "IMPLIES",
        listingRefs: ["event:early", "event:late"],
      }),
      item("sha256:reverse", "POSITIVE_GROSS_HINT", "80", {
        relationKind: "IMPLIES",
        listingRefs: ["event:late", "event:early"],
      }),
      item("sha256:subset", "POSITIVE_GROSS_HINT", "80", {
        relationKind: "SUBSET",
        listingRefs: ["event:early", "event:late"],
      }),
    ]));
    expect(frontier.visibleUniqueCount).toBe(3);
    expect(frontier.collapsedVisibleCount).toBe(0);
  });
});
