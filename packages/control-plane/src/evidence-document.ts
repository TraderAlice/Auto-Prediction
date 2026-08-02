import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { hashBytes, hashCanonical, type Hash } from "@pmh/domain";
import { geminiManifest } from "@pmh/venue-gemini";
import { assertEvidenceRequirement, type EvidenceRequirement } from "./evidence-requirement.js";
import {
  buildDiscoveryEvidenceLocator,
  hasBoundedDiscoveryEvidenceLocators,
} from "./discovery-evidence-locator.js";
import type { DiscoveryEvidenceLocator } from "./types.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)$/u;
const PDF_EXTRACTOR = "pdfjs-dist@6.2.108";
const TEXT_EXTRACTOR = "pmh.bounded-document-text@1";
const POLICY_KEYS = Object.freeze([
  "allowedContentTypes", "allowedHostnames", "authority", "credentialsUsed",
  "executionAuthority", "extractionTimeoutMs", "maxExtractedCharacters",
  "maxPdfIndirectObjects", "maxPdfPages", "maxRedirects", "maxResponseBytes",
  "policyIdentity", "protocolIdentity", "role", "schemaVersion", "timeoutMs",
  "valueMovingActions", "venueId",
]);
const REDIRECT_KEYS = Object.freeze(["fromUrl", "httpStatus", "toUrl"]);
const DOCUMENT_KEYS = Object.freeze([
  "acquisition", "authority", "byteLength", "contentType", "documentId", "etag",
  "executionAuthority", "finalLocatorIdentity", "finalUrl", "httpStatus",
  "lastModified", "locatorIdentity", "policyIdentity", "protocolIdentity", "rawHash",
  "receivedAt", "redirectTrace", "requestedUrl", "role", "schemaVersion",
  "semanticDecisionAuthority", "venueId",
]);
const OBSERVATION_KEYS = Object.freeze([
  "acquisitionScopeIdentity", "authority", "documentId", "etag", "executionAuthority",
  "finalUrl", "httpStatus", "lastModified", "locatorIdentity", "networkResolution",
  "observationId", "policyIdentity", "receivedAt", "redirectTrace", "requestedAt",
  "requestedUrl", "requirementId", "schemaVersion", "selectedAddress",
  "selectedAddressFamily", "semanticDecisionAuthority",
]);
const EXTRACTION_KEYS = Object.freeze([
  "authority", "characterLength", "documentId", "executionAuthority",
  "extractionId", "extractorIdentity", "indirectObjectDeclarationCount", "pageCount",
  "promptInstructionsAccepted", "rawHash", "schemaVersion",
  "semanticDecisionAuthority", "status", "textHash",
]);
const ACQUISITION_KEYS = Object.freeze([
  "authorizationHeaderUsed", "cookieHeaderUsed", "credentialsUsed", "method",
  "networkResolution", "selectedAddress", "selectedAddressFamily", "valueMovingOperation",
]);
const CAPTURE_KEYS = Object.freeze(["document", "extraction", "observation", "status"]);

export type EvidenceDocumentFetchPolicy = Readonly<{
  schemaVersion: "pmh.evidence-document-fetch-policy.v1";
  policyIdentity: Hash;
  venueId: string;
  protocolIdentity: string;
  role: DiscoveryEvidenceLocator["role"];
  allowedHostnames: readonly string[];
  allowedContentTypes: readonly string[];
  maxResponseBytes: number;
  maxRedirects: number;
  timeoutMs: number;
  extractionTimeoutMs: number;
  maxExtractedCharacters: number;
  maxPdfPages: number;
  maxPdfIndirectObjects: number;
  authority: "ANONYMOUS_EVIDENCE_READ_ONLY";
  credentialsUsed: false;
  valueMovingActions: false;
  executionAuthority: false;
}>;

export type EvidenceRedirectHop = Readonly<{
  fromUrl: string;
  httpStatus: 301 | 302 | 303 | 307 | 308;
  toUrl: string;
}>;

export type EvidenceDocumentRecord = Readonly<{
  schemaVersion: "pmh.rule-document.v1";
  documentId: Hash;
  policyIdentity: Hash;
  locatorIdentity: Hash;
  finalLocatorIdentity: Hash;
  venueId: string;
  protocolIdentity: string;
  role: DiscoveryEvidenceLocator["role"];
  requestedUrl: string;
  finalUrl: string;
  redirectTrace: readonly EvidenceRedirectHop[];
  receivedAt: string;
  httpStatus: 200;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  rawHash: Hash;
  byteLength: string;
  authority: "UNTRUSTED_EVIDENCE_BYTES_ONLY";
  semanticDecisionAuthority: false;
  executionAuthority: false;
  acquisition: Readonly<{
    method: "GET";
    credentialsUsed: false;
    authorizationHeaderUsed: false;
    cookieHeaderUsed: false;
    networkResolution: "PUBLIC_PINNED" | "CLASH_FAKE_IP_PINNED";
    selectedAddress: string;
    selectedAddressFamily: 4 | 6;
    valueMovingOperation: false;
  }>;
}>;

export type StoredEvidenceDocument = Readonly<{
  record: EvidenceDocumentRecord;
  bytes: Uint8Array;
}>;

export type EvidenceDocumentObservation = Readonly<{
  schemaVersion: "pmh.rule-document-observation.v1";
  observationId: Hash;
  requirementId: Hash;
  acquisitionScopeIdentity: Hash;
  policyIdentity: Hash;
  locatorIdentity: Hash;
  requestedUrl: string;
  finalUrl: string;
  redirectTrace: readonly EvidenceRedirectHop[];
  requestedAt: string;
  receivedAt: string;
  httpStatus: 200 | 304;
  networkResolution: "PUBLIC_PINNED" | "CLASH_FAKE_IP_PINNED";
  selectedAddress: string;
  selectedAddressFamily: 4 | 6;
  etag: string | null;
  lastModified: string | null;
  documentId: Hash;
  authority: "EVIDENCE_OBSERVATION_ONLY";
  semanticDecisionAuthority: false;
  executionAuthority: false;
}>;

