# Plans

`plans/search-lease-corpus-recovery.md` is the active construction plan.

## Planning contract

- `PLANS.md` is the short index and current checkpoint, not an append-only log.
- Non-trivial construction lives in one focused file under `plans/`.
- Update the active plan when evidence changes a decision or exposes a new slice.
- Retire completed plans after their completion is preserved in Git history.
- Never use a stale checked-off plan as evidence that current code still works;
  rerun the plan's qualification gates against the current worktree.

## Current checkpoint

The product is an AI-native prediction-market search system. Durable issues
define bounded recurring semantic briefs; a priority scheduler leases immutable
market corpora to concurrent cheap scouts and escalates only novel grounded
candidate signatures to pi. Findings enter a deduplicated in-app inbox.

AI remains the search engine, never the judge. Independent semantic review,
deterministic payoff compilation, exact exchange simulation, and the first-party
verifier own every later promotion step. No live or value-moving route exists.

The retained search runtime exposes the next durability failure directly: 21 of
26 failed search leases were not model failures. They were leases persisted as
`ISSUED` whose exact task corpus disappeared across process restart. The issue
scheduler then failed those leases and spent a new request against a later
corpus. Durable issues without durable task evidence are not durable work.

The active campaign stores each immutable market corpus once by content hash,
binds every new lease to that retained evidence, and resumes an issued lease
against the exact original corpus after restart. Legacy leases without retained
corpora remain explicit migration debt; the scheduler must never substitute the
latest catalog silently.

## Deferred future campaigns

- Venue-specific AMM and dynamic-fee calibration.
- Polymarket Global match-level fee-rounding evidence.
- Polymarket US short-side mapping, theta fees, and fill rounding.
- Structured operator scope for conditional and multi-listing relations.
- External notification channels after a destination and authority decision.
- Long-horizon cost and latency measurement after provider usage evidence is
  qualified.

These are not blockers for the current research harness and must become focused
plan files before implementation begins.
