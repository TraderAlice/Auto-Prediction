import { describe, expect, it } from "vitest";
import { hashCanonical, type Hash } from "@pmh/domain";
import {
  buildEvidenceDebtFrontier,
  type EvidenceAcquisitionJobRecord,
  type EvidenceRequirement,
  type ProposalEconomicTriageItem,
  type ReviewAttentionItem,
} from "../src/index.js";

function hash(label: string): Hash {
  return hashCanonical({ label });
}

function requirement(
  proposalId: Hash,
  ordinal: number,
  kind: EvidenceRequirement["kind"] = "RESOLUTION_RULE",
): EvidenceRequirement {
  return {
    schemaVersion: "pmh.evidence-requirement.v2",
    requirementId: hash(`${proposalId}:requirement:${ordinal}`),
    acquisitionScopeIdentity: hash(`${proposalId}:scope:${ordinal}`),
    origin: "SEMANTIC_REVIEW",
    proposalId,
    kind,
    listingRefs: [`venue:a:${ordinal}`],
    proposalListingRefs: ["venue:a", "venue:b"],
    claim: `Claim ${ordinal}`,
    reason: "Official source is not routed yet.",
    satisfyingObservation: "The official source confirms the claim.",
    contradictingObservation: "The official source contradicts the claim.",
    temporalPosture: "CURRENT",
    sourceObservations: [],
    eligibleLocators: [],
    acquisitionRoute: "UNSUPPORTED",
    authority: "EVIDENCE_ACQUISITION_REQUEST_ONLY",
    fetchAuthority: false,
    providerRequestAuthority: false,
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
  };
}

function job(
  label: string,
  requirements: readonly EvidenceRequirement[],
): Pick<EvidenceAcquisitionJobRecord, "jobId" | "status" | "requirements"> {
  return { jobId: hash(label), status: "UNSUPPORTED", requirements };
}

function economics(
  proposalId: Hash,
  status: ProposalEconomicTriageItem["status"],
  edge: string | null,
  priority: 1 | 2 | 3 | 4 | 5 = 3,
): Pick<ProposalEconomicTriageItem,
  "proposalId" | "statement" | "relationKind" | "listingRefs" | "status" |
  "effectivePriority" | "indicativeEconomics"
> {
  return {
    proposalId,
    statement: `Statement ${proposalId}`,
    relationKind: "MUTUALLY_EXCLUSIVE",
    listingRefs: ["venue:a", "venue:b"],
    status,
    effectivePriority: priority,
    indicativeEconomics: edge === null
      ? {
        status: "NOT_APPLICABLE",
        portfolioLabel: null,
        indicativeCostBpsCeil: null,
        grossEdgeBpsFloor: null,
        source: null,
        feesIncluded: false,
        depthIncluded: false,
        executable: false,
      }
      : {
        status: "POSITIVE_GROSS_HINT",
        portfolioLabel: "Buy both No legs",
        indicativeCostBpsCeil: "9000",
        grossEdgeBpsFloor: edge,
        source: "CURRENT_CONTRACT_MATCHED",
        feesIncluded: false,
        depthIncluded: false,
        executable: false,
      },
  };
}

function review(
  proposalId: Hash,
  missingEvidenceCount: number,
): Pick<ReviewAttentionItem,
  "proposalId" | "statement" | "listingRefs" | "operatorPosture" |
  "nextAction" | "missingEvidenceCount"
> {
  return {
    proposalId,
    statement: `Review ${proposalId}`,
    listingRefs: ["venue:a", "venue:b"],
    operatorPosture: "EVIDENCE_ESCALATION",
    nextAction: "RESOLVE_EVIDENCE_GAPS",
    missingEvidenceCount,
  };
}

