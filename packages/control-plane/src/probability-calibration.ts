import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertProbabilisticSemanticBound,
  type ProbabilisticSemanticBoundArtifact,
  type ProbabilitySearchOrigin,
  type ProbabilityEstimationMethod,
} from "./probabilistic-semantic-arbitrage.js";
import type { SearchSemanticFamily } from "./search-semantic-family.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const PROBABILITY_SCALE = 1_000_000n;
const BUCKET_WIDTH_PPM = 100_000n;

export type ProbabilityResolutionEvidence = Readonly<{
  listingRef: string;
  truthValue: boolean;
  resolvedAt: string;
  sourceRawHash: Hash;
  protocolIdentity: string;
}>;

export type ProbabilityCalibrationObservation = Readonly<{
  schemaVersion:
    | "pmh.probability-calibration-observation.v1"
    | "pmh.probability-calibration-observation.v2";
  artifactHash: Hash;
  boundArtifactHash: Hash;
  bound: ProbabilisticSemanticBoundArtifact;
  proposalId: Hash;
  semanticConstraintArtifactHash: Hash;
  relationKind: ProbabilisticSemanticBoundArtifact["semanticConstraint"]["relationKind"];
  observedStateId: string;
  adverseOccurred: boolean;
  resolvedAt: string;
  horizonBucket: "LE_1D" | "LE_7D" | "LE_30D" | "GT_30D";
  resolutionEvidence: readonly ProbabilityResolutionEvidence[];
  searchOrigin?: ProbabilitySearchOrigin;
  authority: "SHADOW_CALIBRATION_ONLY";
  probabilityCertificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ProbabilityCalibrationGroup = Readonly<{
  groupId: Hash;
  estimator: string;
  method: ProbabilityEstimationMethod;
  semanticFamily?: SearchSemanticFamily | null;
  relationKind: ProbabilityCalibrationObservation["relationKind"];
  horizonBucket: ProbabilityCalibrationObservation["horizonBucket"];
  upperBucketStartPpm: string;
  upperBucketEndPpm: string;
  sampleCount: string;
  adverseCount: string;
  empiricalRatePpm: string;
  meanLowerPpm: string;
  meanUpperPpm: string;
  upperExceedancePpm: string;
  lowerShortfallPpm: string;
  meanMidpointBrierPpm: string;
  status: "INSUFFICIENT_SAMPLE" | "WITHIN_INTERVAL" | "UNDERPREDICTED" | "OVERPREDICTED";
}>;

export type ProbabilityCalibrationArtifact = Readonly<{
  schemaVersion: "pmh.probability-calibration.v1" | "pmh.probability-calibration.v2";
  artifactHash: Hash;
  createdAt: string;
  minimumSampleSize: string;
  observationArtifactHashes: readonly Hash[];
  observations: readonly ProbabilityCalibrationObservation[];
  groups: readonly ProbabilityCalibrationGroup[];
  measuredGroupCount: string;
  insufficientGroupCount: string;
  authority: "CALIBRATION_EVIDENCE_ONLY";
  probabilityCertificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

function canonicalIso(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return value;
}

function boundedText(value: string, label: string, maximum = 240): string {
  const compact = value.trim().replace(/\s+/g, " ");
  if (compact === "" || compact.length > maximum) {
    throw new Error(`${label} must be non-empty and at most ${maximum} characters`);
  }
  return compact;
}

function ppm(value: string, label: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/u.test(value)) throw new Error(`${label} is not an integer`);
  const parsed = BigInt(value);
  if (parsed > PROBABILITY_SCALE) throw new Error(`${label} exceeds one million ppm`);
  return parsed;
}

function horizonBucket(validFrom: string, resolvedAt: string): ProbabilityCalibrationObservation["horizonBucket"] {
  const durationMs = Date.parse(resolvedAt) - Date.parse(validFrom);
  if (durationMs < 0) throw new Error("probability outcome predates its forecast");
  if (durationMs <= 86_400_000) return "LE_1D";
  if (durationMs <= 7 * 86_400_000) return "LE_7D";
  if (durationMs <= 30 * 86_400_000) return "LE_30D";
  return "GT_30D";
}

function observationBody(input: Readonly<{
  bound: ProbabilisticSemanticBoundArtifact;
  resolutionEvidence: readonly ProbabilityResolutionEvidence[];
}>): Omit<ProbabilityCalibrationObservation, "artifactHash"> {
  const bound = assertProbabilisticSemanticBound(input.bound);
  const evidenceByListing = new Map(input.resolutionEvidence.map((item) => [item.listingRef, item]));
  if (evidenceByListing.size !== bound.listingRefs.length ||
    input.resolutionEvidence.length !== bound.listingRefs.length ||
    bound.listingRefs.some((listingRef) => !evidenceByListing.has(listingRef))) {
    throw new Error("probability outcome must resolve every bound listing exactly once");
  }
  const resolutionEvidence = Object.freeze(bound.listingRefs.map((listingRef) => {
    const item = evidenceByListing.get(listingRef)!;
    const resolvedAt = canonicalIso(item.resolvedAt, "probability resolution time");
    if (typeof item.truthValue !== "boolean" || !HASH_PATTERN.test(item.sourceRawHash) ||
      Date.parse(resolvedAt) < Date.parse(bound.validFrom)) {
      throw new Error("probability resolution evidence is invalid or predates its forecast");
    }
    return Object.freeze({
      listingRef,
      truthValue: item.truthValue,
      resolvedAt,
      sourceRawHash: item.sourceRawHash,
      protocolIdentity: boundedText(item.protocolIdentity, "resolution protocol identity"),
    });
  }));
  const resolvedAt = [...resolutionEvidence]
    .sort((left, right) => right.resolvedAt.localeCompare(left.resolvedAt))[0]!.resolvedAt;
  const observedStateId = resolutionEvidence.map((item) => item.truthValue ? "T" : "F").join("");
  if (!bound.semanticConstraint.truthTable.some((state) => state.stateId === observedStateId)) {
    throw new Error("probability outcome state is outside the retained truth matrix");
  }
  const body = Object.freeze({
    schemaVersion: bound.searchOrigin === undefined
      ? "pmh.probability-calibration-observation.v1" as const
      : "pmh.probability-calibration-observation.v2" as const,
    boundArtifactHash: bound.artifactHash,
    bound,
    proposalId: bound.proposalId,
    semanticConstraintArtifactHash: bound.semanticConstraintArtifactHash,
    relationKind: bound.semanticConstraint.relationKind,
    observedStateId,
    adverseOccurred: bound.adverseStateIds.includes(observedStateId),
    resolvedAt,
    horizonBucket: horizonBucket(bound.validFrom, resolvedAt),
    resolutionEvidence,
    ...(bound.searchOrigin === undefined ? {} : { searchOrigin: bound.searchOrigin }),
    authority: "SHADOW_CALIBRATION_ONLY" as const,
    probabilityCertificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return body;
}

export function buildProbabilityCalibrationObservation(input: Readonly<{
  bound: ProbabilisticSemanticBoundArtifact;
  resolutionEvidence: readonly ProbabilityResolutionEvidence[];
}>): ProbabilityCalibrationObservation {
  const body = observationBody(input);
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertProbabilityCalibrationObservation(
  value: unknown,
): ProbabilityCalibrationObservation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probability calibration observation is malformed");
  }
  const observation = value as ProbabilityCalibrationObservation;
  const expected = observationBody({
    bound: observation.bound,
    resolutionEvidence: observation.resolutionEvidence,
  });
  const { artifactHash: _artifactHash, ...body } = observation;
  if (observation.schemaVersion !== expected.schemaVersion ||
    observation.artifactHash !== hashCanonical(expected) ||
    hashCanonical(expected) !== hashCanonical(body)) {
    throw new Error("probability calibration observation does not replay");
  }
  return observation;
}

type GroupMember = Readonly<{
  observation: ProbabilityCalibrationObservation;
  estimator: string;
  method: ProbabilityEstimationMethod;
  semanticFamily: SearchSemanticFamily | null;
  lower: bigint;
  upper: bigint;
}>;

function probabilityBucket(upper: bigint): Readonly<{ start: bigint; end: bigint }> {
  const index = upper === PROBABILITY_SCALE
    ? 9n
    : upper / BUCKET_WIDTH_PPM;
  return Object.freeze({
    start: index * BUCKET_WIDTH_PPM,
    end: (index + 1n) * BUCKET_WIDTH_PPM,
  });
}

function buildGroup(
  members: readonly GroupMember[],
  minimumSampleSize: bigint,
  schemaVersion: ProbabilityCalibrationArtifact["schemaVersion"],
): ProbabilityCalibrationGroup {
  const first = members[0]!;
  const bucket = probabilityBucket(first.upper);
  const count = BigInt(members.length);
  const adverseCount = BigInt(members.filter((item) => item.observation.adverseOccurred).length);
  const empiricalRate = adverseCount * PROBABILITY_SCALE / count;
  const meanLower = members.reduce((sum, item) => sum + item.lower, 0n) / count;
  const upperSum = members.reduce((sum, item) => sum + item.upper, 0n);
  const meanUpper = (upperSum + count - 1n) / count;
  const brierSum = members.reduce((sum, item) => {
    const midpoint = (item.lower + item.upper) / 2n;
    const observed = item.observation.adverseOccurred ? PROBABILITY_SCALE : 0n;
    const error = midpoint - observed;
    return sum + (error * error / PROBABILITY_SCALE);
  }, 0n);
  const upperExceedance = empiricalRate > meanUpper ? empiricalRate - meanUpper : 0n;
  const lowerShortfall = empiricalRate < meanLower ? meanLower - empiricalRate : 0n;
  const status = count < minimumSampleSize
    ? "INSUFFICIENT_SAMPLE" as const
    : upperExceedance > 0n
      ? "UNDERPREDICTED" as const
      : lowerShortfall > 0n
        ? "OVERPREDICTED" as const
        : "WITHIN_INTERVAL" as const;
  const identity = schemaVersion === "pmh.probability-calibration.v1"
    ? Object.freeze({
      schemaVersion: "pmh.probability-calibration-group-id.v1" as const,
      estimator: first.estimator,
      method: first.method,
      relationKind: first.observation.relationKind,
      horizonBucket: first.observation.horizonBucket,
      upperBucketStartPpm: bucket.start.toString(),
      upperBucketEndPpm: bucket.end.toString(),
    })
    : Object.freeze({
      schemaVersion: "pmh.probability-calibration-group-id.v2" as const,
      estimator: first.estimator,
      method: first.method,
      semanticFamily: first.semanticFamily,
      relationKind: first.observation.relationKind,
      horizonBucket: first.observation.horizonBucket,
      upperBucketStartPpm: bucket.start.toString(),
      upperBucketEndPpm: bucket.end.toString(),
    });
  return Object.freeze({
    groupId: hashCanonical(identity),
    estimator: first.estimator,
    method: first.method,
    ...(schemaVersion === "pmh.probability-calibration.v1"
      ? {}
      : { semanticFamily: first.semanticFamily }),
    relationKind: first.observation.relationKind,
    horizonBucket: first.observation.horizonBucket,
    upperBucketStartPpm: bucket.start.toString(),
    upperBucketEndPpm: bucket.end.toString(),
    sampleCount: count.toString(),
    adverseCount: adverseCount.toString(),
    empiricalRatePpm: empiricalRate.toString(),
    meanLowerPpm: meanLower.toString(),
    meanUpperPpm: meanUpper.toString(),
    upperExceedancePpm: upperExceedance.toString(),
    lowerShortfallPpm: lowerShortfall.toString(),
    meanMidpointBrierPpm: (brierSum / count).toString(),
    status,
  });
}

function calibrationBody(input: Readonly<{
  observations: readonly ProbabilityCalibrationObservation[];
  createdAt: string;
  minimumSampleSize?: number;
}>): Omit<ProbabilityCalibrationArtifact, "artifactHash"> {
  canonicalIso(input.createdAt, "probability calibration creation time");
  const minimumSampleSize = input.minimumSampleSize ?? 20;
  if (!Number.isSafeInteger(minimumSampleSize) || minimumSampleSize < 2 || minimumSampleSize > 10_000) {
    throw new Error("probability calibration minimum sample size is invalid");
  }
  const observations = Object.freeze(input.observations
    .map(assertProbabilityCalibrationObservation)
    .sort((left, right) => left.artifactHash.localeCompare(right.artifactHash)));
  if (observations.length < 1 || observations.length > 100_000 ||
    new Set(observations.map((item) => item.artifactHash)).size !== observations.length) {
    throw new Error("probability calibration observations are missing, duplicated, or unbounded");
  }
  if (observations.some((item) => Date.parse(item.resolvedAt) > Date.parse(input.createdAt))) {
    throw new Error("probability calibration snapshot predates one of its outcomes");
  }
  const schemaVersion = observations.some((item) =>
      item.schemaVersion === "pmh.probability-calibration-observation.v2"
    )
    ? "pmh.probability-calibration.v2" as const
    : "pmh.probability-calibration.v1" as const;
  const grouped = new Map<string, GroupMember[]>();
  for (const observation of observations) {
    for (const estimate of observation.bound.estimates) {
      const upper = ppm(estimate.upperPpm, "calibration estimate upper bound");
      const bucket = probabilityBucket(upper);
      const semanticFamilies = schemaVersion === "pmh.probability-calibration.v1"
        ? [null] as const
        : observation.searchOrigin?.semanticFamilies ?? [null] as const;
      for (const semanticFamily of semanticFamilies) {
        const key = [
          estimate.estimator,
          estimate.method,
          ...(schemaVersion === "pmh.probability-calibration.v1"
            ? []
            : [semanticFamily ?? "UNATTRIBUTED"]),
          observation.relationKind,
          observation.horizonBucket,
          bucket.start.toString(),
        ].join("\u0000");
        const members = grouped.get(key) ?? [];
        members.push(Object.freeze({
          observation,
          estimator: estimate.estimator,
          method: estimate.method,
          semanticFamily,
          lower: ppm(estimate.lowerPpm, "calibration estimate lower bound"),
          upper,
        }));
        grouped.set(key, members);
      }
    }
  }
  const groups = Object.freeze([...grouped.values()]
    .map((members) => buildGroup(members, BigInt(minimumSampleSize), schemaVersion))
    .sort((left, right) => left.groupId.localeCompare(right.groupId)));
  const body = Object.freeze({
    schemaVersion,
    createdAt: input.createdAt,
    minimumSampleSize: String(minimumSampleSize),
    observationArtifactHashes: Object.freeze(observations.map((item) => item.artifactHash)),
    observations,
    groups,
    measuredGroupCount: String(groups.filter((item) => item.status !== "INSUFFICIENT_SAMPLE").length),
    insufficientGroupCount: String(groups.filter((item) => item.status === "INSUFFICIENT_SAMPLE").length),
    authority: "CALIBRATION_EVIDENCE_ONLY" as const,
    probabilityCertificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return body;
}

export function buildProbabilityCalibrationArtifact(input: Readonly<{
  observations: readonly ProbabilityCalibrationObservation[];
  createdAt: string;
  minimumSampleSize?: number;
}>): ProbabilityCalibrationArtifact {
  const body = calibrationBody(input);
  return Object.freeze({ ...body, artifactHash: hashCanonical(body) });
}

export function assertProbabilityCalibrationArtifact(value: unknown): ProbabilityCalibrationArtifact {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probability calibration artifact is malformed");
  }
  const artifact = value as ProbabilityCalibrationArtifact;
  const expected = calibrationBody({
    observations: artifact.observations,
    createdAt: artifact.createdAt,
    minimumSampleSize: Number(artifact.minimumSampleSize),
  });
  const { artifactHash: _artifactHash, ...body } = artifact;
  if (artifact.schemaVersion !== expected.schemaVersion ||
    artifact.artifactHash !== hashCanonical(expected) ||
    hashCanonical(expected) !== hashCanonical(body)) {
    throw new Error("probability calibration artifact does not replay");
  }
  return artifact;
}
