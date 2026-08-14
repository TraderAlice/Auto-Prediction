import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import type { WorldPredicateArtifact } from "./world-history-ontology.js";
import type { WorldRelationFrontierSeed } from
  "./world-history-ontology-adapter.js";
import type { WorldRelationProjectionCoverageObservation } from
  "./world-relation-projection-coverage.js";
import type { OperationalStorageProjection } from "./types.js";

const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_SUFFIX = /\s+[—-]\s+([^—-]+)\s*$/u;
const IOWA_SOS_HOST = "sos.iowa.gov";
export const IOWA_2026_GENERAL_ELECTION_CANDIDATE_LIST_URL =
  "https://sos.iowa.gov/sites/default/files/2026-07/2026%20General%20-%20Candidate%20List%20Database%20-%20All%20Elections.pdf";
const IOWA_GENERAL_ELECTION_HEADING = /Candidate List\s+November 3, 2026 General Election/iu;
const ROLE_PDF_EXTRACTOR = hashCanonical({
  schemaVersion: "pmh.entity-role-pdf-extractor.v1",
  extractor: "pdfjs-dist@6.2.108",
  maximumPages: 25,
  maximumCharacters: 1_000_000,
});

export type WorldRelationEntityRoleRequirement = Readonly<{
  schemaVersion: "pmh.world-relation-entity-role-requirement.v1";
  requirementId: Hash;
  frontierArtifactHash: Hash;
  corpusSnapshotIdentity: Hash;
  listingRef: string;
  entityLabel: string;
  organizationLabel: string;
  roleKind: "GENERAL_ELECTION_CANDIDATE_OF_ORGANIZATION";
  eventDescription: string;
  satisfyingEvidence: string;
  contradictingEvidence: string;
  status: "EVIDENCE_REQUIRED";
  authority: "ENTITY_ROLE_EVIDENCE_ROUTING_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldRelationEntityRoleAssertion = Readonly<{
  schemaVersion: "pmh.world-relation-entity-role-assertion.v1";
  assertionId: Hash;
  requirementId: Hash;
  entityLabel: string;
  organizationLabel: string;
  sourceOrganizationLabel: string;
  roleKind: WorldRelationEntityRoleRequirement["roleKind"];
  eventDescription: string;
  source: Readonly<{
    url: string;
    publisher: string;
    documentId: Hash;
    rawHash: Hash;
    textHash: Hash;
    receivedAt: string;
  }>;
  evidenceExcerpt: string;
  evidenceExcerptHash: Hash;
  disposition: "SUPPORTED" | "CONTRADICTED" | "INCONCLUSIVE";
  assertedAt: string;
  authority: "INDEPENDENT_ENTITY_ROLE_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type WorldRelationEntityRoleSourceDocument = Readonly<{
  schemaVersion: "pmh.world-relation-entity-role-source-document.v1";
  documentId: Hash;
  url: string;
  publisher: string;
  contentType: "application/pdf" | "text/html" | "text/plain";
  rawHash: Hash;
  textHash: Hash;
  byteLength: string;
  characterLength: number;
  receivedAt: string;
  extractorIdentity: Hash;
  sourcePosture: "OFFICIAL_ELECTION_AUTHORITY_DOCUMENT";
  authority: "UNTRUSTED_ENTITY_ROLE_EVIDENCE_ONLY";
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

export type StoredWorldRelationEntityRoleSourceDocument = Readonly<{
  record: WorldRelationEntityRoleSourceDocument;
  bytes: Uint8Array;
  text: string;
}>;

export interface WorldRelationEntityRoleEvidenceStore {
  readonly worldRelationEntityRoleRequirementStorage:
    OperationalStorageProjection<"requirementId">;
  readonly worldRelationEntityRoleAssertionStorage:
    OperationalStorageProjection<"assertionId">;
  readonly worldRelationEntityRoleSourceDocumentStorage:
    OperationalStorageProjection<"documentId">;
  loadWorldRelationEntityRoleRequirements(
    limit: number,
  ): readonly WorldRelationEntityRoleRequirement[];
  saveWorldRelationEntityRoleRequirements(
    requirements: readonly WorldRelationEntityRoleRequirement[],
  ): readonly WorldRelationEntityRoleRequirement[];
  loadWorldRelationEntityRoleAssertions(
    limit: number,
  ): readonly WorldRelationEntityRoleAssertion[];
  saveWorldRelationEntityRoleAssertions(
    assertions: readonly WorldRelationEntityRoleAssertion[],
  ): readonly WorldRelationEntityRoleAssertion[];
  loadWorldRelationEntityRoleSourceDocuments(
    limit: number,
  ): readonly StoredWorldRelationEntityRoleSourceDocument[];
  saveWorldRelationEntityRoleSourceDocuments(
    documents: readonly StoredWorldRelationEntityRoleSourceDocument[],
  ): readonly StoredWorldRelationEntityRoleSourceDocument[];
}

export type WorldRelationEntityRoleSourceCapture = Readonly<{
  document: StoredWorldRelationEntityRoleSourceDocument;
  assertions: readonly WorldRelationEntityRoleAssertion[];
}>;

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 ||
      value.length > maximum) throw new Error(`${label} is invalid`);
  return value.normalize("NFKC");
}

