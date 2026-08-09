# Semantic-review detail recovery

Status: implemented and live-qualified; operator re-review pending

Created: 2026-08-10

## Product problem

The live positive-gross frontier contains five proposal dossiers whose retained
semantic-review jobs say `PASS` or `DUPLICATE_SCOPE`, but whose detailed review
records were physically deleted by the fifty-record SQLite retention policy.
This is not a handoff pagination defect. Relation conclusion, constraint
classification, missing evidence, and counterexamples no longer exist and must
not be reconstructed from the old recommendation label.

The dossier correctly names `RECOVER_REVIEW_DETAIL`, but that gate is not yet
actionable. A persistent AI-native machine needs a durable work item that a
human or browser Agent can request once and the scheduler can finish without
keeping a tab open.

## Decision

- Add semantic-review job v4 for explicit detail recovery. The job retains a
  bounded, content-addressed recovery lineage containing the request time,
  proposal that requested recovery, exact prior job artifact hash, prior review
  ID, prior recommendation, and recovery-only authority.
- Recovery never fabricates a capsule. It resets the named legacy canonical job
  to scheduler-managed pending work; only a new passing review can create the
  v4 outcome capsule.
- A duplicate-scope proposal resolves only its exact `duplicateOfJobId` and
  requests recovery of that canonical job. Repeated requests are idempotent.
  Another same-scope PASS is never substituted.
- The ordinary scheduler owns dispatch, retry, timeout, restart recovery, and
  notifications after enqueue. The request surface does not wait for the model
  and does not require a browser session to remain open.
- Handoff v2 labels in-flight direct or canonical recovery as
  `RECOVERY_PENDING` and uses `AWAIT_REVIEW_RECOVERY` as the deterministic next
  gate. A completed canonical capsule automatically becomes
  `CANONICAL_SCOPE_REUSE` for every exact duplicate reference.
- Studio exposes recovery as a proposal-local action only for explicit legacy
  gaps, then renders queued/running/retrying/blocked state from the persisted
  handoff. It never treats enqueueing or completion as an operator acceptance.

## Compatibility and authority

- Stored job v1-v3 records and hashes replay unchanged. V4 is introduced only
  by an explicit recovery request and retains the old job artifact identity
  before mutation.
- Recovery may spend one bounded semantic-review request budget through the
  already configured provider. It cannot invoke Pi, acquire credentials, sign,
  simulate, certify, place an order, or move value.
- A legacy job without its durable proposal evidence bundle remains blocked;
  the recovery request cannot silently use a different current contract.
- Recovered outcome capsules remain advisory summaries. Existing independent
  operator, simulation, exact-verifier, and execution gates are unchanged.

## Qualification

- Validator tests prove v4 lineage hashing, prior-artifact binding, tamper
  rejection, legal pending/pass states, and v1-v3 replay.
- Scheduler tests prove direct and duplicate requests target the exact canonical
  legacy job, are idempotent, survive SQLite restart, dispatch through normal
  retry policy, and create a capsule only from the new exact report.
- Server tests prove the bounded proposal-local enqueue endpoint and literal
  authority-false response.
- Dossier tests prove `LEGACY_DETAIL_UNAVAILABLE → RECOVERY_PENDING →
  DIRECT_REVIEW/CANONICAL_SCOPE_REUSE` without same-scope fallback.
- Studio tests and in-app-browser QA cover action visibility, pending state,
  desktop and 390 px hierarchy, overflow, text floor, and console diagnostics.
- Live qualification queued the three unique canonical jobs behind the five
  current legacy dossiers. All three completed on their first scheduler attempt;
  exact duplicate references reused the recovered canonical capsule and spent no
  additional model request. Recovery counters settled at three completed, zero
  pending, zero blocked, and zero exhausted without initiating fee/depth or
  trading work.
- The recovered Arizona governor pair was classified as a hard settlement
  constraint with no missing review evidence, but remained research-only because
  its free-form premise is not bound to venue rules or another traded outcome.
  The remaining recovered dossiers are related/textual candidates or retain
  explicit evidence gaps. Recovery therefore restored decision evidence without
  manufacturing a decision-ready opportunity.
- In-app-browser qualification covers 1280 px and 390 px layouts. The focused
  dossier has no horizontal overflow or console errors, and its initial durable
  read uses a loading state instead of briefly inferring a gate from the bounded
  live window.
- Node 24.14.0 type checks, all 583 workspace tests, and the production build
  pass.
