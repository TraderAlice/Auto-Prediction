import { hashCanonical } from "@pmh/domain";
import type {
  RealCandidateDepthEvidence,
  RealCandidateDispositionEvidence,
  RealCandidatePreflightEvidence,
  RealCandidateRescreenEvidence,
} from "@pmh/evidence";
import { runReplayChaosSuite } from "@pmh/market-state";
import { geminiManifest } from "@pmh/venue-gemini";
import { kalshiManifest } from "@pmh/venue-kalshi";
import { limitlessManifest } from "@pmh/venue-limitless";
import { myriadManifest } from "@pmh/venue-myriad";
import { opinionManifest } from "@pmh/venue-opinion";
import { polymarketManifest } from "@pmh/venue-polymarket";
import { assertManifest } from "@pmh/protocol";
import type {
  BookDeskProjection,
  DiscoveryDeskProjection,
  DiscoveryCatalogProjection,
  DiscoveryWorker,
  ModelProviderProjection,
  PiInvestigatorProjection,
  StudioProjection,
} from "./types.js";
import type { InvestigationDeskProjection } from "./investigation-desk.js";
import type { CatalogObservationProjection } from "./catalog-observation.js";
import type { OpportunityRadarProjection } from "./opportunity-radar.js";
import { buildCampaignEvidence } from "./qualification.js";
import { buildReviewedCompilationEvidence } from "./reviewed-compilation.js";
import { buildResearchCaseDesk } from "./research-case-desk.js";

const presentation = {
  "polymarket-global": ["CLOB · CTF", 98, "#7ef0c1"],
  kalshi: ["CLOB · Centralized", 96, "#8ea9ff"],
  "gemini-predictions": ["CLOB · Combo", 99, "#84c8ff"],
  opinion: ["CLOB · Outcome token", 92, "#d4a8ff"],
  myriad: ["AMM · Multi-chain", 94, "#ffc78e"],
  limitless: ["CLOB · Socket.IO", 97, "#ff9f84"],
} as const;

const gatewayPostures = {
  kalshi: "INERT_DEMO",
  "gemini-predictions": "INERT_SANDBOX",
} as const;

const manifests = [
  polymarketManifest,
  kalshiManifest,
  geminiManifest,
  limitlessManifest,
  opinionManifest,
  myriadManifest,
].map(assertManifest);