function iso(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString() !== value) throw new Error(`${label} is invalid`);
  return value;
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function organization(frontier: WorldRelationFrontierSeed): string | null {
  const labels = [...new Set(frontier.predicates.flatMap((predicate) =>
    predicate.semantic.subjects.filter((subject) => subject.entityType === "ORGANIZATION")
      .map((subject) => subject.canonicalLabel)))];
  return labels.length === 1 ? labels[0]! : null;
}

function candidateLabel(title: string): string | null {
  const match = title.match(CANDIDATE_SUFFIX)?.[1]?.trim();
  return match === undefined || match.length < 2 || match.length > 200 ? null : match;
}

function normalizeExtractedPdfText(value: string): string {
  return value.replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

async function extractRolePdf(bytes: Uint8Array): Promise<string> {
  if (!new TextDecoder("latin1").decode(bytes.slice(0, 8)).startsWith("%PDF-")) {
    throw new Error("entity-role PDF lacks a PDF signature");
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(), disableAutoFetch: true, disableFontFace: true,
    disableRange: true, disableStream: true, enableXfa: false,
    maxImageSize: 1_000_000, stopAtErrors: true, useSystemFonts: false,
    useWasm: false, useWorkerFetch: false, verbosity: 0,
  });
  const timer = setTimeout(() => { void loadingTask.destroy(); }, 30_000);
  try {
    const document = await loadingTask.promise;
    if (document.numPages > 25) throw new Error("entity-role PDF exceeds 25 pages");
    const pieces: string[] = [];
    let length = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false });
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const addition = `${item.str}${item.hasEOL ? "\n" : " "}`;
        length += addition.length;
        if (length > 1_000_000) {
          throw new Error("entity-role PDF exceeds the extracted-text limit");
        }
        pieces.push(addition);
      }
      page.cleanup();
      pieces.push("\n");
    }
    return normalizeExtractedPdfText(pieces.join(""));
  } finally {
    clearTimeout(timer);
    await loadingTask.destroy();
  }
}

function iowaSenatorEvidenceExcerpt(textValue: string): string {
  const heading = IOWA_GENERAL_ELECTION_HEADING.exec(textValue);
  const blockStart = textValue.indexOf("United States Senator");
  const nextOffice = textValue.indexOf("\nUnited States Representative", blockStart);
  if (heading?.index === undefined || blockStart < heading.index || nextOffice < 0) {
    throw new Error("Iowa candidate list lacks its expected election or Senate scope");
  }
  const excerpt = textValue.slice(heading.index, nextOffice);
  if (excerpt.length > 20_000) {
    throw new Error("Iowa candidate-list evidence scope is unexpectedly large");
  }
  return excerpt;
}

function iowaBallotOrganizationLabel(label: string): string {
  const normalizedLabel = normalized(label);
  if (normalizedLabel === "democratic party") return "democratic";
  if (normalizedLabel === "republican party") return "republican";
  if (normalizedLabel === "libertarian party") return "libertarian";
  return normalizedLabel;
}

