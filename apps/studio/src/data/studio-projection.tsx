import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { StudioProjection } from "@pmh/control-plane";

const ProjectionContext = createContext<StudioProjection | null>(null);

type ResearchCase = StudioProjection["ai"]["researchDesk"]["cases"][number];

export type ProjectionSyncState = Readonly<{
  status:
    | "CONNECTING"
    | "STALE_REVALIDATING"
    | "LIVE"
    | "REFRESHING"
    | "RECONNECTING";
  revision: string | null;
  lastUpdatedAt: string | null;
  readiness: StartupReadiness | null;
}>;

export type StartupReadiness = Readonly<{
  schemaVersion: "pmh.startup-readiness.v1";
  status: "STARTING" | "READY" | "FAILED";
  phase:
    | "STARTUP_GATE"
    | "DURABLE_RECOVERY"
    | "AGENT_RECONCILIATION"
    | "WAITING_FOR_PROJECTION"
    | "MATERIALIZING_PROJECTION"
    | "READY"
    | "FAILED";
  startedAt: string;
  phaseStartedAt: string;
  completedAt: string | null;
  elapsedMs: number;
  phaseElapsedMs: number;
  diagnostic: string | null;
  phaseTimings: ReadonlyArray<Readonly<{
    phase: StartupReadiness["phase"];
    startedAt: string;
    completedAt: string;
    durationMs: number;
  }>>;
  reconciliationTimings?: ReadonlyArray<Readonly<{
    step: string;
    durationMs: number;
  }>>;
  currentReconciliationStep?: string | null;
  projectionResource: "/api/v1/projection";
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  externalWriteAuthority: false;
  valueMovingAuthority: false;
}>;

const STARTUP_PHASES = Object.freeze([
  "STARTUP_GATE",
  "DURABLE_RECOVERY",
  "AGENT_RECONCILIATION",
  "WAITING_FOR_PROJECTION",
  "MATERIALIZING_PROJECTION",
  "READY",
  "FAILED",
] as const);

export function parseStartupReadiness(value: unknown): StartupReadiness {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("startup readiness is malformed");
  }
  const candidate = value as StartupReadiness;
  if (
    candidate.schemaVersion !== "pmh.startup-readiness.v1" ||
    !["STARTING", "READY", "FAILED"].includes(candidate.status) ||
    !STARTUP_PHASES.includes(candidate.phase) ||
    !Number.isSafeInteger(candidate.elapsedMs) || candidate.elapsedMs < 0 ||
    !Number.isSafeInteger(candidate.phaseElapsedMs) || candidate.phaseElapsedMs < 0 ||
    !Array.isArray(candidate.phaseTimings) || candidate.phaseTimings.some((item) =>
      !STARTUP_PHASES.includes(item.phase) ||
      !Number.isSafeInteger(item.durationMs) || item.durationMs < 0
    ) ||
    candidate.projectionResource !== "/api/v1/projection" ||
    candidate.providerRequestsStarted !== 0 ||
    candidate.modelInvocationsStarted !== 0 ||
    candidate.externalWriteAuthority !== false ||
    candidate.valueMovingAuthority !== false
  ) throw new Error("startup readiness violates its authority contract");
  return candidate;
}

