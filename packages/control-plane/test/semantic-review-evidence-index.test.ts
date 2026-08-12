import { describe, expect, it } from "vitest";
import type { Hash } from "@pmh/domain";
import {
  enrichSemanticReviewCandidatesWithRuleEvidence,
  type RuleEvidenceClaim,
  type RuleEvidenceClaimRecord,
  type SemanticReviewCandidate,
  type ValidatedRuleEvidenceTextInput,
} from "../src/index.js";

const hash = (index: number): Hash =>
  `sha256:${index.toString(16).padStart(64, "0")}` as Hash;

const candidate = (index: number): SemanticReviewCandidate => ({
  proposal: { proposalId: hash(index) },
  proposalCorpusSnapshotIdentity: hash(100_000 + index),
  evidenceBundle: null,
  issueIds: [],
  priority: 3,
} as unknown as SemanticReviewCandidate);

const evidenceInput = (index: number): ValidatedRuleEvidenceTextInput => ({
  requirement: {
    proposalId: hash(index),
    requirementId: hash(10_000 + index),
  },
  source: {
    kind: "DOCUMENT_EXTRACTION",
    sourceArtifactId: hash(20_000 + index),
    textArtifactId: hash(30_000 + index),
  },
  semanticContinuity: null,
} as unknown as ValidatedRuleEvidenceTextInput);

const claimRecord = (index: number): RuleEvidenceClaimRecord => ({
  interpretationId: hash(40_000 + index),
  requirementId: hash(10_000 + index),
  proposalId: hash(index),
  documentId: hash(20_000 + index),
  extractionId: hash(30_000 + index),
  status: "PASS",
  completedAt: "2026-08-13T00:00:00.000Z",
  claim: { claimId: hash(50_000 + index) } as unknown as RuleEvidenceClaim,
} as unknown as RuleEvidenceClaimRecord);

describe("semantic review evidence index", () => {
  it("joins each proposal to its exact current evidence claim", () => {
    const enriched = enrichSemanticReviewCandidatesWithRuleEvidence({
      candidates: [candidate(1), candidate(2)],
      evidenceInputs: [evidenceInput(1), evidenceInput(2)],
      records: [claimRecord(2), claimRecord(1)],
      existingClaimsByProposal: new Map(),
    });

    expect(enriched.map((item) => item.evidenceClaims?.[0]?.claimId)).toEqual([
      hash(50_001),
      hash(50_002),
    ]);
  });

  it("retains the prior complete claim set when current evidence is incomplete", () => {
    const retained = { claimId: hash(99_999) } as unknown as RuleEvidenceClaim;
    const enriched = enrichSemanticReviewCandidatesWithRuleEvidence({
      candidates: [candidate(3)],
      evidenceInputs: [evidenceInput(3)],
      records: [],
      existingClaimsByProposal: new Map([[hash(3), [retained]]]),
    });

    expect(enriched[0]?.evidenceClaims).toEqual([retained]);
  });

  it("keeps durable growth linear enough for recurring scheduler ticks", () => {
    const size = 2_000;
    const candidates = Array.from({ length: size }, (_, index) => candidate(index + 1));
    const evidenceInputs = Array.from(
      { length: size },
      (_, index) => evidenceInput(index + 1),
    );
    const records = Array.from({ length: size }, (_, index) => claimRecord(index + 1));
    const startedAt = performance.now();

    const enriched = enrichSemanticReviewCandidatesWithRuleEvidence({
      candidates,
      evidenceInputs,
      records,
      existingClaimsByProposal: new Map(),
    });

    expect(enriched).toHaveLength(size);
    expect(enriched.at(-1)?.evidenceClaims?.[0]?.claimId).toBe(hash(50_000 + size));
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
