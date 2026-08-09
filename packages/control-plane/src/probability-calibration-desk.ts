import type { Hash } from "@pmh/domain";
import type { OperationalStorageProjection } from "./types.js";
import {
  assertProbabilityCalibrationArtifact,
  assertProbabilityCalibrationObservation,
  buildProbabilityCalibrationArtifact,
  buildProbabilityCalibrationObservation,
  type ProbabilityCalibrationArtifact,
  type ProbabilityCalibrationGroup,
  type ProbabilityCalibrationObservation,
  type ProbabilityResolutionEvidence,
} from "./probability-calibration.js";
import {
  assertProbabilisticSemanticBound,
  type ProbabilisticSemanticBoundArtifact,
} from "./probabilistic-semantic-arbitrage.js";
import type { SearchSemanticFamily } from "./search-semantic-family.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export interface ProbabilityCalibrationStore {
  readonly probabilityCalibrationBoundStorage: OperationalStorageProjection<"artifactHash">;
  readonly probabilityCalibrationObservationStorage: OperationalStorageProjection<"artifactHash">;
  readonly probabilityCalibrationSnapshotStorage: OperationalStorageProjection<"artifactHash">;
  loadProbabilityCalibrationBounds(limit: number): readonly ProbabilisticSemanticBoundArtifact[];
  saveProbabilityCalibrationBound(bound: ProbabilisticSemanticBoundArtifact): void;
  loadProbabilityCalibrationObservations(limit: number): readonly ProbabilityCalibrationObservation[];
  saveProbabilityCalibrationObservation(observation: ProbabilityCalibrationObservation): void;
  loadProbabilityCalibrationSnapshots(limit: number): readonly ProbabilityCalibrationArtifact[];
  saveProbabilityCalibrationSnapshot(
    artifact: ProbabilityCalibrationArtifact,
    retentionLimit: number,
  ): void;
}

export type ProbabilityCalibrationObservationSummary = Readonly<{
  artifactHash: Hash;
  boundArtifactHash: Hash;
  proposalId: Hash;
  relationKind: ProbabilityCalibrationObservation["relationKind"];
  observedStateId: string;
  adverseOccurred: boolean;
  resolvedAt: string;
  horizonBucket: ProbabilityCalibrationObservation["horizonBucket"];
  listingRefs: readonly string[];
  issueIds: readonly Hash[];
  semanticFamilies: readonly SearchSemanticFamily[];
}>;

export type ProbabilityCalibrationSnapshotSummary = Readonly<{
  artifactHash: Hash;
  createdAt: string;
  observationCount: number;
  measuredGroupCount: number;
  insufficientGroupCount: number;
  groups: readonly ProbabilityCalibrationGroup[];
}>;

export type ProbabilityCalibrationDeskProjection = Readonly<{
  schemaVersion: "pmh.probability-calibration-desk.v1";
  status: "EMPTY" | "COLLECTING" | "MEASURED";
  registeredBoundCount: number;
  registeredAttributedBoundCount: number;
  registeredObservedBoundCount: number;
  pendingResolutionBoundCount: number;
  observationCount: number;
  attributedObservationCount: number;
  adverseObservationCount: number;
  snapshotCount: number;
  minimumSampleSize: number;
  snapshotInterval: number;
  nextSnapshotAtObservationCount: number;
  currentArtifactHash: Hash | null;
  currentCreatedAt: string | null;
  measuredGroupCount: number;
  insufficientGroupCount: number;
  attributedGroupCount: number;
  groups: readonly ProbabilityCalibrationGroup[];
  observations: readonly ProbabilityCalibrationObservationSummary[];
  snapshots: readonly ProbabilityCalibrationSnapshotSummary[];
  storage: Readonly<{
    bounds: OperationalStorageProjection<"artifactHash">;
    observations: OperationalStorageProjection<"artifactHash">;
    snapshots: OperationalStorageProjection<"artifactHash">;
  }>;
  authority: "CALIBRATION_ORCHESTRATION_ONLY";
  probabilityCertificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export type ProbabilityCalibrationRecordResult = Readonly<{
  observation: ProbabilityCalibrationObservation;
  idempotentReplay: boolean;
  snapshot: ProbabilityCalibrationArtifact | null;
}>;

type Options = Readonly<{
  boundSource: () => readonly ProbabilisticSemanticBoundArtifact[];
  store?: ProbabilityCalibrationStore;
  now?: () => string;
  minimumSampleSize?: number;
  snapshotInterval?: number;
  observationLimit?: number;
  snapshotRetentionLimit?: number;
  observationDetailLimit?: number;
  snapshotDetailLimit?: number;
}>;

function positiveInteger(
  value: number | undefined,
  fallback: number,
  label: string,
  maximum: number,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum) {
    throw new Error(`${label} is invalid`);
  }
  return selected;
}

