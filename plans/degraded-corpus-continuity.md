# Degraded corpus continuity

Status: completed 2026-08-02

Started: 2026-08-02

## Outcome

Keep scheduled AI discovery productive when one or more anonymous venue catalog
sources are temporarily unavailable, without hiding the missing evidence or
pretending the search covered markets it did not inspect.

The scheduler will freeze a bounded coverage manifest beside each fast-lane
run. A task proceeds on the currently eligible requested venues when that set
still satisfies a deterministic minimum. Omitted venues remain explicit,
content-addressed operational evidence in the lease, scheduler metrics,
notifications, and Studio.

## Evidence for priority

The retained SQLite window currently contains 40 terminal search leases: seven
failed, only three produced proposals, and none reached pi or a positive gross
hint. The latest consecutive failures have the same cause:
`live catalog source opinion is not context eligible: latest refresh failed`.
Other qualified venues remained available. One public endpoint outage therefore
stopped unrelated discovery across the entire issue scope.

This is a persistence defect, not a model-quality defect. A long-running
arbitrage search system must degrade honestly instead of coupling all work to
the least available venue.

Implementation inspection exposed a second fault: an empty default issue scope
was resolved from the currently eligible corpus snapshot. Once a source had
failed, it disappeared from the lease's requested venues, so a naive manifest
could report `FULL 6/6` instead of `DEGRADED 6/7`. V3 therefore resolves an
empty issue scope from the catalog desk's registered source universe. Current
health changes availability, never the durable search intent.

The first live coverage-aware v2 scan then exposed a third fault: seven sources
were healthy, but lexical ranking filled an implication context entirely from
Limitless. V3 reserves one bounded representative from each available requested
venue before filling the remaining slots by relevance, and applies the lens
minimum to venues actually represented in the Agent context. Stored v2 records
remain valid evidence under their original, weaker availability-only meaning.

## Coverage contract

Every new scheduler-selected live context binds:

- requested venue IDs from the durable issue/lease;
- currently eligible requested venue IDs;
- venue IDs actually present in the bounded context;
- omitted sources with a safe reason enum, latest raw identity when available,
  attempt time, and freshness boundary;
- deterministic minimum eligible and actually represented venue count;
- `FULL` or `DEGRADED` status and a content hash over the manifest.

The manifest contains no response body, URL, header, credential, or provider
diagnostic.

Successful empty observations are distinguished from never-refreshed sources;
they retain their raw identity under `EMPTY_OBSERVATION` while remaining
ineligible.

## Continuity rules

- Exact candidate work that requires distinct venues needs at least two
  eligible venues.
- Equivalence, implication, and mechanism exploration need at least two
  eligible and actually represented venues because their current briefs are
  cross-venue.
- Partition exploration may proceed with one eligible venue because a venue's
  own mutually exclusive or exhaustive contracts can form an arbitrage set.
- The Agent receives only venue IDs actually represented in its immutable
  bounded context.
- Missing sources cannot contribute listings, hypotheses, economics, semantic
  review, or verification evidence.
- If the deterministic minimum is not met, the lease still fails closed and
  retains the coverage manifest explaining why.
- A degraded pass is not a full-corpus negative conclusion. It means only that
  the available bounded context yielded no accepted proposal.

## Migration slices

1. Add a backward-compatible, hash-bound coverage manifest and unavailable
   error carrying that manifest.
2. Select eligible requested venues for scheduler contexts while leaving
   explicit operator context APIs strict.
3. Persist coverage on successful and insufficient-coverage lease outcomes;
   validate exact partition, reason, freshness, and authority invariants.
4. Add global/per-issue degraded-run and omitted-venue metrics plus notification
   digest attribution.
5. Project coverage in Market Archaeologist and make individual lease cards
   distinguish full, degraded, and insufficient coverage.
6. Qualify one-source outage continuation, minimum-coverage failure, restart,
   historical record compatibility, full checks/build, and desktop/390 px QA.

## Qualification gates

- With six of seven requested venues eligible, every default recurring issue
  whose minimum remains satisfied reaches its fast lane instead of failing
  during context assembly.
- The failed venue is absent from the Agent task and every accepted listing ref.
- The exact omission reason and prior raw identity survive SQLite restart.
- When only one venue remains, cross-venue lenses fail before an AI request;
  partition work may still run.
- Historical leases without coverage continue to validate unchanged.
- Retained-window metrics distinguish degraded productive work from both full
  work and insufficient-coverage failures.
- Attention summaries expose degraded scans without emitting one noisy alert
  per scheduled lease.
- No semantic, certificate, execution, external-write, or value-moving
  authority changes.

## Authority boundary

This campaign changes search availability and operational evidence only. It
does not lower any hypothesis grounding, review, compilation, exact-verifier,
simulation, or execution gate.

## Completion evidence

- A server integration run refreshed three anonymous sources successfully,
  failed one source on the next refresh, and completed the default mechanism
  issue on the other two. Its v3 lease retained all three requested venue IDs,
  both eligible and represented IDs, the failed source with
  `LATEST_REFRESH_FAILED`, and no model-derived authority.
- Focused tests prove a partition scan may continue with one represented venue,
  a cross-venue scan with insufficient eligible or represented venues fails
  before `runFast`, and omission evidence including the prior raw hash survives
  SQLite restart.
- V1 records without coverage and initial v2 records with the weaker
  availability-only context rule remain hash-valid. Neither version suppresses
  a current v3 scan. A startup over the existing SQLite volume also preserved
  legacy attention messages instead of rebinding their identities.
- The real configured control plane loaded 947 listings from seven eligible
  sources. Lease `sha256:b211191e…` retained a `FULL 7/7` manifest, represented
  all seven venues in the actual Agent context, made one bounded scout run, and
  recorded 8 steps, 12 tool calls, 3 catalog reads, and one accepted proposal
  effect. Its later pi timeout is retained independently as the next campaign's
  evidence.
- Studio exposes coverage-bound, degraded-completed, insufficient-context, and
  omission-event metrics globally and per issue; lease cards show exact
  coverage. Desktop browser QA passed. A real 390 x 844 iframe browsing context
  reported a 390 px root/body scroll width and rendered the four coverage cells
  as a readable single column.
- Node 24.14.0 full workspace checks pass. All 427 tests pass, including 278
  control-plane tests, and the production build succeeds.
