# Plans

The active construction plan is
[`plans/semantic-constraint-search.md`](plans/semantic-constraint-search.md).
It turns Agent-discovered meaning relationships into falsifiable joint
settlement constraints and deterministic payoff inequalities, while keeping
statistical dependence and textual relatedness outside exact-arbitrage
authority.

## Planning contract

- `PLANS.md` is the short index and current checkpoint, not an append-only log.
- Non-trivial construction lives in one focused file under `plans/`.
- Update the active plan when evidence changes a decision or exposes a new slice.
- Retire completed plans after their completion is preserved in Git history.
- Never use a stale checked-off plan as evidence that current code still works;
  rerun the plan's qualification gates against the current worktree.

## Current checkpoint

The product is an AI-native prediction-market search system. Durable issues
lease immutable, content-addressed market corpora to concurrent cheap Agents;
novel grounded candidates enter a separate read-only Pi investigation queue.
Independent semantic review, deterministic payoff compilation, exact exchange
simulation, and the first-party verifier remain the only promotion path. No
live order, credential, signing, fund, or value-moving route exists.

Search leases now use the staged `pmh.ai-search-leases.v5` contract. A completed
fast result is persisted and returned before Pi starts. Pi has its own bounded
deadline, concurrency queue, immutable input identity, attempt ledger, restart
recovery, and Pi-only retry endpoint. A deep failure projects
`DEEP_UNAVAILABLE` without erasing the fast candidate or degrading the issue's
fast-search health. Expired pre-fast recovery records consume no provider work
and are excluded from model-quality and failure-streak metrics. Historical
v1-v4 artifacts replay unchanged.

Live SQLite qualification observed both a restart-recovered `DEEP_COMPLETE`
result and a timed-out/failed Pi path with its fast result preserved. It also
exposed a multi-watcher startup race: processes that lost port 4100 could resume
durable work before their bind failed. Production startup is now admission
gated, so catalog refresh, Pi recovery, and timers begin only after the HTTP
listener owns its port. A real `EADDRINUSE` test proves the losing process
creates no catalog observation or search-lease mutation.

Node 24.14.0 type checks, all 437 workspace tests, and the production build
pass. Desktop and 390 px Studio QA show separate fast/deep health, retry counts,
attempt budgets, and preserved results without horizontal overflow or browser
warnings.

The next measured capability gap is semantic constraint proof. The Agent can
already find equivalence, implication, and partition candidates, but a relation
label is still too coarse to prove arbitrage. The active campaign will require
explicit feasible joint states, rule-bound counterexamples, and deterministic
no-arbitrage inequalities. The “August shooting / September live cola” example
is the first negative qualification: a non-fatal shooting defeats mutual
exclusion, and unequal probabilities alone never establish arbitrage.

## Deferred future campaigns

- Venue-specific AMM and dynamic-fee calibration.
- Polymarket Global match-level fee-rounding evidence.
- Destination-specific notification formatting after the first external
  channel is selected in `QUESTIONS.md`.
- Long-horizon provider cost and latency governance after usage evidence is
  qualified.

These are not blockers for the active research harness and must become focused
plan files before implementation begins.