export type EvidenceDocumentTextRecord = Readonly<{
  schemaVersion: "pmh.rule-document-text.v1";
  extractionId: Hash;
  documentId: Hash;
  rawHash: Hash;
  extractorIdentity: Hash;
  status: "EXTRACTED" | "TRUNCATED";
  textHash: Hash;
  characterLength: number;
  pageCount: number | null;
  indirectObjectDeclarationCount: number | null;
  authority: "UNTRUSTED_EVIDENCE_TEXT_ONLY";
  promptInstructionsAccepted: false;
  semanticDecisionAuthority: false;
  executionAuthority: false;
}>;

export type StoredEvidenceDocumentText = Readonly<{
  record: EvidenceDocumentTextRecord;
  text: string;
}>;

export type EvidenceDocumentCapture = Readonly<{
  status: "CAPTURED" | "NOT_MODIFIED";
  observation: EvidenceDocumentObservation;
  document: StoredEvidenceDocument;
  extraction: StoredEvidenceDocumentText;
}>;

export type EvidenceDocumentFetchLike = (
  input: string,
  init: Readonly<{
    method: "GET";
    credentials: "omit";
    redirect: "manual";
    headers: Readonly<Record<string, string>>;
    resolvedAddresses: readonly Readonly<{ address: string; family: 4 | 6 }>[];
    signal: AbortSignal;
  }>,
) => Promise<Response>;

export type EvidenceDnsResolver = (
  hostname: string,
) => Promise<readonly Readonly<{ address: string; family: 4 | 6 }>[]>;

function nonEmpty(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maximum;
}

function iso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\n") === keys.join("\n");
}

function positiveInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function canonicalHostname(value: string): string | null {
  const hostname = value.trim().toLowerCase().replace(/\.$/u, "");
  if (
    hostname === "" || hostname.length > 253 || isIP(hostname) !== 0 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/u
      .test(hostname)
  ) return null;
  return hostname;
}

function normalizedContentType(value: string | null): string {
  return (value ?? "").split(";", 1)[0]!.trim().toLowerCase();
}

export function buildEvidenceDocumentFetchPolicy(input: Readonly<{
  venueId: string;
  protocolIdentity: string;
  role: DiscoveryEvidenceLocator["role"];
  allowedHostnames: readonly string[];
  allowedContentTypes: readonly string[];
  maxResponseBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  extractionTimeoutMs?: number;
  maxExtractedCharacters?: number;
  maxPdfPages?: number;
  maxPdfIndirectObjects?: number;
}>): EvidenceDocumentFetchPolicy {
  const normalizedHostnames = input.allowedHostnames.map(canonicalHostname);
  if (normalizedHostnames.some((hostname) => hostname === null)) {
    throw new Error("evidence document fetch policy contains an invalid hostname");
  }
  const allowedHostnames = Object.freeze([...new Set(
    normalizedHostnames as string[],
  )].sort());
  const allowedContentTypes = Object.freeze([...new Set(
    input.allowedContentTypes.map((value) => normalizedContentType(value)),
  )].filter((value) => value !== "").sort());
  if (allowedContentTypes.length !== new Set(input.allowedContentTypes).size) {
    throw new Error("evidence document fetch policy contains an invalid content type");
  }
  const body = Object.freeze({
    schemaVersion: "pmh.evidence-document-fetch-policy.v1" as const,
    venueId: input.venueId,
    protocolIdentity: input.protocolIdentity,
    role: input.role,
    allowedHostnames,
    allowedContentTypes,
    maxResponseBytes: input.maxResponseBytes ?? 2_000_000,
    maxRedirects: input.maxRedirects ?? 2,
    timeoutMs: input.timeoutMs ?? 30_000,
    extractionTimeoutMs: input.extractionTimeoutMs ?? 20_000,
    maxExtractedCharacters: input.maxExtractedCharacters ?? 500_000,
    maxPdfPages: input.maxPdfPages ?? 200,
    maxPdfIndirectObjects: input.maxPdfIndirectObjects ?? 20_000,
    authority: "ANONYMOUS_EVIDENCE_READ_ONLY" as const,
    credentialsUsed: false as const,
    valueMovingActions: false as const,
    executionAuthority: false as const,
  });
  return assertEvidenceDocumentFetchPolicy(Object.freeze({
    ...body,
    policyIdentity: hashCanonical(body),
  }));
}

export function assertEvidenceDocumentFetchPolicy(
  value: unknown,
): EvidenceDocumentFetchPolicy {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("evidence document fetch policy is malformed");
  }
  const policy = value as EvidenceDocumentFetchPolicy;
  const { policyIdentity, ...body } = policy;
  if (
    !exactKeys(policy, POLICY_KEYS) ||
    policy.schemaVersion !== "pmh.evidence-document-fetch-policy.v1" ||
    !HASH_PATTERN.test(String(policyIdentity)) || policyIdentity !== hashCanonical(body) ||
    !nonEmpty(policy.venueId, 256) || !nonEmpty(policy.protocolIdentity, 1_000) ||
    !["CONTRACT_RULE_DOCUMENT", "OUTCOME_RESOLUTION_SOURCE"].includes(policy.role) ||
    !Array.isArray(policy.allowedHostnames) || policy.allowedHostnames.length < 1 ||
    policy.allowedHostnames.length > 8 || policy.allowedHostnames.some((hostname, index) =>
      canonicalHostname(hostname) !== hostname ||
      (index > 0 && hostname <= policy.allowedHostnames[index - 1]!)
    ) ||
    !Array.isArray(policy.allowedContentTypes) || policy.allowedContentTypes.length < 1 ||
    policy.allowedContentTypes.length > 8 || policy.allowedContentTypes.some((type, index) =>
      normalizedContentType(type) !== type ||
      (index > 0 && type <= policy.allowedContentTypes[index - 1]!)
    ) ||
    !positiveInteger(policy.maxResponseBytes, 1_024, 20_000_000) ||
    !positiveInteger(policy.maxRedirects, 0, 5) ||
    !positiveInteger(policy.timeoutMs, 1_000, 300_000) ||
    !positiveInteger(policy.extractionTimeoutMs, 1_000, 300_000) ||
    !positiveInteger(policy.maxExtractedCharacters, 1_000, 2_000_000) ||
    !positiveInteger(policy.maxPdfPages, 1, 1_000) ||
    !positiveInteger(policy.maxPdfIndirectObjects, 100, 100_000) ||
    policy.authority !== "ANONYMOUS_EVIDENCE_READ_ONLY" ||
    policy.credentialsUsed !== false || policy.valueMovingActions !== false ||
    policy.executionAuthority !== false
  ) throw new Error("evidence document fetch policy violates its authority contract");
  return Object.freeze(policy);
}

