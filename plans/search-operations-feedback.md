# Search operations feedback

Status: completed
Started: 2026-08-02
Completed: 2026-08-02

## Outcome

Make issue-driven Agent search self-observing enough to tune. The Scheduled
Search Desk should report bounded, deterministic outcomes from retained leases,
not model scores or invented quality claims, while the planning ledger remains
small and internally consistent.

## Construction slices

- [x] Derive a retained-window performance projection from terminal issue
  leases without adding mutable counters or a schema migration.
- [x] Separate new candidate signatures, duplicates, pi escalations, fast
  hypotheses, deep proposals, and evidence gaps.
- [x] Attribute retained outcomes to individual durable issues.
- [x] Render aggregate rates and issue-level counts in Studio with a rolling
  upgrade fallback for projections produced before this field existed.
- [x] Prove aggregation, restart reconstruction, full workspace compatibility,
  and responsive browser behavior.
- [x] Retire stale completed plans and leave `PLANS.md` as a short active index.

## Measurement contract

The denominator is terminal issue leases still present in the bounded search
lease retention window. A “new candidate” is a new grounded fast-lane signature,
not a reviewed relation, executable opportunity, or certificate. The duplicate
and pi rates describe search operations only. Empty denominators display as
unknown rather than zero.

## Safety invariants

- Metrics cannot mutate issues, leases, notifications, semantic decisions, or
  lifecycle state.
- Model confidence is not a scheduling or promotion signal.
- Retention-window metrics never masquerade as all-time totals.
- AI authority remains `PROPOSE_ONLY`; verifier, execution, external-write, and
  value-moving effects remain false.

## Qualification gate

- The scheduler suite proves a three-lease window with one novel signature, two
  duplicates, one pi escalation, exact basis-point rates, per-issue attribution,
  and restart reconstruction from SQLite.
- All 305 workspace tests, full typecheck, and production build pass under the
  bundled Node.js 24 runtime.
- Desktop and 415px Studio inspection render real retained metrics with no
  console errors or horizontal overflow.
- The four retired plan files remain readable from the parent commit; Git, not
  the current planning index, is their append-only completion ledger.
