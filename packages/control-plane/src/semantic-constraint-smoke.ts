import { hashCanonical } from "@pmh/domain";
import { buildMarketCorpusSnapshot } from "./market-corpus.js";
import { createSemanticReviewDesk } from "./semantic-review.js";
import type { MarketRelationProposal } from "./market-archaeologist.js";

export async function runSemanticConstraintSmoke(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Readonly<Record<string, unknown>>> {
  const receivedAt = new Date().toISOString();
  const listings = [
    {
      listingRef: "smoke:trump-shot-august",
      venueId: "smoke-a",
      venueInstrumentId: "trump-shot-august",
      title: "Will Trump be shot in August?",
      description: "Any firearm projectile striking Trump counts, whether fatal or non-fatal.",
      status: "OPEN",
      mechanism: "CLOB",
      closesAt: "2026-09-01T00:00:00.000Z",
      rulesText: "Resolves Yes if a firearm projectile strikes Trump during August. Injury severity and survival do not affect settlement.",
      outcomes: [
        { venueOutcomeId: "shot-yes", label: "Yes", indicativePrice: null },
        { venueOutcomeId: "shot-no", label: "No", indicativePrice: null },
      ],
      priceScale: "1000000",
      quantityScale: "1000000",
      minPriceTick: "1000",
      sourceKind: "LIVE_OBSERVATION" as const,
      sourceReceivedAt: receivedAt,
      sourceRawHash: hashCanonical({ fixture: "shot-rule-v1" }),
      protocolIdentity: "smoke-protocol:shot-v1",
    },
    {
      listingRef: "smoke:trump-live-cola-september",
      venueId: "smoke-b",
      venueInstrumentId: "trump-live-cola-september",
      title: "Will Trump drink cola on a public livestream in September?",
      description: "A personal real-time public video appearance drinking cola counts.",
      status: "OPEN",
      mechanism: "CLOB",
      closesAt: "2026-10-01T00:00:00.000Z",
      rulesText: "Resolves Yes if Trump personally appears in a public real-time video during September and visibly drinks cola.",
      outcomes: [
        { venueOutcomeId: "cola-yes", label: "Yes", indicativePrice: null },
        { venueOutcomeId: "cola-no", label: "No", indicativePrice: null },
      ],
      priceScale: "1000000",
      quantityScale: "1000000",
      minPriceTick: "1000",
      sourceKind: "LIVE_OBSERVATION" as const,
      sourceReceivedAt: receivedAt,
      sourceRawHash: hashCanonical({ fixture: "cola-rule-v1" }),
      protocolIdentity: "smoke-protocol:cola-v1",
    },
  ];
  const snapshot = buildMarketCorpusSnapshot({
    sourceSetIdentity: hashCanonical({ smoke: "semantic-constraint" }),
    eligibleSourceCount: 2,
    excludedSourceCount: 0,
    listings,
  });
  const proposalBody = {
    relationKind: "MUTUALLY_EXCLUSIVE" as const,
    listingRefs: listings.map((listing) => listing.listingRef),
    statement: "An August shooting and a September personal live cola appearance are mutually exclusive.",
    rationale: "Adversarial smoke input: inspect whether a non-fatal shooting defeats exclusion.",
    falsifiers: ["A non-fatal shooting followed by recovery and a September live appearance."],
    authority: "PROPOSE_ONLY" as const,
    reviewStatus: "UNREVIEWED" as const,
    executionAuthority: false as const,
  };
  const proposal: MarketRelationProposal = Object.freeze({
    ...proposalBody,
    proposalId: hashCanonical({
      corpusSnapshotIdentity: snapshot.snapshotIdentity,
      ...proposalBody,
    }),
  });
  const desk = createSemanticReviewDesk(environment);
  const record = await desk.begin(`ai:${proposal.proposalId}`, proposal, snapshot).promise;
  if (
    record.status !== "PASS" || record.report?.schemaVersion !== "pmh.semantic-review-report.v2" ||
    record.report.result.semanticConstraint === undefined
  ) throw new Error(record.diagnostic ?? "semantic constraint smoke did not produce a v2 tool effect");
  const constraint = record.report.result.semanticConstraint;
  return Object.freeze({
    schemaVersion: "pmh.semantic-constraint-smoke.v1",
    status: "PASS",
    model: record.model,
    reviewArtifactHash: record.report.artifactHash,
    constraintArtifactHash: constraint.artifactHash,
    classification: constraint.classification,
    exactCompilerAdmission: constraint.exactCompilerAdmission,
    counterexampleResult: constraint.counterexampleAttempt.result,
    truthStateCount: constraint.truthTable.length,
    wholeResponseSchemaParsing: record.report.trace?.wholeResponseSchemaParsing,
    authority: constraint.authority,
    certificateAuthority: constraint.certificateAuthority,
    executionAuthority: constraint.executionAuthority,
  });
}
