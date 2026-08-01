import { resolve } from "node:path";
import {
  buildRealCandidatePreflightEvidence,
  loadRawFixture,
  type RealCandidatePreflightEvidence,
} from "@pmh/evidence";

export class RealCandidatePreflightDesk {
  readonly #fixtureRoot: string;
  #evidence: RealCandidatePreflightEvidence | undefined;
  #inFlight: Promise<RealCandidatePreflightEvidence> | undefined;

  public constructor(
    fixtureRoot = resolve(import.meta.dirname, "../../../projects/fixtures"),
  ) {
    this.#fixtureRoot = fixtureRoot;
  }

  public load(): Promise<RealCandidatePreflightEvidence> {
    if (this.#evidence !== undefined) return Promise.resolve(this.#evidence);
    if (this.#inFlight !== undefined) return this.#inFlight;
    const operation = this.#performLoad().finally(() => {
      this.#inFlight = undefined;
    });
    this.#inFlight = operation;
    return operation;
  }

  async #performLoad(): Promise<RealCandidatePreflightEvidence> {
    const load = (venueId: string, fixtureName: string) => {
      const base = resolve(
        this.#fixtureRoot,
        venueId,
        "2026-07-31",
        fixtureName,
      );
      return loadRawFixture(`${base}.json`, `${base}.meta.json`);
    };
    const [polymarket, opinion, limitless] = await Promise.all([
      load("polymarket-global", "polymarket-trump-out-2027"),
      load("opinion", "opinion-trump-out-2027"),
      load("limitless", "limitless-trump-out-2027"),
    ]);
    this.#evidence = buildRealCandidatePreflightEvidence({
      polymarket,
      opinion,
      limitless,
    });
    return this.#evidence;
  }

  public projection(): RealCandidatePreflightEvidence {
    if (this.#evidence === undefined) {
      throw new Error("real candidate preflight evidence is not loaded");
    }
    return this.#evidence;
  }
}
