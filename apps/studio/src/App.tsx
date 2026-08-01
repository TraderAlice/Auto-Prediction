import { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  Braces,
  ChevronRight,
  CircleOff,
  Command,
  Database,
  FileCheck2,
  Fingerprint,
  Gauge,
  GitBranch,
  Hexagon,
  Inbox,
  LayoutDashboard,
  Menu,
  Network,
  PanelRightClose,
  Play,
  Radar,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  TestTubeDiagonal,
  Waypoints,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  StudioProjectionProvider,
  useControlPlaneProjection,
  useStudioProjection,
  type StudioProjection,
} from "@/data/studio-projection";
import { cn } from "@/lib/utils";

type View =
  | "overview"
  | "radar"
  | "preflight"
  | "scouts"
  | "cases"
  | "venues"
  | "books"
  | "evidence";
type Opportunity = StudioProjection["opportunities"][number];
type ResearchCase = StudioProjection["ai"]["researchDesk"]["cases"][number];
type RadarCandidate = StudioProjection["ai"]["opportunityRadar"]["candidates"][number];
type CatalogMode = "VERIFIED_FIXTURES" | "CURRENT_OBSERVATIONS";

const EMPTY_CATALOG_CONTEXT: StudioProjection["ai"]["catalogContext"] = {
  mode: "VERIFIED_FIXTURE_CATALOGS",
  corpusIdentity: `sha256:${"0".repeat(64)}`,
  listingCount: 0,
  venueCount: 0,
  sourceFixtureCount: 0,
  maxListingsPerTask: 30,
};

const EMPTY_OPPORTUNITY_RADAR: StudioProjection["ai"]["opportunityRadar"] = {
  algorithmVersion: "pmh.opportunity-radar.lexical-v1",
  sourceSetIdentity: `sha256:${"0".repeat(64)}`,
  observedListingCount: 0,
  eligibleSourceCount: 0,
  excludedSourceCount: 0,
  candidateCount: 0,
  candidates: [],
  scoreMeaning: "LEXICAL_BLOCKING_ONLY_NOT_CONFIDENCE",
  effects: {
    externalWrites: false,
    valueMovingActions: false,
    liveExecutionEnabled: false,
  },
};

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "radar", label: "Opportunity radar", icon: Radar },
  { id: "preflight", label: "Candidate preflight", icon: FileCheck2 },
  { id: "scouts", label: "Scout inbox", icon: Inbox },
  { id: "cases", label: "Research cases", icon: Waypoints },
  { id: "venues", label: "Venue matrix", icon: Network },
  { id: "books", label: "Book desk", icon: BookOpenCheck },
  { id: "evidence", label: "Evidence", icon: Fingerprint },
] as const;

const supplementalNavigation = [
  { label: "Claims", icon: Braces },
  { label: "Capital", icon: Gauge },
  { label: "Campaigns", icon: TestTubeDiagonal },
] as const;

