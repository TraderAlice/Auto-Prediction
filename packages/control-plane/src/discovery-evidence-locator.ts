import { hashCanonical, type Hash } from "@pmh/domain";
import type {
  DiscoveryCatalogListing,
  DiscoveryEvidenceLocator,
} from "./types.js";

const MAX_EVIDENCE_LOCATORS = 8;
const MAX_EVIDENCE_LOCATOR_URL_CHARACTERS = 2_048;
const EVIDENCE_LOCATOR_ROLES = Object.freeze([
  "CONTRACT_RULE_DOCUMENT",
  "OUTCOME_RESOLUTION_SOURCE",
  "VENUE_RULE_DOCUMENT",
] as const satisfies readonly DiscoveryEvidenceLocator["role"][]);
const EVIDENCE_LOCATOR_KEYS = Object.freeze([
  "authority",
  "fetchAuthority",
  "locatorIdentity",
  "role",
  "schemaVersion",
  "url",
]);
const DISCOVERED_EVIDENCE_LOCATOR_KEYS = Object.freeze([
  ...EVIDENCE_LOCATOR_KEYS,
  "provenance",
].sort());
const DISCOVERED_PROVENANCE_KEYS = Object.freeze([
  "admissionId", "candidateId", "kind", "taskId",
]);
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function isEvidenceLocatorRole(
  value: unknown,
): value is DiscoveryEvidenceLocator["role"] {
  return typeof value === "string" &&
    (EVIDENCE_LOCATOR_ROLES as readonly string[]).includes(value);
}

function normalizedHttpsLocator(value: string | undefined): string | null {
  const candidate = value?.trim() ?? "";
  if (
    candidate === "" ||
    candidate.length > MAX_EVIDENCE_LOCATOR_URL_CHARACTERS
  ) return null;
  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname === "" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== "" ||
      (parsed.port !== "" && parsed.port !== "443")
    ) return null;
    const normalized = parsed.toString();
    return normalized.length <= MAX_EVIDENCE_LOCATOR_URL_CHARACTERS
      ? normalized
      : null;
  } catch {
    return null;
  }
}

export function buildDiscoveryEvidenceLocator(input: Readonly<{
  venueId: string;
  protocolIdentity: string;
  role: DiscoveryEvidenceLocator["role"];
  url: string | undefined;
}>): DiscoveryEvidenceLocator | null {
  if (
    input.venueId.trim() === "" ||
    input.protocolIdentity.trim() === "" ||
    !isEvidenceLocatorRole(input.role)
  ) {
    return null;
  }
  const url = normalizedHttpsLocator(input.url);
  if (url === null) return null;
  const body = Object.freeze({
    schemaVersion: input.role === "VENUE_RULE_DOCUMENT"
      ? "pmh.discovery-evidence-locator.v2" as const
      : "pmh.discovery-evidence-locator.v1" as const,
    role: input.role,
    url,
    authority: "EVIDENCE_LOCATOR_ONLY" as const,
    fetchAuthority: false as const,
  });
  return Object.freeze({
    ...body,
    locatorIdentity: hashCanonical({
      ...body,
      venueId: input.venueId,
      protocolIdentity: input.protocolIdentity,
    }),
  });
}

export function buildDiscoveryEvidenceLocators(input: Readonly<{
  venueId: string;
  protocolIdentity: string;
  rulesUrl?: string;
  venueRulesUrl?: string;
  resolutionSourceUrl?: string;
}>): readonly DiscoveryEvidenceLocator[] {
  const candidates = [
    ["CONTRACT_RULE_DOCUMENT", input.rulesUrl],
    ["OUTCOME_RESOLUTION_SOURCE", input.resolutionSourceUrl],
    ["VENUE_RULE_DOCUMENT", input.venueRulesUrl],
  ] as const;
  return Object.freeze(candidates.flatMap(([role, url]) => {
    const locator = buildDiscoveryEvidenceLocator({ ...input, role, url });
    return locator === null ? [] : [locator];
  }).sort((left, right) =>
    left.role.localeCompare(right.role) || left.url.localeCompare(right.url)
  ));
}

