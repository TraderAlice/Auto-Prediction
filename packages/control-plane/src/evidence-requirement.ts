import { hashCanonical, type Hash } from "@pmh/domain";
import { hasBoundedDiscoveryEvidenceLocators } from "./discovery-evidence-locator.js";
import type {
  DiscoveryCatalogListing,
  DiscoveryEvidenceLocator,
} from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAX_REQUIREMENTS = 20;
const MAX_LISTINGS = 8;
const REQUIREMENT_V1_KEYS = Object.freeze([
  "acquisitionRoute",
  "acquisitionScopeIdentity",
  "authority",
  "certificateAuthority",
  "claim",
  "contradictingObservation",
  "eligibleLocators",
  "executionAuthority",
  "fetchAuthority",
  "kind",
  "listingRefs",
  "origin",
  "proposalId",
  "providerRequestAuthority",
  "reason",
  "requirementId",
  "satisfyingObservation",
  "schemaVersion",
  "semanticDecisionAuthority",
  "sourceObservations",
  "temporalPosture",
]);
const REQUIREMENT_V2_KEYS = Object.freeze([
  ...REQUIREMENT_V1_KEYS,
  "proposalListingRefs",
].sort());
const SOURCE_OBSERVATION_KEYS = Object.freeze([
  "evidenceLocatorIdentities",
  "listingHash",
  "listingRef",
  "protocolIdentity",
  "sourceRawHash",
  "sourceReceivedAt",
  "venueId",
]);
const LOCATOR_BINDING_KEYS = Object.freeze([
  "listingRefs",
  "locator",
  "protocolIdentity",
  "venueId",
]);

export const EVIDENCE_REQUIREMENT_KINDS = Object.freeze([
  "RESOLUTION_RULE",
  "VOID_CANCELLATION",
  "ORACLE_SOURCE",
  "TIME_BOUNDARY",
  "OUTCOME_MAPPING",
  "VENUE_POLICY",
  "FEE_SCHEDULE",
  "QUOTE_DEPTH",
] as const);

export type EvidenceRequirementKind =
  (typeof EVIDENCE_REQUIREMENT_KINDS)[number];

export type EvidenceRequirementDraft = Readonly<{
  kind: EvidenceRequirementKind;
  listingRefs: readonly string[];
  claim: string;
  reason: string;
  satisfyingObservation: string;
  contradictingObservation: string;
  temporalPosture: "CURRENT" | "HISTORICAL_AT_SOURCE_OBSERVATION";
}>;

type EvidenceRequirementFields = Readonly<{
  requirementId: Hash;
  acquisitionScopeIdentity: Hash;
  origin: "MARKET_ARCHAEOLOGIST" | "SEMANTIC_REVIEW" | "PROBABILITY_ESTIMATION";
  proposalId: Hash;
  kind: EvidenceRequirementKind;
  listingRefs: readonly string[];
  claim: string;
  reason: string;
  satisfyingObservation: string;
  contradictingObservation: string;
  temporalPosture: EvidenceRequirementDraft["temporalPosture"];
  sourceObservations: readonly Readonly<{
    listingRef: string;
    listingHash: Hash;
    sourceRawHash: Hash;
    sourceReceivedAt: string;
    venueId: string;
    protocolIdentity: string;
    evidenceLocatorIdentities: readonly Hash[];
  }>[];
  eligibleLocators: readonly Readonly<{
    listingRefs: readonly string[];
    venueId: string;
    protocolIdentity: string;
    locator: DiscoveryEvidenceLocator;
  }>[];
  acquisitionRoute: "DOCUMENT_LOCATOR" | "MARKET_DATA" | "UNSUPPORTED";
  authority: "EVIDENCE_ACQUISITION_REQUEST_ONLY";
  fetchAuthority: false;
  providerRequestAuthority: false;
  semanticDecisionAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
}>;

export type EvidenceRequirement =
  | Readonly<EvidenceRequirementFields & {
    schemaVersion: "pmh.evidence-requirement.v1";
  }>
  | Readonly<EvidenceRequirementFields & {
    schemaVersion: "pmh.evidence-requirement.v2";
    proposalListingRefs: readonly string[];
  }>;

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.trim() !== "" &&
    value.length <= maximum;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function isRequirementKind(value: unknown): value is EvidenceRequirementKind {
  return typeof value === "string" &&
    (EVIDENCE_REQUIREMENT_KINDS as readonly string[]).includes(value);
}

