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
}> {
  const [projection, setProjection] = useState<StudioProjection | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/v1/projection", {
      signal: abort.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`control plane returned HTTP ${response.status}`);
        }
        setProjection((await response.json()) as StudioProjection);
        setDiagnostic(null);
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          setDiagnostic(
            error instanceof Error ? error.message : "control plane unavailable",
          );
        }
      });

    const events = new EventSource("/api/v1/events");
    events.addEventListener("projection", (event) => {
      setProjection(JSON.parse((event as MessageEvent<string>).data));
      setDiagnostic(null);
    });
    events.onerror = () => {
      setDiagnostic("control-plane event stream disconnected");
    };
    return () => {
      abort.abort();
      events.close();
    };
  }, []);

  return { projection, diagnostic };
}

export type { StudioProjection };