export function defaultEvidenceDocumentFetchPolicies(): readonly EvidenceDocumentFetchPolicy[] {
  return Object.freeze([buildEvidenceDocumentFetchPolicy({
    venueId: geminiManifest.venueId,
    protocolIdentity: geminiManifest.protocolIdentity,
    role: "CONTRACT_RULE_DOCUMENT",
    allowedHostnames: ["assets.gemini.com"],
    allowedContentTypes: ["application/pdf"],
  })]);
}

function ipv4Number(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((octets[0]! * 256 + octets[1]!) * 256 + octets[2]!) * 256 + octets[3]!) >>> 0;
}

function inV4Range(value: number, network: string, bits: number): boolean {
  const base = ipv4Number(network)!;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

function globallyRoutableIp(address: string): boolean {
  if (isIP(address) === 4) {
    const value = ipv4Number(address);
    if (value === null) return false;
    return ![
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
      ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
      ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
      ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([network, bits]) => inV4Range(value, network as string, bits as number));
  }
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(normalized)?.[1];
  if (mapped !== undefined) return globallyRoutableIp(mapped);
  if (!/^[23]/u.test(normalized)) return false;
  return !normalized.startsWith("2001:db8:") &&
    !normalized.startsWith("2001:2:") &&
    !/^2001:(?:0?0?1[0-9a-f]):/u.test(normalized);
}

function clashFakeIp(address: string): boolean {
  const value = ipv4Number(address);
  return value !== null && inV4Range(value, "198.18.0.0", 15);
}

async function defaultResolver(hostname: string): Promise<readonly Readonly<{
  address: string;
  family: 4 | 6;
}>[]> {
  const resolved = await lookup(hostname, { all: true, verbatim: true });
  return resolved.flatMap((item) =>
    item.family === 4 || item.family === 6
      ? [{ address: item.address, family: item.family }]
      : []
  );
}

function validateUrl(url: string, policy: EvidenceDocumentFetchPolicy): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("evidence document URL is malformed");
  }
  const hostname = canonicalHostname(parsed.hostname);
  if (
    parsed.protocol !== "https:" || hostname === null || parsed.hostname !== hostname ||
    parsed.username !== "" || parsed.password !== "" || parsed.hash !== "" ||
    (parsed.port !== "" && parsed.port !== "443") ||
    !policy.allowedHostnames.includes(hostname) || parsed.toString().length > 2_048
  ) throw new Error("evidence document URL violates adapter host policy");
  return parsed;
}

function canonicalEvidenceUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    const hostname = canonicalHostname(parsed.hostname);
    if (
      parsed.protocol !== "https:" || hostname === null || parsed.hostname !== hostname ||
      parsed.username !== "" || parsed.password !== "" || parsed.hash !== "" ||
      (parsed.port !== "" && parsed.port !== "443") || parsed.toString() !== value ||
      value.length > 2_048
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function assertPublicResolution(
  url: URL,
  resolver: EvidenceDnsResolver,
  trustClashFakeIp: boolean,
): Promise<Readonly<{
  addresses: readonly Readonly<{ address: string; family: 4 | 6 }>[];
  posture: "PUBLIC_PINNED" | "CLASH_FAKE_IP_PINNED";
}>> {
  const addresses = await resolver(url.hostname);
  const allPublic = addresses.every((item) => globallyRoutableIp(item.address));
  const allClashFake = addresses.every((item) =>
    item.family === 4 && clashFakeIp(item.address)
  );
  if (
    addresses.length < 1 || addresses.length > 16 ||
    addresses.some((item) =>
      (item.family !== 4 && item.family !== 6) ||
      isIP(item.address) !== item.family
    ) || (!allPublic && !(trustClashFakeIp && allClashFake))
  ) throw new Error(
    "evidence document host did not resolve only to public addresses or explicitly trusted proxy addresses",
  );
  return Object.freeze({
    addresses: Object.freeze(addresses.map((item) => Object.freeze({ ...item }))),
    posture: allPublic ? "PUBLIC_PINNED" as const : "CLASH_FAKE_IP_PINNED" as const,
  });
}

function pinnedHttpsFetch(
  input: string,
  init: Parameters<EvidenceDocumentFetchLike>[1],
): Promise<Response> {
  const address = init.resolvedAddresses[0];
  if (address === undefined) {
    return Promise.reject(new Error("evidence document request lacks a pinned address"));
  }
  return new Promise<Response>((resolve, reject) => {
    const url = new URL(input);
    const request = httpsRequest(url, {
      method: init.method,
      headers: init.headers,
      maxHeaderSize: 16_384,
      signal: init.signal,
      servername: url.hostname,
      lookup: (_hostname, options, callback) => {
        const complete = callback as unknown as (...args: unknown[]) => void;
        if (typeof options === "object" && options.all === true) {
          complete(null, [address]);
        } else {
          complete(null, address.address, address.family);
        }
      },
    }, (response) => {
      const headers = new Headers();
      for (let index = 0; index < response.rawHeaders.length; index += 2) {
        headers.append(response.rawHeaders[index]!, response.rawHeaders[index + 1]!);
      }
      const status = response.statusCode ?? 500;
      const bodyless = status === 204 || status === 304;
      if (bodyless) response.resume();
      const body = bodyless
        ? null
        : Readable.toWeb(response) as ReadableStream<Uint8Array>;
      resolve(new Response(body, {
        status,
        ...(response.statusMessage === undefined
          ? {}
          : { statusText: response.statusMessage }),
        headers,
      }));
    });
    request.once("error", reject);
    request.end();
  });
}

function assertRedirectTrace(value: unknown, maximum: number): asserts value is readonly EvidenceRedirectHop[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error("evidence document redirect trace is malformed");
  }
  for (const hop of value) {
    if (
      hop === null || typeof hop !== "object" || !exactKeys(hop, REDIRECT_KEYS) ||
      ![301, 302, 303, 307, 308].includes(hop.httpStatus) ||
      !nonEmpty(hop.fromUrl, 2_048) || !nonEmpty(hop.toUrl, 2_048)
    ) throw new Error("evidence document redirect trace is malformed");
  }
}

