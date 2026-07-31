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

type View = "overview" | "scouts" | "venues" | "books" | "evidence";
type Opportunity = StudioProjection["opportunities"][number];

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "scouts", label: "Scout inbox", icon: Inbox },
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
): Promise<boolean> {
  const response = await fetch("/api/v1/discovery/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, venueIds }),
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
    result.hypotheses.length === 0 ||
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
  const [scoutStatus, setScoutStatus] = useState<
    "IDLE" | "RUNNING" | "PROPOSED" | "FAILED"
  >("IDLE");

  async function runScout(): Promise<void> {
    setScoutStatus("RUNNING");
    try {
      await requestDiscoveryRun("Will NYC rainfall exceed 0.25 inches?", [
        "kalshi",
        "polymarket-global",
      ]);
      setScoutStatus("PROPOSED");
    } catch {
      setScoutStatus("FAILED");
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
              <small>{worker.status.replace("_", " ")}</small>
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

function ScoutInboxView() {
  const studioProjection = useStudioProjection();
  const eligibleVenues = studioProjection.venues.filter((venue) =>
    venue.capabilities.includes("MARKET_CATALOG"),
  );
  const [question, setQuestion] = useState(
    "Will NYC rainfall exceed 0.25 inches?",
  );
  const [selectedVenueIds, setSelectedVenueIds] = useState<readonly string[]>([
    "kalshi",
    "polymarket-global",
  ]);
  const [runStatus, setRunStatus] = useState<
    "IDLE" | "RUNNING" | "DONE" | "RESTORED" | "FAILED"
  >("IDLE");

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
      );
      setRunStatus(restored ? "RESTORED" : "DONE");
    } catch {
      setRunStatus("FAILED");
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
          label="Active workers"
          value={`${studioProjection.ai.activeRuns}`}
          detail="SSE live state"
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
            <Button
              className="scout-submit"
              disabled={
                runStatus === "RUNNING" ||
                question.trim() === "" ||
                selectedVenueIds.length === 0
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
            <div className="scout-guardrail">
              <ShieldCheck size={15} />
              <span>{studioProjection.ai.promotionBoundary}</span>
            </div>
          </CardContent>
        </Card>

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
          {view === "scouts" && <ScoutInboxView />}
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
