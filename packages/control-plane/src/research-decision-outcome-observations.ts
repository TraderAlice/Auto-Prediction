import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertResearchDecisionOutcome,
  researchDecisionOutcomeStateIdentity,
  type ResearchDecisionOutcome,
} from "./research-decision-outcomes.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export type ResearchDecisionOutcomeObservationTrigger =
  | "STARTUP_RECONCILIATION"
  | "CAMPAIGN_MEMBERSHIP_RECONCILIATION"
  | "AGENT_TASK_COMPLETION"
  | "CATALOG_RECONCILIATION"
  | "DISCOVERY_CYCLE"
  | "OPERATOR_DECISION_CAPTURE";

const TRIGGERS: readonly ResearchDecisionOutcomeObservationTrigger[] = Object.freeze([
  "STARTUP_RECONCILIATION",
  "CAMPAIGN_MEMBERSHIP_RECONCILIATION",
  "AGENT_TASK_COMPLETION",
  "CATALOG_RECONCILIATION",
  "DISCOVERY_CYCLE",
  "OPERATOR_DECISION_CAPTURE",
]);

export type ResearchDecisionOutcomeObservation = Readonly<{
  schemaVersion: "pmh.research-decision-outcome-observation.v1";
  observationId: Hash;
  stateIdentity: Hash;
  previousObservationId: Hash | null;
  boundaryEpisodeId: Hash | null;
  episodeId: Hash;
  workItemId: Hash | null;
  observedAt: string;
  trigger: ResearchDecisionOutcomeObservationTrigger;
  triggerRef: string;
  outcome: ResearchDecisionOutcome;
  authority: "APPEND_ONLY_RESEARCH_OBSERVATION";
  providerRequestsStartedByCapture: 0;
  modelInvocationsStartedByCapture: 0;
  fetchesStartedByCapture: 0;
  campaignsActivatedByCapture: 0;
  runsStartedByCapture: 0;
  schedulerDispatchesStartedByCapture: 0;
  semanticDecisionAuthority: false;
  policyMutationAuthority: false;
  automaticDispatch: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export interface ResearchDecisionOutcomeObservationStore {
  loadResearchDecisionOutcomeObservations(
    limit: number,
  ): readonly ResearchDecisionOutcomeObservation[];
  loadResearchDecisionOutcomeObservation(
    observationId: Hash,
  ): ResearchDecisionOutcomeObservation | null;
  loadLatestResearchDecisionOutcomeObservation(
    episodeId: Hash,
  ): ResearchDecisionOutcomeObservation | null;
  saveResearchDecisionOutcomeObservation(
    observation: ResearchDecisionOutcomeObservation,
  ): ResearchDecisionOutcomeObservation;
}

export function buildResearchDecisionOutcomeObservation(input: Readonly<{
  previous: ResearchDecisionOutcomeObservation | null;
  outcome: ResearchDecisionOutcome;
  observedAt: string;
  trigger: ResearchDecisionOutcomeObservationTrigger;
  triggerRef: string;
  boundaryEpisodeId?: Hash | null;
}>): ResearchDecisionOutcomeObservation {
  const outcome = assertResearchDecisionOutcome(input.outcome);
  if (outcome.observedAt !== input.observedAt) {
    throw new Error("outcome observation time must match its embedded outcome");
  }
  if (input.previous !== null && input.previous.episodeId !== outcome.episodeId) {
    throw new Error("outcome observation predecessor belongs to another episode");
  }
  const boundaryEpisodeId = input.boundaryEpisodeId ?? null;
  if (boundaryEpisodeId === outcome.episodeId) {
    throw new Error("outcome observation cannot be bounded by its own episode");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.research-decision-outcome-observation.v1" as const,
    stateIdentity: researchDecisionOutcomeObservationStateIdentity(
      outcome,
      boundaryEpisodeId,
    ),
    previousObservationId: input.previous?.observationId ?? null,
    boundaryEpisodeId,
    episodeId: outcome.episodeId,
    workItemId: outcome.workItemId,
    observedAt: input.observedAt,
    trigger: input.trigger,
    triggerRef: input.triggerRef,
    outcome,
    authority: "APPEND_ONLY_RESEARCH_OBSERVATION" as const,
    providerRequestsStartedByCapture: 0 as const,
    modelInvocationsStartedByCapture: 0 as const,
    fetchesStartedByCapture: 0 as const,
    campaignsActivatedByCapture: 0 as const,
    runsStartedByCapture: 0 as const,
    schedulerDispatchesStartedByCapture: 0 as const,
    semanticDecisionAuthority: false as const,
    policyMutationAuthority: false as const,
    automaticDispatch: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    externalWriteAuthority: false as const,
    valueMovingAuthority: false as const,
  });
  return assertResearchDecisionOutcomeObservation(Object.freeze({
    ...body,
    observationId: hashCanonical(body),
  }));
}

