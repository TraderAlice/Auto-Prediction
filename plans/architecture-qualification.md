# Architecture Qualification Campaign

Status: active
Started: 2026-07-31

## Outcome

Qualify a prediction-market interoperability architecture against current official venue evidence without using credentials or real funds.

## Campaign A — Venue reality

- [x] Census at least eight venue families from official sources.
- [x] Capture at least six heterogeneous mechanism fixtures.
- [x] Implement at least five catalog adapters.
- [x] Implement at least three realtime-book adapters.
- [x] Implement two inert order-gateway contracts, including one demo/sandbox-shaped gateway.
- [x] Publish capability, precision, limitations, and qualification evidence per adapter.

## Campaign B — Contract truth

- [x] Implement Claim, Resolution Specification, Outcome Space, Listing, and payout algebra.
- [x] Represent binary, exhaustive/non-exhaustive categorical, scalar/range, conditional, multivariate, void, and canceled states.
- [x] Implement hash-bound UNREVIEWED proposals and independent accepted/rejected review artifacts.
- [ ] Map one claim across at least three venue fixtures.

## Campaign C — Arbitrage truth

- [x] Compile complete-set, exhaustive multi-outcome, and same-claim cross-venue candidates.
- [x] Reject resolution mismatch.
- [x] Account for fee, depth, precision, and capital bounds.
- [x] Independently verify candidates with exact `bigint` arithmetic.
- [x] Bind certificates to every changing input and book generation.

## Campaign D — External loop

- [x] Capture raw streams and content-addressed manifests.
- [x] Deterministically replay snapshot/delta books.
- [ ] Fail closed on gap, stale, reconnect, tick change, and generation mismatch.
- [x] Simulate multi-leg execution, partial fills, UNKNOWN reconciliation, and capital conservation.
- [ ] Emit immutable campaign evidence.

## Campaign E — Liquidity export

- [x] Generate executable hedge curves from multiple venues.
- [x] Generate constrained shadow maker quotes for one low-liquidity venue.
- [x] Prove spread, size, inventory, and hedge constraints.

## Campaign F — AI-native discovery desk

- [x] Run a long-lived control-plane process behind Studio.
- [x] Define parallel heuristic/model discovery-worker ports.
- [x] Enforce proposal-only, unreviewed, no-execution AI output.
- [x] Retain bounded discovery runs and stream the Scout Inbox projection.
- [ ] Connect a budgeted external model provider.
- [ ] Feed reviewed hypotheses into deterministic candidate compilation.
- [x] Stream real replay book state into Studio.

## Verification gate

- [x] Focused fixture and contract tests.
- [x] Fixed-point and payout property tests.
- [ ] Replay chaos tests.
- [ ] Solver/verifier adversarial tests.
- [x] Execution and capital state-model tests.
- [x] CLI JSON-envelope tests.
- [x] Studio projection safety and production-build tests.
- [x] Explicit live-disabled proof.
- [ ] Full workspace checkpoint on the target runtime.

## Decisions and deviations

Record evidence-driven changes here before promoting them into stable design documents.

- 2026-07-31: Hedge curves rank executable depth by all-in marginal collateral. BUY allocations round costs up; SELL allocations round proceeds down.
- 2026-07-31: Maker export remains shadow-only and requires an economically valid spread after fee, execution, resolution-mismatch, venue, capital-lock, and inventory premiums.
- 2026-07-31: CLI schema `pmh.cli.v1` makes external writes, value movement, and live execution explicit literal-false effects.
- 2026-07-31: Studio consumes a live control-plane projection and SSE stream; browser code presents state and does not recompute verifier verdicts.
- 2026-07-31: AI is trusted for subjective search hypotheses only. Every model output remains UNREVIEWED, has no execution authority, and must cross deterministic compilation plus independent exact verification.
- 2026-07-31: Public realtime qualification is venue-specific. Gemini deltas use native update ranges and fail closed on gaps; Polymarket and Limitless replacement images enter explicit rebuild because their public full-book paths do not provide equivalent delta sequencing guarantees.
- 2026-07-31: The control plane owns deterministic book replay and broadcasts projections over SSE. Studio renders lifecycle and depth but never derives authoritative state in the browser.
- 2026-07-31: Discovery runs are retained in a 25-entry in-memory ledger and streamed to Scout Inbox. Promotion controls remain absent until independent equivalence-review authority is configured.
- 2026-07-31: Kalshi demo and Gemini sandbox order gateways model current official submit/cancel/reconcile request shapes but have no transport, nonce generator, signer, credential input, or value-moving path. Every operation returns a hash-bound `REJECTED_INERT` receipt and qualifies only at `DISCOVER`.

## Blockers

No user-supplied blocker at campaign start.
