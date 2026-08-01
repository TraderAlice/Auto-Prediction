import { hashCanonical } from "@pmh/domain";
import type { InvestigationDeskProjection } from "./investigation-desk.js";
import type {
  DiscoveryCatalogContextSource,
  DiscoveryDeskProjection,
  DiscoveryRunRecord,
} from "./types.js";

const MAX_CASE_LISTING_REFS = 60;

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
  return Object.freeze({
    caseId: `research-case:${hashCanonical(body).slice(7)}`,
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
    updatedAt: timestamps.at(-1) ?? new Date(0).toISOString(),
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
