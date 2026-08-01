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

The discovery side is intentionally a long-running search process, not a batch
classifier. Scheduled Agent work receives an immutable catalog snapshot plus a
bounded search lease, uses repository-like read/search/list tools to explore
names, rules, dates, sources, exceptions, and already-known relations, and
returns content-addressed proposals. The scheduler owns cadence, deduplication,
retry, and cost budgets; Agents own semantic search strategy. Neither owns
promotion authority.

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

## Phase 4 — adversarial semantic review and durable decisions

- [x] Run a separate bounded AI invocation as an advisory counterexample
  reviewer over exact, content-addressed listing evidence.
- [x] Bind the proposal's original corpus and the current review corpus, and
  label retained-listing review as `REBASED_CURRENT_CORPUS`.
- [x] Persist semantic-review records and opportunity lifecycle journals in
  SQLite WAL with canonical hashes, append-only history, and restart recovery.
- [x] Keep AI review advisory-only and require a separate local operator
  decision before a case can enter exchange simulation.
- [x] Limit that decision to `ACCEPT_FOR_SIMULATION` or `REJECT`; neither grants
  production review, certificate, promotion, or execution authority.
- [x] Expose counterexamples, missing evidence, exact assessments, rationale,
  and the research-only decision boundary in Harmony Studio.

## Phase 5 — relation payoff compilation and portfolio simulation

- [x] Deterministically compile accepted two-listing `EQUIVALENT`, `IMPLIES`,
  `SUBSET`, `MUTUALLY_EXCLUSIVE`, and `EXHAUSTIVE` relations into canonical
  truth states and buy-only complete-payout portfolios.
- [x] Keep `RELATED`, `CONDITIONAL`, `CONFLICTING`, changed reviewer
  conclusions, and multi-listing proposals blocked from automatic payoff
  compilation.
- [x] Bind a simulation plan to the relation artifact, research decision,
  payoff portfolio, venue, outcome instrument, exact book/pool state, fee
  schedule, quantity, and fixed-point scales.
- [x] Calculate the minimum canonical payout, total simulated cost, and
  post-fee floor across the whole portfolio rather than judging full fills leg
  by leg.
- [x] Reject complete fills with a non-positive portfolio floor, reject partial
  legs, and stop generic AMMs at venue calibration before exact verification.
- [x] Persist bigint simulation bundles inside the append-only lifecycle
  journal and restore them through canonical bigint decoding.
- [x] Add a strict decimal-string HTTP intake and JSON-safe Studio summaries;
  neither surface grants verifier, certificate, or execution authority.

## Phase 6 — anonymous portfolio materialization

- [x] Retain exact venue outcome-token IDs, price/quantity scales, and minimum
  ticks through catalog context, semantic review, and payoff compilation.
- [x] Resolve each portfolio leg to the compiler-bound TRUE/FALSE outcome
  instrument rather than accepting a browser-supplied token identity.
- [x] Acquire Polymarket and Limitless public books through anonymous,
  byte-capped GETs with redirects rejected and credentials omitted.
- [x] Preserve source URL, protocol identity, receive time, content hash, raw
  bytes, and venue generation when one exists in a bounded process desk.
- [x] Require one fresh receive-time window across every leg and expose partial
  acquisition, schema drift, and instrument mismatch as explicit blockers.
- [x] Query current Polymarket CLOB market info, bind its token set and minimum
  tick to the compiled leg, and materialize both explicit zero-fee and
  price-dependent binary-curve schedules without flattening the curve.
- [x] Fail closed for Limitless's table-only dynamic taker curve and venues
  without a qualified anonymous book surface.
- [x] Let Studio acquire or refresh one payout unit of public depth for each
  qualified portfolio and show retained source count plus exact blocker text.

## Phase 7 — price-dependent fees and durable materialization

- [x] Generalize simulation fees to content-hashed collateral-rate and binary
  price-curve contracts using exact bigint fixed-point arithmetic.
- [x] Reproduce Polymarket's published crypto-market fee vectors, including its
  five-decimal fee quantum and conservative upward rounding.
- [x] Mark public aggregated CLOB levels as requiring match-level calibration
  when per-match fee rounding can change the result; such reports cannot reach
  the exact verifier.
- [x] Persist materialization records and raw book/fee bytes atomically in
  SQLite WAL schema v8, restoring and revalidating every content binding after
  restart.
- [x] Bound durable retention, remove orphaned raw evidence, and fail closed on
  byte or record tampering.
