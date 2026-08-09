# Resolved-outcome probability calibration

Status: durable first-party observation desk, milestone snapshots, API, and
Studio projection implemented; official venue-resolution adapters and cohort
admission remain

Created: 2026-08-02

## Objective

Measure whether role-separated adverse-state probability intervals survive
contact with resolved prediction-market outcomes. Calibration is deterministic
evidence about prior forecasts, never another model opinion and never trading
authority.

## Implemented evidence contract

- `pmh.probability-calibration-observation.v1` embeds the exact historical
  probability bound and binds one resolution-evidence item to every listing.
- First-party code derives the realized joint truth state and whether one of the
  bound's adverse states occurred. The caller cannot submit that label.
- Resolution evidence retains listing identity, boolean outcome, canonical
  resolution time, protocol identity, and source raw hash. A resolution that
  predates the forecast fails closed.
- One immutable bound can contribute at most one observation to a calibration
  snapshot. Refreshed historical bounds remain distinct forecasts and may each
  be scored against the eventual outcome.
- Observation and calibration artifacts are content-addressed and replay all
  derived fields. They grant only shadow-calibration authority.

## Implemented cohort metrics

Every estimate is grouped by estimator, estimation method, semantic relation,
forecast horizon, and 100,000-ppm upper-bound bucket. Bigint arithmetic derives:

- resolved sample count and adverse-state count;
- empirical adverse-state rate in ppm;
- mean submitted lower and upper interval endpoints;
- upper exceedance and lower shortfall in ppm;
- mean Brier score in ppm using the submitted interval midpoint;
- `INSUFFICIENT_SAMPLE`, `WITHIN_INTERVAL`, `UNDERPREDICTED`, or
  `OVERPREDICTED` posture.

The default minimum cohort is 20 observations. The threshold is stored in the
artifact; tests may lower it to qualify exact arithmetic. No Gaussian or
small-sample confidence claim is invented.

## Durable observation desk

- The desk accepts only an artifact hash already registered by the probability
  scheduler. Callers cannot inject a replacement historical bound or a derived
  adverse label.
- One immutable observation is retained per bound. Exact replay is idempotent;
  a different outcome for the same bound fails closed. Evidence dated after the
  first-party clock is rejected as well as evidence predating the forecast.
- SQLite schema v28 stores observations without pruning. The configured
  100,000-observation ceiling rejects additional intake instead of silently
  deleting calibration history.
- Every scheduler-produced bound is first registered as its own immutable
  SQLite artifact. Settlement remains scoreable after scheduler jobs and live
  projection details rotate out; the caller still supplies only its hash.
- The current calibration artifact is deterministically rebuilt from all
  observations. Full embedded snapshots are persisted at observation one and
  each configurable interval (default 20), avoiding quadratic storage growth
  while retaining historical trend checkpoints.
- Restart replay verifies every content hash and reconstructs the same current
  artifact. Partial persistence after an observation write can repair a missing
  milestone snapshot through an idempotent replay.
- `GET /api/v1/probability-calibration` exposes bounded summaries;
  `POST /api/v1/probability-calibration/observations` is the strict first-party
  ingestion boundary for source-hashed settlement evidence.
- Studio shows registered/pending bounds, adverse outcomes, sample sufficiency,
  interval misses, Brier score, and milestone count. Full artifacts stay in the
  durable store instead of crossing the live projection.

## Next implementation

1. Build anonymous venue-resolution ingestion that reuses the catalog's
   protocol identity and raw-fixture boundary instead of trusting dashboard
   status text.
2. Attribute search semantic family and issue lineage to probability bounds so
   calibration can group by family without accepting a caller-supplied label.
3. Admit a calibration artifact into a new probability bound only when its
   exact estimator/method/relation/horizon/bucket cohort meets the configured
   sample threshold; never rewrite an old bound.
4. Add cohort trend deltas and token-per-calibrated-observation economics after
   real resolved samples exist; do not fabricate a trend from an empty desk.

## Qualification

- A non-adverse `FF` and adverse `TT` outcome against two independent bounds
  produce a 500,000-ppm empirical rate.
- Historical 20,000–40,000 and 30,000–50,000 intervals are classified as
  underpredicting that two-case fixture, with exact 460,000/450,000-ppm upper
  exceedance and deterministic midpoint Brier values.
- Duplicate observations, post-hoc forecasts, missing listing resolutions, and
  derived-metric tampering fail closed. Unregistered bounds, conflicting
  outcomes, and future-dated settlement evidence also fail closed.
- SQLite restart retains exactly one observation and one first milestone;
  idempotent replay neither duplicates nor rewrites either record.
- The durable bound registry keeps that observation admissible when the live
  scheduler source is empty after restart, proving settlement is independent of
  the scheduler detail window.
- No artifact grants probability-certificate, hard-arbitrage, or execution
  authority.
- Node 24.14.0 workspace checks, all 551 tests (402 control-plane), and the
  production build pass. Studio inspection at 1280 px and 390 px shows the
  empty, source-hashed calibration posture without console warnings or
  horizontal overflow (`375 == 375` content width at the narrow viewport).
