# Agent task readiness

Status: completed mainline qualification

Created: 2026-08-13

Branch: `codex/agent-task-readiness`

## North-star role

A persistent Agent ledger intentionally retains historical tasks, while an
operational scheduler must act only on work whose current exact input can still
be resolved. Treating ledger presence as dispatch readiness makes harmless
ontology evolution look like runtime failure, burns operator attention, and
would make interval scheduling unsafe.

## Ontology decision

An Agent task has at least two independent postures:

- **audit existence**: an immutable task definition and its attempts remain in
  the ledger forever;
- **current dispatch readiness**: the control plane can presently resolve the
  exact first-party payload, tool host and source lineage required to run it.

A successor task does not delete or mutate its predecessor. Within the same
kind, protocol and provenance family, the predecessor becomes
`SUPERSEDED_INPUT`; work without a registered current resolver is
`HISTORICAL_ONLY`. The protocol boundary matters because one requirement may
legitimately have simultaneous document and catalog-text interpreters. Neither
state is a failed model attempt.

## Phase 1 — common readiness contract

- [x] Add a provider-neutral readiness predicate to manual and campaign
  dispatch so preview and execution share one decision.
- [x] Exclude non-runnable tasks from campaign fanout and report the blocked
  count without creating a run or model invocation.
- [x] Preserve concrete diagnostics and prove a historical task cannot reach
  the runtime adapter.

## Phase 2 — current-input projection

- [x] Derive current runnable Rule Evidence, ontology and relation task IDs
  from their exact retained input revisions.
- [x] Classify same-family predecessors as `SUPERSEDED_INPUT` and other
  unsupported ledger entries as `HISTORICAL_ONLY`.
- [x] Expose readiness on the Agent console and default the manual control to a
  runnable task only.

## Qualification

- [x] Replay the live SQLite ledger and prove the old LAFC V3 task is visible
  but blocked while its successor is runnable.
- [x] Previewing a historical task starts zero provider/model requests and
  creates no run.
- [x] Full tests, checks and production build pass before serial merge.

## Live qualification evidence

The schema-47 SQLite ledger contained 3,828 immutable tasks, 251 runs and 549
model invocations after reconciliation. The bounded console window classified
227 tasks as `RUNNABLE`, three as `SUPERSEDED_INPUT` and twenty as
`HISTORICAL_ONLY`. The old LAFC catalog-text V3 task resolved structurally to
its current V3 successor; its manual preview returned HTTP 409 before creating
a run, and the registry remained at 251 runs / 549 invocations. Previewing the
successor returned HTTP 200 with `providerRequestsStarted: 0` and the same
counts.

The same requirement also retained a current V1 document task. It remained
independently runnable, proving that provenance alone is not substitution
identity: successor families are exact `kind + protocol + provenance` tuples.
The readiness index is built once per current-input reconciliation and reused
across the 3,828-task audit ledger rather than rescanning SQLite per task.

TypeScript checks, the Studio check, the production control-plane build, and
all 91 control-plane test files / 630 tests pass on the available Node 22 host;
the expected repository Node 24 engine warning remains.

## Authority boundary

This plan changes local scheduling eligibility and read projections only. It
does not authorize recurring campaigns, new provider requests, live orders,
signatures, credentials, external writes or value-moving operations.