function redirectTraceConnects(
  requestedUrl: string,
  finalUrl: string,
  trace: readonly EvidenceRedirectHop[],
): boolean {
  if (canonicalEvidenceUrl(requestedUrl) === null || canonicalEvidenceUrl(finalUrl) === null) {
    return false;
  }
  let current = requestedUrl;
  for (const hop of trace) {
    if (
      canonicalEvidenceUrl(hop.fromUrl) === null ||
      canonicalEvidenceUrl(hop.toUrl) === null || hop.fromUrl !== current
    ) return false;
    current = hop.toUrl;
  }
  return current === finalUrl;
}

async function readBounded(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (
    !UNSIGNED_DECIMAL.test(declared) || BigInt(declared) > BigInt(maximumBytes)
  )) throw new Error(`evidence document exceeds ${maximumBytes} byte limit`);
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      throw new Error(`evidence document exceeds ${maximumBytes} byte limit`);
    }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function textHash(text: string): Hash {
  return hashBytes(new TextEncoder().encode(text));
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function decodeEntities(value: string): string {
  const named: Readonly<Record<string, string>> = Object.freeze({
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"",
  });
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu, (
    original,
    decimal: string | undefined,
    hexadecimal: string | undefined,
    name: string | undefined,
  ) => {
    const code = decimal === undefined
      ? hexadecimal === undefined ? null : Number.parseInt(hexadecimal, 16)
      : Number.parseInt(decimal, 10);
    if (code !== null) {
      try {
        return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
      } catch {
        return original;
      }
    }
    return named[name?.toLowerCase() ?? ""] ?? original;
  });
}

function boundedTextResult(text: string, maximum: number): Readonly<{
  text: string;
  truncated: boolean;
}> {
  const normalized = normalizeText(text);
  return normalized.length <= maximum
    ? Object.freeze({ text: normalized, truncated: false })
    : Object.freeze({ text: normalized.slice(0, maximum), truncated: true });
}

function indirectObjectDeclarations(bytes: Uint8Array): number {
  const lexical = new TextDecoder("latin1").decode(bytes);
  const objects = [...lexical.matchAll(
    /(?:^|[\r\n])\s*\d+\s+\d+\s+obj\b([\s\S]*?)endobj/gu,
  )];
  let declared = objects.length;
  for (const object of objects) {
    const body = object[1] ?? "";
    if (!/\/Type\s*\/ObjStm\b/gu.test(body)) continue;
    const compressedCount = /\/N\s+(\d+)\b/gu.exec(body)?.[1];
    if (compressedCount === undefined || !UNSIGNED_DECIMAL.test(compressedCount)) {
      throw new Error("PDF object stream lacks a bounded object declaration");
    }
    const count = Number(compressedCount);
    if (!Number.isSafeInteger(count)) {
      throw new Error("PDF object stream count is unbounded");
    }
    declared += count;
  }
  return declared;
}

async function extractPdf(
  bytes: Uint8Array,
  policy: EvidenceDocumentFetchPolicy,
): Promise<Readonly<{
  text: string;
  truncated: boolean;
  pageCount: number;
  indirectObjectDeclarationCount: number;
}>> {
  if (new TextDecoder("latin1").decode(bytes.slice(0, 8)).startsWith("%PDF-") === false) {
    throw new Error("PDF evidence does not have a PDF signature");
  }
  const objectCount = indirectObjectDeclarations(bytes);
  if (objectCount > policy.maxPdfIndirectObjects) {
    throw new Error("PDF evidence exceeds the indirect-object limit");
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    disableAutoFetch: true,
    disableFontFace: true,
    disableRange: true,
    disableStream: true,
    enableXfa: false,
    maxImageSize: 1_000_000,
    stopAtErrors: true,
    useSystemFonts: false,
    useWasm: false,
    useWorkerFetch: false,
    verbosity: 0,
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void loadingTask.destroy();
  }, policy.extractionTimeoutMs);
  try {
    const document = await loadingTask.promise;
    if (document.numPages > policy.maxPdfPages) {
      throw new Error("PDF evidence exceeds the page limit");
    }
    const pieces: string[] = [];
    let length = 0;
    let truncated = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (timedOut) throw new Error("PDF evidence extraction timed out");
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false });
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const addition = `${item.str}${item.hasEOL ? "\n" : " "}`;
        if (length + addition.length > policy.maxExtractedCharacters) {
          pieces.push(addition.slice(0, policy.maxExtractedCharacters - length));
          truncated = true;
          break;
        }
        pieces.push(addition);
        length += addition.length;
      }
      page.cleanup();
      if (truncated) break;
      pieces.push("\n");
      length += 1;
    }
    const bounded = boundedTextResult(pieces.join(""), policy.maxExtractedCharacters);
    return Object.freeze({
      text: bounded.text,
      truncated: truncated || bounded.truncated,
      pageCount: document.numPages,
      indirectObjectDeclarationCount: objectCount,
    });
  } catch (error) {
    if (timedOut) throw new Error("PDF evidence extraction timed out");
    throw error;
  } finally {
    clearTimeout(timer);
    await loadingTask.destroy();
  }
}

