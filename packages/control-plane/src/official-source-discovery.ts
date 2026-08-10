import { hashCanonical, type Hash } from "@pmh/domain";
import { buildAdmittedDiscoveryEvidenceLocator } from "./discovery-evidence-locator.js";
import {
  assertEvidenceRequirement,
  type EvidenceRequirement,
  type EvidenceRequirementKind,
} from "./evidence-requirement.js";
import type { DiscoveryEvidenceLocator } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_SURFACES = 8;
const MAX_CANDIDATES = 12;

export type OfficialSourceRole = DiscoveryEvidenceLocator["role"];

export type OfficialSourceSurface = Readonly<{
  surfaceId: Hash;
  venueId: string;
  rootUrl: string;
  allowedHosts: readonly string[];
  roles: readonly OfficialSourceRole[];
  authority: "OFFICIAL_SOURCE_SEARCH_SURFACE_ONLY";
  fetchAuthority: false;
}>;

export type OfficialSourceDiscoveryTask = Readonly<{
  schemaVersion: "pmh.official-source-discovery-task.v1";
  taskId: Hash;
  requirement: EvidenceRequirement;
  requirementId: Hash;
  proposalId: Hash;
  venueIds: readonly string[];
  protocolIdentities: readonly string[];
  targetRole: OfficialSourceRole;
  priorityTier:
    | "POSITIVE_GROSS_BLOCKER"
    | "EVIDENCE_ESCALATION"
    | "ACTIVE_TRIAGE_DEBT"
    | "RETAINED_RESEARCH_DEBT";
  surfaces: readonly OfficialSourceSurface[];
  policyIdentity: Hash;
  authority: "OFFICIAL_SOURCE_DISCOVERY_REQUEST_ONLY";
  fetchAuthority: false;
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  taskHash: Hash;
}>;

export type OfficialSourceCandidateDraft = Readonly<{
  url: string;
  sourceSurfaceId: Hash;
  title: string;
  evidenceRole: OfficialSourceRole;
  evidenceScope: "CONTRACT_SPECIFIC" | "VENUE_WIDE" | "RESOLUTION_SPECIFIC";
  temporalPosture: "CURRENT" | "HISTORICAL_AT_SOURCE_OBSERVATION";
  rationale: string;
}>;

export type OfficialSourceCandidate = Readonly<OfficialSourceCandidateDraft & {
  schemaVersion: "pmh.official-source-candidate.v1";
  candidateId: Hash;
  taskId: Hash;
  authority: "AGENT_SOURCE_CANDIDATE_ONLY";
  fetchAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type OfficialSourceAdmissionReason =
  | "ADMITTED"
  | "URL_NOT_HTTPS"
  | "HOST_OUTSIDE_OFFICIAL_SURFACE"
  | "ROLE_MISMATCH"
  | "TEMPORAL_POSTURE_MISMATCH"
  | "SCOPE_MISMATCH"
  | "SURFACE_NOT_IN_TASK"
  | "VENUE_SCOPE_AMBIGUOUS";

export type OfficialSourceAdmission = Readonly<{
  schemaVersion: "pmh.official-source-admission.v1";
  admissionId: Hash;
  taskId: Hash;
  requirementId: Hash;
  candidateId: Hash;
  decision: "ADMITTED" | "REJECTED";
  reason: OfficialSourceAdmissionReason;
  venueId: string | null;
  protocolIdentity: string | null;
  locator: DiscoveryEvidenceLocator | null;
  admittedAt: string;
  authority: "FIRST_PARTY_LOCATOR_ADMISSION_ONLY";
  fetchAuthority: false;
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  artifactHash: Hash;
}>;

type VenueSurfaceDefinition = Readonly<{
  venueId: string;
  roots: readonly string[];
}>;

const VENUE_SURFACE_DEFINITIONS = Object.freeze([
  {
    venueId: "gemini-predictions",
    roots: ["https://developer.gemini.com/prediction-markets/prediction-markets"],
  },
  { venueId: "kalshi", roots: ["https://docs.kalshi.com/welcome"] },
  {
    venueId: "limitless",
    roots: ["https://docs.limitless.exchange/developers/websocket-events"],
  },
  {
    venueId: "myriad",
    roots: ["https://docs.myriad.markets/builders/myriad-api-reference"],
  },
  {
    venueId: "opinion",
    roots: ["https://docs.opinion.trade/developer-guide/opinion-open-api/overview"],
  },
  { venueId: "polymarket-global", roots: ["https://docs.polymarket.com/"] },
  {
    venueId: "polymarket-us",
    roots: [
      "https://docs.polymarket.us/api-reference/introduction",
      "https://gateway.polymarket.us/",
      "https://www.cftc.gov/filings/orgrules/rules0519263672.docx",
    ],
  },
] as const satisfies readonly VenueSurfaceDefinition[]);

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));
}

function normalizedHttpsUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (
      parsed.protocol !== "https:" || parsed.username !== "" ||
      parsed.password !== "" || parsed.hash !== "" ||
      (parsed.port !== "" && parsed.port !== "443")
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function officialSourceRoleForRequirement(
  kind: EvidenceRequirementKind,
): OfficialSourceRole | null {
  if (kind === "ORACLE_SOURCE") return "OUTCOME_RESOLUTION_SOURCE";
  if (kind === "VENUE_POLICY") return "VENUE_RULE_DOCUMENT";
  if ([
    "RESOLUTION_RULE", "VOID_CANCELLATION", "TIME_BOUNDARY", "OUTCOME_MAPPING",
  ].includes(kind)) return "CONTRACT_RULE_DOCUMENT";
  return null;
}

function scopeForRole(role: OfficialSourceRole): OfficialSourceCandidateDraft["evidenceScope"] {
  if (role === "VENUE_RULE_DOCUMENT") return "VENUE_WIDE";
  if (role === "OUTCOME_RESOLUTION_SOURCE") return "RESOLUTION_SPECIFIC";
  return "CONTRACT_SPECIFIC";
}

function surfaceRoles(): readonly OfficialSourceRole[] {
  return Object.freeze([
    "CONTRACT_RULE_DOCUMENT",
    "OUTCOME_RESOLUTION_SOURCE",
    "VENUE_RULE_DOCUMENT",
  ]);
}

export function officialSourceSurfacesForRequirement(
  requirementInput: EvidenceRequirement,
): readonly OfficialSourceSurface[] {
  const requirement = assertEvidenceRequirement(requirementInput);
  const venueIds = new Set(requirement.sourceObservations.map((item) => item.venueId));
  const surfaces = VENUE_SURFACE_DEFINITIONS.flatMap((definition) => {
    if (!venueIds.has(definition.venueId)) return [];
    const allowedHosts = sortedUnique([
      ...definition.roots.map((root) => new URL(root).hostname),
    ]);
    return definition.roots.map((rootUrl) => {
      const body = Object.freeze({
        venueId: definition.venueId,
        rootUrl,
        allowedHosts,
        roles: surfaceRoles(),
        authority: "OFFICIAL_SOURCE_SEARCH_SURFACE_ONLY" as const,
        fetchAuthority: false as const,
      });
      return Object.freeze({
        ...body,
        surfaceId: hashCanonical({
          schemaVersion: "pmh.official-source-surface.v1",
          ...body,
        }),
      });
    });
  });
  return Object.freeze(surfaces.slice(0, MAX_SURFACES).sort((left, right) =>
    left.surfaceId.localeCompare(right.surfaceId)
  ));
}

export function buildOfficialSourceDiscoveryTask(input: Readonly<{
  requirement: EvidenceRequirement;
  priorityTier: OfficialSourceDiscoveryTask["priorityTier"];
}>): OfficialSourceDiscoveryTask | null {
  const requirement = assertEvidenceRequirement(input.requirement);
  const targetRole = officialSourceRoleForRequirement(requirement.kind);
  if (requirement.acquisitionRoute !== "UNSUPPORTED" || targetRole === null) return null;
  const surfaces = officialSourceSurfacesForRequirement(requirement);
  if (surfaces.length === 0) return null;
  const venueIds = sortedUnique(requirement.sourceObservations.map((item) => item.venueId));
  const protocolIdentities = sortedUnique(
    requirement.sourceObservations.map((item) => item.protocolIdentity),
  );
  const policyIdentity = hashCanonical({
    schemaVersion: "pmh.official-source-policy.v1",
    surfaces,
  });
  const taskId = hashCanonical({
    schemaVersion: "pmh.official-source-discovery-task-id.v1",
    requirementId: requirement.requirementId,
    targetRole,
    policyIdentity,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.official-source-discovery-task.v1" as const,
    taskId,
    requirement,
    requirementId: requirement.requirementId,
    proposalId: requirement.proposalId,
    venueIds,
    protocolIdentities,
    targetRole,
    priorityTier: input.priorityTier,
    surfaces,
    policyIdentity,
    authority: "OFFICIAL_SOURCE_DISCOVERY_REQUEST_ONLY" as const,
    fetchAuthority: false as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, taskHash: hashCanonical(body) });
}

export function buildOfficialSourceCandidate(
  taskInput: OfficialSourceDiscoveryTask,
  draft: OfficialSourceCandidateDraft,
): OfficialSourceCandidate {
  const task = assertOfficialSourceDiscoveryTask(taskInput);
  if (
    !HASH_PATTERN.test(String(draft.sourceSurfaceId)) ||
    !boundedText(draft.title, 500) || !boundedText(draft.rationale, 2_000) ||
    normalizedHttpsUrl(draft.url) === null ||
    !["CONTRACT_SPECIFIC", "VENUE_WIDE", "RESOLUTION_SPECIFIC"]
      .includes(draft.evidenceScope) ||
    !["CURRENT", "HISTORICAL_AT_SOURCE_OBSERVATION"]
      .includes(draft.temporalPosture)
  ) throw new Error("official source candidate violates its bounded draft contract");
  const body = Object.freeze({
    schemaVersion: "pmh.official-source-candidate.v1" as const,
    taskId: task.taskId,
    url: normalizedHttpsUrl(draft.url)!.toString(),
    sourceSurfaceId: draft.sourceSurfaceId,
    title: draft.title.trim(),
    evidenceRole: draft.evidenceRole,
    evidenceScope: draft.evidenceScope,
    temporalPosture: draft.temporalPosture,
    rationale: draft.rationale.trim(),
    authority: "AGENT_SOURCE_CANDIDATE_ONLY" as const,
    fetchAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({
    ...body,
    candidateId: hashCanonical(body),
  });
}

export function admitOfficialSourceCandidate(input: Readonly<{
  task: OfficialSourceDiscoveryTask;
  candidate: OfficialSourceCandidate;
  admittedAt: string;
}>): OfficialSourceAdmission {
  const task = assertOfficialSourceDiscoveryTask(input.task);
  const candidate = input.candidate;
  if (candidate.taskId !== task.taskId || !isIso(input.admittedAt)) {
    throw new Error("official source admission lineage is invalid");
  }
  const surface = task.surfaces.find((item) =>
    item.surfaceId === candidate.sourceSurfaceId
  );
  const parsed = normalizedHttpsUrl(candidate.url);
  let reason: OfficialSourceAdmissionReason = "ADMITTED";
  if (parsed === null) reason = "URL_NOT_HTTPS";
  else if (surface === undefined) reason = "SURFACE_NOT_IN_TASK";
  else if (!surface.allowedHosts.includes(parsed.hostname)) {
    reason = "HOST_OUTSIDE_OFFICIAL_SURFACE";
  } else if (candidate.evidenceRole !== task.targetRole) reason = "ROLE_MISMATCH";
  else if (candidate.temporalPosture !== task.requirement.temporalPosture) {
    reason = "TEMPORAL_POSTURE_MISMATCH";
  } else if (candidate.evidenceScope !== scopeForRole(task.targetRole)) {
    reason = "SCOPE_MISMATCH";
  } else if (task.venueIds.length !== 1 || task.protocolIdentities.length !== 1) {
    reason = "VENUE_SCOPE_AMBIGUOUS";
  }
  const admissionId = hashCanonical({
    schemaVersion: "pmh.official-source-admission-id.v1",
    taskId: task.taskId,
    requirementId: task.requirementId,
    candidateId: candidate.candidateId,
    policyIdentity: task.policyIdentity,
    reason,
  });
  const locator = reason === "ADMITTED"
    ? buildAdmittedDiscoveryEvidenceLocator({
        venueId: task.venueIds[0]!,
        protocolIdentity: task.protocolIdentities[0]!,
        role: task.targetRole,
        url: candidate.url,
        admissionId,
        taskId: task.taskId,
        candidateId: candidate.candidateId,
      })
    : null;
  if (reason === "ADMITTED" && locator === null) {
    throw new Error("admitted official source did not produce a valid locator");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.official-source-admission.v1" as const,
    admissionId,
    taskId: task.taskId,
    requirementId: task.requirementId,
    candidateId: candidate.candidateId,
    decision: reason === "ADMITTED" ? "ADMITTED" as const : "REJECTED" as const,
    reason,
    venueId: reason === "ADMITTED" ? task.venueIds[0]! : null,
    protocolIdentity: reason === "ADMITTED" ? task.protocolIdentities[0]! : null,
    locator,
    admittedAt: input.admittedAt,
    authority: "FIRST_PARTY_LOCATOR_ADMISSION_ONLY" as const,
    fetchAuthority: false as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertOfficialSourceDiscoveryTask(
  value: unknown,
): OfficialSourceDiscoveryTask {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("official source discovery task is malformed");
  }
  const task = value as OfficialSourceDiscoveryTask;
  const { taskHash, ...body } = task;
  const requirement = assertEvidenceRequirement(task.requirement);
  if (
    task.schemaVersion !== "pmh.official-source-discovery-task.v1" ||
    !HASH_PATTERN.test(String(task.taskId)) || task.requirementId !== requirement.requirementId ||
    task.proposalId !== requirement.proposalId || requirement.acquisitionRoute !== "UNSUPPORTED" ||
    officialSourceRoleForRequirement(requirement.kind) !== task.targetRole ||
    !Array.isArray(task.surfaces) || task.surfaces.length < 1 ||
    task.surfaces.length > MAX_SURFACES || !HASH_PATTERN.test(String(task.policyIdentity)) ||
    task.authority !== "OFFICIAL_SOURCE_DISCOVERY_REQUEST_ONLY" ||
    task.fetchAuthority !== false || task.providerRequestAuthority !== false ||
    task.semanticDecisionAuthority !== false || task.certificateAuthority !== false ||
    task.executionAuthority !== false || !HASH_PATTERN.test(String(taskHash)) ||
    taskHash !== hashCanonical(body)
  ) throw new Error("official source discovery task violates its closed contract");
  return Object.freeze(task);
}

export function boundedOfficialSourceCandidates(
  task: OfficialSourceDiscoveryTask,
  drafts: readonly OfficialSourceCandidateDraft[],
): readonly OfficialSourceCandidate[] {
  if (!Array.isArray(drafts) || drafts.length > MAX_CANDIDATES) {
    throw new Error("official source candidate set is unbounded");
  }
  return Object.freeze([...new Map(drafts.map((draft) => {
    const candidate = buildOfficialSourceCandidate(task, draft);
    return [candidate.candidateId, candidate] as const;
  })).values()].sort((left, right) => left.candidateId.localeCompare(right.candidateId)));
}
