# Campaign intent and evolving membership

Status: active mainline construction

Created: 2026-08-13

Branch: `codex/campaign-intent-membership`

## North-star role

Persistent discovery cannot bind a long-lived research commitment to the task
IDs produced by one catalog snapshot. Tasks are exact, immutable execution
slices; the set of relevant slices changes as markets, observations and the
ontology change. Conversely, replacing task IDs must not silently renew token
budgets or broaden the operator's original research authority.

## Ontology decision

The existing campaign object represents a **lineage of bounded research
authority**. Its immutable revisions represent current membership snapshots:

- campaign key and membership policy identify the continuing research intent;
- selection identity and task bindings prove why exact tasks were members at a
  particular revision;
- runs and all budget consumption aggregate across the campaign-key lineage;
- changed input may replace membership inside the same selection protocol and
  policy identity;
- a changed selection protocol or policy is a new intent, never an automatic
  membership refresh;
- `ONCE_PER_TASK_PER_LINEAGE` prevents unchanged work from being rerun merely
  because the scheduler wakes up.

An active lineage may inherit its already explicit activation when membership
is refreshed within the exact bound policy. It may not gain budget, change
runtime/model, change schedule, or cross authority boundaries during refresh.

## Phase 1 — first-class evolving membership contract

- [x] Add an immutable campaign-membership policy binding and a campaign
  revision that carries both the stable policy and the exact current selection.
- [x] Add a pure membership revision operation that preserves campaign key,
  schedule, execution profile, budget and activation while accepting only the
  same selection protocol and policy identity.
- [x] Prove runs and token/wall-clock budgets continue to aggregate across
  membership revisions and unchanged tasks remain once-per-lineage.

## Phase 2 — standing-route intent reconciliation

- [x] Migrate standing-route seed campaigns to evolving membership without
  inferring new authority or resetting consumed budget.
- [x] Recompute current route-seeding selection after durable input
  reconciliation and append a campaign revision only when exact membership
  changed.
- [x] Retain every prior selection binding and task for audit while dispatch
  sees only the effective current campaign revision and runnable tasks.

## Phase 3 — operator projection and qualification

- [x] Expose intent identity, membership revision, current/retired member
  counts and lineage budget consumption in the Agent console.
- [x] Replay the live standing-route campaign: its exhausted 24-invocation
  budget must remain exhausted after membership migration, with zero model
  requests during migration/read.
- [x] Full checks, tests and production build pass before serial merge.

## Qualification evidence

- The existing active standing-route lineage migrated in place to v4 without
  changing its activation, execution profile, manual schedule, or 24-invocation
  total budget. The durable ledger remained at 251 runs and 549 model
  invocations through migration and two restart/refresh cycles.
- A rotating 600-listing catalog window originally caused a new route task and
  campaign revision on every restart. The ontology now separates stable
  selection intent and semantic research input from the exact replay snapshot.
  A test with completely disjoint catalog windows preserves the same task and
  membership binding while retaining each raw snapshot separately.
- Live reconciliation converged at standing-route campaign revision 11 with
  the same current task, selection action and semantic input across a second
  restart. Selection projection identity and merged campaign-membership
  identity remain intentionally distinct; preview eligibility is derived by
  the same pure reconciliation function instead of comparing those hashes.
- The task ledger may still grow when other catalog-bound work receives a new
  exact input. That is immutable audit history, not campaign authority or
  dispatch membership growth; the Agent console reports only effective current
  membership and lineage-wide budget consumption.

## Selection signals

Adopt if a live campaign can follow changed exact inputs without rerunning
unchanged work or resetting its lineage budget. Abandon or redesign if
membership cannot be recomputed from first-party retained selection evidence,
or if preserving activation would allow a policy/runtime/budget expansion.

## Authority boundary

This plan can revise local scheduling membership under an already recorded
selection policy. It does not activate a paused lineage, increase a budget,
change a runtime/model, start a provider request by reconciliation, create a
live order, sign, move value, or grant external-write authority.
