# Architecture Qualification Campaign

Status: active
Started: 2026-07-31

## Outcome

Qualify a prediction-market interoperability architecture against current official venue evidence without using credentials or real funds.

## Campaign A — Venue reality

- [x] Census at least eight venue families from official sources.
- [ ] Capture at least six heterogeneous mechanism fixtures.
- [ ] Implement at least five catalog adapters.
- [ ] Implement at least three realtime-book adapters.
- [ ] Implement two inert order-gateway contracts, including one demo/sandbox-shaped gateway.
- [ ] Publish capability, precision, limitations, and qualification evidence per adapter.

## Campaign B — Contract truth

- [ ] Implement Claim, Resolution Specification, Outcome Space, Listing, and payout algebra.
- [ ] Represent binary, exhaustive/non-exhaustive categorical, scalar/range, conditional, multivariate, void, and canceled states.
- [ ] Implement hash-bound UNREVIEWED proposals and independent accepted/rejected review artifacts.
- [ ] Map one claim across at least three venue fixtures.

## Campaign C — Arbitrage truth

- [ ] Compile complete-set, exhaustive multi-outcome, and same-claim cross-venue candidates.
- [ ] Reject resolution mismatch.
- [ ] Account for fee, depth, precision, and capital bounds.
- [ ] Independently verify candidates with exact `bigint` arithmetic.
- [ ] Bind certificates to every changing input and book generation.

## Campaign D — External loop

- [ ] Capture raw streams and content-addressed manifests.
- [ ] Deterministically replay snapshot/delta books.
- [ ] Fail closed on gap, stale, reconnect, tick change, and generation mismatch.
- [ ] Simulate multi-leg execution, partial fills, UNKNOWN reconciliation, and capital conservation.
- [ ] Emit immutable campaign evidence.

## Campaign E — Liquidity export

- [ ] Generate executable hedge curves from multiple venues.
- [ ] Generate constrained shadow maker quotes for one low-liquidity venue.
- [ ] Prove spread, size, inventory, and hedge constraints.

## Verification gate

- [ ] Focused fixture and contract tests.
- [ ] Fixed-point and payout property tests.
- [ ] Replay chaos tests.
- [ ] Solver/verifier adversarial tests.
- [ ] Execution and capital state-model tests.
- [ ] CLI JSON-envelope tests.
- [ ] Explicit live-disabled proof.
- [ ] Full workspace checkpoint on the target runtime.

## Decisions and deviations

Record evidence-driven changes here before promoting them into stable design documents.

## Blockers

No user-supplied blocker at campaign start.
