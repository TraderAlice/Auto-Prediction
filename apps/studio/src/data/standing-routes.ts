import { useCallback, useEffect, useRef, useState } from "react";

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
  selection: Readonly<{
    schemaVersion: "pmh.standing-route-family-selection-projection.v1";
    familyCount: number;
    adoptCount: number;
    holdCount: number;
    retireCount: number;
    quietReviewHorizonMs: string;
    unproductiveWakeMinimum: number;
    selections: ReadonlyArray<Readonly<{
      selectionId: string;
      routeFamilyId: string;
      recommendation: "ADOPT" | "HOLD" | "RETIRE";
      reason: string;
      rationale: string;
      missingObservation: string | null;
      nextReviewTrigger: string;
      seedConflictCount: number;
      cleanSeedCount: number;
      observedWakeCount: number;
      attemptedFollowupRunCount: number;
    }>>;
    providerRequestsStartedByRead: 0;
    modelInvocationsStartedByRead: 0;
    campaignsCreatedByRead: 0;
    runsCreatedByRead: 0;
    writesStartedByRead: 0;
    automaticMutation: false;
    automaticDispatch: false;
    authority: "ROUTE_PORTFOLIO_RECOMMENDATION_ONLY";
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

export type StandingRouteSeedPreview = Readonly<{
  schemaVersion: "pmh.standing-route-seed-campaign-preview.v1";
  previewIdentity: string;
  campaignKey: string;
  taskIds: readonly string[];
  preparedCampaignIds: readonly string[];
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  selection: Readonly<{
    selectionIdentity: string;
    consideredCandidateCount: number;
    selectedCandidateCount: number;
    heldCandidateCount: number;
    unusedLayers: readonly ("SUBJECT_REFERENCE" | "EVENT_REFERENCE" | "SETTLEMENT_REFERENCE")[];
    selected: ReadonlyArray<Readonly<{
      selectionActionRef: string;
      targetRouteLayer: "SUBJECT_REFERENCE" | "EVENT_REFERENCE" | "SETTLEMENT_REFERENCE";
      selectionReason: string;
      sourcePriority: number;
      seedListingEvidenceCount: number;
      expectedSearchFields: readonly string[];
    }>>;
    providerRequestsStarted: 0;
    modelInvocationsStarted: 0;
    campaignsCreated: 0;
    runsCreated: 0;
    automaticDispatch: false;
  }>;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
}>;

export type StandingRouteSeedOutcomes = Readonly<{
  schemaVersion: "pmh.standing-route-seed-outcome-projection.v1";
  projectionIdentity: string;
  observedAt: string;
  campaignCount: number;
  selectedActionCount: number;
  actedActionCount: number;
  terminalActionCount: number;
  routeRetainedActionCount: number;
  usefulNegativeMemoryActionCount: number;
  conflictingTerminalEffectActionCount: number;
  strata: ReadonlyArray<Readonly<{
    targetRouteLayer: "SUBJECT_REFERENCE" | "EVENT_REFERENCE" | "SETTLEMENT_REFERENCE";
    selectedActionCount: number;
    actedActionCount: number;
    terminalActionCount: number;
    routeRetainedActionCount: number;
    usefulNegativeMemoryActionCount: number;
    conflictingTerminalEffectActionCount: number;
    knownInputTokens: string;
    knownOutputTokens: string;
    knownReasoningTokens: string;
    terminalEvidenceMinimum: 3;
    yieldCostEstimateQualified: boolean;
  }>>;
  recurrenceQualification: Readonly<{
    representedLayerCount: number;
    qualifiedLayerCount: number;
    minimumTerminalActionsPerLayer: 3;
    yieldCostEvidenceSufficient: boolean;
    operatorActivationStillRequired: true;
  }>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DESCRIPTIVE_ROUTE_SEED_ATTRIBUTION_ONLY";
}>;

export function parseStandingRouteSeedOutcomes(value: unknown): StandingRouteSeedOutcomes {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Standing route seed outcomes are malformed");
  }
  const outcomes = value as StandingRouteSeedOutcomes;
  if (outcomes.schemaVersion !== "pmh.standing-route-seed-outcome-projection.v1" ||
      !Array.isArray(outcomes.strata) ||
      typeof outcomes.projectionIdentity !== "string" ||
      Number.isNaN(Date.parse(outcomes.observedAt)) ||
      !Number.isSafeInteger(outcomes.selectedActionCount) ||
      !Number.isSafeInteger(outcomes.conflictingTerminalEffectActionCount) ||
      outcomes.recurrenceQualification?.minimumTerminalActionsPerLayer !== 3 ||
      outcomes.recurrenceQualification.operatorActivationStillRequired !== true ||
      outcomes.providerRequestsStartedByRead !== 0 ||
      outcomes.modelInvocationsStartedByRead !== 0 ||
      outcomes.campaignsCreatedByRead !== 0 || outcomes.runsCreatedByRead !== 0 ||
      outcomes.writesStartedByRead !== 0 || outcomes.automaticDispatch !== false ||
      outcomes.authority !== "DESCRIPTIVE_ROUTE_SEED_ATTRIBUTION_ONLY") {
    throw new Error("Standing route seed outcomes crossed their bounded contract");
  }
  return outcomes;
}

