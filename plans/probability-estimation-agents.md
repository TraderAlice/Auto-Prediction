# Role-separated probability estimation agents

Status: active; tool loop, abstention, durable run journal, concurrent automatic
scheduling, conservative bound assembly, notification inbox, and Studio
observability implemented locally; external evidence tools and calibration remain

Created: 2026-08-02

## Objective

Turn a passed `PROBABILISTIC_DEPENDENCE` semantic review into evidence-bound
adverse-state probability intervals without forcing an LLM response through a
whole-response schema or treating model confidence as probability.

## Implemented contract

- Three independent roles are available: `REFERENCE_CLASS`, `CAUSAL`, and
  `INDEPENDENT`. The role fixes the estimation method outside the model.
- Every Agent invocation is a bounded AI SDK tool loop. It must first call
  `record_counter_scenario` for a concrete route by which an adverse state can
  occur, then either `submit_probability_estimate` or
  `abstain_probability_estimate`.
- Submitted evidence hashes must belong to the exact reviewed listing scope.
  Invented hashes and out-of-scope adverse states fail at the tool boundary and
  again at the model-port boundary.
- Numeric submissions use integer ppm intervals, explicit assumptions, a
  bounded validity period, and evidence hashes. Abstention is retained as a
  successful research outcome rather than converted into a fabricated number.
- `pmh.probability-estimation-run.v1` binds review, semantic constraint,
  retained catalog context, role, model, counter-scenarios, estimate, trace,
  and authority. Whole-response schema parsing is explicitly false.
- SQLite schema v25 persists running and terminal records. A process restart
  converts an interrupted run to retryable `FAILED` instead of leaving an
  immortal lease.
- The control plane exposes the desk and scheduler at
  `GET /api/v1/probability-estimation` and accepts bounded manual research runs at
  `POST /api/v1/probability-estimation/runs`.
- A durable scheduler derives relation-specific adverse states, fans every
  admitted case into the three role jobs, leases them concurrently, and applies
  bounded retry, request, and restart-recovery policies.
- Two distinct passing roles are required before first-party code assembles a
  conservative bound. The maximum compatible upper interval endpoint is used;
  an Agent never selects the final epsilon.
- Deduplicated `BOUND_READY`, `ESTIMATION_ABSTAINED`, and
  `ESTIMATION_EXHAUSTED` notifications persist through restart and can be
  acknowledged from the API or Studio.
- Full and live Studio projections retain a bounded run window. The lifecycle
  dashboard labels intervals as estimate-only, displays abstentions and
  counter-scenario counts, and never calls them guaranteed profit.

## Next implementation

1. Acquire reference-class evidence through explicit evidence tools rather
   than open-ended model browsing.
2. Retain resolved adverse-state outcomes and calculate calibration coverage,
   exceedance rate, and interval score by role, family, horizon, and ppm bucket.
3. Feed measured per-role token and request usage into recurring-work budgets
   without allowing observability metadata to change semantic authority.

## Qualification

- The shooting/live-cola fixture records non-fatal recovery before submitting
  a non-zero `TT` interval.
- A premature numeric submission is rejected while the Agent loop remains
  alive; abstention is accepted only after a counter-scenario.
- Two distinct roles conservatively aggregate to the maximum upper bound.
- Rehashed, out-of-scope evidence or state substitutions fail closed.
- Terminal records replay idempotently after SQLite restart; interrupted work
  becomes retryable failure.
- No artifact grants semantic-decision, certificate, or execution authority.
