import { hashCanonical } from "@pmh/domain";
import { runOpportunitySimulation } from "@pmh/execution";
import { describe, expect, it } from "vitest";
import {
  AnonymousSimulationMaterializerDesk,
  assertExactOpportunityVerificationRecord,
  verifyMaterializedOpportunity,
  type AnonymousMaterializerFetchLike,
  type ResearchRelationPayoffQualification,
} from "../src/index.js";

function qualification(): ResearchRelationPayoffQualification {
  const leftRef = "polymarket-global:left-market";
  const rightRef = "polymarket-global:right-market";
  const portfolioBody = {
    label: "Left false + right true",
    legs: [
      { legId: "left:FALSE", listingRef: leftRef, outcome: "FALSE" as const },
      { legId: "right:TRUE", listingRef: rightRef, outcome: "TRUE" as const },
    ],
    payoutUnitsByState: { FF: 1, FT: 2, TT: 1 },
    minimumPayoutUnits: 1,
  };
  const portfolio = Object.freeze({
    ...portfolioBody,
    portfolioId: hashCanonical(portfolioBody),
  });
  const body = {
    schemaVersion: "pmh.research-relation-payoff.v1" as const,
    opportunityId: "ai:exact-promotion-fixture",
    proposalId: hashCanonical({ proposal: "exact-promotion" }),
    semanticReviewArtifactHash: hashCanonical({ review: "exact-promotion" }),
    semanticDecisionId: hashCanonical({ decision: "exact-promotion" }),
    relationKind: "IMPLIES" as const,
    status: "SIMULATION_TEMPLATE_READY" as const,
    diagnostic: null,
    listingBindings: [
      {
        position: "LEFT" as const,
        listingRef: leftRef,
        listingHash: hashCanonical({ listing: "left" }),
        venueId: "polymarket-global",
        venueInstrumentId: "left-market",
        priceScale: "100000000",
        quantityScale: "100000000",
        minPriceTick: "1000000",
        trueOutcome: { venueOutcomeId: "left-yes", label: "Yes" },
        falseOutcome: { venueOutcomeId: "left-no", label: "No" },
      },
      {
        position: "RIGHT" as const,
        listingRef: rightRef,
        listingHash: hashCanonical({ listing: "right" }),
        venueId: "polymarket-global",
        venueInstrumentId: "right-market",
        priceScale: "100000000",
        quantityScale: "100000000",
        minPriceTick: "1000000",
        trueOutcome: { venueOutcomeId: "right-yes", label: "Yes" },
        falseOutcome: { venueOutcomeId: "right-no", label: "No" },
      },
    ],
    canonicalStates: [
      { stateId: "FF", truthByListingRef: { [leftRef]: false, [rightRef]: false } },
      { stateId: "FT", truthByListingRef: { [leftRef]: false, [rightRef]: true } },
      { stateId: "TT", truthByListingRef: { [leftRef]: true, [rightRef]: true } },
    ],
    portfolios: [portfolio],
    authority: "DETERMINISTIC_RESEARCH_COMPILER" as const,
    verifierEligible: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function evidence() {
  const fetcher: AnonymousMaterializerFetchLike = async (url) => {
    if (url.includes("/clob-markets/")) {
      const condition = new URL(url).pathname.split("/").at(-1)!;
      const token = condition.replace(/-condition$/u, "");
      return jsonResponse({
        t: [{ t: token }, { t: `${token}-other` }],
        mts: 0.01,
        fd: null,
      });
    }
    const token = new URL(url).searchParams.get("token_id")!;
    return jsonResponse({
      market: `${token}-condition`,
      asset_id: token,
      hash: `generation:${token}`,
      bids: [],
      asks: [
        { price: token === "left-no" ? "0.4" : "0.5", size: "2.5" },
      ],
    });
  };
  const qualified = qualification();
  const materialized = await new AnonymousSimulationMaterializerDesk({
    fetcher,
    now: () => new Date("2026-08-01T08:00:00.000Z"),
  }).materialize({
    qualification: qualified,
    portfolioId: qualified.portfolios[0]!.portfolioId,
    requestedQuantity: "100000000",
  });
  if (materialized.plan === null) throw new Error("fixture did not materialize");
  return {
    qualified,
    materialized,
    bundle: runOpportunitySimulation(materialized.plan),
  };
}

describe("materialized opportunity exact promotion", () => {
  it("conservatively converts raw-bound fills into a first-party certificate", async () => {
    const { qualified, materialized, bundle } = await evidence();
    const record = verifyMaterializedOpportunity({
      qualification: qualified,
      materialization: materialized.record,
      bundle,
      nowEpochMs: BigInt(Date.parse("2026-08-01T08:00:00.100Z")),
    });

    expect(record).toMatchObject({
      status: "CERTIFIED",
      qualificationHash: qualified.artifactHash,
      materializationId: materialized.record.materializationId,
      simulationBundleHash: bundle.artifactHash,
      diagnostic: null,
      authority: "FIRST_PARTY_EXACT_VERIFIER",
      executionAuthority: false,
      effects: {
        externalWrites: false,
        valueMovingActions: false,
        liveExecutionEnabled: false,
      },
    });
    expect(record.certificate?.worstCaseAfterFees).toBe(10_000_000n);
    expect(record.certificate?.worstCaseAfterFees).toBeLessThanOrEqual(
      bundle.floorAfterSimulatedFees,
    );
    expect(record.candidate.venueAssumptions).toContain(
      `SIMULATION_BUNDLE=${bundle.artifactHash}`,
    );
    expect(() => assertExactOpportunityVerificationRecord(record)).not.toThrow();
  });

  it("records an exact rejection when otherwise valid public evidence expired", async () => {
    const { qualified, materialized, bundle } = await evidence();
    const record = verifyMaterializedOpportunity({
      qualification: qualified,
      materialization: materialized.record,
      bundle,
      nowEpochMs: BigInt(Date.parse("2026-08-01T08:00:16.000Z")),
    });

    expect(record).toMatchObject({
      status: "REJECTED",
      certificate: null,
      diagnostic: "candidate is expired",
    });
    expect(() => assertExactOpportunityVerificationRecord(record)).not.toThrow();
  });

  it("refuses a positive simulation that is not bound to its materialization", async () => {
    const { qualified, materialized, bundle } = await evidence();
    expect(() =>
      verifyMaterializedOpportunity({
        qualification: qualified,
        materialization: materialized.record,
        bundle: {
          ...bundle,
          opportunityId: "ai:browser-substitution",
        },
      }),
    ).toThrow(/simulation bundle violates its contract/);
  });

  it("refuses a rehashed verification record with substituted source bindings", async () => {
    const { qualified, materialized, bundle } = await evidence();
    const record = verifyMaterializedOpportunity({
      qualification: qualified,
      materialization: materialized.record,
      bundle,
      nowEpochMs: BigInt(Date.parse("2026-08-01T08:00:00.100Z")),
    });
    const { artifactHash: _artifactHash, ...recordBody } = record;
    const rewrittenBody = {
      ...recordBody,
      materializationId: hashCanonical({ substituted: "materialization" }),
    };

    expect(() =>
      assertExactOpportunityVerificationRecord({
        ...rewrittenBody,
        artifactHash: hashCanonical(rewrittenBody),
      }),
    ).toThrow(/violates its contract/);
  });
});
