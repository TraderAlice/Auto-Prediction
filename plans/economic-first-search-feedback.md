# Economic-first search feedback

Status: qualified; ready to publish
Started: 2026-08-02

## Outcome

Make recurring AI search spend its expensive semantic-investigation budget on
current two-leg pairs that can still have positive gross economics. Preserve
the broader semantic-research issues, but give the settlement-qualified parity
issue a deterministic bigint gate before pi and feed economic yield back into
the issue desk and Studio.

## Runtime evidence

The fresh live corpus has seven eligible sources and 467 listings. The retained
40-lease window contains 32 policy-matched proposals from 13 novel scans and 13
pi escalations. Across the durable proposal corpus, economic triage sees 59
items: zero positive gross hints, four non-positive hints, one missing price,
one settlement-ineligible contract, one current-contract mismatch, 15
unsupported listing scopes, and 37 unsupported relation kinds.

The focused `Settlement-qualified two-leg parity` issue has four attributed
proposals and four completed reviews, but every retained proposal is
`CONFLICTING`. Its policy correctly prevents those proposals from becoming
finding hits, yet pi was still invoked before the deterministic system noticed
that no policy-matching opportunity survived. This is useful falsification
evidence, but an economically impossible pair should not consume the scarce
deep lane on every new corpus.

After implementation, a fresh seven-source refresh again retained 467
listings. The radar exposed five lexical pairs and one current positive gross
hint: buying the false leg of Gemini's `MLS Cup Champion — Nashville SC` with
the true leg of a Kalshi multi-game Nashville parlay cost an indicative 8,900
bps, leaving a 1,100 bps gross hint before fees and depth. The cheap semantic
lane returned no hypothesis because those contracts do not define the same
claim, so pi was correctly not invoked. This is the intended separation of
economic possibility from semantic validity.

Across the retained 40-lease window, four focused leases now contain an
economic gate: one positive, two blocked, and one legacy `NOT_RUN` failure.
One pi invocation was demonstrably avoided. The legacy failure also exposed a
context-selection bug: generic words in the full Agent brief could cause one
member of an already selected pair to be dropped. Exact radar scopes now rank
their bounded context using only the pair's shared blocking terms while the
full skeptical brief remains the Agent question.

## Architecture decision

Extend the lexical radar with a proposal-independent, two-listing indicative
screen. For canonical Yes/No or Up/Down pairs, enumerate both equivalent-claim
portfolios and calculate the best gross edge with fixed-point bigint rational
arithmetic. Prices are current catalog indications only: fees, depth,
fillability, latency, and execution remain explicitly absent.

The focused parity issue declares `requirePositiveGrossHint`. Its fast-lane
record binds the exact gate result. A positive hint may proceed to pi; a
non-positive, unavailable, or malformed hint completes the lease without pi,
without a finding, and without poisoning semantic deduplication for a future
price change. General equivalence, implication, partition, and mechanism
issues continue to build semantic knowledge without this gate.

Downstream issue attribution will join proposal economic triage back to source
issues. Studio will show positive/non-positive/unavailable economic yield and
pi calls avoided, so issue design can be tuned from empirical conversion rather
than model confidence.

## Construction slices

- [x] Add reusable bigint-only two-listing indicative economics.
- [x] Rank lexical radar pairs by economic posture without changing semantics.
- [x] Add the focused issue's pre-pi positive-gross gate and durable audit data.
- [x] Preserve restart compatibility for retained leases and operator issue state.
- [x] Attribute economic triage outcomes and avoided pi calls by issue.
- [x] Show economic search yield and gate outcomes in Studio.
- [x] Run focused and full Node 24 qualification plus responsive visual QA.
- [x] Exercise the gate against the live seven-source corpus.
- [ ] Publish and serially merge the campaign PR.

## Safety invariants

- All price, cost, payout, and basis-point arithmetic uses bigint fixed point.
- A gross hint is search priority only; it is never semantic, simulation,
  certificate, execution, or value-moving authority.
- Missing prices, noncanonical outcomes, malformed scales, and unsupported
  arity fail closed before pi for the focused issue.
- A skipped non-positive pair may be reconsidered when a future corpus changes
  its prices; it must not become a permanent semantic duplicate.
- General semantic issues retain falsification coverage and are not suppressed.
- No external message, credential, order, signature, approval, or fund movement
  is introduced.

## Qualification gate

- Equivalent binary portfolios select the exact best gross hint across mixed
  venue scales with conservative ceil/floor rounding.
- Positive hints reach pi; zero/negative, unavailable, or malformed hints do
  not, and their reason is content-addressed in the terminal lease.
- Existing v1 retained leases load after restart and existing operator changes
  to default issue enabled/cadence state survive policy reconciliation.
- Economic outcome attribution is deterministic, deduplicated by proposal,
  and cannot claim yield for a proposal that did not originate from an issue.
- Studio renders issue-level economics and avoided pi counts at desktop and
  narrow widths without horizontal overflow.
- Type checking, focused tests, full repository tests, production build, and a
  live seven-source smoke all pass.