export function parseStandingRouteSeedPreview(value: unknown): StandingRouteSeedPreview {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Standing route seed preview is malformed");
  }
  const preview = value as StandingRouteSeedPreview;
  if (preview.schemaVersion !== "pmh.standing-route-seed-campaign-preview.v1" ||
      typeof preview.previewIdentity !== "string" || !Array.isArray(preview.taskIds) ||
      !Array.isArray(preview.preparedCampaignIds) ||
      typeof preview.creationEligible !== "boolean" ||
      typeof preview.dispatchEligible !== "boolean" || typeof preview.diagnostic !== "string" ||
      !Array.isArray(preview.selection?.selected) ||
      !Array.isArray(preview.selection?.unusedLayers) ||
      preview.selection.selectedCandidateCount !== preview.selection.selected.length ||
      preview.selection.providerRequestsStarted !== 0 ||
      preview.selection.modelInvocationsStarted !== 0 ||
      preview.selection.campaignsCreated !== 0 || preview.selection.runsCreated !== 0 ||
      preview.selection.automaticDispatch !== false ||
      preview.providerRequestsStarted !== 0 || preview.modelInvocationsStarted !== 0 ||
      preview.automaticDispatch !== false) {
    throw new Error("Standing route seed preview crossed its bounded contract");
  }
  return preview;
}

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
    candidate.selection?.schemaVersion !==
      "pmh.standing-route-family-selection-projection.v1" ||
    !Array.isArray(candidate.families) || !Array.isArray(candidate.observationEpisodes) ||
    !Array.isArray(candidate.value.values) ||
    candidate.familyCount !== candidate.families.length ||
    candidate.observationEpisodeCount !== candidate.observationEpisodes.length ||
    candidate.value.familyCount !== candidate.value.values.length ||
    candidate.selection.familyCount !== candidate.selection.selections.length ||
    candidate.selection.familyCount !== candidate.familyCount ||
    candidate.selection.adoptCount + candidate.selection.holdCount +
      candidate.selection.retireCount !== candidate.selection.familyCount ||
    candidate.selection.selections.some((item) =>
      typeof item.routeFamilyId !== "string" ||
      !["ADOPT", "HOLD", "RETIRE"].includes(item.recommendation) ||
      typeof item.rationale !== "string" || typeof item.nextReviewTrigger !== "string"
    ) ||
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
    || candidate.selection.providerRequestsStartedByRead !== 0
    || candidate.selection.modelInvocationsStartedByRead !== 0
    || candidate.selection.campaignsCreatedByRead !== 0
    || candidate.selection.runsCreatedByRead !== 0
    || candidate.selection.writesStartedByRead !== 0
    || candidate.selection.automaticMutation !== false
    || candidate.selection.automaticDispatch !== false
    || candidate.selection.authority !== "ROUTE_PORTFOLIO_RECOMMENDATION_ONLY"
  ) throw new Error("Standing route desk crossed its bounded read contract");
  return candidate;
}