function extractionRecord(input: Readonly<{
  document: EvidenceDocumentRecord;
  text: string;
  truncated: boolean;
  pageCount: number | null;
  indirectObjectDeclarationCount: number | null;
  extractor: string;
}>): StoredEvidenceDocumentText {
  const extractorIdentity = hashCanonical({
    schemaVersion: "pmh.evidence-text-extractor.v1",
    extractor: input.extractor,
  });
  const body = Object.freeze({
    schemaVersion: "pmh.rule-document-text.v1" as const,
    documentId: input.document.documentId,
    rawHash: input.document.rawHash,
    extractorIdentity,
    status: input.truncated ? "TRUNCATED" as const : "EXTRACTED" as const,
    textHash: textHash(input.text),
    characterLength: input.text.length,
    pageCount: input.pageCount,
    indirectObjectDeclarationCount: input.indirectObjectDeclarationCount,
    authority: "UNTRUSTED_EVIDENCE_TEXT_ONLY" as const,
    promptInstructionsAccepted: false as const,
    semanticDecisionAuthority: false as const,
    executionAuthority: false as const,
  });
  return assertStoredEvidenceDocumentText(Object.freeze({
    record: Object.freeze({ ...body, extractionId: hashCanonical(body) }),
    text: input.text,
  }));
}

export async function extractEvidenceDocumentText(
  documentInput: StoredEvidenceDocument,
  policyInput: EvidenceDocumentFetchPolicy,
): Promise<StoredEvidenceDocumentText> {
  const document = assertStoredEvidenceDocument(documentInput);
  const policy = assertEvidenceDocumentFetchPolicy(policyInput);
  if (document.record.policyIdentity !== policy.policyIdentity) {
    throw new Error("evidence document extraction policy does not match capture");
  }
  if (document.record.contentType === "application/pdf") {
    const extracted = await extractPdf(document.bytes, policy);
    return extractionRecord({
      document: document.record,
      ...extracted,
      extractor: PDF_EXTRACTOR,
    });
  }
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(document.bytes);
  } catch {
    throw new Error("text evidence is not valid UTF-8");
  }
  if (
    document.record.contentType === "text/html" ||
    document.record.contentType === "application/xhtml+xml"
  ) {
    decoded = decodeEntities(decoded
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
      .replace(/<[^>]+>/gu, "\n"));
  }
  const bounded = boundedTextResult(decoded, policy.maxExtractedCharacters);
  return extractionRecord({
    document: document.record,
    text: bounded.text,
    truncated: bounded.truncated,
    pageCount: null,
    indirectObjectDeclarationCount: null,
    extractor: TEXT_EXTRACTOR,
  });
}

export function assertStoredEvidenceDocument(value: unknown): StoredEvidenceDocument {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored evidence document is malformed");
  }
  const stored = value as StoredEvidenceDocument;
  const record = stored.record;
  if (
    !exactKeys(stored, ["bytes", "record"]) || record === null ||
    typeof record !== "object" || !exactKeys(record, DOCUMENT_KEYS) ||
    record.schemaVersion !== "pmh.rule-document.v1" ||
    !HASH_PATTERN.test(String(record.documentId)) ||
    !HASH_PATTERN.test(String(record.policyIdentity)) ||
    !HASH_PATTERN.test(String(record.locatorIdentity)) ||
    !HASH_PATTERN.test(String(record.finalLocatorIdentity)) ||
    !HASH_PATTERN.test(String(record.rawHash)) ||
    !nonEmpty(record.venueId, 256) || !nonEmpty(record.protocolIdentity, 1_000) ||
    !["CONTRACT_RULE_DOCUMENT", "OUTCOME_RESOLUTION_SOURCE"].includes(record.role) ||
    !nonEmpty(record.requestedUrl, 2_048) || !nonEmpty(record.finalUrl, 2_048) ||
    !iso(record.receivedAt) || record.httpStatus !== 200 ||
    !nonEmpty(record.contentType, 256) ||
    (record.etag !== null && !nonEmpty(record.etag, 1_000)) ||
    (record.lastModified !== null && !nonEmpty(record.lastModified, 1_000)) ||
    !UNSIGNED_DECIMAL.test(String(record.byteLength)) ||
    record.authority !== "UNTRUSTED_EVIDENCE_BYTES_ONLY" ||
    record.semanticDecisionAuthority !== false || record.executionAuthority !== false ||
    record.acquisition?.method !== "GET" ||
    !exactKeys(record.acquisition, ACQUISITION_KEYS) ||
    record.acquisition.credentialsUsed !== false ||
    record.acquisition.authorizationHeaderUsed !== false ||
    record.acquisition.cookieHeaderUsed !== false ||
    !["PUBLIC_PINNED", "CLASH_FAKE_IP_PINNED"]
      .includes(record.acquisition.networkResolution) ||
    isIP(record.acquisition.selectedAddress) !==
      record.acquisition.selectedAddressFamily ||
    (record.acquisition.networkResolution === "PUBLIC_PINNED"
      ? !globallyRoutableIp(record.acquisition.selectedAddress)
      : !clashFakeIp(record.acquisition.selectedAddress)) ||
    record.acquisition.valueMovingOperation !== false ||
    !(stored.bytes instanceof Uint8Array)
  ) throw new Error("stored evidence document violates its authority contract");
  assertRedirectTrace(record.redirectTrace, 5);
  const requestedLocator = buildDiscoveryEvidenceLocator({
    venueId: record.venueId,
    protocolIdentity: record.protocolIdentity,
    role: record.role,
    url: record.requestedUrl,
  });
  const finalLocator = buildDiscoveryEvidenceLocator({
    venueId: record.venueId,
    protocolIdentity: record.protocolIdentity,
    role: record.role,
    url: record.finalUrl,
  });
  const { documentId, ...body } = record;
  if (
    !redirectTraceConnects(record.requestedUrl, record.finalUrl, record.redirectTrace) ||
    requestedLocator?.locatorIdentity !== record.locatorIdentity ||
    finalLocator?.locatorIdentity !== record.finalLocatorIdentity ||
    documentId !== hashCanonical(body) || hashBytes(stored.bytes) !== record.rawHash ||
    BigInt(stored.bytes.byteLength) !== BigInt(record.byteLength)
  ) throw new Error("stored evidence document content identity mismatch");
  return Object.freeze({ record: Object.freeze(record), bytes: new Uint8Array(stored.bytes) });
}

