import type { Hash } from "@pmh/domain";
import type { RuleEvidenceClaimRecord } from "./rule-evidence-claim.js";
import type { ValidatedRuleEvidenceTextInput } from "./rule-evidence-text-source.js";
import type { SemanticReviewCandidate } from "./semantic-review-scheduler.js";

function recordMatchesInput(
  record: RuleEvidenceClaimRecord,
  input: ValidatedRuleEvidenceTextInput,
): boolean {
  if (input.source.kind === "CATALOG_CONTRACT_TEXT") {
    return "sourceKind" in record && (
      record.sourceArtifactId === input.source.sourceArtifactId &&
        record.textArtifactId === input.source.textArtifactId ||
      record.claim?.schemaVersion === "pmh.rule-evidence-claim.v4" &&
        input.semanticContinuity !== null &&
        record.claim.contractSemanticIdentity ===
          input.semanticContinuity.contractSemanticIdentity &&
        record.claim.textHash === input.source.textHash
    );
  }
  return !("sourceKind" in record) &&
    record.documentId === input.source.sourceArtifactId &&
    record.extractionId === input.source.textArtifactId;
}

/**
 * Joins current evidence inputs and retained claims onto semantic candidates.
 *
 * This is deliberately an indexed relational join. The scheduler runs for the
 * lifetime of the control plane, so repeatedly filtering every input and every
 * historical claim for every proposal turns durable growth into an O(P*I*R)
 * event-loop stall.
 */
export function enrichSemanticReviewCandidatesWithRuleEvidence(input: Readonly<{
  candidates: readonly SemanticReviewCandidate[];
  evidenceInputs: readonly ValidatedRuleEvidenceTextInput[];
  records: readonly RuleEvidenceClaimRecord[];
  existingClaimsByProposal: ReadonlyMap<Hash, SemanticReviewCandidate["evidenceClaims"]>;
}>): readonly SemanticReviewCandidate[] {
  const inputsByProposal = new Map<Hash, ValidatedRuleEvidenceTextInput[]>();
  for (const evidenceInput of input.evidenceInputs) {
    const retained = inputsByProposal.get(evidenceInput.requirement.proposalId) ?? [];
    retained.push(evidenceInput);
    inputsByProposal.set(evidenceInput.requirement.proposalId, retained);
  }

  const recordsByRequirement = new Map<Hash, RuleEvidenceClaimRecord[]>();
  for (const record of input.records) {
    if (record.status !== "PASS" || record.claim === null) continue;
    const retained = recordsByRequirement.get(record.requirementId) ?? [];
    retained.push(record);
    recordsByRequirement.set(record.requirementId, retained);
  }
  for (const records of recordsByRequirement.values()) {
    records.sort((left, right) =>
      String(right.completedAt).localeCompare(String(left.completedAt)) ||
      right.interpretationId.localeCompare(left.interpretationId)
    );
  }

  return Object.freeze(input.candidates.map((candidate) => {
    const proposalInputs = inputsByProposal.get(candidate.proposal.proposalId) ?? [];
    const inputsByRequirement = new Map<Hash, ValidatedRuleEvidenceTextInput[]>();
    for (const evidenceInput of proposalInputs) {
      const retained = inputsByRequirement.get(evidenceInput.requirement.requirementId) ?? [];
      retained.push(evidenceInput);
      inputsByRequirement.set(evidenceInput.requirement.requirementId, retained);
    }
    const claims = [...inputsByRequirement.entries()].flatMap(([requirementId, supplies]) => {
      const record = (recordsByRequirement.get(requirementId) ?? []).find((candidateRecord) =>
        supplies.some((supply) => recordMatchesInput(candidateRecord, supply))
      );
      return record?.claim === null || record?.claim === undefined ? [] : [record.claim];
    });
    const completeCurrentSet = inputsByRequirement.size > 0 &&
      claims.length === inputsByRequirement.size;
    const retainedClaims = completeCurrentSet
      ? claims
      : input.existingClaimsByProposal.get(candidate.proposal.proposalId) ?? [];
    return Object.freeze({
      ...candidate,
      ...(retainedClaims.length === 0
        ? {}
        : { evidenceClaims: Object.freeze(retainedClaims) }),
    });
  }));
}