export function useControlPlaneReadiness(): Readonly<{
  readiness: StartupReadiness | null;
  diagnostic: string | null;
}> {
  const [readiness, setReadiness] = useState<StartupReadiness | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  useEffect(() => {
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async (): Promise<void> => {
      try {
        const response = await fetch("/api/v1/readiness", {
          headers: { accept: "application/json" },
        });
        const next = parseStartupReadiness(await response.json());
        if (closed) return;
        setReadiness(next);
        setDiagnostic(next.status === "FAILED"
          ? next.diagnostic ?? "control-plane startup failed"
          : null);
      } catch (error) {
        if (!closed) setDiagnostic(
          error instanceof Error ? error.message : "control plane unavailable",
        );
      } finally {
        if (!closed) timer = setTimeout(() => void poll(), 1_000);
      }
    };
    void poll();
    return () => {
      closed = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
  return Object.freeze({ readiness, diagnostic });
}

type ProjectionInvalidation = Readonly<{
  schemaVersion: "pmh.studio-projection-invalidation.v1";
  revision: string;
  projectionResource: "/api/v1/projection";
  projectionView: "LIVE_BOUNDED";
  refreshRequired: true;
  authority: "PRESENTATION_INVALIDATION_ONLY";
}>;

export function parseProjectionInvalidation(value: unknown): ProjectionInvalidation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("projection invalidation is malformed");
  }
  const candidate = value as ProjectionInvalidation;
  if (
    candidate.schemaVersion !== "pmh.studio-projection-invalidation.v1" ||
    !/^(?:0|[1-9]\d*)$/u.test(String(candidate.revision)) ||
    candidate.projectionResource !== "/api/v1/projection" ||
    candidate.projectionView !== "LIVE_BOUNDED" ||
    candidate.refreshRequired !== true ||
    candidate.authority !== "PRESENTATION_INVALIDATION_ONLY"
  ) throw new Error("projection invalidation violates its refresh contract");
  return candidate;
}

export function resolveReviewIntake(
  researchCase: ResearchCase | undefined,
): NonNullable<ResearchCase["reviewIntake"]> | null {
  return researchCase?.reviewIntake ?? null;
}

export function StudioProjectionProvider({
  projection,
  children,
}: {
  projection: StudioProjection;
  children: ReactNode;
}) {
  return (
    <ProjectionContext.Provider value={projection}>
      {children}
    </ProjectionContext.Provider>
  );
}

export function useStudioProjection(): StudioProjection {
  const projection = useContext(ProjectionContext);
  if (projection === null) {
    throw new Error("Studio projection is unavailable");
  }
  return projection;
}

export function useControlPlaneProjection(): Readonly<{
  projection: StudioProjection | null;
  diagnostic: string | null;
  sync: ProjectionSyncState;
}> {
  const [projection, setProjection] = useState<StudioProjection | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [sync, setSync] = useState<ProjectionSyncState>({
    status: "CONNECTING",
    revision: null,
    lastUpdatedAt: null,
    readiness: null,
  });

  useEffect(() => {
    let closed = false;
    let etag: string | null = null;
    let refreshQueued = false;
    let refreshInFlight: Promise<void> | null = null;
    let readinessTimer: ReturnType<typeof setInterval> | null = null;
    const activeRequests = new Set<AbortController>();

    const stopReadinessPolling = (): void => {
      if (readinessTimer !== null) clearInterval(readinessTimer);
      readinessTimer = null;
    };

    const pollReadiness = async (): Promise<void> => {
      const abort = new AbortController();
      activeRequests.add(abort);
      try {
        const response = await fetch("/api/v1/readiness", {
          signal: abort.signal,
          headers: { accept: "application/json" },
        });
        const readiness = parseStartupReadiness(await response.json());
        if (closed) return;
        const presentedReadiness = readiness.phase === "WAITING_FOR_PROJECTION" &&
            refreshInFlight !== null
          ? Object.freeze({
              ...readiness,
              phase: "MATERIALIZING_PROJECTION" as const,
              phaseStartedAt: new Date().toISOString(),
              phaseElapsedMs: 0,
            })
          : readiness;
        setSync((current) => ({ ...current, readiness: presentedReadiness }));
        if (readiness.status === "READY") stopReadinessPolling();
        if (readiness.status === "FAILED") {
          stopReadinessPolling();
          setDiagnostic(readiness.diagnostic ?? "control-plane startup failed");
        }
      } catch {
        // Projection transport owns the offline diagnostic. Readiness polling
        // is a best-effort explanation for a backend that is already reachable.
      } finally {
        activeRequests.delete(abort);
      }
    };

    void pollReadiness();
    readinessTimer = setInterval(() => void pollReadiness(), 500);

    const refresh = (): void => {
      refreshQueued = true;
      if (refreshInFlight !== null) return;
      refreshInFlight = (async () => {
        while (refreshQueued && !closed) {
          refreshQueued = false;
          setSync((current) => ({
            ...current,
            status: current.status === "STALE_REVALIDATING"
              ? "STALE_REVALIDATING"
              : "REFRESHING",
          }));
          const abort = new AbortController();
          activeRequests.add(abort);
          try {
            const response = await fetch("/api/v1/projection", {
              signal: abort.signal,
              headers: {
                accept: "application/json",
                ...(etag === null ? {} : { "if-none-match": etag }),
              },
            });
            if (response.status !== 304 && !response.ok) {
              throw new Error(`control plane returned HTTP ${response.status}`);
            }
            if (closed) return;
            const responseEtag = response.headers.get("etag");
            if (responseEtag !== null) etag = responseEtag;
            if (response.status !== 304) {
              const nextProjection = (await response.json()) as StudioProjection;
              if (closed) return;
              setProjection(nextProjection);
            }
            const revision = response.headers.get("x-pmh-projection-revision");
            const freshness = response.headers.get("x-pmh-projection-freshness");
            if (freshness !== "LIVE" && freshness !== "STALE_REVALIDATING") {
              throw new Error("control plane omitted projection freshness");
            }
            setSync((current) => ({
              ...current,
              status: freshness,
              revision,
              lastUpdatedAt:
                response.headers.get("x-pmh-projection-materialized-at") ??
                new Date().toISOString(),
            }));
            if (freshness === "LIVE") stopReadinessPolling();
            setDiagnostic(null);
          } catch (error: unknown) {
            if (!closed && !abort.signal.aborted) {
              setSync((current) => ({ ...current, status: "RECONNECTING" }));
              setDiagnostic(
                error instanceof Error ? error.message : "control plane unavailable",
              );
            }
          } finally {
            activeRequests.delete(abort);
          }
        }
      })().finally(() => {
        refreshInFlight = null;
        if (refreshQueued && !closed) refresh();
      });
    };

    refresh();

    const events = new EventSource("/api/v1/events");
    events.addEventListener("projection-invalidated", (event) => {
      if (closed) return;
      try {
        parseProjectionInvalidation(JSON.parse((event as MessageEvent<string>).data));
        refresh();
      } catch (error: unknown) {
        setSync((current) => ({ ...current, status: "RECONNECTING" }));
        setDiagnostic(
          error instanceof Error ? error.message : "invalid projection refresh signal",
        );
      }
    });
    events.onopen = () => {
      if (!closed) refresh();
    };
    events.onerror = () => {
      if (closed) return;
      setSync((current) => ({ ...current, status: "RECONNECTING" }));
      setDiagnostic("Live updates are reconnecting; the last synchronized view remains visible.");
    };
    return () => {
      closed = true;
      for (const request of activeRequests) request.abort();
      stopReadinessPolling();
      events.close();
    };
  }, []);

  return { projection, diagnostic, sync };
}

export type { StudioProjection };
