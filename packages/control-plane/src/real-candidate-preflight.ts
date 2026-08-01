import { resolve } from "node:path";
import {
  buildRealCandidateDepthEvidence,
  buildRealCandidateDispositionEvidence,
  buildRealCandidatePreflightEvidence,
  buildRealCandidateRescreenEvidence,
  loadRawFixture,
  type RealCandidateDepthEvidence,
  type RealCandidateBookFixtureNames,
  type RealCandidateDispositionEvidence,
  type RealCandidatePreflightEvidence,
  type RealCandidateRescreenEvidence,
  type VerifiedRawFixture,
} from "@pmh/evidence";

type CandidateSourceFixtures = Readonly<{
  polymarket: VerifiedRawFixture;
  opinion: VerifiedRawFixture;
  limitless: VerifiedRawFixture;
  limitlessFees: VerifiedRawFixture;
}>;

const currentBookFixtureNames = Object.freeze({
  polymarket: "polymarket-trump-out-2027-book-rescreen-1",
  limitless: "limitless-trump-out-2027-book-rescreen-1",
});

export class RealCandidatePreflightDesk {
  readonly #fixtureRoot: string;
  #evidence: RealCandidatePreflightEvidence | undefined;
  #depthEvidence: RealCandidateDepthEvidence | undefined;
  #dispositionEvidence: RealCandidateDispositionEvidence | undefined;
  #rescreenEvidence: RealCandidateRescreenEvidence | undefined;
  #sourceFixtures: CandidateSourceFixtures | undefined;
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
    const [
      polymarket,
      opinion,
      limitless,
      previousPolymarketBook,
      previousLimitlessBook,
      currentPolymarketBook,
      currentLimitlessBook,
      limitlessFees,
    ] = await Promise.all([
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
        load(
          "polymarket-global",
          "2026-08-01",
          currentBookFixtureNames.polymarket,
        ),
        load(
          "limitless",
          "2026-08-01",
          currentBookFixtureNames.limitless,
        ),
        load("limitless", "2026-08-01", "limitless-fees"),
      ]);
    this.#depthEvidence = buildRealCandidateDepthEvidence({
      polymarket,
      opinion,
      limitless,
      polymarketBook: currentPolymarketBook,
      limitlessBook: currentLimitlessBook,
      bookFixtureNames: currentBookFixtureNames,
    });
    this.#dispositionEvidence = buildRealCandidateDispositionEvidence({
      polymarket,
      opinion,
      limitless,
      polymarketBook: currentPolymarketBook,
      limitlessBook: currentLimitlessBook,
      bookFixtureNames: currentBookFixtureNames,
      limitlessFees,
    });
    this.#rescreenEvidence = buildRealCandidateRescreenEvidence({
      polymarket,
      opinion,
      limitless,
      limitlessFees,
      previousPolymarketBook,
      previousLimitlessBook,
      currentPolymarketBook,
      currentLimitlessBook,
      currentBookFixtureNames,
    });
    this.#sourceFixtures = Object.freeze({
      polymarket,
      opinion,
      limitless,
      limitlessFees,
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

  public dispositionProjection(): RealCandidateDispositionEvidence {
    if (this.#dispositionEvidence === undefined) {
      throw new Error("real candidate disposition evidence is not loaded");
    }
    return this.#dispositionEvidence;
  }

  public rescreenProjection(): RealCandidateRescreenEvidence {
    if (this.#rescreenEvidence === undefined) {
      throw new Error("real candidate rescreen evidence is not loaded");
    }
    return this.#rescreenEvidence;
  }

  public screenBooks(input: Readonly<{
    polymarketBook: VerifiedRawFixture;
    limitlessBook: VerifiedRawFixture;
    bookFixtureNames: RealCandidateBookFixtureNames;
  }>): Readonly<{
    depth: RealCandidateDepthEvidence;
    disposition: RealCandidateDispositionEvidence | null;
  }> {
    if (this.#sourceFixtures === undefined) {
      throw new Error("real candidate source evidence is not loaded");
    }
    const screenInput = {
      ...this.#sourceFixtures,
      ...input,
    };
    const depth = buildRealCandidateDepthEvidence(screenInput);
    const disposition =
      BigInt(depth.grossFloorBeforeFees) <= 0n
        ? buildRealCandidateDispositionEvidence(screenInput)
        : null;
    return Object.freeze({ depth, disposition });
  }
}
