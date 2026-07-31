import { hashCanonical } from "@pmh/domain";
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
  StudioProjection,
} from "./types.js";
import { buildCampaignEvidence } from "./qualification.js";
import { buildReviewedCompilationEvidence } from "./reviewed-compilation.js";

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
  modelProvider?: ModelProviderProjection;
  bookDesk?: BookDeskProjection;
  discoveryDesk?: DiscoveryDeskProjection;
}): StudioProjection {
  const bookDesk = input.bookDesk ?? {
    mode: "FIXTURE_REPLAY" as const,
    replayCount: 0,
    books: [],
  };
  const replayChaos = runReplayChaosSuite();
  const modelProvider = input.modelProvider ?? {
    provider: "OPENAI_RESPONSES" as const,
    configured: false,
    credentialEnv: "OPENAI_API_KEY" as const,
    model: "gpt-5.4-mini",
    maxOutputTokens: 800,
    timeoutMs: 8_000,
    reasoningEffort: "minimal" as const,
    responseStorage: false as const,
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
      proofTests: 136,
      liveExecutionEnabled: false as const,
      controlPlaneConnected: true as const,
    },
    ai: {
      architecture: "SCOUT_THEN_VERIFY" as const,
      activeRuns: input.activeRuns,
      catalogContext,
      modelProvider,
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
    },
    discoveryDesk: input.discoveryDesk ?? {
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
    },
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
