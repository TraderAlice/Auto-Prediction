import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCampaignEvidence,
  ReplayBookDesk,
} from "../src/index.js";
import { runReplayChaosSuite } from "@pmh/market-state";

describe("campaign qualification evidence", () => {
  it("binds verified books and all replay hazards into one artifact", async () => {
    const bookDesk = await new ReplayBookDesk().replay();
    const bundle = buildCampaignEvidence(bookDesk, runReplayChaosSuite());
    expect(bundle.status).toBe("PASS");
    expect(bundle.sourceArtifacts).toHaveLength(3);
    expect(bundle.assertions.every((item) => item.status === "PASS")).toBe(
      true,
    );
    expect(bundle.effects).toEqual({
      externalWrites: false,
      valueMovingActions: false,
      liveExecutionEnabled: false,
    });
    expect(bundle.artifactHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("matches the checked-in immutable campaign artifact", async () => {
    const bookDesk = await new ReplayBookDesk().replay();
    const actual = buildCampaignEvidence(bookDesk, runReplayChaosSuite());
    const artifactPath = resolve(
      import.meta.dirname,
      "../../../projects/campaigns/architecture-qualification/replay-integrity.v1.json",
    );
    const expected = JSON.parse(await readFile(artifactPath, "utf8"));
    expect(actual).toEqual(expected);
  });
});
