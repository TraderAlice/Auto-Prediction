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
  LayoutDashboard,
  Menu,
  Network,
  PanelRightClose,
  Play,
  Radar,
  Search,
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

type View = "overview" | "venues" | "evidence";
type Opportunity = StudioProjection["opportunities"][number];

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "venues", label: "Venue matrix", icon: Network },
  { id: "evidence", label: "Evidence", icon: Fingerprint },
] as const;

const supplementalNavigation = [
  { label: "Claims", icon: Braces },
  { label: "Books", icon: BookOpenCheck },
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

function VenuePulse() {
  const studioProjection = useStudioProjection();
  return (
    <div className="venue-pulse">
      <div className="pulse-heading">
        <span>Adapter pulse</span>
        <Badge variant="verified">5 online</Badge>
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
          5d9fd68
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
          <span>{opportunity.strategy}</span>
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
                  style={{ height: `${state.value}%` }}
                >
                  <span>+${((state.value - 60) * 2.34).toFixed(2)}</span>
                </div>
              </div>
              <small>{state.label}</small>
            </div>
          ))}
        </div>
        <div className="plot-note">
          <ShieldCheck size={15} />
          <span>
            8 canonical resolution states checked with adverse rounding.
          </span>
          <code>cert 3ac40a…891d</code>
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
          <span className="eyebrow">Capital silos</span>
          <h2>Bound per venue</h2>
        </div>
        <Database size={19} className="muted-icon" />
      </CardHeader>
      <CardContent>
        <div className="capital-legend">
          <span>
            <i className="available" /> Available
          </span>
          <span>
            <i className="reserved" /> Reserved
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
                <span>{item.available}% free</span>
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
      const response = await fetch("/api/v1/discovery/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: "Will NYC rainfall exceed 0.25 inches?",
          venueIds: ["kalshi", "polymarket-global"],
        }),
      });
      if (!response.ok) throw new Error("scout request failed");
      const result = (await response.json()) as {
        executionAuthority: boolean;
        hypotheses: readonly unknown[];
      };
      if (
        result.executionAuthority !== false ||
        result.hypotheses.length === 0
      ) {
        throw new Error("scout crossed its authority boundary");
      }
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
          detail="fixture qualified"
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
            <span className="eyebrow">Verifier output</span>
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
        {studioProjection.venues.map((venue, index) => (
          <Card className="venue-card" key={venue.id}>
            <CardHeader>
              <div className="venue-monogram">
                <span style={{ backgroundColor: venue.color }} />
                {venue.name.slice(0, 2).toUpperCase()}
              </div>
              <Badge variant={index < 3 ? "verified" : "muted"}>
                {venue.stage}
              </Badge>
            </CardHeader>
            <CardContent>
              <h2>{venue.name}</h2>
              <p>{venue.mechanism}</p>
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
                <span>CATALOG</span>
                <span>PRECISION</span>
                <span>RULES</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function EvidenceView() {
  const items = [
    {
      name: "Raw venue fixtures",
      count: "9",
      detail: "byte-for-byte immutable",
      icon: Database,
    },
    {
      name: "Rule identities",
      count: "5",
      detail: "adapter protocol hashes",
      icon: FileCheck2,
    },
    {
      name: "Book generations",
      count: "3",
      detail: "bound to certificates",
      icon: Boxes,
    },
    {
      name: "Review artifacts",
      count: "2",
      detail: "independent link decisions",
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
            {`{
  "schemaVersion": "pmh.cli.v1",
  "identity": { "command": "venue.inspect" },
  "effects": {
    "externalWrites": false,
    "valueMovingActions": false,
    "liveExecutionEnabled": false
  },
  "artifact": "sha256:38c0493e…57e19e0",
  "ok": true
}`}
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
                <span className="eyebrow">Exact certificate</span>
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
                <Badge variant="verified">Verified exact</Badge>
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
              {studioProjection.trace.slice(0, 5).map(([name], index) => (
                <div key={name}>
                  <span>{index + 1}</span>
                  <strong>{name}</strong>
                  <Badge variant="verified">PASS</Badge>
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
          {view === "venues" && <VenueMatrix />}
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
