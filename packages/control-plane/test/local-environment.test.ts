import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLocalEnvironment } from "../src/index.js";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalPiModel = process.env.PMH_PI_MODEL;
const directories: string[] = [];

afterEach(async () => {
  if (originalDeepSeekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
  if (originalPiModel === undefined) delete process.env.PMH_PI_MODEL;
  else process.env.PMH_PI_MODEL = originalPiModel;
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("local environment", () => {
  it("loads a local env file while preserving inherited variables", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-local-env-"));
    directories.push(directory);
    const path = join(directory, ".env.local");
    await writeFile(
      path,
      "DEEPSEEK_API_KEY=file-key\nPMH_PI_MODEL=deepseek-v4-pro\n",
      { mode: 0o600 },
    );
    process.env.DEEPSEEK_API_KEY = "inherited-key";
    delete process.env.PMH_PI_MODEL;

    expect(loadLocalEnvironment(path)).toBe(true);
    expect(process.env.DEEPSEEK_API_KEY).toBe("inherited-key");
    expect(process.env.PMH_PI_MODEL).toBe("deepseek-v4-pro");
  });

  it("treats a missing local env file as optional", () => {
    expect(loadLocalEnvironment("/definitely/missing/pmh.env")).toBe(false);
  });
});
