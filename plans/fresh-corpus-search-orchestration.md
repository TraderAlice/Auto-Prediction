# Fresh-corpus search orchestration

Status: active
Started: 2026-08-02

## Outcome

Turn the existing recurring issue queue into an actually persistent search
loop: refresh the anonymous public catalog on a bounded cadence, bind every
successful refresh to a new immutable corpus, and dispatch due AI issues only
after that refresh settles. Make freshness and the next refresh visible in
Studio so an operator can tell whether Agents are searching current markets or
waiting on stale evidence.

## Runtime evidence

The durable five-issue queue and its three Agent slots are enabled and real.
At 2026-08-01T20:01:22Z the `Cross-venue same claim` issue completed a new
lease only because an operator had manually refreshed all seven sources at
19:58:15Z. Catalog observations currently refresh once during server startup
and through the explicit HTTP button; no periodic refresh exists. Every source
becomes context-ineligible after 15 minutes, at which point the issue timer
receives an empty corpus and silently stops dispatching.

This is a product correctness gap rather than a convenience gap: issue cadence
cannot provide continuous discovery unless corpus cadence is at least as fresh.

## Architecture decision

Add a request-bounded catalog refresh scheduler with an explicit environment
interval. It owns coalescing, run timestamps, next-run time, READY/DEGRADED
counts, and the latest immutable snapshot identity. The server uses this one
path for startup, manual, and scheduled refreshes.

While a refresh is in flight, scheduled issue dispatch is gated. Once refresh
settles, the server immediately offers the resulting corpus to the due issue
queue, allowing its existing priority and three-slot concurrency rules to
decide work. A partially healthy non-empty corpus remains research-eligible but
is visibly DEGRADED; an empty corpus cannot create a lease. Finding
deduplication remains proposal-signature based, so periodic snapshots do not
repeat notifications for the same candidate.

Scheduling is off unless `PMH_CATALOG_REFRESH_INTERVAL_MS` is explicitly set.
The production example uses five minutes, safely inside the catalog's
15-minute eligibility window. The interval creates anonymous public GETs only;
it never calls a model directly and grants no semantic or execution authority.

## Construction slices

- [ ] Add the bounded refresh scheduler and configuration parser.
- [ ] Route startup, manual, and periodic refreshes through one coalesced path.
- [ ] Gate issue ticks during refresh and dispatch immediately on fresh corpus.
- [ ] Expose scheduler health and timing in the control-plane projection.
- [ ] Show current-corpus automation state on the Market archaeologist desk.
- [ ] Prove bounds, coalescing, degraded recovery, and fresh-corpus ordering.
- [ ] Exercise repeated refresh and issue dispatch against all seven sources.
- [ ] Run full Node 24 qualification and responsive visual inspection.
- [ ] Publish and serially merge the next PR.

## Safety invariants

- Refreshes are anonymous bounded GETs with credential omission, byte caps, and
  timeouts inherited from the observation desk.
- One refresh may be in flight; overlapping timer and operator requests
  coalesce to the same promise.
- Issue Agents never begin against the previous corpus while a refresh is in
  flight.
- An empty or expired corpus creates no AI lease and spends no model budget.
- AI remains proposal-only. Review, payoff compilation, exact simulation, and
  the first-party verifier retain every promotion authority.
- No order route, signing route, credential route, or value-moving operation is
  introduced.

## Qualification gate

- Invalid, too-fast, and freshness-unsafe intervals fail closed.
- A timer tick cannot overlap an active refresh and reports the coalesced state.
- Startup and manual refreshes update the same scheduler projection as timer
  refreshes.
- Due issues observe the post-refresh snapshot identity, never the superseded
  one, and retain the existing three-Agent concurrency bound.
- A degraded refresh remains visible and an all-empty corpus launches no Agent.
- Studio exposes timer on/off, refresh state, next refresh, source coverage, and
  corpus identity at desktop and narrow widths.
- Type checking, focused tests, full repository tests, production build, and
  live seven-source smoke all pass.
