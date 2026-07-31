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
  DiscoveryWorker,
  StudioProjection,
} from "./types.js";
import { buildCampaignEvidence } from "./qualification.js";

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

export function buildStudioProjection(input: {
  workers: readonly DiscoveryWorker[];
  activeRuns: number;
  bookDesk?: BookDeskProjection;
  discoveryDesk?: DiscoveryDeskProjection;
}): StudioProjection {
  const bookDesk = input.bookDesk ?? {
    mode: "FIXTURE_REPLAY" as const,
    replayCount: 0,
    books: [],
  };
  const replayChaos = runReplayChaosSuite();
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
      proofTests: 96,
      liveExecutionEnabled: false as const,
      controlPlaneConnected: true as const,
    },
    ai: {
      architecture: "SCOUT_THEN_VERIFY" as const,
      activeRuns: input.activeRuns,
      workers: [
        ...input.workers.map((worker) => ({
          workerId: worker.workerId,
          kind: worker.kind,
          costTier: worker.costTier,
          status: "READY" as const,
        })),
        {
          workerId: "model-fast-lane",
          kind: "MODEL" as const,
          costTier: "LOW" as const,
          status: "NEEDS_PROVIDER" as const,
        },
      ],
      promotionBoundary:
        "AI proposes only; independent exact verification is the sole certificate authority.",
    },
    bookDesk,
    qualification: {
      replayChaos,
      campaignEvidence: buildCampaignEvidence(bookDesk, replayChaos),
    },
    discoveryDesk: input.discoveryDesk ?? {
      retentionLimit: 25,
      runCount: 0,
      hypothesisCount: 0,
      unreviewedCount: 0,
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
        id: "opp:rain-complete-set",
        title: "NYC rainfall above 0.25 in on Aug 2?",
        strategy: "Complete set · 3 venues",
        capital: "$2,400.00",
        floor: "+$74.88",
        returnRate: "+3.12%",
        expires: "02:41",
        certificate: "sha256:3ac40a…891d",
        evidence: "9 inputs",
        confidence: "EXACT" as const,
      },
      {
        id: "opp:btc-range",
        title: "BTC closes inside $63k–$65k today",
        strategy: "Exhaustive range · 2 venues",
        capital: "$1,200.00",
        floor: "+$19.44",
        returnRate: "+1.62%",
        expires: "00:58",
        certificate: "sha256:b1402c…f72a",
        evidence: "6 inputs",
        confidence: "EXACT" as const,
      },
    ],
    trace: [
      ["Contract equivalence", "PASS", "3 reviewed links"],
      ["Payout partition", "PASS", "8 canonical states"],
      ["Depth & precision", "PASS", "14 bound levels"],
      ["Fees & capital", "PASS", "all rounded adverse"],
      ["Book generation", "PASS", "3 state hashes"],
      ["Execution authority", "BLOCKED", "shadow only"],
    ] as const,
    capital: [
      { venue: "Polymarket", available: 72, reserved: 18, locked: 10 },
      { venue: "Kalshi", available: 61, reserved: 26, locked: 13 },
      { venue: "Gemini", available: 84, reserved: 8, locked: 8 },
    ],
    payoffStates: [
      { label: "RAIN > .25", value: 92 },
      { label: "RAIN ≤ .25", value: 81 },
      { label: "VOID", value: 68 },
      { label: "CANCELED", value: 72 },
    ],
  };
  return Object.freeze({
    identity: {
      schemaVersion: "pmh.studio-projection.v1",
      campaign: "architecture-qualification",
      mode: "CONTROL_PLANE",
      stateHash: hashCanonical(state),
    },
    ...state,
  });
}
