import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { loadRawFixture, loadStreamFixture } from "@pmh/evidence";
import { describe, expect, it } from "vitest";
import { RealCandidatePreflightDesk } from "../src/index.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../../");
const fixtureRoot = resolve(repositoryRoot, "projects/fixtures");
const checkoutPayload = "polymarket-global/2026-07-31/polymarket-trump-out-2027.json";

type Autocrlf = "true" | "false";

function gitEnvironment(emptyConfigPath: string): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)),
    ),
    GIT_CONFIG_GLOBAL: emptyConfigPath,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ATTR_NOSYSTEM: "1",
  };
}

async function runGit(
  environment: NodeJS.ProcessEnv,
  cwd: string,
  args: readonly string[],
): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], {
    windowsHide: true,
    env: environment,
  });
}

async function cloneRepository(
  environment: NodeJS.ProcessEnv,
  source: string,
  destination: string,
  autocrlf: Autocrlf,
): Promise<void> {
  await execFileAsync(
    "git",
    [
      "-c",
      "core.autocrlf=" + autocrlf,
      "clone",
      "--quiet",
      "--no-local",
      source,
      destination,
    ],
    { windowsHide: true, env: environment },
  );
}

async function loadFixtureCorpusFrom(fixtureDirectory: string): Promise<void> {
  const entries = await readdir(fixtureDirectory, {
    recursive: true,
    withFileTypes: true,
  });
  const rawMetadataPaths = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".meta.json") &&
        !entry.name.endsWith(".stream.meta.json"),
    )
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort();
  expect(rawMetadataPaths).toHaveLength(20);
  for (const metadataPath of rawMetadataPaths) {
    await loadRawFixture(
      metadataPath.replace(/\.meta\.json$/, ".json"),
      metadataPath,
    );
  }

  const streamMetadataPaths = entries
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".stream.meta.json"),
    )
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort();
  expect(streamMetadataPaths).toHaveLength(3);
  for (const metadataPath of streamMetadataPaths) {
    await loadStreamFixture(
      metadataPath.replace(/\.stream\.meta\.json$/, ".stream.json"),
      metadataPath,
    );
  }
}

describe("real candidate preflight desk", () => {
  it("loads the immutable real-fixture screen once and projects no authority", async () => {
    const desk = new RealCandidatePreflightDesk(fixtureRoot);
    expect(() => desk.projection()).toThrow(/not loaded/);
    expect(() => desk.depthProjection()).toThrow(/not loaded/);
    expect(() => desk.dispositionProjection()).toThrow(/not loaded/);
    expect(() => desk.rescreenProjection()).toThrow(/not loaded/);
    const [first, second] = await Promise.all([desk.load(), desk.load()]);
    expect(first).toBe(second);
    expect(desk.projection()).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      catalogIndicativeGrossEdgeBps: "55",
      venueReportedBuyGrossEdgeBps: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(desk.depthProjection()).toMatchObject({
      status: "BLOCKED",
      classification: "SEARCH_LEAD_ONLY",
      screenQuantity: "500000000",
      quantityBound: true,
      totalCostBeforeFees: "500000000",
      grossEdgeBpsBeforeFees: "0",
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(desk.dispositionProjection()).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      scope: "BOUND_BOOK_SNAPSHOT_ONLY",
      postFeeFloorUpperBound: "0",
      strictlyPositivePostFeeFloorPossible: false,
      terminalForSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(desk.rescreenProjection()).toMatchObject({
      status: "REJECTED",
      classification: "REJECTED_ECONOMICS",
      scope: "CURRENT_BOUND_BOOK_SNAPSHOT_ONLY",
      rescreenSequence: 2,
      previousDispositionInvalidated: true,
      conclusionRecomputed: true,
      priorDecisionReused: false,
      decisionContinuity: "REJECTED_TO_REJECTED",
      currentGrossFloorUpperBoundBeforeFees: "0",
      currentPostFeeFloorUpperBound: "0",
      terminalForCurrentSnapshot: true,
      rescreenRequiredOnBookChange: true,
      independentReviewInvoked: false,
      verifierInvoked: false,
      arbitrageVerified: false,
      effects: { liveExecutionEnabled: false },
    });
    expect(desk.rescreenProjection().changedBooks).toEqual([
      expect.objectContaining({
        venueId: "polymarket-global",
        rawContentChanged: true,
        venueGenerationChanged: true,
      }),
    ]);
  });

  it("keeps every fixture byte-exact across real Git checkout modes", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "pmh-fixture-checkout-"));
    try {
      // Build the source commit in a temp repo so this test never changes the caller's Git state.
      const emptyConfigPath = resolve(tempRoot, "empty.gitconfig");
      await writeFile(emptyConfigPath, "");
      const git = gitEnvironment(emptyConfigPath);
      const sourceWithAttributes = resolve(tempRoot, "source-with-attributes");
      await mkdir(sourceWithAttributes, { recursive: true });
      await cp(fixtureRoot, resolve(sourceWithAttributes, "projects/fixtures"), {
        recursive: true,
      });
      await writeFile(
        resolve(sourceWithAttributes, ".gitattributes"),
        await readFile(resolve(repositoryRoot, ".gitattributes")),
      );
      await runGit(git, sourceWithAttributes, ["init", "--quiet"]);
      await runGit(git, sourceWithAttributes, ["config", "core.autocrlf", "false"]);
      await runGit(git, sourceWithAttributes, ["config", "user.name", "fixture test"]);
      await runGit(git, sourceWithAttributes, [
        "config",
        "user.email",
        "fixture-test@example.invalid",
      ]);
      await runGit(git, sourceWithAttributes, ["add", "--all"]);
      await runGit(git, sourceWithAttributes, [
        "commit",
        "--quiet",
        "-m",
        "fixture checkout attributes",
      ]);

      for (const autocrlf of ["true", "false"] as const) {
        const checkout = resolve(tempRoot, "checkout-" + autocrlf);
        await cloneRepository(
          git,
          sourceWithAttributes,
          checkout,
          autocrlf,
        );
        const checkoutFixtures = resolve(checkout, "projects/fixtures");
        await loadFixtureCorpusFrom(checkoutFixtures);
        const desk = new RealCandidatePreflightDesk(checkoutFixtures);
        await desk.load();
        expect(desk.projection()).toMatchObject({
          status: "BLOCKED",
          verifierInvoked: false,
          arbitrageVerified: false,
        });
      }

      const sourceWithoutAttributes = resolve(tempRoot, "source-without-attributes");
      await cloneRepository(
        git,
        sourceWithAttributes,
        sourceWithoutAttributes,
        "false",
      );
      await runGit(git, sourceWithoutAttributes, ["config", "user.name", "fixture test"]);
      await runGit(git, sourceWithoutAttributes, [
        "config",
        "user.email",
        "fixture-test@example.invalid",
      ]);
      await runGit(git, sourceWithoutAttributes, ["rm", "--quiet", "--", ".gitattributes"]);
      await runGit(git, sourceWithoutAttributes, [
        "commit",
        "--quiet",
        "-m",
        "negative control without fixture attributes",
      ]);

      const brokenCheckout = resolve(tempRoot, "checkout-without-attributes");
      await cloneRepository(
        git,
        sourceWithoutAttributes,
        brokenCheckout,
        "true",
      );
      await expect(
        loadRawFixture(
          resolve(brokenCheckout, "projects/fixtures", checkoutPayload),
          resolve(
            brokenCheckout,
            "projects/fixtures",
            checkoutPayload.replace(/\.json$/, ".meta.json"),
          ),
        ),
      ).rejects.toThrow("fixture hash mismatch");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 120_000);
});