export function compileIowaGeneralElectionEntityRoleAssertions(input: Readonly<{
  document: StoredWorldRelationEntityRoleSourceDocument;
  requirements: readonly WorldRelationEntityRoleRequirement[];
}>): readonly WorldRelationEntityRoleAssertion[] {
  const document = assertStoredWorldRelationEntityRoleSourceDocument(input.document);
  const parsed = new URL(document.record.url);
  if (parsed.hostname !== IOWA_SOS_HOST || document.record.publisher !==
      "Iowa Secretary of State" || document.record.contentType !== "application/pdf") {
    throw new Error("document is not an admitted Iowa election-authority PDF");
  }
  const excerpt = iowaSenatorEvidenceExcerpt(document.text);
  const normalizedExcerpt = normalized(excerpt);
  const source = Object.freeze({ url: document.record.url,
    publisher: document.record.publisher, documentId: document.record.documentId,
    rawHash: document.record.rawHash, textHash: document.record.textHash,
    receivedAt: document.record.receivedAt });
  return Object.freeze(input.requirements.map(assertWorldRelationEntityRoleRequirement)
    .filter((requirement) => /2026[^.]*U\.S\. Senate election in Iowa/iu
      .test(requirement.eventDescription))
    .map((requirement) => {
      const entity = normalized(requirement.entityLabel);
      const organization = iowaBallotOrganizationLabel(requirement.organizationLabel);
      const disposition = normalizedExcerpt.includes(entity) &&
        normalizedExcerpt.includes(`${organization} ${entity}`)
        ? "SUPPORTED" as const
        : normalizedExcerpt.includes(entity)
          ? "CONTRADICTED" as const
          : "INCONCLUSIVE" as const;
      return buildWorldRelationEntityRoleAssertion({ requirement, document, source,
        evidenceExcerpt: excerpt, disposition, sourceOrganizationLabel: organization,
        assertedAt: document.record.receivedAt });
    }).sort((left, right) => left.assertionId.localeCompare(right.assertionId)));
}

export async function captureIowaGeneralElectionEntityRoleSource(input: Readonly<{
  url: string;
  receivedAt: string;
  requirements: readonly WorldRelationEntityRoleRequirement[];
  fetcher?: typeof fetch;
}>): Promise<WorldRelationEntityRoleSourceCapture> {
  const url = new URL(input.url);
  if (url.protocol !== "https:" || url.hostname !== IOWA_SOS_HOST ||
      url.username !== "" || url.password !== "" || url.hash !== "" ||
      !url.pathname.startsWith("/sites/default/files/") ||
      !url.pathname.toLowerCase().endsWith(".pdf")) {
    throw new Error("Iowa election source URL is outside the admitted boundary");
  }
  const response = await (input.fetcher ?? fetch)(url, {
    credentials: "omit", redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { accept: "application/pdf" },
  });
  if (!response.ok) throw new Error(`Iowa election source returned ${response.status}`);
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > 10_000_000) {
    throw new Error("Iowa election source exceeds 10 MB");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > 10_000_000) {
    throw new Error("Iowa election source has an invalid byte length");
  }
  const textValue = await extractRolePdf(bytes);
  const document = buildWorldRelationEntityRoleSourceDocument({ url: url.href,
    publisher: "Iowa Secretary of State", contentType: "application/pdf", bytes,
    text: textValue, receivedAt: input.receivedAt,
    extractorIdentity: ROLE_PDF_EXTRACTOR });
  return Object.freeze({ document,
    assertions: compileIowaGeneralElectionEntityRoleAssertions({ document,
      requirements: input.requirements }) });
}

