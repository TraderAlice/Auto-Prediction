import { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  Boxes,
  Braces,
  ChevronRight,
  CircleOff,
  Clock3,
  Command,
  Database,
  FileCheck2,
  Fingerprint,
  Gauge,
  GitBranch,
  Hexagon,
  Inbox,
  LayoutDashboard,
  Menu,
  Network,
  PanelRightClose,
  Pause,
  Play,
  Plus,
  Radar,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  TestTubeDiagonal,
  TimerReset,
  Waypoints,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  StudioProjectionProvider,
  resolveReviewIntake,
  useControlPlaneProjection,
  useStudioProjection,
  type StudioProjection,
} from "@/data/studio-projection";
import { cn } from "@/lib/utils";

type View =
  | "overview"
  | "archaeologist"
  | "lifecycle"
  | "radar"
  | "preflight"
  | "scouts"
  | "cases"
  | "venues"
  | "books"
  | "evidence";
type Opportunity = StudioProjection["opportunities"][number];
type ResearchCase = StudioProjection["ai"]["researchDesk"]["cases"][number];
type RadarCandidate = StudioProjection["ai"]["opportunityRadar"]["candidates"][number];
type SearchIssue = StudioProjection["ai"]["searchIssueScheduler"]["issues"][number];
type SearchAttentionMessage = StudioProjection["ai"]["searchAttention"]["messages"][number];
type CatalogMode = "VERIFIED_FIXTURES" | "CURRENT_OBSERVATIONS";

