# Economic review priority

Status: complete — draft PR #52
Started: 2026-08-02

## Outcome

Move deterministic indicative economics ahead of semantic-review dispatch so
the persistent AI search system spends its bounded reviewer budget first on
grounded proposals whose proposal-declared canonical portfolio currently has a
positive gross hint. This is a scheduling hint, never a semantic verdict or a
profit claim, and it must not discard non-positive proposals whose prices may
change later.

## Evidence driving the plan

The retained runtime has 50 attributed AI proposals, more than 30 passing semantic
reviews, 207 named missing-evidence items, and zero operator decisions. The
review-attention queue has only one compiler-ready item; its current indicative
portfolio is `-490` bps before fees and depth. Semantic-review jobs currently
inherit only the static priority of their originating search issue. Therefore
review requests are not ordered by even the cheapest deterministic signal of
whether a declared relation could currently fund a guaranteed-payout portfolio.

## Architecture decision

Derive a content-addressed `proposal-economic-triage` projection from durable v2
proposal evidence bundles plus the current market corpus. It evaluates only the
relation declared by the proposing Agent and only canonical two-leg binary
portfolios already supported by the deterministic payoff compiler.

Current indicative prices may be used only when each current contract still
matches the captured contract semantics. Arithmetic uses `bigint` fixed-point
rationals and reports gross basis-point bounds. Missing prices, changed
contracts, unsupported relations, and non-canonical outcome mappings become
named states rather than synthetic scores.

The semantic-review candidate builder receives a bounded `+1` priority boost
for `POSITIVE_GROSS_HINT` only when its base priority is below 5. No proposal is
suppressed or assigned a negative penalty. The review remains mandatory and
independent; the hint cannot accept semantics, compile a payoff, fetch a book,
certify, or execute.

## Construction slices

- [x] Extract one shared fixed-point indicative-economics kernel used before
  and after semantic review so portfolio arithmetic cannot drift.
- [x] Build a bounded, content-addressed proposal triage projection over current
  and durable evidence with explicit coverage and blocker states.
- [x] Feed a capped positive-hint boost into durable review scheduling without
  skipping or permanently demoting any proposal.
- [x] Expose the pre-review frontier, base/effective priority, and arithmetic
  caveats in Studio.
- [x] Prove stale-contract, missing/malformed-price, unsupported-relation,
  positive/non-positive, cap, ordering, identity, and authority behavior.
- [x] Qualify the retained runtime, responsive Studio, and the serial PR.

## Safety invariants

- Proposal economics validate budget order only; they are not semantic evidence
  and cannot replace independent review.
- A positive hint omits depth and fees, is non-executable, and never reaches the
  verifier or a venue gateway.
- Current contract identity must match captured semantic fields before current
  prices can contribute.
- Every monetary calculation uses `bigint`; JavaScript `number` is limited to
  bounded counts and scheduler priorities.
- Non-positive, missing, stale, and unsupported candidates remain retained and
  reviewable. Price changes can change the derived projection without rewriting
  proposal evidence.
- Base priority is re-derived from durable issue lineage on every reconcile;
  the retained effective job priority cannot compound a price boost across ticks.
- Scheduler effects remain model-request bounded and proposal-only.

## Qualification gate

- The pre-review and post-review economics paths choose the same canonical
  portfolio and exact basis-point bounds for identical evidence.
- A positive gross hint below priority five increases effective review priority
  by exactly one; a priority-five hint and every other state remain unchanged.
- Existing durable jobs remain readable and reconcile deterministically.
- Projection identity changes with captured evidence, current contract, price,
  or issue lineage.
- Node.js 24 workspace typecheck, tests, and production build pass.
- Real runtime reports how many pending candidates receive a boost and why the
  rest do not.

## Retained runtime observation

The 2026-08-02 retained projection contains 32 grounded review candidates: one
positive gross hint, four non-positive hints, one missing price, one changed
contract, 12 unsupported listing scopes, and 13 unsupported relations. The
positive item has a base priority of 2 and receives one actual boost to priority
3. Repeated projection and scheduler reconciliation leave it at 3, proving the
retained effective priority does not compound. All 32 items remain retained.
The review scheduler had no pending or leased jobs and 34 passing reviews at
observation time.
