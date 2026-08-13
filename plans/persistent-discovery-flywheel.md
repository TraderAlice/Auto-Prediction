# Persistent AI-native discovery flywheel

Status: active mainline construction

Created: 2026-08-13

Branch: `codex/persistent-discovery-flywheel`

## North-star role

The product must persistently turn changing prediction-market observations into
new, evidence-bound arbitrage research. It is not enough to retain thousands of
tasks or periodically wake a model. Each bounded cycle must choose one useful
semantic neighborhood, spend from a lineage budget, accept a structured finding
or honest counterexample, and let that result change the next cycle.

The current live ledger shows the missing link. Only six relation-discovery runs
produced seven structured findings (two hypotheses, three counterexamples and
two standing routes), while 64 relation tasks and 3,074 ontology tasks exist.
Relation research is productive when it runs; the research-attention allocator
and relation campaign selector simply do not share the same decision.

A live restart against the 1.1 GB operational database also exposed two
operability ceilings. Startup ontology reconciliation and the first monolithic
Studio projection can each saturate one Node process long enough to make the
console appear offline. The first traced cause was full-ledger canonical hashing
for small incremental Agent batches; this slice narrows comparison to touched
identities and makes the active startup step observable. The remaining
projection ceiling requires view-local read models rather than an ever-growing
global homepage object.

## Ontology decision

A persistent discovery cycle has five non-identical objects:

1. **Observation state** — current anonymous catalog and retained evidence.
2. **Attention allocation** — the first-party answer to what deserves research
   next and why it is novel enough to spend on.
3. **Campaign membership** — exact tasks authorized under a stable allocation
   policy and lineage-wide budget.
4. **Agent attempt** — one bounded runtime/model/tool loop.
5. **Outcome attribution** — what new finding, counterexample, route, review or
   negative memory exists because of that allocation.

The control loop may advance only from retained objects. A timer is a wake-up
mechanism, never research authority. Model confidence does not select work,
free text is not a result, and a catalog snapshot change alone is not novelty.

## Phase 1 — allocation-bound relation campaign

- [x] Replace the independent priority-only relation campaign selector with the
  dispatchable relation actions in `ResearchAttentionAllocationProjection`.
- [x] Bind campaign selection actions to allocation action, scorecard, work
  family, exact task revision, allocation policy and projection identities.
- [x] Make the relation campaign an evolving v4 lineage whose membership follows
  the same allocation policy without resetting runtime, activation or budget.
- [x] Preserve a pure provider-free preview and prove non-dispatchable research
  debt, falsification proposals and ontology mutations cannot leak into the
  ordinary relation campaign.

## Phase 2 — durable cycle decision and outcome

- [x] Capture a research-decision episode when an allocation action first enters
  campaign membership, not only when an operator happens to click a separate
  endpoint.
- [x] Reconcile the resulting run, tool effects, findings and downstream state
  into the existing outcome projection after every Agent completion.
- [x] Distinguish `ADVANCED`, useful negative memory, spent without movement,
  in-flight and stale/retired membership without inventing model reward.

## Phase 3 — bounded recurring wake-up

- [x] Add a configurable discovery-cycle interval that recomputes observation,
  allocation and membership but starts no run unless the lineage is explicitly
  active, current membership is runnable and budget remains.
- [x] Keep concurrency at one for the initial flywheel and use
  `ONCE_PER_TASK_PER_LINEAGE`; a wake-up over unchanged state must be a no-op.
- [x] Require a named first-party novelty reason for successor work and retain
  counterexamples/no-yield attempts as anti-loop memory.
- [x] Notify only on new campaign membership, structured outcomes, repeated
  costly no-movement, or portfolio exhaustion—not every model response.

## Phase 4 — yield dashboard and policy evolution

The active implementation plan is
[`discovery-yield-attribution.md`](discovery-yield-attribution.md). It inserts
append-only outcome observations and non-overlapping same-family decision
windows before any token-normalized dashboard is allowed to claim strategy
yield.

- [x] Show the cycle as `observation → allocation → membership → run → outcome`
  with per-family tokens, wall time, structured result yield and downstream
  stage movement.
- [x] Separate historical Rule Evidence failures from discovery-runtime yield;
  the live 549-invocation total is dominated by 488 Rule Evidence invocations,
  including 458 failures, and must not characterize relation discovery.
- [x] Compare allocation strata by findings, counterexamples, reviewed relation
  movement and cost. Change lane budgets only through versioned policy evidence.
- [ ] Replace the monolithic first-load Studio projection with view-local,
  independently cached read models so a growing research ledger cannot starve
  flywheel controls or readiness diagnostics.

The first Phase 4 read boundary is now qualified for Agent Operations. That
route no longer mounts the global Studio projection provider; it polls startup
readiness and loads one `pmh.agent-workspace.v1` snapshot. The snapshot shares
one ontology/relation/attention derivation across execution, allocation,
targets, decisions, relation-campaign preview and allocation outcomes instead
of racing six handlers that independently rebuild the research graph. Against
the retained 1.1 GB SQLite ledger, cold startup reaches the local-read boundary
in about 16 seconds and the 1.66 MB Agent workspace materializes in 12.76
seconds with zero provider requests, model invocations or writes. The page is
usable without ever requesting `/api/v1/projection`.

