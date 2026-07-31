import { describe, expect, it } from "vitest";
import { assertManifest } from "../src/index.js";

describe("venue capability manifest", () => {
  it("proves live execution is disabled and qualification is chained", () => {
    expect(
      assertManifest({
        venueId: "gemini-predictions",
        displayName: "Gemini Prediction Markets",
        adapterVersion: "0.0.0",
        protocolIdentity: "rest-v1:2026-07-30",
        officialSources: [
          "https://developer.gemini.com/prediction-markets/prediction-markets",
        ],
        mechanisms: ["centralized binary event contracts"],
        precisionRules: ["prices and quantities arrive as decimal strings"],
        authenticationBoundary: "public catalog; authenticated trading excluded",
        capabilities: [
          {
            capability: "MARKET_CATALOG",
            implemented: true,
            qualification: ["DISCOVER"],
            evidenceRefs: ["fixture:gemini-events"],
            limitations: ["fixture-only adapter"],
          },
        ],
        liveExecutionEnabled: false,
      }),
    ).toBeTruthy();
  });

  it("rejects skipped qualification stages", () => {
    expect(() =>
      assertManifest({
        venueId: "bad",
        displayName: "Bad manifest",
        adapterVersion: "0",
        protocolIdentity: "unknown",
        officialSources: ["https://example.com"],
        mechanisms: ["test"],
        precisionRules: ["test"],
        authenticationBoundary: "none",
        capabilities: [
          {
            capability: "REALTIME_BOOK",
            implemented: true,
            qualification: ["DISCOVER", "PRICE"],
            evidenceRefs: ["test"],
            limitations: [],
          },
        ],
        liveExecutionEnabled: false,
      }),
    ).toThrow(/lacks prerequisite OBSERVE/);
  });
});
