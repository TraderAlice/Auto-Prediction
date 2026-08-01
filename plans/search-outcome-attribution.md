# Search outcome attribution

Status: completed
Started: 2026-08-02
Completed: 2026-08-02

## Outcome

Close the engineering feedback loop between recurring semantic search and the
deterministic opportunity lifecycle. Operators must be able to see which issue
briefs merely produce proposals and which briefs produce reviewed, accepted,
materialized, positively simulated, certified, or shadow-observed candidates.

## Architecture decision

Attribution is a read-only derived projection over durable identities:

`issueId → leaseId → proposalId → opportunityId → lifecycle artifacts`

No new mutable counter or database table is required. Search leases already
bind issue and proposal identities; review and lifecycle records already bind
proposal/opportunity identities. Rebuilding the projection from the same source
artifacts must produce the same content hash.

## Construction slices

- [x] Build a content-addressed attribution projection over retained issue
  leases, semantic reviews, operator decisions, materializations, simulations,
  exact verifications, and shadow observations.
- [x] Count distinct proposals at each funnel stage globally and per issue.
- [x] Surface multi-issue attribution and AI proposals discovered outside the
  issue scheduler instead of silently double-counting or dropping them.
- [x] Expose pending-review, pending-operator, materialization-blocked, and
  simulation-blocked bottlenecks without inventing a quality score.
- [x] Render the funnel and issue-level downstream counts in Studio with a
  rolling-upgrade fallback.
- [x] Add deterministic-order, attribution, authority, server projection, and
  responsive UI coverage.
- [x] Retire the previous completed plan after its Git-history recovery is
  verified.

## Measurement contract

- `PROPOSED` means a proposal ID returned by a passed deep search lease.
- `REVIEWED` means a completed passing independent semantic-review artifact.
- `OPERATOR_ACCEPTED` means a separate local research decision accepted the
  proposal for simulation; AI advice alone never counts.
- `MATERIALIZED_READY` means all required anonymous market evidence was acquired
  and qualified for simulation intake.
- `POSITIVE_SIMULATION` means the deterministic portfolio simulator found a
  strictly positive post-fee floor; it is still not a certificate.
- `CERTIFIED` means the first-party exact verifier issued a current certificate.
- `SHADOW_OBSERVED` means fresh anonymous market evidence was compared with a
  certificate-bound shadow intent; it is not a live fill.

Counts are distinct by proposal within each issue. A proposal linked to more
than one issue appears once globally, once in each contributing issue, and in an
explicit multi-issue count. AI lifecycle proposals with no passed retained issue
lease remain visible as unattributed; retention means this is not necessarily a
claim that they were originally manual.

## Safety invariants

- Attribution is evidence only and cannot change scheduler priority or cadence
  automatically in this slice.
- Model confidence never enters the funnel.
- The exact verifier remains the sole certificate authority.
- External-write, live-order, credential, and value-moving effects remain false.

## Qualification gate

- Focused unit tests prove stable identities, distinct counting, cross-issue
  attribution, unattributed proposals, and every funnel stage.
- Full workspace typecheck, tests, and production build under Node.js 24.
- Real SQLite-backed Studio projection renders desktop and 415px layouts with no
  console errors or horizontal overflow.

## Qualification evidence

- The real retained corpus attributed 28 of 41 AI lifecycle proposals to four
  recurring issues (68.29% coverage); 13 proposals remain outside retained
  passed issue leases, with zero invalid references and zero missing lifecycle
  records.
- All 28 attributed proposals are currently waiting for independent semantic
  review. This makes persistent, budgeted review scheduling the next measured
  throughput campaign; adding more scouts would not relieve the observed
  bottleneck.
- Workspace typecheck, 308 tests, and the production build pass under the
  bundled Node.js 24 runtime.
- Browser qualification passed at desktop and 415px widths with zero console
  warnings or errors and no horizontal overflow.
