import { useCallback, useEffect, useState } from "react";

export type StandingRouteState =
  | "QUIESCENT"
  | "EXPANDED"
  | "CHANGED"
  | "CONTRACTED"
  | "BLOCKED_TOO_BROAD";

export type StandingRouteUsage = Readonly<{
  runCount: number;
  invocationCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  unknownInputInvocationCount: number;
  unknownOutputInvocationCount: number;
  unknownReasoningInvocationCount: number;
}>;

export type StandingRouteDesk = Readonly<{
  schemaVersion: "pmh.standing-ontology-route-projection.v1";
  projectionIdentity: string;
  currentCorpusSnapshotIdentity: string;
  routeCount: number;
  familyCount: number;
  corroboratedFamilyCount: number;
  baselineDisagreementFamilyCount: number;
  followupEligibleFamilyCount: number;
  followupCount: number;
  observationEpisodeCount: number;
  families: ReadonlyArray<Readonly<{
    family: Readonly<{
      routeFamilyId: string;
      routeLayer: "SUBJECT_REFERENCE" | "EVENT_REFERENCE" | "SETTLEMENT_REFERENCE";
      canonicalSearchSignals: readonly string[];
      searchFields: readonly string[];
      sourceRouteIds: readonly string[];
      sourceFindingIds: readonly string[];
      authoringRunIds: readonly string[];
      sourceCount: number;
      nativeSourceCount: number;
      legacySourceCount: number;
      baselineDisagreement: boolean;
      firstRecordedAt: string;
      lastRecordedAt: string;
    }>;
    observation: Readonly<{
      observationId: string;
      state: StandingRouteState;
      currentListingRefs: readonly string[];
      addedListingRefs: readonly string[];
      removedListingRefs: readonly string[];
      changedListingRefs: readonly string[];
      followupEligible: boolean;
    }>;
  }>>;
  observationEpisodes: ReadonlyArray<Readonly<{
    episodeId: string;
    routeFamilyId: string;
    previousEpisodeId: string | null;
    observedAt: string;
    state: StandingRouteState;
    currentListingRefs: readonly string[];
    addedListingRefs: readonly string[];
    removedListingRefs: readonly string[];
    changedListingRefs: readonly string[];
    followupEligible: boolean;
  }>>;
  value: Readonly<{
    schemaVersion: "pmh.standing-ontology-route-value-projection.v2";
    observedAt: string;
    familyCount: number;
    totalCreationUsage: StandingRouteUsage;
    totalFollowupUsage: StandingRouteUsage;
    values: ReadonlyArray<Readonly<{
      valueId: string;
      routeFamilyId: string;
      currentState: StandingRouteState;
      quietDurationMs: string | null;
      totalQuietDurationMs: string;
      firstObservedAt: string | null;
      lastTransitionAt: string | null;
      observationEpisodeCount: number;
      sourceCount: number;
      observedWakeCount: number;
      creationUsage: StandingRouteUsage;
      followupUsage: StandingRouteUsage;
      followupWorkItemIds: readonly string[];
      followupRunIds: readonly string[];
      positiveFindingIds: readonly string[];
      counterexampleIds: readonly string[];
      semanticProposalIds: readonly string[];
      semanticReviewJobIds: readonly string[];
      semanticReviewPassCount: number;
      probabilityJobIds: readonly string[];
      opportunityIds: readonly string[];
      valueStage: string;
    }>>;
    providerRequestsStartedByRead: 0;
    modelInvocationsStartedByRead: 0;
    automaticDispatch: false;
    authority: "DESCRIPTIVE_ROUTE_VALUE_ATTRIBUTION_ONLY";
    causalClaim: false;
    executionAuthority: false;
    externalWriteAuthority: false;
    valueMovingAuthority: false;
  }>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  automaticDispatch: false;
  authority: "SEARCH_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const STATES = Object.freeze([
  "QUIESCENT", "EXPANDED", "CHANGED", "CONTRACTED", "BLOCKED_TOO_BROAD",
] as const);

function isRouteState(value: unknown): value is StandingRouteState {
  return STATES.includes(value as StandingRouteState);
}