function formatRateBps(value: number | null): string {
  if (value === null) return "—";
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}%`;
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

const EMPTY_SEMANTIC_REVIEW_ADMISSION: StudioProjection["ai"]["semanticReviewAdmission"] = {
  schemaVersion: "pmh.semantic-review-admission-desk.v1",
  policy: "TWO_DISTINCT_LISTINGS_AND_COMPILABLE_RELATION_V1",
  candidateCount: 0,
  autoReviewCount: 0,
  researchOnlyCount: 0,
  autoReviewRateBps: null,
  countsByReason: {
    TWO_LISTING_COMPILABLE_RELATION: 0,
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
  bundledJobCount: 0,
  capturedOriginalJobCount: 0,
  rebasedJobCount: 0,
  legacyEvidenceDebtCount: 0,
  passedCount: 0,
  exhaustedCount: 0,
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
  algorithmVersion: "pmh.ai-search-leases.v1",
  enabled: false,
  configured: { fastLane: true, deepLane: false },
  status: "IDLE",
  activeCount: 0,
  concurrencyLimit: 1,
  intervalMs: null,
  retentionLimit: 40,
  lensOrder: ["EQUIVALENCE", "IMPLICATION", "PARTITION", "MECHANISM"],
  budget: {
    maxFastModelRequests: 1,
    maxPiInvocations: 1,
    maxHypotheses: 8,
    deadlineMs: 300_000,
  },
  runCount: 0,
  passCount: 0,
  failedCount: 0,
  issuedCount: 0,
  duplicateCount: 0,
  piEscalationCount: 0,
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
  activeCount: 0,
  issueCount: 0,
  enabledIssueCount: 0,
  dueIssueCount: 0,
  unreadNotificationCount: 0,
  performance: {
    measurementWindow: "RETAINED_TERMINAL_LEASES",
    retainedLeaseLimit: 40,
    terminalLeaseCount: 0,
    novelCandidateCount: 0,
    duplicateCount: 0,
    piEscalationCount: 0,
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
    proposalCount: 0,
    evidenceGapCount: 0,
    novelCandidateRateBps: null,
    duplicateRateBps: null,
    piEscalationRateBps: null,
    economicGatePositiveRateBps: null,
    byIssue: [],
  },
  issues: [],
  notifications: [],
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
  schemaVersion: "pmh.search-outcome-attribution.v1",
  attributionIdentity: `sha256:${"0".repeat(64)}`,
  sourceSetIdentity: `sha256:${"0".repeat(64)}`,
  sourceArtifactCount: 0,
  measurementBasis: "DISTINCT_PROPOSALS_FROM_PASSED_ISSUE_LEASES",
  issueCount: 0,
  attributedLeaseCount: 0,
  attributedProposalCount: 0,
  totalAiProposalCount: 0,
  unattributedAiProposalCount: 0,
  multiIssueProposalCount: 0,
  invalidProposalReferenceCount: 0,
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
  bottlenecks: {
    pendingReviewCount: 0,
    reviewFailedCount: 0,
    pendingOperatorDecisionCount: 0,
    materializationBlockedCount: 0,
    simulationBlockedCount: 0,
    exactRejectedCount: 0,
    shadowDivergedCount: 0,
    missingEvidenceCount: 0,
  },
  byIssue: [],
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
  sourceSnapshotIdentity: `sha256:${"0".repeat(64)}`,
  sourceArtifactHashes: [],
  listingCount: 0,
  claimNodeCount: 0,
  timeWindowNodeCount: 0,
  resolutionBindingNodeCount: 0,
  relationCount: 0,
  feedbackCount: 0,
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
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "archaeologist", label: "Market archaeologist", icon: Search },
  { id: "lifecycle", label: "Opportunity lifecycle", icon: GitBranch },
  { id: "radar", label: "Opportunity radar", icon: Radar },
  { id: "preflight", label: "Candidate preflight", icon: FileCheck2 },
  { id: "scouts", label: "Scout inbox", icon: Inbox },
  { id: "cases", label: "Research cases", icon: Waypoints },
  { id: "venues", label: "Venue matrix", icon: Network },
  { id: "books", label: "Book desk", icon: BookOpenCheck },
  { id: "evidence", label: "Evidence", icon: Fingerprint },
] as const;

const supplementalNavigation = [
  { label: "Claims", icon: Braces },
  { label: "Capital", icon: Gauge },
  { label: "Campaigns", icon: TestTubeDiagonal },
] as const;

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
): Promise<boolean> {
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
  return result.idempotentReplay === true;
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

function VenuePulse() {
  const studioProjection = useStudioProjection();
  return (
    <div className="venue-pulse">
      <div className="pulse-heading">
        <span>Adapter pulse</span>
        <Badge variant="verified">
          {studioProjection.venues.length} registered
        </Badge>
      </div>
      <div className="pulse-list">
        {studioProjection.venues.map((venue) => (
          <div className="pulse-row" key={venue.id}>
            <span
              className="venue-dot"
              style={{ backgroundColor: venue.color }}
            />
            <span>{venue.name}</span>
            <span className="pulse-score">{venue.health}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sidebar({
  view,
  onViewChange,
  mobileOpen,
  onMobileClose,
}: {
  view: View;
  onViewChange: (view: View) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
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
            <span>HARMONY</span>
            <small>MARKET HARNESS</small>
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
          {navigation.map((item) => {
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

          <span className="nav-label nav-label-spaced">Core</span>
          {supplementalNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button className="nav-item is-muted" key={item.label}>
                <Icon size={17} />
                <span>{item.label}</span>
                <span className="soon">soon</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <VenuePulse />
          <div className="authority-note">
            <CircleOff size={15} />
            <div>
              <strong>Live authority absent</strong>
              <span>No signing · no value movement</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  onMenu,
  onCommand,
}: {
  onMenu: () => void;
  onCommand: () => void;
}) {
  const studioProjection = useStudioProjection();
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
        <div>
          <span className="eyebrow">Architecture qualification</span>
          <strong>AI discovery desk</strong>
        </div>
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
        <Badge variant="shadow">
          <Sparkles size={10} />
          Shadow only
        </Badge>
        <span className="header-hash">
          <GitBranch size={13} />
          {studioProjection.identity.stateHash.slice(7, 14)}
        </span>
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

function Overview({
  onInspect,
}: {
  onInspect: (opportunity: Opportunity) => void;
}) {
  const studioProjection = useStudioProjection();
  const catalogContext =
    studioProjection.ai.catalogContext ?? EMPTY_CATALOG_CONTEXT;
  const catalogObservation = studioProjection.ai.catalogObservation;
  const [scoutStatus, setScoutStatus] = useState<
    "IDLE" | "RUNNING" | "PROPOSED" | "FAILED"
  >("IDLE");
  const [refreshStatus, setRefreshStatus] = useState<
    "IDLE" | "RUNNING" | "READY" | "DEGRADED" | "FAILED"
  >("IDLE");

  async function runScout(): Promise<void> {
    setScoutStatus("RUNNING");
    try {
      await requestDiscoveryRun(
        "Highest temperature in Boston on July 31, 2026?",
        ["gemini-predictions"],
      );
      setScoutStatus("PROPOSED");
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
            Evidence current
          </Badge>
          <h1>
            Cross-venue truth,
            <br />
            <span>before execution.</span>
          </h1>
          <p>
            Let an agent search market meaning recursively, then normalize
            contract semantics and prove the payoff floor—without granting a
            browser or model the authority to trade.
          </p>
        </div>
        <div className="hero-identity">
          <span className="identity-kicker">
            <Hexagon size={13} />
            Projection identity
          </span>
          <code>{studioProjection.identity.stateHash}</code>
          <div>
            <Badge variant="muted">{studioProjection.identity.mode}</Badge>
            <span>pmh.studio-projection.v1</span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="System metrics">
        <Metric
          label="Venue families"
          value={`${studioProjection.system.observedVenueFamilies}`}
          detail="official-source census"
        />
        <Metric
          label="Catalog adapters"
          value={`${studioProjection.system.catalogAdapters}`}
          detail={`${studioProjection.system.realtimeBookAdapters} books · ${studioProjection.system.inertOrderGateways} inert gates`}
        />
        <Metric
          label="Proof tests"
          value={`${studioProjection.system.proofTests}`}
          detail="all passing"
        />
        <Metric label="Live execution" value="OFF" detail="hard policy" />
      </section>

      <section className="ai-rack" aria-label="AI discovery workers">
        <div className="ai-rack-heading">
          <div className="ai-rack-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="eyebrow">Agent search · exact verification</span>
            <strong>AI-native discovery pool</strong>
          </div>
        </div>
        <div className="worker-chips">
          {studioProjection.ai.workers.map((worker) => (
            <span key={worker.workerId}>
              <i className={worker.status === "READY" ? "is-ready" : ""} />
              {worker.workerId}
              <small>{worker.status.replaceAll("_", " ")}</small>
            </span>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={scoutStatus === "RUNNING"}
            onClick={() => void runScout()}
          >
            <Sparkles size={11} />
            {scoutStatus === "RUNNING"
              ? "Scouting…"
              : scoutStatus === "PROPOSED"
                ? "Proposal ready"
                : scoutStatus === "FAILED"
                  ? "Retry scout"
                  : "Run scout"}
          </Button>
        </div>
        <div className="ai-boundary">
          <Gauge size={14} />
          <span>
            {studioProjection.ai.modelProvider.model} · max{" "}
            {studioProjection.ai.modelProvider.maxOutputTokens} output tokens ·{" "}
            {studioProjection.ai.modelProvider.timeoutMs / 1_000}s · {" "}
            {studioProjection.ai.modelProvider.fanout} model scout
            {studioProjection.ai.modelProvider.fanout === 1 ? "" : "s"} ·{" "}
            {studioProjection.ai.modelProvider.transport.replaceAll("_", " ")}
            {" · "}
            {studioProjection.ai.modelProvider.responseStorage === false
              ? "responses not stored"
              : "provider retention policy"}
          </span>
        </div>
        <div className="ai-boundary">
          <SquareTerminal size={14} />
          <span>
            pi investigator · {studioProjection.ai.investigator.model} ·{" "}
            {studioProjection.ai.investigator.mode.replaceAll("_", " ")} ·{" "}
            {studioProjection.ai.investigator.tools.join("/")} only ·{" "}
            {studioProjection.ai.investigator.configured
              ? "READY"
              : "NEEDS KEY"}
          </span>
        </div>
        <div className="ai-boundary">
          <Database size={14} />
          <span>
            {catalogContext.listingCount} listings · {catalogContext.venueCount}{" "}
            venues · {catalogContext.sourceFixtureCount} verified fixtures ·
            context {catalogContext.corpusIdentity.slice(7, 14)}
          </span>
        </div>
        <div className="ai-boundary">
          <Radio size={14} />
          <span>
            live catalog observation · {catalogObservation.listingCount} listings
            · {catalogObservation.healthySourceCount}/{catalogObservation.sourceCount}{" "}
            sources · {catalogObservation.status} · {catalogObservation.storage.mode}
            {catalogObservation.storage.durable
              ? ` v${catalogObservation.storage.schemaVersion}`
              : ""}{" "}
            · OBSERVE ONLY
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={refreshStatus === "RUNNING"}
            onClick={() => void refreshCatalog()}
          >
            <RefreshCw size={11} />
            {refreshStatus === "RUNNING"
              ? "Refreshing…"
              : refreshStatus === "FAILED"
                ? "Retry refresh"
                : "Refresh catalogs"}
          </Button>
        </div>
        <div className="ai-boundary">
          <ShieldCheck size={14} />
          <span>{studioProjection.ai.promotionBoundary}</span>
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
  const [issueAction, setIssueAction] = useState<string | null>(null);
  const [issueDiagnostic, setIssueDiagnostic] = useState<string | null>(null);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueQuestion, setNewIssueQuestion] = useState("");
  const [newIssueLens, setNewIssueLens] = useState<SearchIssue["lens"]>("EQUIVALENCE");
  const [newIssueCadenceMinutes, setNewIssueCadenceMinutes] = useState(15);
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
          <span className="eyebrow">AI-native discovery · recursive search</span>
          <h1>Market archaeologist</h1>
          <p>
            pi explores the complete, content-addressed MarketFS snapshot like a
            repository. Programs freeze evidence and enforce bounds; the agent
            chooses aliases, searches, and semantic paths.
          </p>
        </div>
        <div className="archaeology-heading-badges">
          <Badge variant="verified">PRIMARY DISCOVERY</Badge>
          <Badge variant={desk.configured ? "shadow" : "warning"}>
            {desk.configured ? `${desk.model} · PI` : "KEY REQUIRED"}
          </Badge>
        </div>
      </div>

      <div className="radar-summary-grid archaeology-summary-grid">
        <Metric
          label="MarketFS corpus"
          value={`${corpus.listingCount}`}
          detail="fresh public listings"
        />
        <Metric
          label="Eligible sources"
          value={`${corpus.eligibleSourceCount}`}
          detail={
            catalogRefreshScheduler.enabled
              ? `${corpus.excludedSourceCount} excluded · auto every ${(catalogRefreshScheduler.intervalMs ?? 0) / 60_000}m`
              : `${corpus.excludedSourceCount} excluded · manual refresh`
          }
        />
        <Metric
          label="Search issues"
          value={`${issueScheduler.enabledIssueCount}`}
          detail={`${issueScheduler.activeCount}/${issueScheduler.concurrencyLimit} agents running`}
        />
        <Metric
          label="Semantic graph"
          value={`${graph.relationCount}`}
          detail={`${graph.feedbackCount} empirical outcomes`}
        />
      </div>

      <Card className="issue-scheduler-console">
        <CardHeader>
          <div>
            <span className="eyebrow">Durable issue queue · concurrent bounded agents</span>
            <h2>Scheduled search desk</h2>
          </div>
          <div className="issue-scheduler-badges">
            <Badge variant={issueScheduler.enabled ? "shadow" : "muted"}>
              <Clock3 size={11} /> TIMER {issueScheduler.enabled ? "ON" : "OFF"}
            </Badge>
            <Badge
              variant={
                catalogRefreshScheduler.lastResult === "DEGRADED" ||
                catalogRefreshScheduler.lastResult === "FAILED"
                  ? "warning"
                  : catalogRefreshScheduler.enabled
                    ? "verified"
                    : "muted"
              }
            >
              <RefreshCw
                className={catalogRefreshScheduler.status === "REFRESHING" ? "is-spinning" : undefined}
                size={11}
              />{" "}
              CORPUS {catalogRefreshScheduler.status === "REFRESHING"
                ? "REFRESHING"
                : catalogRefreshScheduler.enabled
                  ? `AUTO ${(catalogRefreshScheduler.intervalMs ?? 0) / 60_000}m`
                  : "MANUAL"}
            </Badge>
            <Badge variant={issueScheduler.unreadNotificationCount > 0 ? "warning" : "muted"}>
              <Bell size={11} /> {issueScheduler.unreadNotificationCount} UNREAD
            </Badge>
            <Badge variant={scheduler.missingCorpusIssuedCount > 0 ? "warning" : "verified"}>
              <Database size={11} /> {scheduler.retainedCorpusCount} CORPORA · {scheduler.recoverableIssuedCount} RESUMABLE
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="issue-scheduler-strip">
            <div><strong>{issueScheduler.issueCount}</strong><span>durable issues</span></div>
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

          <div className="issue-scheduler-strip issue-performance-strip">
            <div><strong>{issuePerformance.terminalLeaseCount}</strong><span>retained completed scans</span></div>
            <div><strong>{formatRateBps(issuePerformance.novelCandidateRateBps)}</strong><span>new candidate signatures</span></div>
            <div><strong>{formatRateBps(issuePerformance.duplicateRateBps)}</strong><span>duplicate scans</span></div>
            <div><strong>{formatRateBps(issuePerformance.piEscalationRateBps)}</strong><span>pi escalation · {issuePerformance.proposalCount} proposals · {issuePerformance.evidenceGapCount} gaps</span></div>
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
              <span>routine scans roll into hourly digests · action and degradation notify immediately</span>
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
              <span><b>{outcomeAttribution.bottlenecks.pendingReviewCount}</b> pending review</span>
              <span><b>{outcomeAttribution.bottlenecks.reviewFailedCount}</b> review failed</span>
              <span><b>{outcomeAttribution.bottlenecks.pendingOperatorDecisionCount}</b> pending operator</span>
              <span><b>{outcomeAttribution.bottlenecks.materializationBlockedCount}</b> market evidence blocked</span>
              <span><b>{outcomeAttribution.bottlenecks.simulationBlockedCount}</b> simulation blocked</span>
              <span><b>{outcomeAttribution.bottlenecks.missingEvidenceCount}</b> evidence gaps</span>
              {outcomeAttribution.multiIssueProposalCount > 0 && <span><b>{outcomeAttribution.multiIssueProposalCount}</b> multi-issue proposals</span>}
              {outcomeAttribution.invalidProposalReferenceCount > 0 && <span className="is-warning"><b>{outcomeAttribution.invalidProposalReferenceCount}</b> invalid proposal refs</span>}
              {outcomeAttribution.lifecycleMissingCount > 0 && <span className="is-warning"><b>{outcomeAttribution.lifecycleMissingCount}</b> lifecycle missing</span>}
            </div>
          </section>

          <div className="issue-scheduler-workbench">
            <section className="search-issue-list" aria-label="Scheduled search issues">
              <div className="issue-column-heading">
                <div><GitBranch size={14} /><strong>Search issues</strong></div>
                <span>priority first · one lease per corpus snapshot</span>
              </div>
              {issueScheduler.issues.map((issue) => {
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
                      </div>
                      <code>{issue.issueId.slice(7, 14)}</code>
                    </div>
                    <h3>{issue.title}</h3>
                    <p>{issue.question}</p>
                    <div className="search-issue-meta">
                      {issue.candidatePolicy !== undefined && issue.candidatePolicy !== null && (
                        <span className="is-policy">
                          target {issue.candidatePolicy.allowedRelationKinds.join("/")} · exactly {issue.candidatePolicy.exactListingRefCount} refs
                          {issue.candidatePolicy.requirePositiveGrossHint === true ? " · positive gross gate" : ""}
                        </span>
                      )}
                      <span>every {issue.cadenceMs / 60_000}m</span>
                      <span>next {new Date(issue.nextRunAt).toLocaleString()}</span>
                      <span>{issue.passCount}/{issue.runCount} passed</span>
                      <span>{performance?.novelCandidateCount ?? 0} new · {performance?.duplicateCount ?? 0} repeat · {performance?.piEscalationCount ?? 0} pi</span>
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
                      <span>{outcome?.reviewedCount ?? 0}/{outcome?.proposalCount ?? 0} reviewed · {outcome?.operatorAcceptedCount ?? 0} accepted · {outcome?.certifiedCount ?? 0} certified</span>
                      <span>{outcome?.positiveGrossHintCount ?? 0} positive · {outcome?.nonPositiveGrossHintCount ?? 0} non-positive · {outcome?.economicUnavailableCount ?? 0} unpriceable</span>
                    </div>
                    <div className="search-issue-actions">
                      <Button
                        variant="outline"
                        disabled={corpus.listingCount === 0 || issueAction !== null}
                        onClick={() => void runIssue(issue.issueId)}
                      >
                        {issueAction === `RUN:${issue.issueId}` ? <RefreshCw className="is-spinning" size={13} /> : <Play size={13} />}
                        Run now
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={issueAction !== null}
                        onClick={() => void toggleIssue(issue)}
                      >
                        {issue.enabled ? <Pause size={13} /> : <Play size={13} />}
                        {issue.enabled ? "Pause" : "Resume"}
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
                  <span>Empty or duplicate scans do not notify.</span>
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
              <span className="eyebrow"><Plus size={12} /> New bounded search issue</span>
              <input aria-label="Search issue title" placeholder="Issue title" maxLength={120} required value={newIssueTitle} onChange={(event) => setNewIssueTitle(event.target.value)} />
              <textarea aria-label="Search issue question" placeholder="What recurring semantic pattern should the agent search and try to falsify?" maxLength={1000} required value={newIssueQuestion} onChange={(event) => setNewIssueQuestion(event.target.value)} />
            </div>
            <label>
              <span>Lens</span>
              <select value={newIssueLens} onChange={(event) => setNewIssueLens(event.target.value as SearchIssue["lens"])}>
                {scheduler.lensOrder.map((lens) => <option key={lens} value={lens}>{lens}</option>)}
              </select>
            </label>
            <label>
              <span>Cadence</span>
              <select value={newIssueCadenceMinutes} onChange={(event) => setNewIssueCadenceMinutes(Number(event.target.value))}>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={360}>6 hours</option>
              </select>
            </label>
            <Button disabled={issueAction !== null || newIssueTitle.trim() === "" || newIssueQuestion.trim() === ""} type="submit">
              {issueAction === "CREATE" ? <RefreshCw className="is-spinning" size={13} /> : <Plus size={13} />}
              Create issue
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
        </CardContent>
      </Card>

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
            <div><Sparkles size={14} /><span>cheap model</span><strong>≤ {scheduler.budget.maxFastModelRequests} request</strong></div>
            <div><SquareTerminal size={14} /><span>pi deep search</span><strong>≤ {scheduler.budget.maxPiInvocations} invocation</strong></div>
            <div><Gauge size={14} /><span>deadline</span><strong>{scheduler.budget.deadlineMs / 1000}s</strong></div>
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
                leaseStatus === "RUNNING"
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
          <textarea
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
          {scheduler.records.slice(0, 8).map((record) => (
            <article key={record.lease.leaseId}>
              <div>
                <Badge variant={record.status === "PASS" ? "verified" : record.status === "ISSUED" ? "shadow" : "warning"}>
                  {record.status}
                </Badge>
                <strong>{record.lease.lens}</strong>
                <span>{record.trigger}</span>
              </div>
              <p>{record.lease.thesis}</p>
              <div>
                <code>{record.outcome.hypothesisCount} candidates</code>
                <code>{record.deepLane.runId === null ? record.deepLane.reason : "PI ESCALATED"}</code>
                <code>{record.outcome.evidenceGapCount} gaps</code>
                {record.lease.graphContext != null && <code>GRAPH BOUND</code>}
                {record.lineage.duplicateOfLeaseId !== null && <code>DUPLICATE LINK</code>}
              </div>
            </article>
          ))}
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
    </section>
  );
}

function OpportunityLifecycleView() {
  const studioProjection = useStudioProjection();
  const desk = studioProjection.opportunityLifecycle;
  const semanticReview =
    studioProjection.ai.semanticReview ?? EMPTY_SEMANTIC_REVIEW;
  const reviewAdmission =
    studioProjection.ai.semanticReviewAdmission ?? EMPTY_SEMANTIC_REVIEW_ADMISSION;
  const reviewScheduler =
    studioProjection.ai.semanticReviewScheduler ?? EMPTY_SEMANTIC_REVIEW_SCHEDULER;
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
  const [reviewNotificationAction, setReviewNotificationAction] = useState<string | null>(null);
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
  const awaiting = desk.cases.filter((item) => item.nextAction !== "NONE").length;
  const rejected = desk.cases.filter((item) =>
    item.state.startsWith("REJECTED"),
  ).length;

  async function acknowledgeReviewNotification(notificationId: string): Promise<void> {
    setReviewNotificationAction(notificationId);
    try {
      await requestReviewNotificationAcknowledgement(notificationId);
    } finally {
      setReviewNotificationAction(null);
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
          <Badge variant="warning">LIVE ROUTE ABSENT</Badge>
        </div>
      </div>

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
          label="Public evidence"
          value={`${simulationMaterializer.retainedRawSourceCount}`}
          detail={`${simulationMaterializer.storage.durable ? "SQLite WAL" : "memory"} · content addressed`}
        />
      </div>

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
            <strong>{reviewScheduler.bundledJobCount}/{reviewScheduler.jobs.length}</strong>
            <span>evidence bundled · {reviewScheduler.legacyEvidenceDebtCount} legacy debt</span>
          </div>
          <div><strong>{reviewScheduler.passedCount}</strong><span>reviewed</span></div>
          <div><strong>{reviewScheduler.exhaustedCount}</strong><span>exhausted</span></div>
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
            Turns accepted binary implications and partitions into canonical
            truth states and buy-only complete-payout templates. Related or
            conditional semantics stay blocked.
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
        <code>{desk.defaultPolicy.routeAfterCertificate}</code>
      </div>

      {desk.cases.length === 0 ? (
        <div className="radar-empty">
          <GitBranch size={28} />
          <strong>No opportunity has entered the lifecycle</strong>
          <span>Run market archaeology or load a deterministic screen.</span>
        </div>
      ) : (
        <div className="lifecycle-case-list">
          {desk.cases.map((item) => {
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
                          <textarea
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

function ScoutInboxView() {
  const studioProjection = useStudioProjection();
  const catalogContext =
    studioProjection.ai.catalogContext ?? EMPTY_CATALOG_CONTEXT;
  const catalogObservation = studioProjection.ai.catalogObservation;
  const eligibleVenues = studioProjection.venues.filter((venue) =>
    venue.capabilities.includes("MARKET_CATALOG"),
  );
  const [question, setQuestion] = useState(
    "Highest temperature in Boston on July 31, 2026?",
  );
  const [selectedVenueIds, setSelectedVenueIds] = useState<readonly string[]>([
    "gemini-predictions",
  ]);
  const [catalogMode, setCatalogMode] = useState<CatalogMode>(
    "VERIFIED_FIXTURES",
  );
  const [runStatus, setRunStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [investigationStatus, setInvestigationStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [investigationDiagnostic, setInvestigationDiagnostic] = useState<
    string | null
  >(null);
  const liveContextEligible =
    catalogMode === "VERIFIED_FIXTURES" ||
    selectedVenueIds.every(
      (venueId) =>
        catalogObservation.sources.find((source) => source.venueId === venueId)
          ?.contextEligible === true,
    );

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
      const restored = await requestDiscoveryRun(
        question.trim(),
        selectedVenueIds,
        catalogMode,
      );
      setRunStatus(restored ? "RESTORED" : "DONE");
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
        <span className="eyebrow">Subjective search · bounded authority</span>
        <h1>Scout inbox</h1>
        <p>
          Cheap workers can broaden the search surface and suggest semantic
          connections. Every result lands here as an unreviewed proposal; none
          can become a claim link, certificate, or order by itself.
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
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
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
              </article>
            ))
          )}
          </div>
        </div>
      </div>
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

function EvidenceView() {
  const studioProjection = useStudioProjection();
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

  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Immutable trail</span>
        <h1>Evidence inventory</h1>
        <p>
          Normalized facts remain linked to the raw bytes, protocol identity,
          receive time, and exact verifier inputs that produced them.
        </p>
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
          <input
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

function StudioShell() {
  const [view, setView] = useState<View>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

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
        onViewChange={setView}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="workspace">
        <Topbar
          onMenu={() => setMobileOpen(true)}
          onCommand={() => setCommandOpen(true)}
        />
        <main>
          {view === "overview" && <Overview onInspect={setOpportunity} />}
          {view === "archaeologist" && <MarketArchaeologistView />}
          {view === "lifecycle" && <OpportunityLifecycleView />}
          {view === "radar" && <OpportunityRadarView />}
          {view === "preflight" && <RealCandidatePreflightView />}
          {view === "scouts" && <ScoutInboxView />}
          {view === "cases" && <ResearchCaseDeskView />}
          {view === "venues" && <VenueMatrix />}
          {view === "books" && <BookDeskView />}
          {view === "evidence" && <EvidenceView />}
        </main>
        <footer>
          <span>
            <Radar size={13} />
            PRE-ALPHA · CONTROL PLANE
          </span>
          <span>All displayed opportunities are non-executable evidence.</span>
        </footer>
      </div>
      <CertificateDrawer
        opportunity={opportunity}
        onClose={() => setOpportunity(null)}
      />
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={setView}
      />
    </div>
  );
}

export default function App() {
  const { projection, diagnostic } = useControlPlaneProjection();
  if (projection === null) {
    return (
      <main className="control-plane-gate">
        <SignalMark />
        <span className="eyebrow">Harmony control plane</span>
        <h1>{diagnostic === null ? "Connecting to the desk…" : "Desk offline"}</h1>
        <p>
          {diagnostic ??
            "Waiting for the backend process to publish its first projection."}
        </p>
        <Badge variant={diagnostic === null ? "muted" : "warning"}>
          {diagnostic === null ? "CONNECTING" : "BACKEND REQUIRED"}
        </Badge>
      </main>
    );
  }
  return (
    <StudioProjectionProvider projection={projection}>
      <StudioShell />
    </StudioProjectionProvider>
  );
}
