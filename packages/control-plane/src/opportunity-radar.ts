import { hashCanonical } from "@pmh/domain";
import type { DiscoveryCatalogListing } from "./types.js";

const ALGORITHM_VERSION = "pmh.opportunity-radar.lexical-v1";
const TRIAGE_TASK_VERSION = "pmh.radar-triage.v2";
const MAX_CANDIDATES = 25;
const SCORE_THRESHOLD_BPS = 3_000;
const TOKEN_WEIGHT_SCALE = 1_000_000;

const IGNORED_TOKENS = new Set([
  "a",
  "an",
  "and",
  "at",
  "aug",
  "august",
  "close",
  "daily",
  "day",
  "days",
  "for",
  "hour",
  "hourly",
  "hours",
  "in",
  "jan",
  "january",
  "jul",
  "july",
  "market",
  "min",
  "mins",
  "minute",
  "minutes",
  "month",
  "monthly",
  "months",
  "of",
  "on",
  "or",
  "the",
  "to",
  "utc",
  "week",
  "weekly",
  "weeks",
  "will",
  "yes",
  "no",
]);

const MONTHS = new Map([
  ["jan", 0],
  ["feb", 1],
  ["mar", 2],
  ["apr", 3],
  ["may", 4],
  ["jun", 5],
  ["jul", 6],
  ["aug", 7],
  ["sep", 8],
  ["oct", 9],
  ["nov", 10],
  ["dec", 11],
]);

export type OpportunityRadarCandidate = Readonly<{
  candidateId: string;
  triageTaskId: string;
  semanticScoreBps: number;
  sharedTerms: readonly string[];
  timeframe: string | null;
  effectiveCloseAt: string | null;
  temporalAlignment: "ALIGNED" | "UNRESOLVED";
  listings: readonly [
    Readonly<{
      listingRef: string;
      venueId: string;
      title: string;
      mechanism: string;
      closesAt: string | null;
      sourceReceivedAt: string;
      sourceRawHash: string;
      protocolIdentity: string;
    }>,
    Readonly<{
      listingRef: string;
      venueId: string;
      title: string;
      mechanism: string;
      closesAt: string | null;
      sourceReceivedAt: string;
      sourceRawHash: string;
      protocolIdentity: string;
    }>,
  ];
  status: "READY_FOR_SCOUT";
  authority: "PROPOSE_ONLY";
  reviewStatus: "UNREVIEWED";
  arbitrageVerified: false;
  executionAuthority: false;
}>;

export type OpportunityRadarProjection = Readonly<{
  algorithmVersion: typeof ALGORITHM_VERSION;
  sourceSetIdentity: string;
  observedListingCount: number;
  eligibleSourceCount: number;
  excludedSourceCount: number;
  candidateCount: number;
  candidates: readonly OpportunityRadarCandidate[];
  scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE";
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

type RadarInput = Readonly<{
  sourceSetIdentity: string;
  observedListingCount: number;
  eligibleSourceCount: number;
  excludedSourceCount: number;
  listings: readonly DiscoveryCatalogListing[];
}>;

function titleTokens(title: string): readonly string[] {
  return Object.freeze([
    ...new Set(
      title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/gu, "")
        .split(/[^a-z0-9]+/u)
        .filter(
          (token) =>
            token.length >= 2 &&
            !IGNORED_TOKENS.has(token) &&
            !/^\d+$/u.test(token),
        ),
    ),
  ]);
}

function timeframeOf(title: string): string | null {
  const minutes = title.match(/\b(\d{1,3})\s*(?:min|minute)s?\b/iu);
  if (minutes !== null) return `MINUTES:${Number(minutes[1])}`;
  if (/\bhourly\b/iu.test(title)) return "HOURLY";
  if (/\bdaily\b/iu.test(title)) return "DAILY";
  if (/\bweekly\b/iu.test(title)) return "WEEKLY";
  if (/\bmonthly\b/iu.test(title)) return "MONTHLY";
  return null;
}