function validUsage(value: StandingRouteUsage | undefined): boolean {
  return value !== undefined && Number.isSafeInteger(value.runCount) && value.runCount >= 0 &&
    Number.isSafeInteger(value.invocationCount) && value.invocationCount >= 0 &&
    [value.knownInputTokens, value.knownOutputTokens, value.knownReasoningTokens]
      .every((item) => /^(?:0|[1-9]\d*)$/u.test(item));
}

export function parseStandingRouteDesk(value: unknown): StandingRouteDesk {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Standing route desk is malformed");
  }
  const candidate = value as StandingRouteDesk;
  if (
    candidate.schemaVersion !== "pmh.standing-ontology-route-projection.v1" ||
    candidate.value?.schemaVersion !== "pmh.standing-ontology-route-value-projection.v2" ||
    !Array.isArray(candidate.families) || !Array.isArray(candidate.observationEpisodes) ||
    !Array.isArray(candidate.value.values) ||
    candidate.familyCount !== candidate.families.length ||
    candidate.observationEpisodeCount !== candidate.observationEpisodes.length ||
    candidate.value.familyCount !== candidate.value.values.length ||
    candidate.families.some((item) =>
      typeof item.family?.routeFamilyId !== "string" ||
      !Array.isArray(item.family.canonicalSearchSignals) ||
      !isRouteState(item.observation?.state) ||
      !Array.isArray(item.observation.currentListingRefs)
    ) ||
    candidate.observationEpisodes.some((item) =>
      typeof item.episodeId !== "string" || typeof item.routeFamilyId !== "string" ||
      !isRouteState(item.state) || Number.isNaN(Date.parse(item.observedAt))
    ) ||
    candidate.value.values.some((item) =>
      typeof item.routeFamilyId !== "string" || !isRouteState(item.currentState) ||
      !Number.isSafeInteger(item.observedWakeCount) || item.observedWakeCount < 0 ||
      !validUsage(item.creationUsage) || !validUsage(item.followupUsage)
    ) ||
    !validUsage(candidate.value.totalCreationUsage) ||
    !validUsage(candidate.value.totalFollowupUsage) ||
    candidate.providerRequestsStartedByRead !== 0 ||
    candidate.modelInvocationsStartedByRead !== 0 ||
    candidate.campaignsCreatedByRead !== 0 || candidate.runsCreatedByRead !== 0 ||
    candidate.automaticDispatch !== false || candidate.authority !== "SEARCH_ROUTING_ONLY" ||
    candidate.semanticDecisionAuthority !== false || candidate.probabilityAuthority !== false ||
    candidate.certificateAuthority !== false || candidate.executionAuthority !== false ||
    candidate.externalWriteAuthority !== false || candidate.valueMovingAuthority !== false ||
    candidate.value.providerRequestsStartedByRead !== 0 ||
    candidate.value.modelInvocationsStartedByRead !== 0 ||
    candidate.value.automaticDispatch !== false || candidate.value.causalClaim !== false ||
    candidate.value.executionAuthority !== false ||
    candidate.value.externalWriteAuthority !== false ||
    candidate.value.valueMovingAuthority !== false
  ) throw new Error("Standing route desk crossed its bounded read contract");
  return candidate;
}

async function requestStandingRouteDesk(): Promise<StandingRouteDesk> {
  const response = await fetch("/api/v1/market-ontology/standing-routes", {
    headers: { accept: "application/json" },
  });
  const value = await response.json() as { diagnostic?: string };
  if (!response.ok) {
    throw new Error(value.diagnostic ?? `Standing routes returned HTTP ${response.status}`);
  }
  return parseStandingRouteDesk(value);
}

export function useStandingRouteDesk(revision: string) {
  const [data, setData] = useState<StandingRouteDesk | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setData(await requestStandingRouteDesk());
      setDiagnostic(null);
    } catch (error) {
      setData(null);
      setDiagnostic(error instanceof Error ? error.message : "Standing routes are unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, revision]);

  return Object.freeze({ data, diagnostic, loading, refresh });
}