function canonicalIso(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return value;
}

const MEMORY_STORAGE = Object.freeze({
  mode: "MEMORY" as const,
  durable: false,
  schemaVersion: 0,
  idempotencyKey: "artifactHash" as const,
});

export class ProbabilityCalibrationDesk {
  readonly #boundSource: Options["boundSource"];
  readonly #store: ProbabilityCalibrationStore | undefined;
  readonly #now: () => string;
  readonly #minimumSampleSize: number;
  readonly #snapshotInterval: number;
  readonly #observationLimit: number;
  readonly #snapshotRetentionLimit: number;
  readonly #observationDetailLimit: number;
  readonly #snapshotDetailLimit: number;
  readonly #observations: ProbabilityCalibrationObservation[];
  readonly #snapshots: ProbabilityCalibrationArtifact[];
  readonly #registeredBounds: ProbabilisticSemanticBoundArtifact[];

  public constructor(options: Options) {
    this.#boundSource = options.boundSource;
    this.#store = options.store;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#minimumSampleSize = positiveInteger(
      options.minimumSampleSize,
      20,
      "probability calibration minimum sample size",
      10_000,
    );
    if (this.#minimumSampleSize < 2) {
      throw new Error("probability calibration minimum sample size is invalid");
    }
    this.#snapshotInterval = positiveInteger(
      options.snapshotInterval,
      20,
      "probability calibration snapshot interval",
      10_000,
    );
    this.#observationLimit = positiveInteger(
      options.observationLimit,
      100_000,
      "probability calibration observation limit",
      100_000,
    );
    this.#snapshotRetentionLimit = positiveInteger(
      options.snapshotRetentionLimit,
      1_000,
      "probability calibration snapshot retention limit",
      10_000,
    );
    this.#observationDetailLimit = positiveInteger(
      options.observationDetailLimit,
      100,
      "probability calibration observation detail limit",
      1_000,
    );
    this.#snapshotDetailLimit = positiveInteger(
      options.snapshotDetailLimit,
      100,
      "probability calibration snapshot detail limit",
      1_000,
    );
    const loadedBounds = options.store?.loadProbabilityCalibrationBounds(
      this.#observationLimit + 1,
    ) ?? [];
    if (loadedBounds.length > this.#observationLimit) {
      throw new Error("probability calibration bound registry exceeds its configured limit");
    }
    this.#registeredBounds = loadedBounds.map(assertProbabilisticSemanticBound);
    if (new Set(this.#registeredBounds.map((item) => item.artifactHash)).size !==
      this.#registeredBounds.length) {
      throw new Error("probability calibration bound registry contains duplicates");
    }
    const loadedObservations = options.store?.loadProbabilityCalibrationObservations(
      this.#observationLimit + 1,
    ) ?? [];
    if (loadedObservations.length > this.#observationLimit) {
      throw new Error("probability calibration observation storage exceeds its configured limit");
    }
    this.#observations = loadedObservations.map(assertProbabilityCalibrationObservation);
    if (new Set(this.#observations.map((item) => item.boundArtifactHash)).size !== this.#observations.length) {
      throw new Error("probability calibration storage contains conflicting bound outcomes");
    }
    this.#snapshots = (options.store?.loadProbabilityCalibrationSnapshots(
      this.#snapshotRetentionLimit,
    ) ?? []).map(assertProbabilityCalibrationArtifact);
    this.#sortRecords();
  }

  public recordResolution(input: Readonly<{
    boundArtifactHash: Hash;
    resolutionEvidence: readonly ProbabilityResolutionEvidence[];
  }>): ProbabilityCalibrationRecordResult {
    if (!HASH_PATTERN.test(input.boundArtifactHash)) {
      throw new Error("probability calibration bound artifact hash is invalid");
    }
    this.#syncBounds();
    const matches = this.#registeredBounds.filter(
      (item) => item.artifactHash === input.boundArtifactHash,
    );
    if (matches.length !== 1) {
      throw new Error("probability calibration bound is not uniquely registered");
    }
    const now = canonicalIso(this.#now(), "probability calibration clock");
    if (input.resolutionEvidence.some((item) => Date.parse(item.resolvedAt) > Date.parse(now))) {
      throw new Error("probability resolution evidence is dated in the future");
    }
    const observation = buildProbabilityCalibrationObservation({
      bound: matches[0]!,
      resolutionEvidence: input.resolutionEvidence,
    });
    const existing = this.#observations.find(
      (item) => item.boundArtifactHash === observation.boundArtifactHash,
    );
    if (existing !== undefined) {
      if (existing.artifactHash !== observation.artifactHash) {
        throw new Error("probability calibration bound already has a different outcome");
      }
      return Object.freeze({
        observation: existing,
        idempotentReplay: true,
        snapshot: this.#ensureMilestoneSnapshot(),
      });
    }
    if (this.#observations.length >= this.#observationLimit) {
      throw new Error("probability calibration observation limit reached");
    }
    this.#store?.saveProbabilityCalibrationObservation(observation);
    this.#observations.push(observation);
    this.#sortRecords();
    return Object.freeze({
      observation,
      idempotentReplay: false,
      snapshot: this.#ensureMilestoneSnapshot(),
    });
  }

  public pendingBounds(): readonly ProbabilisticSemanticBoundArtifact[] {
    this.#syncBounds();
    const observed = new Set(this.#observations.map((item) => item.boundArtifactHash));
    return Object.freeze(this.#registeredBounds
      .filter((bound) => !observed.has(bound.artifactHash))
      .slice());
  }

  public projection(): ProbabilityCalibrationDeskProjection {
    this.#syncBounds();
    const bounds = this.#registeredBounds;
    const observedBoundHashes = new Set(this.#observations.map((item) => item.boundArtifactHash));
    const registeredObservedBoundCount = bounds.filter(
      (item) => observedBoundHashes.has(item.artifactHash),
    ).length;
    const current = this.#currentArtifact();
    const groups = current?.groups ?? Object.freeze([]);
    const observations = Object.freeze(this.#observations.slice(0, this.#observationDetailLimit).map(
      (item): ProbabilityCalibrationObservationSummary => Object.freeze({
        artifactHash: item.artifactHash,
        boundArtifactHash: item.boundArtifactHash,
        proposalId: item.proposalId,
        relationKind: item.relationKind,
        observedStateId: item.observedStateId,
        adverseOccurred: item.adverseOccurred,
        resolvedAt: item.resolvedAt,
        horizonBucket: item.horizonBucket,
        listingRefs: Object.freeze(item.bound.listingRefs.slice()),
        issueIds: Object.freeze(item.searchOrigin?.issueIds.slice() ?? []),
        semanticFamilies: Object.freeze(item.searchOrigin?.semanticFamilies.slice() ?? []),
      }),
    ));
    const snapshots = Object.freeze(this.#snapshots.slice(0, this.#snapshotDetailLimit).map(
      (item): ProbabilityCalibrationSnapshotSummary => Object.freeze({
        artifactHash: item.artifactHash,
        createdAt: item.createdAt,
        observationCount: item.observations.length,
        measuredGroupCount: Number(item.measuredGroupCount),
        insufficientGroupCount: Number(item.insufficientGroupCount),
        groups: item.groups,
      }),
    ));
    const nextSnapshotAtObservationCount = this.#observations.length === 0
      ? 1
      : this.#observations.length < this.#snapshotInterval
        ? this.#snapshotInterval
        : (Math.floor(this.#observations.length / this.#snapshotInterval) + 1) * this.#snapshotInterval;
    return Object.freeze({
      schemaVersion: "pmh.probability-calibration-desk.v1" as const,
      status: current === null
        ? "EMPTY" as const
        : Number(current.measuredGroupCount) > 0
          ? "MEASURED" as const
          : "COLLECTING" as const,
      registeredBoundCount: bounds.length,
      registeredAttributedBoundCount: bounds.filter((item) =>
        item.searchOrigin !== undefined
      ).length,
      registeredObservedBoundCount,
      pendingResolutionBoundCount: bounds.length - registeredObservedBoundCount,
      observationCount: this.#observations.length,
      attributedObservationCount: this.#observations.filter((item) =>
        item.searchOrigin !== undefined
      ).length,
      adverseObservationCount: this.#observations.filter((item) => item.adverseOccurred).length,
      snapshotCount: this.#snapshots.length,
      minimumSampleSize: this.#minimumSampleSize,
      snapshotInterval: this.#snapshotInterval,
      nextSnapshotAtObservationCount,
      currentArtifactHash: current?.artifactHash ?? null,
      currentCreatedAt: current?.createdAt ?? null,
      measuredGroupCount: Number(current?.measuredGroupCount ?? "0"),
      insufficientGroupCount: Number(current?.insufficientGroupCount ?? "0"),
      attributedGroupCount: groups.filter((item) => item.semanticFamily != null).length,
      groups,
      observations,
      snapshots,
      storage: Object.freeze({
        bounds: this.#store?.probabilityCalibrationBoundStorage ?? MEMORY_STORAGE,
        observations: this.#store?.probabilityCalibrationObservationStorage ?? MEMORY_STORAGE,
        snapshots: this.#store?.probabilityCalibrationSnapshotStorage ?? MEMORY_STORAGE,
      }),
      authority: "CALIBRATION_ORCHESTRATION_ONLY" as const,
      probabilityCertificateAuthority: false as const,
      executionAuthority: false as const,
      effects: Object.freeze({
        externalWrites: false as const,
        valueMovingActions: false as const,
        liveExecutionEnabled: false as const,
      }),
    });
  }

  #currentArtifact(): ProbabilityCalibrationArtifact | null {
    if (this.#observations.length === 0) return null;
    const createdAt = this.#observations.reduce(
      (latest, item) => item.resolvedAt > latest ? item.resolvedAt : latest,
      this.#observations[0]!.resolvedAt,
    );
    return buildProbabilityCalibrationArtifact({
      observations: this.#observations,
      createdAt,
      minimumSampleSize: this.#minimumSampleSize,
    });
  }

  #syncBounds(): void {
    const supplied = this.#boundSource().map(assertProbabilisticSemanticBound);
    if (new Set(supplied.map((item) => item.artifactHash)).size !== supplied.length) {
      throw new Error("probability calibration registered bounds are duplicated");
    }
    const registered = new Set(this.#registeredBounds.map((item) => item.artifactHash));
    for (const bound of supplied) {
      if (registered.has(bound.artifactHash)) continue;
      if (this.#registeredBounds.length >= this.#observationLimit) {
        throw new Error("probability calibration bound registry limit reached");
      }
      this.#store?.saveProbabilityCalibrationBound(bound);
      this.#registeredBounds.push(bound);
      registered.add(bound.artifactHash);
    }
    this.#registeredBounds.sort((left, right) =>
      right.validFrom.localeCompare(left.validFrom) ||
      left.artifactHash.localeCompare(right.artifactHash));
  }

  #ensureMilestoneSnapshot(): ProbabilityCalibrationArtifact | null {
    const count = this.#observations.length;
    if (count !== 1 && count % this.#snapshotInterval !== 0) return null;
    const artifact = this.#currentArtifact()!;
    const existing = this.#snapshots.find((item) => item.artifactHash === artifact.artifactHash);
    if (existing !== undefined) return existing;
    this.#store?.saveProbabilityCalibrationSnapshot(artifact, this.#snapshotRetentionLimit);
    this.#snapshots.push(artifact);
    this.#sortRecords();
    if (this.#snapshots.length > this.#snapshotRetentionLimit) {
      this.#snapshots.splice(this.#snapshotRetentionLimit);
    }
    return artifact;
  }

  #sortRecords(): void {
    this.#observations.sort((left, right) =>
      right.resolvedAt.localeCompare(left.resolvedAt) ||
      left.artifactHash.localeCompare(right.artifactHash));
    this.#snapshots.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.artifactHash.localeCompare(left.artifactHash));
  }
}