- [x] Show durable public-evidence counts and each leg's fee model/qualification
  in Studio, with compatibility fallbacks for rolling control-plane upgrades.

## Phase 8 — exact promotion and certificate-bound shadow route

- [x] Convert a positive anonymous-materialization bundle into the first-party
  exact candidate shape without accepting browser-supplied identities.
- [x] Bind each candidate leg to listing rules, raw book generation/state,
  exact fee schedule, tick, quantity, canonical resolution states, and expiry.
- [x] Round aggregate taker cost conservatively and require the exact
  certificate floor to be no greater than the simulated portfolio floor.
- [x] Persist exact verification records and terminal rejections inside the
  append-only lifecycle journal and re-verify them on restart.
- [x] Derive shadow intents only from a current certificate and its bound
  simulation bundle; reserve virtual capital and record planned versus observed
  fills through the existing shadow engine.
- [x] Route a certificate through explicit human approval or automatic shadow,
  with atomic state changes, zero gateway calls, and literal-false live/value
  effects.
- [x] Expose exact verifier evidence, shadow approval, and locked replay results
  in Studio and through narrow HTTP routes.

## Phase 9 — scheduled Agent search leases

- [x] Add a durable scheduler that issues bounded leases against immutable
  catalog/context identities; no unbounded autonomous loop or hidden retry.
- [x] Give each lease a search thesis, venue/date scope, novelty target, maximum
  tool/request budget, deadline, and deterministic idempotency identity.
- [x] Let cheap fast Agents search with bounded catalog contexts; reserve
  read/grep/find/list-style full-MarketFS archaeology for pi and difficult
  abstraction work.
- [x] Persist proposal lineage, query/tool trace summaries, evidence gaps,
  duplicate links, and lease outcomes without persisting chain-of-thought.
- [x] Route novel pi relation proposals through the existing independent
  skeptical semantic review before any deterministic payoff compilation.

## Phase 10 — semantic relation graph and feedback

- [ ] Maintain a content-addressed graph of listings, claims, time windows,
  resolution sources, relation hypotheses, counterexamples, and exact review
  decisions.
- [ ] Search graph neighborhoods as well as raw catalogs so Agents can discover
  indirect implication, partition, and mechanism-mismatch opportunities.
- [ ] Feed lifecycle outcomes back as search evidence: duplicate, semantic
  rejection, missing rule, no depth, fee/model block, exact rejection,
  certificate, and shadow divergence.
- [ ] Prioritize by empirical yield and evidence freshness, never by an opaque
  model confidence score and never by granting an Agent more authority.

## Next slices

- Calibrate AMM implementations against each venue's official contract and fee
  semantics instead of treating `x*y=k` as a venue fact.
- Determine whether Polymarket exposes enough match-level public evidence to
  reproduce per-match fee rounding. Until then the public aggregated-book
  curve remains simulation evidence, not verifier-eligible evidence.
- Qualify Limitless's buy/sell dynamic fee curves only if an official exact
  function or executable contract becomes available; do not interpolate its
  published table.
- Add an operator-authored structured scope for conditional, multi-listing, or
  reviewer-reclassified relations; free-text rationale must not become a payoff
  partition implicitly.
- Run the opt-in lease cadence long enough to measure useful-lead yield,
  duplicate rate, evidence gaps, and pi escalation rate before increasing
  fan-out.
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
- Scheduled Agents may choose searches and propose relations, but cannot write a
  semantic decision, compile an exact candidate, invoke a value-moving gateway,
  or alter their own authority/budget policy.

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
- 2026-08-01: SQLite schema v7 adds canonical semantic-review records and
  append-only opportunity lifecycle journals. Restored machines replay and
  revalidate every event identity before accepting their projected state.
- 2026-08-01: A separate DeepSeek V4 Flash reviewer rebased one retained BTC
  proposal onto the current exact listing evidence and recommended research
  simulation only. Artifact `sha256:0ddf6abb…707c0` identifies differing
  oracles, resolution times, outcome mappings, and cancellation semantics;
  every production, simulation, and execution authority remains false.
- 2026-08-01: The semantic-review workflow passes 244 workspace tests, full
  typecheck, and production build under Node.js 24.14.0. Operator acceptance
  remains intentionally pending rather than being inferred from AI advice.
- 2026-08-01: The deterministic relation compiler maps five exact binary
  relation families to canonical truth tables and guaranteed-payout buy
  templates. Broad `RELATED` and conditional semantics remain research leads,
  not verifier inputs.
