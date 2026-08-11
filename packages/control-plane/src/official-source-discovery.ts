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
const MAX_OBLIGATIONS = 12;

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

type OfficialSourceDiscoveryTaskV1 = Readonly<{
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

type OfficialSourceDiscoveryTaskV2 = Readonly<{
  schemaVersion: "pmh.official-source-discovery-task.v2";
  taskId: Hash;
  supplyScopeIdentity: Hash;
  requirement: EvidenceRequirement;
  requirementId: Hash;
  requirements: readonly EvidenceRequirement[];
  requirementIds: readonly Hash[];
  proposalId: Hash;
  proposalIds: readonly Hash[];
  venueId: string;
  venueIds: readonly [string];
  protocolIdentity: string;
  protocolIdentities: readonly [string];
  listingRefs: readonly string[];
  targetRole: OfficialSourceRole;
  priorityTier: OfficialSourceDiscoveryTaskV1["priorityTier"];
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

export type OfficialSourceDiscoveryTask =
  | OfficialSourceDiscoveryTaskV1
  | OfficialSourceDiscoveryTaskV2;

export type OfficialSourceDiscoveryTaskInput = Readonly<{
  requirement: EvidenceRequirement;
  priorityTier: OfficialSourceDiscoveryTask["priorityTier"];
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

const PRIORITY_RANK = Object.freeze({
  POSITIVE_GROSS_BLOCKER: 0,
  EVIDENCE_ESCALATION: 1,
  ACTIVE_TRIAGE_DEBT: 2,
  RETAINED_RESEARCH_DEBT: 3,
} as const);

function bestPriority(
  inputs: readonly OfficialSourceDiscoveryTaskInput[],
): OfficialSourceDiscoveryTask["priorityTier"] {
  return [...inputs].sort((left, right) =>
    PRIORITY_RANK[left.priorityTier] - PRIORITY_RANK[right.priorityTier]
  )[0]!.priorityTier;
}

function supplyScopeIdentity(input: Readonly<{
  venueId: string;
  protocolIdentity: string;
  listingRefs: readonly string[];
  targetRole: OfficialSourceRole;
  temporalPosture: EvidenceRequirement["temporalPosture"];
  historicalObservations: readonly Readonly<{
    listingRef: string;
    listingHash: Hash;
    sourceRawHash: Hash;
    sourceReceivedAt: string;
  }>[];
  policyIdentity: Hash;
}>): Hash {
  return hashCanonical({
    schemaVersion: "pmh.official-source-supply-scope.v1",
    venueId: input.venueId,
    protocolIdentity: input.protocolIdentity,
    listingRefs: input.listingRefs,
    targetRole: input.targetRole,
    temporalPosture: input.temporalPosture,
    historicalObservations: input.temporalPosture === "CURRENT"
      ? []
      : input.historicalObservations,
    policyIdentity: input.policyIdentity,
  });
}

/**
 * Builds one bounded search task per exact official-document supply scope.
 * Requirement prose remains as a set of obligations, while venue/protocol and
 * listing coverage are split before the Agent is allowed to search.
 */
export function buildOfficialSourceDiscoveryTasks(
  inputs: readonly OfficialSourceDiscoveryTaskInput[],
): readonly OfficialSourceDiscoveryTask[] {
  const buckets = new Map<string, {
    venueId: string;
    protocolIdentity: string;
    listingRefs: readonly string[];
    targetRole: OfficialSourceRole;
    temporalPosture: EvidenceRequirement["temporalPosture"];
    surfaces: readonly OfficialSourceSurface[];
    policyIdentity: Hash;
    supplyScopeIdentity: Hash;
    inputs: OfficialSourceDiscoveryTaskInput[];
  }>();
  for (const rawInput of inputs) {
    const requirement = assertEvidenceRequirement(rawInput.requirement);
    const targetRole = officialSourceRoleForRequirement(requirement.kind);
    if (requirement.acquisitionRoute !== "UNSUPPORTED" || targetRole === null) continue;
    const observationsBySource = new Map<string, typeof requirement.sourceObservations[number][]>();
    for (const observation of requirement.sourceObservations) {
      const key = `${observation.venueId}\n${observation.protocolIdentity}`;
      const observations = observationsBySource.get(key) ?? [];
      observations.push(observation);
      observationsBySource.set(key, observations);
    }
    for (const observations of observationsBySource.values()) {
      const venueId = observations[0]!.venueId;
      const protocolIdentity = observations[0]!.protocolIdentity;
      const surfaces = officialSourceSurfacesForRequirement(requirement).filter((surface) =>
        surface.venueId === venueId
      );
      if (surfaces.length === 0) continue;
      const policyIdentity = hashCanonical({
        schemaVersion: "pmh.official-source-policy.v1",
        surfaces,
      });
      const listingRefs = sortedUnique(observations.map((item) => item.listingRef));
      const scope = supplyScopeIdentity({
        venueId,
        protocolIdentity,
        listingRefs,
        targetRole,
        temporalPosture: requirement.temporalPosture,
        historicalObservations: observations.map((item) => Object.freeze({
          listingRef: item.listingRef,
          listingHash: item.listingHash,
          sourceRawHash: item.sourceRawHash,
          sourceReceivedAt: item.sourceReceivedAt,
        })),
        policyIdentity,
      });
      const bucket = buckets.get(scope);
      const normalizedInput = Object.freeze({
        requirement,
        priorityTier: rawInput.priorityTier,
      });
      if (bucket === undefined) {
        buckets.set(scope, {
          venueId,
          protocolIdentity,
          listingRefs,
          targetRole,
          temporalPosture: requirement.temporalPosture,
          surfaces,
          policyIdentity,
          supplyScopeIdentity: scope,
          inputs: [normalizedInput],
        });
      } else if (!bucket.inputs.some((item) =>
        item.requirement.requirementId === requirement.requirementId
      )) {
        bucket.inputs.push(normalizedInput);
      }
    }
  }

  const tasks = [...buckets.values()].flatMap((bucket) => {
    const ordered = [...bucket.inputs].sort((left, right) =>
      left.requirement.requirementId.localeCompare(right.requirement.requirementId)
    );
    const chunks: OfficialSourceDiscoveryTaskInput[][] = [];
    for (let index = 0; index < ordered.length; index += MAX_OBLIGATIONS) {
      chunks.push(ordered.slice(index, index + MAX_OBLIGATIONS));
    }
    return chunks.map((chunk) => {
      const requirements = Object.freeze(chunk.map((item) => item.requirement));
      const requirementIds = Object.freeze(requirements.map((item) => item.requirementId));
      const proposalIds = sortedUnique(requirements.map((item) => item.proposalId)) as readonly Hash[];
      const obligationIdentity = hashCanonical({
        schemaVersion: "pmh.official-source-obligation-set.v1",
        requirementIds,
      });
      const taskId = hashCanonical({
        schemaVersion: "pmh.official-source-discovery-task-id.v2",
        supplyScopeIdentity: bucket.supplyScopeIdentity,
        obligationIdentity,
      });
      const body = Object.freeze({
        schemaVersion: "pmh.official-source-discovery-task.v2" as const,
        taskId,
        supplyScopeIdentity: bucket.supplyScopeIdentity,
        requirement: requirements[0]!,
        requirementId: requirementIds[0]!,
        requirements,
        requirementIds,
        proposalId: requirements[0]!.proposalId,
        proposalIds,
        venueId: bucket.venueId,
        venueIds: Object.freeze([bucket.venueId]) as readonly [string],
        protocolIdentity: bucket.protocolIdentity,
        protocolIdentities: Object.freeze([bucket.protocolIdentity]) as readonly [string],
        listingRefs: bucket.listingRefs,
        targetRole: bucket.targetRole,
        priorityTier: bestPriority(chunk),
        surfaces: bucket.surfaces,
        policyIdentity: bucket.policyIdentity,
        authority: "OFFICIAL_SOURCE_DISCOVERY_REQUEST_ONLY" as const,
        fetchAuthority: false as const,
        providerRequestAuthority: false as const,
        semanticDecisionAuthority: false as const,
        certificateAuthority: false as const,
        executionAuthority: false as const,
      });
      return assertOfficialSourceDiscoveryTask(Object.freeze({
        ...body,
        taskHash: hashCanonical(body),
      }));
    });
  });
  return Object.freeze(tasks.sort((left, right) => left.taskId.localeCompare(right.taskId)));
}

export function officialSourceTaskRequirements(
  task: OfficialSourceDiscoveryTask,
): readonly EvidenceRequirement[] {
  return task.schemaVersion === "pmh.official-source-discovery-task.v2"
    ? task.requirements
    : Object.freeze([task.requirement]);
}

export function officialSourceTaskRequirementIds(
  task: OfficialSourceDiscoveryTask,
): readonly Hash[] {
  return task.schemaVersion === "pmh.official-source-discovery-task.v2"
    ? task.requirementIds
    : Object.freeze([task.requirementId]);
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
  const isV2 = task.schemaVersion === "pmh.official-source-discovery-task.v2";
  const v2 = isV2 ? task : null;
  const v2Requirements = v2 === null || !Array.isArray(v2.requirements)
    ? []
    : v2.requirements.map(assertEvidenceRequirement);
  const expectedSupplyScope = v2 === null || v2Requirements.length === 0
    ? null
    : supplyScopeIdentity({
        venueId: v2.venueId,
        protocolIdentity: v2.protocolIdentity,
        listingRefs: v2.listingRefs,
        targetRole: v2.targetRole,
        temporalPosture: v2Requirements[0]!.temporalPosture,
        historicalObservations: v2Requirements[0]!.sourceObservations
          .filter((item) =>
            item.venueId === v2.venueId && item.protocolIdentity === v2.protocolIdentity &&
            v2.listingRefs.includes(item.listingRef)
          ).map((item) => Object.freeze({
            listingRef: item.listingRef,
            listingHash: item.listingHash,
            sourceRawHash: item.sourceRawHash,
            sourceReceivedAt: item.sourceReceivedAt,
          })),
        policyIdentity: v2.policyIdentity,
      });
  const expectedV2TaskId = v2 === null || expectedSupplyScope === null
    ? null
    : hashCanonical({
        schemaVersion: "pmh.official-source-discovery-task-id.v2",
        supplyScopeIdentity: expectedSupplyScope,
        obligationIdentity: hashCanonical({
          schemaVersion: "pmh.official-source-obligation-set.v1",
          requirementIds: v2.requirementIds,
        }),
      });
  if (
    (task.schemaVersion !== "pmh.official-source-discovery-task.v1" && !isV2) ||
    !HASH_PATTERN.test(String(task.taskId)) || task.requirementId !== requirement.requirementId ||
    task.proposalId !== requirement.proposalId || requirement.acquisitionRoute !== "UNSUPPORTED" ||
    officialSourceRoleForRequirement(requirement.kind) !== task.targetRole ||
    !Array.isArray(task.surfaces) || task.surfaces.length < 1 ||
    task.surfaces.length > MAX_SURFACES || !HASH_PATTERN.test(String(task.policyIdentity)) ||
    task.authority !== "OFFICIAL_SOURCE_DISCOVERY_REQUEST_ONLY" ||
    task.fetchAuthority !== false || task.providerRequestAuthority !== false ||
    task.semanticDecisionAuthority !== false || task.certificateAuthority !== false ||
    task.executionAuthority !== false || !HASH_PATTERN.test(String(taskHash)) ||
    taskHash !== hashCanonical(body) ||
    (v2 !== null && (
      v2Requirements.length < 1 || v2Requirements.length > MAX_OBLIGATIONS ||
      v2Requirements[0]?.requirementId !== v2.requirementId ||
      v2Requirements.some((item) =>
        item.acquisitionRoute !== "UNSUPPORTED" ||
        item.temporalPosture !== requirement.temporalPosture ||
        officialSourceRoleForRequirement(item.kind) !== v2.targetRole
      ) ||
      v2.requirementIds.length !== v2Requirements.length ||
      v2.requirementIds.some((item, index) =>
        item !== v2Requirements[index]?.requirementId ||
        (index > 0 && item <= v2.requirementIds[index - 1]!)
      ) ||
      v2.proposalIds.join("\n") !== sortedUnique(v2Requirements.map((item) =>
        item.proposalId
      )).join("\n") || v2.proposalId !== v2Requirements[0]?.proposalId ||
      v2.venueIds.length !== 1 || v2.venueIds[0] !== v2.venueId ||
      v2.protocolIdentities.length !== 1 ||
      v2.protocolIdentities[0] !== v2.protocolIdentity ||
      v2.listingRefs.length < 1 || v2.listingRefs.length > 8 ||
      v2.surfaces.some((surface) => surface.venueId !== v2.venueId) ||
      v2Requirements.some((item) =>
        v2.listingRefs.some((listingRef) => !item.sourceObservations.some((observation) =>
          observation.listingRef === listingRef && observation.venueId === v2.venueId &&
          observation.protocolIdentity === v2.protocolIdentity
        ))
      ) || v2.supplyScopeIdentity !== expectedSupplyScope ||
      v2.taskId !== expectedV2TaskId
    ))
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
