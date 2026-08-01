# Durable proposal evidence

Status: active
Started: 2026-08-02

## Outcome

Make semantic discovery durable across changing venue catalogs. Every new AI
relation proposal must carry the exact normalized listings that grounded it,
bound to the original corpus and proposal identities, so an independent review
can run hours or days later without relying on those listings still appearing
in the current snapshot.

## Evidence driving the plan

The persistent scheduler qualification retained 35 jobs and completed all 19
whose evidence remained usable. Sixteen jobs stopped in `BLOCKED_EVIDENCE`
without spending a request because their proposal listing references had rolled
out of the current corpus. The retry and concurrency machinery is healthy; the
bottleneck is loss of proposal-time semantic evidence.

## Architecture decision

Discovery will produce a minimal immutable bundle per proposal:

`proposal + original corpus identity + exact referenced listings + listing hashes → bundle identity`

The Market Archaeologist report retains the bundle with its proposal. The
semantic-review job copies it into its own durable record so review survival is
independent of both current catalog state and archaeologist-record retention.
Reviewing a captured bundle is explicitly labeled as original captured evidence,
not falsely described as a current-corpus rebase.

Legacy jobs without bundles remain supported. They may backfill a bundle only
when every exact listing reference is present; otherwise they stay visibly
blocked and spend no model request.

## Construction slices

- [x] Define and validate a bounded, content-addressed proposal-evidence bundle.
- [x] Capture one exact bundle for every new Market Archaeologist proposal.
- [x] Persist the bundle inside each new semantic-review job and backfill legacy
  jobs only from exact current refs.
- [x] Dispatch review from captured evidence after catalog rotation and preserve
  explicit evidence provenance in the report.
- [x] Project bundle coverage and distinguish legacy evidence debt from live
  review capacity.
- [x] Prove tamper rejection, bounded size, legacy compatibility, catalog-rotation
  review, restart survival, and zero authority/effects.
- [ ] Qualify the real SQLite-backed runtime and Studio, then publish the serial
  draft PR.

## Safety invariants

- Bundles contain normalized anonymous public listing evidence only; never
  credentials, browser state, order intents, signatures, or account data.
- A bundle can authorize only advisory semantic review.
- Model conclusions cannot mutate bundle content, issue priority, operator
  decisions, simulations, certificates, or execution state.
- Listing and bundle identities are recomputed on every persistence boundary.
- Missing or invalid evidence blocks work before a provider request is spent.

## Qualification gate

- Focused tests cover deterministic identity, field tampering, duplicate or
  mismatched refs, and bounded listing counts.
- A scheduler test creates a proposal on snapshot A, rotates to snapshot B, and
  proves review still uses the captured A listings.
- SQLite restart proves the job remains self-contained after the archaeologist
  report is unavailable.
- Full Node.js 24 typecheck, tests, and production build pass.
- Real projection reports bundle coverage and no new bundled job is
  `BLOCKED_EVIDENCE` solely because the live catalog rotated.

## Qualification evidence

- Focused control-plane regression: 31 files and 170 tests pass, including
  tamper and oversize rejection, v1 record compatibility, rotated-catalog
  dispatch, and SQLite restart with neither the original report nor current
  listings available.
- The historical SQLite store starts without migration loss. Of 45 retained
  jobs, 27 now hold v2 bundles (10 original captures, 17 exact-current rebases),
  29 have passed review, zero bundled jobs are evidence-blocked, and 16
  reference-only jobs remain explicit legacy debt.
- Real Market Archaeologist run
  `sha256:224c36146e001ea1f619c7b6feaa9743427f78cc8d4e10679098c4a1017ece4b`
  inspected 467 listings across seven venues and produced five proposals plus
  five matching v2 bundles. Every bundle embedded its proposal, retained two to
  four exact listings, used `PROPOSAL_CORPUS`, and exposed no execution or
  value-moving authority.
- Remaining gate: full workspace test/build and visual review of the expanded
  Studio evidence-coverage row before the draft is marked ready.
