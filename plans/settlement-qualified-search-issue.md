# Settlement-qualified search issue

Status: merged in PR #55
Started: 2026-08-02

## Outcome

Add a durable, recurring AI assignment whose narrow job is to find exactly
two current binary listings that may encode the same settleable claim and are
therefore worth deterministic economic triage. Existing broad issues remain
useful research scouts; this issue is the product's first deliberately shaped
arbitrage-acquisition lane.

## Runtime evidence

The retained issue portfolio has four broad briefs. Across its current window,
39 terminal leases produced 12 novel signatures, 28 proposals, and 33 evidence
gaps. Of 45 unique evidence proposals, 22 are merely `RELATED`, while only two
are `EQUIVALENT`. The pre-review frontier has no positive, settlement-qualified
gross hint and no exact adapter coverage.

The scheduler, concurrent leases, durable records, pi escalation, and in-app
notifications already exist. The missing product capability is a bounded task
that directs AI toward candidates capable of surviving later economic checks.

## Architecture decision

Seed a fifth default issue named `Settlement-qualified two-leg parity` under
the existing equivalence lens. Its brief requires exactly two current open
binary listings, exact refs, explicit resolution paths, compatible time and
outcome mappings, current indicative prices, and falsification of void/oracle
differences. It rejects loose relatedness, explicit non-settlement clauses, and
multi-leg baskets. Any rough payout/price comparison is only search
prioritization; deterministic triage and independent review retain authority.

Default seeding becomes an idempotent reconciliation by stable default issue
ID, so an existing four-issue database receives only the missing issue while
operator edits, counters, cadence, enabled state, and history on existing
defaults remain untouched.

The issue also owns a deterministic candidate policy: only `EQUIVALENT`
proposals with exactly two listing refs count as hits. pi may retain
`CONFLICTING` or other falsification proposals as research evidence, but those
do not increment the issue's novel-candidate metric or create a finding
notification.

## Construction slices

- [x] Add the bounded settlement-qualified default issue contract.
- [x] Reconcile missing defaults in non-empty durable stores without overwrites.
- [x] Prove scheduling priority, concurrency, idempotence, and prompt scope.
- [x] Deterministically separate target relations from retained falsification evidence.
- [x] Exercise the issue against the current immutable market corpus.
- [x] Run focused and full Node 24 qualification plus visual inspection.
- [x] Publish and serially merge the next PR.

## Safety invariants

- AI can propose candidates only; it cannot accept a relation, certify profit,
  simulate an exchange, place an order, sign, or move value.
- Exactly two current listing refs are requested, but deterministic contract
  matching and settlement eligibility decide whether a proposal is triageable.
- Indicative prices are research evidence, never executable fills; fees, depth,
  fillability, latency, and capital remain unresolved until exact adapters own
  them.
- A missing default issue may be inserted; an existing issue record is never
  reset to its template.
- Model and pi budgets remain bounded per lease and global concurrency remains
  capped at three.

## Qualification gate

- A fresh store exposes five stable default issues and schedules the new P5
  issue in the first three concurrent slots.
- A non-empty store that lacks defaults receives them idempotently; restarting
  does not duplicate or overwrite existing issue state.
- The emitted task question contains the two-leg, current-contract,
  settlement-path, economic-prioritization, and no-executable-profit limits.
- Only an `EQUIVALENT` proposal with exactly two refs counts as a policy hit;
  retained conflicts produce neither a hit nor a finding notification.
- The live durable control plane retains the new issue and completes or records
  its current-corpus lease without exceeding bounded concurrency.
- Complete type checking, repository tests, production build, and desktop plus
  narrow Studio inspection pass.

## Runtime observation

The fifth P5 issue reconciled into the existing four-issue SQLite store without
resetting any counters or pause state. Its first live lease found the current
Limitless/Opinion hourly crypto pair but pi returned an invalid `listingRefs`
shape; the parser failed closed and emitted a durable failure notification.
The prompt now carries the issue assignment into the deep lane and names the
required JSON-array contract explicitly.

After refreshing all seven anonymous catalog sources, the retry passed with two
current fast-lane refs, four two-ref deep proposals, and five evidence gaps. The
result was a successful falsification, not an arbitrage lead: all four relations
were `CONFLICTING`. Limitless uses strict comparison, Pyth, explicit windows,
and outage fallback; Opinion uses greater-than-or-equal, Chainlink, omits exact
window instants, and exposes no indicative prices. Deterministic economic triage
classified every proposal `RELATION_UNSUPPORTED` with no boost. This evidence
caused the issue-level candidate policy described above.
