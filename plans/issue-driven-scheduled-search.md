# Issue-driven scheduled search and notifications

Status: completed
Started: 2026-08-01
Completed: 2026-08-01

## Goal

Turn AI-native market archaeology into an operable recurring system: durable
search briefs behave like issues, independent issues can run concurrently, and
operators receive a quiet, deduplicated inbox when a new candidate or failure
needs attention.

## Architecture

The state transition is:

`Search Issue → Schedule → Lease → Fast scout → optional pi → Finding → Notification`

An issue owns durable intent: question, semantic lens, venue scope, cadence,
priority, and enable state. A lease owns one immutable execution scope and its
budgets. Model runs own proposal-only observations. A notification owns only
operator attention. These identities are separate so changing inbox read state
cannot rewrite evidence, and rerunning the same issue/corpus scope cannot spend
again.

## Completed slices

- [x] Add canonical, hash-validated search issue and notification records.
- [x] Upgrade operational SQLite to schema v10 with restart-safe issue and
  notification tables; remove the legacy same-snapshot/lens uniqueness
  assumption while retaining immutable lease IDs.
- [x] Seed four useful issue briefs for equivalence, implication, partition,
  and mechanism-conflict searches.
- [x] Poll due work by priority and fill three bounded concurrent issue slots.
- [x] Coalesce one issue while active and replay one issue/corpus lease
  idempotently after completion or restart.
- [x] Resume interrupted leases before cadence; when their exact snapshot is no
  longer recoverable, fail them visibly and issue current-corpus work without
  substituting evidence inside the old lease.
- [x] Notify once per novel candidate signature and once per failed lease;
  keep empty and duplicate scans quiet.
- [x] Expose create, run-now, pause/resume, and acknowledgement HTTP actions.
- [x] Add the Scheduled Search Desk and Finding Inbox to Studio.
- [x] Preserve proposal-only AI authority and the exact verifier boundary.
- [x] Add scheduler, concurrency, persistence, HTTP, SSE-framing, and UI
  projection coverage.

## Operating posture

Automatic dispatch is explicit through `PMH_SEARCH_ISSUE_TICK_MS`; manual runs
remain available with the timer off. The issue scheduler supersedes the legacy
sequential lens timer when enabled. No task can review its own semantics,
compile an exact certificate, call an order gateway, or move value.

## Qualification

- 305 workspace tests pass with full typecheck and production build.
- SQLite restart tests restore custom issue intent and pause state; partial v10
  databases repair missing lease or notification tables without replacement.
- A real 460-listing run filled all three slots and rejected the fourth at the
  concurrency boundary. Equivalence and implication produced nine grounded pi
  proposals in total; an out-of-scope partition response failed closed and
  generated an operator notification.
- Desktop and 415px Studio inspection show the queue, active-slot count,
  pause/resume controls, create form, and inbox without console errors or
  horizontal overflow.
