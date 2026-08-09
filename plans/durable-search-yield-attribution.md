# Durable search-yield attribution

Status: qualified

Created: 2026-08-09

## Evidence that changed the design

The live issue funnel currently reports 235 attributed proposals, only 21
reviewed proposals, and 214 pending reviews. The durable semantic-review
scheduler contradicts that projection: it retains 235 attributed jobs with 115
direct PASS outcomes, 35 exhausted jobs, 16 evidence-blocked jobs, 39
research-only jobs, and 30 duplicate-scope jobs. Twenty-one duplicate jobs reuse
a canonical PASS, eight reuse an exhausted outcome, and one reuses a
research-only outcome. No job is actually pending.

The mismatch comes from using the semantic-review desk's bounded 50-record
detail window as the authoritative stage ledger. When a completed report rolls
out of that window, the search funnel forgets its outcome even though the
scheduler job and its issue lineage remain durable in SQLite. This inflates the
apparent backlog, hides family yield, and makes token-per-reviewed-finding and
task-priority decisions unreliable.

Implementation then exposed a second, nearer retention cliff: the scheduler's
interactive projection is itself intentionally bounded to 250 jobs, while the
SQLite job table retains all rows. Live traffic had already reached 240 jobs.
Attribution therefore needs its own larger bounded read instead of either
inflating the interactive projection or silently losing the 251st historical
outcome.

## Contract

- Review stage disposition comes from durable scheduler jobs when available;
  the bounded review desk is used only for report detail such as evidence-gap
  counts and as a compatibility fallback for unscheduled/manual reviews.
- Duplicate-scope jobs resolve through their canonical durable job. A duplicate
  of PASS counts as reviewed without another provider request; duplicates of
  exhausted, blocked, or research-only work retain that disposition.
- The funnel separates PASS, exhausted, evidence-blocked, research-only,
  actually pending, and untracked proposals. `pending review` must never mean
  every proposal lacking a retained detailed report.
- Missing-evidence totals remain explicitly windowed. The projection reports
  how many reviewed proposals still have retained detailed reports and the
  corresponding coverage rate rather than presenting partial detail as a
  complete historical total.
- Attribution reads up to 10,000 validated jobs directly from the durable store,
  independently of the 250-job scheduler UI window. Source basis, loaded job
  count, maximum count, and truncation posture are first-class projection
  fields. An in-memory scheduler remembers when its retained history has rolled
  over and likewise reports the source as truncated.
- Issue and semantic-family yield use the same effective dispositions, so
  scheduler policy can later learn from durable outcomes without model
  confidence or title similarity.
- The derived artifact remains research-only and grants no semantic decision,
  certificate, execution, external-write, or value-moving authority.

## Qualification

- Focused tests cover detailed-review fallback, durable PASS after report
  eviction, duplicate PASS reuse, exhausted, blocked, research-only, pending,
  missing canonical jobs, input-order independence, durable reads beyond a
  ten-job interactive test window, explicit source truncation, and in-memory
  rollover disclosure.
- Live SQLite qualification on 2026-08-09 first reconciled all 245 attributed
  proposals and then naturally crossed the old projection cliff. At 255 durable
  jobs, the scheduler UI remained bounded to 250 while attribution still read
  all 255 and exactly partitioned them into 144 effective PASS, 49 exhausted,
  16 evidence-blocked, 42 research-only, and 4 actually pending outcomes.
  Outcome coverage remained 100% under the 10,000-job bound and
  `sourceTruncated` remained false. Only 16 retained PASS reports still supplied
  detailed evidence-gap data, correctly labelled as 11.11% detail coverage.
- Studio shows the durable review dispositions, source coverage, and detail
  coverage at desktop and 390 px. The narrow viewport measured 375 px document
  width inside a 390 px viewport, and browser logs contained only Vite debug and
  React development messages.
- A natural Terra/high run from the Studio completed the temporal-impossibility
  issue in 38.4 seconds with four steps and four tool calls, retaining one
  falsification and zero proposals. Provider usage was 17,459 input, 494 output,
  and 130 reasoning tokens.
- All 535 workspace tests, full workspace type checks, and the production build
  pass on Node 24.14.0.

## Follow-on use

Once this measurement is trustworthy, use per-family PASS, exhaustion,
evidence-block, research-only, and economic-positive rates to schedule search
attention. Do not optimize family cadence from raw proposal count alone.
