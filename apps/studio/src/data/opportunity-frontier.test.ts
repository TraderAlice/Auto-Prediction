import { describe, expect, it } from "vitest";
import type { StudioProjection } from "@pmh/control-plane";
import { buildOpportunityFrontier } from "./opportunity-frontier.js";

type EconomicTriage = StudioProjection["ai"]["proposalEconomicTriage"];
type EconomicItem = EconomicTriage["items"][number];

function item(
  proposalId: string,
  status: EconomicItem["status"],
  grossEdgeBpsFloor: string | null,
): EconomicItem {
  return {
    proposalId,
    status,
    currentContractMatchCount: 2,
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
      item("sha256:c", "POSITIVE_GROSS_HINT", "20"),
      item("sha256:ignored", "SETTLEMENT_INELIGIBLE", null),
      item("sha256:a", "POSITIVE_GROSS_HINT", "210"),
      item("sha256:b", "POSITIVE_GROSS_HINT", "100"),
    ]));
    expect(frontier).toMatchObject({
      totalPositiveCount: 3,
      visiblePositiveCount: 3,
      omittedPositiveCount: 0,
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
      totalPositiveCount: 6,
      visiblePositiveCount: 1,
      omittedPositiveCount: 5,
      windowed: true,
    });
    expect(buildOpportunityFrontier(triage(0, []))).toMatchObject({
      totalPositiveCount: 0,
      visiblePositiveCount: 0,
      omittedPositiveCount: 0,
      windowed: false,
      items: [],
    });
  });
});
