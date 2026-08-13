import { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  Boxes,
  ChevronRight,
  CircleOff,
  Clock3,
  Command,
  Database,
  FileCheck2,
  FileSearch,
  Fingerprint,
  Gauge,
  GitBranch,
  Hexagon,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  LoaderCircle,
  Menu,
  Network,
  PanelRightClose,
  Pause,
  Play,
  Plus,
  Radar,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  TestTubeDiagonal,
  Bot,
  TimerReset,
  Waypoints,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  StudioProjectionProvider,
  resolveReviewIntake,
  useControlPlaneProjection,
  useControlPlaneReadiness,
  useStudioProjection,
  type ProjectionSyncState,
  type StartupReadiness,
  type StudioProjection,
} from "@/data/studio-projection";
import { buildOpportunityFrontier } from "@/data/opportunity-frontier";
import { useDiscoveryExecutionCapability } from "@/data/discovery-execution";
import {
  useStandingRouteWorkspace,
  type StandingRouteState,
  type StandingRouteUsage,
} from "@/data/standing-routes";
import { cn } from "@/lib/utils";
import {
  parseWorkspaceRoute,
  serializeWorkspaceRoute,
  workspaceReadModel,
  type WorkspaceView,
} from "@/lib/workspace-route";

type View = WorkspaceView;
type Opportunity = StudioProjection["opportunities"][number];
type ResearchCase = StudioProjection["ai"]["researchDesk"]["cases"][number];
type RadarCandidate = StudioProjection["ai"]["opportunityRadar"]["candidates"][number];
type SearchIssue = StudioProjection["ai"]["searchIssueScheduler"]["issues"][number];
type SearchAttentionMessage = StudioProjection["ai"]["searchAttention"]["messages"][number];
type CatalogMode = "VERIFIED_FIXTURES" | "CURRENT_OBSERVATIONS";
type AiRuntimeConfiguration =
  StudioProjection["ai"]["runtimeConfiguration"]["configuration"];
type AgentExecutionConsole = Readonly<{
  schemaVersion: "pmh.agent-execution-console.v1";
  summary: Readonly<{
    runtimeDefinitionCount: number;
    credentialBindingCount: number;
    modelProfileCount: number;
    executionProfileCount: number;
    taskCount: number;
    runCount: number;
    modelInvocationCount: number;
    runArtifactCount: number;
    runAnnotationCount: number;
    activeCampaignCount: number;
  }>;
  runtimeDefinitions: ReadonlyArray<Readonly<{
    runtimeDefinitionId: string;
    kind: "PI" | "CODEX" | "HARNESS_IN_PROCESS";
    version: string;
    capabilities: Readonly<{ resume: boolean; compaction: boolean; cancellation: boolean }>;
  }>>;
  credentialBindings: ReadonlyArray<Readonly<{
    credentialBindingId: string;
    kind: string;
    logicalAccountRef: string;
    configuration: null | Readonly<{
      status: "CONFIGURED" | "MISSING";
      diagnostic: string | null;
    }>;
  }>>;
  modelProfiles: ReadonlyArray<Readonly<{
    modelProfileId: string;
    profileKey: string;
    revision: number;
    accessDriver: string;
    model: string;
    configuration: unknown;
    createdAt: string;
  }>>;
  executionProfiles: ReadonlyArray<Readonly<{
    executionProfileId: string;
    profileKey: string;
    revision: number;
    runtimeDefinitionId: string;
    credentialBindingId: string;
    modelProfileId: string;
    toolPolicy: Readonly<{ protocol: string }>;
    runBudget: Readonly<{
      maximumModelInvocations: number;
      maximumInputTokens: string | null;
      maximumOutputTokens: string | null;
      maximumWallClockMs: number;
    }>;
    createdAt: string;
  }>>;
  capabilities: ReadonlyArray<Readonly<{
    executionProfileId: string;
    configurationStatus: "CONFIGURED" | "MISSING";
    runtimeStatus: "AVAILABLE" | "UNAVAILABLE";
    serviceCapability: "USABLE" | "REJECTED" | "TRANSIENT_FAILURE" | "UNVERIFIED" | "STALE";
    dispatchEligibility: "ELIGIBLE" | "BLOCKED";
    diagnostic: string;
    observation: null | Readonly<{ observedAt: string; validUntil: string }>;
    inferenceRequestsStarted: 0;
    modelInvocationsStarted: 0;
    secretMaterialRetained: false;
  }>>;
  workloadRoutes: ReadonlyArray<Readonly<{
    workloadRouteId: string;
    routeKey: string;
    revision: number;
    taskKind: string;
    executionProfileId: string;
    automaticDispatch: false;
  }>>;
  campaigns: ReadonlyArray<Readonly<{
    schemaVersion: "pmh.agent-campaign.v1" | "pmh.agent-campaign.v2" |
      "pmh.agent-campaign.v3" | "pmh.agent-campaign.v4";
    campaignId: string;
    campaignKey: string;
    revision: number;
    status: "PAUSED" | "ACTIVE";
    superseded: boolean;
    executionProfileId: string;
    taskIds: readonly string[];
    membershipPolicyBinding?: Readonly<{
      membershipPolicyIdentity: string;
      selectionProtocol: string;
      selectionPolicyIdentity: string;
    }>;
    schedule: Readonly<{ kind: "MANUAL_ONLY" | "INTERVAL"; intervalMs: number | null }>;
    budget: Readonly<{
      maximumConcurrentRuns: number;
      maximumModelInvocations: number;
      maximumInputTokens: string | null;
      maximumOutputTokens: string | null;
      maximumWallClockMs: number;
    }>;
    preview: null | Readonly<{
      maximumImmediateFanout: number;
      consumedModelInvocations: number;
      remainingModelInvocations: number;
      activeRunCount: number;
    }>;
  }>>;
  tasks: ReadonlyArray<Readonly<{
    taskId: string;
    kind: string;
    protocol: string;
    provenanceRef: string;
    priority: number;
    createdAt: string;
    readiness: Readonly<{
      status: "RUNNABLE" | "SUPERSEDED_INPUT" | "HISTORICAL_ONLY";
      diagnostic: string;
      successorTaskId: string | null;
    }>;
  }>>;
  runs: ReadonlyArray<Readonly<{
    runId: string;
    taskId: string;
    executionProfileId: string;
    runOrdinal: number;
    authorization: Readonly<{ kind: "MANUAL" | "CAMPAIGN" | "LEGACY_IMPORT" }>;
    status: "PREPARED" | "INTERRUPTED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
    createdAt: string;
    completedAt: string | null;
    terminalDiagnostic: string | null;
  }>>;
  modelInvocations: ReadonlyArray<Readonly<{
    invocationId: string;
    runId: string;
    accessDriver: string;
    status: string;
    inputTokens: string | null;
    outputTokens: string | null;
    reasoningTokens: string | null;
    failureCategory?: string | null;
    diagnostic?: string | null;
    purpose?: "PRIMARY_REASONING" | "TOOL_CONTINUATION" | "RESULT_REPAIR";
    repairContext?: Readonly<{
      attemptOrdinal: number;
      rejectedResultEffectIds: readonly string[];
    }> | null;
    completedAt: string;
  }>>;
  usage: Readonly<{
    invocationCount: number;
    inputTokens: string;
    outputTokens: string;
    reasoningTokens: string;
    incompleteTokenInvocationCount: number;
    currencyCost: null;
    currencyCostDiagnostic: string;
    byRuntimeModelPurpose: ReadonlyArray<Readonly<{
      runtimeKind: string;
      model: string;
      taskKind: string;
      invocationPurpose: string;
      invocationCount: number;
      failedInvocationCount: number;
      inputTokens: string;
      outputTokens: string;
      reasoningTokens: string;
    }>>;
    byDay: ReadonlyArray<Readonly<{
      day: string;
      invocationCount: number;
      inputTokens: string;
      outputTokens: string;
    }>>;
  }>;
  incidentCounts: Readonly<Record<string, number>>;
  credentialSecretTextRetained: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type ResearchAttentionAllocation = Readonly<{
  schemaVersion: "pmh.research-attention-allocation.v1";
  projectionIdentity: string;
  observedAt: string;
  familyCount: number;
  actionableFamilyCount: number;
  heldFamilyCount: number;
  omittedActionableFamilyCount: number;
  laneCounts: Readonly<{
    exploration: number;
    falsificationOrDebt: number;
    changedEvidenceRecheck: number;
    ontologyMutation: number;
  }>;
  recurrenceQualification: Readonly<{
    terminalRelationRunCount: number;
    attemptedStableFamilyCount: number;
    independentlyReviewedPositiveFindingCount: number;
    usageComplete: boolean;
    evidenceThresholdSatisfied: boolean;
    operatorActivationStillRequired: true;
  }>;
  families: ReadonlyArray<Readonly<{
    workItemId: string;
    workKind: string;
    runCount: number;
    positiveFindingCount: number;
    counterexampleCount: number;
    semanticReviewPassCount: number;
    valueStage: string;
    nextActionKind: string;
    nextActionEligible: boolean;
    usage: Readonly<{
      knownInputTokens: string;
      knownOutputTokens: string;
      incompleteUsagePenalized: boolean;
    }>;
  }>>;
  portfolio: ReadonlyArray<Readonly<{
    actionId: string;
    lane: string;
    kind: string;
    workItemId: string | null;
    taskId: string | null;
    targetArtifactRefs: readonly string[];
    valueStage: string;
    noveltyReason: string;
    diagnostic: string;
    dispatchableByRelationCampaign: boolean;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  automaticDispatch: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type RelationDiscoveryCampaignPreview = Readonly<{
  schemaVersion: "pmh.relation-discovery-campaign-preview.v1";
  campaignKey: string;
  workItemIds: readonly string[];
  taskIds: readonly string[];
  allocationProjectionIdentity: string;
  allocationPolicyIdentity: string;
  allocationActionIds: readonly string[];
  preparedCampaignIds: readonly string[];
  intentCampaignId: string | null;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type ResearchActionTargetProjection = Readonly<{
  schemaVersion: "pmh.research-action-target-projection.v1";
  projectionIdentity: string;
  allocationProjectionIdentity: string;
  selectedActionCount: number;
  targetCount: number;
  readyCount: number;
  inFlightCount: number;
  blockedNegativeSearchCount: number;
  unresolvedCount: number;
  targets: ReadonlyArray<Readonly<{
    targetId: string;
    allocationActionId: string;
    proposalId: string | null;
    semanticReviewJobId: string | null;
    requirementId: string | null;
    requirementKind: string | null;
    acquisitionRoute: string | null;
    downstreamSystem: string;
    state: string;
    sourceTaskId: string | null;
    currentJobId: string | null;
    currentJobStatus: string | null;
    priorNegativeJobIds: readonly string[];
    retainedCost: Readonly<{
      providerRequestCount: number;
      toolCallCount: number;
      fetchAttemptCount: number;
      interpretationAttemptCount: number;
    }>;
    manualOperation: Readonly<{
      available: boolean;
      kind: string;
      targetId: string | null;
    }>;
    noveltyGate: string;
    diagnostic: string;
    automaticDispatch: false;
    providerRequestAuthority: false;
    fetchAuthority: false;
    externalWriteAuthority: false;
    valueMovingAuthority: false;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  fetchesStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  schedulerDispatchesStartedByRead: 0;
  automaticDispatch: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type ResearchDecisionOutcomeProjection = Readonly<{
  schemaVersion: "pmh.research-decision-outcome-projection.v1";
  projectionIdentity: string;
  observedAt: string;
  episodeCount: number;
  outcomeCounts: Readonly<Record<string, number>>;
  outcomes: ReadonlyArray<Readonly<{
    outcomeId: string;
    episodeId: string;
    capturedAt: string;
    allocationActionId: string;
    noveltyReason: string;
    targetId: string;
    workItemId: string | null;
    state: string;
    attributionBasis: "NOT_ACTED" | "TARGET_LINEAGE_OBSERVED";
    baselineValueStage: string;
    currentValueStage: string | null;
    valueStageDelta: number | null;
    currentTargetState: string | null;
    newArtifactRefs: readonly string[];
    antiLoopMemory: Readonly<{
      newCounterexampleCount: number;
      newNoFindingTerminalRunCount: number;
      newSuccessfulWithoutAcceptedResultCount: number;
      retainedCounterexampleCount: number;
      retainedNoFindingTerminalRunCount: number;
      exactTaskAlreadyAttempted: boolean;
    }>;
    costDelta: Readonly<{
      knownInputTokens: string;
      knownOutputTokens: string;
      knownReasoningTokens: string;
      knownWallClockMs: string;
      providerRequestCount: number;
      toolCallCount: number;
      fetchAttemptCount: number;
      interpretationAttemptCount: number;
    }>;
    usageComplete: boolean;
    diagnostic: string;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  fetchesStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  schedulerDispatchesStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type DiscoverySignalProjection = Readonly<{
  schemaVersion: "pmh.discovery-signal-projection.v1";
  projectionIdentity: string;
  observedAt: string;
  signalCount: number;
  unreadCount: number;
  kindCounts: Readonly<Record<string, number>>;
  signals: ReadonlyArray<Readonly<{
    signalId: string;
    kind: "CAMPAIGN_MEMBERSHIP_ADDED" | "STRUCTURED_OUTCOME" |
      "REPEATED_COSTLY_NO_MOVEMENT" | "PORTFOLIO_EXHAUSTED";
    status: "UNREAD" | "READ";
    severity: "INFO" | "ATTENTION" | "WARNING";
    title: string;
    summary: string;
    observedAt: string;
    workItemId: string | null;
    episodeId: string | null;
    outcomeState: string | null;
    noveltyReason: string | null;
    knownTokenDelta: string;
    providerRequestsStarted: 0;
    modelInvocationsStarted: 0;
    campaignsActivated: 0;
    runsStarted: 0;
    automaticDispatch: false;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type DiscoveryYieldProjection = Readonly<{
  schemaVersion: "pmh.discovery-yield-projection.v1";
  projectionIdentity: string;
  observedAt: string;
  episodeCount: number;
  observationCount: number;
  windowCount: number;
  campaignMembershipBoundWindowCount: number;
  newRunCount: number;
  actedWindowCount: number;
  openWindowCount: number;
  terminalWindowCount: number;
  comparableTerminalWindowCount: number;
  productiveComparableWindowCount: number;
  nonComparableWindowCount: number;
  representedStratumCount: number;
  qualifiedStratumCount: number;
  windows: ReadonlyArray<Readonly<{
    windowId: string;
    episodeId: string;
    downstreamSystem: string;
    noveltyReason: string;
    status: "OPEN_UNACTED" | "OPEN_IN_FLIGHT" | "CLOSED_BY_SUCCESSOR" |
      "CURRENT_TERMINAL_OBSERVATION" | "INCOMPARABLE";
    integrity: string;
    comparable: boolean;
    acted: boolean;
    terminal: boolean;
    campaignMembershipBound: boolean;
    cost: Readonly<{
      knownInputTokens: string;
      knownOutputTokens: string;
      knownReasoningTokens: string;
    }>;
    yieldDelta: Readonly<{
      newRunCount: number;
      newPositiveFindingCount: number;
      newCounterexampleCount: number;
      newNoFindingTerminalRunCount: number;
      positiveValueStageDelta: number;
    }>;
    diagnostic: string;
  }>>;
  strata: ReadonlyArray<Readonly<{
    stratumId: string;
    allocationLane: string;
    allocationActionKind: string;
    noveltyReason: string;
    downstreamSystem: string;
    selectedWindowCount: number;
    actedWindowCount: number;
    terminalWindowCount: number;
    comparableTerminalWindowCount: number;
    nonComparableWindowCount: number;
    positiveFindingCount: number;
    counterexampleCount: number;
    noFindingTerminalRunCount: number;
    newRunCount: number;
    semanticReviewJobCount: number;
    probabilityJobCount: number;
    positiveValueStageDelta: number;
    productiveWindowCount: number;
    spentWithoutMovementWindowCount: number;
    knownTotalTokens: string;
    yieldCostEstimateQualified: boolean;
    ratesPer100kKnownTokens: Readonly<{
      scale: "1000000";
      positiveFindings: string | null;
      counterexamples: string | null;
      productiveWindows: string | null;
      positiveValueStageDelta: string | null;
    }>;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  policyMutationAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type AgentResultRepairProjection = Readonly<{
  schemaVersion: "pmh.agent-result-repair-projection.v1";
  projectionIdentity: string;
  observedAt: string;
  repairRunCount: number;
  repairInvocationCount: number;
  rejectedResultEffectCount: number;
  acceptedAfterRepairRunCount: number;
  budgetTerminatedRepairRunCount: number;
  otherTerminalRepairRunCount: number;
  inFlightRepairRunCount: number;
  exactRepairRunCount: number;
  knownInputTokens: string;
  knownOutputTokens: string;
  knownReasoningTokens: string;
  knownTotalTokens: string;
  incompleteUsageInvocationCount: number;
  historicalUnclassifiedInvocationCount: number;
  unlinkedRejectedEffectCount: number;
  runs: ReadonlyArray<Readonly<{
    runId: string;
    taskId: string;
    runStatus: "PREPARED" | "INTERRUPTED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
    completedAt: string | null;
    repairInvocationCount: number;
    repairAttemptCount: number;
    rejectedResultEffectCount: number;
    acceptedAfterRepair: boolean;
    acceptedResultEffectId: string | null;
    budgetTerminated: boolean;
    integrity: "EXACT" | "MISSING_REJECTED_EFFECT" |
      "NON_REJECTED_EFFECT_REFERENCE" | "NON_SEQUENTIAL_ATTEMPTS";
    knownTotalTokens: string;
    incompleteUsageInvocationCount: number;
    diagnostic: string;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  policyMutationAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type SemanticNoveltyProjection = Readonly<{
  schemaVersion: "pmh.relation-discovery-semantic-novelty-projection.v1";
  projectionIdentity: string;
  observedAt: string;
  retainedFindingCount: number;
  retainedDecisionCount: number;
  acceptedDecisionCount: number;
  novelSearchRouteCount: number;
  novelPayoffEvidenceCount: number;
  incomparablePayoffEvidenceCount: number;
  historicalRedundantRetainedCount: number;
  redundantSearchMemoryRejectionCount: number;
  redundantPayoffEvidenceRejectionCount: number;
  exactRejectionCount: number;
  admissionAffectedRunCount: number;
  knownTotalTokens: string;
  incompleteUsageInvocationCount: number;
  acceptedDecisions: ReadonlyArray<Readonly<{
    decisionId: string;
    candidateFindingId: string;
    classification: "NOVEL_SEARCH_ROUTE" | "NOVEL_PAYOFF_EVIDENCE" |
      "REDUNDANT_SEARCH_MEMORY" | "REDUNDANT_PAYOFF_EVIDENCE" |
      "INCOMPARABLE_PAYOFF_EVIDENCE";
    semanticDomain: "SEARCH_MEMORY" | "PAYOFF_RESEARCH";
    overlapFindingIds: readonly string[];
    admitted: boolean;
  }>>;
  rejections: ReadonlyArray<Readonly<{
    effectId: string;
    runId: string;
    toolName: string;
    classification: "REDUNDANT_SEARCH_MEMORY" | "REDUNDANT_PAYOFF_EVIDENCE";
    overlapFindingIds: readonly string[];
    integrity: "EXACT" | "MALFORMED_DIAGNOSTIC";
    occurredAt: string;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  policyMutationAuthority: false;
  semanticDecisionAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type WorldStateMechanismProjection = Readonly<{
  schemaVersion: "pmh.world-state-mechanism-projection.v1";
  projectionIdentity: string;
  proposalCount: number;
  counterexampleCount: number;
  routeCount: number;
  routes: ReadonlyArray<Readonly<{
    routeId: string;
    routeFamilyId: string;
    canonicalSubjectLabels: readonly string[];
    triggerPredicate: string;
    triggerInfluence: string;
    stateDimension: string;
    stateLabel: string;
    dependentPredicate: string;
    dependentRequirement: string;
    temporalPosture: string;
    proposalCount: number;
    sourceRunCount: number;
    triggerEvidenceCount: number;
    dependentEvidenceCount: number;
    counterScenarioCount: number;
    counterexampleCount: number;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  automaticDispatch: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type OntologyAllocationOutcomeProjection = Readonly<{
  schemaVersion: "pmh.ontology-allocation-outcome-projection.v1";
  projectionIdentity: string;
  observedAt: string;
  campaignEpisodeCount: number;
  selectedActionCount: number;
  actedActionCount: number;
  terminalActionCount: number;
  stageCounts: Readonly<Record<string, number>>;
  strata: ReadonlyArray<Readonly<{
    selectionActionKind: string;
    selectedActionCount: number;
    actedActionCount: number;
    terminalActionCount: number;
    ontologyOutputActionCount: number;
    usefulNegativeMemoryActionCount: number;
    downstreamRelationActionCount: number;
    semanticallyReviewedActionCount: number;
    probabilityOrOpportunityActionCount: number;
    directKnownInputTokens: string;
    directKnownOutputTokens: string;
    directKnownReasoningTokens: string;
    incompleteDirectUsageActionCount: number;
    yieldCostEstimateQualified: boolean;
  }>>;
  recurrenceQualification: Readonly<{
    representedStratumCount: number;
    qualifiedStratumCount: number;
    minimumTerminalActionsPerStratum: 3;
    yieldCostEvidenceSufficient: boolean;
    operatorActivationStillRequired: true;
  }>;
  campaigns: ReadonlyArray<Readonly<{
    episodeId: string;
    campaignKey: string;
    currentStatus: "PAUSED" | "ACTIVE";
    actionCount: number;
    actedActionCount: number;
    terminalActionCount: number;
    actionOutcomes: ReadonlyArray<Readonly<{
      outcomeId: string;
      selectionActionRef: string;
      selectionActionKind: string;
      workFamilyRef: string;
      stage: string;
      acted: boolean;
      terminal: boolean;
      usefulNegativeMemory: boolean;
      directCost: Readonly<{
        knownInputTokens: string;
        knownOutputTokens: string;
        knownReasoningTokens: string;
        usageComplete: boolean;
      }>;
      downstreamAttribution: string;
      diagnostic: string;
    }>>;
  }>>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  campaignsCreatedByRead: 0;
  runsCreatedByRead: 0;
  writesStartedByRead: 0;
  automaticDispatch: false;
  policyMutationAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type AgentWorkspace = Readonly<{
  schemaVersion: "pmh.agent-workspace.v1";
  execution: AgentExecutionConsole;
  attention: ResearchAttentionAllocation;
  relationCampaign: RelationDiscoveryCampaignPreview;
  targets: ResearchActionTargetProjection;
  decisions: ResearchDecisionOutcomeProjection;
  discoverySignals: DiscoverySignalProjection;
  discoveryYield: DiscoveryYieldProjection;
  resultRepairs: AgentResultRepairProjection;
  semanticNovelty: SemanticNoveltyProjection;
  worldStateMechanisms: WorldStateMechanismProjection;
  ontologyOutcomes: OntologyAllocationOutcomeProjection;
  discoveryCycle: Readonly<{
    schemaVersion: "pmh.discovery-cycle.v1";
    enabled: boolean;
    intervalMs: number | null;
    tickCount: number;
    membershipChangeCount: number;
    lastStartedAt: string | null;
    lastCompletedAt: string | null;
    lastMembershipChanged: boolean | null;
    lastDiagnostic: string | null;
    providerRequestsStarted: 0;
    modelInvocationsStarted: 0;
    campaignActivationAuthority: false;
    executionAuthority: false;
    externalWriteAuthority: false;
    valueMovingAuthority: false;
  }>;
  providerRequestsStartedByRead: 0;
  modelInvocationsStartedByRead: 0;
  writesStartedByRead: 0;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;
type FailureBudgetFrontierProjection = Readonly<{
  schemaVersion: "pmh.failure-budget-frontier.v4";
  contentHash: string;
  evaluatedAt: string;
  itemCount: number;
  rawEstimatorCaseCount: number;
  collapsedEstimatorCaseCount: number;
  positiveMarginCount: number;
  boundedCandidateCount: number;
  awaitingEstimateCount: number;
  abstainedCaseCount: number;
  evidenceBlockedCount: number;
  challengedCaseCount: number;
  unboundedCaseCount: number;
  quotePosture: "INDICATIVE_ZERO_FEE_ZERO_DEPTH_ONLY";
  authority: "FAILURE_BUDGET_RANKING_ONLY";
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{ providerRequests: false; externalWrites: false }>;
  items: ReadonlyArray<Readonly<{
    itemId: string;
    workIdentity: string;
    proposalId: string;
    listingRefs: readonly string[];
    adverseStateIds: readonly string[];
    status:
      | "BOUNDED_ARBITRAGE_CANDIDATE"
      | "RESEARCH_MARGIN"
      | "BUDGET_EXHAUSTED"
      | "AWAITING_ESTIMATES"
      | "ESTIMATION_ABSTAINED"
      | "ESTIMATION_EXHAUSTED"
      | "EVIDENCE_BLOCKED"
      | "SEMANTIC_REPAIR_REQUIRED"
      | "PRICE_UNAVAILABLE";
    portfolioLabel: string | null;
    breakEvenEpsilonPpm: string | null;
    adverseProbabilityUpperPpm: string | null;
    remainingFailureBudgetPpm: string | null;
    budgetUtilizationBps: string | null;
    expectedEdgeFloorUnits: string | null;
    adverseTailLossUnits: string | null;
    commonPriceScale: string | null;
    calibrationStatus: "UNCALIBRATED" | "CALIBRATED" | "PENDING";
    blockers: readonly string[];
    failureFactors: ReadonlyArray<Readonly<{
      factorId: string;
      label: string;
      source: "ASSUMPTION" | "COUNTER_SCENARIO";
    }>>;
    attemptCount: number;
    estimationAttempts: ReadonlyArray<Readonly<{
      caseIdentity: string;
      status:
        | "ESTIMATES_COMPLETE"
        | "AWAITING_ESTIMATES"
        | "ESTIMATION_ABSTAINED"
        | "ESTIMATION_EXHAUSTED"
        | "EVIDENCE_BLOCKED"
        | "SEMANTIC_REPAIR_REQUIRED";
      provider: "DEEPSEEK" | "CODEX";
      model: string;
      reasoningEffort: string | null;
      inputProtocol: string;
      jobCount: number;
      createdAt: string;
      updatedAt: string;
    }>>;
    estimatorJobCount: number;
    estimationCase: null | Readonly<{
      caseIdentity: string;
      provider: "DEEPSEEK" | "CODEX";
      model: string;
      reasoningEffort: string | null;
      inputProtocol: string;
      evidenceSource: "CURRENT_CATALOG_EXACT" | "DURABLE_REVIEW_BUNDLE" | "LEGACY_CURRENT_CATALOG";
    }>;
    guaranteedProfit: false;
    certificateAuthority: false;
    executionAuthority: false;
  }>>;
}>;
type ProposalHandoffProjection = Readonly<{
  schemaVersion: "pmh.proposal-handoff.v3";
  sourceStateHash: string;
  requestedProposalIds: readonly string[];
  resolvedProposalCount: number;
  reviewJobCount: number;
  reviewOutcomeCount: number;
  premiseJobCount: number;
  premiseOutcomeCount: number;
  premiseObligationCount: number;
  recoveryPendingCount: number;
  legacyDetailUnavailableCount: number;
  economicTriageCount: number;
  lifecycleCaseCount: number;
  operatorAttentionCount: number;
  items: ReadonlyArray<Readonly<{
    proposalId: string;
    proposal: null | Readonly<{
      proposalId: string;
      relationKind: string;
      statement: string;
      listingRefs: readonly string[];
    }>;
    reviewJob: null | Readonly<{
      schemaVersion: string;
      jobId: string;
      status: string;
      attemptCount: number;
      maxAttempts: number;
      duplicateOfJobId: string | null;
      issueIds: readonly string[];
      completedAt: string | null;
      recommendation: string | null;
    }>;
    reviewOutcome: Readonly<{
      basis:
        | "DIRECT_REVIEW"
        | "CANONICAL_SCOPE_REUSE"
        | "RECOVERY_PENDING"
        | "LEGACY_DETAIL_UNAVAILABLE"
        | "NOT_REVIEWED";
      canonicalJobId: string | null;
      diagnostic: string;
      outcome: null | Readonly<{
        outcomeHash: string;
        reviewId: string;
        reportArtifactHash: string;
        completedAt: string;
        recommendation: string;
        relationConclusion: string;
        semanticConstraint: null | Readonly<{
          artifactHash: string;
          classification: string;
          relationKind: string;
          exactCompilerAdmission?: "ELIGIBLE" | "RESEARCH_ONLY";
        }>;
        missingEvidenceCount: number;
        counterexampleCount: number;
        authority: "ADVISORY_SUMMARY_ONLY";
        semanticDecisionAuthority: false;
        simulationAuthority: false;
        certificateAuthority: false;
        executionAuthority: false;
      }>;
    }>;
    premiseJob: null | Readonly<{
      schemaVersion: string;
      jobId: string;
      status: string;
      attemptCount: number;
      maxAttempts: number;
      completedAt: string | null;
      diagnostic: string | null;
      admissionLane: string | null;
    }>;
    premiseOutcome: Readonly<{
      basis:
        | "DIRECT_ANALYSIS"
        | "ANALYSIS_PENDING"
        | "ANALYSIS_EXHAUSTED"
        | "LEGACY_DETAIL_UNAVAILABLE"
        | "NOT_ANALYZED";
      diagnostic: string;
      outcome: null | Readonly<{
        outcomeHash: string;
        analysisId: string;
        analysisArtifactHash: string;
        completedAt: string;
        relationArtifactHash: string;
        classification: string;
        exactCompilerAdmission: "ELIGIBLE" | "RESEARCH_ONLY";
        blocker: string | null;
        premiseCount: number;
        unboundPremiseCount: number;
        obligations: ReadonlyArray<Readonly<{
          premiseId: string;
          proposition: string;
          kind: string;
          truthPosture: string;
          bindingKind: string;
          evidenceClaimCount: number;
          exactStateAuthority: string;
          counterexampleResult: string;
        }>>;
        authority: "ADVISORY_SUMMARY_ONLY";
        semanticDecisionAuthority: false;
        simulationAuthority: false;
        certificateAuthority: false;
        executionAuthority: false;
      }>;
    }>;
    economicTriage: null | Readonly<{
      itemId: string;
      status: string;
      diagnostic: string;
      currentContractMatchCount: number;
      settlementStatus: string;
      indicativeEconomics: Readonly<{
        status: string;
        portfolioLabel: string | null;
        indicativeCostBpsCeil: string | null;
        grossEdgeBpsFloor: string | null;
        source: string | null;
        feesIncluded: false;
        depthIncluded: false;
        executable: false;
      }>;
    }>;
    lifecycleCase: null | Readonly<{
      opportunityId: string;
      state: string;
      nextAction: string;
      discoveryArtifactHash: string;
    }>;
    attention: null | Readonly<{
      itemId: string;
      operatorPosture: string;
      nextAction: string;
      relationConclusion: string;
      missingEvidenceCount: number;
      counterexampleCount: number;
    }>;
    nextGate:
      | "INDEPENDENT_SEMANTIC_REVIEW"
      | "AWAIT_REVIEW_RECOVERY"
      | "RECOVER_REVIEW_DETAIL"
      | "RESOLVE_EVIDENCE_GAPS"
      | "HIDDEN_PREMISE_ANALYSIS"
      | "AWAIT_PREMISE_ANALYSIS"
      | "RETRY_PREMISE_ANALYSIS"
      | "BIND_PREMISE_EVIDENCE"
      | "OPERATOR_DECISION"
      | "FEE_DEPTH_QUALIFICATION"
      | "RETAIN_AS_RESEARCH_ONLY";
  }>>;
  authority: "READ_ONLY_WORKFLOW_HANDOFF";
  semanticDecisionAuthority: false;
  simulationAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  contentHash: string;
}>;

function formatRateBps(value: number | null): string {
  if (value === null) return "—";
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}%`;
}

function formatFixedBps(value: string | null): string {
  if (value === null) return "—";
  try {
    const parsed = BigInt(value);
    const sign = parsed < 0n ? "−" : "";
    const absolute = parsed < 0n ? -parsed : parsed;
    return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}%`;
  } catch {
    return value;
  }
}

function formatPpm(value: string | null): string {
  if (value === null) return "—";
  try {
    const parsed = BigInt(value);
    const sign = parsed < 0n ? "−" : "";
    const absolute = parsed < 0n ? -parsed : parsed;
    const hundredths = absolute / 100n;
    return `${sign}${hundredths / 100n}.${String(hundredths % 100n).padStart(2, "0")}%`;
  } catch {
    return value;
  }
}

function formatScaledUnits(value: string | null, scale: string | null): string {
  if (value === null || scale === null) return "—";
  try {
    const units = BigInt(value);
    const denominator = BigInt(scale);
    if (denominator <= 0n) return "—";
    return formatFixedBps(((units * 10_000n) / denominator).toString());
  } catch {
    return "—";
  }
}

function formatTokenCount(value: string | null): string {
  if (value === null) return "unknown";
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return value;
  }
}

function formatYieldRate(value: string | null): string {
  if (value === null) return "unqualified";
  try {
    const hundredths = BigInt(value) * 100n / 1_000_000n;
    return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}`;
  } catch {
    return "unqualified";
  }
}

function formatDurationMs(value: string | null): string {
  if (value === null) return "—";
  try {
    const milliseconds = BigInt(value);
    const minutes = milliseconds / 60_000n;
    if (minutes < 1n) return "<1 min";
    const hours = minutes / 60n;
    if (hours < 1n) return `${minutes} min`;
    const days = hours / 24n;
    if (days < 1n) return `${hours} hr ${minutes % 60n} min`;
    return `${days} d ${hours % 24n} hr`;
  } catch {
    return "—";
  }
}

function tokenMagnitude(value: string | null): bigint {
  if (value === null) return -1n;
  try {
    return BigInt(value);
  } catch {
    return -1n;
  }
}

const EMPTY_CATALOG_CONTEXT: StudioProjection["ai"]["catalogContext"] = {
  mode: "VERIFIED_FIXTURE_CATALOGS",
  corpusIdentity: `sha256:${"0".repeat(64)}`,
  listingCount: 0,
  venueCount: 0,
  sourceFixtureCount: 0,
  maxListingsPerTask: 30,
};

const EMPTY_OPPORTUNITY_RADAR: StudioProjection["ai"]["opportunityRadar"] = {
  algorithmVersion: "pmh.opportunity-radar.semantic-rotation-v3",
  sourceSetIdentity: `sha256:${"0".repeat(64)}`,
  observedListingCount: 0,
  eligibleSourceCount: 0,
  excludedSourceCount: 0,
  candidateCount: 0,
  candidates: [],
  scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE",
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_SEMANTIC_REVIEW: StudioProjection["ai"]["semanticReview"] = {
  schemaVersion: "pmh.semantic-review-desk.v1",
  configured: false,
  model: "unavailable",
  status: "NEEDS_KEY",
  runCount: 0,
  passCount: 0,
  failedCount: 0,
  activeCount: 0,
  concurrencyLimit: 3,
  retentionLimit: 10,
  storage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "reviewId",
  },
  records: [],
  authority: "ADVISORY_ONLY",
  independenceGrade: "SEPARATE_INVOCATION_SAME_PROVIDER",
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_PROBABILITY_ESTIMATION: StudioProjection["ai"]["probabilityEstimation"] = {
  schemaVersion: "pmh.probability-estimation-desk.v1",
  configured: false,
  model: "unavailable",
  engine: {
    provider: "DEEPSEEK",
    transport: "VERCEL_AI_SDK",
    model: "unavailable",
    reasoningEffort: null,
    responseStorage: false,
  },
  status: "NEEDS_KEY",
  activeCount: 0,
  runCount: 0,
  passCount: 0,
  abstainedCount: 0,
  challengedCount: 0,
  failedCount: 0,
  roles: ["REFERENCE_CLASS", "CAUSAL", "INDEPENDENT"],
  records: [],
  storage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "runId",
  },
  authority: "ESTIMATION_ORCHESTRATION_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_PROBABILITY_ESTIMATION_SCHEDULER:
  StudioProjection["ai"]["probabilityEstimationScheduler"] = {
    schemaVersion: "pmh.probability-estimation-scheduler.v1",
    enabled: false,
    configured: false,
    status: "NEEDS_KEY",
    tickIntervalMs: null,
    concurrencyLimit: 3,
    activeCount: 0,
    dueCount: 0,
    pendingCount: 0,
    leasedCount: 0,
    retryWaitCount: 0,
    blockedEvidenceCount: 0,
    policyBlockedCount: 0,
    passedCount: 0,
    abstainedCount: 0,
    challengedCount: 0,
    exhaustedCount: 0,
    caseCount: 0,
    boundReadyCount: 0,
    freshBoundCount: 0,
    unsupportedCandidateCount: 0,
    unreadNotificationCount: 0,
    budget: {
      basis: "PROVIDER_ATTEMPTS",
      maxAttemptsPerRole: 3,
      maxRequestsPerTick: 3,
      providerAttemptsStarted: 0,
    },
    jobs: [],
    bounds: [],
    notifications: [],
    storage: {
      jobs: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "jobId" },
      notifications: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "notificationId",
      },
    },
    authority: "ESTIMATION_ORCHESTRATION_ONLY",
    semanticDecisionAuthority: false,
    probabilityCertificateAuthority: false,
    hardArbitrageAuthority: false,
    executionAuthority: false,
    effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
  };

const EMPTY_PROBABILITY_EVIDENCE_DEBT:
  StudioProjection["ai"]["probabilityEvidenceDebt"] = {
    schemaVersion: "pmh.probability-evidence-debt.v1",
    contentHash: `sha256:${"0".repeat(64)}`,
    sourceRunCount: 0,
    sourceNeedCount: 0,
    itemCount: 0,
    blockingItemCount: 0,
    counts: {
      EVIDENCE_CAPTURED: 0,
      ACQUISITION_IN_PROGRESS: 0,
      ACQUISITION_READY: 0,
      ACQUISITION_ROUTE_MISSING: 0,
      EXTERNAL_SOURCE_POLICY_REQUIRED: 0,
    },
    items: [],
    rankingContract: "BLOCKING_THEN_ROUTE_POSTURE_THEN_NEED_ID",
    authority: "RESEARCH_PRIORITY_ONLY",
    fetchAuthority: false,
    providerRequestAuthority: false,
    semanticDecisionAuthority: false,
    certificateAuthority: false,
    executionAuthority: false,
    effects: {
      providerRequests: false,
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    },
  };

const EMPTY_PROBABILITY_SEMANTIC_REPAIR_PROGRESS:
  StudioProjection["ai"]["probabilitySemanticRepairProgress"] = {
    schemaVersion: "pmh.probability-semantic-repair-progress.v1",
    contentHash: `sha256:${"0".repeat(64)}`,
    sourceItemCount: 0,
    sourceChallengeCount: 0,
    openCount: 0,
    pendingCount: 0,
    runningCount: 0,
    repairedCount: 0,
    reducedToResearchCount: 0,
    rejectedCount: 0,
    manualAttentionCount: 0,
    items: [],
    authority: "SEMANTIC_REPAIR_OBSERVATION_ONLY",
    providerRequestAuthority: false,
    semanticDecisionAuthority: false,
    probabilityCertificateAuthority: false,
    executionAuthority: false,
    effects: {
      providerRequests: false,
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    },
  };

const EMPTY_PROBABILITY_CALIBRATION:
  StudioProjection["ai"]["probabilityCalibration"] = {
    schemaVersion: "pmh.probability-calibration-desk.v1",
    status: "EMPTY",
    registeredBoundCount: 0,
    registeredAttributedBoundCount: 0,
    registeredObservedBoundCount: 0,
    pendingResolutionBoundCount: 0,
    observationCount: 0,
    attributedObservationCount: 0,
    adverseObservationCount: 0,
    snapshotCount: 0,
    minimumSampleSize: 20,
    snapshotInterval: 20,
    nextSnapshotAtObservationCount: 1,
    currentArtifactHash: null,
    currentCreatedAt: null,
    measuredGroupCount: 0,
    insufficientGroupCount: 0,
    attributedGroupCount: 0,
    groups: [],
    observations: [],
    snapshots: [],
    storage: {
      bounds: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "artifactHash",
      },
      observations: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "artifactHash",
      },
      snapshots: {
        mode: "MEMORY",
        durable: false,
        schemaVersion: 0,
        idempotencyKey: "artifactHash",
      },
    },
    authority: "CALIBRATION_ORCHESTRATION_ONLY",
    probabilityCertificateAuthority: false,
    executionAuthority: false,
    effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
  };

const EMPTY_PROBABILITY_RESOLUTION_ACQUISITION:
  StudioProjection["ai"]["probabilityResolutionAcquisition"] = {
    schemaVersion: "pmh.probability-resolution-acquisition.v1",
    enabled: false, status: "DISABLED", intervalMs: null,
    timeoutMs: 30_000, maxResponseBytes: 1_000_000, nextPollAt: null,
    pendingBoundCount: 0, pendingListingCount: 0, capturedListingCount: 0,
    resolvedListingCount: 0, timeUnavailableListingCount: 0, conflictListingCount: 0,
    unsupportedListingCount: 0, unresolvedListingCount: 0, httpErrorListingCount: 0,
    autoRecordedBoundCount: 0, runCount: 0, failedRequestCount: 0,
    lastStartedAt: null, lastCompletedAt: null, lastDiagnostic: null,
    captures: [],
    storage: {
      captures: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "artifactHash" },
      sources: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "rawHash" },
    },
    authority: "ANONYMOUS_RESOLUTION_ORCHESTRATION_ONLY",
    probabilityCertificateAuthority: false,
    executionAuthority: false,
    effects: { anonymousPublicGets: true, modelCalls: false, externalWrites: false,
      valueMovingActions: false, liveExecutionEnabled: false },
  };

const EMPTY_AI_USAGE: StudioProjection["ai"]["aiUsage"] = {
  schemaVersion: "pmh.ai-usage-ledger.v1",
  eventCount: 0,
  coverage: { complete: 0, partial: 0, unavailable: 0 },
  totals: {
    dimension: "PURPOSE",
    key: "ALL",
    invocationCount: "0",
    durableEffectCount: "0",
    completeCount: "0",
    partialCount: "0",
    unavailableCount: "0",
    tokens: {
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: null,
    },
  },
  byPurpose: [],
  byRole: [],
  byModel: [],
  byOutcome: [],
  hourly: [],
  daily: [],
  recentEvents: [],
  storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "eventId" },
  promptTextRetained: false,
  outputTextRetained: false,
  currencyCostEstimated: false,
};

const EMPTY_SEMANTIC_REVIEW_ADMISSION: StudioProjection["ai"]["semanticReviewAdmission"] = {
  schemaVersion: "pmh.semantic-review-admission-desk.v2",
  policy: "TWO_TO_FOUR_DISTINCT_LISTINGS_WITH_PREMISE_LANE_V2",
  candidateCount: 0,
  autoReviewCount: 0,
  premiseReviewCount: 0,
  researchOnlyCount: 0,
  autoReviewRateBps: null,
  countsByReason: {
    TWO_LISTING_COMPILABLE_RELATION: 0,
    PREMISE_AUDIT_REQUIRED: 0,
    NON_COMPILABLE_RELATION: 0,
    LISTING_ARITY_UNSUPPORTED: 0,
    DUPLICATE_LISTING_REF: 0,
  },
  candidates: [],
  supportedRelations: [
    "EQUIVALENT",
    "IMPLIES",
    "SUBSET",
    "MUTUALLY_EXCLUSIVE",
    "EXHAUSTIVE",
    "CONDITIONAL",
    "RELATED",
    "CONFLICTING",
  ],
  manualReviewAvailable: true,
  modelConfidenceUsed: false,
  authority: "AUTOMATIC_REVIEW_ADMISSION_ONLY",
  semanticDecisionAuthority: false,
  simulationAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    modelCalls: false,
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
  contentHash: `sha256:${"0".repeat(64)}`,
};

const EMPTY_SEMANTIC_REVIEW_SCHEDULER: StudioProjection["ai"]["semanticReviewScheduler"] = {
  schemaVersion: "pmh.semantic-review-scheduler.v1",
  enabled: false,
  configured: false,
  status: "NEEDS_KEY",
  tickIntervalMs: null,
  concurrencyLimit: 3,
  activeCount: 0,
  dueCount: 0,
  pendingCount: 0,
  leasedCount: 0,
  retryWaitCount: 0,
  blockedEvidenceCount: 0,
  researchOnlyCount: 0,
  duplicateScopeCount: 0,
  scopedJobCount: 0,
  uniqueReviewScopeCount: 0,
  historicalRedundantPassCount: 0,
  bundledJobCount: 0,
  capturedOriginalJobCount: 0,
  rebasedJobCount: 0,
  legacyEvidenceDebtCount: 0,
  passedCount: 0,
  exhaustedCount: 0,
  recoveryRequestedCount: 0,
  recoveryInFlightCount: 0,
  recoveryCompletedCount: 0,
  recoveryBlockedCount: 0,
  classifiedFailureJobCount: 0,
  unclassifiedFailureJobCount: 0,
  failureClassCounts: [],
  unreadNotificationCount: 0,
  budget: {
    basis: "REQUEST_ATTEMPTS",
    maxAttemptsPerJob: 3,
    maxRequestsPerTick: 3,
    requestAttemptsStarted: 0,
  },
  jobs: [],
  notifications: [],
  storage: {
    jobs: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "jobId" },
    notifications: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "notificationId" },
  },
  authority: "ADVISORY_ORCHESTRATION_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_PREMISE_ANALYSIS: StudioProjection["ai"]["premiseAnalysis"] = {
  schemaVersion: "pmh.premise-analysis-desk.v1",
  configured: false,
  model: "deepseek-v4-flash",
  interpreterIdentity: `sha256:${"0".repeat(64)}`,
  status: "NEEDS_KEY",
  activeCount: 0,
  runCount: 0,
  passCount: 0,
  failedCount: 0,
  exactEligibleCount: 0,
  researchOnlyCount: 0,
  concurrencyLimit: 3,
  records: [],
  storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "analysisId" },
  authority: "PROPOSE_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_PREMISE_ANALYSIS_SCHEDULER: StudioProjection["ai"]["premiseAnalysisScheduler"] = {
  schemaVersion: "pmh.premise-analysis-scheduler.v2",
  enabled: false,
  configured: false,
  status: "NEEDS_KEY",
  tickIntervalMs: null,
  concurrencyLimit: 3,
  activeCount: 0,
  dueCount: 0,
  pendingCount: 0,
  leasedCount: 0,
  retryWaitCount: 0,
  passedCount: 0,
  exhaustedCount: 0,
  exactEligibleCount: 0,
  researchOnlyCount: 0,
  attributedJobCount: 0,
  legacyAttributionDebtCount: 0,
  unreadNotificationCount: 0,
  budget: {
    basis: "PROVIDER_ATTEMPTS",
    maxAttemptsPerJob: 3,
    maxRequestsPerTick: 3,
    providerAttemptsStarted: 0,
  },
  jobs: [],
  notifications: [],
  storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "jobId" },
  notificationStorage: {
    mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "notificationId",
  },
  authority: "ADVISORY_PREMISE_ANALYSIS_ORCHESTRATION_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_PREMISE_EVIDENCE_ROUTING: StudioProjection["ai"]["premiseEvidenceRouting"] = {
  schemaVersion: "pmh.premise-evidence-routing-scheduler.v1",
  enabled: false,
  configured: false,
  status: "NEEDS_KEY",
  tickIntervalMs: null,
  concurrencyLimit: 2,
  activeCount: 0,
  dueCount: 0,
  pendingCount: 0,
  leasedCount: 0,
  retryWaitCount: 0,
  passedCount: 0,
  exhaustedCount: 0,
  supersededCount: 0,
  sourcePremiseCount: 0,
  routeGroupCount: 0,
  derivedGroupCount: 0,
  tradedStateGroupCount: 0,
  ruleEvidenceGroupCount: 0,
  externalResearchGroupCount: 0,
  counterexampleGroupCount: 0,
  unresolvedGroupCount: 0,
  exactPotentialGroupCount: 0,
  budget: {
    basis: "PROVIDER_ATTEMPTS",
    maxAttemptsPerJob: 2,
    maxRequestsPerTick: 2,
    providerAttemptsStarted: 0,
  },
  jobs: [],
  storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "jobId" },
  authority: "ADVISORY_PREMISE_EVIDENCE_ORCHESTRATION_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_PREMISE_ROUTE_EXPANSION: StudioProjection["ai"]["premiseRouteExpansion"] = {
  schemaVersion: "pmh.premise-route-expansion-scheduler.v1",
  enabled: false,
  configured: false,
  model: "unconfigured",
  status: "NEEDS_KEY",
  tickIntervalMs: null,
  concurrencyLimit: 1,
  activeCount: 0,
  dueCount: 0,
  pendingCount: 0,
  leasedCount: 0,
  retryWaitCount: 0,
  passedCount: 0,
  exhaustedCount: 0,
  zeroProposalCount: 0,
  proposalYieldJobCount: 0,
  generatedProposalCount: 0,
  candidateListingCount: 0,
  budget: {
    basis: "PROVIDER_ATTEMPTS",
    maxAttemptsPerJob: 2,
    maxRequestsPerTick: 1,
    providerAttemptsStarted: 0,
  },
  jobs: [],
  storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "jobId" },
  authority: "ADVISORY_TRADED_STATE_EXPANSION_ORCHESTRATION_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_RULE_EVIDENCE_CLAIMS: StudioProjection["ai"]["ruleEvidenceClaims"] = {
  schemaVersion: "pmh.rule-evidence-claim-scheduler.v2",
  enabled: false,
  configured: false,
  status: "NEEDS_KEY",
  currentInterpreterIdentity: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  currentJobCount: 0,
  legacyJobCount: 0,
  historicalPassedCount: 0,
  tickIntervalMs: null,
  concurrencyLimit: 3,
  activeCount: 0,
  dueCount: 0,
  pendingCount: 0,
  leasedCount: 0,
  interruptedLeaseCount: 0,
  retryWaitCount: 0,
  passedCount: 0,
  exhaustedCount: 0,
  supportedCount: 0,
  contradictedCount: 0,
  inconclusiveCount: 0,
  budget: {
    basis: "PROVIDER_ATTEMPTS",
    maxAttemptsPerJob: 3,
    maxRequestsPerTick: 3,
    providerAttemptsStarted: 0,
  },
  jobs: [],
  storage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "jobId",
  },
  authority: "ADVISORY_EVIDENCE_INTERPRETATION_ORCHESTRATION_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_EVIDENCE_ACQUISITION: StudioProjection["ai"]["evidenceAcquisition"] = {
  schemaVersion: "pmh.evidence-acquisition-scheduler.v1",
  enabled: false,
  status: "IDLE",
  tickIntervalMs: null,
  concurrencyLimit: 3,
  activeCount: 0,
  dueCount: 0,
  pendingCount: 0,
  leasedCount: 0,
  retryWaitCount: 0,
  capturedCount: 0,
  staleCount: 0,
  unsupportedCount: 0,
  exhaustedCount: 0,
  requirementCount: 0,
  coalescedRequirementCount: 0,
  conditionalReuseCount: 0,
  sourceSpecificity: {
    contractDetailCount: 0,
    venuePolicyCount: 0,
    legacyGenericCount: 0,
    withoutLocatorCount: 0,
  },
  requirementScope: {
    proposalScopedCount: 0,
    legacyCount: 0,
  },
  budget: {
    basis: "FETCH_ATTEMPTS",
    maxAttemptsPerJob: 3,
    maxRequestsPerTick: 3,
    fetchAttemptsStarted: 0,
  },
  jobs: [],
  storage: {
    jobs: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "jobId" },
    documents: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "documentId" },
    text: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "extractionId" },
    observations: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "observationId" },
  },
  authority: "ANONYMOUS_EVIDENCE_ORCHESTRATION_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    anonymousReadsOnly: true,
    credentialsUsed: false,
    providerRequests: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_EVIDENCE_DEBT_FRONTIER: StudioProjection["ai"]["evidenceDebtFrontier"] = {
  schemaVersion: "pmh.evidence-debt-frontier.v1",
  contentHash: `sha256:${"0".repeat(64)}`,
  retainedUnsupportedJobCount: 0,
  retainedUnsupportedRequirementCount: 0,
  inactiveUnsupportedRequirementCount: 0,
  sourceUnsupportedJobCount: 0,
  sourceRequirementCount: 0,
  sourceProposalCount: 0,
  itemCount: 0,
  truncated: false,
  counts: {
    POSITIVE_GROSS_BLOCKER: 0,
    EVIDENCE_ESCALATION: 0,
    ACTIVE_TRIAGE_DEBT: 0,
    RETAINED_RESEARCH_DEBT: 0,
  },
  items: [],
  sortContract: "TIER_THEN_GROSS_EDGE_THEN_PRIORITY_THEN_MISSING_BREADTH",
  groupingContract: "ONE_ITEM_PER_PROPOSAL",
  sourceWindow: "ACTIVE_REQUIREMENTS_WITHIN_EVIDENCE_SCHEDULER_RETAINED_WINDOW",
  authority: "EVIDENCE_ROUTING_PRIORITY_ONLY",
  semanticDecisionAuthority: false,
  simulationAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    modelCalls: false,
    fetchesStarted: false,
    schedulerChanges: false,
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_REVIEW_ATTENTION: StudioProjection["ai"]["reviewAttention"] = {
  schemaVersion: "pmh.review-attention-queue.v1",
  contentHash: `sha256:${"0".repeat(64)}`,
  sourceReviewCount: 0,
  decidedReviewCount: 0,
  unresolvedInputCount: 0,
  itemCount: 0,
  truncated: false,
  counts: {
    DECISION_READY: 0,
    RESEARCH_ONLY: 0,
    EVIDENCE_ESCALATION: 0,
    REJECT_RECOMMENDED: 0,
  },
  exactAdapterCoverageCount: 0,
  positiveGrossHintCount: 0,
  items: [],
  sortContract: "POSTURE_THEN_ADAPTER_THEN_GROSS_HINT_THEN_EVIDENCE_THEN_RECENCY",
  arithmetic: "BIGINT_FIXED_POINT_RATIONAL_BPS",
  authority: "OPERATOR_ATTENTION_ONLY",
  semanticDecisionAuthority: false,
  simulationAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    modelCalls: false,
    schedulerChanges: false,
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_PROPOSAL_ECONOMIC_TRIAGE: StudioProjection["ai"]["proposalEconomicTriage"] = {
  schemaVersion: "pmh.proposal-economic-triage.v1",
  contentHash: `sha256:${"0".repeat(64)}`,
  sourceCandidateCount: 0,
  itemCount: 0,
  truncated: false,
  counts: {
    POSITIVE_GROSS_HINT: 0,
    NON_POSITIVE_GROSS_HINT: 0,
    PRICE_UNAVAILABLE: 0,
    SETTLEMENT_INELIGIBLE: 0,
    EVIDENCE_UNAVAILABLE: 0,
    CURRENT_CONTRACT_MISMATCH: 0,
    LISTING_SCOPE_UNSUPPORTED: 0,
    RELATION_UNSUPPORTED: 0,
  },
  boostedCount: 0,
  items: [],
  priorityPolicy: "POSITIVE_GROSS_HINT_PLUS_ONE_CAPPED_AT_FIVE",
  retentionPolicy: "NO_SUPPRESSION_NO_NEGATIVE_PENALTY",
  arithmetic: "BIGINT_FIXED_POINT_RATIONAL_BPS",
  authority: "REVIEW_SCHEDULING_HINT_ONLY",
  semanticDecisionAuthority: false,
  simulationAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    modelCalls: false,
    schedulerRequestsAdded: false,
    proposalsSuppressed: false,
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_MARKET_CORPUS: StudioProjection["ai"]["marketCorpus"] = {
  schemaVersion: "pmh.market-corpus.v1",
  contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY",
  sourceSetIdentity: `sha256:${"0".repeat(64)}`,
  snapshotIdentity: `sha256:${"0".repeat(64)}`,
  eligibleSourceCount: 0,
  excludedSourceCount: 0,
  listingCount: 0,
  authority: "OBSERVE_ONLY",
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_CATALOG_REFRESH_SCHEDULER: StudioProjection["ai"]["catalogRefreshScheduler"] = {
  schemaVersion: "pmh.catalog-refresh-scheduler.v1",
  enabled: false,
  status: "DISABLED",
  intervalMs: null,
  nextRefreshAt: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastTrigger: null,
  lastResult: null,
  latestSnapshotIdentity: null,
  runCount: 0,
  readyCount: 0,
  degradedCount: 0,
  failedCount: 0,
  effects: {
    anonymousPublicGets: true,
    modelCalls: false,
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_MARKET_ARCHAEOLOGIST: StudioProjection["ai"]["marketArchaeologist"] = {
  schemaVersion: "pmh.market-archaeologist-desk.v1",
  configured: false,
  model: "deepseek-v4-flash",
  status: "NEEDS_KEY",
  activeCount: 0,
  concurrencyLimit: 1,
  runCount: 0,
  passCount: 0,
  failedCount: 0,
  retentionLimit: 10,
  storage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "runId",
  },
  scheduler: {
    enabled: false,
    intervalMs: null,
    changedCorpusOnly: true,
    lastAttemptedSnapshotIdentity: null,
  },
  records: [],
  authority: "PROPOSE_ONLY",
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_SEARCH_LEASE_SCHEDULER: StudioProjection["ai"]["searchLeaseScheduler"] = {
  schemaVersion: "pmh.search-lease-scheduler.v1",
  algorithmVersion: "pmh.ai-search-leases.v10",
  enabled: false,
  configured: { fastLane: true, deepLane: false },
  status: "IDLE",
  activeCount: 0,
  activeFastCount: 0,
  activeDeepCount: 0,
  queuedDeepCount: 0,
  concurrencyLimit: 1,
  deepConcurrencyLimit: 1,
  intervalMs: null,
  retentionLimit: 40,
  lensOrder: ["EQUIVALENCE", "IMPLICATION", "PARTITION", "MECHANISM"],
  budget: {
    maxFastModelRequests: 1,
    maxPiInvocations: 1,
    maxHypotheses: 8,
    deadlineMs: 605_000,
    fastDeadlineMs: 300_000,
    deepDeadlineMs: 300_000,
    orchestrationGraceMs: 5_000,
    maxDeepAttempts: 3,
  },
  runCount: 0,
  passCount: 0,
  failedCount: 0,
  issuedCount: 0,
  duplicateCount: 0,
  piEscalationCount: 0,
  deepPendingCount: 0,
  deepPassCount: 0,
  deepFailedCount: 0,
  deepRetryCount: 0,
  preservedFastResultCount: 0,
  expiredRecoveryCount: 0,
  retainedCorpusCount: 0,
  recoverableIssuedCount: 0,
  missingCorpusIssuedCount: 0,
  storage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "leaseId",
  },
  corpusStorage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "snapshotIdentity",
  },
  records: [],
  findingSummaries: [],
  findingInbox: [],
  authority: "PROPOSE_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_SEARCH_ISSUE_SCHEDULER: StudioProjection["ai"]["searchIssueScheduler"] = {
  schemaVersion: "pmh.search-issue-scheduler.v1",
  enabled: false,
  status: "IDLE",
  tickIntervalMs: null,
  concurrencyLimit: 3,
  familyConcurrencyLimit: 1,
  activeCount: 0,
  issueCount: 0,
  enabledIssueCount: 0,
  explorationIssueCount: 0,
  claimMonitoringIssueCount: 0,
  defaultManagedIssueCount: 0,
  supersededIssueCount: 0,
  dueIssueCount: 0,
  unreadNotificationCount: 0,
  inspirationCount: 0,
  queuedInspirationCount: 0,
  runningInspirationCount: 0,
  performance: {
    measurementWindow: "RETAINED_TERMINAL_LEASES",
    retainedLeaseLimit: 40,
    terminalLeaseCount: 0,
    novelCandidateCount: 0,
    duplicateCount: 0,
    piEscalationCount: 0,
    deepPendingCount: 0,
    deepPassCount: 0,
    deepFailedCount: 0,
    deepRetryCount: 0,
    preservedFastResultCount: 0,
    expiredRecoveryCount: 0,
    economicGateRequiredCount: 0,
    economicGatePositiveCount: 0,
    economicGateBlockedCount: 0,
    piAvoidedCount: 0,
    modelSelectionRequiredCount: 0,
    modelSelectedCandidateCount: 0,
    modelSelectionMissCount: 0,
    quoteEnrichmentAttemptCount: 0,
    quoteEnrichmentReadyCount: 0,
    quoteEnrichmentPartialCount: 0,
    quoteEnrichmentFailedCount: 0,
    quoteEnrichmentRescuedGateCount: 0,
    quoteObservationCount: 0,
    exactSemanticScopeCount: 0,
    semanticScopeRevisitCount: 0,
    noLeadSemanticScopeCount: 0,
    boundedSemanticScopeCount: 0,
    boundedScopeRevisitCount: 0,
    noLeadBoundedScopeCount: 0,
    hypothesisCount: 0,
    falsificationCount: 0,
    proposalCount: 0,
    evidenceGapCount: 0,
    coverageManifestCount: 0,
    degradedContextCount: 0,
    degradedPassCount: 0,
    insufficientCoverageFailureCount: 0,
    omittedVenueCount: 0,
    familyRetrievalLeaseCount: 0,
    familyRetrievalNeighborhoodCount: 0,
    familyRetrievalFallbackCount: 0,
    agentTraceLeaseCount: 0,
    agentRunCount: 0,
    agentStepCount: 0,
    agentToolCallCount: 0,
    agentCatalogReadCount: 0,
    agentAcceptedProposalEffectCount: 0,
    agentRejectedProposalEffectCount: 0,
    agentAcceptedFalsificationEffectCount: 0,
    agentRejectedFalsificationEffectCount: 0,
    agentExplicitCompletionCount: 0,
    agentBudgetTerminationCount: 0,
    agentFailureTerminationCount: 0,
    providerRequestAttemptCount: 0,
    providerFailureCount: 0,
    providerFailureRateBps: null,
    providerNativeTelemetryLeaseCount: 0,
    providerLegacyDerivedLeaseCount: 0,
    providerFailuresByCategory: [],
    novelCandidateRateBps: null,
    duplicateRateBps: null,
    piEscalationRateBps: null,
    economicGatePositiveRateBps: null,
    byIssue: [],
    byFamily: [],
    byDiscoveryMode: [],
  },
  issues: [],
  notifications: [],
  inspirations: [],
  storage: {
    issues: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "issueId" },
    notifications: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "notificationId" },
  },
  authority: "PROPOSE_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_SEARCH_ATTENTION: StudioProjection["ai"]["searchAttention"] = {
  schemaVersion: "pmh.search-attention-outbox.v1",
  status: "IDLE",
  digestWindowMs: 3_600_000,
  activationAt: new Date(0).toISOString(),
  retentionLimit: 100,
  messageCount: 0,
  digestCount: 0,
  immediateCount: 0,
  unreadInAppCount: 0,
  pendingDeliveryCount: 0,
  retryWaitCount: 0,
  deliveredWebhookCount: 0,
  deadLetterCount: 0,
  channels: {
    inApp: { configured: true },
    webhookJson: {
      configured: false,
      destinationStored: false,
      destinationProjected: false,
      cutoverPolicy: "PROCESS_ACTIVATION_NO_HISTORY_REPLAY",
    },
  },
  messages: [],
  deliveries: [],
  storage: {
    messages: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "messageId" },
    deliveries: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "deliveryId" },
  },
  authority: "ATTENTION_ROUTING_ONLY",
  semanticDecisionAuthority: false,
  simulationAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_SEARCH_QUOTE_ENRICHMENT: StudioProjection["ai"]["searchQuoteEnrichment"] = {
  schemaVersion: "pmh.search-quote-enrichment-desk.v1",
  mode: "ANONYMOUS_PUBLIC_GET",
  status: "IDLE",
  runCount: 0,
  readyCount: 0,
  partialCount: 0,
  failedCount: 0,
  unsupportedCount: 0,
  retainedObservationCount: 0,
  timeoutMs: 10_000,
  maxResponseBytes: 1_000_000,
  retentionLimit: 100,
  supportedVenues: ["opinion"],
  storage: { mode: "MEMORY", durable: false, schemaVersion: 0, idempotencyKey: "observationId" },
  observations: [],
  authority: "SEARCH_PRICE_EVIDENCE_ONLY",
  semanticDecisionAuthority: false,
  simulationAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_SEARCH_OUTCOME_ATTRIBUTION: StudioProjection["ai"]["searchOutcomeAttribution"] = {
  schemaVersion: "pmh.search-outcome-attribution.v4",
  attributionIdentity: `sha256:${"0".repeat(64)}`,
  sourceSetIdentity: `sha256:${"0".repeat(64)}`,
  sourceArtifactCount: 0,
  measurementBasis: "DISTINCT_FINDINGS_FROM_PASSED_ISSUE_LEASES",
  reviewMeasurementBasis: "DURABLE_SCHEDULER_OUTCOME_WITH_RETAINED_REPORT_DETAIL",
  issueCount: 0,
  familyCount: 0,
  unclassifiedIssueCount: 0,
  attributedLeaseCount: 0,
  attributedProposalCount: 0,
  attributedFalsificationCount: 0,
  totalAiProposalCount: 0,
  unattributedAiProposalCount: 0,
  multiIssueProposalCount: 0,
  multiFamilyProposalCount: 0,
  invalidProposalReferenceCount: 0,
  invalidFalsificationReferenceCount: 0,
  lifecycleMissingCount: 0,
  attributionCoverageBps: null,
  stages: [
    "PROPOSED",
    "REVIEWED",
    "OPERATOR_ACCEPTED",
    "MATERIALIZED_READY",
    "POSITIVE_SIMULATION",
    "CERTIFIED",
    "SHADOW_OBSERVED",
  ].map((stage) => ({
    stage: stage as StudioProjection["ai"]["searchOutcomeAttribution"]["stages"][number]["stage"],
    count: 0,
  })),
  economics: {
    positiveGrossHintCount: 0,
    nonPositiveGrossHintCount: 0,
    unavailableOrUnsupportedCount: 0,
  },
  reviewOutcomes: {
    sourceBasis: "IN_MEMORY_RETAINED_WINDOW",
    sourceJobCount: 0,
    sourceMaximumJobCount: 0,
    sourceTruncated: false,
    passedCount: 0,
    exhaustedCount: 0,
    blockedEvidenceCount: 0,
    researchOnlyCount: 0,
    pendingCount: 0,
    untrackedCount: 0,
    duplicateScopeCount: 0,
    reusedPassCount: 0,
    detailedReportCount: 0,
    detailedReportCoverageBps: null,
    outcomeCoverageBps: null,
  },
  bottlenecks: {
    pendingReviewCount: 0,
    reviewFailedCount: 0,
    reviewBlockedEvidenceCount: 0,
    reviewResearchOnlyCount: 0,
    reviewUntrackedCount: 0,
    pendingOperatorDecisionCount: 0,
    materializationBlockedCount: 0,
    simulationBlockedCount: 0,
    exactRejectedCount: 0,
    shadowDivergedCount: 0,
    missingEvidenceCount: 0,
  },
  byIssue: [],
  byFamily: [],
  modelConfidenceUsed: false,
  authority: "DERIVED_RESEARCH_EVIDENCE_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: { externalWrites: false, valueMovingActions: false, liveExecutionEnabled: false },
};

const EMPTY_SEMANTIC_RELATION_GRAPH: StudioProjection["ai"]["semanticRelationGraph"] = {
  schemaVersion: "pmh.semantic-relation-graph.v1",
  graphIdentity: `sha256:${"0".repeat(64)}`,
  marketOntologyIdentity: `sha256:${"0".repeat(64)}`,
  sourceSnapshotIdentity: `sha256:${"0".repeat(64)}`,
  sourceArtifactHashes: [],
  listingCount: 0,
  claimNodeCount: 0,
  timeWindowNodeCount: 0,
  resolutionBindingNodeCount: 0,
  relationCount: 0,
  feedbackCount: 0,
  worldReferenceClusterCount: 0,
  ontologyTrailheadCount: 0,
  listings: [],
  relations: [],
  feedback: [],
  empiricalOutcomes: [
    "DUPLICATE",
    "SEMANTIC_REJECTED",
    "MISSING_RULE",
    "NO_DEPTH",
    "FEE_OR_MODEL_BLOCK",
    "EXACT_REJECTED",
    "CERTIFIED",
    "SHADOW_DIVERGENCE",
    "SHADOW_MATCHED",
  ].map((code) => ({
    code: code as StudioProjection["ai"]["semanticRelationGraph"]["empiricalOutcomes"][number]["code"],
    count: 0,
    latestObservedAt: null,
  })),
  priorityBasis: "EMPIRICAL_OUTCOMES_THEN_EVIDENCE_FRESHNESS",
  modelConfidenceUsed: false,
  authority: "DERIVED_RESEARCH_EVIDENCE_ONLY",
  semanticDecisionAuthority: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_RELATION_PAYOFF: StudioProjection["relationPayoff"] = {
  schemaVersion: "pmh.relation-payoff-desk.v1",
  qualificationCount: 0,
  sourceDecisionCount: 0,
  unresolvedInputCount: 0,
  readyCount: 0,
  blockedCount: 0,
  qualifications: [],
  supportedRelations: [
    "EQUIVALENT",
    "IMPLIES",
    "SUBSET",
    "MUTUALLY_EXCLUSIVE",
    "EXHAUSTIVE",
  ],
  arithmetic: "SYMBOLIC_INTEGER_PAYOUT_UNITS",
  authority: "DETERMINISTIC_RESEARCH_COMPILER",
  verifierEligible: false,
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_SIMULATION_MATERIALIZER: StudioProjection["simulationMaterializer"] = {
  schemaVersion: "pmh.anonymous-simulation-materializer-desk.v1",
  mode: "ANONYMOUS_PUBLIC_GET",
  status: "IDLE",
  runCount: 0,
  readyCount: 0,
  blockedCount: 0,
  retentionLimit: 25,
  timeoutMs: 10_000,
  maxResponseBytes: 1_000_000,
  maxSnapshotSkewMs: 5_000,
  retainedRawSourceCount: 0,
  storage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "materializationId",
  },
  records: [],
  authority: "ANONYMOUS_RESEARCH_MATERIALIZER",
  certificateAuthority: false,
  executionAuthority: false,
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const EMPTY_CANDIDATE_WATCH: StudioProjection["qualification"]["candidateWatch"] = {
  schemaVersion: "pmh.candidate-watch.v1",
  mode: "ANONYMOUS_PUBLIC_GET",
  status: "IDLE",
  authority: "OBSERVE_AND_SCREEN_ONLY",
  candidateClaimIdentity: `sha256:${"0".repeat(64)}`,
  canonicalTitle: "Candidate watch unavailable",
  boundSnapshotIdentity: `sha256:${"0".repeat(64)}`,
  latestRefreshId: null,
  observationSetIdentity: `sha256:${"0".repeat(64)}`,
  changedVenueCount: 0,
  retentionPerSource: 10,
  refreshRetentionLimit: 25,
  timeoutMs: 10_000,
  maxResponseBytes: 1_000_000,
  storage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "observationId",
  },
  refreshStorage: {
    mode: "MEMORY",
    durable: false,
    schemaVersion: 0,
    idempotencyKey: "refreshId",
  },
  decision: null,
  refreshHistory: [],
  sources: [],
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const navigation = [
  { id: "archaeologist", label: "Discover", icon: Search },
  { id: "scouts", label: "Findings", icon: Inbox },
  { id: "budgets", label: "Failure budgets", icon: Gauge },
  { id: "lifecycle", label: "Review queue", icon: GitBranch },
  { id: "preflight", label: "Preflight", icon: FileCheck2 },
  { id: "venues", label: "Markets", icon: Network },
  { id: "evidence", label: "Evidence", icon: Fingerprint },
  { id: "overview", label: "System overview", icon: LayoutDashboard },
  { id: "agents", label: "Agent operations", icon: Bot },
  { id: "radar", label: "Similarity radar", icon: Radar },
  { id: "cases", label: "Research cases", icon: Waypoints },
  { id: "books", label: "Order books", icon: BookOpenCheck },
] as const;

const primaryNavigation = navigation.slice(0, 7);
const systemNavigation = navigation.slice(7);

function SignalMark() {
  return (
    <div className="signal-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}

async function requestDiscoveryRun(
  question: string,
  venueIds: readonly string[],
  catalogMode: CatalogMode = "VERIFIED_FIXTURES",
): Promise<Readonly<{ restored: boolean; partial: boolean }>> {
  const response = await fetch("/api/v1/discovery/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, venueIds, catalogMode }),
  });
  if (!response.ok) throw new Error("scout request failed");
  const result = (await response.json()) as {
    executionAuthority: boolean;
    idempotentReplay?: boolean;
    hypotheses: readonly Readonly<{
      authority?: string;
      reviewStatus?: string;
    }>[];
    workerReports?: readonly Readonly<{ status?: string }>[];
  };
  if (
    result.executionAuthority !== false ||
    result.hypotheses.some(
      (hypothesis) =>
        hypothesis.authority !== "PROPOSE_ONLY" ||
        hypothesis.reviewStatus !== "UNREVIEWED",
    )
  ) {
    throw new Error("scout crossed its authority boundary");
  }
  return Object.freeze({
    restored: result.idempotentReplay === true,
    partial: result.workerReports?.some((report) => report.status !== "PASS") ?? false,
  });
}

async function requestProbabilityResolutionRun(): Promise<void> {
  const response = await fetch("/api/v1/probability-resolution-acquisition/runs", {
    method: "POST",
  });
  if (!response.ok) throw new Error("anonymous resolution acquisition failed");
  const result = (await response.json()) as { executionAuthority?: boolean };
  if (result.executionAuthority !== false) {
    throw new Error("resolution acquisition crossed its authority boundary");
  }
}

async function requestFailureBudgetFrontier(): Promise<FailureBudgetFrontierProjection> {
  const response = await fetch("/api/v1/failure-budget-frontier");
  if (!response.ok) throw new Error("failure budget frontier failed to load");
  const result = (await response.json()) as FailureBudgetFrontierProjection;
  if (
    result.schemaVersion !== "pmh.failure-budget-frontier.v4" ||
    result.authority !== "FAILURE_BUDGET_RANKING_ONLY" ||
    result.certificateAuthority !== false ||
    result.executionAuthority !== false ||
    result.effects.providerRequests !== false ||
    result.effects.externalWrites !== false ||
    result.itemCount !== result.items.length ||
    result.rawEstimatorCaseCount < result.collapsedEstimatorCaseCount ||
    new Set(result.items.map((item) => item.workIdentity)).size !== result.items.length ||
    result.items.some((item) =>
      item.attemptCount !== item.estimationAttempts.length ||
      item.estimatorJobCount < item.attemptCount
    )
  ) {
    throw new Error("failure budget frontier crossed its authority boundary");
  }
  return result;
}

async function requestAiRuntimeConfigurationUpdate(
  configuration: AiRuntimeConfiguration,
): Promise<void> {
  const response = await fetch("/api/v1/ai-runtime/configuration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      expectedRevision: configuration.revision,
      provider: configuration.provider,
      codexModel: configuration.codexModel,
      codexReasoningEffort: configuration.codexReasoningEffort,
      deepseekAutomationEnabled: configuration.deepseekAutomationEnabled,
    }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    executionAuthority?: boolean;
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "AI runtime configuration update failed");
  }
  if (result.executionAuthority !== false) {
    throw new Error("AI runtime configuration crossed its authority boundary");
  }
}

async function requestInvestigation(
  question: string,
  venueIds: readonly string[],
  catalogMode: CatalogMode = "VERIFIED_FIXTURES",
): Promise<boolean> {
  const response = await fetch("/api/v1/investigations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, venueIds, catalogMode }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    executionAuthority?: boolean;
    authority?: string;
    reviewStatus?: string;
    idempotentReplay?: boolean;
    report?: { result?: { executionAuthority?: boolean } };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "pi investigation failed");
  }
  if (
    result.executionAuthority !== false ||
    result.authority !== "PROPOSE_ONLY" ||
    result.reviewStatus !== "UNREVIEWED" ||
    result.report?.result?.executionAuthority !== false
  ) {
    throw new Error("pi investigator crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestRadarTriage(candidateId: string): Promise<boolean> {
  const response = await fetch("/api/v1/radar/triage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidateId }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    radarCandidateId?: string;
    executionAuthority?: boolean;
    idempotentReplay?: boolean;
    hypotheses?: readonly Readonly<{
      authority?: string;
      reviewStatus?: string;
    }>[];
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "radar triage failed");
  }
  if (
    result.radarCandidateId !== candidateId ||
    result.executionAuthority !== false ||
    result.hypotheses?.some(
      (hypothesis) =>
        hypothesis.authority !== "PROPOSE_ONLY" ||
        hypothesis.reviewStatus !== "UNREVIEWED",
    ) !== false
  ) {
    throw new Error("radar triage crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestMarketArchaeologist(question: string): Promise<boolean> {
  const response = await fetch("/api/v1/market-archaeologist/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    status?: string;
    idempotentReplay?: boolean;
    report?: {
      result?: {
        authority?: string;
        reviewStatus?: string;
        executionAuthority?: boolean;
      };
      effects?: {
        valueMovingActions?: boolean;
        liveExecutionEnabled?: boolean;
      };
    };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "Market Archaeologist run failed");
  }
  if (
    result.status !== "PASS" ||
    result.report?.result?.authority !== "PROPOSE_ONLY" ||
    result.report.result.reviewStatus !== "UNREVIEWED" ||
    result.report.result.executionAuthority !== false ||
    result.report.effects?.valueMovingActions !== false ||
    result.report.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("Market Archaeologist crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestSearchLease(): Promise<boolean> {
  const response = await fetch("/api/v1/search-leases/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    status?: string;
    idempotentReplay?: boolean;
    semanticDecisionAuthority?: boolean;
    certificateAuthority?: boolean;
    executionAuthority?: boolean;
    effects?: {
      valueMovingActions?: boolean;
      liveExecutionEnabled?: boolean;
    };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "search lease failed");
  }
  if (
    result.status !== "PASS" ||
    result.semanticDecisionAuthority !== false ||
    result.certificateAuthority !== false ||
    result.executionAuthority !== false ||
    result.effects?.valueMovingActions !== false ||
    result.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("search lease crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestSearchDeepRetry(leaseId: string): Promise<boolean> {
  const response = await fetch(
    `/api/v1/search-leases/${encodeURIComponent(leaseId)}/deep-retries`,
    { method: "POST" },
  );
  const result = (await response.json()) as {
    diagnostic?: string;
    status?: string;
    idempotentReplay?: boolean;
    semanticDecisionAuthority?: boolean;
    certificateAuthority?: boolean;
    executionAuthority?: boolean;
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "deep retry failed");
  }
  if (
    result.status !== "PASS" ||
    result.semanticDecisionAuthority !== false ||
    result.certificateAuthority !== false ||
    result.executionAuthority !== false
  ) {
    throw new Error("deep retry crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestCreateSearchIssue(input: Readonly<{
  title: string;
  question: string;
  lens: SearchIssue["lens"];
  cadenceMs: number;
}>): Promise<void> {
  const response = await fetch("/api/v1/search-issues", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as { diagnostic?: string; issueId?: string };
  if (!response.ok || result.issueId === undefined) {
    throw new Error(result.diagnostic ?? "search issue creation failed");
  }
}

async function requestSearchIssueRun(issueId: string): Promise<boolean> {
  const response = await fetch(`/api/v1/search-issues/${issueId}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    status?: string;
    idempotentReplay?: boolean;
    semanticDecisionAuthority?: boolean;
    certificateAuthority?: boolean;
    executionAuthority?: boolean;
    effects?: { valueMovingActions?: boolean; liveExecutionEnabled?: boolean };
  };
  if (!response.ok) throw new Error(result.diagnostic ?? "search issue run failed");
  if (
    result.status !== "PASS" ||
    result.semanticDecisionAuthority !== false ||
    result.certificateAuthority !== false ||
    result.executionAuthority !== false ||
    result.effects?.valueMovingActions !== false ||
    result.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("search issue run crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestSearchIssueEnabled(issueId: string, enabled: boolean): Promise<void> {
  const response = await fetch(`/api/v1/search-issues/${issueId}/enabled`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const result = (await response.json()) as { diagnostic?: string };
  if (!response.ok) throw new Error(result.diagnostic ?? "search issue update failed");
}

async function requestNotificationAcknowledgement(notificationId: string): Promise<void> {
  const response = await fetch(
    `/api/v1/search-notifications/${notificationId}/acknowledgements`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  );
  const result = (await response.json()) as { diagnostic?: string };
  if (!response.ok) throw new Error(result.diagnostic ?? "notification acknowledgement failed");
}

async function requestAttentionAcknowledgement(deliveryId: string): Promise<void> {
  const response = await fetch(
    `/api/v1/search-attention-deliveries/${deliveryId}/acknowledgements`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  );
  const result = (await response.json()) as { diagnostic?: string };
  if (!response.ok) throw new Error(result.diagnostic ?? "attention acknowledgement failed");
}

async function requestReviewNotificationAcknowledgement(
  notificationId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/semantic-review-notifications/${notificationId}/acknowledgements`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  );
  const result = (await response.json()) as { diagnostic?: string };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "review notification acknowledgement failed");
  }
}

async function requestPremiseNotificationAcknowledgement(
  notificationId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/premise-analysis-notifications/${notificationId}/acknowledgements`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  );
  const result = (await response.json()) as { diagnostic?: string };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "premise notification acknowledgement failed");
  }
}

async function requestProbabilityNotificationAcknowledgement(
  notificationId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/probability-estimation-notifications/${notificationId}/acknowledgements`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  );
  const result = (await response.json()) as { diagnostic?: string };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "probability notification acknowledgement failed");
  }
}

async function requestProbabilityCaseRetry(caseIdentity: string): Promise<void> {
  const response = await fetch(
    `/api/v1/probability-estimation/cases/${caseIdentity}/retries`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  );
  const result = (await response.json()) as { diagnostic?: string };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "probability case retry failed");
  }
}

async function requestProposalHandoff(
  proposalIds: readonly string[],
): Promise<ProposalHandoffProjection> {
  const params = new URLSearchParams({ ids: proposalIds.join(",") });
  const response = await fetch(`/api/v1/proposal-handoff?${params.toString()}`);
  const result = (await response.json()) as Partial<ProposalHandoffProjection> & {
    diagnostic?: string;
  };
  if (!response.ok) throw new Error(result.diagnostic ?? "proposal handoff failed");
  if (
    result.schemaVersion !== "pmh.proposal-handoff.v3" ||
    result.authority !== "READ_ONLY_WORKFLOW_HANDOFF" ||
    result.semanticDecisionAuthority !== false ||
    result.simulationAuthority !== false ||
    result.certificateAuthority !== false ||
    result.executionAuthority !== false ||
    !Array.isArray(result.items) ||
    !Array.isArray(result.requestedProposalIds) ||
    result.requestedProposalIds.join(",") !== proposalIds.join(",")
  ) {
    throw new Error("proposal handoff crossed its read-only boundary");
  }
  return result as ProposalHandoffProjection;
}

async function requestSemanticReviewDetailRecovery(
  proposalId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/proposals/${proposalId}/semantic-review-detail-recovery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  const result = (await response.json()) as {
    diagnostic?: string;
    authority?: string;
    semanticDecisionAuthority?: boolean;
    simulationAuthority?: boolean;
    certificateAuthority?: boolean;
    executionAuthority?: boolean;
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "semantic review detail recovery failed");
  }
  if (
    result.authority !== "REVIEW_DETAIL_RECOVERY_ONLY" ||
    result.semanticDecisionAuthority !== false ||
    result.simulationAuthority !== false ||
    result.certificateAuthority !== false ||
    result.executionAuthority !== false
  ) throw new Error("semantic review detail recovery crossed its authority boundary");
}

async function requestSemanticReview(opportunityId: string): Promise<boolean> {
  const response = await fetch("/api/v1/semantic-reviews/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ opportunityId }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    status?: string;
    idempotentReplay?: boolean;
    report?: {
      result?: {
        authority?: string;
        productionReviewAuthority?: boolean;
        simulationAuthority?: boolean;
        executionAuthority?: boolean;
      };
      effects?: {
        externalWrites?: boolean;
        valueMovingActions?: boolean;
        liveExecutionEnabled?: boolean;
      };
    };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "semantic review failed");
  }
  if (
    result.status !== "PASS" ||
    result.report?.result?.authority !== "ADVISORY_ONLY" ||
    result.report.result.productionReviewAuthority !== false ||
    result.report.result.simulationAuthority !== false ||
    result.report.result.executionAuthority !== false ||
    result.report.effects?.externalWrites !== false ||
    result.report.effects.valueMovingActions !== false ||
    result.report.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("semantic review crossed its advisory boundary");
  }
  return result.idempotentReplay === true;
}

async function requestResearchSemanticDecision(
  opportunityId: string,
  decision: "ACCEPT_FOR_SIMULATION" | "REJECT",
  rationale: string,
): Promise<void> {
  const response = await fetch(
    "/api/v1/opportunity-lifecycle/semantic-decisions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunityId, decision, rationale }),
    },
  );
  const result = (await response.json()) as {
    diagnostic?: string;
    decision?: {
      authority?: string;
      productionReviewAuthority?: boolean;
      productionPromotionEligible?: boolean;
      executionAuthority?: boolean;
    };
    lifecycle?: {
      effects?: {
        liveOrdersPlaced?: boolean;
        valueMovingActions?: boolean;
        liveExecutionEnabled?: boolean;
      };
    };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "semantic decision failed");
  }
  if (
    result.decision?.authority !== "LOCAL_OPERATOR_RESEARCH_ONLY" ||
    result.decision.productionReviewAuthority !== false ||
    result.decision.productionPromotionEligible !== false ||
    result.decision.executionAuthority !== false ||
    result.lifecycle?.effects?.liveOrdersPlaced !== false ||
    result.lifecycle.effects.valueMovingActions !== false ||
    result.lifecycle.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("semantic decision crossed its research-only boundary");
  }
}

async function requestAnonymousMaterialization(
  opportunityId: string,
  portfolioId: string,
  requestedQuantity: string,
): Promise<void> {
  const response = await fetch(
    "/api/v1/opportunity-lifecycle/materializations",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunityId, portfolioId, requestedQuantity }),
    },
  );
  const result = (await response.json()) as {
    diagnostic?: string;
    certificateAuthority?: false | "FIRST_PARTY_EXACT_VERIFIER";
    executionAuthority?: boolean;
    exactVerification?: {
      status?: "CERTIFIED" | "REJECTED";
      authority?: string;
      executionAuthority?: boolean;
    } | null;
    materialization?: {
      authority?: string;
      certificateAuthority?: boolean;
      executionAuthority?: boolean;
      effects?: {
        externalWrites?: boolean;
        valueMovingActions?: boolean;
        liveExecutionEnabled?: boolean;
      };
    };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "public-book materialization failed");
  }
  if (
    (result.certificateAuthority !== false &&
      (result.certificateAuthority !== "FIRST_PARTY_EXACT_VERIFIER" ||
        result.exactVerification?.status !== "CERTIFIED" ||
        result.exactVerification.authority !==
          "FIRST_PARTY_EXACT_VERIFIER" ||
        result.exactVerification.executionAuthority !== false)) ||
    result.executionAuthority !== false ||
    result.materialization?.authority !==
      "ANONYMOUS_RESEARCH_MATERIALIZER" ||
    result.materialization.certificateAuthority !== false ||
    result.materialization.executionAuthority !== false ||
    result.materialization.effects?.externalWrites !== false ||
    result.materialization.effects.valueMovingActions !== false ||
    result.materialization.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("public-book materializer crossed its authority boundary");
  }
}

async function requestShadowDecision(
  opportunityId: string,
  decision: "APPROVE_SHADOW" | "REJECT",
): Promise<void> {
  const response = await fetch(
    "/api/v1/opportunity-lifecycle/shadow-decisions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunityId, decision }),
    },
  );
  const result = (await response.json()) as {
    diagnostic?: string;
    productionApprovalAccepted?: boolean;
    executionAuthority?: boolean;
    liveExecutionEnabled?: boolean;
    lifecycle?: {
      effects?: {
        productionApprovalAccepted?: boolean;
        liveOrdersPlaced?: boolean;
        valueMovingActions?: boolean;
        liveExecutionEnabled?: boolean;
      };
    };
    shadow?: {
      authority?: string;
      executionAuthority?: boolean;
      gatewayCalls?: number;
    } | null;
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "shadow decision failed");
  }
  if (
    result.productionApprovalAccepted !== false ||
    result.executionAuthority !== false ||
    result.liveExecutionEnabled !== false ||
    result.lifecycle?.effects?.productionApprovalAccepted !== false ||
    result.lifecycle.effects.liveOrdersPlaced !== false ||
    result.lifecycle.effects.valueMovingActions !== false ||
    result.lifecycle.effects.liveExecutionEnabled !== false ||
    (decision === "APPROVE_SHADOW" &&
      (result.shadow?.authority !== "SHADOW_REPLAY_ONLY" ||
        result.shadow.executionAuthority !== false ||
        result.shadow.gatewayCalls !== 0))
  ) {
    throw new Error("shadow decision crossed its non-value-moving boundary");
  }
}

async function requestShadowObservation(
  opportunityId: string,
  portfolioId: string,
  requestedQuantity: string,
): Promise<void> {
  const response = await fetch(
    "/api/v1/opportunity-lifecycle/shadow-observations",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunityId, portfolioId, requestedQuantity }),
    },
  );
  const result = (await response.json()) as {
    diagnostic?: string;
    source?: string;
    actualOrderObserved?: boolean;
    gatewayCalls?: number;
    executionAuthority?: boolean;
    liveExecutionEnabled?: boolean;
    observation?: {
      authority?: string;
      executionAuthority?: boolean;
      gatewayCalls?: number;
      comparison?: {
        publicMarketEvidenceOnly?: boolean;
        actualOrderObserved?: boolean;
        certificateReverificationRequired?: boolean;
      };
      effects?: {
        externalWrites?: boolean;
        valueMovingActions?: boolean;
        liveExecutionEnabled?: boolean;
      };
    } | null;
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "shadow market observation failed");
  }
  if (
    result.source !== "ANONYMOUS_PUBLIC_MARKET_EVIDENCE" ||
    result.actualOrderObserved !== false ||
    result.gatewayCalls !== 0 ||
    result.executionAuthority !== false ||
    result.liveExecutionEnabled !== false ||
    (result.observation !== null &&
      (result.observation?.authority !== "FIRST_PARTY_SHADOW_OBSERVER" ||
        result.observation.executionAuthority !== false ||
        result.observation.gatewayCalls !== 0 ||
        result.observation.comparison?.publicMarketEvidenceOnly !== true ||
        result.observation.comparison.actualOrderObserved !== false ||
        result.observation.comparison.certificateReverificationRequired !== true ||
        result.observation.effects?.externalWrites !== false ||
        result.observation.effects.valueMovingActions !== false ||
        result.observation.effects.liveExecutionEnabled !== false))
  ) {
    throw new Error("shadow observer crossed its public-evidence boundary");
  }
}

async function requestRadarInvestigation(
  candidateId: string,
): Promise<boolean> {
  const response = await fetch("/api/v1/radar/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidateId }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    radarCandidateId?: string;
    authority?: string;
    reviewStatus?: string;
    executionAuthority?: boolean;
    idempotentReplay?: boolean;
    report?: { result?: { executionAuthority?: boolean } };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "radar investigation failed");
  }
  if (
    result.radarCandidateId !== candidateId ||
    result.authority !== "PROPOSE_ONLY" ||
    result.reviewStatus !== "UNREVIEWED" ||
    result.executionAuthority !== false ||
    result.report?.result?.executionAuthority !== false
  ) {
    throw new Error("radar investigator crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestResearchCaseInvestigation(
  taskId: string,
): Promise<boolean> {
  const response = await fetch("/api/v1/research-cases/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    taskId?: string;
    authority?: string;
    reviewStatus?: string;
    executionAuthority?: boolean;
    idempotentReplay?: boolean;
    report?: { result?: { executionAuthority?: boolean } };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "case investigation failed");
  }
  if (
    result.taskId !== taskId ||
    result.authority !== "PROPOSE_ONLY" ||
    result.reviewStatus !== "UNREVIEWED" ||
    result.executionAuthority !== false ||
    result.report?.result?.executionAuthority !== false
  ) {
    throw new Error("case investigator crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestCatalogRefresh(): Promise<"READY" | "DEGRADED"> {
  const response = await fetch("/api/v1/catalog/observations/refresh", {
    method: "POST",
  });
  const result = (await response.json()) as {
    status?: string;
    promotion?: string;
    effects?: {
      externalWrites?: boolean;
      valueMovingActions?: boolean;
      liveExecutionEnabled?: boolean;
    };
  };
  if (
    (response.status !== 200 && response.status !== 207) ||
    (result.status !== "READY" && result.status !== "DEGRADED")
  ) {
    throw new Error("catalog observation refresh failed");
  }
  if (
    result.promotion !== "OBSERVE_ONLY" ||
    result.effects?.externalWrites !== false ||
    result.effects.valueMovingActions !== false ||
    result.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("catalog observation crossed its authority boundary");
  }
  return result.status;
}

async function requestCandidateWatchRefresh(): Promise<"READY" | "DEGRADED"> {
  const response = await fetch("/api/v1/candidate-watch/refresh", {
    method: "POST",
  });
  const result = (await response.json()) as {
    status?: string;
    authority?: string;
    effects?: {
      externalWrites?: boolean;
      valueMovingActions?: boolean;
      liveExecutionEnabled?: boolean;
    };
  };
  if (
    (response.status !== 200 && response.status !== 207) ||
    (result.status !== "READY" && result.status !== "DEGRADED")
  ) {
    throw new Error("candidate watch refresh failed");
  }
  if (
    result.authority !== "OBSERVE_AND_SCREEN_ONLY" ||
    result.effects?.externalWrites !== false ||
    result.effects.valueMovingActions !== false ||
    result.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("candidate watch crossed its authority boundary");
  }
  return result.status;
}

function SidebarStatus() {
  const studioProjection = useStudioProjection();
  const observation = studioProjection.ai.catalogObservation;
  return (
    <div className="sidebar-status">
      <span className="sidebar-status-dot" />
      <div>
        <strong>System ready</strong>
        <span>
          {observation.healthySourceCount}/{observation.sourceCount} sources ·{" "}
          {observation.listingCount} markets
        </span>
      </div>
    </div>
  );
}

function LocalAgentSidebarStatus({
  readiness,
  diagnostic,
}: {
  readiness: StartupReadiness | null;
  diagnostic: string | null;
}) {
  const ready = readiness?.phase === "WAITING_FOR_PROJECTION" ||
    readiness?.status === "READY";
  return (
    <div className="sidebar-status">
      <span className="sidebar-status-dot" />
      <div>
        <strong>{diagnostic === null ? ready ? "Agent desk ready" : "Recovering ledger" : "Desk unavailable"}</strong>
        <span>{ready
          ? "Local read model ready"
          : readiness?.currentReconciliationStep?.replaceAll("_", " ") ??
            readiness?.phase.replaceAll("_", " ") ?? diagnostic ?? "Connecting"}</span>
      </div>
    </div>
  );
}

function Sidebar({
  view,
  onViewChange,
  mobileOpen,
  onMobileClose,
  statusMode = "GLOBAL_PROJECTION",
  localReadiness = null,
  localDiagnostic = null,
}: {
  view: View;
  onViewChange: (view: View) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  statusMode?: "VIEW_LOCAL" | "GLOBAL_PROJECTION";
  localReadiness?: StartupReadiness | null;
  localDiagnostic?: string | null;
}) {
  return (
    <>
      <button
        className={cn("mobile-scrim", mobileOpen && "is-open")}
        aria-label="Close navigation"
        onClick={onMobileClose}
      />
      <aside className={cn("sidebar", mobileOpen && "is-open")}>
        <div className="brand">
          <SignalMark />
          <div>
            <span>Harmony</span>
            <small>Market research</small>
          </div>
          <Button
            className="mobile-close"
            size="icon"
            variant="ghost"
            aria-label="Close navigation"
            onClick={onMobileClose}
          >
            <X size={17} />
          </Button>
        </div>

        <nav aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn("nav-item", view === item.id && "is-active")}
                onClick={() => {
                  onViewChange(item.id);
                  onMobileClose();
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {view === item.id && <span className="active-pip" />}
              </button>
            );
          })}
          <span className="nav-label nav-label-spaced">System</span>
          {systemNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn("nav-item", view === item.id && "is-active")}
                onClick={() => {
                  onViewChange(item.id);
                  onMobileClose();
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {view === item.id && <span className="active-pip" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          {statusMode === "VIEW_LOCAL"
            ? <LocalAgentSidebarStatus
                readiness={localReadiness}
                diagnostic={localDiagnostic}
              />
            : <SidebarStatus />}
          <div className="authority-note">
            <CircleOff size={15} />
            <div>
              <strong>Research mode</strong>
              <span>Analysis only · no execution</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  view,
  projectionSync,
  onMenu,
  onCommand,
}: {
  view: View;
  projectionSync: ProjectionSyncState;
  onMenu: () => void;
  onCommand: () => void;
}) {
  const currentLabel = navigation.find((item) => item.id === view)?.label ?? "Overview";
  const staleAge = projectionSync.lastUpdatedAt === null
    ? null
    : Math.max(0, Date.now() - Date.parse(projectionSync.lastUpdatedAt));
  const staleAgeLabel = staleAge === null
    ? "unknown age"
    : staleAge < 60_000
      ? "under 1m old"
      : staleAge < 3_600_000
        ? `${Math.floor(staleAge / 60_000)}m old`
        : `${Math.floor(staleAge / 3_600_000)}h old`;
  const syncLabel = projectionSync.status === "LIVE"
    ? "Live data"
    : projectionSync.status === "STALE_REVALIDATING"
      ? `Last known · ${staleAgeLabel} · revalidating`
    : projectionSync.status === "REFRESHING"
      ? "Updating"
      : projectionSync.status === "RECONNECTING"
        ? "Reconnecting"
        : "Connecting";
  const SyncIcon = projectionSync.status === "REFRESHING"
    ? RefreshCw
    : projectionSync.status === "STALE_REVALIDATING"
      ? Clock3
    : projectionSync.status === "RECONNECTING"
      ? Clock3
      : Radio;
  return (
    <header className="topbar">
      <div className="topbar-title">
        <Button
          className="menu-button"
          size="icon"
          variant="ghost"
          aria-label="Open navigation"
          onClick={onMenu}
        >
          <Menu size={19} />
        </Button>
        <strong>{currentLabel}</strong>
      </div>
      <div className="topbar-actions">
        <button
          className="command-button"
          aria-label="Open command menu"
          onClick={onCommand}
        >
          <Search size={14} />
          <span>Find anything</span>
          <kbd>
            <Command size={11} /> K
          </kbd>
        </button>
        <Badge
          variant={projectionSync.status === "RECONNECTING" ||
              projectionSync.status === "STALE_REVALIDATING" ? "warning" : "muted"}
          title={projectionSync.revision === null
            ? syncLabel
            : `${syncLabel} · projection revision ${projectionSync.revision}`}
        >
          <SyncIcon
            size={10}
            className={projectionSync.status === "REFRESHING" ? "is-spinning" : undefined}
          />
          {syncLabel}
        </Badge>
      </div>
    </header>
  );
}

function OpportunityRow({
  opportunity,
  onInspect,
}: {
  opportunity: Opportunity;
  onInspect: (opportunity: Opportunity) => void;
}) {
  return (
    <button
      className="opportunity-row"
      onClick={() => onInspect(opportunity)}
    >
      <div className="opportunity-main">
        <div className="opportunity-icon">
          <Waypoints size={17} />
        </div>
        <div>
          <strong>{opportunity.title}</strong>
          <span>
            {opportunity.strategy} · synthetic fixture
          </span>
        </div>
      </div>
      <div className="opportunity-cell hide-small">
        <span>Capital bound</span>
        <strong>{opportunity.capital}</strong>
      </div>
      <div className="opportunity-cell">
        <span>Worst payoff</span>
        <strong className="positive">{opportunity.floor}</strong>
      </div>
      <div className="opportunity-cell hide-medium">
        <span>Net floor</span>
        <strong className="positive">{opportunity.returnRate}</strong>
      </div>
      <div className="opportunity-cell hide-medium">
        <span>Expires</span>
        <strong className="mono">{opportunity.expires}</strong>
      </div>
      <ChevronRight className="row-chevron" size={17} />
    </button>
  );
}

function PayoffFloor() {
  const studioProjection = useStudioProjection();
  return (
    <Card className="payoff-card">
      <CardHeader>
        <div>
          <span className="eyebrow">Canonical payoff states</span>
          <h2>Profit floor stays above zero</h2>
        </div>
        <Badge variant="verified">
          <BadgeCheck size={11} />
          Exact
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="payoff-plot">
          <div className="zero-line">
            <span>$0 floor</span>
          </div>
          {studioProjection.payoffStates.map((state) => (
            <div className="payoff-column" key={state.label}>
              <div className="payoff-bar-track">
                <div
                  className="payoff-bar"
                  style={{ height: `${state.height}%` }}
                >
                  <span>{state.amount}</span>
                </div>
              </div>
              <small>{state.label}</small>
            </div>
          ))}
        </div>
        <div className="plot-note">
          <ShieldCheck size={15} />
          <span>
            {studioProjection.qualification.reviewedCompilation.certificate.resolutionStateCount}{" "}
            synthetic resolution states checked with adverse rounding.
          </span>
          <code>
            cert {studioProjection.qualification.reviewedCompilation.certificate.id.slice(7, 14)}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}

function VerificationTrace() {
  const studioProjection = useStudioProjection();
  return (
    <Card className="trace-card">
      <CardHeader>
        <div>
          <span className="eyebrow">Independent verifier</span>
          <h2>Decision trace</h2>
        </div>
        <Fingerprint size={19} className="muted-icon" />
      </CardHeader>
      <CardContent className="trace-list">
        {studioProjection.trace.map(([title, verdict, detail], index) => (
          <div className="trace-row" key={title}>
            <div
              className={cn(
                "trace-index",
                verdict === "BLOCKED" && "is-blocked",
              )}
            >
              {verdict === "BLOCKED" ? (
                <CircleOff size={12} />
              ) : (
                index + 1
              )}
            </div>
            <div>
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
            <Badge variant={verdict === "PASS" ? "verified" : "shadow"}>
              {verdict}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CapitalSilhouette() {
  const studioProjection = useStudioProjection();
  return (
    <Card>
      <CardHeader>
        <div>
          <span className="eyebrow">Synthetic qualification fixture</span>
          <h2>Compiled capital bounds</h2>
        </div>
        <Database size={19} className="muted-icon" />
      </CardHeader>
      <CardContent>
        <div className="capital-legend">
          <span>
            <i className="available" /> Unused
          </span>
          <span>
            <i className="reserved" /> Candidate bound
          </span>
          <span>
            <i className="locked" /> Unresolved
          </span>
        </div>
        <div className="capital-list">
          {studioProjection.capital.map((item) => (
            <div className="capital-row" key={item.venue}>
              <div>
                <strong>{item.venue}</strong>
                <span>{item.reserved}% fixture-bound</span>
              </div>
              <div className="capital-bar" aria-label={`${item.venue} capital`}>
                <span
                  className="available"
                  style={{ width: `${item.available}%` }}
                />
                <span
                  className="reserved"
                  style={{ width: `${item.reserved}%` }}
                />
                <span
                  className="locked"
                  style={{ width: `${item.locked}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function requestAgentWorkspace(): Promise<AgentWorkspace> {
  const response = await fetch("/api/v1/agent-workspace", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Agent workspace returned HTTP ${response.status}`);
  const result = await response.json() as AgentWorkspace;
  if (
    result.schemaVersion !== "pmh.agent-workspace.v1" ||
    result.execution.schemaVersion !== "pmh.agent-execution-console.v1" ||
    result.execution.credentialSecretTextRetained !== false ||
    result.attention.schemaVersion !== "pmh.research-attention-allocation.v1" ||
    result.targets.schemaVersion !== "pmh.research-action-target-projection.v1" ||
    result.decisions.schemaVersion !== "pmh.research-decision-outcome-projection.v1" ||
    result.discoverySignals.schemaVersion !== "pmh.discovery-signal-projection.v1" ||
    result.discoverySignals.providerRequestsStartedByRead !== 0 ||
    result.discoverySignals.modelInvocationsStartedByRead !== 0 ||
    result.discoverySignals.writesStartedByRead !== 0 ||
    result.discoverySignals.automaticDispatch !== false ||
    result.discoveryYield.schemaVersion !== "pmh.discovery-yield-projection.v1" ||
    result.discoveryYield.providerRequestsStartedByRead !== 0 ||
    result.discoveryYield.modelInvocationsStartedByRead !== 0 ||
    result.discoveryYield.writesStartedByRead !== 0 ||
    result.discoveryYield.automaticDispatch !== false ||
    result.discoveryYield.policyMutationAuthority !== false ||
    result.resultRepairs.schemaVersion !== "pmh.agent-result-repair-projection.v1" ||
    result.resultRepairs.providerRequestsStartedByRead !== 0 ||
    result.resultRepairs.modelInvocationsStartedByRead !== 0 ||
    result.resultRepairs.writesStartedByRead !== 0 ||
    result.resultRepairs.automaticDispatch !== false ||
    result.resultRepairs.policyMutationAuthority !== false ||
    result.semanticNovelty.schemaVersion !==
      "pmh.relation-discovery-semantic-novelty-projection.v1" ||
    result.semanticNovelty.providerRequestsStartedByRead !== 0 ||
    result.semanticNovelty.modelInvocationsStartedByRead !== 0 ||
    result.semanticNovelty.writesStartedByRead !== 0 ||
    result.semanticNovelty.automaticDispatch !== false ||
    result.semanticNovelty.policyMutationAuthority !== false ||
    result.semanticNovelty.semanticDecisionAuthority !== false ||
    result.worldStateMechanisms.schemaVersion !==
      "pmh.world-state-mechanism-projection.v1" ||
    result.worldStateMechanisms.providerRequestsStartedByRead !== 0 ||
    result.worldStateMechanisms.modelInvocationsStartedByRead !== 0 ||
    result.worldStateMechanisms.writesStartedByRead !== 0 ||
    result.worldStateMechanisms.automaticDispatch !== false ||
    result.worldStateMechanisms.semanticDecisionAuthority !== false ||
    result.worldStateMechanisms.probabilityAuthority !== false ||
    result.worldStateMechanisms.certificateAuthority !== false ||
    result.ontologyOutcomes.schemaVersion !== "pmh.ontology-allocation-outcome-projection.v1" ||
    result.relationCampaign.schemaVersion !== "pmh.relation-discovery-campaign-preview.v1" ||
    result.discoveryCycle.schemaVersion !== "pmh.discovery-cycle.v1" ||
    result.discoveryCycle.providerRequestsStarted !== 0 ||
    result.discoveryCycle.modelInvocationsStarted !== 0 ||
    result.discoveryCycle.campaignActivationAuthority !== false ||
    result.providerRequestsStartedByRead !== 0 ||
    result.modelInvocationsStartedByRead !== 0 ||
    result.writesStartedByRead !== 0 ||
    result.externalWriteAuthority !== false ||
    result.valueMovingAuthority !== false
  ) {
    throw new Error("Agent workspace crossed its authority boundary");
  }
  return result;
}

function AgentOperationsView() {
  const [consoleData, setConsoleData] = useState<AgentExecutionConsole | null>(null);
  const [attentionData, setAttentionData] = useState<ResearchAttentionAllocation | null>(null);
  const [flywheelData, setFlywheelData] = useState<RelationDiscoveryCampaignPreview | null>(null);
  const [targetData, setTargetData] = useState<ResearchActionTargetProjection | null>(null);
  const [outcomeData, setOutcomeData] = useState<ResearchDecisionOutcomeProjection | null>(null);
  const [discoverySignals, setDiscoverySignals] =
    useState<DiscoverySignalProjection | null>(null);
  const [discoveryYield, setDiscoveryYield] =
    useState<DiscoveryYieldProjection | null>(null);
  const [resultRepairs, setResultRepairs] =
    useState<AgentResultRepairProjection | null>(null);
  const [semanticNovelty, setSemanticNovelty] =
    useState<SemanticNoveltyProjection | null>(null);
  const [worldStateMechanisms, setWorldStateMechanisms] =
    useState<WorldStateMechanismProjection | null>(null);
  const [ontologyOutcomeData, setOntologyOutcomeData] =
    useState<OntologyAllocationOutcomeProjection | null>(null);
  const [discoveryCycle, setDiscoveryCycle] =
    useState<AgentWorkspace["discoveryCycle"] | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [taskId, setTaskId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [manualPreview, setManualPreview] = useState<unknown | null>(null);

  async function refresh() {
    const workspace = await requestAgentWorkspace();
    const next = workspace.execution;
    const attention = workspace.attention;
    const flywheel = workspace.relationCampaign;
    const targets = workspace.targets;
    const outcomes = workspace.decisions;
    const ontologyOutcomes = workspace.ontologyOutcomes;
    if (targets.allocationProjectionIdentity !== attention.projectionIdentity) {
      throw new Error("Research target lineage does not match the current attention allocation");
    }
    setConsoleData(next);
    setAttentionData(attention);
    setFlywheelData(flywheel);
    setTargetData(targets);
    setOutcomeData(outcomes);
    setDiscoverySignals(workspace.discoverySignals);
    setDiscoveryYield(workspace.discoveryYield);
    setResultRepairs(workspace.resultRepairs);
    setSemanticNovelty(workspace.semanticNovelty);
    setWorldStateMechanisms(workspace.worldStateMechanisms);
    setOntologyOutcomeData(ontologyOutcomes);
    setDiscoveryCycle(workspace.discoveryCycle);
    setTaskId((current) => next.tasks.some((task) =>
      task.taskId === current && task.readiness.status === "RUNNABLE"
    ) ? current : next.tasks.find((task) =>
      task.readiness.status === "RUNNABLE" &&
      task.kind === "RULE_EVIDENCE_CLAIM"
    )?.taskId || next.tasks.find((task) =>
      task.readiness.status === "RUNNABLE"
    )?.taskId || "");
    setProfileId((current) => {
      if (current) return current;
      const route = [...next.workloadRoutes]
        .filter((item) => item.taskKind === "RULE_EVIDENCE_CLAIM")
        .sort((left, right) => right.revision - left.revision)[0];
      return route?.executionProfileId || next.executionProfiles.find((profile) =>
        profile.toolPolicy.protocol === "RULE_EVIDENCE_TOOLS_V1"
      )?.executionProfileId || "";
    });
    setDiagnostic(null);
  }

  async function acknowledgeSignal(signalId: string) {
    setBusy(`signal:${signalId}`);
    try {
      const response = await fetch(
        `/api/v1/discovery-signals/${encodeURIComponent(signalId)}/acknowledgements`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await response.text());
      await refresh();
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message : "Signal acknowledgement failed");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refresh().catch((error: unknown) => setDiagnostic(
      error instanceof Error ? error.message : "Agent console is unavailable",
    ));
  }, []);

  async function post(path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const result = await response.json() as { ok?: boolean; diagnostic?: string };
    if (!response.ok || result.ok === false) {
      throw new Error(result.diagnostic ?? `Agent operation returned HTTP ${response.status}`);
    }
    return result;
  }

  async function perform(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setDiagnostic(null);
    try {
      const result = await action();
      if (key === "manual-preview") setManualPreview(result);
      else setManualPreview(null);
      await refresh();
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message : "Agent operation failed");
    } finally {
      setBusy(null);
    }
  }

  if (consoleData === null) {
    return (
      <section className="page-section agent-console">
        <div className="section-heading">
          <div><span className="eyebrow">Execution substrate</span><h1>Agent operations</h1></div>
        </div>
        <Card><CardContent className="empty-state"><LoaderCircle className="spin" size={18} />{diagnostic ?? "Loading Agent ledger…"}</CardContent></Card>
      </section>
    );
  }

  const runtimes = new Map(consoleData.runtimeDefinitions.map((item) =>
    [item.runtimeDefinitionId, item] as const
  ));
  const credentials = new Map(consoleData.credentialBindings.map((item) =>
    [item.credentialBindingId, item] as const
  ));
  const models = new Map(consoleData.modelProfiles.map((item) =>
    [item.modelProfileId, item] as const
  ));
  const profiles = consoleData.executionProfiles.filter((item) =>
    item.toolPolicy.protocol === "RULE_EVIDENCE_TOOLS_V1"
  );
  const capabilities = new Map(consoleData.capabilities.map((item) =>
    [item.executionProfileId, item] as const
  ));
  const selectedCapability = capabilities.get(profileId);
  const runnableTaskCount = consoleData.tasks.filter((task) =>
    task.readiness.status === "RUNNABLE"
  ).length;
  const supersededTaskCount = consoleData.tasks.filter((task) =>
    task.readiness.status === "SUPERSEDED_INPUT"
  ).length;
  const invocationsByRun = new Map<string, AgentExecutionConsole["modelInvocations"]>();
  for (const invocation of consoleData.modelInvocations) {
    invocationsByRun.set(invocation.runId, [
      ...(invocationsByRun.get(invocation.runId) ?? []),
      invocation,
    ]);
  }

  return (
    <section className="page-section agent-console">
      <div className="section-heading agent-console-heading">
        <div>
          <span className="eyebrow">Execution substrate</span>
          <h1>Agent operations</h1>
          <p>Runtime, credential, model and effort are composed here. Only a manual run or an active campaign can spend tokens.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void perform("refresh", refresh)} disabled={busy !== null}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {diagnostic !== null && <div className="inline-alert"><CircleOff size={14} />{diagnostic}</div>}

      <div className="metric-grid agent-metrics">
        <Metric label="Runtimes" value={`${consoleData.summary.runtimeDefinitionCount}`} detail="Pi · Codex · in-process" />
        <Metric label="Execution profiles" value={`${consoleData.summary.executionProfileCount}`} detail="immutable runtime/model compositions" />
        <Metric label="Tasks / runs" value={`${consoleData.summary.taskCount} / ${consoleData.summary.runCount}`} detail={`${runnableTaskCount} current · ${supersededTaskCount} superseded in view`} />
        <Metric label="Known tokens" value={formatTokenCount((BigInt(consoleData.usage.inputTokens) + BigInt(consoleData.usage.outputTokens)).toString())} detail={`${consoleData.usage.incompleteTokenInvocationCount} invocations incomplete`} />
      </div>

      {discoveryCycle !== null && (
        <div className="research-attention-lock">
          <RefreshCw size={14} />
          <span>
            Discovery cycle {discoveryCycle.enabled
              ? `checks every ${Math.round((discoveryCycle.intervalMs ?? 0) / 1_000)}s`
              : "disabled"} · {discoveryCycle.tickCount} wakes · {discoveryCycle.membershipChangeCount} membership changes
          </span>
          <code>0 provider · 0 model · no activation authority</code>
        </div>
      )}

      {discoverySignals !== null && (
        <Card className="research-attention-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Discovery signal inbox</span>
              <h2>Only actionable state changes interrupt the operator</h2>
              <p>Membership, structured outcomes, repeated costly no-movement and portfolio exhaustion are durable. Timer wakes and model chatter stay silent.</p>
            </div>
            <Badge variant={discoverySignals.unreadCount > 0 ? "warning" : "shadow"}>
              {discoverySignals.unreadCount} UNREAD
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="research-attention-actions">
              {discoverySignals.signals.length === 0 ? (
                <div className="empty-state">No actionable discovery transition has occurred.</div>
              ) : discoverySignals.signals.slice(0, 12).map((signal) => (
                <article key={signal.signalId} className={signal.status === "READ" ? "is-read" : ""}>
                  <div className="research-attention-action-head">
                    <div>
                      <Badge variant={signal.severity === "WARNING" ? "warning" :
                        signal.severity === "ATTENTION" ? "verified" : "muted"}>
                        {signal.kind.replaceAll("_", " ")}
                      </Badge>
                      {signal.noveltyReason !== null && (
                        <Badge variant="muted">{signal.noveltyReason.replaceAll("_", " ")}</Badge>
                      )}
                    </div>
                    <code>{new Date(signal.observedAt).toLocaleString()}</code>
                  </div>
                  <strong>{signal.title}</strong>
                  <p>{signal.summary}</p>
                  <div className="research-attention-facts">
                    <span>{formatTokenCount(signal.knownTokenDelta)} attributed tokens</span>
                    <span>{signal.outcomeState?.replaceAll("_", " ") ?? "lineage transition"}</span>
                    <span>0 provider · 0 model · 0 runs by signal</span>
                  </div>
                  {signal.status === "UNREAD" ? (
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void acknowledgeSignal(signal.signalId)}
                    >
                      Mark read
                    </Button>
                  ) : <Badge variant="shadow">READ</Badge>}
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {semanticNovelty !== null && (
        <Card className="research-attention-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Semantic novelty admission</span>
              <h2>Did Agent spend expand the machine&apos;s ontology?</h2>
              <p>Exact query coverage and payoff skeletons are compared before retention. Differing payoff prose stays explicitly incomparable; it is never promoted by a similarity score.</p>
            </div>
            <Badge variant={(semanticNovelty.redundantSearchMemoryRejectionCount +
              semanticNovelty.redundantPayoffEvidenceRejectionCount) > 0 ? "verified" : "shadow"}>
              {semanticNovelty.redundantSearchMemoryRejectionCount +
                semanticNovelty.redundantPayoffEvidenceRejectionCount} REPEATS STOPPED
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="research-attention-summary">
              <div><strong>{semanticNovelty.novelSearchRouteCount}</strong><span>novel routes</span></div>
              <div><strong>{semanticNovelty.novelPayoffEvidenceCount}</strong><span>novel payoff skeletons</span></div>
              <div><strong>{semanticNovelty.incomparablePayoffEvidenceCount}</strong><span>incomparable payoff evidence</span></div>
              <div><strong>{formatTokenCount(semanticNovelty.knownTotalTokens)}</strong><span>affected-run tokens</span></div>
            </div>
            <div className="research-attention-lock">
              <span>
                {semanticNovelty.retainedFindingCount} retained findings · {semanticNovelty.historicalRedundantRetainedCount} historical repeats · {semanticNovelty.exactRejectionCount}/{semanticNovelty.rejections.length} exact rejections
              </span>
              <code>{semanticNovelty.admissionAffectedRunCount} RUNS</code>
            </div>
            <div className="research-attention-actions">
              {semanticNovelty.rejections.length === 0 ? (
                <div className="empty-state">
                  No semantic-repeat rejection is retained yet. Admission is active for new relation results.
                </div>
              ) : semanticNovelty.rejections.slice(0, 8).map((rejection) => (
                <article key={rejection.effectId}>
                  <div className="research-attention-action-head">
                    <div>
                      <Badge variant="verified">{rejection.classification.replaceAll("_", " ")}</Badge>
                      <Badge variant={rejection.integrity === "EXACT" ? "muted" : "warning"}>
                        {rejection.integrity.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <code>{rejection.runId.slice(7, 19)}</code>
                  </div>
                  <strong>{rejection.toolName.replaceAll("_", " ")}</strong>
                  <p>{rejection.overlapFindingIds.length} exact retained overlap{rejection.overlapFindingIds.length === 1 ? "" : "s"}; the rejected candidate created no finding.</p>
                  <div className="research-attention-facts">
                    {rejection.overlapFindingIds.slice(0, 3).map((id) => (
                      <span key={id}>finding {id.slice(7, 19)}</span>
                    ))}
                    <span>{new Date(rejection.occurredAt).toLocaleString()}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="research-attention-lock">
              <CircleOff size={14} />
              <span>Provider-free exact coverage · no semantic, dispatch, or trading authority</span>
              <code>{semanticNovelty.projectionIdentity.slice(7, 19)}</code>
            </div>
          </CardContent>
        </Card>
      )}

      {worldStateMechanisms !== null && (
        <Card className="research-attention-card">
          <CardHeader>
            <div>
              <span className="eyebrow">World-state mechanism memory</span>
              <h2>Search through what can change in the world</h2>
              <p>Agents connect a trigger to a latent state and a dependent event. These are reusable search routes with explicit counter-scenarios, never causal facts or probability estimates.</p>
            </div>
            <Badge variant={worldStateMechanisms.routeCount > 0 ? "verified" : "shadow"}>
              {worldStateMechanisms.routeCount} ROUTES
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="research-attention-summary">
              <div><strong>{worldStateMechanisms.proposalCount}</strong><span>admitted proposals</span></div>
              <div><strong>{worldStateMechanisms.routeCount}</strong><span>mechanism families</span></div>
              <div><strong>{worldStateMechanisms.counterexampleCount}</strong><span>falsifiers</span></div>
              <div><strong>0</strong><span>provider calls by read</span></div>
            </div>
            <div className="research-attention-actions">
              {worldStateMechanisms.routes.length === 0 ? (
                <div className="empty-state">
                  No mechanism memory has been admitted yet. V3 ontology issues can now author the first route.
                </div>
              ) : worldStateMechanisms.routes.slice(0, 8).map((route) => (
                <article key={route.routeId}>
                  <div className="research-attention-action-head">
                    <div>
                      <Badge variant="verified">{route.stateDimension.replaceAll("_", " ")}</Badge>
                      <Badge variant={route.counterexampleCount > 0 ? "warning" : "muted"}>
                        {route.counterexampleCount} FALSIFIERS
                      </Badge>
                    </div>
                    <code>{route.routeFamilyId.slice(7, 19)}</code>
                  </div>
                  <strong>{route.canonicalSubjectLabels.join(" · ")}</strong>
                  <p>{route.triggerPredicate} → {route.stateLabel} → {route.dependentPredicate}</p>
                  <div className="research-attention-facts">
                    <span>{route.triggerInfluence.replaceAll("_", " ")}</span>
                    <span>{route.dependentRequirement.replaceAll("_", " ")}</span>
                    <span>{route.temporalPosture.replaceAll("_", " ")}</span>
                    <span>{route.counterScenarioCount} counter-scenarios</span>
                    <span>{route.sourceRunCount} source runs</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="research-attention-lock">
              <Waypoints size={14} />
              <span>Routing-only ontology · no probability, certificate, dispatch, or trading authority</span>
              <code>{worldStateMechanisms.projectionIdentity.slice(7, 19)}</code>
            </div>
          </CardContent>
        </Card>
      )}

      {resultRepairs !== null && (
        <Card className="research-attention-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Agent result repair</span>
              <h2>Do rejected structured results recover inside the same budget?</h2>
              <p>First-party rejection stays authoritative. Repair turns retain their exact rejected-effect lineage and token cost instead of becoming hidden retries.</p>
            </div>
            <Badge variant={resultRepairs.acceptedAfterRepairRunCount > 0 ? "verified" :
              resultRepairs.repairRunCount > 0 ? "warning" : "shadow"}>
              {resultRepairs.acceptedAfterRepairRunCount}/{resultRepairs.repairRunCount} RECOVERED
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="research-attention-summary">
              <div><strong>{resultRepairs.repairRunCount}</strong><span>repair runs</span></div>
              <div><strong>{resultRepairs.repairInvocationCount}</strong><span>repair calls</span></div>
              <div><strong>{resultRepairs.acceptedAfterRepairRunCount}</strong><span>accepted after repair</span></div>
              <div><strong>{formatTokenCount(resultRepairs.knownTotalTokens)}</strong><span>repair tokens</span></div>
            </div>
            <div className="research-attention-lock">
              <span>
                {resultRepairs.rejectedResultEffectCount} linked rejections · {resultRepairs.budgetTerminatedRepairRunCount} budget terminations · {resultRepairs.unlinkedRejectedEffectCount} historical/unlinked rejections
              </span>
              <code>{resultRepairs.exactRepairRunCount}/{resultRepairs.repairRunCount} EXACT</code>
            </div>
            <div className="research-attention-actions">
              {resultRepairs.runs.length === 0 ? (
                <div className="empty-state">
                  No purpose-classified repair invocation has been retained yet. {resultRepairs.historicalUnclassifiedInvocationCount} historical invocations remain deliberately unclassified.
                </div>
              ) : resultRepairs.runs.slice(0, 8).map((run) => (
                <article key={run.runId}>
                  <div className="research-attention-action-head">
                    <div>
                      <Badge variant={run.acceptedAfterRepair ? "verified" :
                        run.budgetTerminated ? "warning" : "muted"}>
                        {run.acceptedAfterRepair ? "ACCEPTED AFTER REPAIR" :
                          run.budgetTerminated ? "BUDGET TERMINATED" : run.runStatus}
                      </Badge>
                      <Badge variant={run.integrity === "EXACT" ? "muted" : "warning"}>
                        {run.integrity.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <code>{run.runId.slice(7, 19)}</code>
                  </div>
                  <strong>{run.repairAttemptCount} result repair attempt{run.repairAttemptCount === 1 ? "" : "s"}</strong>
                  <p>{run.diagnostic}</p>
                  <div className="research-attention-facts">
                    <span>{run.repairInvocationCount} model calls</span>
                    <span>{run.rejectedResultEffectCount} linked rejections</span>
                    <span>{formatTokenCount(run.knownTotalTokens)} known tokens</span>
                    <span>{run.incompleteUsageInvocationCount} incomplete usage</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="research-attention-lock">
              <CircleOff size={14} />
              <span>Read-only attribution · no retry, dispatch, or policy authority</span>
              <code>{resultRepairs.projectionIdentity.slice(7, 19)}</code>
            </div>
          </CardContent>
        </Card>
      )}

      {discoveryYield !== null && (
        <Card className="research-attention-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Discovery yield attribution</span>
              <h2>Which semantic search strategies earn new evidence?</h2>
              <p>Append-only observations close non-overlapping decision windows before tokens or findings are compared. No scalar score can mutate policy.</p>
            </div>
            <Badge variant={discoveryYield.qualifiedStratumCount > 0 ? "verified" : "shadow"}>
              {discoveryYield.qualifiedStratumCount}/{discoveryYield.representedStratumCount} STRATA QUALIFIED
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="research-attention-lock">
              <span>
                {discoveryYield.observationCount} observations → {discoveryYield.episodeCount} allocations →{" "}
                {discoveryYield.campaignMembershipBoundWindowCount} campaign memberships →{" "}
                {discoveryYield.newRunCount} retained runs → {discoveryYield.terminalWindowCount} terminal outcomes
              </span>
              <code>EXACT FUNNEL</code>
            </div>
            <div className="research-attention-summary">
              <div><strong>{discoveryYield.observationCount}</strong><span>observations</span></div>
              <div><strong>{discoveryYield.episodeCount}</strong><span>allocations</span></div>
              <div><strong>{discoveryYield.actedWindowCount}</strong><span>acted windows</span></div>
              <div><strong>{discoveryYield.productiveComparableWindowCount}</strong><span>productive</span></div>
            </div>
            <div className="research-attention-actions">
              {discoveryYield.strata.length === 0 ? (
                <div className="empty-state">No decision window has enough retained observation state for policy comparison.</div>
              ) : discoveryYield.strata.slice(0, 8).map((stratum) => (
                <article key={stratum.stratumId}>
                  <div className="research-attention-action-head">
                    <div>
                      <Badge variant={stratum.yieldCostEstimateQualified ? "verified" : "muted"}>
                        {stratum.yieldCostEstimateQualified ? "RATE QUALIFIED" : "SPARSE EVIDENCE"}
                      </Badge>
                      <Badge variant="muted">{stratum.downstreamSystem.replaceAll("_", " ")}</Badge>
                      <Badge variant="muted">{stratum.noveltyReason.replaceAll("_", " ")}</Badge>
                    </div>
                    <code>{stratum.stratumId.slice(7, 19)}</code>
                  </div>
                  <strong>{stratum.allocationActionKind.replaceAll("_", " ")}</strong>
                  <p>{stratum.comparableTerminalWindowCount}/{stratum.terminalWindowCount} terminal windows are comparable under the exact policy stratum.</p>
                  <div className="research-attention-facts">
                    <span>{formatTokenCount(stratum.knownTotalTokens)} attributable tokens</span>
                    <span>{stratum.newRunCount} retained runs</span>
                    <span>{stratum.positiveFindingCount} positive · {stratum.counterexampleCount} counter</span>
                    <span>{stratum.noFindingTerminalRunCount} no-yield memory</span>
                    <span>{stratum.positiveValueStageDelta} stage movement</span>
                    <span>{formatYieldRate(stratum.ratesPer100kKnownTokens.positiveFindings)} positive / 100k tokens</span>
                    <span>{formatYieldRate(stratum.ratesPer100kKnownTokens.counterexamples)} counter / 100k tokens</span>
                  </div>
                </article>
              ))}
            </div>
            {discoveryYield.windows.length > 0 && (
              <div className="research-attention-actions">
                {discoveryYield.windows.slice(-4).reverse().map((window) => {
                  const tokens = BigInt(window.cost.knownInputTokens) +
                    BigInt(window.cost.knownOutputTokens) +
                    BigInt(window.cost.knownReasoningTokens);
                  return (
                    <article key={window.windowId}>
                      <div className="research-attention-action-head">
                        <div>
                          <Badge variant={window.comparable ? "verified" :
                            window.status.startsWith("OPEN_") ? "muted" : "warning"}>
                            {window.status.replaceAll("_", " ")}
                          </Badge>
                          <Badge variant="muted">{window.integrity.replaceAll("_", " ")}</Badge>
                        </div>
                        <code>{window.episodeId.slice(7, 19)}</code>
                      </div>
                      <strong>{window.downstreamSystem.replaceAll("_", " ")}</strong>
                      <p>{window.diagnostic}</p>
                      <div className="research-attention-facts">
                        <span>{formatTokenCount(tokens.toString())} interval tokens</span>
                        <span>{window.yieldDelta.newRunCount} retained runs</span>
                        <span>{window.yieldDelta.newPositiveFindingCount} positive</span>
                        <span>{window.yieldDelta.newCounterexampleCount} counter</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <div className="research-attention-lock">
              <CircleOff size={14} />
              <span>{discoveryYield.comparableTerminalWindowCount} comparable terminal · {discoveryYield.nonComparableWindowCount} open or incomparable · policy mutation disabled</span>
              <code>{discoveryYield.projectionIdentity.slice(7, 19)}</code>
            </div>
          </CardContent>
        </Card>
      )}

      {ontologyOutcomeData !== null && (
        <Card className="research-attention-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Ontology allocation outcomes</span>
              <h2>Did selected Agent attention create research movement?</h2>
              <p>Exact campaign lineage separates direct spend from shared downstream work. This read cannot change policy or start an Agent.</p>
            </div>
            <Badge variant={ontologyOutcomeData.recurrenceQualification.yieldCostEvidenceSufficient
              ? "warning"
              : "shadow"}>
              {ontologyOutcomeData.recurrenceQualification.yieldCostEvidenceSufficient
                ? "EVIDENCE READY · OPERATOR REQUIRED"
                : "RECURRENCE UNQUALIFIED"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="research-attention-summary">
              <div><strong>{ontologyOutcomeData.campaignEpisodeCount}</strong><span>bound campaigns</span></div>
              <div><strong>{ontologyOutcomeData.selectedActionCount}</strong><span>selected actions</span></div>
              <div><strong>{ontologyOutcomeData.actedActionCount}</strong><span>acted</span></div>
              <div><strong>{ontologyOutcomeData.terminalActionCount}</strong><span>terminal</span></div>
            </div>
            <div className="research-attention-actions">
              {ontologyOutcomeData.campaigns.length === 0 ? (
                <div className="empty-state">No immutable ontology allocation campaign has been recorded yet.</div>
              ) : ontologyOutcomeData.campaigns.slice(-2).flatMap((campaign) =>
                campaign.actionOutcomes.map((outcome) => {
                  const directTokens = BigInt(outcome.directCost.knownInputTokens) +
                    BigInt(outcome.directCost.knownOutputTokens) +
                    BigInt(outcome.directCost.knownReasoningTokens);
                  return (
                    <article key={outcome.outcomeId}>
                      <div className="research-attention-action-head">
                        <div>
                          <Badge variant={outcome.acted ? "verified" : "muted"}>
                            {outcome.acted ? "ACTED" : "UNACTED"}
                          </Badge>
                          <Badge variant={outcome.usefulNegativeMemory ? "warning" : "shadow"}>
                            {outcome.stage.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <code>{outcome.selectionActionRef.slice(7, 19)}</code>
                      </div>
                      <strong>{outcome.selectionActionKind.replaceAll("_", " ")}</strong>
                      <p>{outcome.diagnostic}</p>
                      <div className="research-action-resolution">
                        <span>{outcome.downstreamAttribution.replaceAll("_", " ")}</span>
                        <strong>{formatTokenCount(directTokens.toString())} direct tokens</strong>
                        <code>{outcome.workFamilyRef.slice(0, 34)}</code>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
            <div className="research-attention-lock">
              <CircleOff size={14} />
              <span>
                {ontologyOutcomeData.recurrenceQualification.qualifiedStratumCount}/
                {ontologyOutcomeData.recurrenceQualification.representedStratumCount} strata have at least three exact terminal actions · automatic dispatch off
              </span>
              <code>{ontologyOutcomeData.projectionIdentity.slice(7, 19)}</code>
            </div>
          </CardContent>
        </Card>
      )}

      {attentionData !== null && (
        <Card className="research-attention-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Persistent research portfolio</span>
              <h2>What deserves the next unit of Agent attention?</h2>
              <p>Downstream progress, falsification and cost decide the lane. A read never starts work.</p>
            </div>
            <Badge variant={attentionData.recurrenceQualification.evidenceThresholdSatisfied ? "warning" : "shadow"}>
              {attentionData.recurrenceQualification.evidenceThresholdSatisfied
                ? "OPERATOR DECISION DUE"
                : "RECURRENCE UNQUALIFIED"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="research-attention-summary">
              <div><strong>{attentionData.familyCount}</strong><span>stable families</span></div>
              <div><strong>{attentionData.portfolio.length}</strong><span>selected actions</span></div>
              <div><strong>{attentionData.recurrenceQualification.terminalRelationRunCount}</strong><span>terminal searches</span></div>
              <div><strong>{attentionData.recurrenceQualification.independentlyReviewedPositiveFindingCount}</strong><span>reviewed findings</span></div>
            </div>
            <div className="research-attention-actions">
              {attentionData.portfolio.length === 0 ? (
                <div className="empty-state">No bounded next action is justified by retained evidence.</div>
              ) : attentionData.portfolio.map((action) => {
                const family = attentionData.families.find((item) =>
                  item.workItemId === action.workItemId
                );
                const targets = targetData?.targets.filter((item) =>
                  item.allocationActionId === action.actionId
                ) ?? [];
                const primaryTarget = targets[0] ?? null;
                const decisionOutcomes = outcomeData?.outcomes.filter((item) =>
                  item.workItemId === action.workItemId
                ).sort((left, right) => right.capturedAt.localeCompare(left.capturedAt)) ?? [];
                const latestOutcome = decisionOutcomes[0] ?? null;
                const currentDecisionRecorded = primaryTarget !== null && decisionOutcomes.some((item) =>
                  item.allocationActionId === action.actionId && item.targetId === primaryTarget.targetId
                );
                const knownTokens = family === undefined ? 0n :
                  BigInt(family.usage.knownInputTokens) + BigInt(family.usage.knownOutputTokens);
                return (
                  <article key={action.actionId}>
                    <div className="research-attention-action-head">
                      <div>
                        <Badge variant={action.lane === "EXPLORATION" ? "shadow" : "warning"}>
                          {action.lane.replaceAll("_", " ")}
                        </Badge>
                        <Badge variant="muted">{action.valueStage.replaceAll("_", " ")}</Badge>
                        <Badge variant="muted">
                          {action.noveltyReason.replaceAll("_", " ")}
                        </Badge>
                        {primaryTarget !== null && (
                          <Badge variant={primaryTarget.state.startsWith("READY_")
                            ? "verified"
                            : primaryTarget.state.includes("BLOCKED") ? "warning" : "muted"}>
                            {primaryTarget.state.replaceAll("_", " ")}
                          </Badge>
                        )}
                      </div>
                      <code>{action.workItemId?.slice(7, 19) ?? "portfolio"}</code>
                    </div>
                    <strong>{action.kind.replaceAll("_", " ")}</strong>
                    <p>{action.diagnostic}</p>
                    {primaryTarget !== null && (
                      <div className="research-action-resolution">
                        <span>{primaryTarget.downstreamSystem.replaceAll("_", " ")}</span>
                        <strong>{primaryTarget.diagnostic}</strong>
                        <code>{primaryTarget.requirementKind ?? "DIRECT TASK"} · {primaryTarget.requirementId?.slice(7, 19) ?? primaryTarget.sourceTaskId?.slice(7, 19) ?? "unmaterialized"}</code>
                      </div>
                    )}
                    {latestOutcome !== null && (
                      <div className="research-decision-outcome">
                        <div>
                          <span>Decision memory</span>
                          <Badge variant={latestOutcome.state === "ADVANCED" || latestOutcome.state === "USEFUL_NEGATIVE_MEMORY" ? "verified" : latestOutcome.state.includes("INCOMPLETE") || latestOutcome.state.includes("SPENT") ? "warning" : "muted"}>
                            {latestOutcome.state.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <strong>{latestOutcome.diagnostic}</strong>
                        <code>{latestOutcome.noveltyReason.replaceAll("_", " ").toLowerCase()} · {latestOutcome.newArtifactRefs.length} new artifacts · {formatTokenCount((BigInt(latestOutcome.costDelta.knownInputTokens) + BigInt(latestOutcome.costDelta.knownOutputTokens)).toString())} token delta</code>
                        {(latestOutcome.antiLoopMemory.retainedCounterexampleCount > 0 ||
                          latestOutcome.antiLoopMemory.retainedNoFindingTerminalRunCount > 0) && (
                          <code>{latestOutcome.antiLoopMemory.retainedCounterexampleCount} retained counterexamples · {latestOutcome.antiLoopMemory.retainedNoFindingTerminalRunCount} no-yield terminal attempts</code>
                        )}
                      </div>
                    )}
                    <div className="research-attention-facts">
                      <span>{family?.runCount ?? 0} prior run{family?.runCount === 1 ? "" : "s"}</span>
                      <span>{family?.positiveFindingCount ?? 0} positive · {family?.counterexampleCount ?? 0} counter</span>
                      <span>{formatTokenCount(knownTokens.toString())} known tokens</span>
                      <span>{primaryTarget?.manualOperation.available
                        ? `${primaryTarget.manualOperation.kind.replaceAll("_", " ").toLowerCase()} ready`
                        : action.dispatchableByRelationCampaign ? "campaign task ready" : "manual operation held"}</span>
                      {primaryTarget !== null && (
                        <span>{primaryTarget.retainedCost.providerRequestCount} provider · {primaryTarget.retainedCost.toolCallCount} tool · {primaryTarget.retainedCost.fetchAttemptCount} fetch</span>
                      )}
                    </div>
                    {primaryTarget !== null && (
                      <div className="research-decision-control">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null || currentDecisionRecorded}
                          onClick={() => void perform(`record-decision-${primaryTarget.targetId}`, () => post("/api/v1/research-decisions", {
                            allocationProjectionIdentity: attentionData.projectionIdentity,
                            allocationActionId: action.actionId,
                            targetId: primaryTarget.targetId,
                            captureRef: "operator:studio",
                          }))}
                        >{currentDecisionRecorded ? "Decision recorded" : "Record decision"}</Button>
                        <span>Local baseline only · does not run or dispatch an Agent</span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="research-attention-lock">
              <CircleOff size={14} />
              <span>{attentionData.heldFamilyCount} held · {attentionData.omittedActionableFamilyCount} omitted by lane caps · {flywheelData?.intentCampaignId === null ? "flywheel not retained" : "paused flywheel retained"}</span>
              <code>{attentionData.projectionIdentity.slice(7, 19)}</code>
            </div>
            {flywheelData !== null && (
              <div className="research-decision-control">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null || !flywheelData.creationEligible}
                  onClick={() => void perform("create-discovery-flywheel", () =>
                    post("/api/v1/relation-discovery/campaigns", {}))}
                >{flywheelData.intentCampaignId === null
                    ? "Retain paused flywheel"
                    : "Flywheel retained"}</Button>
                <span>{flywheelData.taskIds.length} ranked member · {flywheelData.diagnostic} · no Agent runs on creation</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="agent-console-grid">
        <Card>
          <CardHeader>
            <div><span className="eyebrow">Capability</span><h2>Execution capability</h2><p>Configuration, runtime presence, service access and dispatch eligibility are separate signals.</p></div>
          </CardHeader>
          <CardContent className="agent-runtime-list">
            {consoleData.runtimeDefinitions.map((runtime) => {
              const compatibleProfiles = consoleData.executionProfiles.filter((profile) =>
                profile.runtimeDefinitionId === runtime.runtimeDefinitionId
              );
              const readyCount = compatibleProfiles.filter((profile) =>
                capabilities.get(profile.executionProfileId)?.dispatchEligibility === "ELIGIBLE"
              ).length;
              return (
                <div className="agent-runtime-row" key={runtime.runtimeDefinitionId}>
                  <div><strong>{runtime.kind.replace("HARNESS_IN_PROCESS", "In-process")}</strong><span>{runtime.version}</span></div>
                  <Badge variant={readyCount > 0 ? "verified" : "warning"}>{readyCount}/{compatibleProfiles.length} dispatchable</Badge>
                </div>
              );
            })}
            {consoleData.credentialBindings.map((binding) => (
              <div className="agent-credential-row" key={binding.credentialBindingId}>
                <span>{binding.kind}</span>
                <span>{binding.configuration?.status === "CONFIGURED" ? "Configured" : binding.configuration?.diagnostic ?? "Missing"}</span>
              </div>
            ))}
            {consoleData.executionProfiles.map((profile) => {
              const runtime = runtimes.get(profile.runtimeDefinitionId);
              const model = models.get(profile.modelProfileId);
              const capability = capabilities.get(profile.executionProfileId);
              return (
                <div className="agent-runtime-row" key={`capability:${profile.executionProfileId}`}>
                  <div>
                    <strong>{runtime?.kind ?? "runtime"} · {model?.model ?? "model"}</strong>
                    <span>{capability?.serviceCapability ?? "UNVERIFIED"} · {capability?.diagnostic ?? "not checked"}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void perform(
                      `preflight-${profile.executionProfileId}`,
                      () => post(`/api/v1/execution-profiles/${profile.executionProfileId}/preflight`),
                    )}
                  >
                    {capability?.observation == null ? "Preflight" : "Recheck"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div><span className="eyebrow">Attribution</span><h2>Token and incident ledger</h2></div>
          </CardHeader>
          <CardContent className="agent-usage-ledger">
            <div><span>Input</span><strong>{formatTokenCount(consoleData.usage.inputTokens)}</strong></div>
            <div><span>Output</span><strong>{formatTokenCount(consoleData.usage.outputTokens)}</strong></div>
            <div><span>Reasoning</span><strong>{formatTokenCount(consoleData.usage.reasoningTokens)}</strong></div>
            <p>{consoleData.usage.currencyCostDiagnostic}</p>
            <div className="agent-usage-breakdown">
              {consoleData.usage.byRuntimeModelPurpose.slice(0, 5).map((item) => (
                <div key={`${item.runtimeKind}:${item.model}:${item.taskKind}:${item.invocationPurpose}`}>
                  <span>{item.runtimeKind} · {item.model}<small>{item.taskKind} · {item.invocationPurpose.replaceAll("_", " ").toLowerCase()} · {item.invocationCount} calls · {item.failedInvocationCount} failed</small></span>
                  <strong>{formatTokenCount((BigInt(item.inputTokens) + BigInt(item.outputTokens)).toString())}</strong>
                </div>
              ))}
            </div>
            <div className="incident-chips">
              {Object.entries(consoleData.incidentCounts).filter(([, count]) => count > 0).map(([category, count]) => (
                <Badge key={category} variant={category.includes("CODEX") ? "warning" : "muted"}>{category.replaceAll("_", " ").toLowerCase()} · {count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="agent-control-card">
        <CardHeader>
          <div><span className="eyebrow">Explicit authority</span><h2>Prepare work</h2><p>Previewing and creating a paused campaign make zero model requests.</p></div>
        </CardHeader>
        <CardContent>
          <div className="agent-control-form">
            <label><span>Current runnable task</span><Select value={taskId} onValueChange={(value) => { setTaskId(value); setManualPreview(null); }}><SelectTrigger><SelectValue placeholder="Select runnable task" /></SelectTrigger><SelectContent>{consoleData.tasks.filter((task) => task.readiness.status === "RUNNABLE").slice(0, 100).map((task) => <SelectItem key={task.taskId} value={task.taskId}>{task.kind} · {task.taskId.slice(7, 17)}</SelectItem>)}</SelectContent></Select></label>
            <label><span>Execution profile</span><Select value={profileId} onValueChange={(value) => { setProfileId(value); setManualPreview(null); }}><SelectTrigger><SelectValue placeholder="Select profile" /></SelectTrigger><SelectContent>{profiles.map((profile) => {
              const runtime = runtimes.get(profile.runtimeDefinitionId);
              const model = models.get(profile.modelProfileId);
              return <SelectItem key={profile.executionProfileId} value={profile.executionProfileId}>{runtime?.kind ?? "runtime"} · {model?.model ?? "model"} · r{profile.revision}</SelectItem>;
            })}</SelectContent></Select></label>
          </div>
          <div className="agent-control-actions">
            <Button variant="outline" disabled={!taskId || !profileId || busy !== null} onClick={() => void perform("manual-preview", () => post(`/api/v1/agent-tasks/${taskId}/runs`, { mode: "PREVIEW", executionProfileId: profileId }))}>Preview manual run</Button>
            <Button variant="outline" disabled={!taskId || !profileId || busy !== null} onClick={() => void perform("campaign-create", () => post("/api/v1/agent-campaigns", {
              campaignKey: `studio-rule-evidence-${Date.now()}`,
              executionProfileId: profileId,
              taskIds: [taskId],
              schedule: { kind: "MANUAL_ONLY", intervalMs: null },
              budget: { maximumConcurrentRuns: 1, maximumModelInvocations: 3, maximumInputTokens: "100000", maximumOutputTokens: "20000", maximumWallClockMs: 300000 },
            }))}>Create paused campaign</Button>
            {manualPreview !== null && <Button disabled={busy !== null || selectedCapability?.dispatchEligibility !== "ELIGIBLE"} onClick={() => void perform("manual-execute", () => post(`/api/v1/agent-tasks/${taskId}/runs`, { mode: "EXECUTE", executionProfileId: profileId, authorizationRef: "operator:studio-manual" }))}><Play size={12} /> Run reviewed snapshot</Button>}
          </div>
          {selectedCapability?.dispatchEligibility === "BLOCKED" && (
            <div className="inline-alert"><CircleOff size={14} />Selected profile is blocked: {selectedCapability.diagnostic}</div>
          )}
          {manualPreview !== null && <pre className="agent-preview">{JSON.stringify(manualPreview, null, 2)}</pre>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><span className="eyebrow">Campaigns</span><h2>Spend authority</h2></div></CardHeader>
        <CardContent className="agent-campaign-list">
          {consoleData.campaigns.length === 0 && <div className="empty-state">No campaign exists. Routes and credentials alone cannot dispatch work.</div>}
          {consoleData.campaigns.slice().reverse().slice(0, 20).map((campaign) => (
            <div className="agent-campaign-row" key={campaign.campaignId}>
              <div>
                <strong>{campaign.campaignKey}</strong>
                <span>
                  {campaign.superseded ? "SUPERSEDED" : campaign.status} · membership r{campaign.revision} · {campaign.taskIds.length} current task · {campaign.preview?.consumedModelInvocations ?? 0}/{campaign.budget.maximumModelInvocations} lineage invocations
                </span>
                {campaign.membershipPolicyBinding !== undefined && (
                  <small>intent {campaign.membershipPolicyBinding.membershipPolicyIdentity.slice(7, 19)} · {campaign.membershipPolicyBinding.selectionProtocol}</small>
                )}
              </div>
              <div>
                {!campaign.superseded && campaign.status === "PAUSED" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void perform(`activate-${campaign.campaignId}`, () => post(`/api/v1/agent-campaigns/${campaign.campaignId}/activate`, { activationRef: "operator:studio" }))}>Activate only</Button>}
                {!campaign.superseded && campaign.status === "ACTIVE" && <><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void perform(`pause-${campaign.campaignId}`, () => post(`/api/v1/agent-campaigns/${campaign.campaignId}/pause`))}><Pause size={11} /> Pause</Button><Button size="sm" disabled={busy !== null || campaign.preview?.maximumImmediateFanout === 0} onClick={() => void perform(`dispatch-${campaign.campaignId}`, () => post(`/api/v1/agent-campaigns/${campaign.campaignId}/dispatch`))}><Play size={11} /> Dispatch {campaign.preview?.maximumImmediateFanout ?? 0}</Button></>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><span className="eyebrow">Recent lineage</span><h2>Runs and model invocations</h2></div></CardHeader>
        <CardContent className="agent-run-list">
          {consoleData.runs.slice(0, 40).map((run) => {
            const profile = consoleData.executionProfiles.find((item) => item.executionProfileId === run.executionProfileId);
            const model = profile === undefined ? undefined : models.get(profile.modelProfileId);
            const runtime = profile === undefined ? undefined : runtimes.get(profile.runtimeDefinitionId);
            const invocations = invocationsByRun.get(run.runId) ?? [];
            const failedInvocations = invocations.filter((item) =>
              item.failureCategory !== undefined && item.failureCategory !== null
            );
            const runTokens = invocations.reduce((total, item) => total + BigInt(item.inputTokens ?? "0") + BigInt(item.outputTokens ?? "0"), 0n);
            return (
              <div className="agent-run-row" key={run.runId}>
                <Badge variant={run.status === "SUCCEEDED" ? "verified" : run.status === "PREPARED" ? "shadow" : "warning"}>
                  {run.status}
                </Badge>
                <div>
                  <strong>{runtime?.kind ?? "legacy"} · {model?.model ?? "unresolved model"}</strong>
                  <span>
                    {run.authorization.kind} · run {run.runOrdinal} · {invocations.length} calls · {formatTokenCount(runTokens.toString())} tokens
                  </span>
                  {invocations.some((item) => item.purpose === "RESULT_REPAIR") && (
                    <small>{invocations.filter((item) => item.purpose === "RESULT_REPAIR").length} purpose-classified result repair calls</small>
                  )}
                  {run.terminalDiagnostic !== null && <small>{run.terminalDiagnostic}</small>}
                  {failedInvocations.length > 0 && (
                    <details className="agent-invocation-diagnostics">
                      <summary>
                        {failedInvocations.length} invocation failure{failedInvocations.length === 1 ? "" : "s"}
                      </summary>
                      {failedInvocations.map((invocation) => (
                        <div key={invocation.invocationId}>
                          <code>{invocation.failureCategory}</code>
                          <p>
                            {invocation.diagnostic ??
                              "No bounded transport diagnostic was retained for this historical invocation."}
                          </p>
                        </div>
                      ))}
                    </details>
                  )}
                </div>
                <code>{run.runId.slice(7, 19)}</code>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

function Overview({
  onInspect,
}: {
  onInspect: (opportunity: Opportunity) => void;
}) {
  const studioProjection = useStudioProjection();
  const catalogObservation = studioProjection.ai.catalogObservation;
  const [scoutStatus, setScoutStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [refreshStatus, setRefreshStatus] = useState<
    "IDLE" | "RUNNING" | "READY" | "DEGRADED" | "FAILED"
  >("IDLE");
  const [configurationStatus, setConfigurationStatus] = useState<
    "IDLE" | "SAVING" | "SAVED" | "FAILED"
  >("IDLE");
  const [configurationDiagnostic, setConfigurationDiagnostic] = useState<string | null>(null);
  const runtimeConfiguration = studioProjection.ai.runtimeConfiguration;

  async function updateAiRuntimeConfiguration(
    patch: Partial<Pick<
      AiRuntimeConfiguration,
      | "provider"
      | "codexModel"
      | "codexReasoningEffort"
      | "deepseekAutomationEnabled"
    >>,
  ): Promise<void> {
    setConfigurationStatus("SAVING");
    setConfigurationDiagnostic(null);
    try {
      await requestAiRuntimeConfigurationUpdate({
        ...runtimeConfiguration.configuration,
        ...patch,
      });
      setConfigurationStatus("SAVED");
    } catch (error) {
      setConfigurationStatus("FAILED");
      setConfigurationDiagnostic(
        error instanceof Error ? error.message : "configuration update failed",
      );
    }
  }

  async function runScout(): Promise<void> {
    setScoutStatus("RUNNING");
    try {
      const restored = await requestSearchLease();
      setScoutStatus(restored ? "RESTORED" : "DONE");
    } catch {
      setScoutStatus("FAILED");
    }
  }

  async function refreshCatalog(): Promise<void> {
    setRefreshStatus("RUNNING");
    try {
      setRefreshStatus(await requestCatalogRefresh());
    } catch {
      setRefreshStatus("FAILED");
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <Badge variant="verified">
            <Activity size={10} />
            System online
          </Badge>
          <h1>Find the relation the market missed.</h1>
          <p>
            Start from unusual market neighborhoods—not a preconceived claim.
            Agents inspect the contracts, propose a relation, and try to break
            it before anything reaches review.
          </p>
        </div>
        <div className="hero-identity">
          <span className="identity-kicker">
            <Hexagon size={13} />
            Current snapshot
          </span>
          <code title={studioProjection.identity.stateHash}>
            {studioProjection.identity.stateHash.slice(0, 22)}…
          </code>
          <div>
            <Badge variant="muted">Live data</Badge>
            <span>{studioProjection.identity.mode} · {studioProjection.identity.view}</span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="System metrics">
        <Metric
          label="Live markets"
          value={`${catalogObservation.listingCount}`}
          detail="current anonymous catalog"
        />
        <Metric
          label="Data sources"
          value={`${catalogObservation.healthySourceCount}/${catalogObservation.sourceCount}`}
          detail="healthy venue feeds"
        />
        <Metric
          label="Search workers"
          value={`${studioProjection.ai.workers.filter((worker) => worker.status === "READY").length}/${studioProjection.ai.workers.length}`}
          detail="ready for new work"
        />
        <Metric label="Order execution" value="Disabled" detail="research workspace" />
      </section>

      <section className="ai-rack" aria-label="AI discovery workers">
        <div className="ai-rack-header">
          <div className="ai-rack-heading">
            <div className="ai-rack-icon">
              <Sparkles size={17} />
            </div>
            <div>
              <span className="eyebrow">Heuristic discovery</span>
              <strong>Explore the next market neighborhood</strong>
              <p>The scheduler chooses a fresh trailhead; the Agent forms claims after inspection.</p>
            </div>
          </div>
          <Button
            disabled={scoutStatus === "RUNNING"}
            onClick={() => void runScout()}
          >
            <Sparkles size={11} />
            {scoutStatus === "RUNNING"
              ? "Scouting…"
              : scoutStatus === "DONE"
                ? "Scan complete"
                : scoutStatus === "RESTORED"
                  ? "Already scanned"
                : scoutStatus === "FAILED"
                  ? "Retry scout"
                  : "Explore next"}
          </Button>
        </div>

        <div className="ai-runtime-panel">
          <div className="ai-runtime-panel-heading">
            <div>
              <span>Legacy discovery route</span>
              <strong>{studioProjection.ai.modelProvider.model}</strong>
            </div>
            <span className={cn(
              "ai-runtime-status",
              configurationStatus === "FAILED" && "is-failed",
            )}>
              {configurationStatus === "SAVING"
                ? "Saving…"
                : configurationStatus === "SAVED"
                  ? "Saved"
                  : configurationStatus === "FAILED"
                    ? configurationDiagnostic ?? "Update failed"
                    : runtimeConfiguration.storage.durable
                      ? `Saved · revision ${runtimeConfiguration.configuration.revision}`
                      : `Session · revision ${runtimeConfiguration.configuration.revision}`}
            </span>
          </div>
          <div className="ai-runtime-controls" aria-label="Legacy AI route configuration">
            <div className="ai-provider-toggle" role="group" aria-label="Legacy model access">
              {runtimeConfiguration.availableProviders.map((provider) => (
                <Button
                  key={provider}
                  size="sm"
                  variant={
                    runtimeConfiguration.configuration.provider === provider
                      ? "default"
                      : "outline"
                  }
                  disabled={configurationStatus === "SAVING"}
                  onClick={() => void updateAiRuntimeConfiguration({ provider })}
                >
                  {provider === "DEEPSEEK" ? "DeepSeek" : "Codex"}
                </Button>
              ))}
            </div>
            <label>
              <span>Codex model profile</span>
            <Select
              aria-label="Codex model"
              value={runtimeConfiguration.configuration.codexModel}
              disabled={configurationStatus === "SAVING"}
              onValueChange={(value) => void updateAiRuntimeConfiguration({
                codexModel: value as AiRuntimeConfiguration["codexModel"],
              })}
            >
              <SelectTrigger aria-label="Codex model"><SelectValue /></SelectTrigger>
              <SelectContent>
                {runtimeConfiguration.availableCodexModels.map((model) => (
                  <SelectItem key={model} value={model}>{model.replace("gpt-5.6-", "")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <span>Reasoning effort</span>
            <Select
              aria-label="Codex reasoning effort"
              value={runtimeConfiguration.configuration.codexReasoningEffort}
              disabled={configurationStatus === "SAVING"}
              onValueChange={(value) => void updateAiRuntimeConfiguration({
                codexReasoningEffort:
                  value as AiRuntimeConfiguration["codexReasoningEffort"],
              })}
            >
              <SelectTrigger aria-label="Codex reasoning effort"><SelectValue /></SelectTrigger>
              <SelectContent>
                {runtimeConfiguration.availableCodexReasoningEfforts.map((effort) => (
                  <SelectItem key={effort} value={effort}>{effort}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            </label>
            <label className="ai-automation-toggle">
              <span>Legacy schedulers</span>
              <Button
                size="sm"
                variant={runtimeConfiguration.configuration.deepseekAutomationEnabled
                  ? "outline"
                  : "ghost"}
                disabled={configurationStatus === "SAVING"}
                onClick={() => void updateAiRuntimeConfiguration({
                  deepseekAutomationEnabled:
                    !runtimeConfiguration.configuration.deepseekAutomationEnabled,
                })}
              >
                {runtimeConfiguration.configuration.deepseekAutomationEnabled
                  ? "Enabled"
                  : "Off · contained"}
              </Button>
            </label>
          </div>
          <p className="ai-runtime-description">
            {studioProjection.ai.modelProvider.maxSteps} steps ·{" "}
            {studioProjection.ai.modelProvider.maxToolCalls} tool calls ·{" "}
            {studioProjection.ai.modelProvider.timeoutMs / 1_000}s timeout ·{" "}
            {studioProjection.ai.modelProvider.transport.replaceAll("_", " ").toLowerCase()}
            {runtimeConfiguration.configuration.deepseekAutomationEnabled
              ? " · legacy DeepSeek schedulers enabled"
              : " · legacy automatic spend contained"}
            {" · Agent runtime and campaign authority are configured in Agent operations"}
          </p>
        </div>

        <div className="ai-status-grid">
          <div className="ai-status-card">
            <div><Gauge size={16} /><span>Fast search</span></div>
            <strong>{studioProjection.ai.workers.every((worker) => worker.status === "READY") ? "Ready" : "Busy"}</strong>
            <span>{studioProjection.ai.workers.map((worker) => worker.workerId).join(" · ")}</span>
          </div>
          <div className="ai-status-card">
            <div><SquareTerminal size={16} /><span>Deep investigation</span></div>
            <strong>{studioProjection.ai.investigator.configured ? "Ready" : "Needs setup"}</strong>
            <span>Pi · {studioProjection.ai.investigator.model}</span>
          </div>
          <div className="ai-status-card">
            <div><Radio size={16} /><span>Market corpus</span></div>
            <strong>{catalogObservation.listingCount} listings</strong>
            <span>{catalogObservation.healthySourceCount}/{catalogObservation.sourceCount} sources · {catalogObservation.status.toLowerCase()}</span>
          </div>
        </div>

        <div className="ai-rack-footer">
          <div>
            <ShieldCheck size={16} />
            <span>{studioProjection.ai.promotionBoundary}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={refreshStatus === "RUNNING"}
            onClick={() => void refreshCatalog()}
          >
            <RefreshCw size={13} />
            {refreshStatus === "RUNNING"
              ? "Refreshing…"
              : refreshStatus === "FAILED"
                ? "Retry refresh"
                : "Refresh catalogs"}
          </Button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Verifier output · synthetic fixture</span>
            <h2>Bounded opportunities</h2>
          </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const firstOpportunity = studioProjection.opportunities[0];
                if (firstOpportunity !== undefined) {
                  onInspect(firstOpportunity);
                }
              }}
            >
            <Play size={13} />
            Replay fixture
          </Button>
        </div>
        <div className="opportunity-list">
          {studioProjection.opportunities.map((opportunity) => (
            <OpportunityRow
              key={opportunity.id}
              opportunity={opportunity}
              onInspect={onInspect}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <PayoffFloor />
        <VerificationTrace />
        <CapitalSilhouette />
      </section>
    </>
  );
}

function confidenceLabel(confidenceBps: number): string {
  const whole = Math.floor(confidenceBps / 100);
  const fraction = String(confidenceBps % 100).padStart(2, "0");
  return `${whole}.${fraction}%`;
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function similarityLabel(scoreBps: number): string {
  return `${Math.floor(scoreBps / 100)}.${String(scoreBps % 100).padStart(2, "0")}%`;
}

function unitCostLabel(value: string, scale: string): string {
  const amount = BigInt(value);
  const units = BigInt(scale);
  const tenThousandths = (amount * 10_000n) / units;
  return `${tenThousandths / 10_000n}.${String(tenThousandths % 10_000n).padStart(4, "0")}`;
}

function edgeLabel(value: string): string {
  const bps = BigInt(value);
  return `${bps > 0n ? "+" : ""}${bps} bp`;
}

function RealCandidatePreflightView() {
  const studioProjection = useStudioProjection();
  const preflight = studioProjection.qualification.realCandidatePreflight;
  const depth = studioProjection.qualification.realCandidateDepth;
  const disposition =
    studioProjection.qualification.realCandidateDisposition;
  const rescreen = studioProjection.qualification.realCandidateRescreen;
  const watch =
    studioProjection.qualification.candidateWatch ?? EMPTY_CANDIDATE_WATCH;
  const [watchRefreshStatus, setWatchRefreshStatus] = useState<
    "IDLE" | "RUNNING" | "READY" | "DEGRADED" | "FAILED"
  >("IDLE");
  async function refreshCandidateBooks(): Promise<void> {
    setWatchRefreshStatus("RUNNING");
    try {
      setWatchRefreshStatus(await requestCandidateWatchRefresh());
    } catch {
      setWatchRefreshStatus("FAILED");
    }
  }
  if (preflight === null || preflight === undefined) {
    return (
      <section className="page-section preflight-page">
        <div className="page-heading">
          <span className="eyebrow">Immutable fixture screen</span>
          <h1>Candidate preflight</h1>
          <p>
            The real-fixture preflight is unavailable in this projection. The
            control plane must load its content-addressed evidence before this
            desk can render.
          </p>
        </div>
        <div className="preflight-empty">
          <CircleOff size={22} />
          <strong>Evidence not loaded</strong>
        </div>
      </section>
    );
  }
  const indicatedPositive = BigInt(preflight.catalogIndicativeGrossFloor) > 0n;
  const currentStages =
    rescreen?.stages ?? disposition?.stages ?? depth?.stages ?? preflight.stages;
  const currentBlockers =
    disposition?.rejectionReasons ?? depth?.blockers ?? preflight.blockers;

  return (
    <section className="page-section preflight-page">
      <div className="page-heading preflight-heading">
        <div>
          <span className="eyebrow">Real fixtures · fail-closed economics</span>
          <h1>Candidate preflight</h1>
          <p>
            One exact three-venue claim map produces a tempting catalog hint.
            Repricing the same two legs at venue-reported quotes removes the
            gross floor; replaying anonymous books at a common five-share size
            confirms zero edge before fees. A changed Polymarket book identity
            invalidated the first result; a fresh screen independently reached
            the same rejection before review or exact verification.
          </p>
        </div>
        <Badge variant="shadow">
          <CircleOff size={11} />
          {(rescreen?.classification ?? disposition?.classification ?? preflight.status).replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="metric-grid preflight-summary-grid">
        <Metric
          label="Exact claim map"
          value={`${preflight.exactVenueCount} venues`}
          detail="identical rules · binary partition"
        />
        <Metric
          label="Catalog hint"
          value={edgeLabel(preflight.catalogIndicativeGrossEdgeBps)}
          detail="gross · before fees and quantity"
        />
        <Metric
          label="Reported buy floor"
          value={edgeLabel(preflight.venueReportedBuyGrossEdgeBps)}
          detail="same two outcomes · top-level screen"
        />
        <Metric
          label="Exact verifier"
          value={preflight.verifierInvoked ? "RUN" : "NOT RUN"}
          detail="prerequisites fail closed"
        />
      </div>

      <div className="candidate-watch">
        <div className="candidate-watch-head">
          <div className="candidate-watch-mark">
            <Radio size={18} />
          </div>
          <div>
            <span>Candidate watch · anonymous public books</span>
            <strong>One refresh ID, two venues, no mixed-time screen</strong>
            <p>
              The control plane captures both raw responses, binds their hashes
              to one refresh, and recomputes only when the bound book identity
              changes. A partial refresh cannot produce a decision.
            </p>
          </div>
          <div className="candidate-watch-actions">
            <Badge
              variant={watch.status === "READY" ? "verified" : "shadow"}
            >
              {watch.status}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              disabled={
                watch.status === "REFRESHING" || watchRefreshStatus === "RUNNING"
              }
              onClick={() => void refreshCandidateBooks()}
            >
              <RefreshCw
                size={13}
                className={
                  watch.status === "REFRESHING" ||
                  watchRefreshStatus === "RUNNING"
                    ? "is-spinning"
                    : undefined
                }
              />
              {watchRefreshStatus === "FAILED" ? "Retry books" : "Refresh books"}
            </Button>
          </div>
        </div>

        <div className="candidate-watch-source-grid">
          {watch.sources.length === 0 ? (
            <div className="candidate-watch-empty">
              <Radio size={14} />
              <span>No runtime book observation has been retained yet.</span>
            </div>
          ) : (
            watch.sources.map((source) => (
              <article key={source.venueId}>
                <div>
                  <span>{source.venueId}</span>
                  <Badge
                    variant={source.status === "CURRENT" ? "verified" : "shadow"}
                  >
                    {source.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <strong>
                  {source.changedFromBound === null
                    ? "Awaiting first comparison"
                    : source.changedFromBound
                      ? "Book identity changed"
                      : "Matches bound snapshot"}
                </strong>
                <code>{source.rawHash ?? "raw hash unavailable"}</code>
                <small>
                  {source.nativeGeneration === null
                    ? "receive-time binding · no native generation"
                    : `generation ${source.nativeGeneration}`}
                </small>
                {source.diagnostic !== null && <p>{source.diagnostic}</p>}
              </article>
            ))
          )}
        </div>

        <div className="candidate-watch-decision">
          <div>
            <span>Latest complete refresh</span>
            <code>{watch.latestRefreshId ?? "none"}</code>
          </div>
          <div>
            <span>Screen disposition</span>
            <strong>
              {watch.decision === null
                ? "NO DECISION"
                : watch.decision.status.replaceAll("_", " ")}
            </strong>
          </div>
          <div>
            <span>Gross floor before fees</span>
            <strong>{watch.decision?.grossFloorBeforeFees ?? "—"}</strong>
          </div>
          <div>
            <span>Review / verifier</span>
            <strong>
              {watch.decision?.reviewRequired === true
                ? "QUALIFICATION REQUIRED"
                : "NOT INVOKED"}
            </strong>
          </div>
        </div>

        {watch.refreshHistory.length > 0 && (
          <div className="candidate-watch-history">
            <div className="candidate-watch-history-head">
              <span>Refresh journal</span>
              <small>
                Latest {Math.min(3, watch.refreshHistory.length)} of {watch.refreshHistory.length}
                {watch.refreshStorage.durable ? " · restart-safe" : " · memory-only"}
              </small>
            </div>
            <div className="candidate-watch-history-grid">
              {watch.refreshHistory.slice(0, 3).map((refresh) => {
                const successfulSources = refresh.sources.filter(
                  (source) => source.status === "SUCCESS",
                ).length;
                const failure = refresh.sources.find(
                  (source) => source.status === "FAILED",
                );
                return (
                  <article key={refresh.refreshId}>
                    <div>
                      <time dateTime={refresh.attemptedAt}>
                        {new Date(refresh.attemptedAt).toLocaleString()}
                      </time>
                      <Badge
                        variant={refresh.status === "READY" ? "verified" : "shadow"}
                      >
                        {refresh.status}
                      </Badge>
                    </div>
                    <strong>
                      {refresh.decision?.status.replaceAll("_", " ") ?? "NO DECISION"}
                    </strong>
                    <small>
                      {successfulSources}/2 sources · {refresh.refreshId.slice(-12)}
                    </small>
                    {(refresh.diagnostic ?? failure?.diagnostic) !== null &&
                      (refresh.diagnostic ?? failure?.diagnostic) !== undefined && (
                        <p>{refresh.diagnostic ?? failure?.diagnostic}</p>
                      )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <div className="candidate-watch-foot">
          <Database size={13} />
          <span>
            {watch.storage.durable && watch.refreshStorage.durable
              ? `Raw bytes and refresh journal retained in SQLite schema v${watch.storage.schemaVersion}`
              : "Runtime observations are memory-only"}
          </span>
          <code>{watch.observationSetIdentity}</code>
        </div>
      </div>

      {rescreen !== null && rescreen !== undefined && (
        <div className="preflight-rescreen">
          <div className="preflight-rescreen-head">
            <div className="preflight-rescreen-mark">
              <RefreshCw size={17} />
            </div>
            <div>
              <span>Book-change lineage · rescreen {rescreen.rescreenSequence}</span>
              <strong>Old rejection invalidated, current rejection recomputed</strong>
              <p>
                The conclusion stayed the same, but its authority did not carry
                forward. Fresh books produced a new depth identity and a new
                snapshot-scoped disposition.
              </p>
            </div>
            <Badge variant="verified">RECOMPUTED</Badge>
          </div>

          <div className="preflight-rescreen-flow">
            <article>
              <span>Previous snapshot</span>
              <strong>REJECTED · now invalid</strong>
              <code>
                {rescreen.previousSnapshot.bookSnapshotIdentity.slice(0, 22)}…
              </code>
            </article>
            <div className="preflight-rescreen-change">
              <ChevronRight size={15} />
              <span>{rescreen.changedBooks.length} book changed</span>
              <small>
                {rescreen.changedBooks.map((book) => book.venueId).join(" · ")}
              </small>
            </div>
            <article className="is-current">
              <span>Current snapshot</span>
              <strong>REJECTED · independently</strong>
              <code>
                {rescreen.currentSnapshot.bookSnapshotIdentity.slice(0, 22)}…
              </code>
            </article>
          </div>

          <div className="preflight-rescreen-proof">
            <span>
              Prior decision reused <strong>NO</strong>
            </span>
            <span>
              Economics recomputed <strong>YES</strong>
            </span>
            <code>{rescreen.artifactHash}</code>
          </div>
        </div>
      )}

      {disposition !== null && disposition !== undefined && (
        <div className="preflight-disposition">
          <div className="preflight-disposition-mark">
            <CircleOff size={19} />
          </div>
          <div className="preflight-disposition-copy">
            <span>Deterministic current-snapshot disposition</span>
            <strong>
              {rescreen === null || rescreen === undefined
                ? "Rejected before scarce review work"
                : "Fresh snapshot still fails economics"}
            </strong>
            <p>
              The quantity-bound gross floor is already non-positive. An
              official non-negative sell-taker fee cannot restore strict
              positivity, so this exact book snapshot leaves the pipeline.
            </p>
          </div>
          <div className="preflight-disposition-facts">
            <div>
              <span>Post-fee upper bound</span>
              <strong>
                {unitCostLabel(
                  disposition.postFeeFloorUpperBound,
                  disposition.quantityScale,
                )}
              </strong>
            </div>
            <div>
              <span>Sell taker range</span>
              <strong>
                {disposition.feeEvidence.minimumSellTakerFeeBps}–
                {disposition.feeEvidence.maximumSellTakerFeeBps} bp
              </strong>
            </div>
            <div>
              <span>New books</span>
              <strong>
                {disposition.rescreenRequiredOnBookChange
                  ? "RESCREEN"
                  : "TERMINAL"}
              </strong>
            </div>
          </div>
          <code>{disposition.artifactHash}</code>
        </div>
      )}

      <div className="preflight-claim-strip">
        <GitBranch size={15} />
        <div>
          <span>Canonical claim</span>
          <strong>{preflight.canonicalTitle}</strong>
        </div>
        <code>{preflight.claimIdentity}</code>
      </div>

      <div className="preflight-comparison-grid">
        <Card className="preflight-signal-card is-hint">
          <CardHeader>
            <div>
              <span className="eyebrow">Catalog indicative screen</span>
              <h2>A 55 bp search hint</h2>
            </div>
            <Badge variant={indicatedPositive ? "verified" : "shadow"}>
              SCREEN ONLY
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="preflight-total">
              <span>Complete payout cost</span>
              <strong>
                {unitCostLabel(
                  preflight.catalogIndicativeTotalCost,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <div className="preflight-floor is-positive">
              <Activity size={14} />
              <span>Gross floor</span>
              <strong>
                {unitCostLabel(
                  preflight.catalogIndicativeGrossFloor,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <p>
              Catalog prices carry no executable quantity, book generation, or
              complete fee schedule. Positive here means “inspect next,” not
              arbitrage.
            </p>
          </CardContent>
        </Card>

        <Card className="preflight-signal-card is-stopped">
          <CardHeader>
            <div>
              <span className="eyebrow">Venue-reported buy screen</span>
              <h2>The edge disappears</h2>
            </div>
            <Badge variant="shadow">STOP</Badge>
          </CardHeader>
          <CardContent>
            <div className="preflight-total">
              <span>Complete payout cost</span>
              <strong>
                {unitCostLabel(
                  preflight.venueReportedBuyTotalCost,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <div className="preflight-floor">
              <CircleOff size={14} />
              <span>Gross floor</span>
              <strong>
                {unitCostLabel(
                  preflight.venueReportedBuyGrossFloor,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <p>
              The two venue-reported buy costs consume the full unit payout.
              The quantity-bound book replay below confirms the same result.
            </p>
          </CardContent>
        </Card>
      </div>

      {depth !== null && depth !== undefined && (
        <Card className="preflight-depth-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Anonymous books · quantity-bound replay</span>
              <h2>Five shares still land at zero gross edge</h2>
            </div>
            <div className="preflight-depth-badges">
              <Badge variant="verified">QUANTITY BOUND</Badge>
              <Badge variant="shadow">NOT A CERTIFICATE</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="preflight-depth-summary">
              <div>
                <span>Screen quantity</span>
                <strong>
                  {unitCostLabel(depth.screenQuantity, depth.quantityScale)}
                </strong>
                <small>complete-payout shares</small>
              </div>
              <div>
                <span>Total before fees</span>
                <strong>
                  {unitCostLabel(depth.totalCostBeforeFees, depth.priceScale)}
                </strong>
                <small>full collateral consumed</small>
              </div>
              <div>
                <span>Depth-bound floor</span>
                <strong>
                  {edgeLabel(depth.grossEdgeBpsBeforeFees)}
                </strong>
                <small>fees can only reduce it</small>
              </div>
            </div>

            <div className="preflight-depth-route">
              <article>
                <div className="preflight-route-index">01</div>
                <div>
                  <span>Polymarket · YES</span>
                  <strong>Direct buy</strong>
                  <p>
                    Buy {unitCostLabel(depth.legs[0]?.quantity ?? "0", depth.quantityScale)}
                    {" "}shares at a marginal {unitCostLabel(depth.legs[0]?.marginalPrice ?? "0", depth.priceScale)}.
                  </p>
                </div>
                <code>
                  −{unitCostLabel(depth.legs[0]?.effectiveCost ?? "0", depth.priceScale)}
                </code>
              </article>
              <ChevronRight size={17} />
              <article>
                <div className="preflight-route-index">02</div>
                <div>
                  <span>Limitless · NO</span>
                  <strong>Complete pair → sell YES</strong>
                  <p>
                    Simulate {unitCostLabel(depth.legs[1]?.collateralIn ?? "0", depth.priceScale)}
                    {" "}collateral in, then sell YES for {unitCostLabel(depth.legs[1]?.proceeds ?? "0", depth.priceScale)}.
                  </p>
                </div>
                <code>
                  −{unitCostLabel(depth.legs[1]?.effectiveCost ?? "0", depth.priceScale)}
                </code>
              </article>
              <ChevronRight size={17} />
              <article className="is-stopped">
                <div className="preflight-route-index"><CircleOff size={11} /></div>
                <div>
                  <span>Complete payout</span>
                  <strong>Economics stop</strong>
                  <p>Gross floor is zero before the unbound dynamic taker fee.</p>
                </div>
                <code>{edgeLabel(depth.grossEdgeBpsBeforeFees)}</code>
              </article>
            </div>

            <div className="preflight-book-binding-grid">
              {depth.books.map((book) => (
                <div key={book.venueId}>
                  <BookOpenCheck size={13} />
                  <div>
                    <span>{book.venueId}</span>
                    <strong>
                      {book.venueGeneration === null
                        ? "receive-time binding only"
                        : `generation ${book.venueGeneration.slice(0, 12)}…`}
                    </strong>
                  </div>
                  <code>{book.sourceFixtureHash.slice(0, 22)}…</code>
                </div>
              ))}
            </div>

            <div className="preflight-depth-warning">
              <ShieldCheck size={14} />
              <p>
                The Limitless route is simulated only. No complete-set split,
                token approval, signature, order, or value-moving call was made.
                Its REST book also exposes no venue generation identity.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="preflight-leg-grid">
        {preflight.legs.map((leg) => (
          <article className="preflight-leg" key={`${leg.venueId}:${leg.outcome}`}>
            <div className="preflight-leg-head">
              <div>
                <Badge variant={leg.outcome === "YES" ? "verified" : "shadow"}>
                  {leg.outcome}
                </Badge>
                <span>{leg.venueId}</span>
              </div>
              <code>{leg.venueId}:{leg.listingId}</code>
            </div>
            <div className="preflight-leg-prices">
              <div>
                <span>Catalog</span>
                <strong>
                  {unitCostLabel(leg.catalogIndicativeCost, preflight.payoutScale)}
                </strong>
              </div>
              <ChevronRight size={16} />
              <div>
                <span>Reported buy</span>
                <strong>
                  {unitCostLabel(leg.venueReportedBuyCost, preflight.payoutScale)}
                </strong>
              </div>
            </div>
            <div className="preflight-leg-source">
              <Fingerprint size={11} />
              <span>{leg.venueReportedBuyKind.replaceAll("_", " ")}</span>
              <code>{leg.sourceFixtureHash.slice(0, 24)}…</code>
            </div>
          </article>
        ))}
      </div>

      <div className="preflight-detail-grid">
        <Card>
          <CardHeader>
            <div>
              <span className="eyebrow">Qualification trace</span>
              <h2>Where the candidate stops</h2>
            </div>
            <FileCheck2 size={18} className="muted-icon" />
          </CardHeader>
          <CardContent className="preflight-stage-list">
            {currentStages.map((stage, index) => (
              <div className="preflight-stage" key={stage.stage}>
                <span className={stage.status === "PASS" ? "" : "is-blocked"}>
                  {stage.status === "PASS" ? index + 1 : <CircleOff size={11} />}
                </span>
                <div>
                  <strong>{stage.stage.replaceAll("_", " ")}</strong>
                  <small>{stage.detail}</small>
                </div>
                <Badge variant={stage.status === "PASS" ? "verified" : "shadow"}>
                  {stage.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <span className="eyebrow">Fail-closed intake</span>
              <h2>
                {disposition === null || disposition === undefined
                  ? "Required before verification"
                  : "Why this snapshot is rejected"}
              </h2>
            </div>
            <CircleOff size={18} className="muted-icon" />
          </CardHeader>
          <CardContent className="preflight-blocker-list">
            {currentBlockers.map((blocker, index) => (
              <div className="preflight-blocker" key={blocker.code}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{blocker.code.replaceAll("_", " ")}</strong>
                  <p>{blocker.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="case-authority-lock preflight-authority-lock">
        <ShieldCheck size={15} />
        <span>
          The previous decision was invalidated and the current decision was
          recomputed. This still rejects only the latest bound book snapshot—not
          the market permanently—and grants no certificate or trading authority.
        </span>
        <code>
          {rescreen?.artifactHash ?? disposition?.artifactHash ?? depth?.artifactHash ?? preflight.artifactHash}
        </code>
      </div>
    </section>
  );
}

function MarketArchaeologistView() {
  const studioProjection = useStudioProjection();
  const corpus =
    studioProjection.ai.marketCorpus ?? EMPTY_MARKET_CORPUS;
  const catalogRefreshScheduler =
    studioProjection.ai.catalogRefreshScheduler ?? EMPTY_CATALOG_REFRESH_SCHEDULER;
  const desk =
    studioProjection.ai.marketArchaeologist ?? EMPTY_MARKET_ARCHAEOLOGIST;
  const scheduler =
    studioProjection.ai.searchLeaseScheduler ?? EMPTY_SEARCH_LEASE_SCHEDULER;
  const issueScheduler =
    studioProjection.ai.searchIssueScheduler ?? EMPTY_SEARCH_ISSUE_SCHEDULER;
  const attention =
    studioProjection.ai.searchAttention ?? EMPTY_SEARCH_ATTENTION;
  const issuePerformance = {
    ...EMPTY_SEARCH_ISSUE_SCHEDULER.performance,
    ...(issueScheduler.performance ?? {}),
  };
  const providerFailureCount = (category: string) =>
    issuePerformance.providerFailuresByCategory.find(
      (item) => item.category === category,
    )?.count ?? 0;
  const emptyOriginPerformance = {
    issueCount: 0,
    terminalLeaseCount: 0,
    novelCandidateCount: 0,
    proposalCount: 0,
    falsificationCount: 0,
    providerRequestAttemptCount: 0,
    providerFailureCount: 0,
    providerFailureRateBps: null,
    agentToolCallCount: 0,
    piEscalationCount: 0,
  };
  const explorationPerformance = issuePerformance.byDiscoveryMode.find(
    (item) => item.discoveryMode === "HEURISTIC_EXPLORATION",
  ) ?? emptyOriginPerformance;
  const monitoringPerformance = issuePerformance.byDiscoveryMode.find(
    (item) => item.discoveryMode === "CLAIM_MONITORING",
  ) ?? emptyOriginPerformance;
  const currentIssues = issueScheduler.issues.filter(
    (issue) =>
      issue.enabled &&
      (issue.supersededByIssueId === undefined || issue.supersededByIssueId === null),
  );
  const currentExplorationCount = currentIssues.filter(
    (issue) => issue.discoveryMode === "HEURISTIC_EXPLORATION",
  ).length;
  const currentMonitoringCount = currentIssues.length - currentExplorationCount;
  const graphReadability = (record: (typeof scheduler.records)[number]) => {
    const graphContext = record.lease.graphContext;
    if (graphContext == null) return null;
    const contextRefs = new Set(record.fastLane.semanticScope?.listingRefs ?? []);
    const allRefs = new Set(graphContext.items.flatMap((item) => item.listingRefs));
    const readableRefs = new Set(graphContext.items
      .filter((item) => item.listingRefs.every((listingRef) => contextRefs.has(listingRef)))
      .flatMap((item) => item.listingRefs));
    return Object.freeze({ readable: readableRefs.size, total: allRefs.size });
  };
  const latestTrailheadRecord = scheduler.records.find((record) =>
    record.lease.discoveryMode === "HEURISTIC_EXPLORATION" &&
    record.fastLane.retrievalPlan?.heuristicTrailhead != null
  );
  const latestTrailhead = latestTrailheadRecord?.fastLane.retrievalPlan
    ?.heuristicTrailhead ?? null;
  const latestTrailheadRefs = latestTrailhead === null
    ? []
    : latestTrailhead.kind === "ONTOLOGY_DIVERGENCE"
      ? latestTrailhead.anchorListingRefs
      : [latestTrailhead.seedListingRef, ...latestTrailhead.relatedListingRefs];
  const latestTrailheadSignals = latestTrailhead === null
    ? []
    : latestTrailhead.kind === "ONTOLOGY_DIVERGENCE"
      ? latestTrailhead.sharedSubjectSignals
      : latestTrailhead.seedSignals;
  const latestTrailheadGraph = latestTrailheadRecord === undefined
    ? null
    : graphReadability(latestTrailheadRecord);
  const findingSummary = (leaseId: string) =>
    (scheduler.findingSummaries ?? []).find((item) => item.leaseId === leaseId);
  const latestTrailheadFinding = latestTrailheadRecord === undefined
    ? undefined
    : findingSummary(latestTrailheadRecord.lease.leaseId);
  const quoteEnrichment =
    studioProjection.ai.searchQuoteEnrichment ?? EMPTY_SEARCH_QUOTE_ENRICHMENT;
  const outcomeAttribution =
    studioProjection.ai.searchOutcomeAttribution ?? EMPTY_SEARCH_OUTCOME_ATTRIBUTION;
  const outcomeEconomics =
    outcomeAttribution.economics ?? EMPTY_SEARCH_OUTCOME_ATTRIBUTION.economics;
  const graph =
    studioProjection.ai.semanticRelationGraph ?? EMPTY_SEMANTIC_RELATION_GRAPH;
  const [question, setQuestion] = useState(
    "Search the full corpus for semantically related events across venues. Prefer implication, subset, mutual-exclusion, and exhaustive structures; try to falsify every relationship.",
  );
  const [localStatus, setLocalStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [leaseStatus, setLeaseStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [leaseDiagnostic, setLeaseDiagnostic] = useState<string | null>(null);
  const [deepRetryLeaseId, setDeepRetryLeaseId] = useState<string | null>(null);
  const [issueAction, setIssueAction] = useState<string | null>(null);
  const [issueDiagnostic, setIssueDiagnostic] = useState<string | null>(null);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueQuestion, setNewIssueQuestion] = useState("");
  const [newIssueLens, setNewIssueLens] = useState<SearchIssue["lens"]>("EQUIVALENCE");
  const [newIssueCadenceMinutes, setNewIssueCadenceMinutes] = useState(15);
  const discoveryExecution = useDiscoveryExecutionCapability();
  const discoveryCapability = discoveryExecution.data?.capability;
  const discoveryRuntime = discoveryExecution.data?.runtime;
  const discoveryModel = discoveryExecution.data?.model;
  const currentLensRecords = scheduler.records.filter(
    (record) => record.lease.snapshotIdentity === corpus.snapshotIdentity,
  );
  const nextLens = scheduler.lensOrder.find(
    (lens) => !currentLensRecords.some((record) => record.lease.lens === lens),
  );

  async function run(): Promise<void> {
    setLocalStatus("RUNNING");
    setDiagnostic(null);
    try {
      const restored = await requestMarketArchaeologist(question);
      setLocalStatus(restored ? "RESTORED" : "DONE");
    } catch (error) {
      setLocalStatus("FAILED");
      setDiagnostic(
        error instanceof Error ? error.message : "Market Archaeologist run failed",
      );
    }
  }

  async function runLease(): Promise<void> {
    setLeaseStatus("RUNNING");
    setLeaseDiagnostic(null);
    try {
      const restored = await requestSearchLease();
      setLeaseStatus(restored ? "RESTORED" : "DONE");
    } catch (error) {
      setLeaseStatus("FAILED");
      setLeaseDiagnostic(
        error instanceof Error ? error.message : "search lease failed",
      );
    }
  }

  async function retryDeep(leaseId: string): Promise<void> {
    setDeepRetryLeaseId(leaseId);
    setLeaseDiagnostic(null);
    try {
      await requestSearchDeepRetry(leaseId);
    } catch (error) {
      setLeaseDiagnostic(
        error instanceof Error ? error.message : "deep retry failed",
      );
    } finally {
      setDeepRetryLeaseId(null);
    }
  }

  async function createIssue(): Promise<void> {
    setIssueAction("CREATE");
    setIssueDiagnostic(null);
    try {
      await requestCreateSearchIssue({
        title: newIssueTitle,
        question: newIssueQuestion,
        lens: newIssueLens,
        cadenceMs: newIssueCadenceMinutes * 60_000,
      });
      setNewIssueTitle("");
      setNewIssueQuestion("");
    } catch (error) {
      setIssueDiagnostic(error instanceof Error ? error.message : "search issue creation failed");
    } finally {
      setIssueAction(null);
    }
  }

  async function runIssue(issueId: string): Promise<void> {
    setIssueAction(`RUN:${issueId}`);
    setIssueDiagnostic(null);
    try {
      const restored = await requestSearchIssueRun(issueId);
      if (restored) setIssueDiagnostic("The same issue and corpus snapshot already ran; its retained lease was restored.");
    } catch (error) {
      setIssueDiagnostic(error instanceof Error ? error.message : "search issue run failed");
    } finally {
      setIssueAction(null);
    }
  }

  async function toggleIssue(issue: SearchIssue): Promise<void> {
    setIssueAction(`TOGGLE:${issue.issueId}`);
    setIssueDiagnostic(null);
    try {
      await requestSearchIssueEnabled(issue.issueId, !issue.enabled);
    } catch (error) {
      setIssueDiagnostic(error instanceof Error ? error.message : "search issue update failed");
    } finally {
      setIssueAction(null);
    }
  }

  async function acknowledgeNotification(notificationId: string): Promise<void> {
    setIssueAction(`ACK:${notificationId}`);
    setIssueDiagnostic(null);
    try {
      await requestNotificationAcknowledgement(notificationId);
    } catch (error) {
      setIssueDiagnostic(error instanceof Error ? error.message : "notification acknowledgement failed");
    } finally {
      setIssueAction(null);
    }
  }

  async function acknowledgeAttention(deliveryId: string): Promise<void> {
    setIssueAction(`ATTENTION_ACK:${deliveryId}`);
    setIssueDiagnostic(null);
    try {
      await requestAttentionAcknowledgement(deliveryId);
    } catch (error) {
      setIssueDiagnostic(error instanceof Error ? error.message : "attention acknowledgement failed");
    } finally {
      setIssueAction(null);
    }
  }

  function attentionDelivery(message: SearchAttentionMessage) {
    return attention.deliveries.find(
      (delivery) => delivery.messageId === message.messageId && delivery.channel === "IN_APP",
    );
  }

  return (
    <section className="page-section archaeology-page">
      <div className="page-heading archaeology-heading">
        <div>
          <span className="eyebrow">Heuristic discovery</span>
          <h1>Explore before deciding what matters</h1>
          <p>
            Agents start from rare signals and unusual market neighborhoods, then earn
            a claim by reading exact contracts and trying to break the idea.
          </p>
        </div>
        <div className="archaeology-heading-badges">
          <Badge variant={discoveryCapability?.dispatchEligibility === "ELIGIBLE" ? "verified" : "warning"}>
            {discoveryRuntime?.kind?.replace("HARNESS_IN_PROCESS", "In-process") ?? "Runtime"}
            {" · "}{discoveryModel?.model ?? "loading"}
            {" · "}{discoveryCapability?.serviceCapability ?? "UNVERIFIED"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={discoveryExecution.data === null || discoveryExecution.preflightBusy}
            onClick={() => void discoveryExecution.preflight()}
          >
            {discoveryExecution.preflightBusy ? <RefreshCw className="is-spinning" size={13} /> : <ShieldCheck size={13} />}
            {discoveryCapability?.observation == null ? "Preflight" : "Recheck"}
          </Button>
          <Button
            disabled={
              corpus.listingCount === 0 ||
              nextLens === undefined ||
              scheduler.status === "RUNNING" ||
              leaseStatus === "RUNNING" ||
              discoveryCapability?.dispatchEligibility !== "ELIGIBLE"
            }
            onClick={() => void runLease()}
          >
            {leaseStatus === "RUNNING" ? (
              <RefreshCw className="is-spinning" size={13} />
            ) : (
              <Sparkles size={13} />
            )}
            {leaseStatus === "RUNNING" ? "Exploring…" : "Start heuristic scan"}
          </Button>
        </div>
      </div>

      {(discoveryExecution.diagnostic !== null || discoveryCapability?.dispatchEligibility === "BLOCKED") && (
        <div className="inline-alert" role="status">
          <CircleOff size={14} />
          {discoveryExecution.diagnostic ?? `Discovery is blocked before model spend: ${discoveryCapability?.diagnostic ?? "run a capability preflight"}`}
        </div>
      )}

      <div className="radar-summary-grid archaeology-summary-grid">
        <Metric
          label="Live markets"
          value={`${corpus.listingCount}`}
          detail="public contracts in view"
        />
        <Metric
          label="Search briefs"
          value={`${issueScheduler.enabledIssueCount}`}
          detail={`${currentExplorationCount} exploratory · ${currentMonitoringCount} focused`}
        />
        <Metric
          label="Searches run"
          value={`${explorationPerformance.terminalLeaseCount + monitoringPerformance.terminalLeaseCount}`}
          detail={`${explorationPerformance.falsificationCount + monitoringPerformance.falsificationCount} hypotheses rejected`}
        />
        <Metric
          label="Proposals"
          value={`${explorationPerformance.proposalCount + monitoringPerformance.proposalCount}`}
          detail="waiting in the evidence pipeline"
        />
      </div>

      <Card className="issue-scheduler-console">
        <CardHeader>
          <div>
            <span className="eyebrow">Exploration desk</span>
            <h2>Let the search produce the question</h2>
          </div>
          <div className="issue-scheduler-badges">
            <Badge variant={issueScheduler.enabled ? "shadow" : "muted"}>
              <Clock3 size={11} /> {issueScheduler.enabled ? "Scheduler on" : "Scheduler off"}
            </Badge>
            <Badge variant={issueScheduler.unreadNotificationCount > 0 ? "warning" : "muted"}>
              <Bell size={11} /> {issueScheduler.unreadNotificationCount} unread
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="discovery-origin-overview" aria-label="Discovery origin yield">
            <article className="is-primary">
              <div>
                <Badge variant="verified">Default lane</Badge>
                <span>{currentExplorationCount} active exploration briefs</span>
              </div>
              <h3>Scan for surprises, then form a claim</h3>
              <p>Rare entities, timing conflicts, rule changes, and odd semantic neighborhoods become trailheads. The Agent decides what matters only after reading the contracts.</p>
              <dl>
                <div><dt>scans</dt><dd>{explorationPerformance.terminalLeaseCount}</dd></div>
                <div><dt>novel</dt><dd>{explorationPerformance.novelCandidateCount}</dd></div>
                <div><dt>falsified</dt><dd>{explorationPerformance.falsificationCount}</dd></div>
                <div><dt>proposals</dt><dd>{explorationPerformance.proposalCount}</dd></div>
                <div><dt>AI requests</dt><dd>{explorationPerformance.providerRequestAttemptCount}</dd></div>
                <div><dt>Pi</dt><dd>{explorationPerformance.piEscalationCount}</dd></div>
              </dl>
            </article>
          </div>
          {latestTrailheadRecord !== undefined && latestTrailhead !== null && (
            <section className="latest-discovery-trailhead" aria-label="Latest exploration trailhead">
              <div className="latest-discovery-trailhead-copy">
                <div>
                  <Badge variant="verified"><Sparkles size={11} /> LATEST TRAILHEAD</Badge>
                  <span>{latestTrailheadRecord.lease.semanticFamily?.replaceAll("_", " ")}</span>
                </div>
                <h3>{latestTrailhead.kind === "ONTOLOGY_DIVERGENCE"
                  ? "Ontology divergence"
                  : latestTrailhead.seedTitle ?? "Heuristic seed neighborhood"}</h3>
                <code>{latestTrailheadRefs.join(" + ")}</code>
                <p>
                  {latestTrailhead.kind === "ONTOLOGY_DIVERGENCE"
                    ? latestTrailhead.searchQuestion
                    : `The router started here because of rare signals, then assembled ${latestTrailhead.relatedListingRefs.length} related contracts for the Agent to inspect before forming any claim.`}
                </p>
                <div className="latest-discovery-signals">
                  {latestTrailheadSignals.map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </div>
              </div>
              <dl>
                <div><dt>contracts</dt><dd>{latestTrailheadRefs.length}</dd></div>
                <div>
                  <dt>graph refs</dt>
                  <dd>{latestTrailheadGraph === null
                    ? "—"
                    : `${latestTrailheadGraph.readable}/${latestTrailheadGraph.total}`}</dd>
                </div>
                <div><dt>Agent steps</dt><dd>{latestTrailheadRecord.fastLane.agentTelemetry?.stepCount ?? 0}</dd></div>
                <div><dt>catalog reads</dt><dd>{latestTrailheadRecord.fastLane.agentTelemetry?.catalogReadCount ?? 0}</dd></div>
                <div><dt>leads</dt><dd>{latestTrailheadFinding?.leadCount ?? 0}</dd></div>
                <div><dt>falsified</dt><dd>{latestTrailheadFinding?.falsificationCount ?? 0}</dd></div>
                <div>
                  <dt>result</dt>
                  <dd>{latestTrailheadFinding?.kinds.join(" · ") || latestTrailheadRecord.status}</dd>
                </div>
              </dl>
            </section>
          )}
          <section className="inspiration-inbox" aria-label="Cross-lens inspiration inbox">
            <div className="issue-column-heading">
              <div><Lightbulb size={14} /><strong>Cross-lens inspirations</strong></div>
              <span>
                {issueScheduler.queuedInspirationCount} queued · {issueScheduler.runningInspirationCount} running
                {issueScheduler.inspirations.length > 4 ? ` · ${issueScheduler.inspirations.length - 4} older retained` : ""}
              </span>
            </div>
            {issueScheduler.inspirations.length === 0 ? (
              <div className="inspiration-empty">
                <Sparkles size={18} />
                <div>
                  <strong>No useful detours yet</strong>
                  <p>When a heuristic scan finds a grounded relation outside its assignment, it appears here instead of being forced into a claim.</p>
                </div>
              </div>
            ) : (
              <div className="inspiration-grid">
                {issueScheduler.inspirations.slice(0, 4).map((item) => (
                  <article className="inspiration-card" key={item.inspiration.inspirationId}>
                    <div className="inspiration-card-head">
                      <Badge variant={item.status === "COMPLETE" ? "verified" : item.status === "FAILED" ? "warning" : item.status === "RUNNING" ? "shadow" : "muted"}>
                        {item.status}
                      </Badge>
                      <span className="inspiration-route">{item.inspiration.sourceLens} → {item.inspiration.suggestedLens}</span>
                    </div>
                    <div className="inspiration-card-body">
                      <div>
                        <h3>{item.inspiration.observation}</h3>
                        <p>{item.inspiration.suggestedSemanticFamily?.replaceAll("_", " ") ?? "Lens-only follow-up"}</p>
                        <div className="latest-discovery-signals">
                          {item.inspiration.searchSignals.slice(0, 4).map((signal) => <span key={signal}>{signal}</span>)}
                          {item.inspiration.searchSignals.length > 4 && <span>+{item.inspiration.searchSignals.length - 4}</span>}
                        </div>
                      </div>
                      <dl aria-label="Inspiration run facts">
                        <div><dt>requests</dt><dd>{item.providerRequestAttemptCount}</dd></div>
                        <div><dt>leads</dt><dd>{item.downstreamHypothesisCount}</dd></div>
                        <div><dt>falsified</dt><dd>{item.downstreamFalsificationCount}</dd></div>
                      </dl>
                    </div>
                    <div className="inspiration-card-footer">
                      <span>{item.inspiration.listingRefs.length} exact contracts inspected</span>
                      <span>Evidence refs retained in Agent diagnostics</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <details className="discovery-operations">
            <summary>
              <div>
                <Gauge size={15} />
                <span>
                  <strong>Search operations</strong>
                  <small>Briefs, notifications, provider health, and focused watches</small>
                </span>
              </div>
              <ChevronRight size={16} />
            </summary>
            <div className="discovery-operations-body">
              <section className="discovery-watch-summary" aria-label="Focused claim monitoring">
                <div>
                  <Badge variant="muted">Secondary lane</Badge>
                  <span>{currentMonitoringCount} saved hypotheses</span>
                </div>
                <div>
                  <h3>Focused claim monitoring</h3>
                  <p>
                    Revisit an operator question or regression case. This validates a
                    known idea; it does not drive discovery.
                  </p>
                </div>
                <dl>
                  <div><dt>scans</dt><dd>{monitoringPerformance.terminalLeaseCount}</dd></div>
                  <div><dt>novel</dt><dd>{monitoringPerformance.novelCandidateCount}</dd></div>
                  <div><dt>falsified</dt><dd>{monitoringPerformance.falsificationCount}</dd></div>
                  <div><dt>proposals</dt><dd>{monitoringPerformance.proposalCount}</dd></div>
                  <div><dt>AI requests</dt><dd>{monitoringPerformance.providerRequestAttemptCount}</dd></div>
                  <div><dt>Pi</dt><dd>{monitoringPerformance.piEscalationCount}</dd></div>
                </dl>
              </section>
              <div className="issue-scheduler-strip">
            <div><strong>{issueScheduler.inspirationCount}</strong><span>inspirations</span></div>
            <div><strong>{issueScheduler.dueIssueCount}</strong><span>due now</span></div>
            <div><strong>{issueScheduler.activeCount}/{issueScheduler.concurrencyLimit}</strong><span>active slots</span></div>
            <div>
              <strong>{issueScheduler.storage.issues.durable ? "WAL" : "RAM"}</strong>
              <span>{scheduler.missingCorpusIssuedCount} issued corpus gaps</span>
            </div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip" aria-label="Catalog refresh automation">
            <div>
              <strong>{catalogRefreshScheduler.runCount}</strong>
              <span>catalog refreshes</span>
            </div>
            <div>
              <strong>{catalogRefreshScheduler.readyCount}</strong>
              <span>all-source ready</span>
            </div>
            <div>
              <strong>{catalogRefreshScheduler.degradedCount + catalogRefreshScheduler.failedCount}</strong>
              <span>degraded or failed</span>
            </div>
            <div>
              <strong>
                {catalogRefreshScheduler.nextRefreshAt === null
                  ? "MANUAL"
                  : new Date(catalogRefreshScheduler.nextRefreshAt).toLocaleTimeString()}
              </strong>
              <span>next refresh · corpus {corpus.snapshotIdentity.slice(7, 14)}</span>
            </div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip" aria-label="Catalog coverage continuity">
            <div>
              <strong>{issuePerformance.coverageManifestCount}/{issuePerformance.terminalLeaseCount}</strong>
              <span>coverage-bound scans</span>
            </div>
            <div>
              <strong>{issuePerformance.degradedPassCount}/{issuePerformance.degradedContextCount}</strong>
              <span>completed / degraded scans</span>
            </div>
            <div>
              <strong>{issuePerformance.insufficientCoverageFailureCount}</strong>
              <span>insufficient-coverage failures</span>
            </div>
            <div>
              <strong>{issuePerformance.omittedVenueCount}</strong>
              <span>venue omission events · retained</span>
            </div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip">
            <div><strong>{issuePerformance.terminalLeaseCount}</strong><span>retained completed scans</span></div>
            <div><strong>{formatRateBps(issuePerformance.novelCandidateRateBps)}</strong><span>new candidate signatures</span></div>
            <div><strong>{formatRateBps(issuePerformance.duplicateRateBps)}</strong><span>duplicate scans</span></div>
            <div><strong>{formatRateBps(issuePerformance.piEscalationRateBps)}</strong><span>pi escalation · {issuePerformance.proposalCount} proposals · {issuePerformance.evidenceGapCount} gaps</span></div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip" aria-label="Fast and deep lane resilience">
            <div>
              <strong>{issuePerformance.preservedFastResultCount}</strong>
              <span>fast results preserved after deep failure</span>
            </div>
            <div>
              <strong>{issuePerformance.deepPendingCount}</strong>
              <span>deep pending or running</span>
            </div>
            <div>
              <strong>{issuePerformance.deepPassCount}/{issuePerformance.deepFailedCount}</strong>
              <span>deep passed / unavailable</span>
            </div>
            <div>
              <strong>{issuePerformance.deepRetryCount}/{issuePerformance.expiredRecoveryCount}</strong>
              <span>Pi retries / expired recovery records</span>
            </div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip" aria-label="AI provider reliability">
            <div>
              <strong>{issuePerformance.providerRequestAttemptCount}</strong>
              <span>provider request attempts · worker reports are not retries</span>
            </div>
            <div>
              <strong>{formatRateBps(issuePerformance.providerFailureRateBps)}</strong>
              <span>provider failures · {issuePerformance.providerFailureCount} classified</span>
            </div>
            <div>
              <strong>{providerFailureCount("TIMEOUT")}/{providerFailureCount("RETRYABLE_PROVIDER")}</strong>
              <span>timeout / retryable provider</span>
            </div>
            <div>
              <strong>{issuePerformance.providerNativeTelemetryLeaseCount}/{issuePerformance.providerLegacyDerivedLeaseCount}</strong>
              <span>native / legacy leases · {providerFailureCount("UNTYPED")} untyped</span>
            </div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip" aria-label="Discovery agent activity">
            <div>
              <strong>{issuePerformance.agentRunCount}</strong>
              <span>agent runs · {issuePerformance.agentTraceLeaseCount} traced leases</span>
            </div>
            <div>
              <strong>{issuePerformance.agentStepCount}/{issuePerformance.agentToolCallCount}</strong>
              <span>model steps / tool calls · {issuePerformance.agentCatalogReadCount} catalog reads</span>
            </div>
            <div>
              <strong>{issuePerformance.agentAcceptedProposalEffectCount}/{issuePerformance.agentRejectedProposalEffectCount}</strong>
              <span>accepted / rejected proposal effects</span>
            </div>
            <div>
              <strong>{issuePerformance.agentExplicitCompletionCount}</strong>
              <span>explicit completions · {issuePerformance.agentBudgetTerminationCount} budget · {issuePerformance.agentFailureTerminationCount} failure</span>
            </div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip" aria-label="Semantic search coverage">
            <div><strong>{issuePerformance.exactSemanticScopeCount}</strong><span>unique exact-pair scopes</span></div>
            <div><strong>{issuePerformance.boundedSemanticScopeCount}</strong><span>unique bounded neighborhoods</span></div>
            <div>
              <strong>{issuePerformance.semanticScopeRevisitCount + issuePerformance.boundedScopeRevisitCount}</strong>
              <span>scope revisits · exact + bounded</span>
            </div>
            <div>
              <strong>{issuePerformance.noLeadSemanticScopeCount + issuePerformance.noLeadBoundedScopeCount}</strong>
              <span>no-lead scopes · issue-local rotation</span>
            </div>
          </div>

          <div className="issue-scheduler-strip issue-performance-strip" aria-label="Economic-first search yield">
            <div>
              <strong>{issuePerformance.modelSelectedCandidateCount}/{issuePerformance.modelSelectionRequiredCount}</strong>
              <span>AI-selected exact pairs · {issuePerformance.modelSelectionMissCount} batches had no pair</span>
            </div>
            <div>
              <strong>{issuePerformance.quoteEnrichmentRescuedGateCount}/{issuePerformance.quoteEnrichmentAttemptCount}</strong>
              <span>missing-price gates rescued · {issuePerformance.quoteObservationCount} raw books · {quoteEnrichment.retainedObservationCount} retained</span>
            </div>
            <div><strong>{formatRateBps(issuePerformance.economicGatePositiveRateBps)}</strong><span>positive gates after AI selection</span></div>
            <div>
              <strong>{issuePerformance.piAvoidedCount}</strong>
              <span>pi calls avoided · {issuePerformance.economicGateBlockedCount} economically gated · {outcomeEconomics.positiveGrossHintCount} downstream positive</span>
            </div>
          </div>

          <section className="search-attention-console" aria-label="Search attention inbox">
            <div className="issue-column-heading">
              <div><Bell size={14} /><strong>Attention inbox</strong></div>
              <span>routine scans roll into hourly digests · candidates, deep failures, and degradation notify immediately</span>
            </div>
            <div className="search-attention-summary">
              <div><strong>{attention.unreadInAppCount}</strong><span>unread briefs</span></div>
              <div><strong>{attention.digestCount}</strong><span>hourly digests</span></div>
              <div><strong>{attention.immediateCount}</strong><span>immediate alerts</span></div>
              <div>
                <strong>{attention.channels.webhookJson.configured ? "WEBHOOK ON" : "IN-APP"}</strong>
                <span>{attention.retryWaitCount} retrying · {attention.deadLetterCount} dead letter</span>
              </div>
            </div>
            <div className="search-attention-list">
              {attention.messages.length === 0 ? (
                <div className="search-notification-empty search-attention-empty">
                  <Bell size={20} />
                  <strong>No closed digest window yet</strong>
                  <span>Concurrent issue runs stay quiet until an hourly brief or immediate alert is warranted.</span>
                </div>
              ) : attention.messages.slice(0, 8).map((message) => {
                const delivery = attentionDelivery(message);
                const acknowledged = delivery?.status === "ACKNOWLEDGED";
                return (
                  <article className={cn("search-attention-message", acknowledged && "is-read")} key={message.messageId}>
                    <div className="search-attention-message-head">
                      <div>
                        <Badge variant={message.severity === "ACTION" ? "shadow" : message.severity === "DEGRADED" ? "warning" : message.severity === "WATCH" ? "verified" : "muted"}>
                          {message.severity}
                        </Badge>
                        <Badge variant="muted">{message.kind.replaceAll("_", " ")}</Badge>
                      </div>
                      <time>{new Date(message.occurredAt).toLocaleString()}</time>
                    </div>
                    <strong>{message.title}</strong>
                    <p>{message.summary}</p>
                    <div className="search-attention-metrics">
                      <span>{message.metrics.scanCount} scans</span>
                      <span>{message.metrics.novelCandidateCount} novel</span>
                      <span>{message.metrics.proposalCount} proposals</span>
                      <span>{message.metrics.economicPositiveCount} positive gates</span>
                      <span>{message.metrics.degradedContextCount ?? 0} degraded</span>
                      <span>{message.metrics.failedCount} failed</span>
                    </div>
                    {delivery?.status === "DELIVERED" && (
                      <Button
                        variant="ghost"
                        disabled={issueAction !== null}
                        onClick={() => void acknowledgeAttention(delivery.deliveryId)}
                      >
                        <BadgeCheck size={13} /> Acknowledge brief
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="search-outcome-attribution" aria-label="Search outcome attribution">
            <div className="issue-column-heading">
              <div><Waypoints size={14} /><strong>Issue-to-opportunity funnel</strong></div>
              <span>{formatRateBps(outcomeAttribution.attributionCoverageBps)} of AI lifecycle proposals attributed · {outcomeAttribution.unattributedAiProposalCount} outside retained issue leases</span>
            </div>
            <div className="search-outcome-stages">
              {outcomeAttribution.stages.map((stage) => (
                <div key={stage.stage}>
                  <strong>{stage.count}</strong>
                  <span>{stage.stage.replaceAll("_", " ")}</span>
                </div>
              ))}
            </div>
            <div className="search-outcome-bottlenecks">
              <span><b>{formatRateBps(outcomeAttribution.reviewOutcomes.outcomeCoverageBps)}</b> review disposition coverage · {outcomeAttribution.reviewOutcomes.sourceJobCount} source jobs</span>
              {outcomeAttribution.reviewOutcomes.sourceTruncated && <span className="is-warning"><b>partial</b> review history hit the {outcomeAttribution.reviewOutcomes.sourceMaximumJobCount} job attribution bound</span>}
              <span><b>{outcomeAttribution.reviewOutcomes.passedCount}</b> review passed</span>
              <span><b>{outcomeAttribution.reviewOutcomes.reusedPassCount}</b> pass reused</span>
              <span><b>{outcomeAttribution.bottlenecks.pendingReviewCount}</b> actually pending</span>
              <span><b>{outcomeAttribution.bottlenecks.reviewFailedCount}</b> exhausted</span>
              <span><b>{outcomeAttribution.bottlenecks.reviewBlockedEvidenceCount}</b> evidence blocked</span>
              <span><b>{outcomeAttribution.bottlenecks.reviewResearchOnlyCount}</b> research only</span>
              {outcomeAttribution.bottlenecks.reviewUntrackedCount > 0 && <span className="is-warning"><b>{outcomeAttribution.bottlenecks.reviewUntrackedCount}</b> review outcome untracked</span>}
              <span><b>{outcomeAttribution.bottlenecks.pendingOperatorDecisionCount}</b> pending operator</span>
              <span><b>{outcomeAttribution.bottlenecks.materializationBlockedCount}</b> market evidence blocked</span>
              <span><b>{outcomeAttribution.bottlenecks.simulationBlockedCount}</b> simulation blocked</span>
              <span><b>{outcomeAttribution.bottlenecks.missingEvidenceCount}</b> evidence gaps in {outcomeAttribution.reviewOutcomes.detailedReportCount} retained reports · {formatRateBps(outcomeAttribution.reviewOutcomes.detailedReportCoverageBps)} detail coverage</span>
              <span><b>{outcomeAttribution.attributedFalsificationCount}</b> falsified leads retained</span>
              {outcomeAttribution.multiIssueProposalCount > 0 && <span><b>{outcomeAttribution.multiIssueProposalCount}</b> multi-issue proposals</span>}
              {outcomeAttribution.multiFamilyProposalCount > 0 && <span><b>{outcomeAttribution.multiFamilyProposalCount}</b> multi-family proposals</span>}
              {outcomeAttribution.invalidProposalReferenceCount > 0 && <span className="is-warning"><b>{outcomeAttribution.invalidProposalReferenceCount}</b> invalid proposal refs</span>}
              {outcomeAttribution.lifecycleMissingCount > 0 && <span className="is-warning"><b>{outcomeAttribution.lifecycleMissingCount}</b> lifecycle missing</span>}
            </div>
            {outcomeAttribution.byFamily.length > 0 && (
              <div className="search-outcome-stages" aria-label="Semantic family yield">
                {outcomeAttribution.byFamily.map((family) => {
                  const provider = issuePerformance.byFamily.find(
                    (item) => item.semanticFamily === family.semanticFamily,
                  );
                  return (
                    <div key={family.semanticFamily}>
                      <strong>{family.certifiedCount}/{family.proposalCount}</strong>
                      <span>
                        {family.semanticFamily.replaceAll("_", " ")} · certified/proposed · {family.falsificationCount} falsified · {family.reviewedCount} reviewed / {family.reviewExhaustedCount} exhausted / {family.reviewBlockedEvidenceCount} blocked / {family.reviewResearchOnlyCount} research · {provider?.providerRequestAttemptCount ?? 0} requests · {provider?.familyRetrievalLeaseCount ?? 0} trailheads / {provider?.familyRetrievalNeighborhoodCount ?? 0} neighborhoods / {provider?.familyRetrievalFallbackCount ?? 0} query fallbacks
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="issue-scheduler-workbench">
            <section className="search-issue-list" aria-label="Scheduled search issues">
              <div className="issue-column-heading">
                <div><GitBranch size={14} /><strong>Discovery programs</strong></div>
                <span>priority first · {issueScheduler.supersededIssueCount} retired revisions hidden</span>
              </div>
              {currentIssues.map((issue) => {
                const performance = issuePerformance.byIssue.find(
                  (item) => item.issueId === issue.issueId,
                );
                const outcome = outcomeAttribution.byIssue.find(
                  (item) => item.issueId === issue.issueId,
                );
                return (
                  <article className={cn("search-issue", !issue.enabled && "is-paused")} key={issue.issueId}>
                    <div className="search-issue-head">
                      <div>
                        <Badge variant={issue.enabled ? "verified" : "muted"}>
                          {issue.enabled ? "ACTIVE" : "PAUSED"}
                        </Badge>
                        <Badge variant="muted">P{issue.priority}</Badge>
                        <Badge variant="muted">{issue.lens}</Badge>
                        <Badge variant={issue.discoveryMode === "HEURISTIC_EXPLORATION" ? "verified" : "muted"}>
                          {issue.discoveryMode === "HEURISTIC_EXPLORATION" ? "EXPLORE" : "MONITOR"}
                        </Badge>
                        {issue.familyDefinition !== undefined && (
                          <Badge variant="shadow">{issue.familyDefinition.semanticFamily.replaceAll("_", " ")}</Badge>
                        )}
                        {issue.supersededByIssueId !== undefined && issue.supersededByIssueId !== null && (
                          <Badge variant="warning">SUPERSEDED</Badge>
                        )}
                      </div>
                      <code>{issue.issueId.slice(7, 14)}</code>
                    </div>
                    <h3>{issue.title}</h3>
                    <p>{issue.question}</p>
                    <div className="search-issue-meta">
                      {issue.candidatePolicy !== undefined && issue.candidatePolicy !== null && (
                        <span className="is-policy">
                          target {issue.candidatePolicy.allowedRelationKinds.join("/")} · {issue.candidatePolicy.exactListingRefCount === undefined
                            ? `${issue.candidatePolicy.minimumListingRefCount}-${issue.candidatePolicy.maximumListingRefCount}`
                            : `exactly ${issue.candidatePolicy.exactListingRefCount}`} refs
                          {issue.candidatePolicy.maxCorpusListings === undefined ? "" : ` · ≤${issue.candidatePolicy.maxCorpusListings} listing context`}
                          {issue.candidatePolicy.requirePositiveGrossHint === true ? " · positive gross gate" : ""}
                        </span>
                      )}
                      {issue.familyDefinition !== undefined && (
                        <span>
                          falsify: {issue.familyDefinition.falsifiers.join(" · ")} · research premises {issue.familyDefinition.acceptablePremiseKinds.join("/")}
                        </span>
                      )}
                      {issue.supersededByIssueId !== undefined && issue.supersededByIssueId !== null && (
                        <span>retired default · successor {issue.supersededByIssueId.slice(7, 14)}</span>
                      )}
                      <span>every {issue.cadenceMs / 60_000}m</span>
                      <span>next {new Date(issue.nextRunAt).toLocaleString()}</span>
                      <span>{issue.passCount}/{issue.runCount} passed</span>
                      <span>{performance?.novelCandidateCount ?? 0} new · {performance?.duplicateCount ?? 0} repeat · {performance?.piEscalationCount ?? 0} pi</span>
                      <span>{performance?.deepPendingCount ?? 0} deep pending · {performance?.deepPassCount ?? 0}/{performance?.deepFailedCount ?? 0} passed/unavailable · {performance?.deepRetryCount ?? 0} retries</span>
                      <span>{performance?.degradedPassCount ?? 0}/{performance?.degradedContextCount ?? 0} degraded scans completed · {performance?.omittedVenueCount ?? 0} omission events</span>
                      <span>
                        {performance?.exactSemanticScopeCount ?? 0} exact · {performance?.boundedSemanticScopeCount ?? 0} neighborhoods
                        {" · "}{(performance?.semanticScopeRevisitCount ?? 0) + (performance?.boundedScopeRevisitCount ?? 0)} revisits
                        {" · "}{(performance?.noLeadSemanticScopeCount ?? 0) + (performance?.noLeadBoundedScopeCount ?? 0)} no lead
                      </span>
                      {issue.candidatePolicy?.requirePositiveGrossHint === true && (
                        <span>
                          {issue.candidatePolicy.candidateSelection === "MODEL_HYPOTHESIS"
                            ? `${performance?.modelSelectedCandidateCount ?? 0}/${performance?.modelSelectionRequiredCount ?? 0} AI pairs · `
                            : ""}
                          {(performance?.quoteEnrichmentAttemptCount ?? 0) > 0
                            ? `${performance?.quoteEnrichmentRescuedGateCount ?? 0}/${performance?.quoteEnrichmentAttemptCount ?? 0} quote-rescued · `
                            : ""}
                          {performance?.economicGatePositiveCount ?? 0}/{performance?.economicGateRequiredCount ?? 0} gross-positive · {performance?.piAvoidedCount ?? 0} pi saved
                        </span>
                      )}
                      <span>{outcome?.reviewedCount ?? 0}/{outcome?.proposalCount ?? 0} reviewed · {outcome?.reviewExhaustedCount ?? 0} exhausted · {outcome?.reviewBlockedEvidenceCount ?? 0} blocked · {outcome?.reviewResearchOnlyCount ?? 0} research · {outcome?.falsificationCount ?? 0} falsified · {outcome?.operatorAcceptedCount ?? 0} accepted · {outcome?.certifiedCount ?? 0} certified</span>
                      <span>{outcome?.positiveGrossHintCount ?? 0} positive · {outcome?.nonPositiveGrossHintCount ?? 0} non-positive · {outcome?.economicUnavailableCount ?? 0} unpriceable</span>
                    </div>
                    <div className="search-issue-actions">
                      <Button
                        variant="outline"
                        disabled={
                          corpus.listingCount === 0 || issueAction !== null ||
                          (issue.supersededByIssueId !== undefined && issue.supersededByIssueId !== null)
                        }
                        onClick={() => void runIssue(issue.issueId)}
                      >
                        {issueAction === `RUN:${issue.issueId}` ? <RefreshCw className="is-spinning" size={13} /> : <Play size={13} />}
                        Run now
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={
                          issueAction !== null ||
                          (issue.supersededByIssueId !== undefined && issue.supersededByIssueId !== null)
                        }
                        onClick={() => void toggleIssue(issue)}
                      >
                        {issue.enabled ? <Pause size={13} /> : <Play size={13} />}
                        {issue.supersededByIssueId !== undefined && issue.supersededByIssueId !== null
                          ? "Retired"
                          : issue.enabled ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="search-notification-inbox" aria-label="Search notifications">
              <div className="issue-column-heading">
                <div><Inbox size={14} /><strong>Raw finding events</strong></div>
                <span>source event log · attention inbox above is the operator queue</span>
              </div>
              {issueScheduler.notifications.length === 0 ? (
                <div className="search-notification-empty">
                  <Bell size={20} />
                  <strong>Inbox is quiet</strong>
                  <span>Empty or duplicate scans do not notify; candidates and grounded falsifications do.</span>
                </div>
              ) : issueScheduler.notifications.slice(0, 12).map((notification) => (
                <article className={cn("search-notification", notification.status === "READ" && "is-read")} key={notification.notificationId}>
                  <div>
                    <Badge variant={notification.kind === "NOVEL_CANDIDATE" ? "shadow" : "warning"}>
                      {notification.kind.replaceAll("_", " ")}
                    </Badge>
                    <time>{new Date(notification.createdAt).toLocaleString()}</time>
                  </div>
                  <strong>{notification.title}</strong>
                  <p>{notification.summary}</p>
                  {notification.status === "UNREAD" && (
                    <Button
                      variant="ghost"
                      disabled={issueAction !== null}
                      onClick={() => void acknowledgeNotification(notification.notificationId)}
                    >
                      <BadgeCheck size={13} /> Acknowledge
                    </Button>
                  )}
                </article>
              ))}
            </section>
          </div>

          <form className="search-issue-form" onSubmit={(event) => { event.preventDefault(); void createIssue(); }}>
            <div>
              <span className="eyebrow"><Plus size={12} /> New claim monitor</span>
              <Input aria-label="Search issue title" placeholder="Monitor title" maxLength={120} required value={newIssueTitle} onChange={(event) => setNewIssueTitle(event.target.value)} />
              <Textarea aria-label="Search issue question" placeholder="Which known hypothesis or constraint should the Agent revisit?" maxLength={1000} required value={newIssueQuestion} onChange={(event) => setNewIssueQuestion(event.target.value)} />
            </div>
            <label>
              <span>Lens</span>
              <Select value={newIssueLens} onValueChange={(value) => setNewIssueLens(value as SearchIssue["lens"])}>
                <SelectTrigger aria-label="Lens"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {scheduler.lensOrder.map((lens) => <SelectItem key={lens} value={lens}>{lens}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label>
              <span>Cadence</span>
              <Select value={String(newIssueCadenceMinutes)} onValueChange={(value) => setNewIssueCadenceMinutes(Number(value))}>
                <SelectTrigger aria-label="Cadence"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="360">6 hours</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <Button disabled={issueAction !== null || newIssueTitle.trim() === "" || newIssueQuestion.trim() === ""} type="submit">
              {issueAction === "CREATE" ? <RefreshCw className="is-spinning" size={13} /> : <Plus size={13} />}
              Create monitor
            </Button>
          </form>
          {!issueScheduler.enabled && (
            <p className="issue-scheduler-hint">
              Automatic dispatch is installed but intentionally explicit. Set <code>PMH_SEARCH_ISSUE_TICK_MS</code> to 1000–60000 and restart the control plane; manual runs work now.
            </p>
          )}
          {issueDiagnostic !== null && (
            <div className="radar-diagnostic" role="status"><CircleOff size={14} /><span>{issueDiagnostic}</span></div>
          )}
            </div>
          </details>
        </CardContent>
      </Card>

      <details className="discovery-advanced">
        <summary>
          <div>
            <SquareTerminal size={15} />
            <span>
              <strong>Agent tools and diagnostics</strong>
              <small>Semantic memory, lease internals, manual Pi, and retained run history</small>
            </span>
          </div>
          <ChevronRight size={16} />
        </summary>
        <div className="discovery-advanced-body">
      <Card className="semantic-graph-console">
        <CardHeader>
          <div>
            <span className="eyebrow">Content-addressed memory · deterministic feedback</span>
            <h2>Search what the system has learned</h2>
          </div>
          <Badge variant="verified">NO MODEL CONFIDENCE</Badge>
        </CardHeader>
        <CardContent>
          <div className="semantic-graph-stats">
            <div><Network size={15} /><span>listings</span><strong>{graph.listingCount}</strong></div>
            <div><Waypoints size={15} /><span>relations</span><strong>{graph.relationCount}</strong></div>
            <div><ShieldCheck size={15} /><span>feedback</span><strong>{graph.feedbackCount}</strong></div>
            <div><Fingerprint size={15} /><span>graph</span><code>{graph.graphIdentity.slice(0, 19)}…</code></div>
          </div>
          <div className="semantic-feedback-strip">
            {graph.empiricalOutcomes.filter((item) => item.count > 0).length === 0 ? (
              <span>No terminal outcomes yet. New leases still bind this empty graph identity.</span>
            ) : graph.empiricalOutcomes.filter((item) => item.count > 0).map((item) => (
              <div key={item.code}>
                <Badge variant={item.code === "CERTIFIED" || item.code === "SHADOW_MATCHED" ? "verified" : "muted"}>
                  {item.count}
                </Badge>
                <span>{item.code.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
          <p>
            Each lease receives a bounded graph neighborhood alongside raw MarketFS.
            Duplicate, missing-rule, simulation, verifier, and shadow outcomes guide
            falsification order; they never become semantic approval or execution authority.
          </p>
        </CardContent>
      </Card>

      <Card className="search-lease-console">
        <CardHeader>
          <div>
            <span className="eyebrow">Scheduled semantic search · bounded spend</span>
            <h2>Issue the next AI search lease</h2>
          </div>
          <Badge variant={scheduler.enabled ? "shadow" : "muted"}>
            TIMER {scheduler.enabled ? "ON" : "OFF"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="search-lease-lenses">
            {scheduler.lensOrder.map((lens) => {
              const record = currentLensRecords.find(
                (item) => item.lease.lens === lens,
              );
              return (
                <div className={record === undefined ? "is-next" : ""} key={lens}>
                  <span>{lens}</span>
                  <Badge
                    variant={
                      record?.status === "PASS"
                        ? "verified"
                        : record?.status === "FAILED"
                          ? "warning"
                          : record?.status === "ISSUED"
                            ? "shadow"
                            : "muted"
                    }
                  >
                    {record?.status ?? (lens === nextLens ? "NEXT" : "QUEUED")}
                  </Badge>
                </div>
              );
            })}
          </div>
          <div className="search-lease-budget">
            <div><Sparkles size={14} /><span>fast checkpoint</span><strong>≤ {(scheduler.budget.fastDeadlineMs ?? scheduler.budget.deadlineMs) / 1000}s</strong></div>
            <div><SquareTerminal size={14} /><span>pi attempt</span><strong>≤ {(scheduler.budget.deepDeadlineMs ?? scheduler.budget.deadlineMs) / 1000}s · {scheduler.budget.maxDeepAttempts ?? 1} tries</strong></div>
            <div><Gauge size={14} /><span>lane health</span><strong>{scheduler.deepPendingCount} pending · {scheduler.deepFailedCount} retryable</strong></div>
            <div><Database size={14} /><span>ledger</span><strong>{scheduler.storage.durable ? "SQLite WAL" : "memory"}</strong></div>
          </div>
          <div className="search-lease-action">
            <p>
              Fast scouts inspect a bounded live context. pi receives the whole
              immutable MarketFS only for a new grounded multi-listing candidate;
              duplicate signatures are linked without another deep run.
            </p>
            <Button
              disabled={
                corpus.listingCount === 0 ||
                nextLens === undefined ||
                scheduler.status === "RUNNING" ||
                leaseStatus === "RUNNING" ||
                discoveryCapability?.dispatchEligibility !== "ELIGIBLE"
              }
              onClick={() => void runLease()}
            >
              {scheduler.status === "RUNNING" || leaseStatus === "RUNNING" ? (
                <RefreshCw className="is-spinning" size={14} />
              ) : (
                <Radar size={14} />
              )}
              {nextLens === undefined
                ? "Snapshot search complete"
                : `Run ${nextLens.toLowerCase()} lens`}
            </Button>
          </div>
          {leaseDiagnostic !== null && (
            <div className="radar-diagnostic" role="status">
              <CircleOff size={14} />
              <span>{leaseDiagnostic}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="archaeology-pipeline" aria-label="Discovery authority flow">
        <div><Database size={15} /><strong>Freeze</strong><span>public catalogs</span></div>
        <ChevronRight size={14} />
        <div><Search size={15} /><strong>Explore</strong><span>pi + MarketFS</span></div>
        <ChevronRight size={14} />
        <div><Waypoints size={15} /><strong>Propose</strong><span>typed relations</span></div>
        <ChevronRight size={14} />
        <div><ShieldCheck size={15} /><strong>Verify</strong><span>first-party exact</span></div>
      </div>

      <Card className="archaeology-console">
        <CardHeader>
          <div>
            <span className="eyebrow">Operator seed · full corpus scope</span>
            <h2>Give the agent a trailhead</h2>
          </div>
          <Badge variant={desk.scheduler.enabled ? "shadow" : "muted"}>
            MANUAL PI
          </Badge>
        </CardHeader>
        <CardContent>
          <Textarea
            aria-label="Market Archaeologist question"
            value={question}
            maxLength={1000}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <div className="archaeology-console-footer">
            <div>
              <SquareTerminal size={14} />
              <span>read · grep · find · ls</span>
              <code>{corpus.snapshotIdentity.slice(0, 23)}…</code>
            </div>
            <Button
              disabled={
                !desk.configured ||
                corpus.listingCount === 0 ||
                desk.status === "RUNNING" ||
                localStatus === "RUNNING" ||
                question.trim() === ""
              }
              onClick={() => void run()}
            >
              {desk.status === "RUNNING" || localStatus === "RUNNING" ? (
                <RefreshCw className="is-spinning" size={14} />
              ) : (
                <Sparkles size={14} />
              )}
              {desk.status === "RUNNING" || localStatus === "RUNNING"
                ? "Exploring MarketFS…"
                : localStatus === "RESTORED"
                  ? "Restore same run"
                  : localStatus === "FAILED"
                    ? "Retry exploration"
                    : "Run market archaeology"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {diagnostic !== null && (
        <div className="radar-diagnostic" role="status">
          <CircleOff size={14} />
          <span>{diagnostic}</span>
        </div>
      )}

      {scheduler.records.length > 0 && (
        <div className="search-lease-history">
          {scheduler.records.slice(0, 8).map((record) => {
            const summary = findingSummary(record.lease.leaseId);
            return (
            <article key={record.lease.leaseId}>
              <div>
                <Badge variant={record.status === "PASS" ? "verified" : record.status === "ISSUED" ? "shadow" : "warning"}>
                  {record.status}
                </Badge>
                <strong>{record.lease.lens}</strong>
                <span>{record.trigger}</span>
                {record.lease.discoveryMode != null && (
                  <Badge variant={record.lease.discoveryMode === "HEURISTIC_EXPLORATION" ? "verified" : "muted"}>
                    {record.lease.discoveryMode === "HEURISTIC_EXPLORATION" ? "EXPLORE" : "MONITOR"}
                  </Badge>
                )}
                {summary?.kinds.map((kind) => (
                  <Badge key={kind} variant={kind === "LEAD" ? "shadow" : kind === "FALSIFIED" ? "warning" : "muted"}>
                    {kind.replaceAll("_", " ")}
                  </Badge>
                ))}
              </div>
              <p>{record.lease.thesis}</p>
              <div>
                <code>{summary?.leadCount ?? record.outcome.hypothesisCount} leads</code>
                <code>{summary?.falsificationCount ?? record.outcome.falsificationCount ?? 0} falsified</code>
                <code>{summary?.inspirationCount ?? 0} inspired</code>
                {record.fastLane.candidateRelationKind != null && (
                  <code>RELATION {record.fastLane.candidateRelationKind}</code>
                )}
                <code>FAST {record.fastLane.status}</code>
                <code>DEEP {record.deepLane.status}</code>
                <code>{record.deepLane.reason}</code>
                {(record.deepLane.attempts?.length ?? 0) > 0 && (
                  <code>{record.deepLane.attempts?.length} PI attempt{record.deepLane.attempts?.length === 1 ? "" : "s"}</code>
                )}
                <code>{record.outcome.evidenceGapCount} gaps</code>
                {record.fastLane.corpusCoverage !== undefined && (
                  <code>
                    {record.fastLane.corpusCoverage.status}{" "}
                    {record.fastLane.corpusCoverage.eligibleVenueIds.length}/
                    {record.fastLane.corpusCoverage.requestedVenueIds.length}
                    {record.fastLane.corpusCoverage.omittedSources.length === 0
                      ? ""
                      : ` · ${record.fastLane.corpusCoverage.omittedSources.map((source) => source.venueId).join(", ")}`}
                  </code>
                )}
                {graphReadability(record) !== null && (
                  <code>
                    GRAPH {graphReadability(record)!.readable}/{graphReadability(record)!.total} READABLE
                  </code>
                )}
                {record.fastLane.retrievalPlan !== undefined && (
                  <code>
                    FAMILY TRAILHEAD {record.fastLane.retrievalPlan.selectedNeighborhoodRank ??
                      (record.fastLane.retrievalPlan.heuristicTrailhead != null
                        ? "SEED"
                        : record.fastLane.retrievalPlan.routingMode === "HEURISTIC_FIRST"
                          ? "NONE"
                          : "QUERY")}/
                    {record.fastLane.retrievalPlan.neighborhoodCount}
                  </code>
                )}
                {record.lineage.duplicateOfLeaseId !== null && <code>DUPLICATE LINK</code>}
                {record.deepLane.status === "FAILED" &&
                  record.deepLane.inputIdentity != null &&
                  (record.deepLane.attempts?.length ?? 0) <
                    (record.lease.budget.maxDeepAttempts ?? 1) && (
                  <Button
                    variant="ghost"
                    disabled={deepRetryLeaseId !== null}
                    onClick={() => void retryDeep(record.lease.leaseId)}
                  >
                    {deepRetryLeaseId === record.lease.leaseId
                      ? <RefreshCw className="is-spinning" size={13} />
                      : <SquareTerminal size={13} />}
                    Retry Pi only
                  </Button>
                )}
              </div>
              {record.deepLane.status === "FAILED" && record.deepLane.diagnostic !== null && (
                <p>{record.deepLane.diagnostic}</p>
              )}
              {record.fastLane.retrievalPlan !== undefined && (
                <p>
                  Search-only colocation · {record.fastLane.retrievalPlan.semanticFamily} · {record.fastLane.retrievalPlan.selectionReason}
                  {record.fastLane.retrievalPlan.sharedSignals.length === 0
                    ? ""
                    : ` · shared ${record.fastLane.retrievalPlan.sharedSignals.join(", ")}`}
                  {record.fastLane.retrievalPlan.anchorListingRefs.length === 0
                    ? ""
                    : ` · anchors ${record.fastLane.retrievalPlan.anchorListingRefs.join(" + ")}`}
                  {record.fastLane.retrievalPlan.heuristicTrailhead == null
                    ? ""
                    : record.fastLane.retrievalPlan.heuristicTrailhead.kind === "ONTOLOGY_DIVERGENCE"
                      ? ` · ontology pair ${record.fastLane.retrievalPlan.heuristicTrailhead.anchorListingRefs.join(" + ")} · facets ${record.fastLane.retrievalPlan.heuristicTrailhead.changedFacets.join(", ")} · signals ${record.fastLane.retrievalPlan.heuristicTrailhead.sharedSubjectSignals.join(", ")}`
                      : ` · seed ${record.fastLane.retrievalPlan.heuristicTrailhead.seedListingRef} · ${record.fastLane.retrievalPlan.heuristicTrailhead.relatedListingRefs.length} neighbors · signals ${record.fastLane.retrievalPlan.heuristicTrailhead.seedSignals.join(", ")}`}
                </p>
              )}
            </article>
            );
          })}
        </div>
      )}

      <div className="case-section-heading archaeology-results-heading">
        <div>
          <GitBranch size={16} />
          <div>
            <span className="eyebrow">Content-bound research trail</span>
            <h2>Recent relationships</h2>
          </div>
        </div>
        <code>{desk.runCount}/{desk.retentionLimit} retained</code>
      </div>

      {desk.records.length === 0 ? (
        <div className="radar-empty archaeology-empty">
          <Search size={28} />
          <strong>No archaeology run yet</strong>
          <span>
            The corpus is ready. Start with a broad semantic question; pi will
            choose its own searches instead of receiving a preselected pair.
          </span>
        </div>
      ) : (
        <div className="archaeology-run-list">
          {desk.records.map((record) => (
            <article className="archaeology-run" key={record.runId}>
              <div className="archaeology-run-head">
                <div>
                  <Badge
                    variant={
                      record.status === "PASS"
                        ? "verified"
                        : record.status === "RUNNING"
                          ? "shadow"
                          : "warning"
                    }
                  >
                    {record.status}
                  </Badge>
                  <span>{record.trigger}</span>
                </div>
                <code>{record.runId.slice(0, 23)}…</code>
              </div>
              <h3>{record.question}</h3>
              {record.diagnostic !== null && <p>{record.diagnostic}</p>}
              {record.report !== null && (
                <>
                  <p>{record.report.result.summary}</p>
                  <div className="archaeology-proposals">
                    {record.report.result.proposals.length === 0 ? (
                      <span>No grounded relation survived this search.</span>
                    ) : (
                      record.report.result.proposals.map((proposal) => (
                        <div key={proposal.proposalId}>
                          <Badge variant="muted">{proposal.relationKind}</Badge>
                          <strong>{proposal.statement}</strong>
                          <p>{proposal.rationale}</p>
                          <code>{proposal.listingRefs.join(" ↔ ")}</code>
                          <small>
                            {proposal.falsifiers.length} falsifier
                            {proposal.falsifiers.length === 1 ? "" : "s"} · UNREVIEWED
                          </small>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="case-authority-lock archaeology-authority-lock">
        <CircleOff size={15} />
        <span>
          Agent relationships are search proposals only. Independent semantic
          review, exact payoff compilation, fee/depth checks, and the verifier
          remain separate mandatory gates; execution is unavailable.
        </span>
      </div>
        </div>
      </details>
    </section>
  );
}

function OpportunityLifecycleView({
  focusedProposalIds,
  onClearFocus,
}: {
  focusedProposalIds: readonly string[];
  onClearFocus: () => void;
}) {
  const studioProjection = useStudioProjection();
  const desk = studioProjection.opportunityLifecycle;
  const semanticReview =
    studioProjection.ai.semanticReview ?? EMPTY_SEMANTIC_REVIEW;
  const probabilityEstimation =
    studioProjection.ai.probabilityEstimation ?? EMPTY_PROBABILITY_ESTIMATION;
  const probabilityScheduler =
    studioProjection.ai.probabilityEstimationScheduler ??
      EMPTY_PROBABILITY_ESTIMATION_SCHEDULER;
  const probabilityCalibration =
    studioProjection.ai.probabilityCalibration ?? EMPTY_PROBABILITY_CALIBRATION;
  const probabilityResolutionAcquisition =
    studioProjection.ai.probabilityResolutionAcquisition ??
      EMPTY_PROBABILITY_RESOLUTION_ACQUISITION;
  const aiUsage = studioProjection.ai.aiUsage ?? EMPTY_AI_USAGE;
  const reviewAdmission =
    studioProjection.ai.semanticReviewAdmission ?? EMPTY_SEMANTIC_REVIEW_ADMISSION;
  const reviewScheduler =
    studioProjection.ai.semanticReviewScheduler ?? EMPTY_SEMANTIC_REVIEW_SCHEDULER;
  const premiseAnalysis =
    studioProjection.ai.premiseAnalysis ?? EMPTY_PREMISE_ANALYSIS;
  const premiseScheduler =
    studioProjection.ai.premiseAnalysisScheduler ?? EMPTY_PREMISE_ANALYSIS_SCHEDULER;
  const premiseEvidenceRouting =
    studioProjection.ai.premiseEvidenceRouting ?? EMPTY_PREMISE_EVIDENCE_ROUTING;
  const premiseRouteExpansion =
    studioProjection.ai.premiseRouteExpansion ?? EMPTY_PREMISE_ROUTE_EXPANSION;
  const ruleEvidenceClaims =
    studioProjection.ai.ruleEvidenceClaims ?? EMPTY_RULE_EVIDENCE_CLAIMS;
  const currentRuleEvidenceJobs = ruleEvidenceClaims.jobs.filter((job) =>
    job.interpreterIdentity === ruleEvidenceClaims.currentInterpreterIdentity
  );
  const reviewAttention =
    studioProjection.ai.reviewAttention ?? EMPTY_REVIEW_ATTENTION;
  const economicTriage =
    studioProjection.ai.proposalEconomicTriage ?? EMPTY_PROPOSAL_ECONOMIC_TRIAGE;
  const relationPayoff =
    studioProjection.relationPayoff ?? EMPTY_RELATION_PAYOFF;
  const simulationMaterializer =
    studioProjection.simulationMaterializer ?? EMPTY_SIMULATION_MATERIALIZER;
  const semanticDecisions = desk.semanticDecisions ?? [];
  const simulationBundles = desk.simulationBundles ?? [];
  const exactVerifications = desk.exactVerifications ?? [];
  const shadowRuns = desk.shadowRuns ?? [];
  const shadowObservations = desk.shadowObservations ?? [];
  const firstPartyReviewDispositionCount = semanticReview.records.filter(
    (record) =>
      record.report?.trace?.recommendationPolicy ===
        "FIRST_PARTY_CONSERVATIVE_V1",
  ).length;
  const [reviewStates, setReviewStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "RESTORED" | "FAILED">>
  >({});
  const [decisionStates, setDecisionStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "FAILED">>
  >({});
  const [materializationStates, setMaterializationStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "FAILED">>
  >({});
  const [shadowDecisionStates, setShadowDecisionStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "FAILED">>
  >({});
  const [shadowObservationStates, setShadowObservationStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "FAILED">>
  >({});
  const [rationales, setRationales] = useState<Readonly<Record<string, string>>>(
    {},
  );
  const [diagnostics, setDiagnostics] = useState<
    Readonly<Record<string, string>>
  >({});
  const [reviewRecoveryStates, setReviewRecoveryStates] = useState<
    Readonly<Record<string, "RUNNING" | "QUEUED" | "FAILED">>
  >({});
  const [reviewNotificationAction, setReviewNotificationAction] = useState<string | null>(null);
  const [premiseNotificationAction, setPremiseNotificationAction] = useState<string | null>(null);
  const [probabilityNotificationAction, setProbabilityNotificationAction] =
    useState<string | null>(null);
  const [resolutionRunState, setResolutionRunState] = useState<
    "IDLE" | "RUNNING" | "FAILED"
  >("IDLE");
  const [lifecycleCaseLimit, setLifecycleCaseLimit] = useState(12);
  const [showGlobalReview, setShowGlobalReview] = useState(false);
  const [focusedProjection, setFocusedProjection] =
    useState<ProposalHandoffProjection | null>(null);
  const [focusedProjectionStatus, setFocusedProjectionStatus] = useState<
    "IDLE" | "LOADING" | "READY" | "FAILED"
  >(focusedProposalIds.length === 0 ? "IDLE" : "LOADING");
  const [focusedProjectionDiagnostic, setFocusedProjectionDiagnostic] =
    useState<string | null>(null);
  const focusedProposalKey = focusedProposalIds.join(",");

  useEffect(() => {
    setShowGlobalReview(false);
  }, [focusedProposalKey]);

  useEffect(() => {
    let active = true;
    if (focusedProposalIds.length === 0) {
      setFocusedProjection(null);
      setFocusedProjectionStatus("IDLE");
      setFocusedProjectionDiagnostic(null);
      return () => { active = false; };
    }
    setFocusedProjectionStatus("LOADING");
    setFocusedProjectionDiagnostic(null);
    void requestProposalHandoff(focusedProposalIds).then(
      (projection) => {
        if (!active) return;
        setFocusedProjection(projection);
        setFocusedProjectionStatus("READY");
      },
      (error) => {
        if (!active) return;
        setFocusedProjection(null);
        setFocusedProjectionStatus("FAILED");
        setFocusedProjectionDiagnostic(
          error instanceof Error ? error.message : "proposal handoff failed",
        );
      },
    );
    return () => { active = false; };
  // The global projection hash also changes for unrelated scheduler leases and
  // usage events. Depending on it caused every in-flight handoff read to be
  // discarded while background Agents were active, leaving the dossier stuck
  // in LOADING. The handoff is identity-bound to the selected proposal IDs;
  // live route/job state continues to arrive through studioProjection below.
  }, [focusedProposalKey]);
  const proposals = new Map(
    studioProjection.ai.marketArchaeologist.records.flatMap((record) =>
      (record.report?.result.proposals ?? []).map((proposal) => [
        proposal.proposalId,
        proposal,
      ] as const),
    ),
  );
  for (const job of reviewScheduler.jobs) {
    const proposal = job.evidenceBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2"
      ? job.evidenceBundle.proposal
      : undefined;
    if (proposal !== undefined && !proposals.has(proposal.proposalId)) {
      proposals.set(proposal.proposalId, proposal);
    }
  }
  const liveFocusedHandoff = focusedProposalIds.map((proposalId) => {
    const opportunityId = `ai:${proposalId}`;
    const proposal = proposals.get(proposalId as Parameters<typeof proposals.get>[0]);
    const reviewJob = reviewScheduler.jobs.find((job) => job.proposalId === proposalId);
    const canonicalReviewJob = reviewJob?.duplicateOfJobId === null ||
        reviewJob?.duplicateOfJobId === undefined
      ? undefined
      : reviewScheduler.jobs.find((job) => job.jobId === reviewJob.duplicateOfJobId);
    const retainedOutcome = reviewJob?.reviewOutcome ?? canonicalReviewJob?.reviewOutcome;
    const recoveryJob = reviewJob?.detailRecovery !== undefined
      ? reviewJob
      : canonicalReviewJob?.detailRecovery !== undefined
        ? canonicalReviewJob
        : undefined;
    const attention = reviewAttention.items.find((item) => item.proposalId === proposalId);
    const lifecycleCase = desk.cases.find((item) => item.opportunityId === opportunityId);
    const economicTriageItem = economicTriage.items.find((item) =>
      item.proposalId === proposalId
    );
    const premiseJob = premiseScheduler.jobs.filter((item) =>
      item.proposalId === proposalId
    ).at(-1);
    const premiseCapsule = premiseJob?.outcomeCapsule ?? null;
    const premiseOutcomeBasis = premiseCapsule !== null
      ? "DIRECT_ANALYSIS" as const
      : premiseJob === undefined
        ? "NOT_ANALYZED" as const
        : ["PENDING", "LEASED", "RETRY_WAIT"].includes(premiseJob.status)
          ? "ANALYSIS_PENDING" as const
          : premiseJob.status === "EXHAUSTED"
            ? "ANALYSIS_EXHAUSTED" as const
            : "LEGACY_DETAIL_UNAVAILABLE" as const;
    const outcomeBasis = reviewJob?.reviewOutcome !== undefined
      ? "DIRECT_REVIEW" as const
      : canonicalReviewJob?.reviewOutcome !== undefined
        ? "CANONICAL_SCOPE_REUSE" as const
        : recoveryJob !== undefined
          ? "RECOVERY_PENDING" as const
        : reviewJob?.status === "PASS" || reviewJob?.status === "DUPLICATE_SCOPE"
          ? "LEGACY_DETAIL_UNAVAILABLE" as const
          : "NOT_REVIEWED" as const;
    const nextGate: ProposalHandoffProjection["items"][number]["nextGate"] =
      outcomeBasis === "LEGACY_DETAIL_UNAVAILABLE"
        ? "RECOVER_REVIEW_DETAIL"
        : outcomeBasis === "RECOVERY_PENDING"
          ? "AWAIT_REVIEW_RECOVERY"
        : retainedOutcome === undefined
          ? reviewJob?.status === "BLOCKED_EVIDENCE"
            ? "RESOLVE_EVIDENCE_GAPS"
            : reviewJob?.status === "RESEARCH_ONLY" || reviewJob?.status === "EXHAUSTED"
              ? "RETAIN_AS_RESEARCH_ONLY"
              : "INDEPENDENT_SEMANTIC_REVIEW"
          : retainedOutcome.recommendation === "REJECT"
            ? "RETAIN_AS_RESEARCH_ONLY"
            : retainedOutcome.recommendation === "ESCALATE" ||
                retainedOutcome.missingEvidenceCount > 0
              ? "RESOLVE_EVIDENCE_GAPS"
              : retainedOutcome.semanticConstraint?.classification !== "HARD_SETTLEMENT_CONSTRAINT"
                ? "RETAIN_AS_RESEARCH_ONLY"
                : retainedOutcome.semanticConstraint.exactCompilerAdmission === "ELIGIBLE" &&
                    proposal !== undefined && proposal.listingRefs.length === 2 &&
                    ["EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE"]
                      .includes(proposal.relationKind)
                  ? economicTriageItem?.status === "POSITIVE_GROSS_HINT"
                    ? "FEE_DEPTH_QUALIFICATION"
                    : "OPERATOR_DECISION"
                : premiseOutcomeBasis === "NOT_ANALYZED"
                  ? "HIDDEN_PREMISE_ANALYSIS"
                  : premiseOutcomeBasis === "ANALYSIS_PENDING"
                    ? "AWAIT_PREMISE_ANALYSIS"
                    : premiseOutcomeBasis === "ANALYSIS_EXHAUSTED"
                      ? "RETRY_PREMISE_ANALYSIS"
                      : premiseOutcomeBasis === "LEGACY_DETAIL_UNAVAILABLE"
                        ? "RETAIN_AS_RESEARCH_ONLY"
                        : premiseCapsule!.exactCompilerAdmission !== "ELIGIBLE"
                          ? premiseCapsule!.unboundPremiseCount > 0 ||
                              premiseCapsule!.blocker === "BASE_CONSTRAINT_RESEARCH_ONLY" ||
                              premiseCapsule!.blocker === "PREMISE_RESEARCH_ONLY"
                            ? "BIND_PREMISE_EVIDENCE"
                            : "RETRY_PREMISE_ANALYSIS"
                          : economicTriageItem?.status === "POSITIVE_GROSS_HINT"
                            ? "FEE_DEPTH_QUALIFICATION"
                            : "OPERATOR_DECISION";
    const workflowState = attention !== undefined
      ? attention.operatorPosture
      : reviewJob !== undefined
        ? `REVIEW_${reviewJob.status}`
        : lifecycleCase !== undefined
          ? lifecycleCase.nextAction
          : proposal !== undefined
            ? "PROPOSAL_DETAIL_RETAINED"
            : "OUTSIDE_PROJECTION_WINDOW";
    return Object.freeze({
      proposalId,
      opportunityId,
      proposal,
      reviewJob,
      reviewOutcome: Object.freeze({
        basis: outcomeBasis,
        canonicalJobId: canonicalReviewJob?.jobId ?? reviewJob?.jobId ?? null,
        outcome: retainedOutcome ?? null,
        diagnostic: recoveryJob === undefined
          ? "Live bounded projection fallback; persisted dossier is loading."
          : `Review detail recovery is ${recoveryJob.status.toLowerCase().replaceAll("_", " ")}.`,
      }),
      premiseJob,
      premiseOutcome: Object.freeze({
        basis: premiseOutcomeBasis,
        outcome: premiseCapsule,
        diagnostic: premiseOutcomeBasis === "NOT_ANALYZED"
          ? "No hidden-premise analysis is retained in the bounded live projection."
          : premiseOutcomeBasis === "ANALYSIS_PENDING"
            ? `Hidden-premise analysis is ${premiseJob!.status.toLowerCase().replaceAll("_", " ")}.`
            : premiseOutcomeBasis === "ANALYSIS_EXHAUSTED"
              ? premiseJob!.diagnostic ?? "Hidden-premise analysis exhausted its bounded request budget."
              : premiseOutcomeBasis === "LEGACY_DETAIL_UNAVAILABLE"
                ? "Historical premise detail is unavailable in the bounded live projection."
                : "Premise outcome capsule comes from this proposal's retained analysis.",
      }),
      economicTriage: economicTriageItem,
      attention,
      lifecycleCase,
      nextGate,
      workflowState,
    });
  });
  const persistedFocusedHandoff = focusedProjection?.requestedProposalIds.join(",") === focusedProposalKey
    ? focusedProjection.items.map((item) => Object.freeze({
      ...item,
      opportunityId: `ai:${item.proposalId}`,
      proposal: item.proposal ?? undefined,
      reviewJob: item.reviewJob ?? undefined,
      premiseJob: item.premiseJob ?? undefined,
      economicTriage: item.economicTriage ?? undefined,
      attention: item.attention ?? undefined,
      lifecycleCase: item.lifecycleCase ?? undefined,
      workflowState: item.attention !== null
        ? item.attention.operatorPosture
        : item.reviewJob !== null
          ? `REVIEW_${item.reviewJob.status}`
          : item.lifecycleCase !== null
            ? item.lifecycleCase.nextAction
            : item.proposal !== null
              ? "PROPOSAL_DETAIL_RETAINED"
              : "OUTSIDE_PERSISTED_HANDOFF",
    }))
    : null;
  const focusedHandoff = persistedFocusedHandoff ??
    (focusedProjectionStatus === "FAILED" ? liveFocusedHandoff : []);
  const focusedHandoffLoading = focusedProposalIds.length > 0 &&
    focusedProjectionStatus === "LOADING" && persistedFocusedHandoff === null;
  const focusedDetailCount = focusedHandoff.filter((item) => item.proposal !== undefined).length;
  const focusedCaseCount = focusedHandoff.filter((item) => item.lifecycleCase !== undefined).length;
  const focusedOperatorCount = focusedHandoff.filter((item) => item.attention !== undefined).length;
  const awaiting = desk.cases.filter((item) => item.nextAction !== "NONE").length;
  const rejected = desk.cases.filter((item) =>
    item.state.startsWith("REJECTED"),
  ).length;
  const lifecycleActionPriority: Readonly<Record<string, number>> = Object.freeze({
    WAIT_FOR_HUMAN_APPROVAL: 0,
    RUN_EXACT_VERIFIER: 1,
    RUN_EXCHANGE_SIMULATION: 2,
    CALIBRATE_VENUE_MODEL: 3,
    DISPLAY_NOTIFICATION: 4,
    START_SHADOW_EXECUTION: 5,
    MONITOR_SHADOW_EXECUTION: 6,
    INDEPENDENT_SEMANTIC_REVIEW: 7,
    NONE: 8,
  });
  const orderedLifecycleCases = [...desk.cases].sort((left, right) => {
    const actionOrder = (lifecycleActionPriority[left.nextAction] ?? 99) -
      (lifecycleActionPriority[right.nextAction] ?? 99);
    if (actionOrder !== 0) return actionOrder;
    const leftAt = left.events.at(-1)?.occurredAt ?? "";
    const rightAt = right.events.at(-1)?.occurredAt ?? "";
    return rightAt.localeCompare(leftAt) ||
      left.opportunityId.localeCompare(right.opportunityId);
  });
  const visibleLifecycleCases = orderedLifecycleCases.slice(0, lifecycleCaseLimit);

  async function acknowledgeReviewNotification(notificationId: string): Promise<void> {
    setReviewNotificationAction(notificationId);
    try {
      await requestReviewNotificationAcknowledgement(notificationId);
    } finally {
      setReviewNotificationAction(null);
    }
  }

  async function acknowledgePremiseNotification(notificationId: string): Promise<void> {
    setPremiseNotificationAction(notificationId);
    try {
      await requestPremiseNotificationAcknowledgement(notificationId);
    } finally {
      setPremiseNotificationAction(null);
    }
  }

  async function acknowledgeProbabilityNotification(notificationId: string): Promise<void> {
    setProbabilityNotificationAction(notificationId);
    try {
      await requestProbabilityNotificationAcknowledgement(notificationId);
    } finally {
      setProbabilityNotificationAction(null);
    }
  }

  async function runResolutionAcquisition(): Promise<void> {
    setResolutionRunState("RUNNING");
    try {
      await requestProbabilityResolutionRun();
      setResolutionRunState("IDLE");
    } catch {
      setResolutionRunState("FAILED");
    }
  }

  async function runReview(opportunityId: string): Promise<void> {
    setReviewStates((current) => ({ ...current, [opportunityId]: "RUNNING" }));
    setDiagnostics((current) => ({ ...current, [opportunityId]: "" }));
    try {
      const restored = await requestSemanticReview(opportunityId);
      setReviewStates((current) => ({
        ...current,
        [opportunityId]: restored ? "RESTORED" : "DONE",
      }));
    } catch (error) {
      setReviewStates((current) => ({ ...current, [opportunityId]: "FAILED" }));
      setDiagnostics((current) => ({
        ...current,
        [opportunityId]:
          error instanceof Error ? error.message : "semantic review failed",
      }));
    }
  }

  async function recoverReviewDetail(proposalId: string): Promise<void> {
    setReviewRecoveryStates((current) => ({ ...current, [proposalId]: "RUNNING" }));
    setDiagnostics((current) => ({ ...current, [`ai:${proposalId}`]: "" }));
    try {
      await requestSemanticReviewDetailRecovery(proposalId);
      setReviewRecoveryStates((current) => ({ ...current, [proposalId]: "QUEUED" }));
    } catch (error) {
      setReviewRecoveryStates((current) => ({ ...current, [proposalId]: "FAILED" }));
      setDiagnostics((current) => ({
        ...current,
        [`ai:${proposalId}`]: error instanceof Error
          ? error.message
          : "semantic review detail recovery failed",
      }));
    }
  }

  async function decide(
    opportunityId: string,
    decision: "ACCEPT_FOR_SIMULATION" | "REJECT",
  ): Promise<void> {
    setDecisionStates((current) => ({
      ...current,
      [opportunityId]: "RUNNING",
    }));
    setDiagnostics((current) => ({ ...current, [opportunityId]: "" }));
    try {
      await requestResearchSemanticDecision(
        opportunityId,
        decision,
        rationales[opportunityId]?.trim() ?? "",
      );
      setDecisionStates((current) => ({
        ...current,
        [opportunityId]: "DONE",
      }));
    } catch (error) {
      setDecisionStates((current) => ({
        ...current,
        [opportunityId]: "FAILED",
      }));
      setDiagnostics((current) => ({
        ...current,
        [opportunityId]:
          error instanceof Error ? error.message : "semantic decision failed",
      }));
    }
  }

  async function materialize(
    opportunityId: string,
    portfolioId: string,
    requestedQuantity: string,
  ): Promise<void> {
    setMaterializationStates((current) => ({
      ...current,
      [portfolioId]: "RUNNING",
    }));
    setDiagnostics((current) => ({ ...current, [opportunityId]: "" }));
    try {
      await requestAnonymousMaterialization(
        opportunityId,
        portfolioId,
        requestedQuantity,
      );
      setMaterializationStates((current) => ({
        ...current,
        [portfolioId]: "DONE",
      }));
    } catch (error) {
      setMaterializationStates((current) => ({
        ...current,
        [portfolioId]: "FAILED",
      }));
      setDiagnostics((current) => ({
        ...current,
        [opportunityId]:
          error instanceof Error
            ? error.message
            : "public-book materialization failed",
      }));
    }
  }

  async function decideShadow(
    opportunityId: string,
    decision: "APPROVE_SHADOW" | "REJECT",
  ): Promise<void> {
    setShadowDecisionStates((current) => ({
      ...current,
      [opportunityId]: "RUNNING",
    }));
    setDiagnostics((current) => ({ ...current, [opportunityId]: "" }));
    try {
      await requestShadowDecision(opportunityId, decision);
      setShadowDecisionStates((current) => ({
        ...current,
        [opportunityId]: "DONE",
      }));
    } catch (error) {
      setShadowDecisionStates((current) => ({
        ...current,
        [opportunityId]: "FAILED",
      }));
      setDiagnostics((current) => ({
        ...current,
        [opportunityId]:
          error instanceof Error ? error.message : "shadow decision failed",
      }));
    }
  }

  async function observeShadow(
    opportunityId: string,
    portfolioId: string,
    requestedQuantity: string,
  ): Promise<void> {
    setShadowObservationStates((current) => ({
      ...current,
      [portfolioId]: "RUNNING",
    }));
    setDiagnostics((current) => ({ ...current, [opportunityId]: "" }));
    try {
      await requestShadowObservation(
        opportunityId,
        portfolioId,
        requestedQuantity,
      );
      setShadowObservationStates((current) => ({
        ...current,
        [portfolioId]: "DONE",
      }));
    } catch (error) {
      setShadowObservationStates((current) => ({
        ...current,
        [portfolioId]: "FAILED",
      }));
      setDiagnostics((current) => ({
        ...current,
        [opportunityId]:
          error instanceof Error ? error.message : "shadow observation failed",
      }));
    }
  }

  const usagePurposes = [...aiUsage.byPurpose].sort((left, right) => {
    const leftTokens = tokenMagnitude(left.tokens.totalTokens);
    const rightTokens = tokenMagnitude(right.tokens.totalTokens);
    return leftTokens === rightTokens
      ? left.key.localeCompare(right.key)
      : leftTokens > rightTokens ? -1 : 1;
  });
  const recentUsageHours = aiUsage.hourly.slice(-12);
  const maximumHourlyCalls = Math.max(
    1,
    ...recentUsageHours.map((bucket) => Number(bucket.invocationCount)),
  );

  return (
    <section className="page-section lifecycle-page">
      <div className="page-heading lifecycle-heading">
        <div>
          <span className="eyebrow">AI discovery · deterministic promotion</span>
          <h1>Opportunity lifecycle</h1>
          <p>
            Subjective agents discover relationships. Every promotion after that
            is artifact-bound: semantic review, venue simulation, exact
            verification, then a product route that can stop at notification or
            shadow execution.
          </p>
        </div>
        <div className="archaeology-heading-badges">
          <Badge variant={semanticReview.configured ? "verified" : "warning"}>
            REVIEWER {semanticReview.configured ? "READY" : "NEEDS KEY"}
          </Badge>
          <Badge variant="shadow">DEFAULT · HUMAN APPROVAL</Badge>
          <Badge variant={probabilityEstimation.configured ? "shadow" : "warning"}>
            ESTIMATORS {probabilityEstimation.configured
              ? probabilityScheduler.enabled ? "AUTO" : "MANUAL"
              : "NEED KEY"}
          </Badge>
          <Badge variant="warning">LIVE ROUTE ABSENT</Badge>
        </div>
      </div>

      {focusedProposalIds.length > 0 && (
        <section className="focused-review-handoff" aria-label="Focused finding review handoff">
          <div className="focused-review-handoff-heading">
            <div>
              <span className="eyebrow">Finding context retained</span>
              <h2>Review this discovery result</h2>
              <p>
                {focusedHandoffLoading
                  ? `Resolving ${focusedProposalIds.length} exact proposal IDs from the durable handoff.`
                  : `${focusedHandoff.length} exact proposal IDs · ${focusedDetailCount} proposal details · ${focusedCaseCount} lifecycle cases · ${focusedOperatorCount} operator postures resolved from the persisted handoff.`}
              </p>
            </div>
            <div className="focused-review-handoff-heading-actions">
              <Badge variant={focusedProjectionStatus === "FAILED" ? "warning" : focusedProjectionStatus === "READY" ? "verified" : "muted"}>
                {focusedProjectionStatus === "READY" ? "PERSISTED CONTEXT" : focusedProjectionStatus}
              </Badge>
              <Button variant="outline" size="sm" onClick={onClearFocus}>
                <X size={13} /> Clear focus
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGlobalReview((current) => !current)}
              >
                <LayoutDashboard size={13} />
                {showGlobalReview ? "Hide global operations" : "Browse all review operations"}
              </Button>
            </div>
          </div>
          {focusedProjectionDiagnostic !== null && (
            <div className="focused-review-handoff-diagnostic" role="status">
              <CircleOff size={14} /> {focusedProjectionDiagnostic}
            </div>
          )}
          {focusedHandoffLoading ? (
            <div className="focused-review-handoff-loading" role="status" aria-live="polite">
              <LoaderCircle size={16} />
              <div>
                <strong>Resolving persisted dossier</strong>
                <span>Review lineage, recovery state, economics, and the next deterministic gate are loading together.</span>
              </div>
            </div>
          ) : <div className="focused-review-handoff-list">
            {focusedHandoff.map((item) => {
              const reviewState = reviewStates[item.opportunityId] ?? "IDLE";
              const recoveryState = reviewRecoveryStates[item.proposalId] ?? "IDLE";
              const reviewOutcome = item.reviewOutcome.outcome;
              const premiseAuditRequired = item.proposal === undefined ||
                item.proposal.listingRefs.length !== 2 ||
                !["EQUIVALENT", "IMPLIES", "SUBSET", "MUTUALLY_EXCLUSIVE", "EXHAUSTIVE"]
                  .includes(item.proposal.relationKind);
              const reviewRecommendationPolicy = reviewOutcome === null
                ? null
                : semanticReview.records.find(
                    (record) => record.reviewId === reviewOutcome.reviewId,
                  )?.report?.trace?.recommendationPolicy ?? null;
              const indicativeEconomics = item.economicTriage?.indicativeEconomics;
              const canRunReview = item.lifecycleCase?.nextAction === "INDEPENDENT_SEMANTIC_REVIEW" &&
                item.reviewJob === undefined && item.attention === undefined;
              const evidenceGapDetailUnavailable =
                item.nextGate === "RESOLVE_EVIDENCE_GAPS" && item.attention === undefined;
              const nextGatePrefix = evidenceGapDetailUnavailable
                ? "BLOCKED"
                : ["AWAIT_REVIEW_RECOVERY", "AWAIT_PREMISE_ANALYSIS"].includes(item.nextGate)
                  ? "WAITING"
                  : "NEXT";
              const premiseRouteCandidates = premiseEvidenceRouting.jobs
                .filter((job) => job.proposal.proposalId === item.proposalId &&
                  (item.premiseOutcome.outcome === null ||
                    job.outcome.outcomeHash === item.premiseOutcome.outcome.outcomeHash))
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
              const currentRouteIdentity = premiseRouteCandidates[0]?.routerIdentity;
              const premiseRouteJob = premiseRouteCandidates
                .filter((job) => job.routerIdentity === currentRouteIdentity)
                .sort((left, right) => {
                  const priority = (status: typeof left.status): number =>
                    status === "PASS" ? 3 : status === "EXHAUSTED" ? 2 : 1;
                  if (priority(left.status) !== priority(right.status)) {
                    return priority(right.status) - priority(left.status);
                  }
                  return right.createdAt.localeCompare(left.createdAt);
                })[0];
              return (
                <article key={item.proposalId}>
                  <div className="focused-review-handoff-topline">
                    <Badge variant={item.nextGate === "OPERATOR_DECISION" || item.nextGate === "FEE_DEPTH_QUALIFICATION" ? "verified" : ["RECOVER_REVIEW_DETAIL", "RESOLVE_EVIDENCE_GAPS", "RETRY_PREMISE_ANALYSIS", "BIND_PREMISE_EVIDENCE"].includes(item.nextGate) ? "warning" : "shadow"}>
                      {nextGatePrefix} · {item.nextGate.replaceAll("_", " ")}
                    </Badge>
                    {item.proposal !== undefined && (
                      <Badge variant="muted">{item.proposal.relationKind.replaceAll("_", " ")}</Badge>
                    )}
                    <code>{item.proposalId.slice(7, 19)}</code>
                  </div>
                  {item.economicTriage !== undefined && (
                    <div className="decision-dossier-economics">
                      <div>
                        <span>Gross edge hint</span>
                        <strong>{formatFixedBps(indicativeEconomics?.grossEdgeBpsFloor ?? null)}</strong>
                      </div>
                      <div>
                        <span>Indicative cost</span>
                        <strong>{formatFixedBps(indicativeEconomics?.indicativeCostBpsCeil ?? null)}</strong>
                      </div>
                      <small>
                        {item.economicTriage.status.replaceAll("_", " ")} · fees absent · depth absent · not executable
                      </small>
                    </div>
                  )}
                  {item.proposal === undefined ? (
                    <strong>Proposal detail is unavailable from retained handoff sources</strong>
                  ) : (
                    <details className="focused-proposal-thesis">
                      <summary>
                        <strong>{item.proposal.statement}</strong>
                        <span>Show full thesis <ChevronRight size={13} /></span>
                      </summary>
                      <code>{item.proposal.listingRefs.join(" ↔ ")}</code>
                    </details>
                  )}
                  {item.reviewOutcome.basis === "LEGACY_DETAIL_UNAVAILABLE" ? (
                    <div className="decision-dossier-warning" role="status">
                      <CircleOff size={15} />
                      <div>
                        <strong>Historical review detail is unavailable</strong>
                        <span>{item.reviewOutcome.diagnostic}</span>
                        <div className="decision-dossier-warning-actions">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={recoveryState === "RUNNING" || recoveryState === "QUEUED"}
                            onClick={() => void recoverReviewDetail(item.proposalId)}
                          >
                            {recoveryState === "RUNNING"
                              ? <RefreshCw className="is-spinning" size={13} />
                              : <ShieldCheck size={13} />}
                            {recoveryState === "RUNNING"
                              ? "Queueing…"
                              : recoveryState === "QUEUED"
                                ? "Recovery queued"
                                : recoveryState === "FAILED"
                                  ? "Retry recovery"
                                  : "Recover review detail"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : item.reviewOutcome.basis === "RECOVERY_PENDING" ? (
                    <div className="decision-dossier-review is-pending" role="status">
                      <span>Semantic outcome · durable recovery</span>
                      <strong>Independent review is running in the background</strong>
                      <p>{item.reviewOutcome.diagnostic} This page may be closed safely.</p>
                    </div>
                  ) : reviewOutcome !== null ? (
                    <div className="decision-dossier-review">
                      <div className="decision-dossier-review-head">
                        <span>Semantic outcome · {item.reviewOutcome.basis === "DIRECT_REVIEW" ? "direct" : "canonical reuse"}</span>
                        <Badge variant={reviewOutcome.recommendation === "ACCEPT_FOR_RESEARCH_SIMULATION" ? "verified" : reviewOutcome.recommendation === "ESCALATE" ? "warning" : "muted"}>
                          {reviewOutcome.recommendation.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <strong>{reviewOutcome.relationConclusion.replaceAll("_", " ")}</strong>
                      <p>
                        {reviewOutcome.semanticConstraint === null
                          ? "No hard settlement constraint was retained."
                          : reviewOutcome.semanticConstraint.classification.replaceAll("_", " ")}
                        {reviewOutcome.semanticConstraint?.exactCompilerAdmission === undefined
                          ? ""
                          : ` · ${reviewOutcome.semanticConstraint.exactCompilerAdmission.toLowerCase().replaceAll("_", " ")} exact admission`}
                        {` · ${reviewOutcome.missingEvidenceCount} evidence gaps · ${reviewOutcome.counterexampleCount} counterexamples`}
                        {reviewRecommendationPolicy === null
                          ? " · legacy model workflow posture"
                          : " · relation and workflow derived by first-party policy"}
                      </p>
                    </div>
                  ) : (
                    <div className="decision-dossier-review is-pending">
                      <span>Semantic outcome</span>
                      <strong>No passing outcome capsule yet</strong>
                      <p>{item.reviewOutcome.diagnostic}</p>
                    </div>
                  )}
                  {evidenceGapDetailUnavailable && (
                    <div className="decision-dossier-warning" role="status">
                      <CircleOff size={15} />
                      <div>
                        <strong>Evidence-gap work is not actionable from this retained dossier</strong>
                        <span>
                          This capsule classifies the relation as {reviewOutcome?.semanticConstraint?.classification.toLowerCase().replaceAll("_", " ") ?? "unresolved"} with {reviewOutcome?.semanticConstraint?.exactCompilerAdmission?.toLowerCase().replaceAll("_", " ") ?? "no"} exact admission, so it is not a traded-rule evidence acquisition job. It proves that {reviewOutcome?.missingEvidenceCount ?? 0} gap{reviewOutcome?.missingEvidenceCount === 1 ? " exists" : "s exist"} and {reviewOutcome?.counterexampleCount ?? 0} counterexample{reviewOutcome?.counterexampleCount === 1 ? " was" : "s were"} retained, but it does not retain their text or an external-research route. Starting work from only these counts would fabricate scope. Recover the canonical review detail or keep this candidate as research-only until a proposal-bound requirement exists.
                        </span>
                      </div>
                    </div>
                  )}
                  {((reviewOutcome?.semanticConstraint?.classification === "HARD_SETTLEMENT_CONSTRAINT" &&
                    (reviewOutcome.semanticConstraint.exactCompilerAdmission !== "ELIGIBLE" ||
                      premiseAuditRequired)) ||
                    (item.premiseJob !== undefined && premiseAuditRequired)) && (
                    item.premiseOutcome.outcome !== null ? (
                      <div className="decision-dossier-premises">
                        <div className="decision-dossier-review-head">
                          <span>Hidden-premise audit · durable outcome</span>
                          <Badge variant={item.premiseOutcome.outcome.exactCompilerAdmission === "ELIGIBLE" ? "verified" : "warning"}>
                            {item.premiseOutcome.outcome.exactCompilerAdmission.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <strong>{item.premiseOutcome.outcome.classification.replaceAll("_", " ")}</strong>
                        <p>
                          {item.premiseOutcome.outcome.premiseCount} premises retained · {item.premiseOutcome.outcome.unboundPremiseCount} still lack exact-state binding
                          {item.premiseOutcome.outcome.blocker === null
                            ? " · deterministic replay is eligible"
                            : ` · ${item.premiseOutcome.outcome.blocker.replaceAll("_", " ")}`}
                        </p>
                        <details className="premise-obligation-list">
                          <summary>
                            <span>
                              {item.premiseOutcome.outcome.unboundPremiseCount > 0
                                ? `${item.premiseOutcome.outcome.unboundPremiseCount} premises requiring evidence`
                                : "Premise bindings"}
                            </span>
                            <ChevronRight size={13} />
                          </summary>
                          <div>
                            {item.premiseOutcome.outcome.obligations.map((obligation) => (
                              <article key={obligation.premiseId}>
                                <strong>{obligation.proposition}</strong>
                                <span>
                                  {obligation.kind.replaceAll("_", " ")} · {obligation.truthPosture.replaceAll("_", " ")} · {obligation.bindingKind.replaceAll("_", " ")}
                                </span>
                                <small>
                                  {obligation.evidenceClaimCount} evidence claims · counterexample {obligation.counterexampleResult.toLowerCase().replaceAll("_", " ")}
                                </small>
                              </article>
                            ))}
                          </div>
                        </details>
                      </div>
                    ) : item.premiseOutcome.basis === "ANALYSIS_PENDING" ? (
                      <div className="decision-dossier-review is-pending" role="status">
                        <span>Hidden-premise audit</span>
                        <strong>Premise analysis is running in the background</strong>
                        <p>{item.premiseOutcome.diagnostic} This page may be closed safely.</p>
                      </div>
                    ) : item.premiseOutcome.basis === "ANALYSIS_EXHAUSTED" ? (
                      <div className="decision-dossier-warning" role="status">
                        <CircleOff size={15} />
                        <div>
                          <strong>Hidden-premise analysis exhausted its request budget</strong>
                          <span>{item.premiseOutcome.diagnostic}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="decision-dossier-review is-pending">
                        <span>Hidden-premise audit</span>
                        <strong>{item.premiseOutcome.basis === "NOT_ANALYZED" ? "Premise analysis has not started" : "Premise detail is unavailable"}</strong>
                        <p>{item.premiseOutcome.diagnostic}</p>
                      </div>
                    )
                  )}
                  {item.premiseOutcome.outcome !== null &&
                    item.premiseOutcome.outcome.unboundPremiseCount > 0 && (
                    premiseRouteJob?.status === "PASS" && premiseRouteJob.route !== null ? (
                      <div className="decision-dossier-routing">
                        <div className="decision-dossier-review-head">
                          <span>Evidence route · Agent planned</span>
                          <Badge variant={premiseRouteJob.route.groups.some((group) =>
                            group.exactAdmissionPotential === "POTENTIAL_AFTER_REVIEW"
                          ) ? "verified" : "muted"}>
                            {premiseRouteJob.route.groups.length} ROUTES
                          </Badge>
                        </div>
                        <strong>
                          {item.premiseOutcome.outcome.unboundPremiseCount} obligation{item.premiseOutcome.outcome.unboundPremiseCount === 1 ? "" : "s"} compressed into {premiseRouteJob.route.groups.length} evidence action{premiseRouteJob.route.groups.length === 1 ? "" : "s"}
                        </strong>
                        <p>
                          {premiseRouteJob.route.groups.filter((group) => group.exactAdmissionPotential === "POTENTIAL_AFTER_REVIEW").length} may become exact after independent review · {premiseRouteJob.route.groups.filter((group) => group.disposition === "EXTERNAL_FACT_RESEARCH").length} remain probability research
                        </p>
                        <details className="premise-route-list">
                          <summary>
                            <span>Show the Agent's route plan</span>
                            <ChevronRight size={13} />
                          </summary>
                          <div>
                            {premiseRouteJob.route.groups.map((group) => {
                              const expansionJob = premiseRouteExpansion.jobs
                                .filter((job) => job.routeGroupId === group.groupId)
                                .sort((left, right) =>
                                  right.createdAt.localeCompare(left.createdAt)
                                )[0];
                              return <article key={group.groupId}>
                                <div>
                                  <Badge variant={group.exactAdmissionPotential === "POTENTIAL_AFTER_REVIEW" ? "verified" : group.disposition === "UNRESOLVED" ? "warning" : "muted"}>
                                    {group.disposition.replaceAll("_", " ")}
                                  </Badge>
                                  <span>{group.premiseIds.length} premise{group.premiseIds.length === 1 ? "" : "s"}</span>
                                </div>
                                <strong>{group.evidenceQuestion}</strong>
                                <p>{group.rationale}</p>
                                <small>NEXT · {group.nextAction.replaceAll("_", " ")}</small>
                                {group.disposition === "TRADED_STATE_CANDIDATE" && (
                                  <div className="premise-route-execution">
                                    <Badge variant={expansionJob?.status === "PASS"
                                      ? expansionJob.proposalCount > 0 ? "verified" : "muted"
                                      : expansionJob?.status === "EXHAUSTED" ? "warning" : "shadow"}>
                                      {expansionJob === undefined
                                        ? "EXPANSION BLOCKED"
                                        : `PI EXPANSION · ${expansionJob.status.replaceAll("_", " ")}`}
                                    </Badge>
                                    <span>
                                      {expansionJob === undefined
                                        ? "The exact candidate corpus is not retained."
                                        : expansionJob.status === "PASS"
                                          ? expansionJob.proposalCount === 0
                                            ? `${expansionJob.candidateListingRefs.length} candidate market${expansionJob.candidateListingRefs.length === 1 ? "" : "s"} inspected · no defensible reformulation`
                                            : `${expansionJob.proposalCount} new proposal${expansionJob.proposalCount === 1 ? "" : "s"} · next gate is independent semantic review`
                                          : `${expansionJob.candidateListingRefs.length} exact candidate market${expansionJob.candidateListingRefs.length === 1 ? "" : "s"} · attempt ${expansionJob.attemptCount}/${expansionJob.maxAttempts}`}
                                    </span>
                                  </div>
                                )}
                              </article>;
                            })}
                          </div>
                        </details>
                      </div>
                    ) : premiseRouteJob?.status === "EXHAUSTED" ? (
                      <div className="decision-dossier-warning" role="status">
                        <CircleOff size={15} />
                        <div>
                          <strong>Evidence routing exhausted its request budget</strong>
                          <span>{premiseRouteJob.diagnostic ?? "The route remains unresolved."}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="decision-dossier-review is-pending" role="status">
                        <span>Evidence route · durable Agent job</span>
                        <strong>{premiseRouteJob === undefined ? "Waiting to create an evidence route" : `Route is ${premiseRouteJob.status.toLowerCase().replaceAll("_", " ")}`}</strong>
                        <p>
                          The Agent will deduplicate derived claims, search traded market state, and prefer counterexamples before requesting external evidence.
                        </p>
                      </div>
                    )
                  )}
                  <div className="focused-review-handoff-facts">
                    {item.reviewJob !== undefined && (
                      <span>
                        review {item.reviewJob.status.replaceAll("_", " ")} · attempt {item.reviewJob.attemptCount}/{item.reviewJob.maxAttempts}
                        {item.reviewJob.duplicateOfJobId == null ? "" : ` · reuses ${item.reviewJob.duplicateOfJobId.slice(7, 19)}`}
                      </span>
                    )}
                    {item.premiseJob !== undefined && (
                      <span>premise {item.premiseJob.status.toLowerCase().replaceAll("_", " ")} · attempt {item.premiseJob.attemptCount}/{item.premiseJob.maxAttempts}</span>
                    )}
                    {item.lifecycleCase !== undefined && (
                      <span>case {item.lifecycleCase.state.replaceAll("_", " ")}</span>
                    )}
                    {item.attention !== undefined && (
                      <span>operator posture {item.attention.nextAction.replaceAll("_", " ")} · {item.attention.missingEvidenceCount} evidence gaps</span>
                    )}
                    {item.reviewOutcome.canonicalJobId !== null && item.reviewOutcome.basis === "CANONICAL_SCOPE_REUSE" && (
                      <span>canonical review {item.reviewOutcome.canonicalJobId.slice(7, 19)}</span>
                    )}
                    {item.proposal === undefined && item.lifecycleCase === undefined && item.reviewJob === undefined && item.attention === undefined && (
                      <span>The durable proposal ID is retained by the Finding; no proposal detail or workflow state is claimed when the persisted handoff cannot resolve it.</span>
                    )}
                  </div>
                  <div className="focused-review-handoff-actions">
                    {canRunReview && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewState === "RUNNING" || !semanticReview.configured}
                        onClick={() => void runReview(item.opportunityId)}
                      >
                        {reviewState === "RUNNING" ? <RefreshCw className="is-spinning" size={13} /> : <ShieldCheck size={13} />}
                        {reviewState === "RUNNING" ? "Reviewing…" : reviewState === "RESTORED" ? "Review restored" : "Run independent review"}
                      </Button>
                    )}
                    {item.attention !== undefined && (
                      <Button
                        size="sm"
                        onClick={() => document.querySelector('[aria-label="Operator review attention queue"]')?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        <Inbox size={13} /> Open operator posture
                      </Button>
                    )}
                  </div>
                  {diagnostics[item.opportunityId] && <small className="is-warning">{diagnostics[item.opportunityId]}</small>}
                </article>
              );
            })}
          </div>}
          <div className="attention-authority-lock">
            <CircleOff size={14} />
            <span>Focus changes navigation only. Semantic review, operator decisions, simulation, certificates, and execution retain their existing independent gates.</span>
          </div>
        </section>
      )}

      {(focusedProposalIds.length === 0 || showGlobalReview) && (
      <div className="global-review-operations">
      <div className="radar-summary-grid lifecycle-summary-grid">
        <Metric label="Tracked cases" value={`${desk.caseCount}`} detail="AI + deterministic leads" />
        <Metric label="Awaiting work" value={`${awaiting}`} detail="explicit next action" />
        <Metric label="Rejected early" value={`${rejected}`} detail="no review budget wasted" />
        <Metric
          label="Review journal"
          value={`${semanticReview.passCount}/${semanticDecisions.length}`}
          detail={`${semanticReview.storage.durable ? "SQLite" : "memory"} · advisory / decided`}
        />
        <Metric
          label="Probability agents"
          value={`${probabilityScheduler.freshBoundCount}/${probabilityScheduler.caseCount}`}
          detail={`fresh bounds / cases · ${probabilityScheduler.storage.jobs.durable ? "SQLite" : "memory"}`}
        />
        <Metric
          label="Resolved calibration"
          value={`${probabilityCalibration.observationCount}/${probabilityCalibration.registeredBoundCount}`}
          detail={`${probabilityCalibration.measuredGroupCount} measured cohorts · ${probabilityCalibration.storage.observations.durable ? "SQLite" : "memory"}`}
        />
        <Metric
          label="Settlement capture"
          value={`${probabilityResolutionAcquisition.resolvedListingCount}/${probabilityResolutionAcquisition.pendingListingCount}`}
          detail={`${probabilityResolutionAcquisition.timeUnavailableListingCount} payout-only · ${probabilityResolutionAcquisition.storage.sources.durable ? "raw SQLite" : "memory"}`}
        />
        <Metric
          label="Public evidence"
          value={`${simulationMaterializer.retainedRawSourceCount}`}
          detail={`${simulationMaterializer.storage.durable ? "SQLite WAL" : "memory"} · content addressed`}
        />
      </div>

      <section className="attention-queue" aria-label="Probability estimation agents">
        <div className="attention-queue-heading">
          <div>
            <Gauge size={15} />
            <div>
              <strong>Probability estimation agents</strong>
              <span>Role-separated intervals · counter-scenario first · abstention is valid</span>
            </div>
          </div>
          <Badge variant={probabilityScheduler.unreadNotificationCount > 0 ? "warning" : "shadow"}>
            {probabilityScheduler.unreadNotificationCount > 0
              ? `${probabilityScheduler.unreadNotificationCount} UNREAD`
              : "ESTIMATE ONLY"}
          </Badge>
        </div>
        <div className="attention-queue-stats">
          <div><strong>{probabilityScheduler.activeCount}</strong><span>active roles</span></div>
          <div><strong>{probabilityScheduler.dueCount}</strong><span>due</span></div>
          <div><strong>{probabilityScheduler.passedCount}</strong><span>intervals</span></div>
          <div><strong>{probabilityScheduler.boundReadyCount}</strong><span>bounds ready</span></div>
          <div><strong>{probabilityScheduler.abstainedCount}</strong><span>abstained</span></div>
          <div><strong>{probabilityScheduler.challengedCount}</strong><span>semantic challenges</span></div>
          <div><strong>{probabilityScheduler.blockedEvidenceCount}</strong><span>evidence blocked</span></div>
        </div>
        <div className="attention-item-list">
          {probabilityScheduler.notifications.filter((item) => item.status === "UNREAD")
            .slice(0, 4).map((notification) => (
              <article key={notification.notificationId}>
                <div className="attention-item-topline">
                  <Badge variant={notification.kind === "BOUND_READY" ? "verified" : "warning"}>
                    {notification.kind.replaceAll("_", " ")}
                  </Badge>
                  <time>{new Date(notification.createdAt).toLocaleString()}</time>
                </div>
                <strong>{notification.title}</strong>
                <p>{notification.summary}</p>
                <Button
                  variant="ghost"
                  disabled={probabilityNotificationAction === notification.notificationId}
                  onClick={() => void acknowledgeProbabilityNotification(notification.notificationId)}
                >
                  {probabilityNotificationAction === notification.notificationId
                    ? "Acknowledging…"
                    : "Acknowledge"}
                </Button>
              </article>
            ))}
          {probabilityScheduler.bounds.slice(0, 4).map((bound) => (
            <article key={bound.artifactHash}>
              <div className="attention-item-topline">
                <Badge variant={Date.parse(bound.expiresAt) > Date.now() ? "shadow" : "muted"}>
                  {Date.parse(bound.expiresAt) > Date.now() ? "BOUND FRESH" : "BOUND STALE"}
                </Badge>
                <Badge variant="muted">{bound.estimates.length} ROLES</Badge>
              </div>
              <strong>Adverse states {bound.adverseStateIds.join(" + ")} ≤ {bound.epsilonPpm} ppm</strong>
              <p>Conservative envelope {bound.lowerPpm}–{bound.epsilonPpm} ppm; expires {new Date(bound.expiresAt).toLocaleString()}.</p>
              {bound.searchOrigin !== undefined && (
                <div className="attention-item-facts">
                  <span>{bound.searchOrigin.semanticFamilies.map((family) => family.replaceAll("_", " ")).join(" + ")}</span>
                  <span>{bound.searchOrigin.issueIds.length} durable issue{bound.searchOrigin.issueIds.length === 1 ? "" : "s"}</span>
                  <span>origin {bound.searchOrigin.originIdentity.slice(7, 19)}</span>
                </div>
              )}
              <small>Uncalibrated estimate · price/risk compiler required · not guaranteed profit</small>
            </article>
          ))}
          {probabilityEstimation.records.length === 0 && probabilityScheduler.bounds.length === 0 &&
          probabilityScheduler.notifications.length === 0 ? (
            <div className="review-operation-empty">
              <strong>No probability estimates retained yet</strong>
              <span>Probabilistic semantic reviews enter independent reference-class, causal, and skeptical roles here.</span>
            </div>
          ) : probabilityEstimation.records.slice(0, 6).map((record) => (
            <article key={record.runId}>
              <div className="attention-item-topline">
                <Badge variant={record.status === "PASS" ? "shadow" : record.status === "ABSTAINED" ? "muted" : "warning"}>
                  {record.status}
                </Badge>
                <Badge variant="muted">{record.role.replaceAll("_", " ")}</Badge>
              </div>
              <strong>
                {record.estimate === null
                  ? "No numeric bound submitted"
                  : `${record.estimate.lowerPpm}–${record.estimate.upperPpm} ppm adverse-state probability`}
              </strong>
              <p>{record.rationale ?? record.diagnostic ?? "Agent run is in progress."}</p>
              <div className="attention-item-facts">
                <span>{record.counterScenarios.length} counter-scenario{record.counterScenarios.length === 1 ? "" : "s"}</span>
                <span>{record.trace?.providerRequestAttemptCount ?? 0} requests</span>
                <span>{record.adverseStateIds.join(" + ")} adverse state{record.adverseStateIds.length === 1 ? "" : "s"}</span>
              </div>
              <small>Not confidence · not guaranteed profit · no certificate or execution authority</small>
            </article>
          ))}
        </div>
      </section>

      <section className="attention-queue" aria-label="Resolved-outcome probability calibration">
        <div className="attention-queue-heading">
          <div>
            <Activity size={15} />
            <div>
              <strong>Resolved-outcome calibration</strong>
              <span>Source-hashed settlements · immutable historical bounds · no post-hoc forecasts</span>
            </div>
          </div>
          <Badge variant={probabilityCalibration.status === "MEASURED" ? "verified" : probabilityCalibration.status === "COLLECTING" ? "shadow" : "muted"}>
            {probabilityCalibration.status}
          </Badge>
        </div>
        <div className="attention-queue-stats">
          <div><strong>{probabilityCalibration.observationCount}</strong><span>resolved bounds</span></div>
          <div><strong>{probabilityCalibration.attributedObservationCount}</strong><span>origin-linked</span></div>
          <div><strong>{probabilityCalibration.adverseObservationCount}</strong><span>adverse outcomes</span></div>
          <div><strong>{probabilityCalibration.pendingResolutionBoundCount}</strong><span>registered pending</span></div>
          <div><strong>{probabilityCalibration.measuredGroupCount}</strong><span>measured cohorts</span></div>
          <div><strong>{probabilityCalibration.insufficientGroupCount}</strong><span>collecting cohorts</span></div>
          <div><strong>{probabilityCalibration.attributedGroupCount}</strong><span>family cohorts</span></div>
        </div>
        <div className="attention-item-list">
          <article className="resolution-acquisition-card">
            <div className="attention-item-topline">
              <Badge variant={probabilityResolutionAcquisition.conflictListingCount > 0 || probabilityResolutionAcquisition.httpErrorListingCount > 0 ? "warning" : probabilityResolutionAcquisition.resolvedListingCount > 0 ? "verified" : "shadow"}>
                ANONYMOUS CAPTURE · {probabilityResolutionAcquisition.status}
              </Badge>
              <Button
                variant="ghost"
                disabled={resolutionRunState === "RUNNING" || probabilityResolutionAcquisition.status === "POLLING"}
                onClick={() => void runResolutionAcquisition()}
              >
                {resolutionRunState === "RUNNING" || probabilityResolutionAcquisition.status === "POLLING"
                  ? "Polling…"
                  : resolutionRunState === "FAILED" ? "Retry poll" : "Poll official results"}
              </Button>
            </div>
            <strong>{probabilityResolutionAcquisition.resolvedListingCount} timed payouts · {probabilityResolutionAcquisition.timeUnavailableListingCount} payout-only</strong>
            <p>
              Global requires a resolved 1/0 vector plus venue-reported close time. US exact 0/1 settlement is retained, but remains calibration-blocked because the anonymous endpoint does not report when resolution occurred.
            </p>
            <div className="attention-item-facts">
              <span>{probabilityResolutionAcquisition.pendingListingCount} pending listings</span>
              <span>{probabilityResolutionAcquisition.unresolvedListingCount} not resolved</span>
              <span>{probabilityResolutionAcquisition.conflictListingCount} conflicts</span>
              <span>{probabilityResolutionAcquisition.failedRequestCount} request failures</span>
            </div>
            <small>Raw bytes content-addressed · deterministic venue adapters · 5-minute default cadence · no model calls</small>
          </article>
          {probabilityResolutionAcquisition.captures.slice(0, 6).map((capture) => (
            <article key={capture.artifactHash}>
              <div className="attention-item-topline">
                <Badge variant={capture.status === "RESOLVED" ? "verified" : capture.status === "RESOLUTION_TIME_UNAVAILABLE" || capture.status === "UNRESOLVED" ? "shadow" : "warning"}>
                  {capture.status.replaceAll("_", " ")}
                </Badge>
                <time>{new Date(capture.fetchedAt).toLocaleString()}</time>
              </div>
              <strong>{capture.listingRef}</strong>
              <p>{capture.diagnostic ?? (capture.truthValue === null ? "No terminal payout in this response." : `Truth value ${capture.truthValue ? "YES" : "NO"}.`)}</p>
              <small>{capture.protocolIdentity} · raw {capture.sourceRawHash.slice(0, 23)}… · {capture.byteLength} bytes</small>
            </article>
          ))}
          {probabilityCalibration.groups.length === 0 ? (
            <div className="review-operation-empty">
              <strong>No resolved probability outcomes retained yet</strong>
              <span>When an official venue result is captured with its raw content hash, the bound is scored here. A market disappearing or showing a status label is not treated as settlement evidence.</span>
            </div>
          ) : probabilityCalibration.groups.slice(0, 6).map((group) => (
            <article key={group.groupId}>
              <div className="attention-item-topline">
                <Badge variant={group.status === "WITHIN_INTERVAL" ? "verified" : group.status === "INSUFFICIENT_SAMPLE" ? "muted" : "warning"}>
                  {group.status.replaceAll("_", " ")}
                </Badge>
                <Badge variant="muted">{group.horizonBucket.replaceAll("_", " ")}</Badge>
                <Badge variant={group.semanticFamily == null ? "muted" : "shadow"}>
                  {group.semanticFamily?.replaceAll("_", " ") ?? "UNATTRIBUTED"}
                </Badge>
              </div>
              <strong>{group.estimator} · {group.method.replaceAll("_", " ")}</strong>
              <p>Observed adverse rate {group.empiricalRatePpm} ppm versus mean interval {group.meanLowerPpm}–{group.meanUpperPpm} ppm.</p>
              <div className="attention-item-facts">
                <span>{group.sampleCount} samples</span>
                <span>{group.adverseCount} adverse</span>
                <span>Brier {group.meanMidpointBrierPpm} ppm</span>
                <span>bucket {group.upperBucketStartPpm}–{group.upperBucketEndPpm}</span>
              </div>
              <small>{group.relationKind.replaceAll("_", " ")} · minimum sample {probabilityCalibration.minimumSampleSize} · evidence only</small>
            </article>
          ))}
          {probabilityCalibration.observations.slice(0, 4).map((observation) => (
            <article key={observation.artifactHash}>
              <div className="attention-item-topline">
                <Badge variant={observation.adverseOccurred ? "warning" : "shadow"}>
                  {observation.adverseOccurred ? "ADVERSE" : "ORDINARY"}
                </Badge>
                <time>{new Date(observation.resolvedAt).toLocaleString()}</time>
              </div>
              <strong>{observation.observedStateId} · {observation.relationKind.replaceAll("_", " ")}</strong>
              <p>{observation.listingRefs.join(" ↔ ")}</p>
              {observation.semanticFamilies.length > 0 && (
                <div className="attention-item-facts">
                  <span>{observation.semanticFamilies.map((family) => family.replaceAll("_", " ")).join(" + ")}</span>
                  <span>{observation.issueIds.length} source issue{observation.issueIds.length === 1 ? "" : "s"}</span>
                </div>
              )}
              <small>Bound {observation.boundArtifactHash.slice(0, 23)}… · immutable settlement observation</small>
            </article>
          ))}
        </div>
        <div className="attention-authority-lock">
          <CircleOff size={14} />
          <span>Calibration diagnoses estimator behavior; it cannot issue a probability certificate or authorize execution.</span>
          <code>{probabilityCalibration.storage.observations.durable ? "SQLITE WAL" : "MEMORY"}</code>
        </div>
      </section>

      <section className="attention-queue" aria-label="AI token usage ledger">
        <div className="attention-queue-heading">
          <div>
            <Activity size={15} />
            <div>
              <strong>AI usage ledger</strong>
              <span>Purpose × role × model × outcome · provider-reported tokens only</span>
            </div>
          </div>
          <Badge variant={aiUsage.storage.durable ? "verified" : "muted"}>
            {aiUsage.storage.durable ? "SQLITE DURABLE" : "MEMORY"}
          </Badge>
        </div>
        <div className="attention-queue-stats">
          <div>
            <strong>{formatTokenCount(aiUsage.totals.invocationCount)}</strong>
            <span>invocations</span>
          </div>
          <div>
            <strong>{formatTokenCount(aiUsage.totals.tokens.totalTokens)}</strong>
            <span>reported total tokens</span>
          </div>
          <div>
            <strong>{formatTokenCount(aiUsage.totals.tokens.inputTokens)}</strong>
            <span>input</span>
          </div>
          <div>
            <strong>{formatTokenCount(aiUsage.totals.tokens.outputTokens)}</strong>
            <span>output</span>
          </div>
          <div>
            <strong>{formatTokenCount(aiUsage.totals.tokens.reasoningTokens)}</strong>
            <span>reasoning</span>
          </div>
          <div>
            <strong>{formatTokenCount(aiUsage.totals.tokens.cacheReadTokens)}</strong>
            <span>cache read</span>
          </div>
        </div>
        {recentUsageHours.length > 0 && (
          <div
            className="usage-hourly-trend"
            aria-label="AI invocation frequency by UTC hour"
            style={{
              gridTemplateColumns:
                `repeat(${Math.max(1, recentUsageHours.length)}, minmax(18px, 1fr))`,
            }}
          >
            {recentUsageHours.map((bucket) => {
              const calls = Number(bucket.invocationCount);
              return (
                <div key={bucket.bucket} title={`${bucket.bucket}: ${bucket.invocationCount} calls, ${formatTokenCount(bucket.tokens.totalTokens)} tokens`}>
                  <span>{new Date(bucket.bucket).getUTCHours().toString().padStart(2, "0")}Z</span>
                  <i style={{ height: `${Math.max(8, Math.round((calls / maximumHourlyCalls) * 44))}px` }} />
                  <strong>{bucket.invocationCount}</strong>
                </div>
              );
            })}
          </div>
        )}
        <div className="attention-item-list">
          {usagePurposes.length === 0 ? (
            <div className="review-operation-empty">
              <strong>No AI usage retained yet</strong>
              <span>The next AI SDK or Pi invocation will appear here; unavailable usage is not counted as zero.</span>
            </div>
          ) : usagePurposes.map((purpose) => (
            <article key={purpose.key}>
              <div className="attention-item-topline">
                <Badge variant="shadow">{purpose.key.replaceAll("_", " ")}</Badge>
                <span>{formatTokenCount(purpose.invocationCount)} calls</span>
              </div>
              <strong>{formatTokenCount(purpose.tokens.totalTokens)} reported tokens</strong>
              <p>
                {formatTokenCount(purpose.tokens.inputTokens)} input · {formatTokenCount(purpose.tokens.outputTokens)} output · {formatTokenCount(purpose.tokens.reasoningTokens)} reasoning · {formatTokenCount(purpose.tokens.cacheReadTokens)} cache read
              </p>
              <div className="attention-item-facts">
                <span>{formatTokenCount(purpose.durableEffectCount)} durable effects</span>
                <span>{purpose.completeCount} complete</span>
                <span>{purpose.partialCount} partial</span>
                <span>{purpose.unavailableCount} unavailable</span>
              </div>
            </article>
          ))}
          {aiUsage.recentEvents.slice(0, 8).map((event) => (
            <article key={event.eventId}>
              <div className="attention-item-topline">
                <Badge variant={event.outcome === "SUCCEEDED" ? "verified" : ["ABSTAINED", "CHALLENGED"].includes(event.outcome) ? "muted" : "warning"}>
                  {event.outcome}
                </Badge>
                <time>{new Date(event.occurredAt).toLocaleString()}</time>
              </div>
              <strong>{event.purpose.replaceAll("_", " ")} · {event.role ?? "unspecified role"}</strong>
              <p>{event.provider}/{event.model} · {formatTokenCount(event.tokens.totalTokens)} tokens · {event.durationMs} ms</p>
              <small>{event.coverage} coverage · {event.providerRequestCount ?? "unknown"} provider requests · prompts and outputs not retained</small>
            </article>
          ))}
        </div>
        <div className="case-authority-lock archaeology-authority-lock">
          <CircleOff size={15} />
          <span>
            Missing provider metadata stays unknown. Pi is partial until its CLI exposes exact token usage; currency cost is intentionally absent until pricing is versioned.
          </span>
        </div>
      </section>

      <section className="attention-queue economic-frontier" aria-label="Pre-review economic frontier">
        <div className="attention-queue-heading">
          <div>
            <Gauge size={15} />
            <div>
              <strong>Pre-review economic frontier</strong>
              <span>
                Settlement-qualified gross-price hints reorder bounded review work · no proposal is suppressed
              </span>
            </div>
          </div>
          <Badge variant={economicTriage.boostedCount > 0 ? "verified" : "muted"}>
            {economicTriage.boostedCount} ACTUAL +1 BOOSTS
          </Badge>
        </div>
        <div className="attention-queue-stats">
          <div><strong>{economicTriage.itemCount}</strong><span>retained candidates</span></div>
          <div><strong>{economicTriage.boostedCount}</strong><span>+1 priority</span></div>
          <div><strong>{economicTriage.counts.POSITIVE_GROSS_HINT}</strong><span>positive gross</span></div>
          <div><strong>{economicTriage.counts.SETTLEMENT_INELIGIBLE}</strong><span>won't settle</span></div>
          <div><strong>{economicTriage.counts.NON_POSITIVE_GROSS_HINT}</strong><span>non-positive gross</span></div>
          <div>
            <strong>{economicTriage.counts.PRICE_UNAVAILABLE + economicTriage.counts.EVIDENCE_UNAVAILABLE + economicTriage.counts.CURRENT_CONTRACT_MISMATCH + economicTriage.counts.LISTING_SCOPE_UNSUPPORTED + economicTriage.counts.RELATION_UNSUPPORTED}</strong>
            <span>not priceable</span>
          </div>
        </div>
        <div className="attention-item-list">
          {economicTriage.items.length === 0 ? (
            <div className="review-operation-empty">
              <strong>No grounded review candidates</strong>
              <span>AI proposals appear here once their retained evidence enters review scheduling.</span>
            </div>
          ) : economicTriage.items.slice(0, 6).map((item) => (
            <article key={item.itemId}>
              <div className="attention-item-topline">
                <Badge variant={item.status === "POSITIVE_GROSS_HINT" ? "verified" : item.status === "NON_POSITIVE_GROSS_HINT" ? "muted" : "warning"}>
                  {item.status.replaceAll("_", " ")}
                </Badge>
                <Badge variant="shadow">{item.relationKind}</Badge>
                <span className="economic-priority">
                  P{item.basePriority}{item.priorityBoost === 1 ? ` → P${item.effectivePriority}` : ""}
                </span>
              </div>
              <strong>{item.statement}</strong>
              <p>{item.diagnostic}</p>
              <div className="attention-item-facts">
                <span>{item.currentContractMatchCount}/{item.listingRefs.length} current contracts matched</span>
                <span>{item.issueIds.length} search issue{item.issueIds.length === 1 ? "" : "s"}</span>
                <span>{item.settlementPosture.status.replaceAll("_", " ")}</span>
                <span>
                  {item.indicativeEconomics.status === "POSITIVE_GROSS_HINT" || item.indicativeEconomics.status === "NON_POSITIVE_GROSS_HINT"
                    ? `${item.indicativeEconomics.grossEdgeBpsFloor} bps gross hint`
                    : "gross hint unavailable"}
                </span>
              </div>
              <small>Before independent semantic review · fees and depth excluded · non-executable</small>
            </article>
          ))}
        </div>
        <div className="attention-authority-lock">
          <CircleOff size={14} />
          <span>Only a positive current hint with no explicit non-settlement clause adds one review-priority point below P5; every candidate stays retained.</span>
          <code>{economicTriage.contentHash.slice(0, 22)}…</code>
        </div>
      </section>

      <section className="attention-queue" aria-label="Automatic semantic review admission">
        <div className="attention-queue-heading">
          <div>
            <ShieldCheck size={15} />
            <div>
              <strong>Arbitrage-first review admission</strong>
              <span>
                Deterministic proposal-shape gate · research findings stay retained without spending automatic review requests
              </span>
            </div>
          </div>
          <Badge variant={reviewAdmission.autoReviewCount > 0 ? "verified" : "muted"}>
            {formatRateBps(reviewAdmission.autoReviewRateBps)} AUTO REVIEW
          </Badge>
        </div>
        <div className="attention-queue-stats">
          <div><strong>{reviewAdmission.autoReviewCount}/{reviewAdmission.candidateCount}</strong><span>compiler-shaped</span></div>
          <div><strong>{reviewAdmission.researchOnlyCount}</strong><span>research only</span></div>
          <div><strong>{reviewAdmission.countsByReason.NON_COMPILABLE_RELATION}</strong><span>relation unsupported</span></div>
          <div><strong>{reviewAdmission.countsByReason.LISTING_ARITY_UNSUPPORTED}</strong><span>arity unsupported</span></div>
          <div><strong>{reviewAdmission.countsByReason.DUPLICATE_LISTING_REF}</strong><span>duplicate refs</span></div>
          <div><strong>{reviewScheduler.researchOnlyCount}</strong><span>durable withheld jobs</span></div>
        </div>
        <div className="attention-authority-lock">
          <CircleOff size={14} />
          <span>
            Auto lane: two distinct listings plus {reviewAdmission.supportedRelations.join(" / ")}. Manual advisory review remains available for every retained proposal.
          </span>
          <code>{reviewAdmission.contentHash.slice(0, 22)}…</code>
        </div>
      </section>

      <section className="attention-queue" aria-label="Agent rule evidence claims">
        <div className="attention-queue-heading">
          <div>
            <BookOpenCheck size={15} />
            <div>
              <strong>Agent rule-evidence claims</strong>
              <span>
                One durable interpretation job per requirement × captured document · exact passage offsets verified before semantic reuse
              </span>
            </div>
          </div>
          <Badge variant={ruleEvidenceClaims.exhaustedCount > 0 ? "warning" : ruleEvidenceClaims.passedCount > 0 ? "verified" : "muted"}>
            {ruleEvidenceClaims.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <div className="attention-queue-stats">
          <div><strong>{ruleEvidenceClaims.dueCount}</strong><span>due</span></div>
          <div><strong>{ruleEvidenceClaims.leasedCount}/{ruleEvidenceClaims.concurrencyLimit}</strong><span>leased</span></div>
          <div><strong>{ruleEvidenceClaims.interruptedLeaseCount}</strong><span>interrupted</span></div>
          <div><strong>{ruleEvidenceClaims.supportedCount}</strong><span>supports</span></div>
          <div><strong>{ruleEvidenceClaims.contradictedCount}</strong><span>contradicts</span></div>
          <div><strong>{ruleEvidenceClaims.inconclusiveCount}</strong><span>inconclusive</span></div>
          <div><strong>{ruleEvidenceClaims.exhaustedCount}</strong><span>exhausted</span></div>
        </div>
        <div className="attention-item-list">
          {currentRuleEvidenceJobs.length === 0 ? (
            <div className="review-operation-empty">
              <strong>No current-protocol interpretation jobs retained</strong>
              <span>
                Captured documents are fanned out across proposal-local evidence requirements here.
                {ruleEvidenceClaims.legacyJobCount > 0 ? ` ${ruleEvidenceClaims.legacyJobCount} legacy jobs remain as history.` : ""}
              </span>
            </div>
          ) : currentRuleEvidenceJobs.slice(0, 8).map((job) => (
            <article key={job.jobId}>
              <div className="attention-item-topline">
                <Badge variant={job.status === "PASS" ? "verified" : job.status === "EXHAUSTED" ? "warning" : "muted"}>
                  {job.status.replaceAll("_", " ")}
                </Badge>
                <Badge variant="shadow">{job.requirement.kind.replaceAll("_", " ")}</Badge>
                <time>{new Date(job.updatedAt).toLocaleString()}</time>
              </div>
              <strong>{job.requirement.claim}</strong>
              <p>{job.diagnostic ?? "Exact captured passage lineage retained; awaiting or completed advisory interpretation."}</p>
              <div className="attention-item-facts">
                <span>attempt {job.attemptCount}/{job.maxAttempts}</span>
                <span>doc {job.documentId.slice(7, 14)}</span>
                <span>requirement {job.requirementId.slice(7, 14)}</span>
              </div>
              <small>Claim text is not exposed here; enriched semantic review consumes only verified, content-addressed claim artifacts.</small>
            </article>
          ))}
        </div>
        <div className="attention-authority-lock">
          <CircleOff size={14} />
          <span>
            Tool-mediated reading is advisory: exact quote validation prevents fabricated passages, while semantic decisions and certificates remain separate gates.
          </span>
          <code>
            {ruleEvidenceClaims.storage.durable ? "SQLite WAL" : "memory"} · {ruleEvidenceClaims.legacyJobCount} legacy retained · {ruleEvidenceClaims.budget.providerAttemptsStarted} attempts
          </code>
        </div>
      </section>

      <section className="attention-queue" aria-label="Operator review attention queue">
        <div className="attention-queue-heading">
          <div>
            <Inbox size={15} />
            <div>
              <strong>Operator attention queue</strong>
              <span>
                Deterministic triage of undecided AI reviews · current prices never replace captured semantics
              </span>
            </div>
          </div>
          <Badge variant={reviewAttention.counts.DECISION_READY > 0 ? "verified" : "muted"}>
            {reviewAttention.counts.DECISION_READY} DECISION READY
          </Badge>
        </div>
        <div className="attention-queue-stats">
          <div><strong>{reviewAttention.counts.DECISION_READY}</strong><span>decision ready</span></div>
          <div><strong>{reviewAttention.counts.RESEARCH_ONLY}</strong><span>research only</span></div>
          <div><strong>{reviewAttention.counts.EVIDENCE_ESCALATION}</strong><span>evidence gaps</span></div>
          <div><strong>{reviewAttention.counts.REJECT_RECOMMENDED}</strong><span>reject suggested</span></div>
          <div><strong>{reviewAttention.exactAdapterCoverageCount}</strong><span>exact adapter path</span></div>
          <div><strong>{reviewAttention.positiveGrossHintCount}</strong><span>positive gross hints</span></div>
        </div>
        <div className="attention-item-list">
          {reviewAttention.items.length === 0 ? (
            <div className="review-operation-empty">
              <strong>No undecided reviewed proposals</strong>
              <span>Scheduled reviews appear here after advisory completion.</span>
            </div>
          ) : reviewAttention.items.slice(0, 8).map((item) => (
            <article key={item.itemId}>
              <div className="attention-item-topline">
                <Badge variant={item.operatorPosture === "DECISION_READY" ? "verified" : item.operatorPosture === "REJECT_RECOMMENDED" ? "warning" : "muted"}>
                  {item.operatorPosture.replaceAll("_", " ")}
                </Badge>
                <Badge variant="shadow">{item.relationConclusion}</Badge>
                <time>{new Date(item.completedAt).toLocaleString()}</time>
              </div>
              <strong>{item.statement}</strong>
              <p>
                {item.payoffReadiness.status === "READY"
                  ? "Canonical payoff partition is compiler-ready."
                  : item.payoffReadiness.diagnostic}
              </p>
              <div className="attention-item-facts">
                <span>{item.currentContractMatchCount}/{item.listingRefs.length} current contracts matched</span>
                <span>{item.settlementPosture.status.replaceAll("_", " ")}</span>
                <span>{item.anonymousCoverage.status.replaceAll("_", " ")}</span>
                <span>{item.missingEvidenceCount} missing · {item.counterexampleCount} counterexamples</span>
                <span>
                  {item.indicativeEconomics.status === "POSITIVE_GROSS_HINT" || item.indicativeEconomics.status === "NON_POSITIVE_GROSS_HINT"
                    ? `${item.indicativeEconomics.grossEdgeBpsFloor} bps gross hint`
                    : item.indicativeEconomics.status.replaceAll("_", " ")}
                </span>
              </div>
              <small>
                Next: {item.nextAction.replaceAll("_", " ")} · gross hint excludes fees and depth and is not executable
              </small>
            </article>
          ))}
        </div>
        <div className="attention-authority-lock">
          <CircleOff size={14} />
          <span>Queue projection makes no model call, operator decision, simulation request, certificate, or execution action.</span>
          <code>{reviewAttention.contentHash.slice(0, 22)}…</code>
        </div>
      </section>

      <section className="review-operations" aria-label="Semantic review operations">
        <div className="review-operations-heading">
          <div>
            <TimerReset size={15} />
            <div>
              <strong>Persistent semantic review queue</strong>
              <span>
                {reviewScheduler.enabled
                  ? `${reviewScheduler.tickIntervalMs}ms tick · SQLite ${reviewScheduler.storage.jobs.durable ? "WAL" : "off"}`
                  : "automatic dispatch disabled · retained jobs stay visible"}
              </span>
            </div>
          </div>
          <Badge variant={reviewScheduler.unreadNotificationCount > 0 ? "warning" : "muted"}>
            <Bell size={11} /> {reviewScheduler.unreadNotificationCount} UNREAD
          </Badge>
        </div>
        <div className="review-operations-stats">
          <div><strong>{reviewScheduler.dueCount}</strong><span>due</span></div>
          <div><strong>{reviewScheduler.leasedCount}/{reviewScheduler.concurrencyLimit}</strong><span>leased</span></div>
          <div><strong>{reviewScheduler.retryWaitCount}</strong><span>retry wait</span></div>
          <div><strong>{reviewScheduler.blockedEvidenceCount}</strong><span>evidence blocked</span></div>
          <div><strong>{reviewScheduler.researchOnlyCount}</strong><span>research only</span></div>
          <div>
            <strong>{reviewScheduler.uniqueReviewScopeCount}/{reviewScheduler.scopedJobCount}</strong>
            <span>unique semantic scopes / scoped jobs</span>
          </div>
          <div><strong>{reviewScheduler.duplicateScopeCount}</strong><span>duplicate calls withheld</span></div>
          <div><strong>{reviewScheduler.historicalRedundantPassCount}</strong><span>historical redundant passes</span></div>
          <div>
            <strong>{reviewScheduler.bundledJobCount}/{reviewScheduler.scopedJobCount}</strong>
            <span>evidence bundled · {reviewScheduler.legacyEvidenceDebtCount} legacy debt</span>
          </div>
          <div><strong>{reviewScheduler.passedCount}</strong><span>reviewed</span></div>
          <div><strong>{reviewScheduler.exhaustedCount}</strong><span>exhausted</span></div>
          <div>
            <strong>{firstPartyReviewDispositionCount}/{semanticReview.passCount}</strong>
            <span>first-party semantic dispositions / retained passes</span>
          </div>
          <div>
            <strong>{reviewScheduler.classifiedFailureJobCount}/{reviewScheduler.classifiedFailureJobCount + reviewScheduler.unclassifiedFailureJobCount}</strong>
            <span>classified failures</span>
          </div>
          <div>
            <strong>{reviewScheduler.failureClassCounts.map((item) =>
              `${item.failureClass.replaceAll("_", " ")} ${item.jobCount}`
            ).join(" · ") || "none"}</strong>
            <span>retained failure mix</span>
          </div>
          <div>
            <strong>{reviewScheduler.budget.requestAttemptsStarted}</strong>
            <span>request attempts · {reviewScheduler.budget.maxAttemptsPerJob}/job</span>
          </div>
        </div>
        <div className="review-operations-body">
          <div className="review-job-list">
            {reviewScheduler.jobs.length === 0 ? (
              <div className="review-operation-empty">
                <strong>No attributed review jobs retained</strong>
                <span>Passed issue leases seed one durable job per proposal.</span>
              </div>
            ) : reviewScheduler.jobs.slice(0, 8).map((job) => (
              <article key={job.jobId}>
                <Badge variant={job.status === "PASS" ? "verified" : job.status === "EXHAUSTED" ? "warning" : "muted"}>
                  {job.status.replaceAll("_", " ")}
                </Badge>
                <div>
                  <strong>{proposals.get(job.proposalId)?.statement ?? job.opportunityId}</strong>
                  <span>
                    P{job.priority} · {job.issueIds.length} issue{job.issueIds.length === 1 ? "" : "s"} · attempt {job.attemptCount}/{job.maxAttempts} · {job.evidenceBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2" ? job.evidenceBundle.captureKind.replaceAll("_", " ") : "LEGACY REFS"}
                    {job.reviewScopeIdentity ? ` · scope ${job.reviewScopeIdentity.slice(7, 14)}` : " · unscoped"}
                    {job.duplicateOfJobId ? ` · reuses ${job.duplicateOfJobId.slice(7, 14)}` : ""}
                    {job.lastFailure ? ` · ${job.lastFailure.failureClass.replaceAll("_", " ")} / ${job.lastFailure.retryPolicy.replaceAll("_", " ")}` : ""}
                  </span>
                </div>
                <code>{job.proposalId.slice(0, 19)}…</code>
              </article>
            ))}
          </div>
          <div className="review-notification-list">
            {reviewScheduler.notifications.length === 0 ? (
              <div className="review-operation-empty">
                <strong>Review inbox is quiet</strong>
                <span>Completed advisory reports and exhausted jobs notify here.</span>
              </div>
            ) : reviewScheduler.notifications.slice(0, 6).map((notification) => (
              <article className={notification.status === "READ" ? "is-read" : undefined} key={notification.notificationId}>
                <div>
                  <Badge variant={notification.kind === "JOB_EXHAUSTED" ? "warning" : "shadow"}>
                    {notification.kind.replaceAll("_", " ")}
                  </Badge>
                  <time>{new Date(notification.createdAt).toLocaleString()}</time>
                </div>
                <strong>{notification.title}</strong>
                <p>{notification.summary}</p>
                {notification.status === "UNREAD" && (
                  <button
                    type="button"
                    disabled={reviewNotificationAction === notification.notificationId}
                    onClick={() => void acknowledgeReviewNotification(notification.notificationId)}
                  >Acknowledge</button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="review-operations" aria-label="Hidden premise analysis">
        <div className="review-operations-heading">
          <div>
            <GitBranch size={15} />
            <div>
              <strong>Agent-native hidden-premise audit</strong>
              <span>
                {premiseScheduler.enabled
                  ? `${premiseScheduler.tickIntervalMs}ms tick · SQLite ${premiseScheduler.storage.durable ? "WAL" : "off"}`
                  : "automatic dispatch disabled · semantic premises remain inspectable"}
              </span>
            </div>
          </div>
          <Badge variant={premiseScheduler.exactEligibleCount > 0 ? "verified" : "muted"}>
            {premiseScheduler.exactEligibleCount} EXACT · {premiseScheduler.unreadNotificationCount} UNREAD
          </Badge>
        </div>
        <div className="review-operations-stats">
          <div><strong>{premiseScheduler.dueCount}</strong><span>due</span></div>
          <div><strong>{premiseScheduler.leasedCount}/{premiseScheduler.concurrencyLimit}</strong><span>leased</span></div>
          <div><strong>{premiseScheduler.retryWaitCount}</strong><span>retry wait</span></div>
          <div><strong>{premiseScheduler.passedCount}</strong><span>audited</span></div>
          <div><strong>{premiseScheduler.exactEligibleCount}</strong><span>closed logic</span></div>
          <div><strong>{premiseScheduler.researchOnlyCount}</strong><span>premise-dependent</span></div>
          <div><strong>{premiseScheduler.attributedJobCount}</strong><span>review-attributed</span></div>
          <div><strong>{premiseScheduler.legacyAttributionDebtCount}</strong><span>legacy debt</span></div>
          <div><strong>{premiseScheduler.exhaustedCount}</strong><span>exhausted</span></div>
          <div>
            <strong>{premiseScheduler.budget.providerAttemptsStarted}</strong>
            <span>provider attempts · {premiseScheduler.budget.maxAttemptsPerJob}/job</span>
          </div>
        </div>
        <div className="review-operations-body">
          <div className="review-job-list">
            {premiseScheduler.jobs.length === 0 ? (
              <div className="review-operation-empty">
                <strong>No premise-audit jobs retained</strong>
                <span>Passed 2–4 market semantic constraints seed one scope-bound Agent audit.</span>
              </div>
            ) : premiseScheduler.jobs.slice(0, 8).map((job) => {
              const record = premiseAnalysis.records.find((item) => item.analysisId === job.analysisId);
              const relation = record?.analysis?.relation;
              return (
                <article key={job.jobId}>
                  <Badge variant={job.exactCompilerAdmission === "ELIGIBLE" ? "verified" : job.status === "EXHAUSTED" ? "warning" : "muted"}>
                    {job.status.replaceAll("_", " ")}
                  </Badge>
                  <div>
                    <strong>
                      {relation === undefined
                        ? proposals.get(job.proposalId)?.statement ?? "Scoped hidden-premise audit"
                        : `${relation.classification.replaceAll("_", " ")} · ${relation.exactCompilerAdmission}`}
                    </strong>
                    <span>
                      {record?.analysis?.premises.length ?? 0} premise artifact
                      {(record?.analysis?.premises.length ?? 0) === 1 ? "" : "s"}
                      {relation ? ` · ${relation.evaluatedStates.length} states replayed` : ""}
                      {relation?.blocker ? ` · ${relation.blocker.replaceAll("_", " ")}` : ""}
                    {` · attempt ${job.attemptCount}/${job.maxAttempts}`}
                    {job.schemaVersion === "pmh.premise-analysis-job.v2"
                      ? ` · ${job.admissionLane!.replaceAll("_", " ")} · ${job.issueIds!.length} issue${job.issueIds!.length === 1 ? "" : "s"}`
                      : " · LEGACY UNATTRIBUTED"}
                    </span>
                  </div>
                  <code>{job.evidenceScopeIdentity.slice(7, 19)}…</code>
                </article>
              );
            })}
          </div>
          <div className="review-notification-list">
            {premiseScheduler.notifications.length === 0 ? (
              <div className="review-operation-empty">
                <strong>Premise inbox is quiet</strong>
                <span>Exact-ready, research-retained, and exhausted Agent audits notify here.</span>
              </div>
            ) : premiseScheduler.notifications.slice(0, 6).map((notification) => (
              <article className={notification.status === "READ" ? "is-read" : undefined} key={notification.notificationId}>
                <div>
                  <Badge variant={notification.kind === "EXACT_RELATION_READY" ? "verified" : notification.kind === "JOB_EXHAUSTED" ? "warning" : "shadow"}>
                    {notification.kind.replaceAll("_", " ")}
                  </Badge>
                  <time>{new Date(notification.createdAt).toLocaleString()}</time>
                </div>
                <strong>{notification.title}</strong>
                <p>{notification.summary}</p>
                {notification.status === "UNREAD" && (
                  <button
                    type="button"
                    disabled={premiseNotificationAction === notification.notificationId}
                    onClick={() => void acknowledgePremiseNotification(notification.notificationId)}
                  >Acknowledge</button>
                )}
              </article>
            ))}
          </div>
        </div>
        <div className="attention-authority-lock">
          <CircleOff size={14} />
          <span>LLM tools expose premises and expressions; only replayed truth states can enter the exact compiler.</span>
          <code>{premiseAnalysis.interpreterIdentity.slice(0, 22)}…</code>
        </div>
      </section>

      <div className="lifecycle-flow" aria-label="Opportunity promotion flow">
        {[
          ["Discover", "AI proposes relations"],
          ["Review", "independent semantics"],
          ["Simulate", "venue microstructure"],
          ["Certify", "first-party verifier"],
          ["Route", "notify or shadow"],
        ].map(([title, detail], index) => (
          <div className="lifecycle-flow-node" key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>
        ))}
      </div>

      <div className="lifecycle-model-grid">
        {desk.exchangeModels.map((model) => (
          <article key={model.model}>
            <div>
              <Database size={15} />
              <Badge variant={model.model === "CLOB_TAKER_V1" ? "verified" : "warning"}>
                {model.model === "CLOB_TAKER_V1" ? "QUALIFIED" : "CALIBRATE"}
              </Badge>
            </div>
            <h2>{model.model.replaceAll("_", " ")}</h2>
            <p>
              {model.model === "CLOB_TAKER_V1"
                ? "Walks bound book levels best-first with exact FOK/IOC, fees, rounding, and adverse-impact evidence."
                : "Explores x·y=k behavior exactly, but cannot promote until a venue-specific contract and fee model are calibrated."}
            </p>
            <code>{model.qualification}</code>
          </article>
        ))}
        <article>
          <div>
            <Waypoints size={15} />
            <Badge variant="verified">DETERMINISTIC</Badge>
          </div>
          <h2>RELATION PAYOFF COMPILER</h2>
          <p>
            Compiles hash-bound feasible settlement states into bigint payout
            floors and buy-only complete-payout templates. Relation labels are
            routing hints; the explicit state matrix is authoritative input.
          </p>
          <code>
            {relationPayoff.supportedRelations.join(" · ")}
          </code>
        </article>
      </div>

      <div className="case-section-heading lifecycle-case-heading">
        <div>
          <Waypoints size={16} />
          <div>
            <span className="eyebrow">One queue · explicit authority</span>
            <h2>Lifecycle cases</h2>
          </div>
        </div>
        <div className="lifecycle-case-window-status">
          <span>
            Showing {Math.min(lifecycleCaseLimit, desk.cases.length)} of {desk.cases.length} live · {desk.caseCount} durable
          </span>
          <code>{desk.defaultPolicy.routeAfterCertificate}</code>
        </div>
      </div>

      {desk.cases.length === 0 ? (
        <div className="radar-empty">
          <GitBranch size={28} />
          <strong>No opportunity has entered the lifecycle</strong>
          <span>Run market archaeology or load a deterministic screen.</span>
        </div>
      ) : (
        <div className="lifecycle-case-list">
          {visibleLifecycleCases.map((item) => {
            const proposal = proposals.get(item.discoveryArtifactHash);
            const latest = item.events.at(-1);
            const review = semanticReview.records.find(
              (record) => record.opportunityId === item.opportunityId,
            );
            const reviewReport = review?.report;
            const semanticDecision = semanticDecisions.find(
              (decision) => decision.opportunityId === item.opportunityId,
            );
            const payoffQualification =
              relationPayoff.qualifications.find(
                (qualification) =>
                  qualification.opportunityId === item.opportunityId,
              );
            const simulationBundle = simulationBundles.find(
              (bundle) => bundle.opportunityId === item.opportunityId,
            );
            const exactVerification = exactVerifications.find(
              (record) => record.opportunityId === item.opportunityId,
            );
            const shadowRun = shadowRuns.find(
              (run) => run.opportunityId === item.opportunityId,
            );
            const latestShadowObservation = shadowObservations.find(
              (observation) =>
                observation.opportunityId === item.opportunityId,
            );
            const reviewRunning =
              reviewStates[item.opportunityId] === "RUNNING" ||
              (review?.status === "RUNNING" && semanticReview.status === "RUNNING");
            const decisionRunning =
              decisionStates[item.opportunityId] === "RUNNING";
            const rationale = rationales[item.opportunityId] ?? "";
            const shadowDecisionRunning =
              shadowDecisionStates[item.opportunityId] === "RUNNING";
            return (
              <article key={item.opportunityId}>
                <div className="lifecycle-case-topline">
                  <Badge variant={item.state.startsWith("REJECTED") ? "warning" : "shadow"}>
                    {item.state.replaceAll("_", " ")}
                  </Badge>
                  <span>{item.discoveryKind.replaceAll("_", " ")}</span>
                  <code>{item.discoveryArtifactHash.slice(0, 23)}…</code>
                </div>
                <h3>{proposal?.statement ?? "Bound real-candidate economic screen"}</h3>
                <p>{latest?.detail ?? "Waiting for lifecycle evidence."}</p>
                <div className="lifecycle-case-next">
                  <div>
                    <Activity size={14} />
                    <span>Next action</span>
                    <strong>{item.nextAction.replaceAll("_", " ")}</strong>
                  </div>
                  <small>{item.events.length} hash-bound event{item.events.length === 1 ? "" : "s"}</small>
                </div>
                {proposal !== undefined && (
                  <div className="lifecycle-review-panel">
                    <div className="lifecycle-review-head">
                      <div>
                        <ShieldCheck size={14} />
                        <strong>Adversarial semantic review</strong>
                        <span>
                          separate invocation · same provider · advisory only
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        disabled={
                          !semanticReview.configured ||
                          semanticReview.activeCount >= semanticReview.concurrencyLimit ||
                          reviewRunning ||
                          review?.status === "PASS" ||
                          item.state !== "AWAITING_SEMANTIC_REVIEW"
                        }
                        onClick={() => void runReview(item.opportunityId)}
                      >
                        {reviewRunning ? (
                          <RefreshCw className="is-spinning" size={13} />
                        ) : (
                          <Search size={13} />
                        )}
                        {reviewRunning
                          ? "Falsifying…"
                          : review?.status === "PASS"
                            ? "Review retained"
                            : review?.status === "FAILED"
                              ? "Retry counterexample review"
                              : "Run counterexample review"}
                      </Button>
                    </div>

                    {reviewReport !== null && reviewReport !== undefined && (
                      <div className="lifecycle-review-result">
                        <div className="lifecycle-review-verdict">
                          <Badge
                            variant={
                              reviewReport.result.recommendation ===
                              "ACCEPT_FOR_RESEARCH_SIMULATION"
                                ? "verified"
                                : "warning"
                            }
                          >
                            {reviewReport.result.recommendation.replaceAll(
                              "_",
                              " ",
                            )}
                          </Badge>
                          <span>
                            {reviewReport.input.evidencePosture.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                          <code>{reviewReport.artifactHash.slice(0, 23)}…</code>
                        </div>
                        <p>{reviewReport.result.rationale}</p>
                        <div className="lifecycle-assessment-grid">
                          {Object.entries(reviewReport.result.assessments).map(
                            ([label, assessment]) => (
                              <div key={label}>
                                <span>{label.replaceAll(/([A-Z])/g, " $1")}</span>
                                <strong>{assessment}</strong>
                              </div>
                            ),
                          )}
                        </div>
                        <div className="lifecycle-counterexamples">
                          <span>Counterexamples</span>
                          {reviewReport.result.counterexamples.length === 0 ? (
                            <p>No concrete counterexample survived this pass.</p>
                          ) : (
                            reviewReport.result.counterexamples.map(
                              (counterexample) => (
                                <p key={counterexample}>{counterexample}</p>
                              ),
                            )
                          )}
                          {reviewReport.result.missingEvidence.map((gap) => (
                            <p className="is-gap" key={gap}>
                              Missing · {gap}
                            </p>
                          ))}
                        </div>
                        {reviewReport.result.semanticConstraint !== undefined && (() => {
                          const constraint = reviewReport.result.semanticConstraint;
                          const feasibleCount = constraint.truthTable.filter(
                            (state) => state.disposition === "FEASIBLE",
                          ).length;
                          const impossibleCount = constraint.truthTable.filter(
                            (state) => state.disposition === "IMPOSSIBLE",
                          ).length;
                          const unresolvedCount = constraint.truthTable.filter(
                            (state) => state.disposition === "UNRESOLVED",
                          ).length;
                          return (
                            <div className="lifecycle-constraint-proof">
                              <div>
                                <Badge
                                  variant={
                                    constraint.exactCompilerAdmission === "ELIGIBLE"
                                      ? "verified"
                                      : "warning"
                                  }
                                >
                                  {constraint.classification.replaceAll("_", " ")}
                                </Badge>
                                <span>
                                  {constraint.exactCompilerAdmission.replaceAll("_", " ")}
                                </span>
                                <code>{constraint.artifactHash.slice(0, 23)}…</code>
                              </div>
                              <p>{constraint.counterexampleAttempt.narrative}</p>
                              <div className="lifecycle-constraint-counts">
                                <span>{feasibleCount} feasible</span>
                                <span>{impossibleCount} impossible</span>
                                <span>{unresolvedCount} unresolved</span>
                                <span>{constraint.ruleEvidence.length} rule hashes</span>
                              </div>
                              {constraint.assumptions.map((assumption) => (
                                <small key={assumption}>Assumption · {assumption}</small>
                              ))}
                              {constraint.unresolvedEvidence.map((gap) => (
                                <small className="is-gap" key={gap}>Unresolved · {gap}</small>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {reviewReport !== null &&
                      reviewReport !== undefined &&
                      semanticDecision === undefined &&
                      item.state === "AWAITING_SEMANTIC_REVIEW" && (
                        <div className="lifecycle-decision-box">
                          <label htmlFor={`rationale-${item.opportunityId}`}>
                            Research-only operator rationale
                          </label>
                          <Textarea
                            id={`rationale-${item.opportunityId}`}
                            value={rationale}
                            maxLength={2000}
                            placeholder="State the exact conditional scope or rejection reason. This cannot grant production authority."
                            onChange={(event) =>
                              setRationales((current) => ({
                                ...current,
                                [item.opportunityId]: event.target.value,
                              }))
                            }
                          />
                          <div>
                            <Button
                              variant="outline"
                              disabled={decisionRunning || rationale.trim() === ""}
                              onClick={() =>
                                void decide(item.opportunityId, "REJECT")
                              }
                            >
                              <CircleOff size={13} /> Reject relation
                            </Button>
                            <Button
                              disabled={decisionRunning || rationale.trim() === ""}
                              onClick={() =>
                                void decide(
                                  item.opportunityId,
                                  "ACCEPT_FOR_SIMULATION",
                                )
                              }
                            >
                              {decisionRunning ? (
                                <RefreshCw className="is-spinning" size={13} />
                              ) : (
                                <ChevronRight size={13} />
                              )}
                              Accept for simulation
                            </Button>
                          </div>
                        </div>
                      )}

                    {semanticDecision !== undefined && (
                      <div className="lifecycle-retained-decision">
                        <Badge
                          variant={
                            semanticDecision.decision === "ACCEPT_FOR_SIMULATION"
                              ? "verified"
                              : "warning"
                          }
                        >
                          {semanticDecision.decision.replaceAll("_", " ")}
                        </Badge>
                        <p>{semanticDecision.rationale}</p>
                        <small>
                          LOCAL OPERATOR · RESEARCH ONLY · PRODUCTION INELIGIBLE
                        </small>
                      </div>
                    )}
                    {payoffQualification !== undefined && (
                      <div
                        className={`lifecycle-payoff-qualification ${
                          payoffQualification.status ===
                          "SIMULATION_TEMPLATE_READY"
                            ? "is-ready"
                            : "is-blocked"
                        }`}
                      >
                        <div>
                          <Badge
                            variant={
                              payoffQualification.status ===
                              "SIMULATION_TEMPLATE_READY"
                                ? "verified"
                                : "warning"
                            }
                          >
                            {payoffQualification.status.replaceAll("_", " ")}
                          </Badge>
                          <span>
                            {payoffQualification.relationKind.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                          <code>
                            {payoffQualification.artifactHash.slice(0, 23)}…
                          </code>
                        </div>
                        {payoffQualification.diagnostic !== null && (
                          <p>{payoffQualification.diagnostic}</p>
                        )}
                        {payoffQualification.canonicalStates.length > 0 && (
                          <div className="lifecycle-truth-states">
                            {payoffQualification.canonicalStates.map((state) => (
                              <span key={state.stateId}>
                                {state.stateId} · {Object.values(
                                  state.truthByListingRef,
                                )
                                  .map((truth) => (truth ? "TRUE" : "FALSE"))
                                  .join(" / ")}
                              </span>
                            ))}
                          </div>
                        )}
                        {payoffQualification.portfolios.map((portfolio) => {
                          const latestMaterialization =
                            simulationMaterializer.records.find(
                              (record) =>
                                record.opportunityId === item.opportunityId &&
                                record.portfolioId === portfolio.portfolioId,
                            );
                          const firstLeg = portfolio.legs[0];
                          const firstBinding =
                            firstLeg === undefined
                              ? undefined
                              : payoffQualification.listingBindings.find(
                                  (binding) =>
                                    binding.listingRef === firstLeg.listingRef,
                                );
                          const requestedQuantity =
                            firstBinding?.quantityScale ?? "1";
                          const materializationRunning =
                            materializationStates[portfolio.portfolioId] ===
                            "RUNNING";
                          const shadowObservationRunning =
                            shadowObservationStates[portfolio.portfolioId] ===
                            "RUNNING";
                          return (
                            <div
                              className="lifecycle-payoff-portfolio"
                              key={portfolio.portfolioId}
                            >
                              <strong>{portfolio.label}</strong>
                              <span>
                                floor {portfolio.minimumPayoutUnits} payout unit ·
                                {" "}one-unit anonymous depth probe
                              </span>
                              <div className="lifecycle-materialization-action">
                                <Button
                                  variant="outline"
                                  disabled={
                                    materializationRunning ||
                                    payoffQualification.status !==
                                      "SIMULATION_TEMPLATE_READY"
                                  }
                                  onClick={() =>
                                    void materialize(
                                      item.opportunityId,
                                      portfolio.portfolioId,
                                      requestedQuantity,
                                    )
                                  }
                                >
                                  {materializationRunning ? (
                                    <RefreshCw
                                      className="is-spinning"
                                      size={13}
                                    />
                                  ) : (
                                    <Database size={13} />
                                  )}
                                  {materializationRunning
                                    ? "Acquiring…"
                                    : latestMaterialization === undefined
                                      ? "Acquire public books"
                                      : "Refresh public books"}
                                </Button>
                                {latestMaterialization !== undefined && (
                                  <div>
                                    <Badge
                                      variant={
                                        latestMaterialization.status === "READY"
                                          ? "verified"
                                          : "warning"
                                      }
                                    >
                                      {latestMaterialization.status}
                                    </Badge>
                                    <span>
                                      {latestMaterialization.sources.length} raw
                                      {" "}source
                                      {latestMaterialization.sources.length === 1
                                        ? ""
                                        : "s"}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {shadowRun !== undefined && (
                                <div className="lifecycle-shadow-observation-action">
                                  <div>
                                    <Radio size={13} />
                                    <span>Fresh public-market comparison</span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    disabled={shadowObservationRunning}
                                    onClick={() =>
                                      void observeShadow(
                                        item.opportunityId,
                                        portfolio.portfolioId,
                                        requestedQuantity,
                                      )
                                    }
                                  >
                                    {shadowObservationRunning ? (
                                      <RefreshCw className="is-spinning" size={13} />
                                    ) : (
                                      <Activity size={13} />
                                    )}
                                    {shadowObservationRunning
                                      ? "Observing…"
                                      : "Observe shadow now"}
                                  </Button>
                                </div>
                              )}
                              {latestMaterialization !== undefined && (
                                <div className="lifecycle-materialization-fees">
                                  {latestMaterialization.legs.map((leg) => (
                                    <small key={leg.legId}>
                                      {leg.venueId} · {leg.feeModel ?? "NO FEE MODEL"}
                                      {" · "}
                                      {leg.feeQualification ?? "BLOCKED"}
                                    </small>
                                  ))}
                                </div>
                              )}
                              {latestMaterialization?.diagnostic !== null &&
                                latestMaterialization?.diagnostic !== undefined && (
                                  <p className="lifecycle-materialization-diagnostic">
                                    {latestMaterialization.diagnostic}
                                  </p>
                                )}
                            </div>
                          );
                        })}
                        <small>
                          RESEARCH COMPILER · VERIFIER ELIGIBLE FALSE · NO
                          CERTIFICATE AUTHORITY
                        </small>
                      </div>
                    )}
                    {simulationBundle !== undefined && (
                      <div className="lifecycle-simulation-evidence">
                        <div>
                          <Badge
                            variant={
                              simulationBundle.status ===
                              "POSITIVE_SIMULATED_FLOOR"
                                ? "verified"
                                : "warning"
                            }
                          >
                            {simulationBundle.status.replaceAll("_", " ")}
                          </Badge>
                          <code>
                            {simulationBundle.artifactHash.slice(0, 23)}…
                          </code>
                        </div>
                        <div>
                          <span>Minimum payout</span>
                          <strong>
                            {simulationBundle.minimumPayoutCollateral}
                          </strong>
                          <span>Simulated cost</span>
                          <strong>
                            {simulationBundle.simulatedCostCollateral}
                          </strong>
                          <span>Post-fee floor</span>
                          <strong>
                            {simulationBundle.floorAfterSimulatedFees}
                          </strong>
                        </div>
                        <small>
                          {simulationBundle.reportCount} EXACT BIGINT MODEL
                          REPORTS · SIMULATION ONLY · CERTIFICATE AUTHORITY FALSE
                        </small>
                      </div>
                    )}
                    {exactVerification !== undefined && (
                      <div
                        className={`lifecycle-exact-evidence ${
                          exactVerification.status === "CERTIFIED"
                            ? "is-certified"
                            : "is-rejected"
                        }`}
                      >
                        <div>
                          <Badge
                            variant={
                              exactVerification.status === "CERTIFIED"
                                ? "verified"
                                : "warning"
                            }
                          >
                            {exactVerification.status}
                          </Badge>
                          <strong>First-party exact verifier</strong>
                          <code>
                            {exactVerification.artifactHash.slice(0, 23)}…
                          </code>
                        </div>
                        {exactVerification.status === "CERTIFIED" ? (
                          <div>
                            <span>Worst-case after fees</span>
                            <strong>
                              {exactVerification.worstCaseAfterFees}
                            </strong>
                            <span>Certificate</span>
                            <code>
                              {exactVerification.certificateId?.slice(0, 23)}…
                            </code>
                          </div>
                        ) : (
                          <p>{exactVerification.diagnostic}</p>
                        )}
                        <small>
                          CERTIFICATE AUTHORITY · FIRST PARTY · EXECUTION
                          AUTHORITY FALSE
                        </small>
                      </div>
                    )}
                    {item.state === "AWAITING_HUMAN_APPROVAL" && (
                      <div className="lifecycle-shadow-approval">
                        <div>
                          <ShieldCheck size={14} />
                          <div>
                            <strong>Shadow approval requested</strong>
                            <span>
                              Approval runs the certificate-bound local replay;
                              it cannot place an order.
                            </span>
                          </div>
                        </div>
                        <div>
                          <Button
                            disabled={shadowDecisionRunning}
                            onClick={() =>
                              void decideShadow(
                                item.opportunityId,
                                "APPROVE_SHADOW",
                              )
                            }
                          >
                            {shadowDecisionRunning ? (
                              <RefreshCw className="is-spinning" size={13} />
                            ) : (
                              <Play size={13} />
                            )}
                            Approve shadow replay
                          </Button>
                          <Button
                            variant="outline"
                            disabled={shadowDecisionRunning}
                            onClick={() =>
                              void decideShadow(item.opportunityId, "REJECT")
                            }
                          >
                            <X size={13} />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                    {shadowRun !== undefined && (
                      <div className="lifecycle-shadow-evidence">
                        <div>
                          <Badge variant="shadow">SHADOW COMPLETE</Badge>
                          <strong>Certificate-bound replay</strong>
                          <code>{shadowRun.artifactHash.slice(0, 23)}…</code>
                        </div>
                        <span>
                          {shadowRun.filledIntentCount}/
                          {shadowRun.plannedIntentCount} intents filled · {" "}
                          {shadowRun.gatewayCalls} gateway calls
                        </span>
                        <small>
                          SHADOW REPLAY ONLY · NO VALUE MOVEMENT · LIVE ROUTE
                          ABSENT
                        </small>
                      </div>
                    )}
                    {latestShadowObservation !== undefined && (
                      <div
                        className={`lifecycle-shadow-observation ${
                          latestShadowObservation.status === "DIVERGED"
                            ? "is-diverged"
                            : "is-matched"
                        }`}
                      >
                        <div>
                          <Badge
                            variant={
                              latestShadowObservation.status === "DIVERGED"
                                ? "warning"
                                : "verified"
                            }
                          >
                            {latestShadowObservation.status.replaceAll("_", " ")}
                          </Badge>
                          <strong>Fresh public-market shadow observation</strong>
                          <code>
                            {latestShadowObservation.artifactHash.slice(0, 23)}…
                          </code>
                        </div>
                        <span>
                          {latestShadowObservation.changedStateCount} changed
                          {" "}state bindings · {latestShadowObservation.reasons.length === 0
                            ? "still inside planned bounds"
                            : latestShadowObservation.reasons.join(" · ").replaceAll("_", " ")}
                        </span>
                        <small>
                          PUBLIC MARKET EVIDENCE ONLY · ACTUAL ORDER OBSERVED FALSE
                          {" · "}REVERIFICATION REQUIRED · 0 GATEWAY CALLS
                        </small>
                      </div>
                    )}
                    {diagnostics[item.opportunityId] && (
                      <div className="radar-diagnostic" role="status">
                        <CircleOff size={13} />
                        <span>{diagnostics[item.opportunityId]}</span>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          <div className="lifecycle-case-window-controls">
            <span>
              Actionable states first, then newest evidence. Durable history stays in SQLite.
            </span>
            <div>
              {lifecycleCaseLimit > 12 && (
                <Button variant="ghost" size="sm" onClick={() => setLifecycleCaseLimit(12)}>
                  Collapse to 12
                </Button>
              )}
              {lifecycleCaseLimit < desk.cases.length && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLifecycleCaseLimit((current) =>
                    Math.min(current + 12, desk.cases.length)
                  )}
                >
                  Show next {Math.min(12, desk.cases.length - lifecycleCaseLimit)}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="lifecycle-route-grid">
        {desk.routes.map((route) => (
          <div key={route.policy}>
            <Badge variant={route.humanDecisionRequired ? "shadow" : "muted"}>
              {route.policy.replaceAll("_", " ")}
            </Badge>
            <strong>{route.terminalAuthority.replaceAll("_", " ")}</strong>
            <span>{route.humanDecisionRequired ? "operator gate required" : "policy may route automatically"}</span>
            <small>LIVE EXECUTION · UNAVAILABLE</small>
          </div>
        ))}
      </div>

      <div className="case-authority-lock lifecycle-authority-lock">
        <CircleOff size={15} />
        <span>
          AI can create search leads but never certificates. Human approval in
          this lifecycle authorizes shadow execution only; no production order
          gateway exists in this product surface.
        </span>
      </div>
      </div>
      )}
    </section>
  );
}

function OpportunityRadarView() {
  const studioProjection = useStudioProjection();
  const radar =
    studioProjection.ai.opportunityRadar ?? EMPTY_OPPORTUNITY_RADAR;
  const [refreshStatus, setRefreshStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "FAILED"
  >("IDLE");
  const [triageStates, setTriageStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "RESTORED" | "FAILED">>
  >({});
  const [investigationStates, setInvestigationStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "RESTORED" | "FAILED">>
  >({});
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const retainedTaskIds = new Set(
    studioProjection.discoveryDesk.runs.map((run) => run.taskId),
  );
  const triagedCount = radar.candidates.filter((candidate) =>
    retainedTaskIds.has(candidate.triageTaskId),
  ).length;

  async function refreshRadar(): Promise<void> {
    setRefreshStatus("RUNNING");
    setDiagnostic(null);
    try {
      await requestCatalogRefresh();
      setRefreshStatus("DONE");
    } catch (error) {
      setRefreshStatus("FAILED");
      setDiagnostic(
        error instanceof Error ? error.message : "catalog refresh failed",
      );
    }
  }

  async function triage(candidate: RadarCandidate): Promise<void> {
    setTriageStates((current) => ({
      ...current,
      [candidate.candidateId]: "RUNNING",
    }));
    setDiagnostic(null);
    try {
      const restored = await requestRadarTriage(candidate.candidateId);
      setTriageStates((current) => ({
        ...current,
        [candidate.candidateId]: restored ? "RESTORED" : "DONE",
      }));
    } catch (error) {
      setTriageStates((current) => ({
        ...current,
        [candidate.candidateId]: "FAILED",
      }));
      setDiagnostic(
        error instanceof Error ? error.message : "radar triage failed",
      );
    }
  }

  async function investigate(candidate: RadarCandidate): Promise<void> {
    setInvestigationStates((current) => ({
      ...current,
      [candidate.candidateId]: "RUNNING",
    }));
    setDiagnostic(null);
    try {
      const restored = await requestRadarInvestigation(candidate.candidateId);
      setInvestigationStates((current) => ({
        ...current,
        [candidate.candidateId]: restored ? "RESTORED" : "DONE",
      }));
    } catch (error) {
      setInvestigationStates((current) => ({
        ...current,
        [candidate.candidateId]: "FAILED",
      }));
      setDiagnostic(
        error instanceof Error ? error.message : "radar investigation failed",
      );
    }
  }

  return (
    <section className="page-section radar-page">
      <div className="page-heading radar-heading">
        <div>
          <span className="eyebrow">Deterministic blocking · AI on demand</span>
          <h1>Opportunity radar</h1>
          <p>
            The control plane reduces fresh multi-venue catalogs into small,
            evidence-bound pairs before a cheap scout sees them. Similarity is
            a search filter—not semantic equivalence, profit, or a certificate.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={refreshStatus === "RUNNING"}
          onClick={() => void refreshRadar()}
        >
          <RefreshCw
            className={refreshStatus === "RUNNING" ? "is-spinning" : undefined}
            size={14}
          />
          {refreshStatus === "RUNNING"
            ? "Refreshing sources…"
            : refreshStatus === "DONE"
              ? "Sources refreshed"
              : refreshStatus === "FAILED"
                ? "Retry refresh"
                : "Refresh live radar"}
        </Button>
      </div>

      <div className="radar-summary-grid">
        <Metric
          label="Observed listings"
          value={`${radar.observedListingCount}`}
          detail="latest retained anonymous catalogs"
        />
        <Metric
          label="Fresh sources"
          value={`${radar.eligibleSourceCount}`}
          detail={`${radar.excludedSourceCount} excluded by freshness gate`}
        />
        <Metric
          label="Candidate pairs"
          value={`${radar.candidateCount}`}
          detail={`${radar.candidates.filter((candidate) => candidate.indicativeEconomics.status === "POSITIVE_GROSS_HINT").length} positive gross hints`}
        />
        <Metric
          label="Scout triage"
          value={`${triagedCount}`}
          detail="retained bounded runs"
        />
      </div>

      <div className="radar-method-strip">
        <Radar size={15} />
        <span>
          Rare-term weighted overlap · incompatible cadence and exact close
          times rejected · positive bigint gross hints ranked first · durable issue-local semantic rotation · maximum 25 pairs
        </span>
        <code>{radar.algorithmVersion}</code>
      </div>

      {diagnostic !== null && (
        <div className="radar-diagnostic" role="status">
          <CircleOff size={14} />
          <span>{diagnostic}</span>
        </div>
      )}

      {radar.candidates.length === 0 ? (
        <div className="radar-empty">
          <Radar size={28} />
          <strong>No fresh cross-venue blocks</strong>
          <span>
            Refresh the anonymous catalogs. Stale or failed sources are omitted,
            and a zero-result scan is valid.
          </span>
        </div>
      ) : (
        <div className="radar-candidate-grid">
          {radar.candidates.map((candidate, index) => {
            const localState = triageStates[candidate.candidateId];
            const retained = retainedTaskIds.has(candidate.triageTaskId);
            const running = localState === "RUNNING";
            const investigationState =
              investigationStates[candidate.candidateId];
            const investigationRecord =
              studioProjection.ai.investigationDesk.records.find(
                (record) => record.taskId === candidate.triageTaskId,
              );
            const investigating = investigationState === "RUNNING";
            return (
              <article className="radar-candidate" key={candidate.candidateId}>
                <div className="radar-candidate-head">
                  <div>
                    <span className="eyebrow">
                      Pair {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2>{candidate.sharedTerms.join(" · ")}</h2>
                  </div>
                  <div className="radar-score">
                    <strong>{similarityLabel(candidate.semanticScoreBps)}</strong>
                    <span>blocking score</span>
                  </div>
                </div>

                <div className="radar-pair">
                  {candidate.listings.map((listing, listingIndex) => (
                    <div className="radar-leg" key={listing.listingRef}>
                      <div>
                        <Badge variant={listingIndex === 0 ? "verified" : "shadow"}>
                          {listing.venueId}
                        </Badge>
                        <span>{listing.mechanism.replaceAll("_", " ")}</span>
                      </div>
                      <strong>{listing.title}</strong>
                      <code>{listing.listingRef}</code>
                      <small>
                        <Fingerprint size={10} />
                        {listing.sourceRawHash.slice(0, 22)}… ·{" "}
                        {new Date(listing.sourceReceivedAt).toLocaleTimeString()}
                      </small>
                      {listingIndex === 0 && (
                        <span className="radar-pair-link" aria-hidden="true">
                          <ChevronRight size={14} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="radar-temporal-strip">
                  <div>
                    <Activity size={13} />
                    <span>{candidate.timeframe ?? "No cadence extracted"}</span>
                  </div>
                  <div>
                    <Badge
                      variant={
                        candidate.temporalAlignment === "ALIGNED"
                          ? "verified"
                          : "warning"
                      }
                    >
                      {candidate.temporalAlignment}
                    </Badge>
                    <code>
                      {candidate.effectiveCloseAt ?? "close unresolved"}
                    </code>
                  </div>
                </div>

                <div className="radar-temporal-strip" aria-label="Indicative pair economics">
                  <div>
                    <Gauge size={13} />
                    <span>{candidate.indicativeEconomics.portfolioLabel ?? "Canonical price pair unavailable"}</span>
                  </div>
                  <div>
                    <Badge
                      variant={candidate.indicativeEconomics.status === "POSITIVE_GROSS_HINT" ? "verified" : candidate.indicativeEconomics.status === "NON_POSITIVE_GROSS_HINT" ? "muted" : "warning"}
                    >
                      {candidate.indicativeEconomics.status.replaceAll("_", " ")}
                    </Badge>
                    <code>
                      {candidate.indicativeEconomics.grossEdgeBpsFloor === null
                        ? "price unavailable"
                        : `${candidate.indicativeEconomics.grossEdgeBpsFloor} bps before fees/depth`}
                    </code>
                  </div>
                </div>

                <div className="radar-action-row">
                  <div>
                    <ShieldCheck size={14} />
                    <span>
                      Exact two-listing context · proposal only · no auto spend
                    </span>
                  </div>
                  <div className="radar-action-buttons">
                    <Button
                      disabled={running || studioProjection.ai.activeRuns > 0}
                      onClick={() => void triage(candidate)}
                    >
                      {running ? (
                        <RefreshCw className="is-spinning" size={14} />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {running
                        ? "Scouts triaging…"
                        : localState === "DONE"
                          ? "Triage complete"
                          : localState === "RESTORED" || retained
                            ? "Restore scout result"
                            : localState === "FAILED"
                              ? "Retry scout triage"
                              : "Triage with fast scouts"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        !retained ||
                        !studioProjection.ai.investigator.configured ||
                        studioProjection.ai.investigationDesk.activeCount > 0 ||
                        investigating
                      }
                      onClick={() => void investigate(candidate)}
                    >
                      {investigating ? (
                        <RefreshCw className="is-spinning" size={14} />
                      ) : (
                        <SquareTerminal size={14} />
                      )}
                      {investigating
                        ? "pi investigating…"
                        : investigationState === "DONE"
                          ? "pi complete"
                          : investigationState === "RESTORED" ||
                              investigationRecord?.status === "PASS"
                            ? "Restore pi report"
                            : investigationState === "FAILED" ||
                                investigationRecord?.status === "FAILED"
                              ? "Retry deep pi"
                              : "Run deep pi"}
                    </Button>
                  </div>
                </div>
                <code className="radar-candidate-id">
                  {candidate.candidateId}
                </code>
              </article>
            );
          })}
        </div>
      )}

      <div className="case-authority-lock radar-authority-lock">
        <CircleOff size={15} />
        <span>
          Radar candidates are workload routing hints. They cannot establish
          equivalent rules, compute executable profit, enter review, publish a
          certificate, or grant execution authority.
        </span>
      </div>
    </section>
  );
}

function standingRouteStateLabel(state: StandingRouteState): string {
  switch (state) {
    case "QUIESCENT": return "Watching quietly";
    case "EXPANDED": return "New member found";
    case "CHANGED": return "Contract changed";
    case "CONTRACTED": return "Member disappeared";
    case "BLOCKED_TOO_BROAD": return "Scope too broad";
  }
}

function standingRouteUsageTokens(usage: StandingRouteUsage | undefined): string {
  if (usage === undefined) return "0";
  try {
    return (
      BigInt(usage.knownInputTokens) + BigInt(usage.knownOutputTokens) +
      BigInt(usage.knownReasoningTokens)
    ).toString();
  } catch {
    return "0";
  }
}

function StandingRouteMemory({ revision }: { revision: string }) {
  const workspace = useStandingRouteWorkspace(revision);
  const data = workspace.data?.desk ?? null;
  const seedPreview = workspace.data?.seedPortfolio.preview ?? null;
  const seedPortfolio = seedPreview?.status === "AVAILABLE" ? seedPreview.data : null;
  const seedOutcomes = workspace.data?.seedPortfolio.outcomes ?? null;
  const families = data === null ? [] : [...data.families].sort((left, right) => {
    const leftValue = data.value.values.find((item) =>
      item.routeFamilyId === left.family.routeFamilyId
    );
    const rightValue = data.value.values.find((item) =>
      item.routeFamilyId === right.family.routeFamilyId
    );
    return Number(right.observation.followupEligible) - Number(left.observation.followupEligible) ||
      (rightValue?.observedWakeCount ?? 0) - (leftValue?.observedWakeCount ?? 0) ||
      left.family.routeFamilyId.localeCompare(right.family.routeFamilyId);
  });
  const historicalWakes = data?.value.values.reduce((sum, item) =>
    sum + item.observedWakeCount, 0) ?? 0;
  const totalKnownTokens = data === null
    ? "0"
    : standingRouteUsageTokens({
        ...data.value.totalCreationUsage,
        knownInputTokens: (
          BigInt(data.value.totalCreationUsage.knownInputTokens) +
          BigInt(data.value.totalFollowupUsage.knownInputTokens)
        ).toString(),
        knownOutputTokens: (
          BigInt(data.value.totalCreationUsage.knownOutputTokens) +
          BigInt(data.value.totalFollowupUsage.knownOutputTokens)
        ).toString(),
        knownReasoningTokens: (
          BigInt(data.value.totalCreationUsage.knownReasoningTokens) +
          BigInt(data.value.totalFollowupUsage.knownReasoningTokens)
        ).toString(),
      });

  return (
    <section className="standing-route-memory" aria-label="Standing semantic route memory">
      <div className="standing-route-memory-heading">
        <div>
          <span className="eyebrow">Ontology memory · wakes on market novelty</span>
          <h2>Standing search routes</h2>
          <p>
            Agent-authored search neighborhoods that wait for matching contracts to
            appear or materially change. A wake is research supply—not an opportunity.
          </p>
        </div>
        <div className="standing-route-memory-heading-meta">
          <Badge variant={data !== null && data.followupEligibleFamilyCount > 0 ? "warning" : "muted"}>
            {workspace.loading
              ? data === null ? "SYNCING" : "REVALIDATING"
              : `${data?.followupEligibleFamilyCount ?? 0} WAKING NOW`}
          </Badge>
          <Button variant="outline" size="sm" disabled={workspace.loading} onClick={() => void workspace.refresh()}>
            {workspace.loading ? <RefreshCw className="is-spinning" size={13} /> : <RefreshCw size={13} />}
            Refresh memory
          </Button>
        </div>
      </div>

      <div className="standing-route-seed-portfolio">
        <div className="standing-route-seed-heading">
          <div>
            <span className="eyebrow">Agent attention · one candidate per ontology layer</span>
            <h3>Next route seeds</h3>
            <p>
              A bounded portfolio of search hypotheses. Each Agent may author only its
              assigned layer or retain a counterexample; payoff findings are disabled.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={workspace.loading || workspace.preparing ||
              !seedPortfolio?.creationEligible}
            onClick={() => void workspace.prepare()}
          >
            {workspace.preparing
              ? <RefreshCw className="is-spinning" size={13} />
              : <Waypoints size={13} />}
            Prepare paused campaign
          </Button>
        </div>
        {workspace.loading && seedPreview === null ? (
          <div className="standing-route-seed-state">
            <LoaderCircle className="is-spinning" size={15} />
            <span>Selecting without calling a model…</span>
          </div>
        ) : seedPortfolio !== null ? (
          <>
            <div className="standing-route-seed-grid">
              {(["SUBJECT_REFERENCE", "EVENT_REFERENCE", "SETTLEMENT_REFERENCE"] as const)
                .map((layer) => {
                  const candidate = seedPortfolio.selection.selected.find((item) =>
                    item.targetRouteLayer === layer
                  );
                  const outcome = seedOutcomes?.strata.find((item) =>
                    item.targetRouteLayer === layer
                  );
                  return (
                    <div className={candidate === undefined ? "is-empty" : ""} key={layer}>
                      <span>{layer.replaceAll("_", " ").toLowerCase()}</span>
                      <strong>{candidate === undefined ? "Capacity unused" : "Seed selected"}</strong>
                      <small>{outcome !== undefined &&
                          outcome.conflictingTerminalEffectActionCount > 0
                        ? `${outcome.conflictingTerminalEffectActionCount} conflicting terminal · excluded from clean yield`
                        : candidate === undefined
                          ? outcome === undefined
                            ? "No honest uncovered candidate"
                            : `${outcome.terminalActionCount}/3 terminal attempts retained`
                          : `${candidate.seedListingEvidenceCount} seed evidence · priority ${candidate.sourcePriority}`}</small>
                    </div>
                  );
                })}
            </div>
            <p className="standing-route-seed-diagnostic">
              {workspace.diagnostic ?? seedPortfolio.diagnostic}
              {seedOutcomes !== null
                ? ` · recurrence ${seedOutcomes.recurrenceQualification.qualifiedLayerCount}/3 layers qualified`
                : ""}
            </p>
          </>
        ) : (
          <p className="standing-route-seed-diagnostic is-error">
            {workspace.diagnostic ?? (seedPreview?.status === "UNAVAILABLE"
              ? seedPreview.diagnostic
              : "Seed portfolio unavailable")}
          </p>
        )}
      </div>

      {workspace.diagnostic !== null && data === null ? (
        <div className="standing-route-memory-state" role="status">
          <CircleOff size={16} />
          <div><strong>Route memory unavailable</strong><span>{workspace.diagnostic}</span></div>
        </div>
      ) : workspace.loading && data === null ? (
        <div className="standing-route-memory-state">
          <LoaderCircle className="is-spinning" size={16} />
          <div><strong>Reading lifecycle memory</strong><span>No Agent or model call is started by this read.</span></div>
        </div>
      ) : data !== null && families.length === 0 ? (
        <div className="standing-route-memory-state">
          <Waypoints size={17} />
          <div><strong>No standing routes yet</strong><span>A relation Agent can retain one through the route tool when a reusable search neighborhood appears.</span></div>
        </div>
      ) : data !== null ? (
        <>
          <div className="standing-route-memory-summary">
            <div><strong>{data.familyCount}</strong><span>route families</span></div>
            <div><strong>{data.observationEpisodeCount}</strong><span>durable transitions</span></div>
            <div><strong>{historicalWakes}</strong><span>historical wakes</span></div>
            <div><strong>{formatTokenCount(totalKnownTokens)}</strong><span>known lifecycle tokens</span></div>
          </div>
          <div className="standing-route-family-list">
            {families.map(({ family, observation }) => {
              const value = data.value.values.find((item) =>
                item.routeFamilyId === family.routeFamilyId
              );
              const episodes = data.observationEpisodes.filter((item) =>
                item.routeFamilyId === family.routeFamilyId
              );
              const downstreamCount = (value?.positiveFindingIds.length ?? 0) +
                (value?.counterexampleIds.length ?? 0) +
                (value?.semanticReviewJobIds.length ?? 0) +
                (value?.probabilityJobIds.length ?? 0) +
                (value?.opportunityIds.length ?? 0);
              const currentChangeCount = observation.addedListingRefs.length +
                observation.removedListingRefs.length + observation.changedListingRefs.length;
              const selection = data.selection.selections.find((item) =>
                item.routeFamilyId === family.routeFamilyId
              );
              return (
                <article className="standing-route-family" key={family.routeFamilyId}>
                  <div className="standing-route-family-main">
                    <div className="standing-route-family-state">
                      <Badge variant={
                        observation.state === "EXPANDED" || observation.state === "CHANGED"
                          ? "warning"
                          : observation.state === "QUIESCENT" ? "verified" : "muted"
                      }>
                        {standingRouteStateLabel(observation.state)}
                      </Badge>
                      <span>{family.routeLayer.replaceAll("_", " ").toLowerCase()}</span>
                      {selection !== undefined ? (
                        <Badge variant={selection.recommendation === "ADOPT"
                          ? "verified"
                          : selection.recommendation === "RETIRE" ? "warning" : "muted"}>
                          {selection.recommendation}
                        </Badge>
                      ) : null}
                    </div>
                    <h3>{family.canonicalSearchSignals.join(" · ")}</h3>
                    <p>
                      {observation.currentListingRefs.length} matching contract{observation.currentListingRefs.length === 1 ? "" : "s"}
                      {currentChangeCount > 0 ? ` · ${currentChangeCount} current change${currentChangeCount === 1 ? "" : "s"}` : " · no material change"}
                      {family.sourceCount > 1 ? ` · ${family.sourceCount} independent sources` : " · one retained source"}
                    </p>
                    <ol className="standing-route-timeline" aria-label={`${family.canonicalSearchSignals.join(" ")} lifecycle`}>
                      {episodes.slice(-6).map((episode) => (
                        <li className={`state-${episode.state.toLowerCase().replaceAll("_", "-")}`} key={episode.episodeId}>
                          <i />
                          <div>
                            <strong>{standingRouteStateLabel(episode.state)}</strong>
                            <time>{new Date(episode.observedAt).toLocaleString()}</time>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {selection !== undefined ? (
                      <div className="standing-route-selection-note">
                        <strong>{selection.rationale}</strong>
                        <span>
                          {selection.missingObservation === null
                            ? selection.nextReviewTrigger
                            : `Missing: ${selection.missingObservation}`}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="standing-route-family-value">
                    <div>
                      <span>Current quiet</span>
                      <strong>{formatDurationMs(value?.quietDurationMs ?? null)}</strong>
                    </div>
                    <div>
                      <span>Wake history</span>
                      <strong>{value?.observedWakeCount ?? 0}</strong>
                    </div>
                    <div>
                      <span>Authoring cost</span>
                      <strong>{formatTokenCount(standingRouteUsageTokens(value?.creationUsage))}</strong>
                      <small>{value?.creationUsage.invocationCount ?? 0} model calls</small>
                    </div>
                    <div>
                      <span>Wake cost</span>
                      <strong>{formatTokenCount(standingRouteUsageTokens(value?.followupUsage))}</strong>
                      <small>{value?.followupRunIds.length ?? 0} runs</small>
                    </div>
                    <div className="standing-route-yield">
                      <span>Retained yield</span>
                      <strong>{downstreamCount === 0 ? "None yet" : `${downstreamCount} artifacts`}</strong>
                      <small>{value?.valueStage.replaceAll("_", " ").toLowerCase() ?? "memory only"}</small>
                    </div>
                  </div>
                  <details className="standing-route-family-evidence">
                    <summary>Exact route evidence</summary>
                    <div>
                      <span>Current members</span>
                      <code>{observation.currentListingRefs.join(" · ") || "none"}</code>
                    </div>
                    <div>
                      <span>Family identity</span>
                      <code>{family.routeFamilyId}</code>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      <div className="standing-route-memory-boundary">
        <ShieldCheck size={14} />
        <span>Search routing only · descriptive attribution · no automatic dispatch · no trading authority</span>
      </div>
    </section>
  );
}

function ScoutInboxView({
  onOpenReview,
}: {
  onOpenReview: (proposalIds: readonly string[]) => void;
}) {
  const studioProjection = useStudioProjection();
  const scheduler = studioProjection.ai.searchLeaseScheduler ?? EMPTY_SEARCH_LEASE_SCHEDULER;
  const economicTriage =
    studioProjection.ai.proposalEconomicTriage ?? EMPTY_PROPOSAL_ECONOMIC_TRIAGE;
  const opportunityFrontier = buildOpportunityFrontier(economicTriage);
  const catalogContext =
    studioProjection.ai.catalogContext ?? EMPTY_CATALOG_CONTEXT;
  const catalogObservation = studioProjection.ai.catalogObservation;
  const eligibleVenues = studioProjection.venues.filter((venue) =>
    venue.capabilities.includes("MARKET_CATALOG"),
  );
  const [question, setQuestion] = useState("");
  const [selectedVenueIds, setSelectedVenueIds] = useState<readonly string[]>([
    "gemini-predictions",
  ]);
  const [catalogMode, setCatalogMode] = useState<CatalogMode>(
    "VERIFIED_FIXTURES",
  );
  const [runStatus, setRunStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "PARTIAL" | "RESTORED" | "FAILED"
  >("IDLE");
  const [investigationStatus, setInvestigationStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [investigationDiagnostic, setInvestigationDiagnostic] = useState<
    string | null
  >(null);
  const [findingFilter, setFindingFilter] = useState<
    "ATTENTION" | "POSITIVE" | "NEGATIVE" | "ALL"
  >("ATTENTION");
  const [findingAction, setFindingAction] = useState<string | null>(null);
  const [findingDiagnostic, setFindingDiagnostic] = useState<string | null>(null);
  const [explorationStatus, setExplorationStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const discoveryExecution = useDiscoveryExecutionCapability();
  const discoveryCapability = discoveryExecution.data?.capability;
  const discoveryRuntime = discoveryExecution.data?.runtime;
  const discoveryModel = discoveryExecution.data?.model;
  const liveContextEligible =
    catalogMode === "VERIFIED_FIXTURES" ||
    selectedVenueIds.every(
      (venueId) =>
        catalogObservation.sources.find((source) => source.venueId === venueId)
          ?.contextEligible === true,
    );
  const visibleFindings = scheduler.findingInbox.filter((item) => {
    if (findingFilter === "ALL") return true;
    if (findingFilter === "ATTENTION") return item.attentionRequired;
    if (findingFilter === "POSITIVE") {
      return item.kinds.includes("LEAD") || item.disposition === "PROPOSAL_AVAILABLE";
    }
    return item.kinds.includes("FALSIFIED") || item.disposition === "NO_LEAD";
  });
  const attentionCount = scheduler.findingInbox.filter((item) => item.attentionRequired).length;
  const proposalCount = scheduler.findingInbox.filter(
    (item) => item.disposition === "PROPOSAL_AVAILABLE",
  ).length;
  const negativeCount = scheduler.findingInbox.filter(
    (item) => item.kinds.includes("FALSIFIED"),
  ).length;
  const retryCount = scheduler.findingInbox.filter((item) => item.retryAvailable).length;

  async function exploreNext(): Promise<void> {
    setExplorationStatus("RUNNING");
    setFindingDiagnostic(null);
    try {
      const restored = await requestSearchLease();
      setExplorationStatus(restored ? "RESTORED" : "DONE");
    } catch (error) {
      setExplorationStatus("FAILED");
      setFindingDiagnostic(error instanceof Error ? error.message : "search lease failed");
    }
  }

  async function retryFinding(leaseId: string): Promise<void> {
    setFindingAction(leaseId);
    setFindingDiagnostic(null);
    try {
      await requestSearchDeepRetry(leaseId);
    } catch (error) {
      setFindingDiagnostic(error instanceof Error ? error.message : "deep retry failed");
    } finally {
      setFindingAction(null);
    }
  }

  function toggleVenue(venueId: string): void {
    setSelectedVenueIds((current) =>
      current.includes(venueId)
        ? current.filter((item) => item !== venueId)
        : [...current, venueId],
    );
  }

  async function submitScout(): Promise<void> {
    setRunStatus("RUNNING");
    try {
      const result = await requestDiscoveryRun(
        question.trim(),
        selectedVenueIds,
        catalogMode,
      );
      setRunStatus(result.partial ? "PARTIAL" : result.restored ? "RESTORED" : "DONE");
    } catch {
      setRunStatus("FAILED");
    }
  }

  async function submitInvestigation(): Promise<void> {
    setInvestigationStatus("RUNNING");
    setInvestigationDiagnostic(null);
    try {
      const restored = await requestInvestigation(
        question.trim(),
        selectedVenueIds,
        catalogMode,
      );
      setInvestigationStatus(restored ? "RESTORED" : "DONE");
    } catch (error) {
      setInvestigationStatus("FAILED");
      setInvestigationDiagnostic(
        error instanceof Error ? error.message : "pi investigation failed",
      );
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading scout-heading">
        <div>
          <span className="eyebrow">Durable search effects · operator attention</span>
          <h1>Finding inbox</h1>
          <p>
            See what scheduled Agents found before inventing another question.
            Priority means required workflow attention—not confidence, profit,
            or permission to trade.
          </p>
        </div>
        <div className="archaeology-heading-badges">
          <Badge variant={discoveryCapability?.dispatchEligibility === "ELIGIBLE" ? "verified" : "warning"}>
            {discoveryRuntime?.kind?.replace("HARNESS_IN_PROCESS", "In-process") ?? "Runtime"}
            {" · "}{discoveryModel?.model ?? "loading"}
            {" · "}{discoveryCapability?.serviceCapability ?? "UNVERIFIED"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={discoveryExecution.data === null || discoveryExecution.preflightBusy}
            onClick={() => void discoveryExecution.preflight()}
          >
            {discoveryExecution.preflightBusy ? <RefreshCw className="is-spinning" size={13} /> : <ShieldCheck size={13} />}
            {discoveryCapability?.observation == null ? "Preflight" : "Recheck"}
          </Button>
          <Button
            disabled={
              scheduler.status === "RUNNING" ||
              explorationStatus === "RUNNING" ||
              discoveryCapability?.dispatchEligibility !== "ELIGIBLE"
            }
            onClick={() => void exploreNext()}
          >
            {explorationStatus === "RUNNING" ? (
              <RefreshCw className="is-spinning" size={13} />
            ) : (
              <Sparkles size={13} />
            )}
            {explorationStatus === "RUNNING"
              ? "Exploring…"
              : explorationStatus === "RESTORED"
                ? "Latest scan restored"
                : explorationStatus === "FAILED"
                  ? "Retry exploration"
                  : "Explore next"}
          </Button>
        </div>
      </div>

      {(discoveryExecution.diagnostic !== null || discoveryCapability?.dispatchEligibility === "BLOCKED") && (
        <div className="inline-alert" role="status">
          <CircleOff size={14} />
          {discoveryExecution.diagnostic ?? `Discovery is blocked before model spend: ${discoveryCapability?.diagnostic ?? "run a capability preflight"}`}
        </div>
      )}

      <div className="finding-inbox-summary" aria-label="Finding inbox summary">
        <Metric label="Needs attention" value={`${attentionCount}`} detail="retry, review, or inspect" />
        <Metric label="Proposals" value={`${proposalCount}`} detail="Pi artifacts available" />
        <Metric label="Deep retries" value={`${retryCount}`} detail="fast result preserved" />
        <Metric label="Negative evidence" value={`${negativeCount}`} detail="reusable falsifications" />
      </div>

      <StandingRouteMemory revision={studioProjection.identity.viewHash} />

      <section className="opportunity-frontier" aria-label="Current opportunity frontier">
        <div className="opportunity-frontier-heading">
          <div>
            <span className="eyebrow">Current contracts · pre-fee research leads</span>
            <h2>Opportunity frontier</h2>
            <p>
              Price-positive semantic candidates worth inspecting now. Gross
              edge is only a routing hint until review, fees, and depth pass.
            </p>
          </div>
          <div>
            <Badge variant={opportunityFrontier.visibleUniqueCount > 0 ? "verified" : "muted"}>
              {opportunityFrontier.visibleUniqueCount} UNIQUE SHOWN
            </Badge>
            <span>
              {opportunityFrontier.rawPositiveCount} raw · {opportunityFrontier.collapsedVisibleCount} collapsed
              {opportunityFrontier.omittedRawPositiveCount > 0
                ? ` · ${opportunityFrontier.omittedRawPositiveCount} outside view`
                : ""}
            </span>
          </div>
        </div>
        {opportunityFrontier.items.length === 0 ? (
          <div className="opportunity-frontier-empty">
            <Gauge size={18} />
            <div>
              <strong>No current price-positive candidates</strong>
              <span>Scheduled search continues; negative and unpriced findings remain retained below.</span>
            </div>
          </div>
        ) : (
          <div className="opportunity-frontier-grid">
            {opportunityFrontier.items.map((item) => (
              <article key={item.itemId}>
                <div className="opportunity-frontier-card-head">
                  <div className="opportunity-frontier-edge">
                    <strong>+{item.indicativeEconomics.grossEdgeBpsFloor ?? "—"}</strong>
                    <span>bps gross</span>
                  </div>
                  <div>
                    <Badge variant="verified">PRICE POSITIVE</Badge>
                    <Badge variant="muted">{item.relationKind.replaceAll("_", " ")}</Badge>
                    {item.collapsedProposalCount > 0 && (
                      <Badge variant="muted">
                        {item.collapsedProposalCount} VARIANT{item.collapsedProposalCount === 1 ? "" : "S"} COLLAPSED
                      </Badge>
                    )}
                  </div>
                </div>
                <h3 title={item.statement}>{item.statement}</h3>
                <div className="opportunity-frontier-facts">
                  <span>{item.currentContractMatchCount}/{item.listingRefs.length} current contracts</span>
                  <span>{item.issueIds.length} search issue{item.issueIds.length === 1 ? "" : "s"}</span>
                  <span>P{item.effectivePriority} review priority</span>
                </div>
                <code>{item.listingRefs.join(" ↔ ")}</code>
                <div className="opportunity-frontier-card-foot">
                  <span>Needs semantic review · fees · depth</span>
                  <Button size="sm" onClick={() => onOpenReview([item.proposalId])}>
                    <GitBranch size={13} /> Inspect proposal
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        {opportunityFrontier.windowed && (
          <div className="opportunity-frontier-window-note" role="status">
            <CircleOff size={14} />
            <span>
              {opportunityFrontier.omittedRawPositiveCount} additional raw positive hint{opportunityFrontier.omittedRawPositiveCount === 1 ? " is" : "s are"} outside the bounded live view; uniqueness is not guessed without exact relation and contract identities.
            </span>
          </div>
        )}
      </section>

      <section className="finding-inbox" aria-label="Durable finding inbox">
        <div className="finding-inbox-toolbar">
          <div>
            <strong>Scheduled findings</strong>
            <span>{scheduler.findingInbox.length} retained · source-bound to search leases</span>
          </div>
          <div className="finding-filter" role="group" aria-label="Filter findings">
            {(["ATTENTION", "POSITIVE", "NEGATIVE", "ALL"] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={findingFilter === filter ? "default" : "ghost"}
                onClick={() => setFindingFilter(filter)}
              >
                {filter === "ATTENTION" ? `Attention ${attentionCount}` : filter.toLowerCase()}
              </Button>
            ))}
          </div>
        </div>
        {visibleFindings.length === 0 ? (
          <div className="finding-inbox-empty">
            <BadgeCheck size={18} />
            <div>
              <strong>No findings in this view</strong>
              <span>Choose another filter or explore the next market neighborhood.</span>
            </div>
          </div>
        ) : (
          <div className="finding-inbox-list">
            {visibleFindings.map((item) => {
              return (
                <article className={cn("finding-inbox-item", `priority-${item.priority.toLowerCase()}`)} key={item.leaseId}>
                  <div className="finding-inbox-item-head">
                    <div>
                      <Badge variant={item.priority === "HIGH" ? "warning" : item.priority === "MEDIUM" ? "shadow" : "muted"}>
                        {item.disposition.replaceAll("_", " ")}
                      </Badge>
                      {item.kinds.map((kind) => (
                        <Badge key={kind} variant={kind === "LEAD" ? "verified" : kind === "FALSIFIED" ? "warning" : "muted"}>
                          {kind.replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </div>
                    <time>{new Date(item.occurredAt).toLocaleString()}</time>
                  </div>
                  <h2>{item.thesis}</h2>
                  <div className="finding-inbox-context">
                    <span>{item.discoveryMode === "HEURISTIC_EXPLORATION" ? "Heuristic exploration" : "Claim monitoring"}</span>
                    <span>{item.semanticFamily?.replaceAll("_", " ") ?? item.lens}</span>
                    {item.relationKind !== null && <span>{item.relationKind.replaceAll("_", " ")}</span>}
                    <span>{item.proposalIds.length} proposals · {item.evidenceGapCount} gaps · {item.deepAttemptCount} Pi attempts</span>
                  </div>
                  {item.candidateListingRefs.length > 0 && (
                    <code>{item.candidateListingRefs.join(" · ")}</code>
                  )}
                  <div className="finding-inbox-actions">
                    {item.retryAvailable && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={findingAction !== null}
                        onClick={() => void retryFinding(item.leaseId)}
                      >
                        {findingAction === item.leaseId ? <RefreshCw className="is-spinning" size={13} /> : <SquareTerminal size={13} />}
                        Retry Pi only
                      </Button>
                    )}
                    {item.disposition === "PROPOSAL_AVAILABLE" && (
                      <Button size="sm" onClick={() => onOpenReview(item.proposalIds)}>
                        <GitBranch size={13} /> Review {item.proposalIds.length} proposal{item.proposalIds.length === 1 ? "" : "s"}
                      </Button>
                    )}
                    <code title={item.sourceArtifactHash}>source {item.sourceArtifactHash.slice(7, 17)}</code>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {findingDiagnostic !== null && (
        <div className="radar-diagnostic" role="status"><CircleOff size={14} /><span>{findingDiagnostic}</span></div>
      )}

      <details className="ad-hoc-workbench">
        <summary>
          <div>
            <strong>Ad-hoc investigation</strong>
            <span>Ask a bounded question only when you already have one to test.</span>
          </div>
          <ChevronRight size={16} />
        </summary>
        <div className="ad-hoc-workbench-body">
          <div className="ad-hoc-workbench-intro">
            <span className="eyebrow">Secondary claim-monitoring tool</span>
            <p>
              Cheap workers can test an operator hypothesis against selected
              catalogs. This does not redefine the primary discovery funnel.
            </p>
          </div>

      <div className="scout-summary-grid">
        <Metric
          label="Retained runs"
          value={`${studioProjection.discoveryDesk.runCount}`}
          detail={`bounded to ${studioProjection.discoveryDesk.retentionLimit}`}
        />
        <Metric
          label="Hypotheses"
          value={`${studioProjection.discoveryDesk.hypothesisCount}`}
          detail="deduplicated per run"
        />
        <Metric
          label="Awaiting review"
          value={`${studioProjection.discoveryDesk.unreviewedCount}`}
          detail="independent authority required"
        />
        <Metric
          label="Falsified leads"
          value={`${studioProjection.discoveryDesk.falsificationCount}`}
          detail="search feedback · never proposals"
        />
        <Metric
          label="Catalog facts"
          value={`${catalogContext.listingCount}`}
          detail={`${catalogContext.venueCount} venues · verified fixtures`}
        />
        <Metric
          label="Live observed"
          value={`${catalogObservation.listingCount}`}
          detail={`${catalogObservation.contextQualification.eligibleSourceCount}/${catalogObservation.sourceCount} context eligible · explicit only`}
        />
        <Metric
          label="State store"
          value={studioProjection.discoveryDesk.storage.durable ? "WAL" : "MEM"}
          detail={
            studioProjection.discoveryDesk.storage.durable
              ? `schema v${studioProjection.discoveryDesk.storage.schemaVersion} · taskId idempotency`
              : "ephemeral test process"
          }
        />
        <Metric
          label="Deep reports"
          value={`${studioProjection.ai.investigationDesk.passCount}`}
          detail={`${studioProjection.ai.investigationDesk.activeCount} running · ${studioProjection.ai.investigationDesk.storage.durable ? "durable WAL" : "memory only"}`}
        />
      </div>

      <Card className="review-pipeline-card">
        <CardHeader>
          <div>
            <span className="eyebrow">Promotion contract · fixture-qualified</span>
            <h2>Review → compiler → exact verifier</h2>
          </div>
          <Badge variant="verified">
            {studioProjection.qualification.reviewedCompilation.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="review-pipeline-flow">
            {studioProjection.qualification.reviewedCompilation.stages.map(
              (stage, index) => (
                <div className="review-pipeline-stage" key={stage.stage}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{stage.stage.replaceAll("_", " ")}</strong>
                    <small>{stage.detail}</small>
                  </div>
                  <Badge
                    variant={stage.status === "PASS" ? "verified" : "shadow"}
                  >
                    {stage.status}
                  </Badge>
                </div>
              ),
            )}
          </div>
          <div className="review-pipeline-note">
            <TestTubeDiagonal size={14} />
            <span>
              This path is exercised with a synthetic, hash-bound qualification
              fixture. Runtime scout hypotheses remain locked until a real
              equivalence-review authority and official matching fixtures exist.
            </span>
            <code>
              {studioProjection.qualification.reviewedCompilation.artifactHash}
            </code>
          </div>
        </CardContent>
      </Card>

      <div className="scout-layout">
        <Card className="scout-compose-card">
          <CardHeader>
            <div>
              <span className="eyebrow">New bounded task</span>
              <h2>Ask the scout pool</h2>
            </div>
            <Badge variant="shadow">No execution</Badge>
          </CardHeader>
          <CardContent>
            <label className="scout-question">
              <span>Research question</span>
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Describe the hypothesis or constraint you want the Agent to test…"
                maxLength={500}
                rows={5}
              />
              <small>{question.length} / 500</small>
            </label>
            <fieldset className="venue-selector evidence-selector">
              <legend>Catalog evidence source</legend>
              <div>
                <button
                  type="button"
                  className={cn(
                    catalogMode === "VERIFIED_FIXTURES" && "is-selected",
                  )}
                  onClick={() => setCatalogMode("VERIFIED_FIXTURES")}
                >
                  <FileCheck2 size={12} />
                  Verified fixtures · default
                </button>
                <button
                  type="button"
                  className={cn(
                    catalogMode === "CURRENT_OBSERVATIONS" && "is-selected",
                  )}
                  onClick={() => setCatalogMode("CURRENT_OBSERVATIONS")}
                >
                  <Radio size={12} />
                  Current observations · explicit
                </button>
              </div>
            </fieldset>
            <fieldset className="venue-selector">
              <legend>Search venue catalogs</legend>
              <div>
                {eligibleVenues.map((venue) => (
                  <button
                    type="button"
                    className={cn(
                      selectedVenueIds.includes(venue.id) && "is-selected",
                    )}
                    key={venue.id}
                    onClick={() => toggleVenue(venue.id)}
                  >
                    <i style={{ backgroundColor: venue.color }} />
                    {venue.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="scout-action-stack">
              <Button
                className="scout-submit"
                disabled={
                  runStatus === "RUNNING" ||
                  question.trim() === "" ||
                  selectedVenueIds.length === 0 ||
                  !liveContextEligible
                }
                onClick={() => void submitScout()}
              >
                <Send size={14} />
                {runStatus === "RUNNING"
                  ? "Scouts running…"
                  : runStatus === "DONE"
                    ? "Run another scout"
                    : runStatus === "PARTIAL"
                      ? "Partial result · inspect trace"
                    : runStatus === "RESTORED"
                      ? "Restored existing run"
                      : runStatus === "FAILED"
                        ? "Retry scout"
                        : "Run bounded scout"}
              </Button>
              <Button
                variant="outline"
                disabled={
                  !studioProjection.ai.investigator.configured ||
                  studioProjection.ai.investigationDesk.activeCount > 0 ||
                  investigationStatus === "RUNNING" ||
                  question.trim() === "" ||
                  selectedVenueIds.length === 0 ||
                  !liveContextEligible
                }
                onClick={() => void submitInvestigation()}
              >
                {investigationStatus === "RUNNING" ||
                studioProjection.ai.investigationDesk.activeCount > 0 ? (
                  <RefreshCw className="is-spinning" size={14} />
                ) : (
                  <SquareTerminal size={14} />
                )}
                {!studioProjection.ai.investigator.configured
                  ? "Deep investigator needs key"
                  : investigationStatus === "RUNNING" ||
                      studioProjection.ai.investigationDesk.activeCount > 0
                    ? "pi investigating…"
                    : investigationStatus === "DONE"
                      ? "Run another investigation"
                      : investigationStatus === "RESTORED"
                        ? "Restored existing report"
                        : investigationStatus === "FAILED"
                          ? "Retry investigation"
                          : "Run deep investigation"}
              </Button>
            </div>
            <div className="investigation-note">
              <SquareTerminal size={14} />
              <span>
                One read-only pi task at a time · allow up to five minutes ·
                completed reports are{" "}
                {studioProjection.ai.investigationDesk.storage.durable
                  ? "hash-checked and retained in SQLite WAL"
                  : "retained in process memory only"}
                .
                {investigationDiagnostic !== null && (
                  <strong>{investigationDiagnostic}</strong>
                )}
                {!liveContextEligible && (
                  <strong>
                    Selected live source is stale, empty, or failed; refresh it
                    before running AI.
                  </strong>
                )}
              </span>
            </div>
            <div className="scout-guardrail">
              <ShieldCheck size={15} />
              <span>{studioProjection.ai.promotionBoundary}</span>
            </div>
          </CardContent>
        </Card>

        <div className="scout-results-stack">
          <div className="investigation-desk">
            <div className="scout-run-heading">
              <div>
                <span className="eyebrow">Read-only agent lane</span>
                <h2>pi investigation desk</h2>
              </div>
              <div className="investigation-desk-status">
                <Badge
                  variant={
                    studioProjection.ai.investigationDesk.activeCount > 0
                      ? "shadow"
                      : "muted"
                  }
                >
                  {studioProjection.ai.investigationDesk.activeCount > 0
                    ? "RUNNING"
                    : `${studioProjection.ai.investigationDesk.passCount} PASS`}
                </Badge>
                <Badge variant="muted">
                  {studioProjection.ai.investigationDesk.storage.durable
                    ? `WAL v${studioProjection.ai.investigationDesk.storage.schemaVersion}`
                    : "MEMORY"}
                </Badge>
              </div>
            </div>
            {studioProjection.ai.investigationDesk.records.length === 0 ? (
              <div className="investigation-empty">
                No deep reports yet. This lane can read the bounded catalog and
                repository context, but cannot review or execute anything.
              </div>
            ) : (
              studioProjection.ai.investigationDesk.records.map((record) => (
                <article
                  className={cn(
                    "investigation-record",
                    `is-${record.status.toLowerCase()}`,
                  )}
                  key={record.investigationId}
                >
                  <div className="investigation-record-head">
                    <div>
                      <Badge
                        variant={record.status === "PASS" ? "verified" : "shadow"}
                      >
                        {record.status}
                      </Badge>
                      <Badge variant="muted">{record.authority}</Badge>
                      <Badge variant="muted">{record.reviewStatus}</Badge>
                      <Badge variant="muted">
                        {record.catalogContextSource ??
                          "VERIFIED_FIXTURE_CATALOGS"}
                      </Badge>
                    </div>
                    <time>{new Date(record.startedAt).toLocaleString()}</time>
                  </div>
                  <h3>{record.question}</h3>
                  {record.status === "RUNNING" && (
                    <p className="investigation-progress">
                      <RefreshCw className="is-spinning" size={13} />
                      pi is reading bounded evidence and composing a final report…
                    </p>
                  )}
                  {record.status === "FAILED" && (
                    <p className="investigation-diagnostic">
                      {record.diagnostic ?? "pi investigator failed"}
                    </p>
                  )}
                  {record.report !== null && (
                    <>
                      <p className="investigation-summary">
                        {record.report.result.summary}
                      </p>
                      <dl className="investigation-findings">
                        <div>
                          <dt>Candidate listings</dt>
                          <dd>
                            {record.report.result.candidateListingRefs.join(" · ") ||
                              "none"}
                          </dd>
                        </div>
                        <div>
                          <dt>Missing evidence</dt>
                          <dd>
                            {record.report.result.missingEvidence.join(" · ") ||
                              "none"}
                          </dd>
                        </div>
                      </dl>
                      {record.report.result.findings.map((finding, index) => (
                        <div
                          className="investigation-finding"
                          key={`${record.investigationId}:${index}`}
                        >
                          <Badge variant="muted">{finding.severity}</Badge>
                          <span>{finding.statement}</span>
                          <code>
                            {finding.listingRefs.join(" · ") || "scope-wide"}
                          </code>
                        </div>
                      ))}
                      <code className="investigation-artifact">
                        {record.report.artifactHash}
                      </code>
                    </>
                  )}
                </article>
              ))
            )}
          </div>

          <div className="scout-run-list">
            <div className="scout-run-heading">
              <div>
                <span className="eyebrow">Proposal queue</span>
                <h2>Unreviewed hypotheses</h2>
              </div>
              <Badge variant="muted">
                {studioProjection.discoveryDesk.unreviewedCount} waiting
              </Badge>
            </div>
          {studioProjection.discoveryDesk.runs.length === 0 ? (
            <div className="scout-empty">
              <Inbox size={24} />
              <strong>No scout runs yet</strong>
              <span>Submit a bounded task to populate the audit trail.</span>
            </div>
          ) : (
            studioProjection.discoveryDesk.runs.map((run) => (
              <article className="scout-run" key={run.runId}>
                <div className="scout-run-meta">
                  <div>
                    <span>{run.runId}</span>
                    <time>{new Date(run.completedAt).toLocaleString()}</time>
                  </div>
                  <Badge variant="muted">{run.workerIds.join(" + ")}</Badge>
                  {run.catalogContextIdentity !== undefined && (
                    <Badge variant="muted">
                      {run.catalogListingCount} listings ·{" "}
                      {run.catalogContextIdentity.slice(7, 14)}
                    </Badge>
                  )}
                  {run.catalogContextSource !== undefined && (
                    <Badge variant="muted">
                      {run.catalogContextSource.replaceAll("_", " ")}
                    </Badge>
                  )}
                </div>
                <h3>{run.question}</h3>
                <div className="scout-venue-row">
                  {run.venueIds.map((venueId) => (
                    <span key={venueId}>{venueId}</span>
                  ))}
                </div>
                {(run.workerReports ?? []).length > 0 && (
                  <div className="scout-worker-reports">
                    {(run.workerReports ?? []).map((report) => (
                      <div key={`${run.runId}:${report.workerId}`}>
                        <i className={report.status === "PASS" ? "is-pass" : ""} />
                        <span>{report.workerId}</span>
                        <strong>
                          {report.status} · {report.hypothesisCount} lead
                          {report.hypothesisCount === 1 ? "" : "s"} ·{" "}
                          {report.falsificationCount ?? 0} falsified ·{" "}
                          {report.durationMs} ms
                        </strong>
                        {report.diagnostic !== null && (
                          <small>{report.diagnostic}</small>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {run.hypotheses.map((hypothesis) => (
                  <div className="hypothesis-card" key={hypothesis.hypothesisId}>
                    <div className="hypothesis-topline">
                      <Badge variant="shadow">{hypothesis.authority}</Badge>
                      <Badge variant="muted">{hypothesis.reviewStatus}</Badge>
                      <span>{confidenceLabel(hypothesis.confidenceBps)} scout confidence</span>
                    </div>
                    <p>{hypothesis.thesis}</p>
                    <dl>
                      <div>
                        <dt>Strategy shape</dt>
                        <dd>{hypothesis.strategyKind.replaceAll("_", " ")}</dd>
                      </div>
                      <div>
                        <dt>Search terms</dt>
                        <dd>{hypothesis.claimSearchTerms.join(" · ") || "none"}</dd>
                      </div>
                      <div>
                        <dt>Grounded listings</dt>
                        <dd className="grounded-listings">
                          {(hypothesis.listingRefs ?? []).join(" · ") || "none"}
                        </dd>
                      </div>
                    </dl>
                    <div className="promotion-lock">
                      <CircleOff size={13} />
                      Runtime equivalence review is not configured; promotion is locked.
                    </div>
                  </div>
                ))}
                {(run.falsifications ?? []).map((falsification) => (
                  <div className="hypothesis-card" key={falsification.falsificationId}>
                    <div className="hypothesis-topline">
                      <Badge variant="warning">FALSIFIED LEAD</Badge>
                      <Badge variant="muted">{falsification.authority}</Badge>
                    </div>
                    <p>{falsification.claim}</p>
                    <dl>
                      <div>
                        <dt>Tested relation</dt>
                        <dd>{(falsification.relationKind ?? "UNSPECIFIED RELATION").replaceAll("_", " ")}</dd>
                      </div>
                      <div>
                        <dt>Why rejected</dt>
                        <dd>{falsification.reason}</dd>
                      </div>
                      <div>
                        <dt>Search terms</dt>
                        <dd>{falsification.claimSearchTerms.join(" · ")}</dd>
                      </div>
                      <div>
                        <dt>Inspected listings</dt>
                        <dd className="grounded-listings">
                          {falsification.listingRefs.join(" · ")}
                        </dd>
                      </div>
                    </dl>
                    <div className="promotion-lock">
                      <CircleOff size={13} />
                      Negative retrieval feedback only; no proposal or promotion route.
                    </div>
                  </div>
                ))}
              </article>
            ))
          )}
          </div>
        </div>
      </div>
        </div>
      </details>
    </section>
  );
}

function caseBadgeVariant(status: ResearchCase["status"]) {
  if (status === "EVIDENCE_GAPS") return "warning" as const;
  if (status === "INVESTIGATING" || status === "AWAITING_REVIEW") {
    return "shadow" as const;
  }
  return "muted" as const;
}

function ResearchCaseDeskView() {
  const studioProjection = useStudioProjection();
  const researchDesk = studioProjection.ai.researchDesk;
  const [selectedCaseId, setSelectedCaseId] = useState(
    researchDesk.cases[0]?.caseId ?? "",
  );
  const [caseInvestigationState, setCaseInvestigationState] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [caseInvestigationDiagnostic, setCaseInvestigationDiagnostic] =
    useState<string | null>(null);
  const selectedCase =
    researchDesk.cases.find((item) => item.caseId === selectedCaseId) ??
    researchDesk.cases[0];
  const selectedReviewIntake = resolveReviewIntake(selectedCase);

  useEffect(() => {
    if (
      researchDesk.cases.length > 0 &&
      !researchDesk.cases.some((item) => item.caseId === selectedCaseId)
    ) {
      setSelectedCaseId(researchDesk.cases[0]?.caseId ?? "");
    }
  }, [researchDesk.cases, selectedCaseId]);

  useEffect(() => {
    setCaseInvestigationState("IDLE");
    setCaseInvestigationDiagnostic(null);
  }, [selectedCaseId]);

  async function investigateSelectedCase(): Promise<void> {
    const taskId = selectedCase?.scout.taskId;
    if (taskId === null || taskId === undefined) return;
    setCaseInvestigationState("RUNNING");
    setCaseInvestigationDiagnostic(null);
    try {
      const restored = await requestResearchCaseInvestigation(taskId);
      setCaseInvestigationState(restored ? "RESTORED" : "DONE");
    } catch (error) {
      setCaseInvestigationState("FAILED");
      setCaseInvestigationDiagnostic(
        error instanceof Error ? error.message : "case investigation failed",
      );
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading case-heading">
        <span className="eyebrow">Joined research state · no promotion</span>
        <h1>Research case desk</h1>
        <p>
          One deterministic dossier joins scout proposals, read-only pi retries,
          candidate listings, and unresolved evidence for the same bounded
          catalog context. Presence is not approval: independent review,
          compilation, and exact verification remain blocked.
        </p>
      </div>

      <div className="case-summary-grid">
        <Metric
          label="Open cases"
          value={`${researchDesk.caseCount}`}
          detail="bounded operational dossiers"
        />
        <Metric
          label="Investigating"
          value={`${researchDesk.activeCount}`}
          detail="read-only pi currently running"
        />
        <Metric
          label="Evidence gaps"
          value={`${researchDesk.evidenceGapCount}`}
          detail="passed intake · facts still missing"
        />
        <Metric
          label="Needs context"
          value={`${researchDesk.needsContextCount}`}
          detail="legacy or ungrounded scout runs"
        />
        <Metric
          label="Needs pi"
          value={`${researchDesk.needsInvestigationCount}`}
          detail="scout leads without deep intake"
        />
        <Metric
          label="Awaiting review"
          value={`${researchDesk.awaitingReviewCount}`}
          detail="review authority remains absent"
        />
      </div>

      {selectedCase === undefined ? (
        <div className="case-empty">
          <Waypoints size={26} />
          <strong>No research cases retained</strong>
          <span>Run a bounded scout or pi investigation to open a dossier.</span>
        </div>
      ) : (
        <div className="case-workbench">
          <div className="case-list" aria-label="Research case queue">
            <div className="case-list-heading">
              <span className="eyebrow">Case queue</span>
              <Badge variant="muted">{researchDesk.caseCount} retained</Badge>
            </div>
            {researchDesk.cases.map((item) => (
              <button
                type="button"
                className={cn(
                  "case-list-item",
                  item.caseId === selectedCase.caseId && "is-selected",
                )}
                key={item.caseId}
                onClick={() => setSelectedCaseId(item.caseId)}
              >
                <div>
                  <Badge variant={caseBadgeVariant(item.status)}>
                    {item.status.replaceAll("_", " ")}
                  </Badge>
                  <time>{new Date(item.updatedAt).toLocaleString()}</time>
                </div>
                <strong>{item.question}</strong>
                <span>
                  {countLabel(item.scout.hypothesisCount, "lead")} ·{" "}
                  {countLabel(item.investigation.attemptCount, "pi attempt")} ·{" "}
                  {countLabel(item.missingEvidence.length, "gap")}
                </span>
              </button>
            ))}
          </div>

          <article className="case-dossier">
            <div className="case-dossier-head">
              <div>
                <span className="eyebrow">Bounded research dossier</span>
                <h2>{selectedCase.question}</h2>
              </div>
              <div>
                <Badge variant={caseBadgeVariant(selectedCase.status)}>
                  {selectedCase.status.replaceAll("_", " ")}
                </Badge>
                <Badge variant="shadow">{selectedCase.authority}</Badge>
                <Badge variant="muted">{selectedCase.reviewStatus}</Badge>
              </div>
            </div>

            <div className="case-scope-strip">
              <div>
                <Database size={13} />
                <span>
                  {selectedCase.catalogListingCount} listings ·{" "}
                  {selectedCase.catalogContextSource
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </span>
              </div>
              <div>
                <Network size={13} />
                <span>{selectedCase.venueIds.join(" · ")}</span>
              </div>
              <code>
                {selectedCase.catalogContextIdentity?.slice(0, 24) ??
                  "context unavailable"}
                …
              </code>
            </div>

            <div className="case-stage-flow">
              {selectedCase.stages.map((stage, index) => (
                <div
                  className={cn(
                    "case-stage",
                    `is-${stage.status.toLowerCase()}`,
                  )}
                  key={stage.stage}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{stage.stage.replaceAll("_", " ")}</strong>
                    <small>{stage.detail}</small>
                  </div>
                  <Badge
                    variant={
                      stage.status === "BOUND" || stage.status === "PRESENT"
                        ? "verified"
                        : stage.status === "FAILED"
                          ? "warning"
                          : stage.status === "RUNNING"
                            ? "shadow"
                            : "muted"
                    }
                  >
                    {stage.status}
                  </Badge>
                </div>
              ))}
            </div>

            {selectedCase.status === "NEEDS_INVESTIGATION" && (
              <div className="case-investigation-action">
                <div>
                  <SquareTerminal size={15} />
                  <span>
                    {selectedCase.scout.contextSnapshotRetained
                      ? "Deep pi will reuse the exact catalog snapshot retained with "
                      : "This legacy scout predates exact context retention for "}
                    scout task <code>{selectedCase.scout.taskId}</code>.
                    {selectedCase.scout.contextSnapshotRetained
                      ? " Refreshes cannot substitute newer evidence."
                      : " Re-run a fresh bounded scout before deep investigation."}
                    {caseInvestigationDiagnostic !== null && (
                      <strong>{caseInvestigationDiagnostic}</strong>
                    )}
                  </span>
                </div>
                <Button
                  variant="outline"
                  disabled={
                    selectedCase.scout.taskId === null ||
                    !selectedCase.scout.contextSnapshotRetained ||
                    !studioProjection.ai.investigator.configured ||
                    studioProjection.ai.investigationDesk.activeCount > 0 ||
                    caseInvestigationState === "RUNNING"
                  }
                  onClick={() => void investigateSelectedCase()}
                >
                  {caseInvestigationState === "RUNNING" ? (
                    <RefreshCw className="is-spinning" size={14} />
                  ) : (
                    <SquareTerminal size={14} />
                  )}
                  {!studioProjection.ai.investigator.configured
                    ? "Deep investigator needs key"
                    : !selectedCase.scout.contextSnapshotRetained
                      ? "Exact context snapshot unavailable"
                    : caseInvestigationState === "RUNNING"
                      ? "pi investigating retained context…"
                      : caseInvestigationState === "DONE"
                        ? "pi investigation complete"
                        : caseInvestigationState === "RESTORED"
                          ? "Restored retained report"
                          : caseInvestigationState === "FAILED"
                            ? "Retry retained-context pi"
                            : "Run deep pi on retained context"}
                </Button>
              </div>
            )}

            {selectedCase.investigation.summary !== null && (
              <section className="case-investigation-brief">
                <div className="case-section-heading">
                  <div>
                    <SquareTerminal size={14} />
                    <strong>Deep investigation brief</strong>
                  </div>
                  <div className="case-brief-badges">
                    <Badge variant="muted">
                      {countLabel(
                        selectedCase.investigation.findingCount,
                        "finding",
                      )}
                    </Badge>
                    <Badge
                      variant={
                        selectedCase.investigation.warningCount > 0
                          ? "warning"
                          : "muted"
                      }
                    >
                      {countLabel(
                        selectedCase.investigation.warningCount,
                        "warning",
                      )}
                    </Badge>
                  </div>
                </div>
                <p>{selectedCase.investigation.summary}</p>
                {selectedCase.investigation.findings.length > 0 && (
                  <div className="case-finding-list">
                    {selectedCase.investigation.findings.map(
                      (finding, index) => (
                        <article
                          key={`${selectedCase.caseId}:finding:${index}`}
                        >
                          <div>
                            <Badge
                              variant={
                                finding.severity === "WARNING"
                                  ? "warning"
                                  : "muted"
                              }
                            >
                              {finding.severity}
                            </Badge>
                            <code>{finding.listingRefs.join(" · ")}</code>
                          </div>
                          <p>{finding.statement}</p>
                        </article>
                      ),
                    )}
                  </div>
                )}
                {selectedCase.investigation.findingCount >
                  selectedCase.investigation.findings.length && (
                  <small className="case-more-gaps">
                    +
                    {selectedCase.investigation.findingCount -
                      selectedCase.investigation.findings.length} more retained
                    outside the bounded dossier slice
                  </small>
                )}
              </section>
            )}

            <div className="case-evidence-grid">
              <section>
                <div className="case-section-heading">
                  <div>
                    <GitBranch size={14} />
                    <strong>Candidate listing scope</strong>
                  </div>
                  <Badge variant="muted">
                    {selectedCase.candidateListingRefCount}
                  </Badge>
                </div>
                {selectedCase.candidateListingRefs.length === 0 ? (
                  <p>No grounded candidate listing survived intake.</p>
                ) : (
                  <ul className="case-listing-refs">
                    {selectedCase.candidateListingRefs.map((listingRef) => (
                      <li key={listingRef}>
                        <Fingerprint size={11} />
                        <code>{listingRef}</code>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedCase.candidateListingRefCount >
                  selectedCase.candidateListingRefs.length && (
                  <small className="case-more-gaps">
                    +
                    {selectedCase.candidateListingRefCount -
                      selectedCase.candidateListingRefs.length}{" "}
                    more retained outside the bounded display slice
                  </small>
                )}
              </section>
              <section>
                <div className="case-section-heading">
                  <div>
                    <CircleOff size={14} />
                    <strong>Missing evidence intake</strong>
                  </div>
                  <Badge
                    variant={
                      selectedCase.missingEvidence.length > 0
                        ? "warning"
                        : "muted"
                    }
                  >
                    {selectedCase.missingEvidence.length}
                  </Badge>
                </div>
                {selectedCase.missingEvidence.length === 0 ? (
                  <p>
                    pi reported no explicit gaps; this is not an independent
                    completeness finding.
                  </p>
                ) : (
                  <ol className="case-gap-list">
                    {selectedCase.missingEvidence
                      .slice(0, 6)
                      .map((gap, index) => (
                        <li key={`${selectedCase.caseId}:gap:${index}`}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <p>{gap}</p>
                        </li>
                      ))}
                  </ol>
                )}
                {selectedCase.missingEvidence.length > 6 && (
                  <small className="case-more-gaps">
                    +{selectedCase.missingEvidence.length - 6} more retained in
                    the case projection
                  </small>
                )}
              </section>
            </div>

            {selectedReviewIntake !== null && (
              <section className="case-review-intake">
                <div className="case-section-heading">
                  <div>
                    <FileCheck2 size={14} />
                    <strong>Independent review intake</strong>
                  </div>
                  <Badge
                    variant={
                      selectedReviewIntake.readiness ===
                      "READY_FOR_INDEPENDENT_REVIEW"
                        ? "verified"
                        : "warning"
                    }
                  >
                    {selectedReviewIntake.readiness.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="case-review-intake-grid">
                  <div>
                    <span>Self-verifying packet</span>
                    <code>{selectedReviewIntake.packetHash}</code>
                    <small>
                      Binds{" "}
                      {
                        selectedReviewIntake.sourceBindings.hypothesisHashes
                          .length
                      }{" "}
                      hypothesis hash
                      {selectedReviewIntake.sourceBindings.hypothesisHashes
                        .length === 1
                        ? ""
                        : "es"}
                      , the retained catalog identity, and the passed pi
                      artifact.
                    </small>
                  </div>
                  <div>
                    <span>Required reviewer assessments</span>
                    <div className="case-review-assessments">
                      {selectedReviewIntake.requiredAssessments.map(
                        (assessment) => (
                          <span key={assessment}>
                            {assessment.replaceAll("_", " ").toLowerCase()}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                {selectedReviewIntake.blockers.length > 0 && (
                  <p>
                    {countLabel(
                      selectedReviewIntake.blockers.length,
                      "blocker",
                    )}
                    {" · "}
                    {selectedReviewIntake.blockers[0]}
                  </p>
                )}
                <div className="case-review-intake-lock">
                  <ShieldCheck size={13} />
                  <span>
                    Intake only. Decision ingestion, promotion, and execution
                    remain disabled; a future independent authority must publish
                    separate hash-bound review artifacts.
                  </span>
                </div>
              </section>
            )}

            <div className="case-footer-strip">
              <div>
                <SquareTerminal size={13} />
                <span>
                  pi {selectedCase.investigation.status.toLowerCase()} ·{" "}
                  {selectedCase.investigation.failedAttemptCount} failed of{" "}
                  {countLabel(
                    selectedCase.investigation.attemptCount,
                    "attempt",
                  )}{" "}
                  · {countLabel(selectedCase.investigation.warningCount, "warning")}
                </span>
              </div>
              <code>
                {selectedCase.investigation.artifactHash ??
                  "no passed investigation artifact"}
              </code>
            </div>

            <div className="case-authority-lock">
              <ShieldCheck size={15} />
              <span>
                Case aggregation is read-only operational context. It cannot
                accept a hypothesis, publish a market link, compile a candidate,
                certify arbitrage, or grant execution authority.
              </span>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function VenueMatrix() {
  const studioProjection = useStudioProjection();
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Protocol reality</span>
        <h1>Venue capability matrix</h1>
        <p>
          Each adapter owns its precision, authentication boundary, mechanism,
          and qualification evidence.
        </p>
      </div>
      <div className="venue-grid">
        {studioProjection.venues.map((venue) => (
          <Card className="venue-card" key={venue.id}>
            <CardHeader>
              <div className="venue-monogram">
                <span style={{ backgroundColor: venue.color }} />
                {venue.name.slice(0, 2).toUpperCase()}
              </div>
              <Badge variant={venue.stage === "OBSERVE" ? "verified" : "muted"}>
                {venue.stage}
              </Badge>
            </CardHeader>
            <CardContent>
              <h2>{venue.name}</h2>
              <p>{venue.mechanism}</p>
              <div
                className={cn(
                  "gateway-posture",
                  venue.gatewayPosture !== "ABSENT" && "is-inert",
                )}
              >
                <CircleOff size={11} />
                {venue.gatewayPosture === "INERT_DEMO"
                  ? "Inert demo gateway"
                  : venue.gatewayPosture === "INERT_SANDBOX"
                    ? "Inert sandbox gateway"
                    : "Order gateway absent"}
              </div>
              <div className="venue-health">
                <div>
                  <span>Fixture health</span>
                  <strong>{venue.health}%</strong>
                </div>
                <div className="health-track">
                  <span style={{ width: `${venue.health}%` }} />
                </div>
              </div>
              <div className="capability-chips">
                {venue.capabilities.map((capability) => (
                  <span key={capability}>{capability}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BookDeskView() {
  const studioProjection = useStudioProjection();
  const [selectedBookId, setSelectedBookId] = useState(
    studioProjection.bookDesk.books[0]?.bookId ?? "",
  );
  const [replayStatus, setReplayStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "FAILED"
  >("IDLE");
  const selectedBook =
    studioProjection.bookDesk.books.find(
      (book) => book.bookId === selectedBookId,
    ) ?? studioProjection.bookDesk.books[0];

  async function replayBooks() {
    setReplayStatus("RUNNING");
    try {
      const response = await fetch("/api/v1/books/replay", { method: "POST" });
      if (!response.ok) {
        throw new Error(`book replay returned HTTP ${response.status}`);
      }
      const result = (await response.json()) as {
        effects?: {
          externalWrites?: boolean;
          valueMovingActions?: boolean;
          liveExecutionEnabled?: boolean;
        };
      };
      if (
        result.effects?.externalWrites !== false ||
        result.effects.valueMovingActions !== false ||
        result.effects.liveExecutionEnabled !== false
      ) {
        throw new Error("book replay crossed its read-only boundary");
      }
      setReplayStatus("DONE");
    } catch {
      setReplayStatus("FAILED");
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading book-heading">
        <div>
          <span className="eyebrow">Deterministic market state</span>
          <h1>Book replay desk</h1>
          <p>
            Verified stream frames become generation-bound books inside the
            control plane. Venue sequence guarantees stay visible instead of
            being flattened into a fake common feed.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={replayStatus === "RUNNING"}
          onClick={() => void replayBooks()}
        >
          <RefreshCw
            size={14}
            className={replayStatus === "RUNNING" ? "is-spinning" : ""}
          />
          {replayStatus === "RUNNING"
            ? "Replaying"
            : replayStatus === "DONE"
              ? "Replay complete"
              : replayStatus === "FAILED"
                ? "Retry replay"
                : "Replay evidence"}
        </Button>
      </div>

      <div className="book-summary-grid">
        <Metric
          label="Qualified books"
          value={`${studioProjection.bookDesk.books.length}`}
          detail="three public transports"
        />
        <Metric
          label="Replay generation"
          value={`${studioProjection.bookDesk.replayCount}`}
          detail="in-memory · deterministic"
        />
        <Metric
          label="Valid projections"
          value={`${studioProjection.bookDesk.books.filter((book) => book.lifecycle === "SNAPSHOT_VALID" || book.lifecycle === "APPLYING_DELTAS").length}`}
          detail="stale and gaps fail closed"
        />
      </div>

      <div className="book-desk-layout">
        <div className="book-session-list">
          <div className="book-list-heading">
            <span>Venue sessions</span>
            <Badge variant="verified">
              <Radio size={10} /> SSE linked
            </Badge>
          </div>
          {studioProjection.bookDesk.books.map((book) => (
            <button
              className={cn(
                "book-session",
                selectedBook?.bookId === book.bookId && "is-selected",
              )}
              key={book.bookId}
              onClick={() => setSelectedBookId(book.bookId)}
            >
              <span className="book-session-status" />
              <div>
                <strong>{book.venueName}</strong>
                <span>{book.instrumentId}</span>
              </div>
              <Badge variant="muted">{book.lifecycle}</Badge>
              <small>
                {book.bidLevelCount} × {book.askLevelCount} levels
              </small>
            </button>
          ))}
        </div>

        {selectedBook && (
          <Card className="book-detail-card">
            <CardHeader>
              <div>
                <span className="eyebrow">{selectedBook.venueId}</span>
                <h2>{selectedBook.venueName} order book</h2>
              </div>
              <Badge variant="verified">Generation {selectedBook.generation}</Badge>
            </CardHeader>
            <CardContent>
              <div className="book-topline">
                <div>
                  <span>Best bid</span>
                  <strong className="positive">
                    {selectedBook.bestBid ?? "—"}
                  </strong>
                </div>
                <div>
                  <span>Spread</span>
                  <strong>{selectedBook.spread ?? "—"}</strong>
                </div>
                <div>
                  <span>Best ask</span>
                  <strong className="ask-text">
                    {selectedBook.bestAsk ?? "—"}
                  </strong>
                </div>
              </div>

              <div className="depth-ladder">
                <div className="depth-side bids">
                  <div className="depth-header">
                    <span>Bid price</span>
                    <span>Size</span>
                  </div>
                  {selectedBook.bids.map((level, index) => (
                    <div className="depth-row" key={`bid:${level.price}`}>
                      <i style={{ width: `${Math.max(22, 100 - index * 10)}%` }} />
                      <strong>{level.price}</strong>
                      <span>{level.size}</span>
                    </div>
                  ))}
                </div>
                <div className="depth-side asks">
                  <div className="depth-header">
                    <span>Ask price</span>
                    <span>Size</span>
                  </div>
                  {selectedBook.asks.map((level, index) => (
                    <div className="depth-row" key={`ask:${level.price}`}>
                      <i style={{ width: `${Math.max(22, 100 - index * 10)}%` }} />
                      <strong>{level.price}</strong>
                      <span>{level.size}</span>
                    </div>
                  ))}
                </div>
              </div>

              <dl className="book-evidence-strip">
                <div>
                  <dt>Sequence policy</dt>
                  <dd>{selectedBook.sequencePolicy.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Venue sequence</dt>
                  <dd>{selectedBook.sequence ?? "snapshot only"}</dd>
                </div>
                <div>
                  <dt>State identity</dt>
                  <dd>{selectedBook.stateHash?.slice(0, 22) ?? "unavailable"}…</dd>
                </div>
                <div>
                  <dt>Evidence identity</dt>
                  <dd>{selectedBook.evidenceHash.slice(0, 22)}…</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function FailureBudgetView({
  onOpenEvidence,
}: {
  onOpenEvidence: (proposalIds: readonly string[]) => void;
}) {
  const studioProjection = useStudioProjection();
  const [frontier, setFrontier] = useState<FailureBudgetFrontierProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [retryingCase, setRetryingCase] = useState<string | null>(null);
  const deepseekAutomationEnabled =
    studioProjection.ai.runtimeConfiguration.configuration.deepseekAutomationEnabled;
  const evidenceDebt =
    studioProjection.ai.probabilityEvidenceDebt ?? EMPTY_PROBABILITY_EVIDENCE_DEBT;
  const repairProgress =
    studioProjection.ai.probabilitySemanticRepairProgress ??
      EMPTY_PROBABILITY_SEMANTIC_REPAIR_PROGRESS;

  async function load(): Promise<void> {
    setLoading(true);
    setDiagnostic(null);
    try {
      setFrontier(await requestFailureBudgetFrontier());
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message : "failure budget frontier failed");
    } finally {
      setLoading(false);
    }
  }

  async function retryCase(caseIdentity: string): Promise<void> {
    setRetryingCase(caseIdentity);
    setDiagnostic(null);
    try {
      await requestProbabilityCaseRetry(caseIdentity);
      await load();
    } catch (error) {
      setDiagnostic(error instanceof Error ? error.message : "probability case retry failed");
    } finally {
      setRetryingCase(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const statusLabel = (status: FailureBudgetFrontierProjection["items"][number]["status"]): string => ({
    BOUNDED_ARBITRAGE_CANDIDATE: "BOUND HOLDS",
    RESEARCH_MARGIN: "MARGIN · NEEDS MARKET DATA",
    BUDGET_EXHAUSTED: "BUDGET EXHAUSTED",
    AWAITING_ESTIMATES: "AWAITING ESTIMATES",
    ESTIMATION_ABSTAINED: "ESTIMATORS ABSTAINED",
    ESTIMATION_EXHAUSTED: "ESTIMATION EXHAUSTED",
    EVIDENCE_BLOCKED: "EVIDENCE BLOCKED",
    SEMANTIC_REPAIR_REQUIRED: "SEMANTIC REPAIR REQUIRED",
    PRICE_UNAVAILABLE: "PRICE UNAVAILABLE",
  })[status];

  return (
    <section className="page-section failure-budget-page">
      <div className="page-heading failure-budget-heading">
        <div>
          <span className="eyebrow">Probabilistic semantic arbitrage</span>
          <h1>Price how wrong the relation may be.</h1>
          <p>
            Start with an Agent-discovered semantic dependency, then ask how often it may fail
            before current prices stop compensating us. The gap is a failure budget—not a claim
            of guaranteed profit.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "is-spinning" : ""} size={16} />
          Refresh frontier
        </Button>
      </div>

      <div className="failure-budget-method" aria-label="Failure budget method">
        <div>
          <span>01</span>
          <strong>Find a dependency</strong>
          <p>Heuristic Agents propose unusual relations; no claim vocabulary is required up front.</p>
        </div>
        <ChevronRight size={17} />
        <div>
          <span>02</span>
          <strong>Bound the failure state</strong>
          <p>Independent estimates cap the probability that the attractive semantic relation fails.</p>
        </div>
        <ChevronRight size={17} />
        <div>
          <span>03</span>
          <strong>Compare with price</strong>
          <p>The compiler measures how much error the quoted portfolio can absorb before edge is gone.</p>
        </div>
      </div>

      {frontier !== null && (
        <div className="metric-grid failure-budget-summary">
          <Metric label="Positive margin" value={`${frontier.positiveMarginCount}`} detail="price budget exceeds adverse bound" />
          <Metric label="Bound candidates" value={`${frontier.boundedCandidateCount}`} detail="all research gates clear" />
          <Metric label="Unbounded cases" value={`${frontier.unboundedCaseCount}`} detail={`${frontier.challengedCaseCount} challenged · ${frontier.abstainedCaseCount} abstained · ${frontier.evidenceBlockedCount} evidence-blocked`} />
          <Metric
            label="Frontier size"
            value={`${frontier.itemCount}`}
            detail={`${frontier.rawEstimatorCaseCount} estimator cases · ${frontier.collapsedEstimatorCaseCount} historical attempts collapsed`}
          />
        </div>
      )}

      {repairProgress.items.length > 0 && (
        <Card className="probability-evidence-debt-card probability-repair-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Semantic repair lifecycle</span>
              <h2>Challenge the premise, then estimate again</h2>
              <p>
                An estimator found that the retained relation, outcome direction, or adverse-state
                mapping is internally inconsistent. The source case stays terminal while a new
                semantic review either repairs, reduces, or rejects the relation.
              </p>
            </div>
            <Badge variant="warning">{repairProgress.sourceChallengeCount} CHALLENGES</Badge>
          </CardHeader>
          <CardContent>
            <div className="probability-evidence-debt-list">
              {repairProgress.items.slice(0, 6).map((item) => (
                <article key={item.repairId}>
                  <div>
                    <Badge variant={
                      item.status === "REPAIRED" ? "verified" :
                      item.status === "REVIEW_RUNNING" || item.status === "REVIEW_PENDING" ? "shadow" :
                      item.status === "OPEN" ? "warning" : "muted"
                    }>{item.status.replaceAll("_", " ")}</Badge>
                    <span>generation {item.generation} · {item.roles.map((role) => role.replaceAll("_", " ")).join(" + ")} · {item.stateIds.join("+")}</span>
                  </div>
                  <strong>{({
                    RELATION_DIRECTION: "The retained relation points in the wrong direction",
                    COUNTEREXAMPLE_STATE_CONFLICT: "The counterexample points to a different joint state",
                    OUTCOME_MAPPING: "The outcome labels do not support the retained mapping",
                    ADVERSE_STATE_SELECTION: "The selected failure state does not match the premise",
                    EVIDENCE_SCOPE: "The estimate relies on evidence outside its retained scope",
                  } as const)[item.kind]}</strong>
                  <p>{item.observedConflicts[0]}</p>
                  <small>
                    {item.listingRefs.length} contracts · {item.nextAction.replaceAll("_", " ").toLowerCase()}
                    {item.engine === null ? "" : ` · ${item.engine.provider} ${item.engine.model}${item.engine.reasoningEffort === null ? "" : ` / ${item.engine.reasoningEffort}`}`}
                    {item.successorReviewId === null ? "" : ` · successor ${item.successorReviewId.slice(0, 18)}…`}
                  </small>
                </article>
              ))}
            </div>
            <div className="probability-evidence-debt-summary">
              <span>{repairProgress.pendingCount + repairProgress.runningCount} active review</span>
              <span>{repairProgress.repairedCount} repaired · {repairProgress.reducedToResearchCount} reduced</span>
              <span>{repairProgress.rejectedCount} rejected · {repairProgress.manualAttentionCount} manual</span>
            </div>
          </CardContent>
        </Card>
      )}

      {evidenceDebt.items.length > 0 && (
        <Card className="probability-evidence-debt-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Estimator research queue</span>
              <h2>What the Agents need to learn next</h2>
              <p>
                Abstention is retained as typed work. Official-rule gaps can enter acquisition;
                statistical and causal gaps wait for an approved source family.
              </p>
            </div>
            <Badge variant="warning">{evidenceDebt.blockingItemCount} BLOCKING</Badge>
          </CardHeader>
          <CardContent>
            <div className="probability-evidence-debt-list">
              {evidenceDebt.items.slice(0, 6).map((item) => (
                <article key={item.debtId}>
                  <div>
                    <Badge variant={item.status === "EVIDENCE_CAPTURED" ? "verified" : item.status === "ACQUISITION_IN_PROGRESS" ? "shadow" : "muted"}>
                      {item.status.replaceAll("_", " ")}
                    </Badge>
                    <span>{item.kind.replaceAll("_", " ")} · {item.roles.join(" + ")}{item.questionVariants.length > 1 ? ` · ${item.questionVariants.length} formulations` : ""}</span>
                  </div>
                  <strong>{item.question}</strong>
                  <p>{item.reason}</p>
                  <small>{item.listingRefs.length} contracts · adverse {item.adverseStateIds.join("+")} · {item.engines.join(" · ")}</small>
                </article>
              ))}
            </div>
            <div className="probability-evidence-debt-summary">
              <span>{evidenceDebt.counts.ACQUISITION_IN_PROGRESS + evidenceDebt.counts.ACQUISITION_READY} acquisition-routed</span>
              <span>{evidenceDebt.counts.ACQUISITION_ROUTE_MISSING} missing official route</span>
              <span>{evidenceDebt.counts.EXTERNAL_SOURCE_POLICY_REQUIRED} external-policy gated</span>
            </div>
          </CardContent>
        </Card>
      )}

      {diagnostic !== null && (
        <div className="failure-budget-notice is-error">
          <CircleOff size={17} />
          <div><strong>Frontier unavailable</strong><span>{diagnostic}</span></div>
        </div>
      )}

      {loading && frontier === null ? (
        <div className="failure-budget-empty">
          <LoaderCircle className="is-spinning" size={20} />
          <strong>Building the read-only frontier…</strong>
        </div>
      ) : frontier !== null && frontier.items.length > 0 ? (
        <div className="failure-budget-list">
          {frontier.items.map((item, index) => {
            const utilization = item.budgetUtilizationBps === null
              ? 0
              : Math.min(100, Math.max(0, Number(item.budgetUtilizationBps) / 100));
            const positive = item.remainingFailureBudgetPpm !== null &&
              BigInt(item.remainingFailureBudgetPpm) > 0n;
            return (
              <Card className="failure-budget-card" key={item.itemId}>
                <CardHeader>
                  <div className="failure-budget-rank">{String(index + 1).padStart(2, "0")}</div>
                  <div className="failure-budget-title">
                    <div>
                      <Badge variant={positive ? "verified" : item.status === "AWAITING_ESTIMATES" ? "shadow" : ["ESTIMATION_ABSTAINED", "EVIDENCE_BLOCKED", "SEMANTIC_REPAIR_REQUIRED"].includes(item.status) ? "warning" : "muted"}>
                        {statusLabel(item.status)}
                      </Badge>
                      <span>{item.calibrationStatus.replaceAll("_", " ")}</span>
                    </div>
                    <h2>{item.portfolioLabel ?? item.listingRefs.join(" ↔ ")}</h2>
                  </div>
                  <div className={cn("failure-budget-margin", positive && "is-positive")}>
                    <span>Remaining error budget</span>
                    <strong>{formatPpm(item.remainingFailureBudgetPpm)}</strong>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.budgetUtilizationBps !== null && (
                    <div className="failure-budget-meter">
                      <div><span>Adverse bound uses {formatFixedBps(item.budgetUtilizationBps)} of the price budget</span><span>{formatPpm(item.adverseProbabilityUpperPpm)} / {formatPpm(item.breakEvenEpsilonPpm)}</span></div>
                      <div className="failure-budget-meter-track"><span style={{ width: `${utilization}%` }} /></div>
                    </div>
                  )}
                  <dl className="failure-budget-numbers">
                    <div><dt>Break-even failure rate</dt><dd>{formatPpm(item.breakEvenEpsilonPpm)}</dd></div>
                    <div><dt>Conservative adverse cap</dt><dd>{formatPpm(item.adverseProbabilityUpperPpm)}</dd></div>
                    <div><dt>Expected edge floor*</dt><dd>{formatScaledUnits(item.expectedEdgeFloorUnits, item.commonPriceScale)}</dd></div>
                    <div><dt>Loss in adverse state*</dt><dd>{formatScaledUnits(item.adverseTailLossUnits, item.commonPriceScale)}</dd></div>
                  </dl>
                  {item.estimationAttempts.length > 0 && (
                    <details className="failure-budget-attempts">
                      <summary>
                        <span>{item.attemptCount} estimator generation{item.attemptCount === 1 ? "" : "s"}</span>
                        <small>adverse {item.adverseStateIds.join("+")} · show history</small>
                        <ChevronRight size={14} />
                      </summary>
                      <div>
                        {item.estimationAttempts.map((attempt, attemptIndex) => (
                          <article key={attempt.caseIdentity}>
                            <span>{String(attemptIndex + 1).padStart(2, "0")}</span>
                            <div>
                              <strong>{attempt.status.replaceAll("_", " ")}</strong>
                              <small>
                                {attempt.provider} · {attempt.model}
                                {attempt.reasoningEffort === null ? "" : ` · ${attempt.reasoningEffort}`}
                                {` · ${attempt.inputProtocol.replace("pmh.probability-estimation-input.", "")}`}
                                {` · ${attempt.jobCount} jobs`}
                              </small>
                            </div>
                            <time>{new Date(attempt.createdAt).toLocaleString()}</time>
                          </article>
                        ))}
                      </div>
                    </details>
                  )}
                  {item.failureFactors.length > 0 && (
                    <div className="failure-budget-factors">
                      <strong>What can break the relation</strong>
                      <div>{item.failureFactors.map((factor) => (
                        <span key={factor.factorId}>{factor.label}</span>
                      ))}</div>
                    </div>
                  )}
                  <div className="failure-budget-footer">
                    <div>
                      {item.blockers.map((blocker) => <code key={blocker}>{blocker.replaceAll("_", " ")}</code>)}
                      {item.blockers.length === 0 && <code>RESEARCH GATES CLEAR</code>}
                    </div>
                    <div>
                      <span>
                        {item.estimationCase === null ? "" : `${item.estimationCase.provider} · ${item.estimationCase.model}${item.estimationCase.reasoningEffort === null ? "" : ` · ${item.estimationCase.reasoningEffort}`} · `}
                        {item.attemptCount} attempt{item.attemptCount === 1 ? "" : "s"} · {item.estimatorJobCount} estimator job{item.estimatorJobCount === 1 ? "" : "s"}
                      </span>
                      {item.status === "ESTIMATION_EXHAUSTED" && item.estimationCase !== null && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retryingCase === item.estimationCase.caseIdentity}
                          onClick={() => void retryCase(item.estimationCase!.caseIdentity)}
                        >
                          <RotateCcw size={14} />
                          {retryingCase === item.estimationCase.caseIdentity ? "Reopening…" : "Retry exhausted roles"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenEvidence([item.proposalId])}
                      >
                        <FileSearch size={14} />
                        Continue research
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : frontier !== null ? (
        <div className="failure-budget-empty">
          <Gauge size={22} />
          <strong>No semantic relation has a probability bound yet.</strong>
          <p>
            Discovery and review can continue on Terra. A relation enters this frontier only
            after independent probability estimates exist; this read does not call a provider.
          </p>
          <Badge variant={deepseekAutomationEnabled ? "warning" : "muted"}>
            DeepSeek automation {deepseekAutomationEnabled ? "enabled" : "off"}
          </Badge>
        </div>
      ) : null}

      <Card className="failure-budget-example">
        <CardHeader>
          <div>
            <span className="eyebrow">Illustrative math · not live market data</span>
            <h2>The object we are trying to maximize</h2>
          </div>
          <Badge variant="muted">RESEARCH ONLY</Badge>
        </CardHeader>
        <CardContent>
          <div className="failure-budget-equation">
            <span>price-implied tolerance</span><strong>20%</strong>
            <span>conservative failure bound</span><strong>5%</strong>
            <span>remaining failure budget</span><strong>15%</strong>
          </div>
          <p>
            If a portfolio costs 80¢ and pays at least $1 whenever the proposed relation holds,
            price can tolerate a 20% adverse-state rate. A defensible 5% upper bound leaves 15%
            of model error budget. Fees, depth, stale quotes, calibration and tail loss remain
            separate blockers before this could become actionable.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function EvidenceView({
  focusedProposalIds,
  onClearFocus,
}: {
  focusedProposalIds: readonly string[];
  onClearFocus: () => void;
}) {
  const studioProjection = useStudioProjection();
  const officialSourceDiscovery = studioProjection.ai.officialSourceDiscovery;
  const evidenceAcquisition =
    studioProjection.ai.evidenceAcquisition ?? EMPTY_EVIDENCE_ACQUISITION;
  const evidenceDebtFrontier =
    studioProjection.ai.evidenceDebtFrontier ?? EMPTY_EVIDENCE_DEBT_FRONTIER;
  const probabilityEvidenceDebt =
    studioProjection.ai.probabilityEvidenceDebt ?? EMPTY_PROBABILITY_EVIDENCE_DEBT;
  const ruleEvidenceClaims =
    studioProjection.ai.ruleEvidenceClaims ?? EMPTY_RULE_EVIDENCE_CLAIMS;
  const semanticReviewScheduler =
    studioProjection.ai.semanticReviewScheduler ?? EMPTY_SEMANTIC_REVIEW_SCHEDULER;
  const replayChaos = studioProjection.qualification.replayChaos;
  const campaignEvidence = studioProjection.qualification.campaignEvidence;
  const reviewedCompilation =
    studioProjection.qualification.reviewedCompilation;
  const campaignEvidenceIdentityCount = new Set(
    [
      ...campaignEvidence.assertions.flatMap((item) => item.evidenceHashes),
      reviewedCompilation.artifactHash,
      reviewedCompilation.compiledArtifactHash,
      reviewedCompilation.hypothesisHash,
      reviewedCompilation.hypothesisReviewHash,
      reviewedCompilation.candidateHash,
      reviewedCompilation.certificate.id,
      ...reviewedCompilation.marketLinkProposalHashes,
      ...reviewedCompilation.marketLinkReviewHashes,
    ],
  ).size;
  const items = [
    {
      name: "Verified books",
      count: `${campaignEvidence.sourceArtifacts.length}`,
      detail: "stream + state identity",
      icon: Database,
    },
    {
      name: "Chaos cases",
      count: `${replayChaos.passCount}/${replayChaos.caseCount}`,
      detail: "deterministic fail-closed",
      icon: FileCheck2,
    },
    {
      name: "Evidence identities",
      count: `${campaignEvidenceIdentityCount}`,
      detail: "deduplicated content hashes",
      icon: Boxes,
    },
    {
      name: "Qualification artifacts",
      count: "2",
      detail: "replay + reviewed compiler",
      icon: BadgeCheck,
    },
  ] as const;
  const capturedJobs = evidenceAcquisition.jobs.filter((job) =>
    job.status === "CAPTURED"
  );
  const sourceTier = (
    job: (typeof evidenceAcquisition.jobs)[number],
  ): "CONTRACT" | "VENUE" | "LEGACY" | "UNSUPPORTED" => {
    if (job.locatorIdentity === null) return "UNSUPPORTED";
    const locator = job.requirements.flatMap((requirement) =>
      requirement.eligibleLocators
    ).find((binding) =>
      binding.locator.locatorIdentity === job.locatorIdentity
    )?.locator;
    if (locator?.role === "VENUE_RULE_DOCUMENT") return "VENUE";
    if (locator?.role !== "CONTRACT_RULE_DOCUMENT") return "UNSUPPORTED";
    return locator.url === "https://www.cftc.gov/filings/orgrules/rules0519263672.docx"
      ? "LEGACY"
      : "CONTRACT";
  };
  const evidenceSourceCounts = evidenceAcquisition.sourceSpecificity;
  const rebasedJobs = semanticReviewScheduler.jobs.filter((job) =>
    job.evidenceBundle?.schemaVersion === "pmh.proposal-evidence-bundle.v2" &&
    job.evidenceBundle.captureKind === "EXACT_CURRENT_REBASE"
  );
  const focusedProposalSet = new Set(focusedProposalIds);
  const focusedProbabilityDebt = probabilityEvidenceDebt.items.filter((item) =>
    focusedProposalSet.has(item.proposalId)
  );
  const focusedFrontierItems = evidenceDebtFrontier.items.filter((item) =>
    focusedProposalSet.has(item.proposalId)
  );
  const sourceDiscoveryQueuedCount = officialSourceDiscovery.pendingCount +
    officialSourceDiscovery.retryWaitCount;
  const sourceDiscoveryRunningCount = officialSourceDiscovery.leasedCount;
  const sourceDiscoveryTerminalCount = officialSourceDiscovery.admittedCount +
    officialSourceDiscovery.noSourceCount + officialSourceDiscovery.abstainedCount +
    officialSourceDiscovery.exhaustedCount;
  const evidencePipeline = [
    {
      step: "01",
      label: "Agent gaps",
      value: evidenceAcquisition.requirementCount,
      detail: `${evidenceAcquisition.coalescedRequirementCount} shared fetches`,
      state: evidenceAcquisition.requirementCount > 0 ? "READY" : "WAITING",
    },
    {
      step: "02",
      label: "Source discovery",
      value: sourceDiscoveryQueuedCount + sourceDiscoveryRunningCount,
      detail: `${sourceDiscoveryQueuedCount} queued · ${sourceDiscoveryRunningCount} running · ${sourceDiscoveryTerminalCount} terminal`,
      state: sourceDiscoveryRunningCount > 0 ? "RUNNING" :
        sourceDiscoveryQueuedCount > 0 ? "QUEUED" :
          sourceDiscoveryTerminalCount > 0 ? "OBSERVED" : "WAITING",
    },
    {
      step: "03",
      label: "Official documents",
      value: evidenceAcquisition.capturedCount,
      detail: `${evidenceAcquisition.pendingCount + evidenceAcquisition.leasedCount} active`,
      state: evidenceAcquisition.capturedCount > 0 ? "CAPTURED" : "WAITING",
    },
    {
      step: "04",
      label: "Verified claims",
      value: ruleEvidenceClaims.passedCount,
      detail: `${ruleEvidenceClaims.pendingCount + ruleEvidenceClaims.activeCount} in Agent loop · ${ruleEvidenceClaims.interruptedLeaseCount} interrupted`,
      state: ruleEvidenceClaims.passedCount > 0 ? "INTERPRETED" : "RUNNING",
    },
    {
      step: "05",
      label: "Evidence-aware review",
      value: semanticReviewScheduler.rebasedJobCount,
      detail: `${rebasedJobs.filter((job) => job.status === "PASS").length} passed in window`,
      state: semanticReviewScheduler.rebasedJobCount > 0 ? "REBOUND" : "WAITING",
    },
  ] as const;
  const bottleneck = officialSourceDiscovery.activeCount > 0
    ? "Source-discovery Agents are searching approved official surfaces; candidate URLs remain inert until deterministic admission."
    : ruleEvidenceClaims.pendingCount + ruleEvidenceClaims.activeCount > 0
    ? "Agents are reading captured rule documents and binding exact passages to proposal-local claims."
    : evidenceAcquisition.pendingCount + evidenceAcquisition.leasedCount > 0
      ? "Anonymous document capture is the active constraint."
      : evidenceDebtFrontier.counts.POSITIVE_GROSS_BLOCKER > 0
        ? `${evidenceDebtFrontier.counts.POSITIVE_GROSS_BLOCKER} price-positive proposals are blocked by missing official-source routes.`
        : evidenceDebtFrontier.counts.EVIDENCE_ESCALATION > 0
          ? `${evidenceDebtFrontier.counts.EVIDENCE_ESCALATION} operator-reviewed proposals need official-source routes before they can advance.`
          : evidenceAcquisition.unsupportedCount > 0
            ? "Unsupported source routes remain, ranked below by their current proposal value."
            : "The evidence loop is caught up with the retained proposal window.";
  const debtTierLabel = (tier: (typeof evidenceDebtFrontier.items)[number]["tier"]): string => ({
    POSITIVE_GROSS_BLOCKER: "GROSS HINT BLOCKED",
    EVIDENCE_ESCALATION: "REVIEW BLOCKED",
    ACTIVE_TRIAGE_DEBT: "ACTIVE TRIAGE",
    RETAINED_RESEARCH_DEBT: "RETAINED",
  })[tier];

  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Semantic evidence loop</span>
        <h1>From Agent hunch to reviewable claim</h1>
        <p>
          Discovery Agents name the uncertainty. The harness acquires an official
          source, verifies exact passages, then reopens the same proposal against
          stronger evidence without rewriting its history.
        </p>
      </div>
      {focusedProposalIds.length > 0 && (
        <Card className="focused-evidence-work">
          <CardHeader>
            <div>
              <span className="eyebrow">Focused research object</span>
              <h2>Continue the same work, without losing its identity</h2>
              <p>
                This view was handed off from Failure budgets. It reads retained debt only;
                opening it does not call a model, fetch a source, or change a scheduler.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onClearFocus}>
              Browse all evidence
            </Button>
          </CardHeader>
          <CardContent>
            <div className="focused-evidence-identities">
              {focusedProposalIds.map((proposalId) => (
                <code key={proposalId}>{proposalId}</code>
              ))}
            </div>
            {focusedProbabilityDebt.length > 0 ? (
              <div className="focused-evidence-debt-list">
                {focusedProbabilityDebt.map((item) => (
                  <article key={item.debtId}>
                    <div>
                      <Badge variant={item.status === "EVIDENCE_CAPTURED" ? "verified" : item.status === "ACQUISITION_IN_PROGRESS" ? "shadow" : "muted"}>
                        {item.status.replaceAll("_", " ")}
                      </Badge>
                      <span>{item.kind.replaceAll("_", " ")} · adverse {item.adverseStateIds.join("+")}</span>
                    </div>
                    <strong>{item.question}</strong>
                    <p>{item.reason}</p>
                    <small>
                      {item.roles.join(" + ")} · {item.engines.join(" · ")}
                      {item.questionVariants.length > 1 ? ` · ${item.questionVariants.length} formulations` : ""}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="review-operation-empty">
                <strong>No active probability research debt is retained for this proposal</strong>
                <span>The identity remains in the URL so a refresh cannot silently replace it with unrelated work.</span>
              </div>
            )}
            <div className="focused-evidence-summary">
              <span>{focusedProbabilityDebt.length} typed probability questions</span>
              <span>{focusedFrontierItems.length} active unsupported-source frontier items</span>
              <a href={serializeWorkspaceRoute("lifecycle", focusedProposalIds)}>
                Open focused Review <ChevronRight size={15} />
              </a>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="evidence-pipeline-card">
        <CardHeader>
          <div>
            <span className="eyebrow">Live durable workflow</span>
            <h2>Evidence acquisition pipeline</h2>
          </div>
          <Badge variant={evidenceAcquisition.enabled ? "verified" : "muted"}>
            {evidenceAcquisition.enabled ? "AUTO" : "PAUSED"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="evidence-pipeline" aria-label="Evidence acquisition stages">
            {evidencePipeline.map((stage, index) => (
              <div className="evidence-pipeline-stage" key={stage.step}>
                <span className="evidence-pipeline-step">{stage.step}</span>
                <div>
                  <strong>{stage.value}</strong>
                  <h3>{stage.label}</h3>
                  <p>{stage.detail}</p>
                </div>
                <Badge variant={stage.state === "WAITING" ? "muted" : "shadow"}>
                  {stage.state}
                </Badge>
                {index < evidencePipeline.length - 1 && (
                  <ChevronRight className="evidence-pipeline-arrow" size={16} />
                )}
              </div>
            ))}
          </div>
          <div className="evidence-bottleneck">
            <Activity size={15} />
            <div>
              <strong>Current bottleneck</strong>
              <span>{bottleneck}</span>
            </div>
            <code>{evidenceAcquisition.storage.jobs.durable ? "SQLITE WAL" : "MEMORY"}</code>
          </div>
          <div className="evidence-source-summary" aria-label="Evidence source specificity">
            <div>
              <span>Contract detail</span>
              <strong>{evidenceSourceCounts.contractDetailCount}</strong>
              <small>contract-bound jobs</small>
            </div>
            <div>
              <span>Venue policy</span>
              <strong>{evidenceSourceCounts.venuePolicyCount}</strong>
              <small>venue-wide policy jobs</small>
            </div>
            <div>
              <span>Legacy generic</span>
              <strong>{evidenceSourceCounts.legacyGenericCount}</strong>
              <small>retained, not current proof</small>
            </div>
            <div>
              <span>Without locator</span>
              <strong>{evidenceSourceCounts.withoutLocatorCount}</strong>
              <small>retained no-locator jobs</small>
            </div>
          </div>
          <section className="evidence-debt-frontier" aria-labelledby="evidence-debt-heading">
            <header>
              <div>
                <span className="eyebrow">Action queue · one row per proposal</span>
                <h3 id="evidence-debt-heading">Evidence debt frontier</h3>
                <p>
                  Missing source routes ordered by the proposal they block, not by inventory age.
                </p>
              </div>
              <div className="evidence-debt-counts" aria-label="Evidence debt tier counts">
                <span><strong>{evidenceDebtFrontier.counts.POSITIVE_GROSS_BLOCKER}</strong> gross blockers</span>
                <span><strong>{evidenceDebtFrontier.counts.EVIDENCE_ESCALATION}</strong> review blockers</span>
              </div>
            </header>
            {evidenceDebtFrontier.items.length === 0 ? (
              <div className="review-operation-empty">
                <strong>No unsupported proposal evidence in the retained window</strong>
                <span>New route gaps will appear here with proposal and requirement lineage intact.</span>
              </div>
            ) : (
              <div className="evidence-debt-list">
                {evidenceDebtFrontier.items.slice(0, 6).map((item) => (
                  <article key={item.itemId}>
                    <div className="evidence-debt-main">
                      <div className="evidence-debt-labels">
                        <Badge variant={item.tier === "POSITIVE_GROSS_BLOCKER" ? "warning" : item.tier === "EVIDENCE_ESCALATION" ? "shadow" : "muted"}>
                          {debtTierLabel(item.tier)}
                        </Badge>
                        {item.missingKinds.map((kind) => (
                          <span key={kind}>{kind.replaceAll("_", " ")}</span>
                        ))}
                        {(item.temporalPostures ?? []).map((posture) => (
                          <span className="evidence-debt-temporal" key={posture}>
                            {posture === "CURRENT" ? "CURRENT" : "HISTORICAL SNAPSHOT"}
                          </span>
                        ))}
                      </div>
                      <strong>{item.statement ?? item.requirements[0]?.claim ?? "Retained proposal evidence route"}</strong>
                      <p>
                        {item.listingRefs.join(" ↔ ")}
                      </p>
                    </div>
                    <dl>
                      <div>
                        <dt>Requirements</dt>
                        <dd>{item.requirementCount} across {item.jobCount} job{item.jobCount === 1 ? "" : "s"}</dd>
                      </div>
                      <div>
                        <dt>Gross edge</dt>
                        <dd>{item.grossEdgeBpsFloor === null ? "not established" : `${item.grossEdgeBpsFloor} bps*`}</dd>
                      </div>
                    </dl>
                    <a href={serializeWorkspaceRoute("lifecycle", [item.proposalId])} aria-label={`Open proposal ${item.proposalId} in Review`}>
                      Review <ChevronRight size={15} />
                    </a>
                  </article>
                ))}
              </div>
            )}
            <footer>
              <span>
                {evidenceDebtFrontier.sourceRequirementCount} active unsupported requirements · {evidenceDebtFrontier.sourceProposalCount} proposals
              </span>
              <span>
                {evidenceDebtFrontier.inactiveUnsupportedRequirementCount} inactive requirements retained for replay · gross hints exclude fees and depth.
              </span>
            </footer>
          </section>
          <div className="evidence-scope-lineage" aria-label="Evidence requirement scope lineage">
            <GitBranch size={15} />
            <div>
              <strong>{evidenceAcquisition.requirementScope.proposalScopedCount} requirements retain their complete proposal scope</strong>
              <span>
                They can rebind exact contracts after review-window rotation; {evidenceAcquisition.requirementScope.legacyCount} v1 requirements remain readable without invented lineage.
              </span>
            </div>
          </div>
          <div className="evidence-document-list">
            {capturedJobs.length === 0 ? (
              <div className="review-operation-empty">
                <strong>{evidenceAcquisition.capturedCount} official documents retained</strong>
                <span>Captured job details have rotated beyond the bounded live window; content-addressed documents and claim jobs remain durable.</span>
              </div>
            ) : capturedJobs.slice(0, 4).map((job) => (
              <article key={job.jobId}>
                <FileCheck2 size={16} />
                <div>
                  <strong>{job.requirements[0]?.claim ?? job.kind.replaceAll("_", " ")}</strong>
                  <span>
                    {job.requirementIds.length} requirement{job.requirementIds.length === 1 ? "" : "s"}
                    {" · "}{job.proposalIds.length} proposal{job.proposalIds.length === 1 ? "" : "s"}
                  </span>
                </div>
                <Badge variant="verified">{sourceTier(job)}</Badge>
                <code>{job.lastDocumentId?.slice(7, 15) ?? "document"}</code>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="evidence-section-label">
        <span className="eyebrow">Verifier provenance</span>
        <p>Separate deterministic artifacts retained below the semantic evidence loop.</p>
      </div>
      <div className="evidence-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card className="evidence-card" key={item.name}>
              <Icon size={20} />
              <strong>{item.count}</strong>
              <div>
                <h2>{item.name}</h2>
                <p>{item.detail}</p>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="chaos-evidence-card">
        <CardHeader>
          <div>
            <span className="eyebrow">Replay integrity · deterministic suite</span>
            <h2>Chaos qualification</h2>
          </div>
          <Badge
            variant={replayChaos.status === "PASS" ? "verified" : "muted"}
          >
            {replayChaos.passCount}/{replayChaos.caseCount} PASS
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="chaos-case-list">
            {replayChaos.cases.map((item, index) => (
              <div className="chaos-case-row" key={item.caseId}>
                <span className="chaos-case-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.caseId.replaceAll("_", " ")}</span>
                </div>
                <code>{item.observedPosture}</code>
                <Badge variant={item.passed ? "verified" : "muted"}>
                  {item.passed ? "PASS" : "FAIL"}
                </Badge>
              </div>
            ))}
          </div>
          <div className="evidence-identity-strip">
            <div>
              <span>Suite identity</span>
              <code>{replayChaos.suiteHash}</code>
            </div>
            <div>
              <span>Campaign artifact</span>
              <code>{campaignEvidence.artifactHash}</code>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="terminal-card">
        <div className="terminal-topbar">
          <div>
            <span />
            <span />
            <span />
          </div>
          <span>pmh · evidence inspect</span>
          <SquareTerminal size={15} />
        </div>
        <pre>
          <code>
            {JSON.stringify(
              {
                schemaVersion: campaignEvidence.schemaVersion,
                campaignId: campaignEvidence.campaignId,
                checkpointId: campaignEvidence.checkpointId,
                status: campaignEvidence.status,
                artifactHash: campaignEvidence.artifactHash,
                reviewedCompilation: {
                  scope: reviewedCompilation.scope,
                  status: reviewedCompilation.status,
                  artifactHash: reviewedCompilation.artifactHash,
                  certificate: reviewedCompilation.certificate.id,
                },
                effects: campaignEvidence.effects,
              },
              null,
              2,
            )}
          </code>
        </pre>
      </Card>
    </section>
  );
}

function CertificateDrawer({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity | null;
  onClose: () => void;
}) {
  const studioProjection = useStudioProjection();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <>
      <button
        className={cn("drawer-scrim", opportunity && "is-open")}
        aria-label="Close certificate"
        onClick={onClose}
      />
      <aside
        className={cn("certificate-drawer", opportunity && "is-open")}
        aria-hidden={opportunity === null}
        aria-label="Certificate detail"
      >
        {opportunity && (
          <>
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">Exact synthetic fixture certificate</span>
                <h2>{opportunity.title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close certificate"
                onClick={onClose}
              >
                <PanelRightClose size={18} />
              </Button>
            </div>
            <div className="certificate-seal">
              <ShieldCheck size={32} />
              <div>
                <Badge variant="verified">Fixture verified exact</Badge>
                <strong>{opportunity.floor} worst-case payoff</strong>
                <span>after fees, rounding, and capital bounds</span>
              </div>
            </div>
            <dl className="certificate-facts">
              <div>
                <dt>Certificate</dt>
                <dd>{opportunity.certificate}</dd>
              </div>
              <div>
                <dt>Bound capital</dt>
                <dd>{opportunity.capital}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{opportunity.evidence}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd className="violet-text">SHADOW ONLY</dd>
              </div>
            </dl>
            <div className="drawer-trace">
              {studioProjection.trace.map(([name, verdict], index) => (
                <div key={name}>
                  <span>
                    {verdict === "BLOCKED" ? <CircleOff size={11} /> : index + 1}
                  </span>
                  <strong>{name}</strong>
                  <Badge variant={verdict === "PASS" ? "verified" : "shadow"}>
                    {verdict}
                  </Badge>
                </div>
              ))}
            </div>
            <Button
              className="drawer-action"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(opportunity.certificate);
                setCopied(true);
              }}
            >
              <Fingerprint size={15} />
              {copied ? "Evidence identity copied" : "Copy evidence identity"}
            </Button>
          </>
        )}
      </aside>
    </>
  );
}

function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
}) {
  if (!open) return null;
  return (
    <div className="command-layer" role="dialog" aria-modal="true">
      <button
        className="command-scrim"
        aria-label="Close command menu"
        onClick={onClose}
      />
      <div className="command-palette">
        <div className="command-input">
          <Search size={16} />
          <Input
            autoFocus
            aria-label="Search commands"
            placeholder="Jump to a projection…"
          />
          <kbd>ESC</kbd>
        </div>
        <span className="command-group-label">Available projections</span>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              <small>Open</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StudioShell({ projectionSync }: { projectionSync: ProjectionSyncState }) {
  const [view, setView] = useState<View>(() =>
    parseWorkspaceRoute(window.location.search).view
  );
  const [focusedProposalIds, setFocusedProposalIds] = useState<readonly string[]>(() =>
    parseWorkspaceRoute(window.location.search).proposalIds
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  function navigate(nextView: View, proposalIds: readonly string[] = []): void {
    const search = serializeWorkspaceRoute(nextView, proposalIds);
    window.history.pushState(null, "", `${window.location.pathname}${search}`);
    const route = parseWorkspaceRoute(search);
    setView(route.view);
    setFocusedProposalIds(route.proposalIds);
    setMobileOpen(false);
  }

  useEffect(() => {
    function restoreRoute() {
      const route = parseWorkspaceRoute(window.location.search);
      setView(route.view);
      setFocusedProposalIds(route.proposalIds);
      setMobileOpen(false);
    }
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view]);

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onViewChange={(nextView) => navigate(nextView)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="workspace">
        <Topbar
          view={view}
          projectionSync={projectionSync}
          onMenu={() => setMobileOpen(true)}
          onCommand={() => setCommandOpen(true)}
        />
        <main>
          {view === "overview" && <Overview onInspect={setOpportunity} />}
          {view === "agents" && <AgentOperationsView />}
          {view === "archaeologist" && <MarketArchaeologistView />}
          {view === "lifecycle" && (
            <OpportunityLifecycleView
              focusedProposalIds={focusedProposalIds}
              onClearFocus={() => navigate("lifecycle")}
            />
          )}
          {view === "radar" && <OpportunityRadarView />}
          {view === "preflight" && <RealCandidatePreflightView />}
          {view === "scouts" && (
            <ScoutInboxView
              onOpenReview={(proposalIds) => navigate("lifecycle", proposalIds)}
            />
          )}
          {view === "budgets" && (
            <FailureBudgetView
              onOpenEvidence={(proposalIds) => navigate("evidence", proposalIds)}
            />
          )}
          {view === "cases" && <ResearchCaseDeskView />}
          {view === "venues" && <VenueMatrix />}
          {view === "books" && <BookDeskView />}
          {view === "evidence" && (
            <EvidenceView
              focusedProposalIds={focusedProposalIds}
              onClearFocus={() => navigate("evidence")}
            />
          )}
        </main>
        <footer>
          <span>
            <Radar size={13} />
            Pre-alpha research workspace
          </span>
          <span>Displayed opportunities are research evidence, not orders.</span>
        </footer>
      </div>
      <CertificateDrawer
        opportunity={opportunity}
        onClose={() => setOpportunity(null)}
      />
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={(nextView) => navigate(nextView)}
      />
    </div>
  );
}

function AgentWorkspaceShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { readiness, diagnostic } = useControlPlaneReadiness();
  const sync: ProjectionSyncState = Object.freeze({
    status: diagnostic === null ? readiness === null ? "CONNECTING" : "LIVE" : "RECONNECTING",
    revision: null,
    lastUpdatedAt: readiness?.completedAt ?? readiness?.phaseStartedAt ?? null,
    readiness,
  });
  const navigate = (view: View): void => {
    window.location.assign(serializeWorkspaceRoute(view));
  };
  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);
  return (
    <div className="app-shell" data-read-model="view-local-agents">
      <Sidebar
        view="agents"
        onViewChange={navigate}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        statusMode="VIEW_LOCAL"
        localReadiness={readiness}
        localDiagnostic={diagnostic}
      />
      <div className="workspace">
        <Topbar
          view="agents"
          projectionSync={sync}
          onMenu={() => setMobileOpen(true)}
          onCommand={() => setCommandOpen(true)}
        />
        <main><AgentOperationsView /></main>
        <footer>
          <span><Radar size={13} /> View-local Agent read model</span>
          <span>No global Studio projection required.</span>
        </footer>
      </div>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={navigate}
      />
    </div>
  );
}

export default function App() {
  const initialView = parseWorkspaceRoute(window.location.search).view;
  if (workspaceReadModel(initialView) === "VIEW_LOCAL") return <AgentWorkspaceShell />;
  return <GlobalProjectionApp />;
}

function GlobalProjectionApp() {
  const { projection, diagnostic, sync } = useControlPlaneProjection();
  if (projection === null) {
    const readiness = sync.readiness;
    const phaseCopy = readiness === null
      ? "Waiting for the backend process to publish its first projection."
      : {
          STARTUP_GATE: "Waiting for this backend process to own the local service.",
          DURABLE_RECOVERY: "Restoring retained books, catalogs, and research state.",
          AGENT_RECONCILIATION: "Reconciling retained Agent tasks and run lineage.",
          WAITING_FOR_PROJECTION: "Durable recovery is complete; preparing the Studio view.",
          MATERIALIZING_PROJECTION: "Building the first bounded Studio projection.",
          READY: "The research desk is ready.",
          FAILED: readiness.diagnostic ?? "Control-plane startup failed.",
        }[readiness.phase];
    return (
      <main className="control-plane-gate">
        <SignalMark />
        <span className="eyebrow">Harmony control plane</span>
        <h1>{diagnostic === null ? "Preparing the research desk…" : "Desk offline"}</h1>
        <p>
          {diagnostic ?? `${phaseCopy}${readiness === null ? "" : ` · ${(readiness.elapsedMs / 1_000).toFixed(1)}s elapsed`}`}
        </p>
        <Badge variant={diagnostic === null ? "muted" : "warning"}>
          {diagnostic === null ? readiness?.phase.replaceAll("_", " ") ?? "CONNECTING" : "BACKEND REQUIRED"}
        </Badge>
      </main>
    );
  }
  return (
    <StudioProjectionProvider projection={projection}>
      <StudioShell projectionSync={sync} />
    </StudioProjectionProvider>
  );
}