export function buildWorldRelationEntityRoleRequirements(input: Readonly<{
  frontier: WorldRelationFrontierSeed;
  corpus: MarketCorpusSnapshot;
  coverageObservations: readonly WorldRelationProjectionCoverageObservation[];
}>): readonly WorldRelationEntityRoleRequirement[] {
  const organizationLabel = organization(input.frontier);
  if (organizationLabel === null) return Object.freeze([]);
  const listingByRef = new Map(input.corpus.listings.map((item) =>
    [item.listingRef, item] as const));
  return Object.freeze(input.coverageObservations.flatMap((observation) => {
    if (observation.frontierArtifactHash !== input.frontier.artifactHash ||
        observation.corpusSnapshotIdentity !== input.corpus.snapshotIdentity ||
        observation.disposition !== "ENTITY_ROLE_EVIDENCE_REQUIRED") return [];
    const listing = listingByRef.get(observation.listingRef);
    const entityLabel = listing === undefined ? null : candidateLabel(listing.title);
    if (listing === undefined || entityLabel === null) return [];
    const body = Object.freeze({
      schemaVersion: "pmh.world-relation-entity-role-requirement.v1" as const,
      frontierArtifactHash: input.frontier.artifactHash,
      corpusSnapshotIdentity: input.corpus.snapshotIdentity,
      listingRef: listing.listingRef,
      entityLabel,
      organizationLabel,
      roleKind: "GENERAL_ELECTION_CANDIDATE_OF_ORGANIZATION" as const,
      eventDescription: listing.description,
      satisfyingEvidence: `An independent election authority names ${entityLabel} as the ${organizationLabel} candidate for ${listing.description}`,
      contradictingEvidence: `An independent election authority assigns ${entityLabel} to another organization or excludes the person from ${listing.description}`,
      status: "EVIDENCE_REQUIRED" as const,
      authority: "ENTITY_ROLE_EVIDENCE_ROUTING_ONLY" as const,
      semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
      certificateAuthority: false as const, executionAuthority: false as const,
      externalWriteAuthority: false as const, valueMovingAuthority: false as const,
    });
    return [Object.freeze({ ...body, requirementId: hashCanonical(body) })];
  }).sort((left, right) => left.requirementId.localeCompare(right.requirementId)));
}

export function buildWorldRelationEntityRoleAssertion(input: Readonly<{
  requirement: WorldRelationEntityRoleRequirement;
  document?: StoredWorldRelationEntityRoleSourceDocument;
  source: WorldRelationEntityRoleAssertion["source"];
  evidenceExcerpt: string;
  disposition: WorldRelationEntityRoleAssertion["disposition"];
  assertedAt: string;
  sourceOrganizationLabel?: string;
}>): WorldRelationEntityRoleAssertion {
  const requirement = assertWorldRelationEntityRoleRequirement(input.requirement);
  const document = input.document === undefined ? null
    : assertStoredWorldRelationEntityRoleSourceDocument(input.document);
  const source = Object.freeze({ url: text(input.source.url, "role source URL", 2_048),
    publisher: text(input.source.publisher, "role source publisher", 300),
    documentId: input.source.documentId, rawHash: input.source.rawHash,
    textHash: input.source.textHash,
    receivedAt: iso(input.source.receivedAt, "role source receivedAt") });
  if (![source.documentId, source.rawHash, source.textHash].every((item) => HASH.test(item)) ||
      (document !== null && (source.documentId !== document.record.documentId ||
        source.rawHash !== document.record.rawHash ||
        source.textHash !== document.record.textHash ||
        source.url !== document.record.url || source.publisher !== document.record.publisher ||
        !document.text.includes(input.evidenceExcerpt))) ||
      !["SUPPORTED", "CONTRADICTED", "INCONCLUSIVE"].includes(input.disposition)) {
    throw new Error("entity-role assertion source is not exactly bound");
  }
  const excerpt = text(input.evidenceExcerpt, "role evidence excerpt", 20_000);
  const sourceOrganizationLabel = text(input.sourceOrganizationLabel ??
    requirement.organizationLabel, "role source organization", 200);
  const requiredTerms = [requirement.entityLabel, sourceOrganizationLabel]
    .map(normalized);
  if (input.disposition === "SUPPORTED" && requiredTerms.some((term) =>
    !normalized(excerpt).includes(term))) {
    throw new Error("supported entity-role assertion lacks exact entity or organization text");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-entity-role-assertion.v1" as const,
    requirementId: requirement.requirementId,
    entityLabel: requirement.entityLabel,
    organizationLabel: requirement.organizationLabel,
    sourceOrganizationLabel,
    roleKind: requirement.roleKind,
    eventDescription: requirement.eventDescription,
    source, evidenceExcerpt: excerpt,
    evidenceExcerptHash: hashBytes(new TextEncoder().encode(excerpt)),
    disposition: input.disposition,
    assertedAt: iso(input.assertedAt, "role assertedAt"),
    authority: "INDEPENDENT_ENTITY_ROLE_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    certificateAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const,
  });
  return Object.freeze({ ...body, assertionId: hashCanonical(body) });
}