export function buildAdmittedDiscoveryEvidenceLocator(input: Readonly<{
  venueId: string;
  protocolIdentity: string;
  role: DiscoveryEvidenceLocator["role"];
  url: string;
  admissionId: Hash;
  taskId: Hash;
  candidateId: Hash;
}>): DiscoveryEvidenceLocator | null {
  if (
    input.venueId.trim() === "" ||
    input.protocolIdentity.trim() === "" ||
    !isEvidenceLocatorRole(input.role) ||
    !HASH_PATTERN.test(input.admissionId) ||
    !HASH_PATTERN.test(input.taskId) ||
    !HASH_PATTERN.test(input.candidateId)
  ) return null;
  const url = normalizedHttpsLocator(input.url);
  if (url === null) return null;
  const body = Object.freeze({
    schemaVersion: "pmh.discovery-evidence-locator.v3" as const,
    role: input.role,
    url,
    authority: "EVIDENCE_LOCATOR_ONLY" as const,
    fetchAuthority: false as const,
    provenance: Object.freeze({
      kind: "FIRST_PARTY_OFFICIAL_SOURCE_ADMISSION" as const,
      admissionId: input.admissionId,
      taskId: input.taskId,
      candidateId: input.candidateId,
    }),
  });
  return Object.freeze({
    ...body,
    locatorIdentity: hashCanonical({
      ...body,
      venueId: input.venueId,
      protocolIdentity: input.protocolIdentity,
    }),
  });
}

export function hasBoundedDiscoveryEvidenceLocators(
  listing: Pick<DiscoveryCatalogListing, "venueId" | "protocolIdentity" | "evidenceLocators">,
): boolean {
  const locators: unknown = listing.evidenceLocators;
  if (locators === undefined) return true;
  if (
    typeof listing.venueId !== "string" || listing.venueId.trim() === "" ||
    typeof listing.protocolIdentity !== "string" ||
    listing.protocolIdentity.trim() === "" ||
    !Array.isArray(locators) ||
    locators.length === 0 ||
    locators.length > MAX_EVIDENCE_LOCATORS
  ) return false;

  let previous = "";
  const identities = new Set<string>();
  for (const rawLocator of locators) {
    if (rawLocator === null || typeof rawLocator !== "object") return false;
    const locator = rawLocator as Record<string, unknown>;
    if (
      Object.keys(locator).sort().join("\n") !==
        (locator.schemaVersion === "pmh.discovery-evidence-locator.v3"
          ? DISCOVERED_EVIDENCE_LOCATOR_KEYS
          : EVIDENCE_LOCATOR_KEYS).join("\n") ||
      (locator.schemaVersion !== "pmh.discovery-evidence-locator.v1" &&
        locator.schemaVersion !== "pmh.discovery-evidence-locator.v2" &&
        locator.schemaVersion !== "pmh.discovery-evidence-locator.v3") ||
      !isEvidenceLocatorRole(locator.role) ||
      typeof locator.url !== "string" ||
      locator.authority !== "EVIDENCE_LOCATOR_ONLY" ||
      locator.fetchAuthority !== false ||
      typeof locator.locatorIdentity !== "string" ||
      (locator.schemaVersion === "pmh.discovery-evidence-locator.v3" && (
        locator.provenance === null || typeof locator.provenance !== "object" ||
        Object.keys(locator.provenance as object).sort().join("\n") !==
          DISCOVERED_PROVENANCE_KEYS.join("\n") ||
        (locator.provenance as Record<string, unknown>).kind !==
          "FIRST_PARTY_OFFICIAL_SOURCE_ADMISSION" ||
        !HASH_PATTERN.test(String((locator.provenance as Record<string, unknown>).admissionId)) ||
        !HASH_PATTERN.test(String((locator.provenance as Record<string, unknown>).taskId)) ||
        !HASH_PATTERN.test(String((locator.provenance as Record<string, unknown>).candidateId))
      ))
    ) return false;
    const url = normalizedHttpsLocator(locator.url);
    const sortKey = `${locator.role}\n${locator.url}`;
    const body = {
      schemaVersion: locator.schemaVersion,
      role: locator.role,
      url: locator.url,
      authority: locator.authority,
      fetchAuthority: locator.fetchAuthority,
      ...(locator.schemaVersion === "pmh.discovery-evidence-locator.v3"
        ? { provenance: locator.provenance }
        : {}),
    };
    if (
      url === null ||
      url !== locator.url ||
      sortKey <= previous ||
      identities.has(locator.locatorIdentity) ||
      (locator.schemaVersion !== "pmh.discovery-evidence-locator.v3" &&
        (locator.role === "VENUE_RULE_DOCUMENT") !==
          (locator.schemaVersion === "pmh.discovery-evidence-locator.v2")) ||
      locator.locatorIdentity !== hashCanonical({
        ...body,
        venueId: listing.venueId,
        protocolIdentity: listing.protocolIdentity,
      })
    ) return false;
    previous = sortKey;
    identities.add(locator.locatorIdentity);
  }
  return true;
}