function compatibleLocatorRoles(
  kind: EvidenceRequirementKind,
): readonly DiscoveryEvidenceLocator["role"][] {
  if (kind === "ORACLE_SOURCE") return ["OUTCOME_RESOLUTION_SOURCE"];
  if (kind === "VENUE_POLICY") return ["VENUE_RULE_DOCUMENT"];
  if ([
    "RESOLUTION_RULE",
    "VOID_CANCELLATION",
    "TIME_BOUNDARY",
    "OUTCOME_MAPPING",
  ].includes(kind)) return ["CONTRACT_RULE_DOCUMENT"];
  return [];
}

function normalizedDraft(value: unknown): EvidenceRequirementDraft {
  if (value === null || typeof value !== "object") {
    throw new Error("evidence requirement draft is malformed");
  }
  const raw = value as Record<string, unknown>;
  if (
    !isRequirementKind(raw.kind) ||
    !Array.isArray(raw.listingRefs) ||
    raw.listingRefs.length < 1 ||
    raw.listingRefs.length > MAX_LISTINGS ||
    new Set(raw.listingRefs).size !== raw.listingRefs.length ||
    raw.listingRefs.some((item) => !boundedText(item, 500)) ||
    !boundedText(raw.claim, 1_000) ||
    !boundedText(raw.reason, 1_000) ||
    !boundedText(raw.satisfyingObservation, 1_000) ||
    !boundedText(raw.contradictingObservation, 1_000) ||
    !["CURRENT", "HISTORICAL_AT_SOURCE_OBSERVATION"]
      .includes(String(raw.temporalPosture))
  ) {
    throw new Error("evidence requirement draft violates its bounded contract");
  }
  return Object.freeze({
    kind: raw.kind,
    listingRefs: Object.freeze(
      (raw.listingRefs as string[]).map((item) => item.trim()),
    ),
    claim: (raw.claim as string).trim(),
    reason: (raw.reason as string).trim(),
    satisfyingObservation: (raw.satisfyingObservation as string).trim(),
    contradictingObservation: (raw.contradictingObservation as string).trim(),
    temporalPosture:
      raw.temporalPosture as EvidenceRequirementDraft["temporalPosture"],
  });
}

export function validateEvidenceRequirementDrafts(
  value: unknown,
): readonly EvidenceRequirementDraft[] {
  if (!Array.isArray(value) || value.length > MAX_REQUIREMENTS) {
    throw new Error("evidence requirement draft set is invalid or unbounded");
  }
  return Object.freeze(value.map(normalizedDraft));
}

function acquisitionRoute(
  kind: EvidenceRequirementKind,
  eligibleLocatorCount: number,
): EvidenceRequirement["acquisitionRoute"] {
  if (eligibleLocatorCount > 0) return "DOCUMENT_LOCATOR";
  if (kind === "QUOTE_DEPTH") return "MARKET_DATA";
  return "UNSUPPORTED";
}

function scopeIdentity(input: Pick<
  EvidenceRequirement,
  | "kind"
  | "listingRefs"
  | "temporalPosture"
  | "eligibleLocators"
  | "acquisitionRoute"
>): Hash {
  return hashCanonical({
    schemaVersion: "pmh.evidence-acquisition-scope.v1",
    kind: input.kind,
    listingRefs: input.acquisitionRoute === "DOCUMENT_LOCATOR"
      ? []
      : input.listingRefs,
    temporalPosture: input.temporalPosture,
    eligibleLocatorIdentities: input.eligibleLocators.map(
      (item) => item.locator.locatorIdentity,
    ),
    acquisitionRoute: input.acquisitionRoute,
  });
}

