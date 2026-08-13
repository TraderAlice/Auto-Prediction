import { hashCanonical, type Hash } from "@pmh/domain";
import { describe, expect, it } from "vitest";
import {
  buildRelationDiscoverySemanticCoverageSummary,
  buildRelationDiscoverySemanticNoveltyProjection,
  classifyRelationDiscoverySemanticNovelty,
  relationDiscoveryPayoffCoverageIdentity,
  relationDiscoverySearchCoverageIdentity,
  emptyAgentExecutionSnapshot,
  type RelationDiscoveryFinding,
  type RelationDiscoveryPositiveFinding,
  type RelationDiscoveryRouteLayer,
  type RelationDiscoveryRouteObservation,
} from "../src/index.js";

function hash(label: string): Hash {
  return hashCanonical({ label });
}

function route(input: Readonly<{
  id: string;
  layer: RelationDiscoveryRouteLayer;
  signals: readonly string[];
  fields?: readonly ("title" | "description" | "rulesText")[];
  refs?: readonly string[];
}>): RelationDiscoveryRouteObservation {
  const refs = input.refs ?? ["gemini:lula-office", "gemini:lula-president"];
  return {
    schemaVersion: "pmh.relation-discovery-finding.v1",
    findingId: hash(`finding:${input.id}`),
    workItemId: hash("work:lula"),
    workArtifactHash: hash("artifact:lula"),
    sourceTaskId: hash(`task:${input.id}`),
    sourceAgentRunId: hash(`run:${input.id}`),
    sourceCorpusSnapshotIdentity: hash("corpus:lula"),
    listingRefs: refs,
    listingEvidenceHashes: refs.map((ref) => hash(`evidence:${ref}`)),
    statement: "The titles share one literal route.",
    rationale: "This is search memory only.",
    recordedAt: "2026-08-13T00:00:00.000Z",
    authority: "SEARCH_ROUTING_ONLY",
    reviewStatus: "NOT_APPLICABLE_ROUTING_ONLY",
    semanticDecisionAuthority: false,
    probabilityAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
    kind: "ONTOLOGY_ROUTE",
    routeLayer: input.layer,
    searchSignals: input.signals,
    searchFields: input.fields ?? ["title"],
    baselineListingRefs: refs,
    baselineListingEvidenceHashes: refs.map((ref) => hash(`route-evidence:${ref}`)),
    baselineMembershipIdentity: hash(`membership:${input.id}`),
    falsifiers: ["The literal query stops matching both titles."],
  };
}

function payoff(input: Readonly<{
  id: string;
  statement?: string;
  rationale?: string;
  relationKind?: RelationDiscoveryPositiveFinding["relationKind"];
  refs?: readonly string[];
}>): RelationDiscoveryPositiveFinding {
  const refs = input.refs ?? ["venue:a", "venue:b"];
  return {
    schemaVersion: "pmh.relation-discovery-finding.v1",
    findingId: hash(`finding:${input.id}`),
    workItemId: hash("work:payoff"),
    workArtifactHash: hash("artifact:payoff"),
    sourceTaskId: hash(`task:${input.id}`),
    sourceAgentRunId: hash(`run:${input.id}`),
    sourceCorpusSnapshotIdentity: hash("corpus:payoff"),
    listingRefs: refs,
    listingEvidenceHashes: refs.map((ref) => hash(`evidence:${ref}`)),
    statement: input.statement ?? "A implies B in every settlement state.",
    rationale: input.rationale ?? "The retained rules establish the implication.",
    recordedAt: "2026-08-13T00:00:00.000Z",
    authority: "RELATION_FINDING_PROPOSAL_ONLY",
    reviewStatus: "UNREVIEWED",
    semanticDecisionAuthority: false,
    probabilityAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    externalWriteAuthority: false,
    valueMovingAuthority: false,
    kind: "RELATION_HYPOTHESIS",
    relationKind: input.relationKind ?? "IMPLIES",
    falsifiers: ["One joint settlement state violates the implication."],
  };
}