function formatFixed(value: string, scale: string, signed = false): string {
  const amount = BigInt(value);
  const units = BigInt(scale);
  const cents = (amount * 100n) / units;
  const sign = cents < 0n ? "-" : signed && cents > 0n ? "+" : "";
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}$${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function titleCaseStage(value: string): string {
  return value
    .toLowerCase()
    .split(/[_-]/)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function buildStudioProjection(input: {
  workers: readonly DiscoveryWorker[];
  activeRuns: number;
  catalogContext?: DiscoveryCatalogProjection;
  catalogObservation?: CatalogObservationProjection;
  opportunityRadar?: OpportunityRadarProjection;
  modelProvider?: ModelProviderProjection;
  investigator?: PiInvestigatorProjection;
  investigationDesk?: InvestigationDeskProjection;
  bookDesk?: BookDeskProjection;
  discoveryDesk?: DiscoveryDeskProjection;
  realCandidatePreflight?: RealCandidatePreflightEvidence;
  realCandidateDepth?: RealCandidateDepthEvidence;
  realCandidateDisposition?: RealCandidateDispositionEvidence;
  realCandidateRescreen?: RealCandidateRescreenEvidence;
}): StudioProjection {
  const bookDesk = input.bookDesk ?? {
    mode: "FIXTURE_REPLAY" as const,
    replayCount: 0,
    books: [],
  };
  const replayChaos = runReplayChaosSuite();
  const modelProvider = input.modelProvider ?? {
    provider: "DEEPSEEK_CHAT_COMPLETIONS" as const,
    transport: "VERCEL_AI_SDK" as const,
    configured: false,
    credentialEnv: "DEEPSEEK_API_KEY" as const,
    model: "deepseek-v4-flash",
    maxOutputTokens: 800,
    timeoutMs: 8_000,
    reasoningEffort: "disabled" as const,
    responseStorage: "PROVIDER_POLICY" as const,
    authority: "PROPOSE_ONLY" as const,
  };
  const catalogContext = input.catalogContext ?? {
    mode: "VERIFIED_FIXTURE_CATALOGS" as const,
    corpusIdentity: hashCanonical({ listings: [], sourceFixtureHashes: [] }),
    listingCount: 0,
    venueCount: 0,
    sourceFixtureCount: 0,
    maxListingsPerTask: 30,
  };
  const catalogObservation = input.catalogObservation ?? {
    mode: "ANONYMOUS_PUBLIC_GET" as const,
    status: "IDLE" as const,
    promotion: "OBSERVE_ONLY" as const,
    contextQualification: {
      status: "INELIGIBLE" as const,
      eligibleSourceCount: 0,
      maxAgeMs: 15 * 60 * 1_000,
      maxListingsPerTask: 30,
      requiresExplicitRequest: true as const,
      defaultMode: "VERIFIED_FIXTURES" as const,
      authority: "PROPOSE_ONLY" as const,
    },
    currentSetIdentity: hashCanonical([]),
    sourceCount: 0,
    healthySourceCount: 0,
    listingCount: 0,
    timeoutMs: 10_000,
    maxResponseBytes: 2_000_000,
    storage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "observationId" as const,
    },
    sources: [],
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const investigator = input.investigator ?? {
    engine: "PI_CLI" as const,
    configured: false,
    credentialEnv: "DEEPSEEK_API_KEY" as const,
    provider: "deepseek" as const,
    model: "deepseek-v4-flash",
    mode: "TEXT_ONE_SHOT" as const,
    thinking: "high" as const,
    tools: ["read", "grep", "find", "ls"] as const,
    sessionPersistence: false as const,
    timeoutMs: 300_000,
    maxOutputBytes: 2_000_000,
    authority: "PROPOSE_ONLY" as const,
  };
  const opportunityRadar = input.opportunityRadar ?? {
    algorithmVersion: "pmh.opportunity-radar.lexical-v1" as const,
    sourceSetIdentity: hashCanonical([]),
    observedListingCount: 0,
    eligibleSourceCount: 0,
    excludedSourceCount: 0,
    candidateCount: 0,
    candidates: [],
    scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE" as const,
    effects: {
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    },
  };
  const investigationDesk = input.investigationDesk ?? {
    retentionLimit: 10,
    activeCount: 0 as const,
    runCount: 0,
    passCount: 0,
    failedCount: 0,
    storage: {
      mode: "MEMORY" as const,
      durable: false as const,
      schemaVersion: 0,
      idempotencyKey: "taskId+catalogContextIdentity" as const,
    },
    records: [],
  };
  const discoveryDesk = input.discoveryDesk ?? {
    retentionLimit: 25,
    runCount: 0,
    hypothesisCount: 0,
    unreviewedCount: 0,
    storage: {
      mode: "MEMORY" as const,
      durable: false,
      schemaVersion: 0,
      idempotencyKey: "taskId" as const,
    },
    runs: [],
  };
  const researchDesk = buildResearchCaseDesk(discoveryDesk, investigationDesk);
  const reviewedCompilation = buildReviewedCompilationEvidence();
  const compiledCapital = Object.entries(
    reviewedCompilation.certificate.capitalRequiredByVenue,
  );
  const totalCapital = compiledCapital.reduce(
    (total, [, amount]) => total + BigInt(amount),
    0n,
  );
  const worstCase = BigInt(
    reviewedCompilation.certificate.worstCaseAfterFees,
  );
  const returnBps = totalCapital === 0n ? 0n : (worstCase * 10_000n) / totalCapital;
  const state = {
    system: {
      lifecycle: "PRE_ALPHA" as const,
      observedVenueFamilies: 8,
      catalogAdapters: manifests.filter((manifest) =>
        manifest.capabilities.some(
          (capability) =>
            capability.capability === "MARKET_CATALOG" &&
            capability.implemented,
        ),
      ).length,
      realtimeBookAdapters: manifests.filter((manifest) =>
        manifest.capabilities.some(
          (capability) =>
            capability.capability === "REALTIME_BOOK" &&
            capability.implemented,
        ),
      ).length,
      inertOrderGateways: manifests.filter((manifest) =>
        manifest.capabilities.some(
          (capability) =>
            capability.capability === "ORDER_GATEWAY" &&
            capability.implemented,
        ),
      ).length,
      proofTests: 201,
      liveExecutionEnabled: false as const,
      controlPlaneConnected: true as const,
    },
    ai: {
      architecture: "SCOUT_THEN_VERIFY" as const,
      activeRuns: input.activeRuns,
      catalogContext,
      catalogObservation,
      opportunityRadar,
      modelProvider,
      investigator,
      investigationDesk,
      researchDesk,
      workers: [
        ...input.workers.map((worker) => ({
          workerId: worker.workerId,
          kind: worker.kind,
          costTier: worker.costTier,
          status: "READY" as const,
        })),
        ...(input.workers.some((worker) => worker.kind === "MODEL")
          ? []
          : [
              {
                workerId: "model-fast-lane",
                kind: "MODEL" as const,
                costTier: "LOW" as const,
                status: modelProvider.configured
                  ? ("NEEDS_PROVIDER" as const)
                  : ("NEEDS_KEY" as const),
              },
            ]),
      ],
      promotionBoundary:
        "AI proposes only; independent exact verification is the sole certificate authority.",
    },
    bookDesk,
    qualification: {
      replayChaos,
      campaignEvidence: buildCampaignEvidence(bookDesk, replayChaos),
      reviewedCompilation,
      realCandidatePreflight: input.realCandidatePreflight ?? null,
      realCandidateDepth: input.realCandidateDepth ?? null,
      realCandidateDisposition: input.realCandidateDisposition ?? null,
      realCandidateRescreen: input.realCandidateRescreen ?? null,
    },
    discoveryDesk,
    venues: manifests
      .map((manifest) => {
        const details =
          presentation[manifest.venueId as keyof typeof presentation];
        if (details === undefined) {
          throw new Error(`missing presentation for ${manifest.venueId}`);
        }
        return {
          id: manifest.venueId,
          name: manifest.displayName.replace(" Prediction Markets", ""),
          mechanism: details[0],
          stage: manifest.capabilities.some(
            (capability) =>
              capability.capability === "REALTIME_BOOK" &&
              capability.qualification.includes("OBSERVE"),
          )
            ? ("OBSERVE" as const)
            : ("DISCOVER" as const),
          health: details[1],
          color: details[2],
          protocolIdentity: manifest.protocolIdentity,
          capabilities: manifest.capabilities
            .filter((capability) => capability.implemented)
            .map((capability) => capability.capability),
          gatewayPosture:
            gatewayPostures[
              manifest.venueId as keyof typeof gatewayPostures
            ] ?? ("ABSENT" as const),
          liveExecutionEnabled: false as const,
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
    opportunities: [
      {
        id: "opp:synthetic-reviewed-binary-pair",
        title: "Synthetic binary-pair qualification",
        strategy: `Reviewed complete set · ${reviewedCompilation.certificate.legCount} fixture venues`,
        capital: formatFixed(
          totalCapital.toString(),
          reviewedCompilation.certificate.quantityScale,
        ),
        floor: formatFixed(
          reviewedCompilation.certificate.worstCaseAfterFees,
          reviewedCompilation.certificate.quantityScale,
          true,
        ),
        returnRate: `+${returnBps / 100n}.${String(returnBps % 100n).padStart(2, "0")}%`,
        expires: "fixture-bound",
        certificate: reviewedCompilation.certificate.id,
        evidence: `${reviewedCompilation.stages.flatMap((stage) => stage.evidenceHashes).length} hash-bound inputs`,
        confidence: "EXACT" as const,
        source: "SYNTHETIC_QUALIFICATION_FIXTURE" as const,
      },
    ],
    trace: reviewedCompilation.stages.map(
      (stage) =>
        [titleCaseStage(stage.stage), stage.status, stage.detail] as const,
    ),
    capital: compiledCapital.map(([venue]) => ({
      venue: titleCaseStage(venue),
      available: 0,
      reserved: 100,
      locked: 0,
    })),
    capitalScope: "SYNTHETIC_QUALIFICATION_FIXTURE" as const,
    payoffStates: Object.entries(
      reviewedCompilation.certificate.payoffByResolution,
    ).map(([label, amount]) => ({
      label: label.toUpperCase(),
      amount: formatFixed(
        amount,
        reviewedCompilation.certificate.quantityScale,
        true,
      ),
      height: 80,
    })),
  };
  return Object.freeze({
    identity: {
      schemaVersion: "pmh.studio-projection.v1" as const,
      campaign: "architecture-qualification",
      mode: "CONTROL_PLANE" as const,
      stateHash: hashCanonical(state),
    },
    ...state,
  });
}