export function buildEvidenceRequirements(input: Readonly<{
  origin: EvidenceRequirement["origin"];
  proposalId: Hash;
  proposalListingRefs: readonly string[];
  listings: readonly DiscoveryCatalogListing[];
  drafts: readonly EvidenceRequirementDraft[];
}>): readonly EvidenceRequirement[] {
  if (
    !HASH_PATTERN.test(input.proposalId) ||
    input.proposalListingRefs.length < 2 ||
    input.proposalListingRefs.length > MAX_LISTINGS ||
    new Set(input.proposalListingRefs).size !== input.proposalListingRefs.length ||
    input.proposalListingRefs.some((item) => !boundedText(item, 500)) ||
    input.proposalListingRefs.some((listingRef) =>
      !input.listings.some((listing) => listing.listingRef === listingRef)
    )
  ) {
    throw new Error("evidence requirement proposal scope is invalid");
  }
  const drafts = validateEvidenceRequirementDrafts(input.drafts);
  const listingByRef = new Map(
    input.listings.map((listing) => [listing.listingRef, listing] as const),
  );
  const proposalRefs = new Set(input.proposalListingRefs);
  const requirements = drafts.map((draft) => {
    const requestedRefs = new Set(draft.listingRefs);
    if (
      draft.listingRefs.some((listingRef) => !proposalRefs.has(listingRef)) ||
      draft.listingRefs.some((listingRef) => !listingByRef.has(listingRef))
    ) {
      throw new Error("evidence requirement exceeds its proposal listing scope");
    }
    const listingRefs = Object.freeze(
      input.proposalListingRefs.filter((listingRef) => requestedRefs.has(listingRef)),
    );
    const sourceObservations = Object.freeze(listingRefs.map((listingRef) => {
      const listing = listingByRef.get(listingRef)!;
      return Object.freeze({
        listingRef,
        listingHash: hashCanonical(listing),
        sourceRawHash: listing.sourceRawHash as Hash,
        sourceReceivedAt: listing.sourceReceivedAt,
        venueId: listing.venueId,
        protocolIdentity: listing.protocolIdentity,
        evidenceLocatorIdentities: Object.freeze(
          (listing.evidenceLocators ?? [])
            .map((locator) => locator.locatorIdentity)
            .sort((left, right) => left.localeCompare(right)),
        ),
      });
    }));
    const allowedRoles = new Set(compatibleLocatorRoles(draft.kind));
    const locatorBindings = listingRefs.flatMap((listingRef) => {
      const listing = listingByRef.get(listingRef)!;
      return (listing.evidenceLocators ?? [])
        .filter((locator) => allowedRoles.has(locator.role))
        .map((locator) => ({
          listingRef,
          venueId: listing.venueId,
          protocolIdentity: listing.protocolIdentity,
          locator,
        }));
    });
    const locatorByIdentity = new Map<string, {
      listingRefs: string[];
      venueId: string;
      protocolIdentity: string;
      locator: DiscoveryEvidenceLocator;
    }>();
    for (const binding of locatorBindings) {
      const existing = locatorByIdentity.get(binding.locator.locatorIdentity);
      if (existing) {
        existing.listingRefs.push(binding.listingRef);
      } else {
        locatorByIdentity.set(binding.locator.locatorIdentity, {
          listingRefs: [binding.listingRef],
          venueId: binding.venueId,
          protocolIdentity: binding.protocolIdentity,
          locator: binding.locator,
        });
      }
    }
    const eligibleLocators = Object.freeze([...locatorByIdentity.values()]
      .map((binding) => Object.freeze({
        ...binding,
        listingRefs: Object.freeze(binding.listingRefs),
      }))
      .sort((left, right) =>
        left.locator.locatorIdentity.localeCompare(right.locator.locatorIdentity)
      ));
    const route = acquisitionRoute(draft.kind, eligibleLocators.length);
    const scoped = {
      kind: draft.kind,
      listingRefs,
      temporalPosture: draft.temporalPosture,
      eligibleLocators,
      acquisitionRoute: route,
    };
    const body = Object.freeze({
      schemaVersion: "pmh.evidence-requirement.v2" as const,
      acquisitionScopeIdentity: scopeIdentity(scoped),
      origin: input.origin,
      proposalId: input.proposalId,
      proposalListingRefs: Object.freeze([...input.proposalListingRefs]),
      kind: draft.kind,
      listingRefs,
      claim: draft.claim,
      reason: draft.reason,
      satisfyingObservation: draft.satisfyingObservation,
      contradictingObservation: draft.contradictingObservation,
      temporalPosture: draft.temporalPosture,
      sourceObservations,
      eligibleLocators,
      acquisitionRoute: route,
      authority: "EVIDENCE_ACQUISITION_REQUEST_ONLY" as const,
      fetchAuthority: false as const,
      providerRequestAuthority: false as const,
      semanticDecisionAuthority: false as const,
      certificateAuthority: false as const,
      executionAuthority: false as const,
    });
    return assertEvidenceRequirement(Object.freeze({
      ...body,
      requirementId: hashCanonical(body),
    }));
  });
  return Object.freeze([...new Map(
    requirements.map((requirement) => [requirement.requirementId, requirement]),
  ).values()].sort((left, right) =>
    left.requirementId.localeCompare(right.requirementId)
  ));
}

