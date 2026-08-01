import { describe, expect, it } from "vitest";
import { hashCanonical } from "@pmh/domain";
import {
  OpportunityLifecycleDesk,
  RealCandidatePreflightDesk,
  type MarketArchaeologistProjection,
} from "../src/index.js";

describe("opportunity lifecycle desk", () => {
  it("places AI proposals and deterministic rejections in one live-disabled queue", async () => {
    const proposalId = hashCanonical({ proposal: "ai-relation" });
    const archaeologist = {
      records: [
        {
          status: "PASS",
          report: {
            completedAt: "2026-08-01T00:00:00.000Z",
            result: { proposals: [{ proposalId }] },
          },
        },
      ],
    } as unknown as MarketArchaeologistProjection;
    const realCandidate = new RealCandidatePreflightDesk();
    await realCandidate.load();

    const desk = new OpportunityLifecycleDesk();
    desk.syncMarketArchaeologist(archaeologist);
    desk.syncRealCandidate(realCandidate.dispositionProjection());
    desk.syncMarketArchaeologist(archaeologist);
    desk.syncRealCandidate(realCandidate.dispositionProjection());

    const projection = desk.projection();
    expect(projection).toMatchObject({
      defaultPolicy: {
        routeAfterCertificate: "REQUIRE_HUMAN_APPROVAL",
        liveExecutionEnabled: false,
      },
      caseCount: 2,
      effects: {
        externalMessagesSent: false,
        liveOrdersPlaced: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(projection.cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opportunityId: `ai:${proposalId}`,
          discoveryKind: "AI_RELATION_PROPOSAL",
          state: "AWAITING_SEMANTIC_REVIEW",
          nextAction: "INDEPENDENT_SEMANTIC_REVIEW",
        }),
        expect.objectContaining({
          discoveryKind: "DETERMINISTIC_SEARCH_LEAD",
          state: "REJECTED_PREFLIGHT",
          nextAction: "NONE",
        }),
      ]),
    );
    expect(projection.exchangeModels).toEqual([
      expect.objectContaining({
        model: "CLOB_TAKER_V1",
        qualification: "BOOK_EXACT_TAKER_WALK",
      }),
      expect.objectContaining({
        model: "CONSTANT_PRODUCT_AMM_V1",
        qualification: "GENERIC_REQUIRES_VENUE_CALIBRATION",
      }),
    ]);
    expect(projection.routes.every((route) => !route.liveExecutionAvailable)).toBe(
      true,
    );
  });
});
