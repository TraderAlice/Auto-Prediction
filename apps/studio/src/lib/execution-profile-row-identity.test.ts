import { describe, expect, it } from "vitest";

import { executionProfileRowIdentity } from "./execution-profile-row-identity.js";

const terraCodex = {
  executionProfileId: `sha256:${"a".repeat(64)}`,
  profileKey: "rule-evidence-codex-app-server",
  revision: 1006,
} as const;

const terraOntology = {
  executionProfileId: `sha256:${"b".repeat(64)}`,
  profileKey: "ontology-codex-app-server",
  revision: 1002,
} as const;

describe("execution profile row identity", () => {
  it("shows the picker rN plus profileKey and a short id", () => {
    expect(executionProfileRowIdentity(terraCodex)).toBe(
      "r1006 · rule-evidence-codex-app-server · aaaaaaaaaa",
    );
  });

  it("distinguishes same-runtime same-model rows the picker would otherwise collapse", () => {
    const left = executionProfileRowIdentity(terraCodex);
    const right = executionProfileRowIdentity(terraOntology);
    expect(left).not.toBe(right);
    expect(left).toContain("r1006");
    expect(right).toContain("r1002");
    expect(left).toContain("rule-evidence-codex-app-server");
    expect(right).toContain("ontology-codex-app-server");
    expect(left).toContain("aaaaaaaaaa");
    expect(right).toContain("bbbbbbbbbb");
  });

  it("keeps later revisions of the same profileKey distinct", () => {
    expect(executionProfileRowIdentity({
      ...terraCodex,
      executionProfileId: `sha256:${"c".repeat(64)}`,
      revision: 2006,
    })).toBe("r2006 · rule-evidence-codex-app-server · cccccccccc");
  });

  it("does not turn the capability list into a run or campaign control", () => {
    const label = executionProfileRowIdentity(terraCodex).toLowerCase();
    expect(label).not.toContain("preflight");
    expect(label).not.toContain("run");
    expect(label).not.toContain("campaign");
    expect(label).not.toContain("spend");
  });
});