export function assertEvidenceRequirement(value: unknown): EvidenceRequirement {
  if (value === null || typeof value !== "object") {
    throw new Error("evidence requirement is malformed");
  }
  const requirement = value as EvidenceRequirement;
  const { requirementId, ...body } = requirement;
  const expectedKeys = requirement.schemaVersion === "pmh.evidence-requirement.v1"
    ? REQUIREMENT_V1_KEYS
    : requirement.schemaVersion === "pmh.evidence-requirement.v2"
      ? REQUIREMENT_V2_KEYS
      : null;
  if (
    expectedKeys === null ||
    Object.keys(requirement).sort().join("\n") !== expectedKeys.join("\n") ||
    !HASH_PATTERN.test(String(requirementId)) ||
    requirementId !== hashCanonical(body) ||
    !HASH_PATTERN.test(String(requirement.acquisitionScopeIdentity)) ||
    !HASH_PATTERN.test(String(requirement.proposalId)) ||
    !["MARKET_ARCHAEOLOGIST", "SEMANTIC_REVIEW", "PROBABILITY_ESTIMATION"]
      .includes(requirement.origin) ||
    !isRequirementKind(requirement.kind) ||
    !Array.isArray(requirement.listingRefs) ||
    requirement.listingRefs.length < 1 ||
    requirement.listingRefs.length > MAX_LISTINGS ||
    new Set(requirement.listingRefs).size !== requirement.listingRefs.length ||
    requirement.listingRefs.some((item) => !boundedText(item, 500)) ||
    !boundedText(requirement.claim, 1_000) ||
    !boundedText(requirement.reason, 1_000) ||
    !boundedText(requirement.satisfyingObservation, 1_000) ||
    !boundedText(requirement.contradictingObservation, 1_000) ||
    !["CURRENT", "HISTORICAL_AT_SOURCE_OBSERVATION"]
      .includes(requirement.temporalPosture) ||
    !Array.isArray(requirement.sourceObservations) ||
    requirement.sourceObservations.length !== requirement.listingRefs.length ||
    !Array.isArray(requirement.eligibleLocators) ||
    requirement.eligibleLocators.length > MAX_LISTINGS * 8 ||
    !["DOCUMENT_LOCATOR", "MARKET_DATA", "UNSUPPORTED"]
      .includes(requirement.acquisitionRoute) ||
    requirement.authority !== "EVIDENCE_ACQUISITION_REQUEST_ONLY" ||
    requirement.fetchAuthority !== false ||
    requirement.providerRequestAuthority !== false ||
    requirement.semanticDecisionAuthority !== false ||
    requirement.certificateAuthority !== false ||
    requirement.executionAuthority !== false
  ) {
    throw new Error("evidence requirement violates its bounded authority contract");
  }
  if (requirement.schemaVersion === "pmh.evidence-requirement.v2" && (
    !Array.isArray(requirement.proposalListingRefs) ||
    requirement.proposalListingRefs.length < 2 ||
    requirement.proposalListingRefs.length > MAX_LISTINGS ||
    new Set(requirement.proposalListingRefs).size !==
      requirement.proposalListingRefs.length ||
    requirement.proposalListingRefs.some((item) => !boundedText(item, 500)) ||
    requirement.listingRefs.some((listingRef) =>
      !requirement.proposalListingRefs.includes(listingRef)
    )
  )) {
    throw new Error("evidence requirement proposal scope is malformed");
  }
  for (const [index, observation] of requirement.sourceObservations.entries()) {
    if (
      observation === null || typeof observation !== "object" ||
      Object.keys(observation).sort().join("\n") !==
        SOURCE_OBSERVATION_KEYS.join("\n") ||
      observation.listingRef !== requirement.listingRefs[index] ||
      !HASH_PATTERN.test(String(observation.listingHash)) ||
      !HASH_PATTERN.test(String(observation.sourceRawHash)) ||
      !isIsoDate(observation.sourceReceivedAt) ||
      !boundedText(observation.venueId, 256) ||
      !boundedText(observation.protocolIdentity, 1_000) ||
      !Array.isArray(observation.evidenceLocatorIdentities) ||
      observation.evidenceLocatorIdentities.length > 8 ||
      observation.evidenceLocatorIdentities.some((identity: Hash) =>
        !HASH_PATTERN.test(String(identity))
      ) ||
      observation.evidenceLocatorIdentities.some((
        identity: Hash,
        locatorIndex: number,
      ) =>
        locatorIndex > 0 &&
        identity <= observation.evidenceLocatorIdentities[locatorIndex - 1]!
      )
    ) throw new Error("evidence requirement source observation is malformed");
  }
  const allowedRoles = new Set(compatibleLocatorRoles(requirement.kind));
  let previousLocatorIdentity = "";
  const locatorIdentities = new Set<Hash>();
  for (const item of requirement.eligibleLocators) {
    if (
      item === null || typeof item !== "object" ||
      Object.keys(item).sort().join("\n") !== LOCATOR_BINDING_KEYS.join("\n")
    ) throw new Error("evidence requirement locator binding is malformed");
    const observations = item.listingRefs.map((listingRef: string) =>
      requirement.sourceObservations.find(
        (observation) => observation.listingRef === listingRef,
      )!
    );
    if (
      !Array.isArray(item.listingRefs) ||
      item.listingRefs.length < 1 ||
      item.listingRefs.length > MAX_LISTINGS ||
      new Set(item.listingRefs).size !== item.listingRefs.length ||
      item.listingRefs.some((listingRef: string) =>
        !requirement.listingRefs.includes(listingRef)
      ) ||
      requirement.listingRefs.filter((listingRef) =>
        item.listingRefs.includes(listingRef)
      ).some((listingRef, index) => item.listingRefs[index] !== listingRef) ||
      observations.some((observation: EvidenceRequirement["sourceObservations"][number]) =>
        observation.venueId !== item.venueId ||
        observation.protocolIdentity !== item.protocolIdentity ||
        !observation.evidenceLocatorIdentities.includes(
          item.locator.locatorIdentity,
        )
      ) ||
      !boundedText(item.venueId, 256) ||
      !boundedText(item.protocolIdentity, 1_000) ||
      !allowedRoles.has(item.locator.role) ||
      item.locator.locatorIdentity <= previousLocatorIdentity ||
      locatorIdentities.has(item.locator.locatorIdentity) ||
      !hasBoundedDiscoveryEvidenceLocators({
        venueId: item.venueId,
        protocolIdentity: item.protocolIdentity,
        evidenceLocators: [item.locator],
      })
    ) throw new Error("evidence requirement locator binding is malformed");
    locatorIdentities.add(item.locator.locatorIdentity);
    previousLocatorIdentity = item.locator.locatorIdentity;
  }
  const expectedRoute = acquisitionRoute(
    requirement.kind,
    requirement.eligibleLocators.length,
  );
  if (
    requirement.acquisitionRoute !== expectedRoute ||
    requirement.acquisitionScopeIdentity !== scopeIdentity(requirement)
  ) {
    throw new Error("evidence requirement acquisition routing is inconsistent");
  }
  return Object.freeze(requirement);
}