describe("relation discovery semantic novelty", () => {
  it("treats route labels as ontology annotations when they compile to one query", () => {
    const retained = route({
      id: "event-lula",
      layer: "EVENT_REFERENCE",
      signals: ["Luiz Inácio Lula da Silva"],
    });
    const candidate = route({
      id: "subject-lula",
      layer: "SUBJECT_REFERENCE",
      signals: ["  LUIZ INÁCIO   LULA DA SILVA  "],
    });
    expect(relationDiscoverySearchCoverageIdentity(candidate))
      .toBe(relationDiscoverySearchCoverageIdentity(retained));
    expect(classifyRelationDiscoverySemanticNovelty({
      candidate,
      retainedFindings: [retained],
    })).toMatchObject({
      classification: "REDUNDANT_SEARCH_MEMORY",
      semanticDomain: "SEARCH_MEMORY",
      overlapFindingIds: [retained.findingId],
      admitted: false,
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
  });

  it("keeps literal query and search-field changes distinct", () => {
    const retained = route({ id: "lula", layer: "SUBJECT_REFERENCE", signals: ["Lula"] });
    const differentSignal = route({
      id: "silva",
      layer: "SUBJECT_REFERENCE",
      signals: ["Luiz Inácio Lula da Silva"],
    });
    const settlementQuery = route({
      id: "settlement",
      layer: "SETTLEMENT_REFERENCE",
      signals: ["Lula"],
      fields: ["description", "rulesText"],
    });
    for (const candidate of [differentSignal, settlementQuery]) {
      expect(classifyRelationDiscoverySemanticNovelty({
        candidate,
        retainedFindings: [retained],
      })).toMatchObject({ classification: "NOVEL_SEARCH_ROUTE", admitted: true });
    }
  });

  it("rejects exact payoff repetition but names differing prose incomparable", () => {
    const retained = payoff({ id: "retained" });
    const restatement = payoff({
      id: "restatement",
      statement: "  A IMPLIES B in every settlement state. ",
      rationale: "THE RETAINED RULES establish the implication.",
    });
    expect(relationDiscoveryPayoffCoverageIdentity(restatement))
      .toBe(relationDiscoveryPayoffCoverageIdentity(retained));
    expect(classifyRelationDiscoverySemanticNovelty({
      candidate: restatement,
      retainedFindings: [retained],
    })).toMatchObject({
      classification: "REDUNDANT_PAYOFF_EVIDENCE",
      admitted: false,
      overlapFindingIds: [retained.findingId],
    });

    const incomparable = payoff({
      id: "incomparable",
      rationale: "A newly retained rule paragraph may establish the implication.",
    });
    expect(classifyRelationDiscoverySemanticNovelty({
      candidate: incomparable,
      retainedFindings: [retained],
    })).toMatchObject({
      classification: "INCOMPARABLE_PAYOFF_EVIDENCE",
      admitted: true,
      noveltyAuthority: "EXACT_STRUCTURED_COVERAGE_ONLY",
      semanticDecisionAuthority: false,
    });
  });

  it("admits a new payoff skeleton and summarizes only relevant structured coverage", () => {
    const retainedRoute = route({
      id: "lula",
      layer: "SUBJECT_REFERENCE",
      signals: ["Lula"],
    });
    const unrelated = payoff({ id: "unrelated", refs: ["venue:x", "venue:y"] });
    const candidate = payoff({ id: "candidate", relationKind: "MUTUALLY_EXCLUSIVE" });
    expect(classifyRelationDiscoverySemanticNovelty({
      candidate,
      retainedFindings: [unrelated],
    })).toMatchObject({ classification: "NOVEL_PAYOFF_EVIDENCE", admitted: true });

    const summary = buildRelationDiscoverySemanticCoverageSummary({
      retainedFindings: [retainedRoute, unrelated] as readonly RelationDiscoveryFinding[],
      seedListingRefs: ["gemini:lula-office"],
      searchSignals: ["Lula"],
    });
    expect(summary).toMatchObject({
      retainedFindingCount: 2,
      matchingCoverageCount: 1,
      returnedCoverageCount: 1,
      truncated: false,
      completeAdmissionCheckStillRequired: true,
      authority: "AGENT_SEARCH_GUIDANCE_ONLY",
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      writesStartedByRead: 0,
    });
    expect(summary.items[0]).toMatchObject({
      semanticDomain: "SEARCH_MEMORY",
      findingIds: [retainedRoute.findingId],
      routeQuery: { canonicalSearchSignals: ["lula"], searchFields: ["title"] },
      payoffSkeleton: null,
    });
    expect(JSON.stringify(summary)).not.toContain(retainedRoute.rationale);
  });

  it("projects accepted memory and exact rejected-effect evidence without side effects", () => {
    const retained = route({
      id: "retained-route",
      layer: "EVENT_REFERENCE",
      signals: ["Lula"],
    });
    const historicalRepeat = route({
      id: "historical-repeat",
      layer: "SUBJECT_REFERENCE",
      signals: ["LULA"],
    });
    const effectId = hash("effect:redundant-route");
    const runId = hash("run:redundant-route");
    const execution = Object.freeze({
      ...emptyAgentExecutionSnapshot(),
      toolEffects: Object.freeze([{
        schemaVersion: "pmh.agent-tool-effect.v2",
        effectId,
        runId,
        ordinal: 1,
        toolProtocol: "RELATION_DISCOVERY_AGENT_TOOLS_V1",
        toolName: "record_ontology_route",
        status: "REJECTED",
        canonicalInputHash: hash("input:redundant-route"),
        canonicalOutputHash: hash("output:redundant-route"),
        diagnostic: `semantic novelty admission rejected REDUNDANT_SEARCH_MEMORY; ` +
          `overlap finding ids: ${retained.findingId}`,
        occurredAt: "2026-08-13T01:00:00.000Z",
        semanticDecisionAuthority: false,
        certificateAuthority: false,
        externalWriteAuthority: false,
        valueMovingAuthority: false,
      } as const]),
    });
    expect(buildRelationDiscoverySemanticNoveltyProjection({
      observedAt: "2026-08-13T01:00:00.000Z",
      findings: [retained, historicalRepeat],
      execution,
    })).toMatchObject({
      retainedFindingCount: 2,
      retainedDecisionCount: 2,
      acceptedDecisionCount: 1,
      novelSearchRouteCount: 1,
      historicalRedundantRetainedCount: 1,
      redundantSearchMemoryRejectionCount: 1,
      redundantPayoffEvidenceRejectionCount: 0,
      exactRejectionCount: 1,
      admissionAffectedRunCount: 3,
      knownTotalTokens: "0",
      rejections: [{
        effectId,
        runId,
        classification: "REDUNDANT_SEARCH_MEMORY",
        overlapFindingIds: [retained.findingId],
        integrity: "EXACT",
      }],
      providerRequestsStartedByRead: 0,
      modelInvocationsStartedByRead: 0,
      writesStartedByRead: 0,
      automaticDispatch: false,
      semanticDecisionAuthority: false,
      executionAuthority: false,
    });
  });
});