function titleUtcClose(title: string): string | null {
  const match = title.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+UTC\s+Close\b/iu,
  );
  if (match === null) return null;
  const month = MONTHS.get(match[1]?.slice(0, 3).toLowerCase() ?? "");
  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (
    month === undefined ||
    day < 1 ||
    day > 31 ||
    year < 2000 ||
    year > 2200 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const timestamp = new Date(Date.UTC(year, month, day, hour, minute));
  if (
    timestamp.getUTCFullYear() !== year ||
    timestamp.getUTCMonth() !== month ||
    timestamp.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp.toISOString();
}

function effectiveCloseAt(listing: DiscoveryCatalogListing): string | null {
  return listing.closesAt ?? titleUtcClose(listing.title);
}

function compactListing(listing: DiscoveryCatalogListing) {
  return Object.freeze({
    listingRef: listing.listingRef,
    venueId: listing.venueId,
    title: listing.title,
    mechanism: listing.mechanism,
    closesAt: effectiveCloseAt(listing),
    sourceReceivedAt: listing.sourceReceivedAt,
    sourceRawHash: listing.sourceRawHash,
    protocolIdentity: listing.protocolIdentity,
  });
}

export function radarTriageTaskId(candidateId: string): string {
  if (!/^radar-candidate:[0-9a-f]{64}$/u.test(candidateId)) {
    throw new Error("radar candidate ID is invalid");
  }
  return `task:${hashCanonical({
    kind: "RADAR_TRIAGE",
    version: TRIAGE_TASK_VERSION,
    candidateId,
  }).slice(7)}`;
}

export function buildOpportunityRadar(
  input: RadarInput,
): OpportunityRadarProjection {
  const listingRefs = new Set(input.listings.map((listing) => listing.listingRef));
  if (
    !/^sha256:[0-9a-f]{64}$/u.test(input.sourceSetIdentity) ||
    listingRefs.size !== input.listings.length ||
    input.observedListingCount < input.listings.length ||
    input.eligibleSourceCount < 0 ||
    input.excludedSourceCount < 0
  ) {
    throw new Error("opportunity radar input is invalid");
  }

  const tokenized = input.listings.map((listing) => ({
    listing,
    tokens: titleTokens(listing.title),
  }));
  const documentFrequency = new Map<string, number>();
  for (const item of tokenized) {
    for (const token of item.tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const rareFrequencyLimit = Math.max(
    12,
    Math.floor(Math.max(1, input.listings.length) / 20),
  );
  const weightOf = (token: string): number =>
    Math.floor(TOKEN_WEIGHT_SCALE / (documentFrequency.get(token) ?? 1));
  const candidates: OpportunityRadarCandidate[] = [];

  for (let leftIndex = 0; leftIndex < tokenized.length; leftIndex += 1) {
    const left = tokenized[leftIndex];
    if (left === undefined) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < tokenized.length;
      rightIndex += 1
    ) {
      const right = tokenized[rightIndex];
      if (right === undefined || left.listing.venueId === right.listing.venueId) {
        continue;
      }
      const leftTokens = new Set(left.tokens);
      const rightTokens = new Set(right.tokens);
      const sharedTerms = [...leftTokens]
        .filter((token) => rightTokens.has(token))
        .sort();
      if (
        !sharedTerms.some(
          (token) =>
            (documentFrequency.get(token) ?? Number.MAX_SAFE_INTEGER) <=
            rareFrequencyLimit,
        )
      ) {
        continue;
      }
      const union = [...new Set([...leftTokens, ...rightTokens])];
      const denominator = union.reduce(
        (total, token) => total + weightOf(token),
        0,
      );
      if (denominator === 0) continue;
      const numerator = sharedTerms.reduce(
        (total, token) => total + weightOf(token),
        0,
      );
      const semanticScoreBps = Math.floor((numerator * 10_000) / denominator);
      if (semanticScoreBps < SCORE_THRESHOLD_BPS) continue;

      const leftTimeframe = timeframeOf(left.listing.title);
      const rightTimeframe = timeframeOf(right.listing.title);
      if (
        leftTimeframe !== null &&
        rightTimeframe !== null &&
        leftTimeframe !== rightTimeframe
      ) {
        continue;
      }
      const leftClose = effectiveCloseAt(left.listing);
      const rightClose = effectiveCloseAt(right.listing);
      if (
        leftTimeframe !== null &&
        rightTimeframe !== null &&
        leftClose !== null &&
        rightClose !== null &&
        leftClose !== rightClose
      ) {
        continue;
      }

      const listings = [left.listing, right.listing]
        .sort((a, b) => a.listingRef.localeCompare(b.listingRef))
        .map(compactListing) as unknown as OpportunityRadarCandidate["listings"];
      const timeframe = leftTimeframe ?? rightTimeframe;
      const effectiveClose = leftClose ?? rightClose;
      const temporalAlignment =
        leftTimeframe !== null &&
        leftTimeframe === rightTimeframe &&
        leftClose !== null &&
        leftClose === rightClose
          ? ("ALIGNED" as const)
          : ("UNRESOLVED" as const);
      const candidateBody = {
        schemaVersion: "pmh.opportunity-radar-candidate.v1" as const,
        algorithmVersion: ALGORITHM_VERSION,
        sourceSetIdentity: input.sourceSetIdentity,
        listings: listings.map((listing) => ({
          listingRef: listing.listingRef,
          sourceReceivedAt: listing.sourceReceivedAt,
          sourceRawHash: listing.sourceRawHash,
          protocolIdentity: listing.protocolIdentity,
        })),
      };
      const candidateId =
        `radar-candidate:${hashCanonical(candidateBody).slice(7)}`;
      candidates.push(
        Object.freeze({
          candidateId,
          triageTaskId: radarTriageTaskId(candidateId),
          semanticScoreBps,
          sharedTerms: Object.freeze(sharedTerms),
          timeframe,
          effectiveCloseAt: effectiveClose,
          temporalAlignment,
          listings: Object.freeze(listings),
          status: "READY_FOR_SCOUT" as const,
          authority: "PROPOSE_ONLY" as const,
          reviewStatus: "UNREVIEWED" as const,
          arbitrageVerified: false as const,
          executionAuthority: false as const,
        }),
      );
    }
  }

  const boundedCandidates = Object.freeze(
    candidates
      .sort(
        (left, right) =>
          right.semanticScoreBps - left.semanticScoreBps ||
          left.candidateId.localeCompare(right.candidateId),
      )
      .slice(0, MAX_CANDIDATES),
  );
  return Object.freeze({
    algorithmVersion: ALGORITHM_VERSION,
    sourceSetIdentity: input.sourceSetIdentity,
    observedListingCount: input.observedListingCount,
    eligibleSourceCount: input.eligibleSourceCount,
    excludedSourceCount: input.excludedSourceCount,
    candidateCount: boundedCandidates.length,
    candidates: boundedCandidates,
    scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE" as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
}