function SignalMark() {
  return (
    <div className="signal-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}

async function requestDiscoveryRun(
  question: string,
  venueIds: readonly string[],
  catalogMode: CatalogMode = "VERIFIED_FIXTURES",
): Promise<boolean> {
  const response = await fetch("/api/v1/discovery/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, venueIds, catalogMode }),
  });
  if (!response.ok) throw new Error("scout request failed");
  const result = (await response.json()) as {
    executionAuthority: boolean;
    idempotentReplay?: boolean;
    hypotheses: readonly Readonly<{
      authority?: string;
      reviewStatus?: string;
    }>[];
  };
  if (
    result.executionAuthority !== false ||
    result.hypotheses.some(
      (hypothesis) =>
        hypothesis.authority !== "PROPOSE_ONLY" ||
        hypothesis.reviewStatus !== "UNREVIEWED",
    )
  ) {
    throw new Error("scout crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestInvestigation(
  question: string,
  venueIds: readonly string[],
  catalogMode: CatalogMode = "VERIFIED_FIXTURES",
): Promise<boolean> {
  const response = await fetch("/api/v1/investigations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, venueIds, catalogMode }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    executionAuthority?: boolean;
    authority?: string;
    reviewStatus?: string;
    idempotentReplay?: boolean;
    report?: { result?: { executionAuthority?: boolean } };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "pi investigation failed");
  }
  if (
    result.executionAuthority !== false ||
    result.authority !== "PROPOSE_ONLY" ||
    result.reviewStatus !== "UNREVIEWED" ||
    result.report?.result?.executionAuthority !== false
  ) {
    throw new Error("pi investigator crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestRadarTriage(candidateId: string): Promise<boolean> {
  const response = await fetch("/api/v1/radar/triage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidateId }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    radarCandidateId?: string;
    executionAuthority?: boolean;
    idempotentReplay?: boolean;
    hypotheses?: readonly Readonly<{
      authority?: string;
      reviewStatus?: string;
    }>[];
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "radar triage failed");
  }
  if (
    result.radarCandidateId !== candidateId ||
    result.executionAuthority !== false ||
    result.hypotheses?.some(
      (hypothesis) =>
        hypothesis.authority !== "PROPOSE_ONLY" ||
        hypothesis.reviewStatus !== "UNREVIEWED",
    ) !== false
  ) {
    throw new Error("radar triage crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestRadarInvestigation(
  candidateId: string,
): Promise<boolean> {
  const response = await fetch("/api/v1/radar/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidateId }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    radarCandidateId?: string;
    authority?: string;
    reviewStatus?: string;
    executionAuthority?: boolean;
    idempotentReplay?: boolean;
    report?: { result?: { executionAuthority?: boolean } };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "radar investigation failed");
  }
  if (
    result.radarCandidateId !== candidateId ||
    result.authority !== "PROPOSE_ONLY" ||
    result.reviewStatus !== "UNREVIEWED" ||
    result.executionAuthority !== false ||
    result.report?.result?.executionAuthority !== false
  ) {
    throw new Error("radar investigator crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestResearchCaseInvestigation(
  taskId: string,
): Promise<boolean> {
  const response = await fetch("/api/v1/research-cases/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  const result = (await response.json()) as {
    diagnostic?: string;
    taskId?: string;
    authority?: string;
    reviewStatus?: string;
    executionAuthority?: boolean;
    idempotentReplay?: boolean;
    report?: { result?: { executionAuthority?: boolean } };
  };
  if (!response.ok) {
    throw new Error(result.diagnostic ?? "case investigation failed");
  }
  if (
    result.taskId !== taskId ||
    result.authority !== "PROPOSE_ONLY" ||
    result.reviewStatus !== "UNREVIEWED" ||
    result.executionAuthority !== false ||
    result.report?.result?.executionAuthority !== false
  ) {
    throw new Error("case investigator crossed its authority boundary");
  }
  return result.idempotentReplay === true;
}

async function requestCatalogRefresh(): Promise<"READY" | "DEGRADED"> {
  const response = await fetch("/api/v1/catalog/observations/refresh", {
    method: "POST",
  });
  const result = (await response.json()) as {
    status?: string;
    promotion?: string;
    effects?: {
      externalWrites?: boolean;
      valueMovingActions?: boolean;
      liveExecutionEnabled?: boolean;
    };
  };
  if (
    (response.status !== 200 && response.status !== 207) ||
    (result.status !== "READY" && result.status !== "DEGRADED")
  ) {
    throw new Error("catalog observation refresh failed");
  }
  if (
    result.promotion !== "OBSERVE_ONLY" ||
    result.effects?.externalWrites !== false ||
    result.effects.valueMovingActions !== false ||
    result.effects.liveExecutionEnabled !== false
  ) {
    throw new Error("catalog observation crossed its authority boundary");
  }
  return result.status;
}

function VenuePulse() {
  const studioProjection = useStudioProjection();
  return (
    <div className="venue-pulse">
      <div className="pulse-heading">
        <span>Adapter pulse</span>
        <Badge variant="verified">
          {studioProjection.venues.length} registered
        </Badge>
      </div>
      <div className="pulse-list">
        {studioProjection.venues.map((venue) => (
          <div className="pulse-row" key={venue.id}>
            <span
              className="venue-dot"
              style={{ backgroundColor: venue.color }}
            />
            <span>{venue.name}</span>
            <span className="pulse-score">{venue.health}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sidebar({
  view,
  onViewChange,
  mobileOpen,
  onMobileClose,
}: {
  view: View;
  onViewChange: (view: View) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  return (
    <>
      <button
        className={cn("mobile-scrim", mobileOpen && "is-open")}
        aria-label="Close navigation"
        onClick={onMobileClose}
      />
      <aside className={cn("sidebar", mobileOpen && "is-open")}>
        <div className="brand">
          <SignalMark />
          <div>
            <span>HARMONY</span>
            <small>MARKET HARNESS</small>
          </div>
          <Button
            className="mobile-close"
            size="icon"
            variant="ghost"
            aria-label="Close navigation"
            onClick={onMobileClose}
          >
            <X size={17} />
          </Button>
        </div>

        <nav aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn("nav-item", view === item.id && "is-active")}
                onClick={() => {
                  onViewChange(item.id);
                  onMobileClose();
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {view === item.id && <span className="active-pip" />}
              </button>
            );
          })}

          <span className="nav-label nav-label-spaced">Core</span>
          {supplementalNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button className="nav-item is-muted" key={item.label}>
                <Icon size={17} />
                <span>{item.label}</span>
                <span className="soon">soon</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <VenuePulse />
          <div className="authority-note">
            <CircleOff size={15} />
            <div>
              <strong>Live authority absent</strong>
              <span>No signing · no value movement</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  onMenu,
  onCommand,
}: {
  onMenu: () => void;
  onCommand: () => void;
}) {
  const studioProjection = useStudioProjection();
  return (
    <header className="topbar">
      <div className="topbar-title">
        <Button
          className="menu-button"
          size="icon"
          variant="ghost"
          aria-label="Open navigation"
          onClick={onMenu}
        >
          <Menu size={19} />
        </Button>
        <div>
          <span className="eyebrow">Architecture qualification</span>
          <strong>AI discovery desk</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <button
          className="command-button"
          aria-label="Open command menu"
          onClick={onCommand}
        >
          <Search size={14} />
          <span>Find anything</span>
          <kbd>
            <Command size={11} /> K
          </kbd>
        </button>
        <Badge variant="shadow">
          <Sparkles size={10} />
          Shadow only
        </Badge>
        <span className="header-hash">
          <GitBranch size={13} />
          {studioProjection.identity.stateHash.slice(7, 14)}
        </span>
      </div>
    </header>
  );
}

function OpportunityRow({
  opportunity,
  onInspect,
}: {
  opportunity: Opportunity;
  onInspect: (opportunity: Opportunity) => void;
}) {
  return (
    <button
      className="opportunity-row"
      onClick={() => onInspect(opportunity)}
    >
      <div className="opportunity-main">
        <div className="opportunity-icon">
          <Waypoints size={17} />
        </div>
        <div>
          <strong>{opportunity.title}</strong>
          <span>
            {opportunity.strategy} · synthetic fixture
          </span>
        </div>
      </div>
      <div className="opportunity-cell hide-small">
        <span>Capital bound</span>
        <strong>{opportunity.capital}</strong>
      </div>
      <div className="opportunity-cell">
        <span>Worst payoff</span>
        <strong className="positive">{opportunity.floor}</strong>
      </div>
      <div className="opportunity-cell hide-medium">
        <span>Net floor</span>
        <strong className="positive">{opportunity.returnRate}</strong>
      </div>
      <div className="opportunity-cell hide-medium">
        <span>Expires</span>
        <strong className="mono">{opportunity.expires}</strong>
      </div>
      <ChevronRight className="row-chevron" size={17} />
    </button>
  );
}

function PayoffFloor() {
  const studioProjection = useStudioProjection();
  return (
    <Card className="payoff-card">
      <CardHeader>
        <div>
          <span className="eyebrow">Canonical payoff states</span>
          <h2>Profit floor stays above zero</h2>
        </div>
        <Badge variant="verified">
          <BadgeCheck size={11} />
          Exact
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="payoff-plot">
          <div className="zero-line">
            <span>$0 floor</span>
          </div>
          {studioProjection.payoffStates.map((state) => (
            <div className="payoff-column" key={state.label}>
              <div className="payoff-bar-track">
                <div
                  className="payoff-bar"
                  style={{ height: `${state.height}%` }}
                >
                  <span>{state.amount}</span>
                </div>
              </div>
              <small>{state.label}</small>
            </div>
          ))}
        </div>
        <div className="plot-note">
          <ShieldCheck size={15} />
          <span>
            {studioProjection.qualification.reviewedCompilation.certificate.resolutionStateCount}{" "}
            synthetic resolution states checked with adverse rounding.
          </span>
          <code>
            cert {studioProjection.qualification.reviewedCompilation.certificate.id.slice(7, 14)}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}

function VerificationTrace() {
  const studioProjection = useStudioProjection();
  return (
    <Card className="trace-card">
      <CardHeader>
        <div>
          <span className="eyebrow">Independent verifier</span>
          <h2>Decision trace</h2>
        </div>
        <Fingerprint size={19} className="muted-icon" />
      </CardHeader>
      <CardContent className="trace-list">
        {studioProjection.trace.map(([title, verdict, detail], index) => (
          <div className="trace-row" key={title}>
            <div
              className={cn(
                "trace-index",
                verdict === "BLOCKED" && "is-blocked",
              )}
            >
              {verdict === "BLOCKED" ? (
                <CircleOff size={12} />
              ) : (
                index + 1
              )}
            </div>
            <div>
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
            <Badge variant={verdict === "PASS" ? "verified" : "shadow"}>
              {verdict}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CapitalSilhouette() {
  const studioProjection = useStudioProjection();
  return (
    <Card>
      <CardHeader>
        <div>
          <span className="eyebrow">Synthetic qualification fixture</span>
          <h2>Compiled capital bounds</h2>
        </div>
        <Database size={19} className="muted-icon" />
      </CardHeader>
      <CardContent>
        <div className="capital-legend">
          <span>
            <i className="available" /> Unused
          </span>
          <span>
            <i className="reserved" /> Candidate bound
          </span>
          <span>
            <i className="locked" /> Unresolved
          </span>
        </div>
        <div className="capital-list">
          {studioProjection.capital.map((item) => (
            <div className="capital-row" key={item.venue}>
              <div>
                <strong>{item.venue}</strong>
                <span>{item.reserved}% fixture-bound</span>
              </div>
              <div className="capital-bar" aria-label={`${item.venue} capital`}>
                <span
                  className="available"
                  style={{ width: `${item.available}%` }}
                />
                <span
                  className="reserved"
                  style={{ width: `${item.reserved}%` }}
                />
                <span
                  className="locked"
                  style={{ width: `${item.locked}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Overview({
  onInspect,
}: {
  onInspect: (opportunity: Opportunity) => void;
}) {
  const studioProjection = useStudioProjection();
  const catalogContext =
    studioProjection.ai.catalogContext ?? EMPTY_CATALOG_CONTEXT;
  const catalogObservation = studioProjection.ai.catalogObservation;
  const [scoutStatus, setScoutStatus] = useState<
    "IDLE" | "RUNNING" | "PROPOSED" | "FAILED"
  >("IDLE");
  const [refreshStatus, setRefreshStatus] = useState<
    "IDLE" | "RUNNING" | "READY" | "DEGRADED" | "FAILED"
  >("IDLE");

  async function runScout(): Promise<void> {
    setScoutStatus("RUNNING");
    try {
      await requestDiscoveryRun(
        "Highest temperature in Boston on July 31, 2026?",
        ["gemini-predictions"],
      );
      setScoutStatus("PROPOSED");
    } catch {
      setScoutStatus("FAILED");
    }
  }

  async function refreshCatalog(): Promise<void> {
    setRefreshStatus("RUNNING");
    try {
      setRefreshStatus(await requestCatalogRefresh());
    } catch {
      setRefreshStatus("FAILED");
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <Badge variant="verified">
            <Activity size={10} />
            Evidence current
          </Badge>
          <h1>
            Cross-venue truth,
            <br />
            <span>before execution.</span>
          </h1>
          <p>
            Let fast scouts search subjectively, then normalize contract
            meaning and prove the payoff floor—without granting a browser or
            model the authority to trade.
          </p>
        </div>
        <div className="hero-identity">
          <span className="identity-kicker">
            <Hexagon size={13} />
            Projection identity
          </span>
          <code>{studioProjection.identity.stateHash}</code>
          <div>
            <Badge variant="muted">{studioProjection.identity.mode}</Badge>
            <span>pmh.studio-projection.v1</span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="System metrics">
        <Metric
          label="Venue families"
          value={`${studioProjection.system.observedVenueFamilies}`}
          detail="official-source census"
        />
        <Metric
          label="Catalog adapters"
          value={`${studioProjection.system.catalogAdapters}`}
          detail={`${studioProjection.system.realtimeBookAdapters} books · ${studioProjection.system.inertOrderGateways} inert gates`}
        />
        <Metric
          label="Proof tests"
          value={`${studioProjection.system.proofTests}`}
          detail="all passing"
        />
        <Metric label="Live execution" value="OFF" detail="hard policy" />
      </section>

      <section className="ai-rack" aria-label="AI discovery workers">
        <div className="ai-rack-heading">
          <div className="ai-rack-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="eyebrow">Scout then verify</span>
            <strong>Subjective discovery pool</strong>
          </div>
        </div>
        <div className="worker-chips">
          {studioProjection.ai.workers.map((worker) => (
            <span key={worker.workerId}>
              <i className={worker.status === "READY" ? "is-ready" : ""} />
              {worker.workerId}
              <small>{worker.status.replaceAll("_", " ")}</small>
            </span>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={scoutStatus === "RUNNING"}
            onClick={() => void runScout()}
          >
            <Sparkles size={11} />
            {scoutStatus === "RUNNING"
              ? "Scouting…"
              : scoutStatus === "PROPOSED"
                ? "Proposal ready"
                : scoutStatus === "FAILED"
                  ? "Retry scout"
                  : "Run scout"}
          </Button>
        </div>
        <div className="ai-boundary">
          <Gauge size={14} />
          <span>
            {studioProjection.ai.modelProvider.model} · max{" "}
            {studioProjection.ai.modelProvider.maxOutputTokens} output tokens ·{" "}
            {studioProjection.ai.modelProvider.timeoutMs / 1_000}s · {" "}
            {studioProjection.ai.modelProvider.transport.replaceAll("_", " ")}
            {" · "}
            {studioProjection.ai.modelProvider.responseStorage === false
              ? "responses not stored"
              : "provider retention policy"}
          </span>
        </div>
        <div className="ai-boundary">
          <SquareTerminal size={14} />
          <span>
            pi investigator · {studioProjection.ai.investigator.model} ·{" "}
            {studioProjection.ai.investigator.mode.replaceAll("_", " ")} ·{" "}
            {studioProjection.ai.investigator.tools.join("/")} only ·{" "}
            {studioProjection.ai.investigator.configured
              ? "READY"
              : "NEEDS KEY"}
          </span>
        </div>
        <div className="ai-boundary">
          <Database size={14} />
          <span>
            {catalogContext.listingCount} listings · {catalogContext.venueCount}{" "}
            venues · {catalogContext.sourceFixtureCount} verified fixtures ·
            context {catalogContext.corpusIdentity.slice(7, 14)}
          </span>
        </div>
        <div className="ai-boundary">
          <Radio size={14} />
          <span>
            live catalog observation · {catalogObservation.listingCount} listings
            · {catalogObservation.healthySourceCount}/{catalogObservation.sourceCount}{" "}
            sources · {catalogObservation.status} · {catalogObservation.storage.mode}
            {catalogObservation.storage.durable
              ? ` v${catalogObservation.storage.schemaVersion}`
              : ""}{" "}
            · OBSERVE ONLY
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={refreshStatus === "RUNNING"}
            onClick={() => void refreshCatalog()}
          >
            <RefreshCw size={11} />
            {refreshStatus === "RUNNING"
              ? "Refreshing…"
              : refreshStatus === "FAILED"
                ? "Retry refresh"
                : "Refresh catalogs"}
          </Button>
        </div>
        <div className="ai-boundary">
          <ShieldCheck size={14} />
          <span>{studioProjection.ai.promotionBoundary}</span>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Verifier output · synthetic fixture</span>
            <h2>Bounded opportunities</h2>
          </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const firstOpportunity = studioProjection.opportunities[0];
                if (firstOpportunity !== undefined) {
                  onInspect(firstOpportunity);
                }
              }}
            >
            <Play size={13} />
            Replay fixture
          </Button>
        </div>
        <div className="opportunity-list">
          {studioProjection.opportunities.map((opportunity) => (
            <OpportunityRow
              key={opportunity.id}
              opportunity={opportunity}
              onInspect={onInspect}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <PayoffFloor />
        <VerificationTrace />
        <CapitalSilhouette />
      </section>
    </>
  );
}

function confidenceLabel(confidenceBps: number): string {
  const whole = Math.floor(confidenceBps / 100);
  const fraction = String(confidenceBps % 100).padStart(2, "0");
  return `${whole}.${fraction}%`;
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function similarityLabel(scoreBps: number): string {
  return `${Math.floor(scoreBps / 100)}.${String(scoreBps % 100).padStart(2, "0")}%`;
}

function unitCostLabel(value: string, scale: string): string {
  const amount = BigInt(value);
  const units = BigInt(scale);
  const tenThousandths = (amount * 10_000n) / units;
  return `${tenThousandths / 10_000n}.${String(tenThousandths % 10_000n).padStart(4, "0")}`;
}

function edgeLabel(value: string): string {
  const bps = BigInt(value);
  return `${bps > 0n ? "+" : ""}${bps} bp`;
}

function RealCandidatePreflightView() {
  const studioProjection = useStudioProjection();
  const preflight = studioProjection.qualification.realCandidatePreflight;
  const depth = studioProjection.qualification.realCandidateDepth;
  const disposition =
    studioProjection.qualification.realCandidateDisposition;
  if (preflight === null || preflight === undefined) {
    return (
      <section className="page-section preflight-page">
        <div className="page-heading">
          <span className="eyebrow">Immutable fixture screen</span>
          <h1>Candidate preflight</h1>
          <p>
            The real-fixture preflight is unavailable in this projection. The
            control plane must load its content-addressed evidence before this
            desk can render.
          </p>
        </div>
        <div className="preflight-empty">
          <CircleOff size={22} />
          <strong>Evidence not loaded</strong>
        </div>
      </section>
    );
  }
  const indicatedPositive = BigInt(preflight.catalogIndicativeGrossFloor) > 0n;
  const currentStages = disposition?.stages ?? depth?.stages ?? preflight.stages;
  const currentBlockers =
    disposition?.rejectionReasons ?? depth?.blockers ?? preflight.blockers;

  return (
    <section className="page-section preflight-page">
      <div className="page-heading preflight-heading">
        <div>
          <span className="eyebrow">Real fixtures · fail-closed economics</span>
          <h1>Candidate preflight</h1>
          <p>
            One exact three-venue claim map produces a tempting catalog hint.
            Repricing the same two legs at venue-reported quotes removes the
            gross floor; replaying anonymous books at a common five-share size
            confirms zero edge before fees. The current snapshot is rejected
            deterministically before review or exact verification.
          </p>
        </div>
        <Badge variant="shadow">
          <CircleOff size={11} />
          {(disposition?.classification ?? preflight.status).replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="metric-grid preflight-summary-grid">
        <Metric
          label="Exact claim map"
          value={`${preflight.exactVenueCount} venues`}
          detail="identical rules · binary partition"
        />
        <Metric
          label="Catalog hint"
          value={edgeLabel(preflight.catalogIndicativeGrossEdgeBps)}
          detail="gross · before fees and quantity"
        />
        <Metric
          label="Reported buy floor"
          value={edgeLabel(preflight.venueReportedBuyGrossEdgeBps)}
          detail="same two outcomes · top-level screen"
        />
        <Metric
          label="Exact verifier"
          value={preflight.verifierInvoked ? "RUN" : "NOT RUN"}
          detail="prerequisites fail closed"
        />
      </div>

      {disposition !== null && disposition !== undefined && (
        <div className="preflight-disposition">
          <div className="preflight-disposition-mark">
            <CircleOff size={19} />
          </div>
          <div className="preflight-disposition-copy">
            <span>Deterministic snapshot disposition</span>
            <strong>Rejected before scarce review work</strong>
            <p>
              The quantity-bound gross floor is already non-positive. An
              official non-negative sell-taker fee cannot restore strict
              positivity, so this exact book snapshot leaves the pipeline.
            </p>
          </div>
          <div className="preflight-disposition-facts">
            <div>
              <span>Post-fee upper bound</span>
              <strong>
                {unitCostLabel(
                  disposition.postFeeFloorUpperBound,
                  disposition.quantityScale,
                )}
              </strong>
            </div>
            <div>
              <span>Sell taker range</span>
              <strong>
                {disposition.feeEvidence.minimumSellTakerFeeBps}–
                {disposition.feeEvidence.maximumSellTakerFeeBps} bp
              </strong>
            </div>
            <div>
              <span>New books</span>
              <strong>
                {disposition.rescreenRequiredOnBookChange
                  ? "RESCREEN"
                  : "TERMINAL"}
              </strong>
            </div>
          </div>
          <code>{disposition.artifactHash}</code>
        </div>
      )}

      <div className="preflight-claim-strip">
        <GitBranch size={15} />
        <div>
          <span>Canonical claim</span>
          <strong>{preflight.canonicalTitle}</strong>
        </div>
        <code>{preflight.claimIdentity}</code>
      </div>

      <div className="preflight-comparison-grid">
        <Card className="preflight-signal-card is-hint">
          <CardHeader>
            <div>
              <span className="eyebrow">Catalog indicative screen</span>
              <h2>A 55 bp search hint</h2>
            </div>
            <Badge variant={indicatedPositive ? "verified" : "shadow"}>
              SCREEN ONLY
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="preflight-total">
              <span>Complete payout cost</span>
              <strong>
                {unitCostLabel(
                  preflight.catalogIndicativeTotalCost,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <div className="preflight-floor is-positive">
              <Activity size={14} />
              <span>Gross floor</span>
              <strong>
                {unitCostLabel(
                  preflight.catalogIndicativeGrossFloor,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <p>
              Catalog prices carry no executable quantity, book generation, or
              complete fee schedule. Positive here means “inspect next,” not
              arbitrage.
            </p>
          </CardContent>
        </Card>

        <Card className="preflight-signal-card is-stopped">
          <CardHeader>
            <div>
              <span className="eyebrow">Venue-reported buy screen</span>
              <h2>The edge disappears</h2>
            </div>
            <Badge variant="shadow">STOP</Badge>
          </CardHeader>
          <CardContent>
            <div className="preflight-total">
              <span>Complete payout cost</span>
              <strong>
                {unitCostLabel(
                  preflight.venueReportedBuyTotalCost,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <div className="preflight-floor">
              <CircleOff size={14} />
              <span>Gross floor</span>
              <strong>
                {unitCostLabel(
                  preflight.venueReportedBuyGrossFloor,
                  preflight.payoutScale,
                )}
              </strong>
            </div>
            <p>
              The two venue-reported buy costs consume the full unit payout.
              The quantity-bound book replay below confirms the same result.
            </p>
          </CardContent>
        </Card>
      </div>

      {depth !== null && depth !== undefined && (
        <Card className="preflight-depth-card">
          <CardHeader>
            <div>
              <span className="eyebrow">Anonymous books · quantity-bound replay</span>
              <h2>Five shares still land at zero gross edge</h2>
            </div>
            <div className="preflight-depth-badges">
              <Badge variant="verified">QUANTITY BOUND</Badge>
              <Badge variant="shadow">NOT A CERTIFICATE</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="preflight-depth-summary">
              <div>
                <span>Screen quantity</span>
                <strong>
                  {unitCostLabel(depth.screenQuantity, depth.quantityScale)}
                </strong>
                <small>complete-payout shares</small>
              </div>
              <div>
                <span>Total before fees</span>
                <strong>
                  {unitCostLabel(depth.totalCostBeforeFees, depth.priceScale)}
                </strong>
                <small>full collateral consumed</small>
              </div>
              <div>
                <span>Depth-bound floor</span>
                <strong>
                  {edgeLabel(depth.grossEdgeBpsBeforeFees)}
                </strong>
                <small>fees can only reduce it</small>
              </div>
            </div>

            <div className="preflight-depth-route">
              <article>
                <div className="preflight-route-index">01</div>
                <div>
                  <span>Polymarket · YES</span>
                  <strong>Direct buy</strong>
                  <p>
                    Buy {unitCostLabel(depth.legs[0]?.quantity ?? "0", depth.quantityScale)}
                    {" "}shares at a marginal {unitCostLabel(depth.legs[0]?.marginalPrice ?? "0", depth.priceScale)}.
                  </p>
                </div>
                <code>
                  −{unitCostLabel(depth.legs[0]?.effectiveCost ?? "0", depth.priceScale)}
                </code>
              </article>
              <ChevronRight size={17} />
              <article>
                <div className="preflight-route-index">02</div>
                <div>
                  <span>Limitless · NO</span>
                  <strong>Complete pair → sell YES</strong>
                  <p>
                    Simulate {unitCostLabel(depth.legs[1]?.collateralIn ?? "0", depth.priceScale)}
                    {" "}collateral in, then sell YES for {unitCostLabel(depth.legs[1]?.proceeds ?? "0", depth.priceScale)}.
                  </p>
                </div>
                <code>
                  −{unitCostLabel(depth.legs[1]?.effectiveCost ?? "0", depth.priceScale)}
                </code>
              </article>
              <ChevronRight size={17} />
              <article className="is-stopped">
                <div className="preflight-route-index"><CircleOff size={11} /></div>
                <div>
                  <span>Complete payout</span>
                  <strong>Economics stop</strong>
                  <p>Gross floor is zero before the unbound dynamic taker fee.</p>
                </div>
                <code>{edgeLabel(depth.grossEdgeBpsBeforeFees)}</code>
              </article>
            </div>

            <div className="preflight-book-binding-grid">
              {depth.books.map((book) => (
                <div key={book.venueId}>
                  <BookOpenCheck size={13} />
                  <div>
                    <span>{book.venueId}</span>
                    <strong>
                      {book.venueGeneration === null
                        ? "receive-time binding only"
                        : `generation ${book.venueGeneration.slice(0, 12)}…`}
                    </strong>
                  </div>
                  <code>{book.sourceFixtureHash.slice(0, 22)}…</code>
                </div>
              ))}
            </div>

            <div className="preflight-depth-warning">
              <ShieldCheck size={14} />
              <p>
                The Limitless route is simulated only. No complete-set split,
                token approval, signature, order, or value-moving call was made.
                Its REST book also exposes no venue generation identity.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="preflight-leg-grid">
        {preflight.legs.map((leg) => (
          <article className="preflight-leg" key={`${leg.venueId}:${leg.outcome}`}>
            <div className="preflight-leg-head">
              <div>
                <Badge variant={leg.outcome === "YES" ? "verified" : "shadow"}>
                  {leg.outcome}
                </Badge>
                <span>{leg.venueId}</span>
              </div>
              <code>{leg.venueId}:{leg.listingId}</code>
            </div>
            <div className="preflight-leg-prices">
              <div>
                <span>Catalog</span>
                <strong>
                  {unitCostLabel(leg.catalogIndicativeCost, preflight.payoutScale)}
                </strong>
              </div>
              <ChevronRight size={16} />
              <div>
                <span>Reported buy</span>
                <strong>
                  {unitCostLabel(leg.venueReportedBuyCost, preflight.payoutScale)}
                </strong>
              </div>
            </div>
            <div className="preflight-leg-source">
              <Fingerprint size={11} />
              <span>{leg.venueReportedBuyKind.replaceAll("_", " ")}</span>
              <code>{leg.sourceFixtureHash.slice(0, 24)}…</code>
            </div>
          </article>
        ))}
      </div>

      <div className="preflight-detail-grid">
        <Card>
          <CardHeader>
            <div>
              <span className="eyebrow">Qualification trace</span>
              <h2>Where the candidate stops</h2>
            </div>
            <FileCheck2 size={18} className="muted-icon" />
          </CardHeader>
          <CardContent className="preflight-stage-list">
            {currentStages.map((stage, index) => (
              <div className="preflight-stage" key={stage.stage}>
                <span className={stage.status === "PASS" ? "" : "is-blocked"}>
                  {stage.status === "PASS" ? index + 1 : <CircleOff size={11} />}
                </span>
                <div>
                  <strong>{stage.stage.replaceAll("_", " ")}</strong>
                  <small>{stage.detail}</small>
                </div>
                <Badge variant={stage.status === "PASS" ? "verified" : "shadow"}>
                  {stage.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <span className="eyebrow">Fail-closed intake</span>
              <h2>
                {disposition === null || disposition === undefined
                  ? "Required before verification"
                  : "Why this snapshot is rejected"}
              </h2>
            </div>
            <CircleOff size={18} className="muted-icon" />
          </CardHeader>
          <CardContent className="preflight-blocker-list">
            {currentBlockers.map((blocker, index) => (
              <div className="preflight-blocker" key={blocker.code}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{blocker.code.replaceAll("_", " ")}</strong>
                  <p>{blocker.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="case-authority-lock preflight-authority-lock">
        <ShieldCheck size={15} />
        <span>
          This disposition rejects only the bound book snapshot. It is not a
          permanent market judgment, arbitrage certificate, or trading authority;
          changed books require a fresh screen.
        </span>
        <code>
          {disposition?.artifactHash ?? depth?.artifactHash ?? preflight.artifactHash}
        </code>
      </div>
    </section>
  );
}

function OpportunityRadarView() {
  const studioProjection = useStudioProjection();
  const radar =
    studioProjection.ai.opportunityRadar ?? EMPTY_OPPORTUNITY_RADAR;
  const [refreshStatus, setRefreshStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "FAILED"
  >("IDLE");
  const [triageStates, setTriageStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "RESTORED" | "FAILED">>
  >({});
  const [investigationStates, setInvestigationStates] = useState<
    Readonly<Record<string, "RUNNING" | "DONE" | "RESTORED" | "FAILED">>
  >({});
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const retainedTaskIds = new Set(
    studioProjection.discoveryDesk.runs.map((run) => run.taskId),
  );
  const triagedCount = radar.candidates.filter((candidate) =>
    retainedTaskIds.has(candidate.triageTaskId),
  ).length;

  async function refreshRadar(): Promise<void> {
    setRefreshStatus("RUNNING");
    setDiagnostic(null);
    try {
      await requestCatalogRefresh();
      setRefreshStatus("DONE");
    } catch (error) {
      setRefreshStatus("FAILED");
      setDiagnostic(
        error instanceof Error ? error.message : "catalog refresh failed",
      );
    }
  }

  async function triage(candidate: RadarCandidate): Promise<void> {
    setTriageStates((current) => ({
      ...current,
      [candidate.candidateId]: "RUNNING",
    }));
    setDiagnostic(null);
    try {
      const restored = await requestRadarTriage(candidate.candidateId);
      setTriageStates((current) => ({
        ...current,
        [candidate.candidateId]: restored ? "RESTORED" : "DONE",
      }));
    } catch (error) {
      setTriageStates((current) => ({
        ...current,
        [candidate.candidateId]: "FAILED",
      }));
      setDiagnostic(
        error instanceof Error ? error.message : "radar triage failed",
      );
    }
  }

  async function investigate(candidate: RadarCandidate): Promise<void> {
    setInvestigationStates((current) => ({
      ...current,
      [candidate.candidateId]: "RUNNING",
    }));
    setDiagnostic(null);
    try {
      const restored = await requestRadarInvestigation(candidate.candidateId);
      setInvestigationStates((current) => ({
        ...current,
        [candidate.candidateId]: restored ? "RESTORED" : "DONE",
      }));
    } catch (error) {
      setInvestigationStates((current) => ({
        ...current,
        [candidate.candidateId]: "FAILED",
      }));
      setDiagnostic(
        error instanceof Error ? error.message : "radar investigation failed",
      );
    }
  }

  return (
    <section className="page-section radar-page">
      <div className="page-heading radar-heading">
        <div>
          <span className="eyebrow">Deterministic blocking · AI on demand</span>
          <h1>Opportunity radar</h1>
          <p>
            The control plane reduces fresh multi-venue catalogs into small,
            evidence-bound pairs before a cheap scout sees them. Similarity is
            a search filter—not semantic equivalence, profit, or a certificate.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={refreshStatus === "RUNNING"}
          onClick={() => void refreshRadar()}
        >
          <RefreshCw
            className={refreshStatus === "RUNNING" ? "is-spinning" : undefined}
            size={14}
          />
          {refreshStatus === "RUNNING"
            ? "Refreshing sources…"
            : refreshStatus === "DONE"
              ? "Sources refreshed"
              : refreshStatus === "FAILED"
                ? "Retry refresh"
                : "Refresh live radar"}
        </Button>
      </div>

      <div className="radar-summary-grid">
        <Metric
          label="Observed listings"
          value={`${radar.observedListingCount}`}
          detail="latest retained anonymous catalogs"
        />
        <Metric
          label="Fresh sources"
          value={`${radar.eligibleSourceCount}`}
          detail={`${radar.excludedSourceCount} excluded by freshness gate`}
        />
        <Metric
          label="Candidate pairs"
          value={`${radar.candidateCount}`}
          detail="cross-venue lexical blocks"
        />
        <Metric
          label="Scout triage"
          value={`${triagedCount}`}
          detail="retained bounded runs"
        />
      </div>

      <div className="radar-method-strip">
        <Radar size={15} />
        <span>
          Rare-term weighted overlap · incompatible cadence and exact close
          times rejected · maximum 25 pairs
        </span>
        <code>{radar.algorithmVersion}</code>
      </div>

      {diagnostic !== null && (
        <div className="radar-diagnostic" role="status">
          <CircleOff size={14} />
          <span>{diagnostic}</span>
        </div>
      )}

      {radar.candidates.length === 0 ? (
        <div className="radar-empty">
          <Radar size={28} />
          <strong>No fresh cross-venue blocks</strong>
          <span>
            Refresh the anonymous catalogs. Stale or failed sources are omitted,
            and a zero-result scan is valid.
          </span>
        </div>
      ) : (
        <div className="radar-candidate-grid">
          {radar.candidates.map((candidate, index) => {
            const localState = triageStates[candidate.candidateId];
            const retained = retainedTaskIds.has(candidate.triageTaskId);
            const running = localState === "RUNNING";
            const investigationState =
              investigationStates[candidate.candidateId];
            const investigationRecord =
              studioProjection.ai.investigationDesk.records.find(
                (record) => record.taskId === candidate.triageTaskId,
              );
            const investigating = investigationState === "RUNNING";
            return (
              <article className="radar-candidate" key={candidate.candidateId}>
                <div className="radar-candidate-head">
                  <div>
                    <span className="eyebrow">
                      Pair {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2>{candidate.sharedTerms.join(" · ")}</h2>
                  </div>
                  <div className="radar-score">
                    <strong>{similarityLabel(candidate.semanticScoreBps)}</strong>
                    <span>blocking score</span>
                  </div>
                </div>

                <div className="radar-pair">
                  {candidate.listings.map((listing, listingIndex) => (
                    <div className="radar-leg" key={listing.listingRef}>
                      <div>
                        <Badge variant={listingIndex === 0 ? "verified" : "shadow"}>
                          {listing.venueId}
                        </Badge>
                        <span>{listing.mechanism.replaceAll("_", " ")}</span>
                      </div>
                      <strong>{listing.title}</strong>
                      <code>{listing.listingRef}</code>
                      <small>
                        <Fingerprint size={10} />
                        {listing.sourceRawHash.slice(0, 22)}… ·{" "}
                        {new Date(listing.sourceReceivedAt).toLocaleTimeString()}
                      </small>
                      {listingIndex === 0 && (
                        <span className="radar-pair-link" aria-hidden="true">
                          <ChevronRight size={14} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="radar-temporal-strip">
                  <div>
                    <Activity size={13} />
                    <span>{candidate.timeframe ?? "No cadence extracted"}</span>
                  </div>
                  <div>
                    <Badge
                      variant={
                        candidate.temporalAlignment === "ALIGNED"
                          ? "verified"
                          : "warning"
                      }
                    >
                      {candidate.temporalAlignment}
                    </Badge>
                    <code>
                      {candidate.effectiveCloseAt ?? "close unresolved"}
                    </code>
                  </div>
                </div>

                <div className="radar-action-row">
                  <div>
                    <ShieldCheck size={14} />
                    <span>
                      Exact two-listing context · proposal only · no auto spend
                    </span>
                  </div>
                  <div className="radar-action-buttons">
                    <Button
                      disabled={running || studioProjection.ai.activeRuns > 0}
                      onClick={() => void triage(candidate)}
                    >
                      {running ? (
                        <RefreshCw className="is-spinning" size={14} />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {running
                        ? "Scouts triaging…"
                        : localState === "DONE"
                          ? "Triage complete"
                          : localState === "RESTORED" || retained
                            ? "Restore scout result"
                            : localState === "FAILED"
                              ? "Retry scout triage"
                              : "Triage with fast scouts"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        !retained ||
                        !studioProjection.ai.investigator.configured ||
                        studioProjection.ai.investigationDesk.activeCount > 0 ||
                        investigating
                      }
                      onClick={() => void investigate(candidate)}
                    >
                      {investigating ? (
                        <RefreshCw className="is-spinning" size={14} />
                      ) : (
                        <SquareTerminal size={14} />
                      )}
                      {investigating
                        ? "pi investigating…"
                        : investigationState === "DONE"
                          ? "pi complete"
                          : investigationState === "RESTORED" ||
                              investigationRecord?.status === "PASS"
                            ? "Restore pi report"
                            : investigationState === "FAILED" ||
                                investigationRecord?.status === "FAILED"
                              ? "Retry deep pi"
                              : "Run deep pi"}
                    </Button>
                  </div>
                </div>
                <code className="radar-candidate-id">
                  {candidate.candidateId}
                </code>
              </article>
            );
          })}
        </div>
      )}

      <div className="case-authority-lock radar-authority-lock">
        <CircleOff size={15} />
        <span>
          Radar candidates are workload routing hints. They cannot establish
          equivalent rules, compute executable profit, enter review, publish a
          certificate, or grant execution authority.
        </span>
      </div>
    </section>
  );
}

function ScoutInboxView() {
  const studioProjection = useStudioProjection();
  const catalogContext =
    studioProjection.ai.catalogContext ?? EMPTY_CATALOG_CONTEXT;
  const catalogObservation = studioProjection.ai.catalogObservation;
  const eligibleVenues = studioProjection.venues.filter((venue) =>
    venue.capabilities.includes("MARKET_CATALOG"),
  );
  const [question, setQuestion] = useState(
    "Highest temperature in Boston on July 31, 2026?",
  );
  const [selectedVenueIds, setSelectedVenueIds] = useState<readonly string[]>([
    "gemini-predictions",
  ]);
  const [catalogMode, setCatalogMode] = useState<CatalogMode>(
    "VERIFIED_FIXTURES",
  );
  const [runStatus, setRunStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [investigationStatus, setInvestigationStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [investigationDiagnostic, setInvestigationDiagnostic] = useState<
    string | null
  >(null);
  const liveContextEligible =
    catalogMode === "VERIFIED_FIXTURES" ||
    selectedVenueIds.every(
      (venueId) =>
        catalogObservation.sources.find((source) => source.venueId === venueId)
          ?.contextEligible === true,
    );

  function toggleVenue(venueId: string): void {
    setSelectedVenueIds((current) =>
      current.includes(venueId)
        ? current.filter((item) => item !== venueId)
        : [...current, venueId],
    );
  }

  async function submitScout(): Promise<void> {
    setRunStatus("RUNNING");
    try {
      const restored = await requestDiscoveryRun(
        question.trim(),
        selectedVenueIds,
        catalogMode,
      );
      setRunStatus(restored ? "RESTORED" : "DONE");
    } catch {
      setRunStatus("FAILED");
    }
  }

  async function submitInvestigation(): Promise<void> {
    setInvestigationStatus("RUNNING");
    setInvestigationDiagnostic(null);
    try {
      const restored = await requestInvestigation(
        question.trim(),
        selectedVenueIds,
        catalogMode,
      );
      setInvestigationStatus(restored ? "RESTORED" : "DONE");
    } catch (error) {
      setInvestigationStatus("FAILED");
      setInvestigationDiagnostic(
        error instanceof Error ? error.message : "pi investigation failed",
      );
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading scout-heading">
        <span className="eyebrow">Subjective search · bounded authority</span>
        <h1>Scout inbox</h1>
        <p>
          Cheap workers can broaden the search surface and suggest semantic
          connections. Every result lands here as an unreviewed proposal; none
          can become a claim link, certificate, or order by itself.
        </p>
      </div>

      <div className="scout-summary-grid">
        <Metric
          label="Retained runs"
          value={`${studioProjection.discoveryDesk.runCount}`}
          detail={`bounded to ${studioProjection.discoveryDesk.retentionLimit}`}
        />
        <Metric
          label="Hypotheses"
          value={`${studioProjection.discoveryDesk.hypothesisCount}`}
          detail="deduplicated per run"
        />
        <Metric
          label="Awaiting review"
          value={`${studioProjection.discoveryDesk.unreviewedCount}`}
          detail="independent authority required"
        />
        <Metric
          label="Catalog facts"
          value={`${catalogContext.listingCount}`}
          detail={`${catalogContext.venueCount} venues · verified fixtures`}
        />
        <Metric
          label="Live observed"
          value={`${catalogObservation.listingCount}`}
          detail={`${catalogObservation.contextQualification.eligibleSourceCount}/${catalogObservation.sourceCount} context eligible · explicit only`}
        />
        <Metric
          label="State store"
          value={studioProjection.discoveryDesk.storage.durable ? "WAL" : "MEM"}
          detail={
            studioProjection.discoveryDesk.storage.durable
              ? `schema v${studioProjection.discoveryDesk.storage.schemaVersion} · taskId idempotency`
              : "ephemeral test process"
          }
        />
        <Metric
          label="Deep reports"
          value={`${studioProjection.ai.investigationDesk.passCount}`}
          detail={`${studioProjection.ai.investigationDesk.activeCount} running · ${studioProjection.ai.investigationDesk.storage.durable ? "durable WAL" : "memory only"}`}
        />
      </div>

      <Card className="review-pipeline-card">
        <CardHeader>
          <div>
            <span className="eyebrow">Promotion contract · fixture-qualified</span>
            <h2>Review → compiler → exact verifier</h2>
          </div>
          <Badge variant="verified">
            {studioProjection.qualification.reviewedCompilation.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="review-pipeline-flow">
            {studioProjection.qualification.reviewedCompilation.stages.map(
              (stage, index) => (
                <div className="review-pipeline-stage" key={stage.stage}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{stage.stage.replaceAll("_", " ")}</strong>
                    <small>{stage.detail}</small>
                  </div>
                  <Badge
                    variant={stage.status === "PASS" ? "verified" : "shadow"}
                  >
                    {stage.status}
                  </Badge>
                </div>
              ),
            )}
          </div>
          <div className="review-pipeline-note">
            <TestTubeDiagonal size={14} />
            <span>
              This path is exercised with a synthetic, hash-bound qualification
              fixture. Runtime scout hypotheses remain locked until a real
              equivalence-review authority and official matching fixtures exist.
            </span>
            <code>
              {studioProjection.qualification.reviewedCompilation.artifactHash}
            </code>
          </div>
        </CardContent>
      </Card>

      <div className="scout-layout">
        <Card className="scout-compose-card">
          <CardHeader>
            <div>
              <span className="eyebrow">New bounded task</span>
              <h2>Ask the scout pool</h2>
            </div>
            <Badge variant="shadow">No execution</Badge>
          </CardHeader>
          <CardContent>
            <label className="scout-question">
              <span>Research question</span>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                rows={5}
              />
              <small>{question.length} / 500</small>
            </label>
            <fieldset className="venue-selector evidence-selector">
              <legend>Catalog evidence source</legend>
              <div>
                <button
                  type="button"
                  className={cn(
                    catalogMode === "VERIFIED_FIXTURES" && "is-selected",
                  )}
                  onClick={() => setCatalogMode("VERIFIED_FIXTURES")}
                >
                  <FileCheck2 size={12} />
                  Verified fixtures · default
                </button>
                <button
                  type="button"
                  className={cn(
                    catalogMode === "CURRENT_OBSERVATIONS" && "is-selected",
                  )}
                  onClick={() => setCatalogMode("CURRENT_OBSERVATIONS")}
                >
                  <Radio size={12} />
                  Current observations · explicit
                </button>
              </div>
            </fieldset>
            <fieldset className="venue-selector">
              <legend>Search venue catalogs</legend>
              <div>
                {eligibleVenues.map((venue) => (
                  <button
                    type="button"
                    className={cn(
                      selectedVenueIds.includes(venue.id) && "is-selected",
                    )}
                    key={venue.id}
                    onClick={() => toggleVenue(venue.id)}
                  >
                    <i style={{ backgroundColor: venue.color }} />
                    {venue.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="scout-action-stack">
              <Button
                className="scout-submit"
                disabled={
                  runStatus === "RUNNING" ||
                  question.trim() === "" ||
                  selectedVenueIds.length === 0 ||
                  !liveContextEligible
                }
                onClick={() => void submitScout()}
              >
                <Send size={14} />
                {runStatus === "RUNNING"
                  ? "Scouts running…"
                  : runStatus === "DONE"
                    ? "Run another scout"
                    : runStatus === "RESTORED"
                      ? "Restored existing run"
                      : runStatus === "FAILED"
                        ? "Retry scout"
                        : "Run bounded scout"}
              </Button>
              <Button
                variant="outline"
                disabled={
                  !studioProjection.ai.investigator.configured ||
                  studioProjection.ai.investigationDesk.activeCount > 0 ||
                  investigationStatus === "RUNNING" ||
                  question.trim() === "" ||
                  selectedVenueIds.length === 0 ||
                  !liveContextEligible
                }
                onClick={() => void submitInvestigation()}
              >
                {investigationStatus === "RUNNING" ||
                studioProjection.ai.investigationDesk.activeCount > 0 ? (
                  <RefreshCw className="is-spinning" size={14} />
                ) : (
                  <SquareTerminal size={14} />
                )}
                {!studioProjection.ai.investigator.configured
                  ? "Deep investigator needs key"
                  : investigationStatus === "RUNNING" ||
                      studioProjection.ai.investigationDesk.activeCount > 0
                    ? "pi investigating…"
                    : investigationStatus === "DONE"
                      ? "Run another investigation"
                      : investigationStatus === "RESTORED"
                        ? "Restored existing report"
                        : investigationStatus === "FAILED"
                          ? "Retry investigation"
                          : "Run deep investigation"}
              </Button>
            </div>
            <div className="investigation-note">
              <SquareTerminal size={14} />
              <span>
                One read-only pi task at a time · allow up to five minutes ·
                completed reports are{" "}
                {studioProjection.ai.investigationDesk.storage.durable
                  ? "hash-checked and retained in SQLite WAL"
                  : "retained in process memory only"}
                .
                {investigationDiagnostic !== null && (
                  <strong>{investigationDiagnostic}</strong>
                )}
                {!liveContextEligible && (
                  <strong>
                    Selected live source is stale, empty, or failed; refresh it
                    before running AI.
                  </strong>
                )}
              </span>
            </div>
            <div className="scout-guardrail">
              <ShieldCheck size={15} />
              <span>{studioProjection.ai.promotionBoundary}</span>
            </div>
          </CardContent>
        </Card>

        <div className="scout-results-stack">
          <div className="investigation-desk">
            <div className="scout-run-heading">
              <div>
                <span className="eyebrow">Read-only agent lane</span>
                <h2>pi investigation desk</h2>
              </div>
              <div className="investigation-desk-status">
                <Badge
                  variant={
                    studioProjection.ai.investigationDesk.activeCount > 0
                      ? "shadow"
                      : "muted"
                  }
                >
                  {studioProjection.ai.investigationDesk.activeCount > 0
                    ? "RUNNING"
                    : `${studioProjection.ai.investigationDesk.passCount} PASS`}
                </Badge>
                <Badge variant="muted">
                  {studioProjection.ai.investigationDesk.storage.durable
                    ? `WAL v${studioProjection.ai.investigationDesk.storage.schemaVersion}`
                    : "MEMORY"}
                </Badge>
              </div>
            </div>
            {studioProjection.ai.investigationDesk.records.length === 0 ? (
              <div className="investigation-empty">
                No deep reports yet. This lane can read the bounded catalog and
                repository context, but cannot review or execute anything.
              </div>
            ) : (
              studioProjection.ai.investigationDesk.records.map((record) => (
                <article
                  className={cn(
                    "investigation-record",
                    `is-${record.status.toLowerCase()}`,
                  )}
                  key={record.investigationId}
                >
                  <div className="investigation-record-head">
                    <div>
                      <Badge
                        variant={record.status === "PASS" ? "verified" : "shadow"}
                      >
                        {record.status}
                      </Badge>
                      <Badge variant="muted">{record.authority}</Badge>
                      <Badge variant="muted">{record.reviewStatus}</Badge>
                      <Badge variant="muted">
                        {record.catalogContextSource ??
                          "VERIFIED_FIXTURE_CATALOGS"}
                      </Badge>
                    </div>
                    <time>{new Date(record.startedAt).toLocaleString()}</time>
                  </div>
                  <h3>{record.question}</h3>
                  {record.status === "RUNNING" && (
                    <p className="investigation-progress">
                      <RefreshCw className="is-spinning" size={13} />
                      pi is reading bounded evidence and composing a final report…
                    </p>
                  )}
                  {record.status === "FAILED" && (
                    <p className="investigation-diagnostic">
                      {record.diagnostic ?? "pi investigator failed"}
                    </p>
                  )}
                  {record.report !== null && (
                    <>
                      <p className="investigation-summary">
                        {record.report.result.summary}
                      </p>
                      <dl className="investigation-findings">
                        <div>
                          <dt>Candidate listings</dt>
                          <dd>
                            {record.report.result.candidateListingRefs.join(" · ") ||
                              "none"}
                          </dd>
                        </div>
                        <div>
                          <dt>Missing evidence</dt>
                          <dd>
                            {record.report.result.missingEvidence.join(" · ") ||
                              "none"}
                          </dd>
                        </div>
                      </dl>
                      {record.report.result.findings.map((finding, index) => (
                        <div
                          className="investigation-finding"
                          key={`${record.investigationId}:${index}`}
                        >
                          <Badge variant="muted">{finding.severity}</Badge>
                          <span>{finding.statement}</span>
                          <code>
                            {finding.listingRefs.join(" · ") || "scope-wide"}
                          </code>
                        </div>
                      ))}
                      <code className="investigation-artifact">
                        {record.report.artifactHash}
                      </code>
                    </>
                  )}
                </article>
              ))
            )}
          </div>

          <div className="scout-run-list">
            <div className="scout-run-heading">
              <div>
                <span className="eyebrow">Proposal queue</span>
                <h2>Unreviewed hypotheses</h2>
              </div>
              <Badge variant="muted">
                {studioProjection.discoveryDesk.unreviewedCount} waiting
              </Badge>
            </div>
          {studioProjection.discoveryDesk.runs.length === 0 ? (
            <div className="scout-empty">
              <Inbox size={24} />
              <strong>No scout runs yet</strong>
              <span>Submit a bounded task to populate the audit trail.</span>
            </div>
          ) : (
            studioProjection.discoveryDesk.runs.map((run) => (
              <article className="scout-run" key={run.runId}>
                <div className="scout-run-meta">
                  <div>
                    <span>{run.runId}</span>
                    <time>{new Date(run.completedAt).toLocaleString()}</time>
                  </div>
                  <Badge variant="muted">{run.workerIds.join(" + ")}</Badge>
                  {run.catalogContextIdentity !== undefined && (
                    <Badge variant="muted">
                      {run.catalogListingCount} listings ·{" "}
                      {run.catalogContextIdentity.slice(7, 14)}
                    </Badge>
                  )}
                  {run.catalogContextSource !== undefined && (
                    <Badge variant="muted">
                      {run.catalogContextSource.replaceAll("_", " ")}
                    </Badge>
                  )}
                </div>
                <h3>{run.question}</h3>
                <div className="scout-venue-row">
                  {run.venueIds.map((venueId) => (
                    <span key={venueId}>{venueId}</span>
                  ))}
                </div>
                {run.hypotheses.map((hypothesis) => (
                  <div className="hypothesis-card" key={hypothesis.hypothesisId}>
                    <div className="hypothesis-topline">
                      <Badge variant="shadow">{hypothesis.authority}</Badge>
                      <Badge variant="muted">{hypothesis.reviewStatus}</Badge>
                      <span>{confidenceLabel(hypothesis.confidenceBps)} scout confidence</span>
                    </div>
                    <p>{hypothesis.thesis}</p>
                    <dl>
                      <div>
                        <dt>Strategy shape</dt>
                        <dd>{hypothesis.strategyKind.replaceAll("_", " ")}</dd>
                      </div>
                      <div>
                        <dt>Search terms</dt>
                        <dd>{hypothesis.claimSearchTerms.join(" · ") || "none"}</dd>
                      </div>
                      <div>
                        <dt>Grounded listings</dt>
                        <dd className="grounded-listings">
                          {(hypothesis.listingRefs ?? []).join(" · ") || "none"}
                        </dd>
                      </div>
                    </dl>
                    <div className="promotion-lock">
                      <CircleOff size={13} />
                      Runtime equivalence review is not configured; promotion is locked.
                    </div>
                  </div>
                ))}
              </article>
            ))
          )}
          </div>
        </div>
      </div>
    </section>
  );
}

function caseBadgeVariant(status: ResearchCase["status"]) {
  if (status === "EVIDENCE_GAPS") return "warning" as const;
  if (status === "INVESTIGATING" || status === "AWAITING_REVIEW") {
    return "shadow" as const;
  }
  return "muted" as const;
}

function ResearchCaseDeskView() {
  const studioProjection = useStudioProjection();
  const researchDesk = studioProjection.ai.researchDesk;
  const [selectedCaseId, setSelectedCaseId] = useState(
    researchDesk.cases[0]?.caseId ?? "",
  );
  const [caseInvestigationState, setCaseInvestigationState] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");
  const [caseInvestigationDiagnostic, setCaseInvestigationDiagnostic] =
    useState<string | null>(null);
  const selectedCase =
    researchDesk.cases.find((item) => item.caseId === selectedCaseId) ??
    researchDesk.cases[0];

  useEffect(() => {
    if (
      researchDesk.cases.length > 0 &&
      !researchDesk.cases.some((item) => item.caseId === selectedCaseId)
    ) {
      setSelectedCaseId(researchDesk.cases[0]?.caseId ?? "");
    }
  }, [researchDesk.cases, selectedCaseId]);

  useEffect(() => {
    setCaseInvestigationState("IDLE");
    setCaseInvestigationDiagnostic(null);
  }, [selectedCaseId]);

  async function investigateSelectedCase(): Promise<void> {
    const taskId = selectedCase?.scout.taskId;
    if (taskId === null || taskId === undefined) return;
    setCaseInvestigationState("RUNNING");
    setCaseInvestigationDiagnostic(null);
    try {
      const restored = await requestResearchCaseInvestigation(taskId);
      setCaseInvestigationState(restored ? "RESTORED" : "DONE");
    } catch (error) {
      setCaseInvestigationState("FAILED");
      setCaseInvestigationDiagnostic(
        error instanceof Error ? error.message : "case investigation failed",
      );
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading case-heading">
        <span className="eyebrow">Joined research state · no promotion</span>
        <h1>Research case desk</h1>
        <p>
          One deterministic dossier joins scout proposals, read-only pi retries,
          candidate listings, and unresolved evidence for the same bounded
          catalog context. Presence is not approval: independent review,
          compilation, and exact verification remain blocked.
        </p>
      </div>

      <div className="case-summary-grid">
        <Metric
          label="Open cases"
          value={`${researchDesk.caseCount}`}
          detail="bounded operational dossiers"
        />
        <Metric
          label="Investigating"
          value={`${researchDesk.activeCount}`}
          detail="read-only pi currently running"
        />
        <Metric
          label="Evidence gaps"
          value={`${researchDesk.evidenceGapCount}`}
          detail="passed intake · facts still missing"
        />
        <Metric
          label="Needs context"
          value={`${researchDesk.needsContextCount}`}
          detail="legacy or ungrounded scout runs"
        />
        <Metric
          label="Needs pi"
          value={`${researchDesk.needsInvestigationCount}`}
          detail="scout leads without deep intake"
        />
        <Metric
          label="Awaiting review"
          value={`${researchDesk.awaitingReviewCount}`}
          detail="review authority remains absent"
        />
      </div>

      {selectedCase === undefined ? (
        <div className="case-empty">
          <Waypoints size={26} />
          <strong>No research cases retained</strong>
          <span>Run a bounded scout or pi investigation to open a dossier.</span>
        </div>
      ) : (
        <div className="case-workbench">
          <div className="case-list" aria-label="Research case queue">
            <div className="case-list-heading">
              <span className="eyebrow">Case queue</span>
              <Badge variant="muted">{researchDesk.caseCount} retained</Badge>
            </div>
            {researchDesk.cases.map((item) => (
              <button
                type="button"
                className={cn(
                  "case-list-item",
                  item.caseId === selectedCase.caseId && "is-selected",
                )}
                key={item.caseId}
                onClick={() => setSelectedCaseId(item.caseId)}
              >
                <div>
                  <Badge variant={caseBadgeVariant(item.status)}>
                    {item.status.replaceAll("_", " ")}
                  </Badge>
                  <time>{new Date(item.updatedAt).toLocaleString()}</time>
                </div>
                <strong>{item.question}</strong>
                <span>
                  {countLabel(item.scout.hypothesisCount, "lead")} ·{" "}
                  {countLabel(item.investigation.attemptCount, "pi attempt")} ·{" "}
                  {countLabel(item.missingEvidence.length, "gap")}
                </span>
              </button>
            ))}
          </div>

          <article className="case-dossier">
            <div className="case-dossier-head">
              <div>
                <span className="eyebrow">Bounded research dossier</span>
                <h2>{selectedCase.question}</h2>
              </div>
              <div>
                <Badge variant={caseBadgeVariant(selectedCase.status)}>
                  {selectedCase.status.replaceAll("_", " ")}
                </Badge>
                <Badge variant="shadow">{selectedCase.authority}</Badge>
                <Badge variant="muted">{selectedCase.reviewStatus}</Badge>
              </div>
            </div>

            <div className="case-scope-strip">
              <div>
                <Database size={13} />
                <span>
                  {selectedCase.catalogListingCount} listings ·{" "}
                  {selectedCase.catalogContextSource
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </span>
              </div>
              <div>
                <Network size={13} />
                <span>{selectedCase.venueIds.join(" · ")}</span>
              </div>
              <code>
                {selectedCase.catalogContextIdentity?.slice(0, 24) ??
                  "context unavailable"}
                …
              </code>
            </div>

            <div className="case-stage-flow">
              {selectedCase.stages.map((stage, index) => (
                <div
                  className={cn(
                    "case-stage",
                    `is-${stage.status.toLowerCase()}`,
                  )}
                  key={stage.stage}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{stage.stage.replaceAll("_", " ")}</strong>
                    <small>{stage.detail}</small>
                  </div>
                  <Badge
                    variant={
                      stage.status === "BOUND" || stage.status === "PRESENT"
                        ? "verified"
                        : stage.status === "FAILED"
                          ? "warning"
                          : stage.status === "RUNNING"
                            ? "shadow"
                            : "muted"
                    }
                  >
                    {stage.status}
                  </Badge>
                </div>
              ))}
            </div>

            {selectedCase.status === "NEEDS_INVESTIGATION" && (
              <div className="case-investigation-action">
                <div>
                  <SquareTerminal size={15} />
                  <span>
                    {selectedCase.scout.contextSnapshotRetained
                      ? "Deep pi will reuse the exact catalog snapshot retained with "
                      : "This legacy scout predates exact context retention for "}
                    scout task <code>{selectedCase.scout.taskId}</code>.
                    {selectedCase.scout.contextSnapshotRetained
                      ? " Refreshes cannot substitute newer evidence."
                      : " Re-run a fresh bounded scout before deep investigation."}
                    {caseInvestigationDiagnostic !== null && (
                      <strong>{caseInvestigationDiagnostic}</strong>
                    )}
                  </span>
                </div>
                <Button
                  variant="outline"
                  disabled={
                    selectedCase.scout.taskId === null ||
                    !selectedCase.scout.contextSnapshotRetained ||
                    !studioProjection.ai.investigator.configured ||
                    studioProjection.ai.investigationDesk.activeCount > 0 ||
                    caseInvestigationState === "RUNNING"
                  }
                  onClick={() => void investigateSelectedCase()}
                >
                  {caseInvestigationState === "RUNNING" ? (
                    <RefreshCw className="is-spinning" size={14} />
                  ) : (
                    <SquareTerminal size={14} />
                  )}
                  {!studioProjection.ai.investigator.configured
                    ? "Deep investigator needs key"
                    : !selectedCase.scout.contextSnapshotRetained
                      ? "Exact context snapshot unavailable"
                    : caseInvestigationState === "RUNNING"
                      ? "pi investigating retained context…"
                      : caseInvestigationState === "DONE"
                        ? "pi investigation complete"
                        : caseInvestigationState === "RESTORED"
                          ? "Restored retained report"
                          : caseInvestigationState === "FAILED"
                            ? "Retry retained-context pi"
                            : "Run deep pi on retained context"}
                </Button>
              </div>
            )}

            {selectedCase.investigation.summary !== null && (
              <section className="case-investigation-brief">
                <div className="case-section-heading">
                  <div>
                    <SquareTerminal size={14} />
                    <strong>Deep investigation brief</strong>
                  </div>
                  <div className="case-brief-badges">
                    <Badge variant="muted">
                      {countLabel(
                        selectedCase.investigation.findingCount,
                        "finding",
                      )}
                    </Badge>
                    <Badge
                      variant={
                        selectedCase.investigation.warningCount > 0
                          ? "warning"
                          : "muted"
                      }
                    >
                      {countLabel(
                        selectedCase.investigation.warningCount,
                        "warning",
                      )}
                    </Badge>
                  </div>
                </div>
                <p>{selectedCase.investigation.summary}</p>
                {selectedCase.investigation.findings.length > 0 && (
                  <div className="case-finding-list">
                    {selectedCase.investigation.findings.map(
                      (finding, index) => (
                        <article
                          key={`${selectedCase.caseId}:finding:${index}`}
                        >
                          <div>
                            <Badge
                              variant={
                                finding.severity === "WARNING"
                                  ? "warning"
                                  : "muted"
                              }
                            >
                              {finding.severity}
                            </Badge>
                            <code>{finding.listingRefs.join(" · ")}</code>
                          </div>
                          <p>{finding.statement}</p>
                        </article>
                      ),
                    )}
                  </div>
                )}
                {selectedCase.investigation.findingCount >
                  selectedCase.investigation.findings.length && (
                  <small className="case-more-gaps">
                    +
                    {selectedCase.investigation.findingCount -
                      selectedCase.investigation.findings.length} more retained
                    outside the bounded dossier slice
                  </small>
                )}
              </section>
            )}

            <div className="case-evidence-grid">
              <section>
                <div className="case-section-heading">
                  <div>
                    <GitBranch size={14} />
                    <strong>Candidate listing scope</strong>
                  </div>
                  <Badge variant="muted">
                    {selectedCase.candidateListingRefCount}
                  </Badge>
                </div>
                {selectedCase.candidateListingRefs.length === 0 ? (
                  <p>No grounded candidate listing survived intake.</p>
                ) : (
                  <ul className="case-listing-refs">
                    {selectedCase.candidateListingRefs.map((listingRef) => (
                      <li key={listingRef}>
                        <Fingerprint size={11} />
                        <code>{listingRef}</code>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedCase.candidateListingRefCount >
                  selectedCase.candidateListingRefs.length && (
                  <small className="case-more-gaps">
                    +
                    {selectedCase.candidateListingRefCount -
                      selectedCase.candidateListingRefs.length}{" "}
                    more retained outside the bounded display slice
                  </small>
                )}
              </section>
              <section>
                <div className="case-section-heading">
                  <div>
                    <CircleOff size={14} />
                    <strong>Missing evidence intake</strong>
                  </div>
                  <Badge
                    variant={
                      selectedCase.missingEvidence.length > 0
                        ? "warning"
                        : "muted"
                    }
                  >
                    {selectedCase.missingEvidence.length}
                  </Badge>
                </div>
                {selectedCase.missingEvidence.length === 0 ? (
                  <p>
                    pi reported no explicit gaps; this is not an independent
                    completeness finding.
                  </p>
                ) : (
                  <ol className="case-gap-list">
                    {selectedCase.missingEvidence
                      .slice(0, 6)
                      .map((gap, index) => (
                        <li key={`${selectedCase.caseId}:gap:${index}`}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <p>{gap}</p>
                        </li>
                      ))}
                  </ol>
                )}
                {selectedCase.missingEvidence.length > 6 && (
                  <small className="case-more-gaps">
                    +{selectedCase.missingEvidence.length - 6} more retained in
                    the case projection
                  </small>
                )}
              </section>
            </div>

            <div className="case-footer-strip">
              <div>
                <SquareTerminal size={13} />
                <span>
                  pi {selectedCase.investigation.status.toLowerCase()} ·{" "}
                  {selectedCase.investigation.failedAttemptCount} failed of{" "}
                  {countLabel(
                    selectedCase.investigation.attemptCount,
                    "attempt",
                  )}{" "}
                  · {countLabel(selectedCase.investigation.warningCount, "warning")}
                </span>
              </div>
              <code>
                {selectedCase.investigation.artifactHash ??
                  "no passed investigation artifact"}
              </code>
            </div>

            <div className="case-authority-lock">
              <ShieldCheck size={15} />
              <span>
                Case aggregation is read-only operational context. It cannot
                accept a hypothesis, publish a market link, compile a candidate,
                certify arbitrage, or grant execution authority.
              </span>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function VenueMatrix() {
  const studioProjection = useStudioProjection();
  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Protocol reality</span>
        <h1>Venue capability matrix</h1>
        <p>
          Each adapter owns its precision, authentication boundary, mechanism,
          and qualification evidence.
        </p>
      </div>
      <div className="venue-grid">
        {studioProjection.venues.map((venue) => (
          <Card className="venue-card" key={venue.id}>
            <CardHeader>
              <div className="venue-monogram">
                <span style={{ backgroundColor: venue.color }} />
                {venue.name.slice(0, 2).toUpperCase()}
              </div>
              <Badge variant={venue.stage === "OBSERVE" ? "verified" : "muted"}>
                {venue.stage}
              </Badge>
            </CardHeader>
            <CardContent>
              <h2>{venue.name}</h2>
              <p>{venue.mechanism}</p>
              <div
                className={cn(
                  "gateway-posture",
                  venue.gatewayPosture !== "ABSENT" && "is-inert",
                )}
              >
                <CircleOff size={11} />
                {venue.gatewayPosture === "INERT_DEMO"
                  ? "Inert demo gateway"
                  : venue.gatewayPosture === "INERT_SANDBOX"
                    ? "Inert sandbox gateway"
                    : "Order gateway absent"}
              </div>
              <div className="venue-health">
                <div>
                  <span>Fixture health</span>
                  <strong>{venue.health}%</strong>
                </div>
                <div className="health-track">
                  <span style={{ width: `${venue.health}%` }} />
                </div>
              </div>
              <div className="capability-chips">
                {venue.capabilities.map((capability) => (
                  <span key={capability}>{capability}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BookDeskView() {
  const studioProjection = useStudioProjection();
  const [selectedBookId, setSelectedBookId] = useState(
    studioProjection.bookDesk.books[0]?.bookId ?? "",
  );
  const [replayStatus, setReplayStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "FAILED"
  >("IDLE");
  const selectedBook =
    studioProjection.bookDesk.books.find(
      (book) => book.bookId === selectedBookId,
    ) ?? studioProjection.bookDesk.books[0];

  async function replayBooks() {
    setReplayStatus("RUNNING");
    try {
      const response = await fetch("/api/v1/books/replay", { method: "POST" });
      if (!response.ok) {
        throw new Error(`book replay returned HTTP ${response.status}`);
      }
      const result = (await response.json()) as {
        effects?: {
          externalWrites?: boolean;
          valueMovingActions?: boolean;
          liveExecutionEnabled?: boolean;
        };
      };
      if (
        result.effects?.externalWrites !== false ||
        result.effects.valueMovingActions !== false ||
        result.effects.liveExecutionEnabled !== false
      ) {
        throw new Error("book replay crossed its read-only boundary");
      }
      setReplayStatus("DONE");
    } catch {
      setReplayStatus("FAILED");
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading book-heading">
        <div>
          <span className="eyebrow">Deterministic market state</span>
          <h1>Book replay desk</h1>
          <p>
            Verified stream frames become generation-bound books inside the
            control plane. Venue sequence guarantees stay visible instead of
            being flattened into a fake common feed.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={replayStatus === "RUNNING"}
          onClick={() => void replayBooks()}
        >
          <RefreshCw
            size={14}
            className={replayStatus === "RUNNING" ? "is-spinning" : ""}
          />
          {replayStatus === "RUNNING"
            ? "Replaying"
            : replayStatus === "DONE"
              ? "Replay complete"
              : replayStatus === "FAILED"
                ? "Retry replay"
                : "Replay evidence"}
        </Button>
      </div>

      <div className="book-summary-grid">
        <Metric
          label="Qualified books"
          value={`${studioProjection.bookDesk.books.length}`}
          detail="three public transports"
        />
        <Metric
          label="Replay generation"
          value={`${studioProjection.bookDesk.replayCount}`}
          detail="in-memory · deterministic"
        />
        <Metric
          label="Valid projections"
          value={`${studioProjection.bookDesk.books.filter((book) => book.lifecycle === "SNAPSHOT_VALID" || book.lifecycle === "APPLYING_DELTAS").length}`}
          detail="stale and gaps fail closed"
        />
      </div>

      <div className="book-desk-layout">
        <div className="book-session-list">
          <div className="book-list-heading">
            <span>Venue sessions</span>
            <Badge variant="verified">
              <Radio size={10} /> SSE linked
            </Badge>
          </div>
          {studioProjection.bookDesk.books.map((book) => (
            <button
              className={cn(
                "book-session",
                selectedBook?.bookId === book.bookId && "is-selected",
              )}
              key={book.bookId}
              onClick={() => setSelectedBookId(book.bookId)}
            >
              <span className="book-session-status" />
              <div>
                <strong>{book.venueName}</strong>
                <span>{book.instrumentId}</span>
              </div>
              <Badge variant="muted">{book.lifecycle}</Badge>
              <small>
                {book.bidLevelCount} × {book.askLevelCount} levels
              </small>
            </button>
          ))}
        </div>

        {selectedBook && (
          <Card className="book-detail-card">
            <CardHeader>
              <div>
                <span className="eyebrow">{selectedBook.venueId}</span>
                <h2>{selectedBook.venueName} order book</h2>
              </div>
              <Badge variant="verified">Generation {selectedBook.generation}</Badge>
            </CardHeader>
            <CardContent>
              <div className="book-topline">
                <div>
                  <span>Best bid</span>
                  <strong className="positive">
                    {selectedBook.bestBid ?? "—"}
                  </strong>
                </div>
                <div>
                  <span>Spread</span>
                  <strong>{selectedBook.spread ?? "—"}</strong>
                </div>
                <div>
                  <span>Best ask</span>
                  <strong className="ask-text">
                    {selectedBook.bestAsk ?? "—"}
                  </strong>
                </div>
              </div>

              <div className="depth-ladder">
                <div className="depth-side bids">
                  <div className="depth-header">
                    <span>Bid price</span>
                    <span>Size</span>
                  </div>
                  {selectedBook.bids.map((level, index) => (
                    <div className="depth-row" key={`bid:${level.price}`}>
                      <i style={{ width: `${Math.max(22, 100 - index * 10)}%` }} />
                      <strong>{level.price}</strong>
                      <span>{level.size}</span>
                    </div>
                  ))}
                </div>
                <div className="depth-side asks">
                  <div className="depth-header">
                    <span>Ask price</span>
                    <span>Size</span>
                  </div>
                  {selectedBook.asks.map((level, index) => (
                    <div className="depth-row" key={`ask:${level.price}`}>
                      <i style={{ width: `${Math.max(22, 100 - index * 10)}%` }} />
                      <strong>{level.price}</strong>
                      <span>{level.size}</span>
                    </div>
                  ))}
                </div>
              </div>

              <dl className="book-evidence-strip">
                <div>
                  <dt>Sequence policy</dt>
                  <dd>{selectedBook.sequencePolicy.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Venue sequence</dt>
                  <dd>{selectedBook.sequence ?? "snapshot only"}</dd>
                </div>
                <div>
                  <dt>State identity</dt>
                  <dd>{selectedBook.stateHash?.slice(0, 22) ?? "unavailable"}…</dd>
                </div>
                <div>
                  <dt>Evidence identity</dt>
                  <dd>{selectedBook.evidenceHash.slice(0, 22)}…</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function EvidenceView() {
  const studioProjection = useStudioProjection();
  const replayChaos = studioProjection.qualification.replayChaos;
  const campaignEvidence = studioProjection.qualification.campaignEvidence;
  const reviewedCompilation =
    studioProjection.qualification.reviewedCompilation;
  const campaignEvidenceIdentityCount = new Set(
    [
      ...campaignEvidence.assertions.flatMap((item) => item.evidenceHashes),
      reviewedCompilation.artifactHash,
      reviewedCompilation.compiledArtifactHash,
      reviewedCompilation.hypothesisHash,
      reviewedCompilation.hypothesisReviewHash,
      reviewedCompilation.candidateHash,
      reviewedCompilation.certificate.id,
      ...reviewedCompilation.marketLinkProposalHashes,
      ...reviewedCompilation.marketLinkReviewHashes,
    ],
  ).size;
  const items = [
    {
      name: "Verified books",
      count: `${campaignEvidence.sourceArtifacts.length}`,
      detail: "stream + state identity",
      icon: Database,
    },
    {
      name: "Chaos cases",
      count: `${replayChaos.passCount}/${replayChaos.caseCount}`,
      detail: "deterministic fail-closed",
      icon: FileCheck2,
    },
    {
      name: "Evidence identities",
      count: `${campaignEvidenceIdentityCount}`,
      detail: "deduplicated content hashes",
      icon: Boxes,
    },
    {
      name: "Qualification artifacts",
      count: "2",
      detail: "replay + reviewed compiler",
      icon: BadgeCheck,
    },
  ] as const;

  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">Immutable trail</span>
        <h1>Evidence inventory</h1>
        <p>
          Normalized facts remain linked to the raw bytes, protocol identity,
          receive time, and exact verifier inputs that produced them.
        </p>
      </div>
      <div className="evidence-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card className="evidence-card" key={item.name}>
              <Icon size={20} />
              <strong>{item.count}</strong>
              <div>
                <h2>{item.name}</h2>
                <p>{item.detail}</p>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="chaos-evidence-card">
        <CardHeader>
          <div>
            <span className="eyebrow">Replay integrity · deterministic suite</span>
            <h2>Chaos qualification</h2>
          </div>
          <Badge
            variant={replayChaos.status === "PASS" ? "verified" : "muted"}
          >
            {replayChaos.passCount}/{replayChaos.caseCount} PASS
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="chaos-case-list">
            {replayChaos.cases.map((item, index) => (
              <div className="chaos-case-row" key={item.caseId}>
                <span className="chaos-case-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.caseId.replaceAll("_", " ")}</span>
                </div>
                <code>{item.observedPosture}</code>
                <Badge variant={item.passed ? "verified" : "muted"}>
                  {item.passed ? "PASS" : "FAIL"}
                </Badge>
              </div>
            ))}
          </div>
          <div className="evidence-identity-strip">
            <div>
              <span>Suite identity</span>
              <code>{replayChaos.suiteHash}</code>
            </div>
            <div>
              <span>Campaign artifact</span>
              <code>{campaignEvidence.artifactHash}</code>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="terminal-card">
        <div className="terminal-topbar">
          <div>
            <span />
            <span />
            <span />
          </div>
          <span>pmh · evidence inspect</span>
          <SquareTerminal size={15} />
        </div>
        <pre>
          <code>
            {JSON.stringify(
              {
                schemaVersion: campaignEvidence.schemaVersion,
                campaignId: campaignEvidence.campaignId,
                checkpointId: campaignEvidence.checkpointId,
                status: campaignEvidence.status,
                artifactHash: campaignEvidence.artifactHash,
                reviewedCompilation: {
                  scope: reviewedCompilation.scope,
                  status: reviewedCompilation.status,
                  artifactHash: reviewedCompilation.artifactHash,
                  certificate: reviewedCompilation.certificate.id,
                },
                effects: campaignEvidence.effects,
              },
              null,
              2,
            )}
          </code>
        </pre>
      </Card>
    </section>
  );
}

function CertificateDrawer({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity | null;
  onClose: () => void;
}) {
  const studioProjection = useStudioProjection();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <>
      <button
        className={cn("drawer-scrim", opportunity && "is-open")}
        aria-label="Close certificate"
        onClick={onClose}
      />
      <aside
        className={cn("certificate-drawer", opportunity && "is-open")}
        aria-hidden={opportunity === null}
        aria-label="Certificate detail"
      >
        {opportunity && (
          <>
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">Exact synthetic fixture certificate</span>
                <h2>{opportunity.title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close certificate"
                onClick={onClose}
              >
                <PanelRightClose size={18} />
              </Button>
            </div>
            <div className="certificate-seal">
              <ShieldCheck size={32} />
              <div>
                <Badge variant="verified">Fixture verified exact</Badge>
                <strong>{opportunity.floor} worst-case payoff</strong>
                <span>after fees, rounding, and capital bounds</span>
              </div>
            </div>
            <dl className="certificate-facts">
              <div>
                <dt>Certificate</dt>
                <dd>{opportunity.certificate}</dd>
              </div>
              <div>
                <dt>Bound capital</dt>
                <dd>{opportunity.capital}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{opportunity.evidence}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd className="violet-text">SHADOW ONLY</dd>
              </div>
            </dl>
            <div className="drawer-trace">
              {studioProjection.trace.map(([name, verdict], index) => (
                <div key={name}>
                  <span>
                    {verdict === "BLOCKED" ? <CircleOff size={11} /> : index + 1}
                  </span>
                  <strong>{name}</strong>
                  <Badge variant={verdict === "PASS" ? "verified" : "shadow"}>
                    {verdict}
                  </Badge>
                </div>
              ))}
            </div>
            <Button
              className="drawer-action"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(opportunity.certificate);
                setCopied(true);
              }}
            >
              <Fingerprint size={15} />
              {copied ? "Evidence identity copied" : "Copy evidence identity"}
            </Button>
          </>
        )}
      </aside>
    </>
  );
}

function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
}) {
  if (!open) return null;
  return (
    <div className="command-layer" role="dialog" aria-modal="true">
      <button
        className="command-scrim"
        aria-label="Close command menu"
        onClick={onClose}
      />
      <div className="command-palette">
        <div className="command-input">
          <Search size={16} />
          <input
            autoFocus
            aria-label="Search commands"
            placeholder="Jump to a projection…"
          />
          <kbd>ESC</kbd>
        </div>
        <span className="command-group-label">Available projections</span>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              <small>Open</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StudioShell() {
  const [view, setView] = useState<View>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view]);

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onViewChange={setView}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="workspace">
        <Topbar
          onMenu={() => setMobileOpen(true)}
          onCommand={() => setCommandOpen(true)}
        />
        <main>
          {view === "overview" && <Overview onInspect={setOpportunity} />}
          {view === "radar" && <OpportunityRadarView />}
          {view === "preflight" && <RealCandidatePreflightView />}
          {view === "scouts" && <ScoutInboxView />}
          {view === "cases" && <ResearchCaseDeskView />}
          {view === "venues" && <VenueMatrix />}
          {view === "books" && <BookDeskView />}
          {view === "evidence" && <EvidenceView />}
        </main>
        <footer>
          <span>
            <Radar size={13} />
            PRE-ALPHA · CONTROL PLANE
          </span>
          <span>All displayed opportunities are non-executable evidence.</span>
        </footer>
      </div>
      <CertificateDrawer
        opportunity={opportunity}
        onClose={() => setOpportunity(null)}
      />
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={setView}
      />
    </div>
  );
}

export default function App() {
  const { projection, diagnostic } = useControlPlaneProjection();
  if (projection === null) {
    return (
      <main className="control-plane-gate">
        <SignalMark />
        <span className="eyebrow">Harmony control plane</span>
        <h1>{diagnostic === null ? "Connecting to the desk…" : "Desk offline"}</h1>
        <p>
          {diagnostic ??
            "Waiting for the backend process to publish its first projection."}
        </p>
        <Badge variant={diagnostic === null ? "muted" : "warning"}>
          {diagnostic === null ? "CONNECTING" : "BACKEND REQUIRED"}
        </Badge>
      </main>
    );
  }
  return (
    <StudioProjectionProvider projection={projection}>
      <StudioShell />
    </StudioProjectionProvider>
  );
}