Live diagnosis also found two recurring-read anti-patterns. Semantic-review
evidence enrichment performed nested proposal/input/history scans; it now uses
proposal and requirement indexes, with a 2,000-candidate regression fixture
completing in 12 ms inside the test suite. A disabled legacy DeepSeek premise
lane rebuilt the full Rule Evidence task index every five seconds even while
the selected runtime was Codex/terra and DeepSeek automation was off; the
authority check now precedes that work. Remaining views still use the global
projection, so the Phase 4 checkbox remains open until each expensive surface
has its own bounded read model and cache/invalidation policy.

The same research-state revision now governs recurring semantic-review and
evidence-demand derivations. Timers still wake their schedulers at the
configured cadence, but unchanged retained state reuses the exact frozen base
candidate, evidence-enrichment, economic-priority and admitted-demand objects.
Only a durable research-state broadcast invalidates those caches. On the live
ledger, a 30-second readiness sample after startup answered 30/30 requests
within the one-second bound; idle CPU stayed around 0–0.9% with only brief
single-digit/low-teens scheduler pulses, instead of recurring multi-second
100% event-loop stalls. This is the intended control-loop ontology: elapsed
time authorizes a check, while changed evidence authorizes recomputation.

The bounded discovery cycle is now explicit and separately observable. Its
default 60-second interval may be configured from 1 second to 24 hours or
disabled. A wake-up only reconciles evolving membership for an already-retained
research-attention relation intent; it cannot create the intent, activate a
paused campaign, call a provider/model, or dispatch a run. Agent Operations
shows wake count and membership-change count alongside the zero-provider,
zero-model, no-activation contract. The frozen attention allocation and exact
targets share the same research-state revision, so an unchanged wake-up is an
O(1) read of the last evidence-bound decision rather than a periodic rebuild of
the ontology graph. The independent campaign dispatcher remains the only path
from an explicitly active lineage to a runnable, budgeted Agent attempt.

Successor work now carries its first-party novelty reason through the allocation
action, content-addressed action identity and durable v2 research-decision
episode. Schema 48 deliberately retires pre-v2 unbound episodes instead of
carrying a development-only compatibility branch: an outcome is admissible only
when the exact first-party novelty reason is part of the decision identity.
New episodes expose the reason that justified spend plus counterexample,
terminal no-yield and successful-free-text deltas as anti-loop memory. A
counterexample is classified as useful negative memory, not falsely promoted as
a positive finding merely because it advanced the evidence stage. Agent
Operations presents both the spend premise and retained negative memory. The
relation lineage already fixes concurrency at one and uses
`ONCE_PER_TASK_PER_LINEAGE`; changing an allocation identity therefore cannot
rerun an unchanged exact task.

The flywheel now also owns a durable, deduplicated discovery-signal inbox.
Signals are derived only from four state transitions: exact campaign membership,
structured positive or useful-negative outcomes, at least two costly no-movement
episodes in one work family, and first-party portfolio exhaustion. Timer wakes,
manual episode capture, free-text model responses and unacted ready work remain
silent. Read acknowledgement changes only local inbox state and carries fixed
zero provider, model, dispatch, external-write and value-moving effects. Signal
reconciliation runs after startup, catalog refresh, Agent completion and every
bounded discovery-cycle wake so a meaningful transition cannot be hidden by an
unchanged membership revision.

Live schema-48 qualification against the 1.1 GB ledger intentionally removed
three pre-v2 unbound decision specimens and retained the one novelty-bound v2
episode. Startup derived one `CAMPAIGN_MEMBERSHIP_ADDED` signal, SQLite restart
replayed it, and local acknowledgement retained the same signal identity with
zero provider, model or run effects. Agent Operations renders the inbox at the
normal desktop viewport and at 390 px without horizontal overflow or console
errors. Full workspace checks, all suites (94 control-plane files / 648 tests
and five Studio files / 30 tests), and the production build pass on the
available Node 22 host; the repository's expected Node 24 engine warning and
existing Studio chunk-size warning remain.

## Initial qualification

The first mainline slice implements Phase 1 completely and Phase 2 far enough
to bind a retained decision episode. It remains manual-only and starts zero
provider requests. The live proof is that relation campaign preview selects the
same exploration action as the attention allocator and that repeat reads do not
create campaigns, runs or invocations.

The live 1.1 GB SQLite qualification retained one paused v4 campaign,
`research-attention-relation-de96a0bdc9f5fcbb`, with allocator action
`sha256:537e…f863` bound to exact task `sha256:4fbf…54fe`. Repeated creation was
rejected, the decision episode was idempotent, and 251 runs / 549 model
invocations did not move. A clean restart and provider-free preview returned the
same action, task and intent campaign with zero provider requests or model
invocations. Startup timing isolated the largest recovery step as ontology
issue reconciliation; touched-identity batch comparison and snapshot-backed
store validation remove two whole-ledger scans without weakening durable
reference checks. The separate monolithic Studio projection ceiling remains a
named Phase 4 continuation.

## Authority boundary

This plan may create or revise local Agent campaign membership under explicit
research budgets. It does not itself activate a campaign, call a model during
read/reconciliation, place an order, sign, approve, move value, retain trading
credentials or grant external-write authority.