describe("evidence debt frontier", () => {
  it("groups by proposal and orders action value without granting decision authority", () => {
    const positiveHigh = hash("positive-high");
    const positiveLow = hash("positive-low");
    const escalated = hash("escalated");
    const triage = hash("triage");
    const retained = hash("retained");
    const duplicate = requirement(escalated, 0);
    const projection = buildEvidenceDebtFrontier({
      jobs: [
        job("one", [requirement(retained, 0), requirement(escalated, 1), duplicate]),
        job("two", [requirement(positiveLow, 0), requirement(triage, 0), duplicate]),
        job("three", [requirement(positiveHigh, 0)]),
      ],
      activeRequirementIds: [
        requirement(retained, 0).requirementId,
        requirement(escalated, 1).requirementId,
        duplicate.requirementId,
        requirement(positiveLow, 0).requirementId,
        requirement(triage, 0).requirementId,
        requirement(positiveHigh, 0).requirementId,
      ],
      economicItems: [
        economics(positiveLow, "POSITIVE_GROSS_HINT", "9007199254740993"),
        economics(positiveHigh, "POSITIVE_GROSS_HINT", "9007199254740994"),
        economics(triage, "RELATION_UNSUPPORTED", null, 5),
      ],
      reviewItems: [review(escalated, 4)],
    });

    expect(projection.items.map((item) => [item.proposalId, item.tier])).toEqual([
      [positiveHigh, "POSITIVE_GROSS_BLOCKER"],
      [positiveLow, "POSITIVE_GROSS_BLOCKER"],
      [escalated, "EVIDENCE_ESCALATION"],
      [triage, "ACTIVE_TRIAGE_DEBT"],
      [retained, "RETAINED_RESEARCH_DEBT"],
    ]);
    expect(projection.items[2]).toMatchObject({
      requirementCount: 2,
      jobCount: 2,
      authority: "EVIDENCE_ROUTING_PRIORITY_ONLY",
      semanticDecisionAuthority: false,
      certificateAuthority: false,
      executionAuthority: false,
      effects: { modelCalls: false, fetchesStarted: false, externalWrites: false },
    });
    expect(projection.counts).toEqual({
      POSITIVE_GROSS_BLOCKER: 2,
      EVIDENCE_ESCALATION: 1,
      ACTIVE_TRIAGE_DEBT: 1,
      RETAINED_RESEARCH_DEBT: 1,
    });
  });

  it("is content-addressed, input-order independent, and bounds requirement detail", () => {
    const proposalId = hash("wide-proposal");
    const requirements = Array.from({ length: 24 }, (_, index) =>
      requirement(proposalId, index, index % 2 === 0 ? "TIME_BOUNDARY" : "ORACLE_SOURCE")
    );
    const first = buildEvidenceDebtFrontier({
      jobs: [job("wide", requirements)],
      activeRequirementIds: requirements.map((item) => item.requirementId),
      economicItems: [],
      reviewItems: [],
    });
    const second = buildEvidenceDebtFrontier({
      jobs: [job("wide", [...requirements].reverse())],
      activeRequirementIds: requirements.map((item) => item.requirementId),
      economicItems: [],
      reviewItems: [],
    });

    expect(second.contentHash).toBe(first.contentHash);
    expect(first.items[0]).toMatchObject({
      requirementCount: 24,
      includedRequirementCount: 20,
      missingKinds: ["ORACLE_SOURCE", "TIME_BOUNDARY"],
    });
    expect(first.items[0]?.requirements).toHaveLength(20);
  });

  it("excludes inactive retained requirements without deleting their history", () => {
    const proposalId = hash("evolved-proposal");
    const retired = requirement(proposalId, 0, "RESOLUTION_RULE");
    const active = requirement(proposalId, 1, "ORACLE_SOURCE");
    const projection = buildEvidenceDebtFrontier({
      jobs: [job("retired", [retired]), job("active", [active])],
      activeRequirementIds: [active.requirementId],
      economicItems: [economics(proposalId, "POSITIVE_GROSS_HINT", "190", 5)],
      reviewItems: [],
    });

    expect(projection).toMatchObject({
      retainedUnsupportedJobCount: 2,
      retainedUnsupportedRequirementCount: 2,
      inactiveUnsupportedRequirementCount: 1,
      sourceUnsupportedJobCount: 1,
      sourceRequirementCount: 1,
      sourceProposalCount: 1,
    });
    expect(projection.items[0]).toMatchObject({
      missingKinds: ["ORACLE_SOURCE"],
      requirementCount: 1,
      tier: "POSITIVE_GROSS_BLOCKER",
    });
  });
});