export function buildWorldRelationEntityRoleSourceDocument(input: Readonly<{
  url: string;
  publisher: string;
  contentType: WorldRelationEntityRoleSourceDocument["contentType"];
  bytes: Uint8Array;
  text: string;
  receivedAt: string;
  extractorIdentity: Hash;
}>): StoredWorldRelationEntityRoleSourceDocument {
  const url = text(input.url, "role document URL", 2_048);
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" ||
      parsed.hash !== "" || !["application/pdf", "text/html", "text/plain"]
        .includes(input.contentType) || !HASH.test(input.extractorIdentity) ||
      !(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1 ||
      input.bytes.byteLength > 10_000_000 || input.text.length < 1 ||
      input.text.length > 1_000_000) {
    throw new Error("entity-role source document is outside its bounded policy");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.world-relation-entity-role-source-document.v1" as const,
    url, publisher: text(input.publisher, "role document publisher", 300),
    contentType: input.contentType, rawHash: hashBytes(input.bytes),
    textHash: hashBytes(new TextEncoder().encode(input.text)),
    byteLength: input.bytes.byteLength.toString(), characterLength: input.text.length,
    receivedAt: iso(input.receivedAt, "role document receivedAt"),
    extractorIdentity: input.extractorIdentity,
    sourcePosture: "OFFICIAL_ELECTION_AUTHORITY_DOCUMENT" as const,
    authority: "UNTRUSTED_ENTITY_ROLE_EVIDENCE_ONLY" as const,
    semanticDecisionAuthority: false as const, probabilityAuthority: false as const,
    certificateAuthority: false as const, executionAuthority: false as const,
    externalWriteAuthority: false as const, valueMovingAuthority: false as const,
  });
  return Object.freeze({ record: Object.freeze({ ...body,
    documentId: hashCanonical(body) }), bytes: new Uint8Array(input.bytes), text: input.text });
}

export function assertStoredWorldRelationEntityRoleSourceDocument(
  value: unknown,
): StoredWorldRelationEntityRoleSourceDocument {
  const item = value as StoredWorldRelationEntityRoleSourceDocument;
  if (item === null || typeof item !== "object" || Array.isArray(item) ||
      !(item.bytes instanceof Uint8Array) || typeof item.text !== "string" ||
      item.record === null || typeof item.record !== "object") {
    throw new Error("stored entity-role source document is malformed");
  }
  const { documentId, ...body } = item.record;
  if (item.record.schemaVersion !== "pmh.world-relation-entity-role-source-document.v1" ||
      !HASH.test(String(documentId)) || documentId !== hashCanonical(body) ||
      item.record.rawHash !== hashBytes(item.bytes) ||
      item.record.textHash !== hashBytes(new TextEncoder().encode(item.text)) ||
      BigInt(item.record.byteLength) !== BigInt(item.bytes.byteLength) ||
      item.record.characterLength !== item.text.length ||
      item.record.sourcePosture !== "OFFICIAL_ELECTION_AUTHORITY_DOCUMENT" ||
      item.record.authority !== "UNTRUSTED_ENTITY_ROLE_EVIDENCE_ONLY" ||
      item.record.semanticDecisionAuthority !== false ||
      item.record.probabilityAuthority !== false || item.record.certificateAuthority !== false ||
      item.record.executionAuthority !== false || item.record.externalWriteAuthority !== false ||
      item.record.valueMovingAuthority !== false) {
    throw new Error("stored entity-role source document violates its evidence contract");
  }
  return Object.freeze({ record: Object.freeze(item.record),
    bytes: new Uint8Array(item.bytes), text: item.text });
}

