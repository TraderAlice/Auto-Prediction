# Opportunity Lifecycle and Exchange Simulation Campaign

Status: active
Started: 2026-08-01

## Outcome

Turn subjective AI-discovered relations into a product-grade, inspectable queue
without pretending that model confidence is execution confidence. A candidate
must accumulate independently produced semantic, market-state, fee, simulation,
and exact-verification artifacts before it can reach notification or shadow
execution.

## Architecture decision

The AI is the search engine, not the judge. Its comparative advantage is
open-ended semantic exploration across event names, rules, time windows,
resolution sources, exceptions, and indirect implications. Programs resume
authority immediately after a proposal exists.

The lifecycle is:

1. `DISCOVERED`: an AI relation proposal or deterministic lead enters the queue.
2. independent semantic review accepts an exact relation scope or rejects it.
3. venue-specific exchange simulations bind book/pool state, fill policy,
   rounding, fees, size, and model qualification.
4. the first-party exact verifier may bind a certificate; simulators cannot.
5. policy routes a certified opportunity to in-app notification, explicit human
   approval for shadow execution, or automatic shadow execution.

There is deliberately no live route. “Human approval” means approval to start a
non-value-moving shadow run. Production authority remains a separate future
decision and cannot be inferred from this state machine.

## Phase 1 — durable AI handoff

- [x] Persist completed Market Archaeologist PASS/FAILED records in SQLite WAL.
- [x] Re-validate report, proposal, and canonical record hashes on restart.
- [x] Keep RUNNING work process-local and preserve runId idempotency.
- [x] Route persistence failure to a sanitized FAILED record.

## Phase 2 — exact exchange-model simulation

- [x] Implement a CLOB taker walk over exact bigint price/quantity levels.
- [x] Distinguish fill-or-kill rejection from immediate-or-cancel partial fill.
- [x] Bind book identity, fee schedule, conservative rounding, average price,
  adverse impact, and literal-false effects into a content-hashed report.
- [x] Implement generic constant-product AMM exact-in/exact-out arithmetic and
  invariant checks.
- [x] Prevent a generic AMM report from promoting until venue-specific
  calibration is supplied.

## Phase 3 — opportunity product lifecycle

- [x] Add an append-only, content-hashed opportunity state machine.
- [x] Admit AI proposals and deterministic leads into the same queue.
- [x] Retire negative deterministic screens before expensive semantic review.
- [x] Support three explicit post-certificate policies: notify only, require
  human approval, and automatic shadow execution.
- [x] Reject partial/rejected simulations and uncalibrated exchange models.
- [x] Keep certificates first-party and every lifecycle effect non-value-moving.
- [x] Expose lifecycle cases, exchange-model qualification, and routing policies
  in Harmony Studio.

## Next slices

- Persist lifecycle events and operator shadow decisions as a canonical journal.
- Add independent semantic review artifacts and adversarial counterexample runs.
- Calibrate AMM implementations against each venue's official contract and fee
  semantics instead of treating `x*y=k` as a venue fact.
- Compile accepted relation kinds into exact payoff constraints and exercise the
  CLOB simulator against fresh, bound multi-leg candidate books.
- Connect certificate-bound cases to the existing shadow engine and record
  planned versus observed fills, hedge checkpoints, and divergence.
- Add in-app notification acknowledgement. External channels require an explicit
  destination and authority decision.
- Measure useful-lead yield, review rejection reasons, simulation attrition,
  time-to-certificate, and shadow divergence. Never substitute model scores for
  those measurements.

## Safety invariants

- Solvers and exchange simulators publish evidence, never certificates.
- Core monetary values, prices, quantities, fees, payouts, and PnL are bigint
  fixed-point values.
- An uncalibrated venue model cannot advance to exact verification.
- No policy enum, HTTP route, gateway, credential request, or UI action can place
  a live order or move value.
- Notification is in-app only; the projection records that no external message
  was sent.
- Human approval authorizes shadow execution only.

## Findings log

- 2026-08-01: The old shadow engine assumed supplied fills and therefore could
  not establish discovery-to-execution confidence. Exact CLOB/AMM simulation is
  now a separate pre-certificate evidence boundary.
- 2026-08-01: Generic constant-product arithmetic is useful for exploration but
  is not exchange qualification. The lifecycle halts it at
  `AWAITING_MODEL_CALIBRATION`.
- 2026-08-01: The existing real three-venue candidate enters the shared lifecycle
  as a deterministic lead and terminates at `REJECTED_PREFLIGHT`; its zero gross
  floor prevents wasting AI review or verifier work.
- 2026-08-01: SQLite schema v6 restores the real five-proposal archaeology run
  after a control-plane restart. Studio projects six real cases: five awaiting
  independent semantic review and one rejected deterministic screen.
- 2026-08-01: The checkpoint passes 238 workspace tests, full typecheck, and
  production build under Node.js 24. Desktop and 430px lifecycle inspection have
  no horizontal overflow (`scrollWidth === clientWidth` at both widths).
