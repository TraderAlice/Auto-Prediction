# Durable probability-estimation evidence context

Status: implemented; live qualified

Created: 2026-08-10

## Product problem

The first live failure-budget relation is retained and still has its exact
reviewed listings inside a SQLite-backed semantic-review evidence bundle. The
probability scheduler nevertheless marks all three estimator roles
`BLOCKED_EVIDENCE` because dispatch consults only the newest rotating catalog
snapshot. The evidence exists; ownership is broken across stages.

A persistent AI-native arbitrage machine cannot require a promising relation,
its review, and its probability estimates to finish inside one catalog
generation. Catalog rotation is expected, while a semantic opportunity may
need hours or days of evidence work and independent estimation.

## Decision

- Introduce a bounded, content-addressed probability evidence context containing
  the exact reviewed listings, their canonical hashes, the review and semantic-
  constraint identities, evidence-scope identity, and source lineage.
- Every new dispatchable provider-bound probability case owns that context in
  each durable role job. Current catalog listings and retained semantic-review
  bundles are merely two authorized ways to construct it.
- Context validation recomputes every listing hash and matches listing ref,
  source raw hash, protocol identity, semantic constraint, review artifact, and
  evidence scope. Later listings with the same ref cannot substitute for the
  reviewed bytes.
- Context identity participates in new case identity. A previously blocked
  context-free job remains readable and unchanged; discovering durable context
  creates a new case rather than rewriting historical lineage.
- Dispatch reconstructs the estimator input solely from the job-owned context.
  The current catalog is not a runtime dependency once the case is durable.
- The server joins retained semantic-review jobs by exact review and proposal,
  validates their durable evidence bundle, and exposes only matching contexts
  to reconciliation. No fuzzy same-proposal or same-ref fallback is allowed.

## Compatibility and authority

- Job v1-v3 records and hashes remain readable. V4 requires both an engine
  snapshot and an exact probability evidence context; V5/V6 additionally bind
  the estimator input/tool protocol.
- Existing context-free jobs may still run only while the exact reviewed bytes
  are present in the supplied current snapshot. They do not gain reconstructed
  evidence after rotation.
- Evidence ownership grants estimator-input authority only. It cannot change a
  semantic conclusion, certify probability, simulate, trade, sign, move value,
  or request production credentials.

## Qualification

- A retained evidence bundle creates three current-protocol jobs after the live catalog has
  rotated to changed bytes; all estimator inputs still equal the reviewed
  listings.
- Altering a retained listing, source hash, protocol identity, review identity,
  or context identity fails validation before a provider request.
- SQLite restart replays the context and completes estimation without any
  semantic-review job or original catalog snapshot in memory.
- Legacy V1-V5 jobs replay byte-for-byte and remain isolated from the V6 case.
- Provider/model/effort changes create distinct context-bound cases.
- The retained LAFC Gemini/Polymarket US relation advances through bounded
  Terra/high estimation and appears in the failure-budget frontier, or retains
  explicit model abstention/failure evidence without fabricating a bound.
- Workspace checks, tests, production build, and `git diff --check` pass.

## Qualified result

- The retained LAFC Gemini/Polymarket US review bundle created a context-bound
  Terra/high case after the current catalog had rotated. All three exact model
  inputs matched the reviewed listing bytes through SQLite restart.
- Input V2 removed the opaque-state failure by supplying the full semantic
  constraint and readable truth mapping. The three roles then abstained for
  substantive missing rules and base rates rather than missing scheduler state.
- Input V3 retained those gaps as structured tool effects. Three new V6 jobs
  completed once each with zero provider failures, proving dispatch no longer
  depends on an in-memory review or current catalog generation.