export function rebaseEvidenceRequirementToCurrentListings(
  requirementInput: EvidenceRequirement,
  input: Readonly<{
    proposalListingRefs?: readonly string[];
    listings: readonly DiscoveryCatalogListing[];
  }>,
): EvidenceRequirement {
  const requirement = assertEvidenceRequirement(requirementInput);
  const proposalListingRefs = input.proposalListingRefs ??
    (requirement.schemaVersion === "pmh.evidence-requirement.v2"
      ? requirement.proposalListingRefs
      : requirement.listingRefs);
  if (
    requirement.temporalPosture !== "CURRENT" ||
    proposalListingRefs.length < 2 ||
    !requirement.listingRefs.every((listingRef) =>
      input.listings.some((listing) => listing.listingRef === listingRef)
    ) ||
    !proposalListingRefs.every((listingRef) =>
      input.listings.some((listing) => listing.listingRef === listingRef)
    )
  ) return requirement;
  const rebased = buildEvidenceRequirements({
    origin: requirement.origin,
    proposalId: requirement.proposalId,
    proposalListingRefs,
    listings: input.listings,
    drafts: [{
      kind: requirement.kind,
      listingRefs: requirement.listingRefs,
      claim: requirement.claim,
      reason: requirement.reason,
      satisfyingObservation: requirement.satisfyingObservation,
      contradictingObservation: requirement.contradictingObservation,
      temporalPosture: requirement.temporalPosture,
    }],
  })[0]!;
  return requirement.schemaVersion === "pmh.evidence-requirement.v2" &&
      rebased.acquisitionScopeIdentity === requirement.acquisitionScopeIdentity &&
      requirement.proposalListingRefs.length === proposalListingRefs.length &&
      requirement.proposalListingRefs.every((listingRef, index) =>
        listingRef === proposalListingRefs[index]
      )
    ? requirement
    : rebased;
}