export function assertEvidenceDocumentObservation(value: unknown): EvidenceDocumentObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("evidence document observation is malformed");
  }
  const observation = value as EvidenceDocumentObservation;
  const { observationId, ...body } = observation;
  if (
    !exactKeys(observation, OBSERVATION_KEYS) ||
    observation.schemaVersion !== "pmh.rule-document-observation.v1" ||
    !HASH_PATTERN.test(String(observationId)) || observationId !== hashCanonical(body) ||
    !HASH_PATTERN.test(String(observation.requirementId)) ||
    !HASH_PATTERN.test(String(observation.acquisitionScopeIdentity)) ||
    !HASH_PATTERN.test(String(observation.policyIdentity)) ||
    !HASH_PATTERN.test(String(observation.locatorIdentity)) ||
    !HASH_PATTERN.test(String(observation.documentId)) ||
    !nonEmpty(observation.requestedUrl, 2_048) || !nonEmpty(observation.finalUrl, 2_048) ||
    !iso(observation.requestedAt) || !iso(observation.receivedAt) ||
    Date.parse(observation.receivedAt) < Date.parse(observation.requestedAt) ||
    (observation.httpStatus !== 200 && observation.httpStatus !== 304) ||
    !["PUBLIC_PINNED", "CLASH_FAKE_IP_PINNED"].includes(observation.networkResolution) ||
    isIP(observation.selectedAddress) !== observation.selectedAddressFamily ||
    (observation.networkResolution === "PUBLIC_PINNED"
      ? !globallyRoutableIp(observation.selectedAddress)
      : !clashFakeIp(observation.selectedAddress)) ||
    (observation.etag !== null && !nonEmpty(observation.etag, 1_000)) ||
    (observation.lastModified !== null && !nonEmpty(observation.lastModified, 1_000)) ||
    observation.authority !== "EVIDENCE_OBSERVATION_ONLY" ||
    observation.semanticDecisionAuthority !== false ||
    observation.executionAuthority !== false
  ) throw new Error("evidence document observation violates its authority contract");
  assertRedirectTrace(observation.redirectTrace, 5);
  if (!redirectTraceConnects(
    observation.requestedUrl,
    observation.finalUrl,
    observation.redirectTrace,
  )) throw new Error("evidence document observation redirect lineage is inconsistent");
  return Object.freeze(observation);
}

export function assertStoredEvidenceDocumentText(value: unknown): StoredEvidenceDocumentText {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored evidence document text is malformed");
  }
  const stored = value as StoredEvidenceDocumentText;
  const record = stored.record;
  if (
    !exactKeys(stored, ["record", "text"]) || record === null ||
    typeof record !== "object" || !exactKeys(record, EXTRACTION_KEYS) ||
    record.schemaVersion !== "pmh.rule-document-text.v1" ||
    !HASH_PATTERN.test(String(record.extractionId)) ||
    !HASH_PATTERN.test(String(record.documentId)) || !HASH_PATTERN.test(String(record.rawHash)) ||
    !HASH_PATTERN.test(String(record.extractorIdentity)) ||
    (record.status !== "EXTRACTED" && record.status !== "TRUNCATED") ||
    !HASH_PATTERN.test(String(record.textHash)) ||
    !Number.isSafeInteger(record.characterLength) || record.characterLength < 0 ||
    (record.pageCount !== null && !positiveInteger(record.pageCount, 1, 1_000)) ||
    (record.indirectObjectDeclarationCount !== null &&
      !positiveInteger(record.indirectObjectDeclarationCount, 0, 100_000)) ||
    record.authority !== "UNTRUSTED_EVIDENCE_TEXT_ONLY" ||
    record.promptInstructionsAccepted !== false ||
    record.semanticDecisionAuthority !== false || record.executionAuthority !== false ||
    typeof stored.text !== "string"
  ) throw new Error("stored evidence document text violates its authority contract");
  const { extractionId, ...body } = record;
  if (
    extractionId !== hashCanonical(body) || record.textHash !== textHash(stored.text) ||
    record.characterLength !== stored.text.length
  ) throw new Error("stored evidence document text identity mismatch");
  return Object.freeze({ record: Object.freeze(record), text: stored.text });
}

