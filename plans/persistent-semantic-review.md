# Persistent semantic review

Status: active
Started: 2026-08-02

## Outcome

Turn attributed AI proposals waiting for independent semantic review into a
durable, bounded work queue. Review work must survive restart, lease concurrent
model requests deterministically, retry transient failures within a request
budget, and notify the operator when advisory results or terminal failures
arrive.

## Evidence driving the plan

The first retained production-like corpus attributed 28 of 41 AI lifecycle
proposals to four recurring search issues. All 28 stopped at `PROPOSED`; none
had an independent review artifact. More search concurrency would have
increased backlog without increasing qualified opportunity throughput.

## Architecture decision

The scheduler owns orchestration, never semantic authority:

`attributed proposal → durable review job → bounded lease → independent AI report → operator inbox`

Jobs are seeded only from proposal identities returned by passed issue leases
and still present in the content-addressed Market Archaeologist record. The
existing reviewer remains the report producer. A passing report completes the
job even when it recommends rejection or escalation; only a separate operator
decision may accept a proposal for simulation.

Durable review jobs also preserve issue lineage after short-lived search leases
roll out of the operational retention window. Funnel metrics therefore measure
the complete persisted campaign instead of only the most recent scheduler tick.

The first budget basis is exact request attempts because provider token/currency
usage is not yet qualified. Each job has a fixed attempt ceiling, each scheduler
tick has a request ceiling, and concurrent leases have a hard limit. Provider
usage metadata may refine this later without changing job identity.

## Construction slices

- [x] Refactor the semantic-review desk for bounded concurrent independent
  invocations while preserving per-review idempotency.
- [x] Add content-hashed review jobs with persistent pending, leased,
  retry-wait, passed, and exhausted states.
- [x] Recover expired leases after restart and reconcile already-persisted
  review results before spending another request.
- [x] Dispatch by issue priority with one global job per proposal, including
  explicit multi-issue lineage.
- [x] Emit durable deduplicated in-app notifications for completed advisory
  reviews and exhausted jobs.
- [x] Expose queue depth, concurrency, request-attempt budget, retry state, and
  recommendation outcomes in the control-plane projection and Studio.
- [x] Prove deterministic identities, concurrency bounds, request ceilings,
  retries, restart recovery, notification dedupe, and zero authority/effects.
- [ ] Qualify the real SQLite-backed runtime and responsive Studio, then retire
  the completed attribution plan after its Git-history recovery is verified.

## Safety invariants

- The scheduler may call only the configured advisory semantic-review port.
- Model confidence, recommendation, and rationale never alter issue priority or
  promote an opportunity automatically.
- No job or notification grants simulation, certificate, execution, credential,
  external-write, or value-moving authority.
- Failed persistence converts work to a visible terminal failure; it must never
  silently spend an unrecorded retry.

## Qualification gate

- Focused unit tests use fake reviewers and clocks; no provider request is
  required for deterministic verification.
- SQLite migration and restart tests cover jobs, expired leases, and
  notifications.
- Full workspace typecheck, tests, and production build pass under Node.js 24.
- Real Studio renders queue operations at desktop and 415px widths with no
  console errors or horizontal overflow.

## Qualification evidence

Node.js 24 passed the full 315-test workspace suite, typecheck, and production
build on 2026-08-02. A live SQLite-backed scheduler run retained 35 issue-linked
jobs, completed 19 independent reviews, parked 16 jobs in `BLOCKED_EVIDENCE`
without exhausting their request budget, and left all 19 reviewed proposals at
the operator-decision boundary. A development-process reload stranded two
leases; both became bounded retry-wait jobs at expiry and then completed on the
next tick, demonstrating restart recovery against the real store. Responsive
Studio browser qualification remains the final retirement gate.
