import { hashCanonical } from "@pmh/domain";
import { FixtureCatalogDiscoveryDesk } from "./catalog-discovery.js";
import {
  createPiInvestigatorRuntime,
  type PiInvestigationReport,
  type PiProcessRunner,
} from "./pi-investigator.js";

const SMOKE_QUESTION = "Highest temperature in Boston on July 31, 2026?";
const SMOKE_VENUES = Object.freeze(["gemini-predictions"]);

export async function runPiInvestigatorSmoke(
  options: Readonly<{
    environment?: Readonly<Record<string, string | undefined>>;
    command?: string;
    cwd?: string;
    runner?: PiProcessRunner;
    now?: () => number;
  }> = {},
): Promise<PiInvestigationReport> {
  const runtime = createPiInvestigatorRuntime(
    options.environment ?? process.env,
    {
      ...(options.command === undefined ? {} : { command: options.command }),
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.runner === undefined ? {} : { runner: options.runner }),
    },
  );
  if (runtime.investigator === null) {
    throw new Error(
      `${runtime.projection.credentialEnv} is required for pi investigator qualification`,
    );
  }

  const now = options.now ?? Date.now;
  const catalog = new FixtureCatalogDiscoveryDesk();
  await catalog.load();
  const catalogContext = catalog.context(SMOKE_QUESTION, SMOKE_VENUES);
  const startedAtMs = now();
  return runtime.investigator.investigate({
    taskId: `task:pi-smoke:${hashCanonical({
      question: SMOKE_QUESTION,
      venueIds: SMOKE_VENUES,
      catalogContextIdentity: catalogContext.contextIdentity,
      model: runtime.projection.model,
    }).slice(7, 23)}`,
    question: SMOKE_QUESTION,
    venueIds: SMOKE_VENUES,
    maxHypotheses: 3,
    deadlineEpochMs: startedAtMs + runtime.projection.timeoutMs + 2_000,
    catalogContext,
  });
}