export function researchDecisionOutcomeObservationStateIdentity(
  outcomeInput: ResearchDecisionOutcome,
  boundaryEpisodeId: Hash | null,
): Hash {
  const outcome = assertResearchDecisionOutcome(outcomeInput);
  if (boundaryEpisodeId !== null && !HASH_PATTERN.test(String(boundaryEpisodeId))) {
    throw new Error("outcome observation boundary episode identity is invalid");
  }
  return hashCanonical({
    schemaVersion: "pmh.research-decision-outcome-observation-state.v1",
    outcomeStateIdentity: researchDecisionOutcomeStateIdentity(outcome),
    boundaryEpisodeId,
  });
}

export function assertResearchDecisionOutcomeObservation(
  value: unknown,
): ResearchDecisionOutcomeObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("research decision outcome observation is malformed");
  }
  const item = value as ResearchDecisionOutcomeObservation;
  const outcome = assertResearchDecisionOutcome(item.outcome);
  const { observationId: _observationId, ...body } = item;
  const observedAtMs = Date.parse(String(item.observedAt));
  if (item.schemaVersion !== "pmh.research-decision-outcome-observation.v1" ||
      !HASH_PATTERN.test(String(item.observationId)) ||
      !HASH_PATTERN.test(String(item.stateIdentity)) ||
      !HASH_PATTERN.test(String(item.episodeId)) ||
      (item.previousObservationId !== null &&
        !HASH_PATTERN.test(String(item.previousObservationId))) ||
      (item.boundaryEpisodeId !== null &&
        !HASH_PATTERN.test(String(item.boundaryEpisodeId))) ||
      (item.workItemId !== null && !HASH_PATTERN.test(String(item.workItemId))) ||
      !Number.isFinite(observedAtMs) ||
      new Date(observedAtMs).toISOString() !== item.observedAt ||
      !TRIGGERS.includes(item.trigger) ||
      typeof item.triggerRef !== "string" || item.triggerRef.length < 1 ||
      item.triggerRef.length > 200 || outcome.episodeId !== item.episodeId ||
      outcome.workItemId !== item.workItemId || outcome.observedAt !== item.observedAt ||
      item.boundaryEpisodeId === item.episodeId ||
      item.stateIdentity !== researchDecisionOutcomeObservationStateIdentity(
        outcome,
        item.boundaryEpisodeId,
      ) ||
      item.previousObservationId === item.observationId ||
      item.authority !== "APPEND_ONLY_RESEARCH_OBSERVATION" ||
      item.providerRequestsStartedByCapture !== 0 ||
      item.modelInvocationsStartedByCapture !== 0 ||
      item.fetchesStartedByCapture !== 0 || item.campaignsActivatedByCapture !== 0 ||
      item.runsStartedByCapture !== 0 ||
      item.schedulerDispatchesStartedByCapture !== 0 ||
      item.semanticDecisionAuthority !== false || item.policyMutationAuthority !== false ||
      item.automaticDispatch !== false || item.certificateAuthority !== false ||
      item.executionAuthority !== false || item.externalWriteAuthority !== false ||
      item.valueMovingAuthority !== false ||
      item.observationId !== hashCanonical(body)) {
    throw new Error("research decision outcome observation violates its bounded contract");
  }
  return Object.freeze(item);
}
