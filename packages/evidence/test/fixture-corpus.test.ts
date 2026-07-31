import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRawFixture } from "../src/index.js";

const fixtureRoot = resolve(
  import.meta.dirname,
  "../../../projects/fixtures",
);

async function metadataFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".meta.json"))
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort();
}

describe("checked-in fixture corpus", () => {
  it("binds every raw payload to anonymous read-only evidence", async () => {
    const paths = await metadataFiles(fixtureRoot);
    expect(paths).toHaveLength(9);
    for (const metadataPath of paths) {
      const payloadPath = metadataPath.replace(/\.meta\.json$/, ".json");
      const fixture = await loadRawFixture(payloadPath, metadataPath);
      expect(fixture.metadata.acquisition).toEqual({
        method: "GET",
        credentialsUsed: false,
        valueMovingOperation: false,
      });
    }
  });
});