- 2026-08-01: Opportunity simulation now evaluates the complete portfolio.
  Full CLOB fills costing 850 units against a 1,000-unit canonical payout
  advance only to `AWAITING_EXACT_CERTIFICATE`; 1,200-unit cost, incomplete FOK
  legs, and generic AMMs stop at their appropriate gates.
- 2026-08-01: The relation-to-simulation slice passes 256 workspace tests, full
  typecheck, production build, SQLite restart recovery, and desktop/430px
  Browser inspection with no horizontal overflow. Real operator decisions and
  simulations remain zero.
- 2026-08-01: Outcome-instrument evidence is no longer discarded before AI
  review. The compiler accepts only canonical Yes/No or Up/Down mappings,
  binds the selected token and fixed-point contract into every leg, and rejects
  stale legacy evidence or browser-substituted instruments.
- 2026-08-01: The anonymous materializer captures exact public order-book and
  fee bytes, rejects mixed-time snapshots and protocol mismatches, and hands a
  complete plan directly to portfolio simulation only when all legs use an
  exactly representable fee schedule. Official fee evidence established that
  current non-zero Polymarket and Limitless taker fees are price-dependent, so
  they remain visible blockers rather than being flattened into a percentage.
- 2026-08-01: The materialization slice passes 262 workspace tests, full
  typecheck, and production build under Node.js 24. Desktop and 430px lifecycle
  inspection show no runtime errors or horizontal overflow. The real runtime
  still has no operator decision or simulation; no artificial decision was
  created to make the new controls appear.
- 2026-08-01: Current Polymarket CLOB market info binds fee rate, exponent,
  token set, tick, and fee-enabled state. The simulator reproduces the official
  `C × rate × p × (1-p)` vectors in bigint, but aggregated public book levels do
  not expose the underlying match partition needed to prove per-match rounding;
  non-zero curve reports therefore stop at `MODEL_CALIBRATION_REQUIRED`.
- 2026-08-01: SQLite schema v8 atomically retains anonymous materialization
  records plus byte-exact public book/fee evidence. Restart recovery rechecks
  source, raw-content, record, and materialization identities; retention removes
  orphaned evidence, and tampering fails closed.
- 2026-08-01: The dynamic-fee and durable-materialization slice passes 273
  workspace tests, full typecheck, and production build under Node.js 24.14.0.
  Browser inspection also caught and fixed a rolling-upgrade white screen when
  an older control-plane projection omitted `ai.semanticReview`; desktop and
  430px lifecycle layouts finish without horizontal overflow.
- 2026-08-01: Positive, zero-fee public-book portfolios can now cross a narrow
  first-party exact-verification boundary. The verifier rebinds compiled truth
  states, raw sources, book/fee identities, quantity, ticks, and a 15-second
  expiry; generic browser simulations and match-rounding-sensitive fee curves
  remain certificate-ineligible.
- 2026-08-01: Certified cases route into a certificate-bound replay using only
  virtual capital and the existing live-disabled ShadowExecutionEngine. Human
  approval authorizes that replay only; the recorded run proves all intents
  filled, lifecycle `LOCKED`, gateway calls zero, and value-moving effects false.
- 2026-08-01: The next discovery slice adopts scheduled, durable Agent search
  leases. The intended analogy is repository archaeology: Agents navigate a
  content-addressed market/rules corpus heuristically, while the scheduler owns
  budgets and deterministic components own every promotion decision.
- 2026-08-01: SQLite schema v9 persists search leases before AI work starts and
  permits only the exact `ISSUED` → terminal transition. Four deterministic
  lenses cover equivalence, implication, partition, and mechanism divergence;
  cheap scouts receive at most one model request by default, while only a novel,
  grounded, multi-listing signature may consume one pi MarketFS run. Duplicate
  signatures link to their predecessor without another pi call. Query summaries,
  candidate refs, proposal IDs, evidence gaps, and outcomes are retained;
  chain-of-thought and tool execution traces are not.
- 2026-08-01: Phase 9 closes with 286 passing workspace tests, full typecheck,
  and production build under Node.js 24.14.0. Desktop and 430px Studio checks
  have no console warnings/errors or horizontal overflow. A real local partial
  migration with `user_version=9` but no lease table is repaired by verifying
  schema facts in addition to the version marker; the repair is covered by a
  non-destructive regression test.
- 2026-08-01: Exact promotion and certificate-bound shadow routing close at 280
  passing workspace tests, full typecheck, and production build under Node.js
  24.14.0. Desktop and 430px lifecycle inspection show no console errors or
  horizontal overflow; the operational dataset contains no synthetic exact case
  created merely to exercise the new controls.