export function assertEvidenceDocumentCapture(value: unknown): EvidenceDocumentCapture {
  if (
    value === null || typeof value !== "object" || Array.isArray(value) ||
    !exactKeys(value, CAPTURE_KEYS)
  ) throw new Error("evidence document capture is malformed");
  const capture = value as EvidenceDocumentCapture;
  const observation = assertEvidenceDocumentObservation(capture.observation);
  const document = assertStoredEvidenceDocument(capture.document);
  const extraction = assertStoredEvidenceDocumentText(capture.extraction);
  if (
    (capture.status !== "CAPTURED" && capture.status !== "NOT_MODIFIED") ||
    (capture.status === "CAPTURED" && observation.httpStatus !== 200) ||
    (capture.status === "NOT_MODIFIED" && observation.httpStatus !== 304) ||
    observation.documentId !== document.record.documentId ||
    observation.locatorIdentity !== document.record.locatorIdentity ||
    observation.policyIdentity !== document.record.policyIdentity ||
    observation.requestedUrl !== document.record.requestedUrl ||
    (capture.status === "CAPTURED" &&
      (observation.networkResolution !== document.record.acquisition.networkResolution ||
        observation.selectedAddress !== document.record.acquisition.selectedAddress ||
        observation.selectedAddressFamily !==
          document.record.acquisition.selectedAddressFamily)) ||
    extraction.record.documentId !== document.record.documentId ||
    extraction.record.rawHash !== document.record.rawHash
  ) throw new Error("evidence document capture lineage is inconsistent");
  return Object.freeze({ status: capture.status, observation, document, extraction });
}

function locatorFromRequirement(
  requirement: EvidenceRequirement,
  locatorIdentity: Hash,
): Readonly<{
  venueId: string;
  protocolIdentity: string;
  locator: DiscoveryEvidenceLocator;
}> {
  const binding = requirement.eligibleLocators.find(
    (candidate) => candidate.locator.locatorIdentity === locatorIdentity,
  );
  if (binding === undefined || requirement.acquisitionRoute !== "DOCUMENT_LOCATOR") {
    throw new Error("evidence requirement does not offer the requested document locator");
  }
  if (!hasBoundedDiscoveryEvidenceLocators({
    venueId: binding.venueId,
    protocolIdentity: binding.protocolIdentity,
    evidenceLocators: [binding.locator],
  })) throw new Error("evidence requirement locator is malformed");
  return binding;
}

export class EvidenceDocumentFetcher {
  readonly #policies: readonly EvidenceDocumentFetchPolicy[];
  readonly #fetch: EvidenceDocumentFetchLike;
  readonly #resolve: EvidenceDnsResolver;
  readonly #now: () => number;
  readonly #trustClashFakeIp: boolean;

  public constructor(options: Readonly<{
    policies?: readonly EvidenceDocumentFetchPolicy[];
    fetch?: EvidenceDocumentFetchLike;
    resolve?: EvidenceDnsResolver;
    now?: () => number;
    trustClashFakeIp?: boolean;
  }> = {}) {
    const policies = options.policies ?? defaultEvidenceDocumentFetchPolicies();
    this.#policies = Object.freeze(policies.map(assertEvidenceDocumentFetchPolicy));
    if (new Set(this.#policies.map((policy) => policy.policyIdentity)).size !==
      this.#policies.length) throw new Error("evidence document fetch policies are duplicated");
    if (new Set(this.#policies.map((policy) =>
      `${policy.venueId}\n${policy.protocolIdentity}\n${policy.role}`
    )).size !== this.#policies.length) {
      throw new Error("evidence document fetch policy routes are ambiguous");
    }
    this.#fetch = options.fetch ?? pinnedHttpsFetch;
    this.#resolve = options.resolve ?? defaultResolver;
    this.#now = options.now ?? Date.now;
    this.#trustClashFakeIp = options.trustClashFakeIp ?? false;
  }

  public policyFor(
    requirementInput: EvidenceRequirement,
    locatorIdentity: Hash,
  ): EvidenceDocumentFetchPolicy | null {
    const requirement = assertEvidenceRequirement(requirementInput);
    const binding = locatorFromRequirement(requirement, locatorIdentity);
    const policy = this.#policies.find((candidate) =>
      candidate.venueId === binding.venueId &&
      candidate.protocolIdentity === binding.protocolIdentity &&
      candidate.role === binding.locator.role
    ) ?? null;
    if (policy !== null) validateUrl(binding.locator.url, policy);
    return policy;
  }

