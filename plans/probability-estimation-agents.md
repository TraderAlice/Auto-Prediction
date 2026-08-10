# Role-separated probability estimation agents

Status: active; exact case acknowledgement, semantic challenges, typed evidence
requests, abstention, durable run journal, concurrent automatic scheduling,
conservative bound assembly, notification inbox, Studio observability, and
first-party calibration replay implemented; approved external reference sources
and durable resolution ingestion remain

Created: 2026-08-02

## Objective

Turn a passed `PROBABILISTIC_DEPENDENCE` semantic review into evidence-bound
adverse-state probability intervals without forcing an LLM response through a
whole-response schema or treating model confidence as probability.

## Implemented contract

- Three independent roles are available: `REFERENCE_CLASS`, `CAUSAL`, and
  `INDEPENDENT`. The role fixes the estimation method outside the model.
- Every current Agent invocation is a bounded AI SDK tool loop. It first accepts
  a content-addressed interpretation that expands compact states into exact
  contracts and TRUE/FALSE outcomes, or terminates with a structured semantic
  challenge. Only an accepted case may record a counter-scenario, evidence
  need, estimate, or abstention.
- Submitted evidence hashes must belong to the exact reviewed listing scope.
  Invented hashes and out-of-scope adverse states fail at the tool boundary and
  again at the model-port boundary.
- Numeric submissions use integer ppm intervals, explicit assumptions, a
  bounded validity period, and evidence hashes. Abstention is retained as a
  successful research outcome rather than converted into a fabricated number.
- Current run V4/job V7 artifacts bind the exact adverse-state interpretation,
  acknowledgement or challenge effect, review, semantic constraint, retained
  catalog context, role, engine, counter-scenarios, estimate, trace, and
  authority. Historical run V1-V3/job V1-V6 identities replay unchanged.
- SQLite schema 33 persists running and terminal records. A process restart
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
- Deduplicated `BOUND_READY`, `SEMANTIC_REPAIR_REQUIRED`,
  `ESTIMATION_ABSTAINED`, and `ESTIMATION_EXHAUSTED` notifications persist
  through restart and can be acknowledged from the API or Studio. Challenges
  group into a first-party repair queue and cannot be retried as probability
  work.
- Full and live Studio projections retain a bounded run window. The lifecycle
  dashboard labels intervals as estimate-only, displays abstentions and
  counter-scenario counts, and never calls them guaranteed profit.

## Next implementation

1. Acquire reference-class evidence through explicit evidence tools rather
   than open-ended model browsing.
2. Persist source-bound resolution observations and calibration snapshots. The
   pure replay layer now calculates empirical rate, interval miss, and midpoint
   Brier by estimator, method, relation, horizon, and ppm bucket; semantic-family
   grouping waits for first-party issue lineage on the bound.
3. Feed measured per-role token and request usage into recurring-work budgets
   without allowing observability metadata to change semantic authority.

## Provider-snapshot qualification

- New jobs use schema v6 and retain provider, model, effort, transport,
  response-storage posture, exact evidence context, and input protocol; new run
  artifacts use schema v3 with the same engine and structured evidence effects.
- Case and run identities change when provider, model, or effort changes. Runtime
  configuration changes affect only newly reconciled cases.
- Codex uses streaming Responses, omits `max_output_tokens`, disables response
  storage and parallel tool calls, and records OAuth-free usage lineage.
- Automatic Codex estimation does not depend on the DeepSeek automation gate.
  Automatic DeepSeek estimation still requires that explicit spending gate.
- Legacy v1-v5 jobs and v1/v2 runs replay byte-for-byte and can still
  rebuild historical probability bounds.

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

## Live case-integrity qualification

The retained MLS case selected `TF`, meaning Gemini YES / Polymarket NO, while
its principal postponement narrative described Gemini non-YES or undefined /
Polymarket YES. On `gpt-5.6-terra / high`, all three roles challenged that exact
direction on their first request. The scheduler emitted one repair item with
three-role support and no numeric estimate. See
[`probability-case-integrity.md`](probability-case-integrity.md).
