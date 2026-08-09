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
  status: "CONNECTING" | "LIVE" | "REFRESHING" | "RECONNECTING";
  revision: string | null;
  lastUpdatedAt: string | null;
}>;

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
  });

  useEffect(() => {
    let closed = false;
    let etag: string | null = null;
    let refreshQueued = false;
    let refreshInFlight: Promise<void> | null = null;
    const activeRequests = new Set<AbortController>();

    const refresh = (): void => {
      refreshQueued = true;
      if (refreshInFlight !== null) return;
      refreshInFlight = (async () => {
        while (refreshQueued && !closed) {
          refreshQueued = false;
          setSync((current) => ({ ...current, status: "REFRESHING" }));
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
            setSync({
              status: "LIVE",
              revision,
              lastUpdatedAt: new Date().toISOString(),
            });
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
      events.close();
    };
  }, []);

  return { projection, diagnostic, sync };
}

export type { StudioProjection };