export function assertWorldRelationEntityRoleRequirement(
  value: unknown,
): WorldRelationEntityRoleRequirement {
  const item = value as WorldRelationEntityRoleRequirement;
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("entity-role requirement is malformed");
  }
  const { requirementId, ...body } = item;
  if (item.schemaVersion !== "pmh.world-relation-entity-role-requirement.v1" ||
      ![requirementId, item.frontierArtifactHash, item.corpusSnapshotIdentity]
        .every((hash) => HASH.test(String(hash))) || requirementId !== hashCanonical(body) ||
      text(item.listingRef, "role listing ref", 500) === "" ||
      text(item.entityLabel, "role entity", 200) === "" ||
      text(item.organizationLabel, "role organization", 200) === "" ||
      item.roleKind !== "GENERAL_ELECTION_CANDIDATE_OF_ORGANIZATION" ||
      item.status !== "EVIDENCE_REQUIRED" ||
      item.authority !== "ENTITY_ROLE_EVIDENCE_ROUTING_ONLY" ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("entity-role requirement violates its bounded contract");
  }
  return Object.freeze(item);
}

export function assertWorldRelationEntityRoleAssertion(
  value: unknown,
): WorldRelationEntityRoleAssertion {
  const item = value as WorldRelationEntityRoleAssertion;
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("entity-role assertion is malformed");
  }
  const { assertionId, ...body } = item;
  const excerpt = text(item.evidenceExcerpt, "role evidence excerpt", 20_000);
  const supportedTerms = [item.entityLabel, item.sourceOrganizationLabel].map(normalized);
  if (item.schemaVersion !== "pmh.world-relation-entity-role-assertion.v1" ||
      ![assertionId, item.requirementId, item.source?.documentId,
        item.source?.rawHash, item.source?.textHash, item.evidenceExcerptHash]
        .every((hash) => HASH.test(String(hash))) || assertionId !== hashCanonical(body) ||
      item.evidenceExcerptHash !== hashBytes(new TextEncoder().encode(excerpt)) ||
      item.roleKind !== "GENERAL_ELECTION_CANDIDATE_OF_ORGANIZATION" ||
      !["SUPPORTED", "CONTRADICTED", "INCONCLUSIVE"].includes(item.disposition) ||
      (item.disposition === "SUPPORTED" && supportedTerms.some((term) =>
        !normalized(excerpt).includes(term))) ||
      text(item.entityLabel, "role entity", 200) === "" ||
      text(item.organizationLabel, "role organization", 200) === "" ||
      text(item.sourceOrganizationLabel, "role source organization", 200) === "" ||
      text(item.eventDescription, "role event", 1_000) === "" ||
      text(item.source.url, "role source URL", 2_048) === "" ||
      text(item.source.publisher, "role source publisher", 300) === "" ||
      iso(item.source.receivedAt, "role source receivedAt") === "" ||
      iso(item.assertedAt, "role assertedAt") === "" ||
      item.authority !== "INDEPENDENT_ENTITY_ROLE_EVIDENCE_ONLY" ||
      item.semanticDecisionAuthority !== false || item.probabilityAuthority !== false ||
      item.certificateAuthority !== false || item.executionAuthority !== false ||
      item.externalWriteAuthority !== false || item.valueMovingAuthority !== false) {
    throw new Error("entity-role assertion violates its bounded contract");
  }
  return Object.freeze(item);
}

export function supportedRoleAssertionForPredicate(input: Readonly<{
  requirement: WorldRelationEntityRoleRequirement;
  assertions: readonly WorldRelationEntityRoleAssertion[];
  predicate: WorldPredicateArtifact;
}>): WorldRelationEntityRoleAssertion | null {
  const subject = input.predicate.semantic.subjects.find((item) =>
    item.entityType === "ORGANIZATION");
  if (subject === undefined || normalized(subject.canonicalLabel) !==
      normalized(input.requirement.organizationLabel)) return null;
  return [...input.assertions].map(assertWorldRelationEntityRoleAssertion)
    .filter((item) => item.requirementId === input.requirement.requirementId &&
      item.disposition === "SUPPORTED")
    .sort((left, right) => right.assertedAt.localeCompare(left.assertedAt) ||
      right.assertionId.localeCompare(left.assertionId))[0] ?? null;
}
