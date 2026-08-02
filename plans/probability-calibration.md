# Resolved-outcome probability calibration

Status: first-party replay artifact implemented locally; durable ingestion and
cohort admission remain

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

## Next implementation

1. Add SQLite journals for resolution observations and immutable calibration
   snapshots, including idempotent restart replay.
2. Build anonymous venue-resolution ingestion that reuses the catalog's
   protocol identity and raw-fixture boundary instead of trusting dashboard
   status text.
3. Attribute search semantic family and issue lineage to probability bounds so
   calibration can group by family without accepting a caller-supplied label.
4. Admit a calibration artifact into a new probability bound only when its
   exact estimator/method/relation/horizon/bucket cohort meets the configured
   sample threshold; never rewrite an old bound.
5. Expose sample sufficiency, empirical rate, interval gap, and Brier trend in
   Studio beside token-per-durable-effect metrics.

## Qualification

- A non-adverse `FF` and adverse `TT` outcome against two independent bounds
  produce a 500,000-ppm empirical rate.
- Historical 20,000–40,000 and 30,000–50,000 intervals are classified as
  underpredicting that two-case fixture, with exact 460,000/450,000-ppm upper
  exceedance and deterministic midpoint Brier values.
- Duplicate observations, post-hoc forecasts, missing listing resolutions, and
  derived-metric tampering fail closed.
- No artifact grants probability-certificate, hard-arbitrage, or execution
  authority.
