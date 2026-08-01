import { resolve } from "node:path";
import {
  buildRealCandidateDepthEvidence,
  buildRealCandidatePreflightEvidence,
  loadRawFixture,
  type RealCandidateDepthEvidence,
  type RealCandidatePreflightEvidence,
} from "@pmh/evidence";

export class RealCandidatePreflightDesk {
  readonly #fixtureRoot: string;
  #evidence: RealCandidatePreflightEvidence | undefined;
  #depthEvidence: RealCandidateDepthEvidence | undefined;
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
    const load = (venueId: string, date: string, fixtureName: string) => {
      const base = resolve(
        this.#fixtureRoot,
        venueId,
        date,
        fixtureName,
      );
      return loadRawFixture(`${base}.json`, `${base}.meta.json`);
    };
    const [polymarket, opinion, limitless, polymarketBook, limitlessBook] =
      await Promise.all([
        load(
          "polymarket-global",
          "2026-07-31",
          "polymarket-trump-out-2027",
        ),
        load("opinion", "2026-07-31", "opinion-trump-out-2027"),
        load("limitless", "2026-07-31", "limitless-trump-out-2027"),
        load(
          "polymarket-global",
          "2026-08-01",
          "polymarket-trump-out-2027-book",
        ),
        load(
          "limitless",
          "2026-08-01",
          "limitless-trump-out-2027-book",
        ),
      ]);
    this.#depthEvidence = buildRealCandidateDepthEvidence({
      polymarket,
      opinion,
      limitless,
      polymarketBook,
      limitlessBook,
    });
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

  public depthProjection(): RealCandidateDepthEvidence {
    if (this.#depthEvidence === undefined) {
      throw new Error("real candidate depth evidence is not loaded");
    }
    return this.#depthEvidence;
  }
}