export type StandingRouteWorkspace = Readonly<{
  schemaVersion: "pmh.standing-route-workspace.v1";
  workspaceIdentity: string;
  sourceProjectionRevision: string;
  routeProjectionIdentity: string;
  seedOutcomeProjectionIdentity: string;
  seedPreviewIdentity: string | null;
  materializedAt: string;
  desk: StandingRouteDesk;
  seedPortfolio: Readonly<{
    preview:
      | Readonly<{ status: "AVAILABLE"; data: StandingRouteSeedPreview }>
      | Readonly<{ status: "UNAVAILABLE"; diagnostic: string }>;
    outcomes: StandingRouteSeedOutcomes;
  }>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  authority: "DERIVED_ROUTE_WORKSPACE_ONLY";
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export function parseStandingRouteWorkspace(value: unknown): StandingRouteWorkspace {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Standing route workspace is malformed");
  }
  const workspace = value as StandingRouteWorkspace;
  const preview = workspace.seedPortfolio?.preview;
  if (
    workspace.schemaVersion !== "pmh.standing-route-workspace.v1" ||
    typeof workspace.workspaceIdentity !== "string" ||
    !/^(?:0|[1-9]\d*)$/u.test(workspace.sourceProjectionRevision) ||
    typeof workspace.routeProjectionIdentity !== "string" ||
    typeof workspace.seedOutcomeProjectionIdentity !== "string" ||
    Number.isNaN(Date.parse(workspace.materializedAt)) ||
    (preview?.status !== "AVAILABLE" && preview?.status !== "UNAVAILABLE") ||
    workspace.providerRequestsStartedByRead !== 0 ||
    workspace.modelInvocationsStartedByRead !== 0 ||
    workspace.campaignsCreatedByRead !== 0 || workspace.runsCreatedByRead !== 0 ||
    workspace.writesStartedByRead !== 0 || workspace.automaticDispatch !== false ||
    workspace.authority !== "DERIVED_ROUTE_WORKSPACE_ONLY" ||
    workspace.executionAuthority !== false || workspace.externalWriteAuthority !== false ||
    workspace.valueMovingAuthority !== false
  ) throw new Error("Standing route workspace crossed its bounded read contract");
  parseStandingRouteDesk(workspace.desk);
  parseStandingRouteSeedOutcomes(workspace.seedPortfolio.outcomes);
  if (workspace.routeProjectionIdentity !== workspace.desk.projectionIdentity ||
      workspace.seedOutcomeProjectionIdentity !==
        workspace.seedPortfolio.outcomes.projectionIdentity) {
    throw new Error("Standing route workspace lost projection identity lineage");
  }
  if (preview.status === "AVAILABLE") {
    parseStandingRouteSeedPreview(preview.data);
    if (workspace.seedPreviewIdentity !== preview.data.previewIdentity) {
      throw new Error("Standing route workspace lost seed preview identity");
    }
  } else if (workspace.seedPreviewIdentity !== null ||
      typeof preview.diagnostic !== "string") {
    throw new Error("Standing route workspace malformed unavailable seed preview");
  }
  return workspace;
}

async function requestStandingRouteWorkspace(
  signal: AbortSignal,
): Promise<StandingRouteWorkspace> {
  const response = await fetch("/api/v1/market-ontology/standing-routes/workspace", {
    signal,
    headers: { accept: "application/json" },
  });
  const value = await response.json() as { diagnostic?: string };
  if (!response.ok) {
    throw new Error(value.diagnostic ?? `Standing route workspace returned HTTP ${response.status}`);
  }
  return parseStandingRouteWorkspace(value);
}

export function useStandingRouteWorkspace(revision: string) {
  const [data, setData] = useState<StandingRouteWorkspace | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    activeRequest.current?.abort();
    const abort = new AbortController();
    activeRequest.current = abort;
    setLoading(true);
    try {
      const workspace = await requestStandingRouteWorkspace(abort.signal);
      if (abort.signal.aborted) return;
      setData(workspace);
      setDiagnostic(null);
    } catch (error) {
      if (abort.signal.aborted) return;
      setDiagnostic(error instanceof Error ? error.message :
        "Standing route workspace is unavailable");
    } finally {
      if (activeRequest.current === abort) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, []);

  const prepare = useCallback(async (): Promise<void> => {
    setPreparing(true);
    try {
      const response = await fetch(
        "/api/v1/market-ontology/standing-routes/seed-campaigns",
        {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: "{}",
        },
      );
      const value = await response.json() as { diagnostic?: string };
      if (!response.ok) throw new Error(value.diagnostic ??
        `Seed campaign returned HTTP ${response.status}`);
      setDiagnostic("Paused route-seed campaign prepared. No model call was started.");
      await refresh();
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message :
        "Standing route seed campaign could not be prepared");
    } finally {
      setPreparing(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    return () => activeRequest.current?.abort();
  }, [refresh, revision]);

  return Object.freeze({ data, diagnostic, loading, preparing, refresh, prepare });
}