  public async capture(input: Readonly<{
    requirement: EvidenceRequirement;
    locatorIdentity: Hash;
    previous?: EvidenceDocumentCapture;
  }>): Promise<EvidenceDocumentCapture> {
    const requirement = assertEvidenceRequirement(input.requirement);
    const binding = locatorFromRequirement(requirement, input.locatorIdentity);
    const policy = this.policyFor(requirement, input.locatorIdentity);
    if (policy === null) {
      throw new Error("no first-party evidence fetch policy admits this locator");
    }
    const previous = input.previous === undefined
      ? undefined
      : assertEvidenceDocumentCapture(input.previous);
    if (previous !== undefined && (
      previous.document.record.locatorIdentity !== binding.locator.locatorIdentity ||
      previous.document.record.policyIdentity !== policy.policyIdentity ||
      previous.observation.documentId !== previous.document.record.documentId ||
      previous.extraction.record.documentId !== previous.document.record.documentId
    )) throw new Error("previous evidence capture does not match the locator");

    const requestedAt = new Date(this.#now()).toISOString();
    const requestedUrl = validateUrl(binding.locator.url, policy).toString();
    const headers: Record<string, string> = Object.create(null) as Record<string, string>;
    headers.accept = policy.allowedContentTypes.join(", ");
    headers["accept-encoding"] = "identity";
    const priorEtag = previous?.observation.etag ?? previous?.document.record.etag;
    const priorLastModified = previous?.observation.lastModified ??
      previous?.document.record.lastModified;
    if (priorEtag !== null && priorEtag !== undefined) {
      headers["if-none-match"] = priorEtag;
    } else if (
      priorLastModified !== null && priorLastModified !== undefined
    ) {
      headers["if-modified-since"] = priorLastModified;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
    const redirects: EvidenceRedirectHop[] = [];
    let current = new URL(requestedUrl);
    try {
      while (true) {
        const resolution = await assertPublicResolution(
          current,
          this.#resolve,
          this.#trustClashFakeIp,
        );
        const response = await this.#fetch(current.toString(), {
          method: "GET",
          credentials: "omit",
          redirect: "manual",
          headers: Object.freeze({ ...headers }),
          resolvedAddresses: resolution.addresses,
          signal: controller.signal,
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects.length >= policy.maxRedirects) {
            throw new Error("evidence document exceeds the redirect limit");
          }
          const location = response.headers.get("location");
          if (location === null) throw new Error("evidence document redirect lacks location");
          const next = validateUrl(new URL(location, current).toString(), policy);
          await response.body?.cancel();
          redirects.push(Object.freeze({
            fromUrl: current.toString(),
            httpStatus: response.status as EvidenceRedirectHop["httpStatus"],
            toUrl: next.toString(),
          }));
          current = next;
          continue;
        }
        const receivedAt = new Date(Math.max(this.#now(), Date.parse(requestedAt))).toISOString();
        const redirectTrace = Object.freeze([...redirects]);
        if (response.status === 304) {
          if (previous === undefined) {
            throw new Error("evidence document returned 304 without a retained document");
          }
          const observationBody = Object.freeze({
            schemaVersion: "pmh.rule-document-observation.v1" as const,
            requirementId: requirement.requirementId,
            acquisitionScopeIdentity: requirement.acquisitionScopeIdentity,
            policyIdentity: policy.policyIdentity,
            locatorIdentity: binding.locator.locatorIdentity,
            requestedUrl,
            finalUrl: current.toString(),
            redirectTrace,
            requestedAt,
            receivedAt,
            httpStatus: 304 as const,
            networkResolution: resolution.posture,
            selectedAddress: resolution.addresses[0]!.address,
            selectedAddressFamily: resolution.addresses[0]!.family,
            etag: response.headers.get("etag"),
            lastModified: response.headers.get("last-modified"),
            documentId: previous.document.record.documentId,
            authority: "EVIDENCE_OBSERVATION_ONLY" as const,
            semanticDecisionAuthority: false as const,
            executionAuthority: false as const,
          });
          return assertEvidenceDocumentCapture(Object.freeze({
            status: "NOT_MODIFIED" as const,
            observation: assertEvidenceDocumentObservation(Object.freeze({
              ...observationBody,
              observationId: hashCanonical(observationBody),
            })),
            document: previous.document,
            extraction: previous.extraction,
          }));
        }
        if (response.status !== 200) {
          await response.body?.cancel();
          throw new Error(`evidence document returned HTTP ${response.status}`);
        }
        const contentEncoding = (response.headers.get("content-encoding") ?? "identity")
          .trim().toLowerCase();
        if (contentEncoding !== "" && contentEncoding !== "identity") {
          await response.body?.cancel();
          throw new Error("evidence document content encoding violates byte-bound policy");
        }
        const contentType = normalizedContentType(response.headers.get("content-type"));
        if (!policy.allowedContentTypes.includes(contentType)) {
          throw new Error("evidence document content type violates adapter policy");
        }
        const bytes = await readBounded(response, policy.maxResponseBytes);
        const finalLocator = buildDiscoveryEvidenceLocator({
          venueId: binding.venueId,
          protocolIdentity: binding.protocolIdentity,
          role: binding.locator.role,
          url: current.toString(),
        });
        if (finalLocator === null) {
          throw new Error("evidence document final locator is malformed");
        }
        const documentBody = Object.freeze({
          schemaVersion: "pmh.rule-document.v1" as const,
          policyIdentity: policy.policyIdentity,
          locatorIdentity: binding.locator.locatorIdentity,
          finalLocatorIdentity: finalLocator.locatorIdentity,
          venueId: binding.venueId,
          protocolIdentity: binding.protocolIdentity,
          role: binding.locator.role,
          requestedUrl,
          finalUrl: current.toString(),
          redirectTrace,
          receivedAt,
          httpStatus: 200 as const,
          contentType,
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          rawHash: hashBytes(bytes),
          byteLength: bytes.byteLength.toString(),
          authority: "UNTRUSTED_EVIDENCE_BYTES_ONLY" as const,
          semanticDecisionAuthority: false as const,
          executionAuthority: false as const,
          acquisition: Object.freeze({
            method: "GET" as const,
            credentialsUsed: false as const,
            authorizationHeaderUsed: false as const,
            cookieHeaderUsed: false as const,
            networkResolution: resolution.posture,
            selectedAddress: resolution.addresses[0]!.address,
            selectedAddressFamily: resolution.addresses[0]!.family,
            valueMovingOperation: false as const,
          }),
        });
        const document = assertStoredEvidenceDocument(Object.freeze({
          record: Object.freeze({
            ...documentBody,
            documentId: hashCanonical(documentBody),
          }),
          bytes,
        }));
        const extraction = await extractEvidenceDocumentText(document, policy);
        const observationBody = Object.freeze({
          schemaVersion: "pmh.rule-document-observation.v1" as const,
          requirementId: requirement.requirementId,
          acquisitionScopeIdentity: requirement.acquisitionScopeIdentity,
          policyIdentity: policy.policyIdentity,
          locatorIdentity: binding.locator.locatorIdentity,
          requestedUrl,
          finalUrl: current.toString(),
          redirectTrace,
          requestedAt,
          receivedAt,
          httpStatus: 200 as const,
          networkResolution: resolution.posture,
          selectedAddress: resolution.addresses[0]!.address,
          selectedAddressFamily: resolution.addresses[0]!.family,
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          documentId: document.record.documentId,
          authority: "EVIDENCE_OBSERVATION_ONLY" as const,
          semanticDecisionAuthority: false as const,
          executionAuthority: false as const,
        });
        return assertEvidenceDocumentCapture(Object.freeze({
          status: "CAPTURED" as const,
          observation: assertEvidenceDocumentObservation(Object.freeze({
            ...observationBody,
            observationId: hashCanonical(observationBody),
          })),
          document,
          extraction,
        }));
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
