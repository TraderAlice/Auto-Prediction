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
- [x] Map one claim across at least three venue fixtures.

## Campaign C — Arbitrage truth

- [x] Compile complete-set, exhaustive multi-outcome, and same-claim cross-venue candidates.
- [x] Reject resolution mismatch.
- [x] Account for fee, depth, precision, and capital bounds.
- [x] Independently verify candidates with exact `bigint` arithmetic.
- [x] Bind certificates to every changing input and book generation.

## Campaign D — External loop

- [x] Capture raw streams and content-addressed manifests.
- [x] Deterministically replay snapshot/delta books.
- [x] Fail closed on gap, stale, reconnect, tick change, and generation mismatch.
- [x] Simulate multi-leg execution, partial fills, UNKNOWN reconciliation, and capital conservation.
- [x] Emit immutable campaign evidence.

## Campaign E — Liquidity export

- [x] Generate executable hedge curves from multiple venues.
- [x] Generate constrained shadow maker quotes for one low-liquidity venue.
- [x] Prove spread, size, inventory, and hedge constraints.

## Campaign F — AI-native discovery desk

- [x] Run a long-lived control-plane process behind Studio.
- [x] Define parallel heuristic/model discovery-worker ports.
- [x] Enforce proposal-only, unreviewed, no-execution AI output.
- [x] Retain bounded discovery runs and stream the Scout Inbox projection.
- [x] Persist discovery runs and task idempotency across control-plane restarts.
- [x] Connect a fail-closed, budgeted external model provider adapter.
- [x] Ground every non-empty scout hypothesis in a bounded, content-addressed catalog context.
- [ ] Qualify one real provider response with a user-supplied `OPENAI_API_KEY`.
- [x] Feed reviewed hypotheses into deterministic candidate compilation.
- [x] Stream real replay book state into Studio.

## Verification gate

- [x] Focused fixture and contract tests.
- [x] Fixed-point and payout property tests.
- [x] Replay chaos tests.
- [x] Solver/verifier adversarial tests.
- [x] Execution and capital state-model tests.
- [x] CLI JSON-envelope tests.
- [x] Studio projection safety and production-build tests.
- [x] SQLite migration, corruption, retention, restart, and concurrency tests.
- [x] Explicit live-disabled proof.
- [x] Full workspace checkpoint on the target runtime.

## Decisions and deviations

Record evidence-driven changes here before promoting them into stable design documents.

- 2026-07-31: Hedge curves rank executable depth by all-in marginal collateral. BUY allocations round costs up; SELL allocations round proceeds down.
- 2026-07-31: Maker export remains shadow-only and requires an economically valid spread after fee, execution, resolution-mismatch, venue, capital-lock, and inventory premiums.
- 2026-07-31: CLI schema `pmh.cli.v1` makes external writes, value movement, and live execution explicit literal-false effects.
- 2026-07-31: The target-runtime gate is qualified under isolated Node.js 24.18.1 with the full typecheck, 122-test workspace suite, and production builds passing.
- 2026-07-31: OpenAI Responses is the first external discovery adapter. It defaults to `gpt-5.4-mini`, strict Structured Outputs, `store:false`, minimal reasoning, an 800 output-token ceiling, and an 8-second timeout; without `OPENAI_API_KEY`, the model worker is absent and heuristic discovery remains available.
- 2026-07-31: The budgeted model adapter passes the full 129-test workspace suite, typecheck, and production build under Node.js 24.14.0; the live Studio projection also passes desktop and 430px layout inspection without console warnings or horizontal overflow.
- 2026-07-31: Catalog-grounded discovery expands the Node.js 24.14.0 checkpoint to 134 passing tests plus typecheck and production build.
- 2026-07-31: Studio consumes a live control-plane projection and SSE stream; browser code presents state and does not recompute verifier verdicts.
- 2026-07-31: AI is trusted for subjective search hypotheses only. Every model output remains UNREVIEWED, has no execution authority, and must cross deterministic compilation plus independent exact verification.
- 2026-07-31: Public realtime qualification is venue-specific. Gemini deltas use native update ranges and fail closed on gaps; Polymarket and Limitless replacement images enter explicit rebuild because their public full-book paths do not provide equivalent delta sequencing guarantees.
- 2026-07-31: The control plane owns deterministic book replay and broadcasts projections over SSE. Studio renders lifecycle and depth but never derives authoritative state in the browser.
- 2026-07-31: Discovery runs are retained in a 25-entry SQLite WAL ledger and streamed to Scout Inbox. Promotion controls remain absent until independent equivalence-review authority is configured.
- 2026-07-31: Kalshi demo and Gemini sandbox order gateways model current official submit/cancel/reconcile request shapes but have no transport, nonce generator, signer, credential input, or value-moving path. Every operation returns a hash-bound `REJECTED_INERT` receipt and qualifies only at `DISCOVER`.
- 2026-07-31: Replay chaos qualification deterministically injects sequence gaps, stale marks, reconnect-without-snapshot, off-tick deltas, tick-size change, and generation mismatch. Off-tick batches validate atomically before mutation and invalidate the book on rejection.
- 2026-07-31: The replay-integrity campaign artifact binds three verified stream/state identities, six chaos-case evidence hashes, literal-false effects, and a self identity. A golden test locks the checked-in JSON to the runtime projection.
- 2026-07-31: A hypothesis never mutates into an approved fact. A separate `pmh.hypothesis-review.v1` artifact must bind it and the complete exact market-link evidence set before compilation; proposer self-review, substituted links, non-exact grades, unreviewed venues, stale books, and non-positive floors all fail closed.
- 2026-07-31: `reviewed-compilation.v1.json` qualifies the synthetic compilation handoff but grants no runtime review or execution authority. The separate `three-venue-claim.v1.json` artifact binds identical real resolution rules across Polymarket Global, Opinion, and Limitless without treating different listing windows as claim semantics.
- 2026-07-31: SQLite WAL owns bounded discovery operational state only; Git remains the authority for immutable fixtures and campaign artifacts. Records are stored as canonical JSON with SHA-256 identities, schema version 1 fails closed on incompatible future databases, and normalized task content produces a stable default `taskId`.
- 2026-07-31: External model discovery is an optional control-plane capability, never a browser capability. The projection exposes non-secret budget posture only, and model output is schema-checked plus task-scope-checked before the process reconstructs `PROPOSE_ONLY` / `UNREVIEWED` authority fields.
- 2026-07-31: A discovery task is grounded in at most 30 listings selected from 11 normalized listings in six verified fixture artifacts across five venues. Context identity participates in default `taskId` and durable scope; every non-empty hypothesis cites in-scope listing references, while an empty grounded result remains valid.

## Blockers

The adapter and deterministic tests are complete. One real provider smoke run
needs a user-supplied `OPENAI_API_KEY`; the heuristic-only runtime is not
blocked by its absence.
