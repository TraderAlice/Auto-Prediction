# Economic settlement eligibility

Status: merged in PR #54
Started: 2026-08-02

## Outcome

Prevent deterministic economic triage from promoting a cheap portfolio that
has no realizable settlement path. A positive gross hint may affect review
priority only when none of its exact current contracts explicitly denies
resolution or payout.

## Runtime evidence

The live frontier has 42 candidates but only one `POSITIVE_GROSS_HINT`. It is an
`EQUIVALENT` proposal joining `myriad:317:up-or-down-...` and
`myriad:213:up-or-down`, with a nominal `+2441 bps` gross floor. The exact current
description for listing 317 says the market is trading-only and will never be
resolved toward either option. The independent semantic reviewer returns
`ESCALATE`, while deterministic triage gives the proposal the frontier's only
priority boost.

This is a definition error rather than a price error: a complete-payout
portfolio is only economically meaningful when its legs can settle.

## Architecture decision

Add a narrow deterministic disqualifier over exact current contract evidence.
It recognizes explicit non-settlement clauses and returns a distinct
`SETTLEMENT_INELIGIBLE` posture before indicative arithmetic in both the
pre-review frontier and post-review attention queue. The projected item names
the affected listing references and the bounded detection policy; even an
accepted semantic relation stays research-only when its payout cannot settle.

The detector is one-way. Explicit denial proves ineligibility; lack of a known
denial does not prove that a market will settle. Candidates are never deleted or
penalized below their base priority, and semantic review remains scheduled.
Settlement anomalies are surfaced near the top of the Studio frontier without
changing their issue-derived scheduler priority.

## Construction slices

- [x] Define and test bounded explicit non-settlement evidence detection.
- [x] Gate economic classification and positive priority boosts.
- [x] Project the settlement posture and name it in Studio.
- [x] Reproduce the retained Myriad candidate as ineligible with zero boosts.
- [x] Run focused and full Node 24 qualification plus visual inspection.
- [x] Publish and serially merge the next PR.

## Safety invariants

- Detection uses only exact current listings already contract-matched to the
  durable proposal bundle.
- A phrase match can remove an economic boost but cannot reject a proposal,
  write a semantic decision, request simulation, or publish a certificate.
- Unknown settlement posture is never called eligible or safe.
- Raw prices, fees, depth, and payout claims are not invented.
- Every item remains retained at its original issue-derived priority.
- All monetary arithmetic remains bigint fixed-point.
- No external write, credential, order, signing, or value-moving route is added.

## Qualification gate

- An exact current listing containing the observed trading-only/never-resolves
  clause yields `SETTLEMENT_INELIGIBLE`, inert economics, and no boost.
- Common resolution clauses such as `resolves Yes if` remain merely
  `NOT_EXPLICITLY_INELIGIBLE`; they can reach existing price arithmetic.
- Captured-only or stale text cannot trigger the current-contract gate.
- Projection hashes and assertions bind settlement evidence and policy.
- The live frontier reports zero positive boosts for the retained Myriad pair
  while preserving it for independent review.

## Runtime observation

The unchanged 42-candidate live frontier now reports 0 positive hints, 0 boosts,
and 1 `SETTLEMENT_INELIGIBLE` item. The Myriad proposal remains present at its
base P2 priority. Its projected evidence names only
`myriad:317:up-or-down-73d55889-f062-4d2a-b4ac-901d64a261ee` with signal
`NEVER_RESOLVES`; indicative economics are inert rather than preserving the
misleading `+2441 bps` value.

Node 24 type checking, the complete repository test suite (185 control-plane
and 10 Studio tests), and the production build pass. Studio surfaces the
settlement anomaly before higher-priority ordinary items without changing its
base P2 scheduler priority. The frontier has no horizontal overflow at the
default desktop viewport or 390 px, and browser logs contain no warnings or
errors.
