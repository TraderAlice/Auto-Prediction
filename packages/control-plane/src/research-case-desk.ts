import { hashCanonical, type Hash } from "@pmh/domain";
import type { InvestigationDeskProjection } from "./investigation-desk.js";
import type {
  DiscoveryCatalogContextSource,
  DiscoveryDeskProjection,
  DiscoveryRunRecord,
} from "./types.js";

const MAX_CASE_LISTING_REFS = 60;

const REVIEW_ASSESSMENTS = Object.freeze([
  "COMPLETE_RULE_IDENTITIES",
  "OUTCOME_MAPPING",
  "TIMING_AND_CLOSE_SEMANTICS",
  "VOID_AND_CANCELLATION",
  "RESOLUTION_SOURCES",
  "INDEPENDENT_REVIEWER_AUTHORITY",
] as const);

export type ReviewIntakePacket = Readonly<{
  schemaVersion: "pmh.review-intake-packet.v1";
  packetHash: Hash;
  caseId: string;
  sourceUpdatedAt: string;
  scope: Readonly<{
    question: string;
    venueIds: readonly string[];
    catalogContextIdentity: string;
    catalogContextSource: DiscoveryCatalogContextSource;
  }>;
  sourceBindings: Readonly<{
    discoveryRunId: string;
    discoveryTaskId: string;
    hypothesisHashes: readonly Hash[];
    proposerIdentities: readonly string[];
    investigationArtifactHash: Hash;
  }>;
  readiness:
    | "READY_FOR_INDEPENDENT_REVIEW"
    | "BLOCKED_CONTEXT"
    | "BLOCKED_CONTEXT_SNAPSHOT"
    | "BLOCKED_HYPOTHESIS"
    | "BLOCKED_EVIDENCE";
  blockers: readonly string[];
  candidateListingRefs: readonly string[];
  missingEvidence: readonly string[];
  requiredAssessments: typeof REVIEW_ASSESSMENTS;
  expectedArtifacts: readonly [
    "pmh.hypothesis-review.v1",
    "MARKET_LINK_REVIEW",
  ];
  authority: Readonly<{
    posture: "REVIEW_INTAKE_ONLY";
    reviewStatus: "UNREVIEWED";
    decisionIngestionEnabled: false;
    promotionEligible: false;
    executionAuthority: false;
  }>;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ResearchCaseStage = Readonly<{
  stage:
    | "CATALOG_CONTEXT"
    | "SCOUT_DISCOVERY"
    | "DEEP_INVESTIGATION"
    | "INDEPENDENT_REVIEW"
    | "DETERMINISTIC_COMPILATION"
    | "EXACT_VERIFICATION";
  status:
    | "BOUND"
    | "PRESENT"
    | "RUNNING"
    | "FAILED"
    | "MISSING"
    | "BLOCKED";
  detail: string;
}>;

export type ResearchCaseProjection = Readonly<{
  caseId: string;
  taskIds: readonly string[];
  question: string;
  venueIds: readonly string[];
  catalogContextIdentity: string | null;
  catalogContextSource: DiscoveryCatalogContextSource;
  catalogListingCount: number;
  openedAt: string;
  updatedAt: string;
  status:
    | "INVESTIGATING"
    | "EVIDENCE_GAPS"
    | "AWAITING_REVIEW"
    | "NEEDS_CONTEXT"
    | "NEEDS_INVESTIGATION"
    | "NO_LEADS";
  scout: Readonly<{
    status: "LEADS" | "EMPTY" | "MISSING";
    runId: string | null;
    taskId: string | null;
    contextSnapshotRetained: boolean;
    workerIds: readonly string[];
    hypothesisCount: number;
    diagnosticCount: number;
  }>;
  investigation: Readonly<{
    status: "PASS" | "RUNNING" | "FAILED" | "MISSING";
    attemptCount: number;
    failedAttemptCount: number;
    latestInvestigationId: string | null;
    artifactHash: string | null;
    summary: string | null;
    findingCount: number;
    warningCount: number;
    findings: readonly Readonly<{
      listingRefs: readonly string[];
      statement: string;
      severity: "INFO" | "WARNING";
    }>[];
  }>;
  candidateListingRefCount: number;
  candidateListingRefs: readonly string[];
  missingEvidence: readonly string[];
  reviewIntake?: ReviewIntakePacket | null;
  stages: readonly ResearchCaseStage[];
  authority: "PROPOSE_ONLY";
  reviewStatus: "UNREVIEWED";
  promotionEligible: false;
  executionAuthority: false;
}>;

export type ResearchCaseDeskProjection = Readonly<{
  caseCount: number;
  activeCount: number;
  evidenceGapCount: number;
  awaitingReviewCount: number;
  needsContextCount: number;
  needsInvestigationCount: number;
  cases: readonly ResearchCaseProjection[];
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type MutableCase = {
  readonly scope: ReturnType<typeof scopeOf>;
  readonly runs: DiscoveryRunRecord[];
  readonly investigations: InvestigationDeskProjection["records"][number][];
};

function sourceOf(
  source: DiscoveryCatalogContextSource | undefined,
): DiscoveryCatalogContextSource {
  return source ?? "VERIFIED_FIXTURE_CATALOGS";
}

function scopeOf(record: Readonly<{
  question: string;
  venueIds: readonly string[];
  catalogContextIdentity?: string;
  catalogContextSource?: DiscoveryCatalogContextSource;
}>): Readonly<{
  question: string;
  venueIds: readonly string[];
  catalogContextIdentity: string | null;
  catalogContextSource: DiscoveryCatalogContextSource;
}> {
  return Object.freeze({
    question: record.question,
    venueIds: Object.freeze([...record.venueIds].sort()),
    catalogContextIdentity: record.catalogContextIdentity ?? null,
    catalogContextSource: sourceOf(record.catalogContextSource),
  });
}

function scopeIdentity(scope: ReturnType<typeof scopeOf>): string {
  return hashCanonical(scope);
}

function latestBy<T>(
  values: readonly T[],
  timestamp: (value: T) => string,
): T | undefined {
  return [...values].sort((left, right) =>
    timestamp(right).localeCompare(timestamp(left)),
  )[0];
}

function assertAuthority(
  discovery: DiscoveryDeskProjection,
  investigations: InvestigationDeskProjection,
): void {
  if (
    discovery.runs.some(
      (run) =>
        run.executionAuthority !== false ||
        run.hypotheses.some(
          (hypothesis) =>
            hypothesis.authority !== "PROPOSE_ONLY" ||
            hypothesis.reviewStatus !== "UNREVIEWED",
        ),
    ) ||
    investigations.records.some(
      (record) =>
        record.authority !== "PROPOSE_ONLY" ||
        record.reviewStatus !== "UNREVIEWED" ||
        record.executionAuthority !== false,
    )
  ) {
    throw new Error("research case input crossed its authority boundary");
  }
}

function reviewIntakePacketBody(
  packet: Omit<ReviewIntakePacket, "packetHash">,
): Omit<ReviewIntakePacket, "packetHash"> {
  return packet;
}

export function verifyReviewIntakePacket(packet: ReviewIntakePacket): void {
  const { packetHash, ...body } = packet;
  if (packetHash !== hashCanonical(reviewIntakePacketBody(body))) {
    throw new Error("review intake packet hash mismatch");
  }
  const validHash = (value: string): boolean =>
    /^sha256:[a-f0-9]{64}$/.test(value);
  if (
    packet.schemaVersion !== "pmh.review-intake-packet.v1" ||
    !validHash(packet.packetHash) ||
    packet.caseId.trim() === "" ||
    Number.isNaN(Date.parse(packet.sourceUpdatedAt)) ||
    packet.scope.question.trim() === "" ||
    packet.scope.venueIds.length === 0 ||
    new Set(packet.scope.venueIds).size !== packet.scope.venueIds.length ||
    !validHash(packet.scope.catalogContextIdentity) ||
    packet.sourceBindings.discoveryRunId.trim() === "" ||
    packet.sourceBindings.discoveryTaskId.trim() === "" ||
    packet.sourceBindings.hypothesisHashes.length === 0 ||
    packet.sourceBindings.hypothesisHashes.some((item) => !validHash(item)) ||
    new Set(packet.sourceBindings.hypothesisHashes).size !==
      packet.sourceBindings.hypothesisHashes.length ||
    packet.sourceBindings.proposerIdentities.length === 0 ||
    new Set(packet.sourceBindings.proposerIdentities).size !==
      packet.sourceBindings.proposerIdentities.length ||
    !validHash(packet.sourceBindings.investigationArtifactHash) ||
    new Set(packet.candidateListingRefs).size !==
      packet.candidateListingRefs.length ||
    packet.requiredAssessments.join("\u0000") !==
      REVIEW_ASSESSMENTS.join("\u0000") ||
    packet.expectedArtifacts[0] !== "pmh.hypothesis-review.v1" ||
    packet.expectedArtifacts[1] !== "MARKET_LINK_REVIEW" ||
    (packet.readiness === "READY_FOR_INDEPENDENT_REVIEW" &&
      (packet.blockers.length > 0 || packet.missingEvidence.length > 0)) ||
    (packet.readiness === "BLOCKED_EVIDENCE" &&
      packet.missingEvidence.length === 0)
  ) {
    throw new Error("review intake packet is malformed");
  }
  if (
    packet.authority.posture !== "REVIEW_INTAKE_ONLY" ||
    packet.authority.reviewStatus !== "UNREVIEWED" ||
    packet.authority.decisionIngestionEnabled !== false ||
    packet.authority.promotionEligible !== false ||
    packet.authority.executionAuthority !== false ||
    packet.effects.externalWrites !== false ||
    packet.effects.valueMovingActions !== false ||
    packet.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("review intake packet crossed its authority boundary");
  }
}

function buildReviewIntakePacket(input: {
  caseId: string;
  scope: ReturnType<typeof scopeOf>;
  sourceUpdatedAt: string;
  contextBound: boolean;
  latestRun: DiscoveryRunRecord | undefined;
  investigationArtifactHash: string | null;
  candidateListingRefs: readonly string[];
  missingEvidence: readonly string[];
}): ReviewIntakePacket | null {
  const hypothesisHashes = Object.freeze(
    [...(input.latestRun?.hypotheses ?? [])]
      .map((hypothesis) => hashCanonical(hypothesis))
      .sort(),
  );
  const proposerIdentities = Object.freeze(
    [
      ...new Set(
        (input.latestRun?.hypotheses ?? []).map((item) => item.workerId),
      ),
    ].sort(),
  );
  const contextIdentity = input.scope.catalogContextIdentity;
  const latestRun = input.latestRun;
  const investigationArtifactHash = input.investigationArtifactHash;
  const blockers = [
    ...(!input.contextBound ? ["bounded catalog context is missing"] : []),
    ...(input.contextBound && input.latestRun?.catalogContextRetained !== true
      ? ["exact catalog context snapshot is not retained"]
      : []),
    ...(hypothesisHashes.length === 0
      ? ["no proposal-only hypothesis is bound"]
      : []),
    ...(input.investigationArtifactHash === null
      ? ["no passed investigation artifact is bound"]
      : []),
    ...input.missingEvidence.map((item) => `missing evidence: ${item}`),
  ];
  if (
    contextIdentity === null ||
    latestRun === undefined ||
    investigationArtifactHash === null ||
    !/^sha256:[a-f0-9]{64}$/.test(investigationArtifactHash)
  ) {
    return null;
  }
  const readiness = !input.contextBound
    ? ("BLOCKED_CONTEXT" as const)
    : latestRun.catalogContextRetained !== true
      ? ("BLOCKED_CONTEXT_SNAPSHOT" as const)
      : hypothesisHashes.length === 0
        ? ("BLOCKED_HYPOTHESIS" as const)
        : input.missingEvidence.length > 0
          ? ("BLOCKED_EVIDENCE" as const)
          : ("READY_FOR_INDEPENDENT_REVIEW" as const);
  const body = Object.freeze({
    schemaVersion: "pmh.review-intake-packet.v1" as const,
    caseId: input.caseId,
    sourceUpdatedAt: input.sourceUpdatedAt,
    scope: Object.freeze({
      question: input.scope.question,
      venueIds: Object.freeze([...input.scope.venueIds]),
      catalogContextIdentity: contextIdentity,
      catalogContextSource: input.scope.catalogContextSource,
    }),
    sourceBindings: Object.freeze({
      discoveryRunId: latestRun.runId,
      discoveryTaskId: latestRun.taskId,
      hypothesisHashes,
      proposerIdentities,
      investigationArtifactHash: investigationArtifactHash as Hash,
    }),
    readiness,
    blockers: Object.freeze(blockers),
    candidateListingRefs: Object.freeze([...input.candidateListingRefs]),
    missingEvidence: Object.freeze([...input.missingEvidence]),
    requiredAssessments: REVIEW_ASSESSMENTS,
    expectedArtifacts: Object.freeze([
      "pmh.hypothesis-review.v1",
      "MARKET_LINK_REVIEW",
    ] as const),
    authority: Object.freeze({
      posture: "REVIEW_INTAKE_ONLY" as const,
      reviewStatus: "UNREVIEWED" as const,
      decisionIngestionEnabled: false as const,
      promotionEligible: false as const,
      executionAuthority: false as const,
    }),
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  const packet = Object.freeze({
    ...body,
    packetHash: hashCanonical(reviewIntakePacketBody(body)),
  });
  verifyReviewIntakePacket(packet);
  return packet;
}

function buildCase(group: MutableCase): ResearchCaseProjection {
  const latestRun = latestBy(group.runs, (run) => run.completedAt);
  const latestInvestigation = latestBy(group.investigations, (record) =>
    record.completedAt ?? record.startedAt,
  );
  const passedInvestigation = latestBy(
    group.investigations.filter((record) => record.status === "PASS"),
    (record) => record.completedAt ?? record.startedAt,
  );
  const activeInvestigation = group.investigations.some(
    (record) => record.status === "RUNNING",
  );
  const hypothesisCount = latestRun?.hypotheses.length ?? 0;
  const missingEvidence = Object.freeze([
    ...(passedInvestigation?.report?.result.missingEvidence ?? []),
  ]);
  const allCandidateListingRefs = [
      ...(latestRun?.hypotheses.flatMap(
        (hypothesis) => hypothesis.listingRefs ?? [],
      ) ?? []),
      ...(passedInvestigation?.report?.result.candidateListingRefs ?? []),
    ]
      .filter((item, index, values) => values.indexOf(item) === index)
      .sort();
  const candidateListingRefs = Object.freeze(
    allCandidateListingRefs.slice(0, MAX_CASE_LISTING_REFS),
  );
  const investigationStatus = activeInvestigation
    ? ("RUNNING" as const)
    : passedInvestigation !== undefined
      ? ("PASS" as const)
      : group.investigations.length > 0
        ? ("FAILED" as const)
        : ("MISSING" as const);
  const timestamps = [
    ...group.runs.flatMap((run) => [run.startedAt, run.completedAt]),
    ...group.investigations.flatMap((record) => [
      record.startedAt,
      ...(record.completedAt === null ? [] : [record.completedAt]),
    ]),
  ].sort();
  const observedListingCounts = [
    ...group.runs.flatMap((run) =>
      run.catalogListingCount === undefined ? [] : [run.catalogListingCount],
    ),
    ...group.investigations.map((record) => record.catalogListingCount),
  ];
  if (new Set(observedListingCounts).size > 1) {
    throw new Error("research case scope has conflicting catalog listing counts");
  }
  const catalogListingCount = observedListingCounts[0] ?? 0;
  const contextBound =
    group.scope.catalogContextIdentity !== null && catalogListingCount > 0;
  const status = activeInvestigation
    ? ("INVESTIGATING" as const)
    : passedInvestigation !== undefined
      ? missingEvidence.length > 0
        ? ("EVIDENCE_GAPS" as const)
        : ("AWAITING_REVIEW" as const)
      : !contextBound
        ? ("NEEDS_CONTEXT" as const)
        : hypothesisCount > 0
          ? ("NEEDS_INVESTIGATION" as const)
          : ("NO_LEADS" as const);
  const stages: readonly ResearchCaseStage[] = Object.freeze([
    Object.freeze({
      stage: "CATALOG_CONTEXT" as const,
      status: contextBound ? ("BOUND" as const) : ("MISSING" as const),
      detail: contextBound
        ? `${catalogListingCount} listings · ${group.scope.catalogContextSource.replaceAll("_", " ").toLowerCase()}`
        : "no bounded catalog context retained",
    }),
    Object.freeze({
      stage: "SCOUT_DISCOVERY" as const,
      status:
        latestRun === undefined ? ("MISSING" as const) : ("PRESENT" as const),
      detail:
        latestRun === undefined
          ? "no scout run retained"
          : `${hypothesisCount} proposal${hypothesisCount === 1 ? "" : "s"} · ${latestRun.workerIds.length} worker${latestRun.workerIds.length === 1 ? "" : "s"}`,
    }),
    Object.freeze({
      stage: "DEEP_INVESTIGATION" as const,
      status:
        investigationStatus === "PASS"
          ? ("PRESENT" as const)
          : investigationStatus,
      detail:
        investigationStatus === "PASS"
          ? `${passedInvestigation?.report?.result.findings.length ?? 0} findings · ${missingEvidence.length} evidence gaps`
          : investigationStatus === "RUNNING"
            ? "read-only pi investigation in progress"
            : investigationStatus === "FAILED"
              ? `${group.investigations.length} failed attempt${group.investigations.length === 1 ? "" : "s"}`
              : "no passed investigation retained",
    }),
    Object.freeze({
      stage: "INDEPENDENT_REVIEW" as const,
      status: "BLOCKED" as const,
      detail: "runtime equivalence-review authority is not configured",
    }),
    Object.freeze({
      stage: "DETERMINISTIC_COMPILATION" as const,
      status: "BLOCKED" as const,
      detail: "requires accepted hypothesis and exact market-link reviews",
    }),
    Object.freeze({
      stage: "EXACT_VERIFICATION" as const,
      status: "BLOCKED" as const,
      detail: "no reviewed candidate entered the exact verifier",
    }),
  ]);
  const body = {
    scope: group.scope,
  };
  const caseId = `research-case:${hashCanonical(body).slice(7)}`;
  const updatedAt = timestamps.at(-1) ?? new Date(0).toISOString();
  const reviewSourceUpdatedAt = [
    latestRun?.completedAt,
    passedInvestigation?.report?.completedAt,
  ]
    .filter((item): item is string => item !== undefined)
    .sort()
    .at(-1) ?? new Date(0).toISOString();
  const reviewIntake = buildReviewIntakePacket({
    caseId,
    scope: group.scope,
    sourceUpdatedAt: reviewSourceUpdatedAt,
    contextBound,
    latestRun,
    investigationArtifactHash:
      passedInvestigation?.report?.artifactHash ?? null,
    candidateListingRefs: allCandidateListingRefs,
    missingEvidence,
  });
  return Object.freeze({
    caseId,
    taskIds: Object.freeze(
      [
        ...group.runs.map((run) => run.taskId),
        ...group.investigations.map((record) => record.taskId),
      ]
        .filter((item, index, values) => values.indexOf(item) === index)
        .sort(),
    ),
    ...group.scope,
    catalogListingCount,
    openedAt: timestamps[0] ?? new Date(0).toISOString(),
    updatedAt,
    status,
    scout: Object.freeze({
      status:
        latestRun === undefined
          ? ("MISSING" as const)
          : hypothesisCount > 0
            ? ("LEADS" as const)
            : ("EMPTY" as const),
      runId: latestRun?.runId ?? null,
      taskId: latestRun?.taskId ?? null,
      contextSnapshotRetained: latestRun?.catalogContextRetained === true,
      workerIds: Object.freeze([...(latestRun?.workerIds ?? [])]),
      hypothesisCount,
      diagnosticCount: latestRun?.diagnostics.length ?? 0,
    }),
    investigation: Object.freeze({
      status: investigationStatus,
      attemptCount: group.investigations.length,
      failedAttemptCount: group.investigations.filter(
        (record) => record.status === "FAILED",
      ).length,
      latestInvestigationId: latestInvestigation?.investigationId ?? null,
      artifactHash: passedInvestigation?.report?.artifactHash ?? null,
      summary: passedInvestigation?.report?.result.summary ?? null,
      findingCount: passedInvestigation?.report?.result.findings.length ?? 0,
      warningCount:
        passedInvestigation?.report?.result.findings.filter(
          (finding) => finding.severity === "WARNING",
        ).length ?? 0,
      findings: Object.freeze(
        (passedInvestigation?.report?.result.findings ?? [])
          .slice(0, 8)
          .map((finding) =>
            Object.freeze({
              listingRefs: Object.freeze([...finding.listingRefs]),
              statement: finding.statement,
              severity: finding.severity,
            }),
          ),
      ),
    }),
    candidateListingRefCount: allCandidateListingRefs.length,
    candidateListingRefs,
    missingEvidence,
    reviewIntake,
    stages,
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    promotionEligible: false as const,
    executionAuthority: false as const,
  });
}

export function buildResearchCaseDesk(
  discovery: DiscoveryDeskProjection,
  investigations: InvestigationDeskProjection,
): ResearchCaseDeskProjection {
  assertAuthority(discovery, investigations);
  const groups = new Map<string, MutableCase>();
  const groupFor = (record: Parameters<typeof scopeOf>[0]): MutableCase => {
    const scope = scopeOf(record);
    const identity = scopeIdentity(scope);
    const existing = groups.get(identity);
    if (existing !== undefined) return existing;
    const created: MutableCase = { scope, runs: [], investigations: [] };
    groups.set(identity, created);
    return created;
  };
  for (const run of discovery.runs) groupFor(run).runs.push(run);
  for (const record of investigations.records) {
    groupFor(record).investigations.push(record);
  }
  const cases = Object.freeze(
    [...groups.values()]
      .map(buildCase)
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.caseId.localeCompare(right.caseId),
      ),
  );
  return Object.freeze({
    caseCount: cases.length,
    activeCount: cases.filter((item) => item.status === "INVESTIGATING").length,
    evidenceGapCount: cases.filter((item) => item.status === "EVIDENCE_GAPS")
      .length,
    awaitingReviewCount: cases.filter(
      (item) => item.status === "AWAITING_REVIEW",
    ).length,
    needsContextCount: cases.filter((item) => item.status === "NEEDS_CONTEXT")
      .length,
    needsInvestigationCount: cases.filter(
      (item) => item.status === "NEEDS_INVESTIGATION",
    ).length,
    cases,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
}
