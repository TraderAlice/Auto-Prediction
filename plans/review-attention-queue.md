# Review attention queue

Status: active
Started: 2026-08-02

## Outcome

Turn the growing semantic-review journal into a small, deterministic operator
queue. The product should state which reviewed proposals can enter the existing
payoff compiler, which merely have research value, which need more evidence,
and which are recommended for rejection. Within the actionable class it should
show whether current indicative prices and anonymous public books are available.

## Evidence driving the plan

The retained runtime has 69 lifecycle cases and 30 passing semantic reviews,
but zero local research decisions. The review results comprise eight advisory
accepts, twelve escalations, and ten rejections. Seven of the eight accepts
conclude `RELATED` or `CONFLICTING`, which the deterministic relation-payoff
compiler cannot turn into a guaranteed-payout partition. The sole accepted,
compiler-supported `IMPLIES` pair is on Polymarket US, whose anonymous book is
not yet supported by the materializer. A flat list therefore overstates the
amount of promotion-ready work and hides the actual bottleneck.

## Architecture decision

The queue is a derived, content-addressed projection over durable proposal,
review, job-evidence, lifecycle-decision, and current-corpus state. It creates no
new decision authority or mutable scheduler state.

Each reviewed proposal receives four independent labels:

- operator posture: `DECISION_READY`, `RESEARCH_ONLY`,
  `EVIDENCE_ESCALATION`, or `REJECT_RECOMMENDED`;
- deterministic payoff readiness, using the same structural preconditions as
  the relation-payoff compiler;
- current indicative-price coverage and a fixed-point gross hint only when a
  canonical guaranteed-payout portfolio exists;
- anonymous-book coverage for the already implemented materializer venues.

The sort order is deterministic: undecided compiler-ready accepts first, then
research-only accepts, escalations, and rejections; within a class, fuller book
and current-price coverage precede lower missing-evidence count and recency.
Economic hints are attention signals only. They are neither executable quotes
nor profit claims.

## Construction slices

- [x] Extract one shared payoff-readiness classifier from the deterministic
  compiler so preview and post-decision compilation cannot drift.
- [x] Build and validate a bounded, content-addressed review-attention
  projection with deterministic ordering and no decision side effects.
- [x] Derive current price and anonymous-book coverage without substituting
  current semantics for the captured review evidence.
- [x] Expose queue counts, blockers, and top reviewed proposals in Studio.
- [x] Prove fixed-point arithmetic, stale/missing-price behavior, decision
  exclusion, recommendation classes, ordering, and authority locks.
- [x] Qualify the historical SQLite runtime and responsive Studio, then publish
  the next serial draft PR.

## Current qualification evidence

- Node.js 24.14.0 workspace typecheck, 320 tests, and production build pass.
- The retained SQLite runtime initially projected 30 latest passing reviews, of
  which 27 had reconstructable proposal evidence and three were named unresolved
  legacy inputs. During responsive inspection the live scheduler advanced the
  journal to 35 passing reviews and the derived queue to 32 items without a
  restart, retaining the same three explicit legacy gaps.
- The sole decision-ready item is an `IMPLIES` pair on Polymarket US. Both
  current contracts match their retained semantics, but the anonymous
  materializer does not cover that venue and the current fixed-point gross hint
  is `-490` bps before fees and depth. It is therefore first in operator
  attention while plainly not presented as an arbitrage.
- Browser inspection passed at the default 1280×720 desktop viewport and a
  415×900 mobile override. The queue renders two and one columns respectively,
  long proposal text wraps, both document scroll widths remain below the
  viewport widths, and the browser console contains no warnings or errors.

## Safety invariants

- The queue never calls a model, changes an issue priority, records an operator
  decision, starts materialization, or invokes the verifier.
- Current catalog data may provide price and book-reach hints only; it cannot
  replace the proposal-time rules used by semantic review.
- Monetary hints use `bigint` fixed-point/rational arithmetic and visibly omit
  fees and depth.
- AI recommendations remain advisory. Only the explicit local operator endpoint
  may accept or reject for research simulation.
- Invalid, incomplete, non-binary, or non-compilable inputs fail into a named
  queue blocker instead of being assigned a synthetic score.

## Qualification gate

- Fixture tests cover all recommendation classes and compiler-supported
  relation families.
- A positive indicative hint is computed without JavaScript `number`, and a
  missing or malformed price yields `PRICE_UNAVAILABLE`.
- A queue item disappears after an explicit retained operator decision and
  reappears deterministically when built from unchanged undecided artifacts.
- Projection identity changes when review, evidence, price, or book coverage
  changes.
- Full Node.js 24 typecheck, tests, and production build pass.
- Real projection explains why none of the current advisory accepts can proceed
  directly to anonymous exact simulation.
