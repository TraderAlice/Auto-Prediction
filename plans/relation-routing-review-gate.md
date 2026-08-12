# Relation routing versus payoff-review admission

Status: qualified mainline candidate

Issue: [#123](https://github.com/luokerenx4/my-little-pony/issues/123)

Branch: `codex/relation-routing-review-gate`

## North-star role

An AI-native arbitrage machine needs broad semantic recall to navigate the
market universe, but not every useful semantic edge is an arbitrage hypothesis.
Entity alias and topic relatedness should expand search neighborhoods. Payoff
semantic review should spend attention only on claims capable of constraining
joint outcomes or conditional probabilities.

## Live evidence

Run `sha256:f59503c187007eefe89969d69876d541ffe94a503e682bfbb0758c4bc7370ea5`
worked an `ENTITY_ALIAS_NEIGHBORHOOD` and produced two deliberately different
effects:

- a `RELATED` hypothesis stating that two listings share the exact Lula entity
  string while settling different proposition types; and
- a counterexample rejecting `IMPLIES` between their YES outcomes.

The first finding is valuable routing memory. The downstream independent review
correctly returned `TEXTUAL_RELATEDNESS / ESCALATE` and admitted no probability
job. Sending a fresh equivalent routing edge through the expensive review lane
would repeat a distinction the work kind already knows.

## Decision

Classify relation-discovery positives into two first-party admission lanes:

1. `ONTOLOGY_ROUTING_ONLY` for `RELATED`; retain and project it, but do not use
   it to create a new semantic-review candidate.
2. `SEMANTIC_PAYOFF_REVIEW` for `EQUIVALENT`, `IMPLIES`, `SUBSET`,
   `MUTUALLY_EXCLUSIVE`, `EXHAUSTIVE`, `CONDITIONAL`, and `CONFLICTING`;
   preserve the existing independent review gate and all downstream authority
   boundaries.

Historical semantic-review jobs remain connected and auditable even if the
current admission policy would now route their originating finding differently.
The policy changes future candidate creation, not retained history.

## Implementation phases

### Phase 1 — explicit admission policy

- [x] Add a deterministic, exhaustively tested relation review-lane classifier.
- [x] Keep compilation/evidence retention unchanged for both lanes.
- [x] Filter only new relation-derived semantic-review candidate supply.

### Phase 2 — observable value routing

- [x] Expose routing-only and payoff-review counts in relation discovery.
- [x] Expose each compilation's current review eligibility alongside any
  historical connected job.
- [x] Apply the same admission policy to research-attention candidate counts and
  action supply, while retaining historical review attribution.
- [x] Keep read paths zero-inference and zero-write.

### Phase 3 — qualification

- [x] Prove a `RELATED` finding remains durable/projected but does not become a
  fresh semantic-review candidate.
- [x] Prove every payoff-bearing relation kind remains review-eligible.
- [x] Run checks, all suites, production build, and retained-live-state reads.

## Implementation checkpoint — 2026-08-12

The first-party classifier now assigns `RELATED` to ontology routing and every
other retained market-relation kind to payoff review. Compilation and evidence
bundles remain immutable for both lanes; only relation-derived candidate supply
is filtered. Relation discovery exposes current lane, routing-only count,
payoff-review candidate count, and historical connected review independently.
Research attention uses the same policy: a routing-only finding can retain a
historical semantic review and value-stage attribution, but that job does not
create an `ADVANCE_RESEARCH_DEBT` action.

Against the retained SQLite state, two positive compilations remain visible.
One is payoff-review eligible. The Lula entity-neighborhood specimen reports
one positive finding, one counterexample, one routing-only compilation, zero
semantic-review candidates, and its historical
`PASS / ESCALATE / TEXTUAL_RELATEDNESS` review. Its research-attention family is
held and contributes no portfolio action. Repeated projection reads report zero
provider requests, model invocations, campaigns, or runs started by the read.

Workspace type checks, all suites (86 control-plane files / 603 tests, four
Studio files / 24 tests, and all remaining packages), and the production build
pass. The known Node 24 engine expectation and existing Studio chunk-size
warning remain.

## Non-goals

- deleting the live hypothesis, counterexample, semantic review, or usage cost;
- declaring any payoff relation semantically valid without independent review;
- suppressing entity-routing evidence from ontology/search consumers;
- changing provider, runtime, model, or effort selection;
- live orders, signatures, transactions, credentials, or funds.
