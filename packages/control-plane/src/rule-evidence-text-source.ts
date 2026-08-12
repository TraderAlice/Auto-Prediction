import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertCatalogContractTextEvidence,
  type CatalogContractTextEvidence,
} from "./catalog-contract-text-evidence.js";
import {
  assertEvidenceDocumentCapture,
  type EvidenceDocumentCapture,
} from "./evidence-document.js";
import {
  assertEvidenceRequirement,
  type EvidenceRequirement,
  type EvidenceRequirementKind,
} from "./evidence-requirement.js";
import {
  assertContractSemanticContinuity,
  type ContractSemanticContinuity,
} from "./contract-semantic-continuity.js";

const CATALOG_TEXT_REQUIREMENT_KINDS = Object.freeze([
  "RESOLUTION_RULE",
  "VOID_CANCELLATION",
  "ORACLE_SOURCE",
  "TIME_BOUNDARY",
  "OUTCOME_MAPPING",
] as const satisfies readonly EvidenceRequirementKind[]);

export function supportsCatalogRuleEvidenceRequirementKind(
  kind: EvidenceRequirementKind,
): boolean {
  return CATALOG_TEXT_REQUIREMENT_KINDS.includes(
    kind as (typeof CATALOG_TEXT_REQUIREMENT_KINDS)[number],
  );
}

export type RuleEvidenceTextInput =
  | Readonly<{
      requirement: EvidenceRequirement;
      capture: EvidenceDocumentCapture;
      catalogTextEvidence?: never;
    }>
  | Readonly<{
      requirement: EvidenceRequirement;
      capture?: never;
      catalogTextEvidence: CatalogContractTextEvidence;
      semanticContinuity?: ContractSemanticContinuity;
    }>;

export type RuleEvidenceTextSource = Readonly<{
  kind: "DOCUMENT_EXTRACTION" | "CATALOG_CONTRACT_TEXT";
  observationId: string;
  sourceArtifactId: Hash;
  textArtifactId: Hash;
  sourceRawHash: Hash;
  textHash: Hash;
  text: string;
  characterLength: number;
  receivedAt: string;
  listingRef: string | null;
  semanticContinuityId: Hash | null;
}>;

export type ValidatedRuleEvidenceTextInput = Readonly<{
  requirement: EvidenceRequirement;
  source: RuleEvidenceTextSource;
  capture: EvidenceDocumentCapture | null;
  catalogTextEvidence: CatalogContractTextEvidence | null;
  semanticContinuity: ContractSemanticContinuity | null;
}>;

export function validateRuleEvidenceTextInput(
  input: RuleEvidenceTextInput,
): ValidatedRuleEvidenceTextInput {
  const requirement = assertEvidenceRequirement(input.requirement);
  if (input.capture !== undefined) {
    const capture = assertEvidenceDocumentCapture(input.capture);
    if (
      requirement.acquisitionScopeIdentity !==
        capture.observation.acquisitionScopeIdentity ||
      !requirement.eligibleLocators.some(
        (binding) =>
          binding.locator.locatorIdentity ===
          capture.observation.locatorIdentity,
      ) ||
      capture.document.record.documentId !== capture.observation.documentId ||
      capture.extraction.record.documentId !== capture.document.record.documentId
    ) {
      throw new Error("rule evidence document input lineage is inconsistent");
    }
    return Object.freeze({
      requirement,
      capture,
      catalogTextEvidence: null,
      semanticContinuity: null,
      source: Object.freeze({
        kind: "DOCUMENT_EXTRACTION" as const,
        observationId: capture.observation.observationId,
        sourceArtifactId: capture.document.record.documentId,
        textArtifactId: capture.extraction.record.extractionId,
        sourceRawHash: capture.document.record.rawHash,
        textHash: capture.extraction.record.textHash,
        text: capture.extraction.text,
        characterLength: capture.extraction.record.characterLength,
        receivedAt: capture.observation.receivedAt,
        listingRef: null,
        semanticContinuityId: null,
      }),
    });
  }
  const evidence = assertCatalogContractTextEvidence(input.catalogTextEvidence);
  const continuity = input.semanticContinuity === undefined
    ? null
    : assertContractSemanticContinuity(input.semanticContinuity);
  const observation = requirement.sourceObservations.find(
    (item) => item.listingRef === evidence.listingRef,
  );
  if (
    !supportsCatalogRuleEvidenceRequirementKind(requirement.kind) ||
    requirement.temporalPosture !== "CURRENT" ||
    requirement.listingRefs.length !== 1 ||
    observation === undefined ||
    evidence.schemaVersion !== "pmh.catalog-contract-text-evidence.v2" ||
    (continuity === null
      ? observation.listingHash !== evidence.discoveryListingHash ||
        observation.sourceRawHash !== evidence.sourceRawHash ||
        observation.sourceReceivedAt !== evidence.receivedAt
      : continuity.priorListingHash !== observation.listingHash ||
        continuity.priorSourceRawHash !== observation.sourceRawHash ||
        continuity.priorSourceReceivedAt !== observation.sourceReceivedAt ||
        continuity.currentListingHash !== evidence.discoveryListingHash ||
        continuity.currentSourceRawHash !== evidence.sourceRawHash ||
        continuity.currentSourceReceivedAt !== evidence.receivedAt ||
        continuity.currentCatalogTextArtifactId !== evidence.artifactId ||
        continuity.listingRef !== evidence.listingRef) ||
    observation.venueId !== evidence.venueId ||
    observation.protocolIdentity !== evidence.protocolIdentity
  ) {
    throw new Error(
      "catalog contract text does not exactly satisfy the current requirement source",
    );
  }
  return Object.freeze({
    requirement,
    capture: null,
    catalogTextEvidence: evidence,
    semanticContinuity: continuity,
    source: Object.freeze({
      kind: "CATALOG_CONTRACT_TEXT" as const,
      observationId: evidence.catalogObservationId,
      sourceArtifactId: evidence.artifactId,
      textArtifactId: evidence.textHash,
      sourceRawHash: evidence.sourceRawHash,
      textHash: evidence.textHash,
      text: evidence.text,
      characterLength: evidence.characterLength,
      receivedAt: evidence.receivedAt,
      listingRef: evidence.listingRef,
      semanticContinuityId: continuity?.continuityId ?? null,
    }),
  });
}

export function ruleEvidenceTextSupplyIdentity(
  input: RuleEvidenceTextInput,
): Hash {
  const validated = validateRuleEvidenceTextInput(input);
  return hashCanonical({
    schemaVersion: "pmh.rule-evidence-text-supply.v1",
    requirementId: validated.requirement.requirementId,
    source: validated.source,
  });
}

export function ruleEvidenceTextInputFromValidated(
  validated: ValidatedRuleEvidenceTextInput,
): RuleEvidenceTextInput {
  return validated.source.kind === "DOCUMENT_EXTRACTION"
    ? Object.freeze({
        requirement: validated.requirement,
        capture: validated.capture!,
      })
    : Object.freeze({
        requirement: validated.requirement,
        catalogTextEvidence: validated.catalogTextEvidence!,
        ...(validated.semanticContinuity === null
          ? {}
          : { semanticContinuity: validated.semanticContinuity }),
      });
}
