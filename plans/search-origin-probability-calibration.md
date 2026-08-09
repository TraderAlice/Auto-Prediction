# Search-origin probability calibration

Status: implemented and qualified

Created: 2026-08-10

## Product problem

The durable search funnel already attributes proposals and semantic review
outcomes to search issues and semantic families. That lineage currently stops
before probability estimation. A probability bound retains proposal, semantic
constraint, estimators, evidence, and adverse states, but not the heuristic
program that discovered it. Resolved calibration can therefore compare models,
methods, relations, horizons, and probability buckets, yet cannot answer the
north-star question: which recurring Agent search family produces probability
bounds that survive settlement?

This is more than a dashboard omission. If family attribution is reconstructed
later from a bounded interactive window, it can silently disappear; if a caller
supplies the family when settlement arrives, the calibration cohort is mutable
and untrustworthy. Search origin must become immutable before estimation starts.

## Decision

- First-party control-plane code joins a passed semantic review to its durable
  review-job issue IDs, then resolves semantic families from the durable search
  issue ledger. No API caller or probability Agent may submit this label.
- The join is frozen in a process-local review-origin cache before estimation.
  Cache hits do not project search issues or review jobs; a first miss uses the
  bounded live jobs first and indexes the durable fallback in one pass.
- A content-addressed search-origin object retains sorted issue IDs, sorted
  family names, and an explicit `SEMANTIC_REVIEW_DURABLE_ISSUES` attribution
  basis. At least one resolved contemporary family is required for v2 lineage.
- New probability jobs retain that origin and produce a v2 probabilistic bound.
  Existing v1 jobs and bounds remain byte-for-byte replayable and are not
  rewritten or duplicated merely because the code learned a new field.
- A v2 settlement observation embeds the exact v2 bound and origin. Calibration
  v2 groups each estimator observation by semantic family in addition to model,
  method, relation, horizon, and upper-bound bucket. A multi-family source is
  deliberately visible in each overlapping family cohort; the same observation
  remains unique in the durable observation ledger.
- Legacy observations remain in an explicit unattributed cohort when mixed
  with v2 data. Historical v1 snapshots continue to rebuild with their original
  group identities.
- Studio shows origin on live bounds, settlement observations, and calibration
  cohorts so a human or browser Agent can trace `search program → estimate →
  outcome` without opening a multi-megabyte full projection.

## Authority and compatibility contract

- Search origin is attribution evidence only. It grants no semantic decision,
  probability certificate, hard-arbitrage, execution, credential, or value-
  moving authority.
- Bound v1, observation v1, and calibration v1 validators retain their original
  canonical bodies. V2 is selected only when lineage is genuinely present.
- Existing persisted v1 probability jobs remain v1. Reconciliation must not
  upgrade them in place or create a second forecast for the same provider run.
- Any v2 job, bound, observation, or calibration artifact with an invalid hash,
  unknown family, duplicated issue, unsorted lineage, or mismatched embedded
  origin fails closed.

## Qualification

- Scheduler tests prove current review issue/family lineage reaches three role
  jobs and one v2 bound, while an existing v1 job remains v1 after reconcile.
- Bound tests prove origin tampering and caller-shaped malformed lineage fail
  canonical replay.
- Calibration tests mix historical v1 and current v2 observations, preserving
  legacy snapshot replay while producing attributed and unattributed v2 groups.
- SQLite restart replays v1 and v2 jobs, bounds, observations, and snapshots
  without history rewriting.
- Studio desktop browser QA exposes the origin path and keeps the lifecycle DOM
  bounded to 12 actionable-first cards out of 32 live cases (252 durable cases
  at the observation point). Expanding to 24 and collapsing to 12 emits no
  console errors; the main-content text floor remains 12 px.
- A temporary 390 px viewport attempt invalidated the in-app browser CDP target,
  so responsive behavior is not re-claimed from this checkpoint. The override
  was reset and the default deliverable tab was rebuilt successfully.
- A runtime A/B against the old lineage-free candidate projection left the
  sustained control-plane CPU posture unchanged (roughly 52–55% during the
  observation). The remaining pressure belongs to retained-state/full-
  projection scheduling and becomes a separate invalidation/pagination slice;
  it is not attributed to the cached search-origin join.
- Full workspace type checks, all 573 tests (415 control-plane), and the
  production build pass on the available Node 22.22.1 host; the repository's
  Node 24+ engine warning remains an environment gap rather than a test failure.