export function rebaseEvidenceRequirementToRetainedLocatorCapabilities(
  requirementInput: EvidenceRequirement,
  donorInputs: readonly EvidenceRequirement[],
): EvidenceRequirement {
  const requirement = assertEvidenceRequirement(requirementInput);
  if (
    requirement.temporalPosture !== "CURRENT" ||
    requirement.acquisitionRoute !== "UNSUPPORTED"
  ) return requirement;
  const proposalListingRefs = requirement.schemaVersion ===
      "pmh.evidence-requirement.v2"
    ? requirement.proposalListingRefs
    : requirement.listingRefs;
  if (proposalListingRefs.length < 2) return requirement;

  const targetRefs = new Set(requirement.listingRefs);
  const allowedRoles = new Set(compatibleLocatorRoles(requirement.kind));
  const candidates = donorInputs.flatMap((donorInput) => {
    const donor = assertEvidenceRequirement(donorInput);
    if (donor.temporalPosture !== "CURRENT") return [];
    return donor.eligibleLocators.flatMap((binding) => {
      if (
        !allowedRoles.has(binding.locator.role) ||
        binding.listingRefs.some((listingRef) => !targetRefs.has(listingRef))
      ) return [];
      const observations = binding.listingRefs.map((listingRef) =>
        donor.sourceObservations.find((observation) =>
          observation.listingRef === listingRef &&
          observation.venueId === binding.venueId &&
          observation.protocolIdentity === binding.protocolIdentity &&
          observation.evidenceLocatorIdentities.includes(
            binding.locator.locatorIdentity,
          )
        )
      );
      const targetObservations = binding.listingRefs.map((listingRef) =>
        requirement.sourceObservations.find((observation) =>
          observation.listingRef === listingRef
        )
      );
      return observations.some((observation) => observation === undefined) ||
          targetObservations.some((observation) => observation === undefined) ||
          observations.some((observation, index) =>
            observation!.venueId !== targetObservations[index]!.venueId ||
            observation!.protocolIdentity !==
              targetObservations[index]!.protocolIdentity
          )
        ? []
        : [Object.freeze({ binding, observations: observations as readonly EvidenceRequirement["sourceObservations"][number][] })];
    });
  });
  if (candidates.length === 0) return requirement;

  const selectedObservations = new Map(requirement.sourceObservations.map(
    (observation) => [observation.listingRef, observation] as const,
  ));
  for (const listingRef of requirement.listingRefs) {
    const observations = candidates.flatMap((candidate) =>
      candidate.observations.filter((observation) =>
        observation.listingRef === listingRef
      )
    ).sort((left, right) =>
      right.sourceReceivedAt.localeCompare(left.sourceReceivedAt) ||
      right.listingHash.localeCompare(left.listingHash) ||
      right.sourceRawHash.localeCompare(left.sourceRawHash),
    );
    if (observations[0] !== undefined) {
      selectedObservations.set(listingRef, observations[0]);
    }
  }
  const compatibleCandidates = candidates.filter((candidate) =>
    candidate.observations.every((observation) => {
      const selected = selectedObservations.get(observation.listingRef);
      return selected?.venueId === candidate.binding.venueId &&
        selected.protocolIdentity === candidate.binding.protocolIdentity &&
        selected.evidenceLocatorIdentities.includes(
          candidate.binding.locator.locatorIdentity,
        );
    })
  );
  const locatorByIdentity = new Map<Hash, {
    listingRefs: string[];
    venueId: string;
    protocolIdentity: string;
    locator: DiscoveryEvidenceLocator;
  }>();
  for (const { binding } of compatibleCandidates) {
    const existing = locatorByIdentity.get(binding.locator.locatorIdentity);
    if (existing === undefined) {
      locatorByIdentity.set(binding.locator.locatorIdentity, {
        listingRefs: requirement.listingRefs.filter((listingRef) =>
          binding.listingRefs.includes(listingRef)
        ),
        venueId: binding.venueId,
        protocolIdentity: binding.protocolIdentity,
        locator: binding.locator,
      });
    } else {
      existing.listingRefs = requirement.listingRefs.filter((listingRef) =>
        existing.listingRefs.includes(listingRef) ||
        binding.listingRefs.includes(listingRef)
      );
    }
  }
  const eligibleLocators = Object.freeze([...locatorByIdentity.values()]
    .map((binding) => Object.freeze({
      ...binding,
      listingRefs: Object.freeze([...binding.listingRefs]),
    }))
    .sort((left, right) =>
      left.locator.locatorIdentity.localeCompare(right.locator.locatorIdentity)
    ));
  if (eligibleLocators.length === 0) return requirement;
  const sourceObservations = Object.freeze(requirement.listingRefs.map(
    (listingRef) => selectedObservations.get(listingRef)!,
  ));
  const scoped = {
    kind: requirement.kind,
    listingRefs: requirement.listingRefs,
    temporalPosture: requirement.temporalPosture,
    eligibleLocators,
    acquisitionRoute: "DOCUMENT_LOCATOR" as const,
  };
  const body = Object.freeze({
    schemaVersion: "pmh.evidence-requirement.v2" as const,
    acquisitionScopeIdentity: scopeIdentity(scoped),
    origin: requirement.origin,
    proposalId: requirement.proposalId,
    proposalListingRefs: Object.freeze([...proposalListingRefs]),
    kind: requirement.kind,
    listingRefs: requirement.listingRefs,
    claim: requirement.claim,
    reason: requirement.reason,
    satisfyingObservation: requirement.satisfyingObservation,
    contradictingObservation: requirement.contradictingObservation,
    temporalPosture: requirement.temporalPosture,
    sourceObservations,
    eligibleLocators,
    acquisitionRoute: "DOCUMENT_LOCATOR" as const,
    authority: "EVIDENCE_ACQUISITION_REQUEST_ONLY" as const,
    fetchAuthority: false as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertEvidenceRequirement(Object.freeze({
    ...body,
    requirementId: hashCanonical(body),
  }));
}

export function rebaseEvidenceRequirementsToRetainedLocatorCapabilities(
  requirementInputs: readonly EvidenceRequirement[],
): readonly EvidenceRequirement[] {
  const requirements = requirementInputs.map(assertEvidenceRequirement);
  const donorsByListingRef = new Map<string, EvidenceRequirement[]>();
  for (const donor of requirements) {
    if (
      donor.temporalPosture !== "CURRENT" ||
      donor.eligibleLocators.length === 0
    ) continue;
    for (const listingRef of donor.listingRefs) {
      const donors = donorsByListingRef.get(listingRef) ?? [];
      donors.push(donor);
      donorsByListingRef.set(listingRef, donors);
    }
  }
  return Object.freeze(requirements.map((requirement) => {
    if (
      requirement.temporalPosture !== "CURRENT" ||
      requirement.acquisitionRoute !== "UNSUPPORTED"
    ) return requirement;
    const donors = [...new Map(requirement.listingRefs.flatMap((listingRef) =>
      (donorsByListingRef.get(listingRef) ?? []).map((donor) =>
        [donor.requirementId, donor] as const
      )
    )).values()].sort((left, right) =>
      left.requirementId.localeCompare(right.requirementId)
    );
    return rebaseEvidenceRequirementToRetainedLocatorCapabilities(
      requirement,
      donors,
    );
  }));
}

export function rebaseEvidenceRequirementToAdmittedLocator(input: Readonly<{
  requirement: EvidenceRequirement;
  venueId: string;
  protocolIdentity: string;
  locator: DiscoveryEvidenceLocator;
}>): EvidenceRequirement {
  const requirement = assertEvidenceRequirement(input.requirement);
  if (
    requirement.acquisitionRoute !== "UNSUPPORTED" ||
    input.locator.schemaVersion !== "pmh.discovery-evidence-locator.v3" ||
    !compatibleLocatorRoles(requirement.kind).includes(input.locator.role)
  ) return requirement;
  const matchedObservations = requirement.sourceObservations.filter((observation) =>
    observation.venueId === input.venueId &&
    observation.protocolIdentity === input.protocolIdentity
  );
  if (
    matchedObservations.length === 0 ||
    !hasBoundedDiscoveryEvidenceLocators({
      venueId: input.venueId,
      protocolIdentity: input.protocolIdentity,
      evidenceLocators: [input.locator],
    })
  ) return requirement;
  const matchedRefs = new Set(matchedObservations.map((item) => item.listingRef));
  const sourceObservations = Object.freeze(requirement.sourceObservations.map((observation) =>
    !matchedRefs.has(observation.listingRef)
      ? observation
      : Object.freeze({
          ...observation,
          evidenceLocatorIdentities: Object.freeze([...new Set([
            ...observation.evidenceLocatorIdentities,
            input.locator.locatorIdentity,
          ])].sort((left, right) => left.localeCompare(right))),
        })
  ));
  const eligibleLocators = Object.freeze([Object.freeze({
    listingRefs: Object.freeze(requirement.listingRefs.filter((listingRef) =>
      matchedRefs.has(listingRef)
    )),
    venueId: input.venueId,
    protocolIdentity: input.protocolIdentity,
    locator: input.locator,
  })]);
  const proposalListingRefs = requirement.schemaVersion ===
      "pmh.evidence-requirement.v2"
    ? requirement.proposalListingRefs
    : requirement.listingRefs;
  const scoped = {
    kind: requirement.kind,
    listingRefs: requirement.listingRefs,
    temporalPosture: requirement.temporalPosture,
    eligibleLocators,
    acquisitionRoute: "DOCUMENT_LOCATOR" as const,
  };
  const body = Object.freeze({
    schemaVersion: "pmh.evidence-requirement.v2" as const,
    acquisitionScopeIdentity: scopeIdentity(scoped),
    origin: requirement.origin,
    proposalId: requirement.proposalId,
    proposalListingRefs: Object.freeze([...proposalListingRefs]),
    kind: requirement.kind,
    listingRefs: requirement.listingRefs,
    claim: requirement.claim,
    reason: requirement.reason,
    satisfyingObservation: requirement.satisfyingObservation,
    contradictingObservation: requirement.contradictingObservation,
    temporalPosture: requirement.temporalPosture,
    sourceObservations,
    eligibleLocators,
    acquisitionRoute: "DOCUMENT_LOCATOR" as const,
    authority: "EVIDENCE_ACQUISITION_REQUEST_ONLY" as const,
    fetchAuthority: false as const,
    providerRequestAuthority: false as const,
    semanticDecisionAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertEvidenceRequirement(Object.freeze({
    ...body,
    requirementId: hashCanonical(body),
  }));
}
