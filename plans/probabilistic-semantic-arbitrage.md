# Probabilistic semantic arbitrage

Status: active implementation; core probability-bound artifact and deterministic
bounded-risk compiler implemented locally

Created: 2026-08-02

## Product correction

The system currently promotes only relations that forbid a joint settlement
state exactly. That is necessary for a no-loss certificate but too narrow for
the product's AI-native thesis. Many valuable meaning-space opportunities are
near constraints: an earlier event makes a later act much less likely without
making it logically impossible.

For example:

- `A`: Trump is shot during August.
- `B`: Trump publicly livestreams drinking cola during September.

A non-fatal shooting means `A ∧ B` remains possible, so the pair cannot enter
the hard exact compiler. But if evidence supports an upper bound
`P(A ∧ B) ≤ ε`, buying both NO legs costs `C` and pays
`2 - 1_A - 1_B`. The probability bound alone gives an expected-payout lower
bound of `1 - ε`; therefore a conservative pre-fee edge floor is
`1 - ε - C`. A sufficiently large price violation can dominate the explicitly
bounded double-true tail risk.

This is a first-class `PROBABILISTIC_SEMANTIC_ARBITRAGE` opportunity, not a
logic error and not a guaranteed-arbitrage certificate.

## Architecture

### 1. Soft constraint artifact

Introduce a content-addressed artifact that binds:

- exact listing and rule-evidence identities;
- the adverse joint truth state(s);
- a probability interval in integer parts-per-million, especially a conservative
  upper bound `epsilonPpm`;
- the bound's time horizon, reference class, evidence, assumptions, and expiry;
- Agent proposal lineage plus independent critic/calibration runs;
- counter-scenarios, including non-fatal recovery, proxy/recorded appearance,
  postponement, changed wording, and venue-resolution divergence;
- explicit `ESTIMATE_ONLY` authority and no certificate or execution authority.

Do not store a naked model confidence. Every numeric bound must be reproducible
from a declared estimation method and evidence snapshot. Competing estimates
remain separate; the conservative aggregate uses interval arithmetic.

### 2. Bounded-risk payoff compiler

Keep the exact bigint compiler unchanged. Add a sibling compiler that consumes
one admitted soft constraint and enumerates every joint state:

- derive bundle cashflows with bigint fixed point;
- mark adverse states and maximum loss per unit;
- calculate price/fee/depth-adjusted expected-edge lower bounds under the
  probability interval;
- report capital at risk, tail loss, break-even epsilon, sensitivity, and stale
  evidence independently;
- reject any portfolio whose claimed edge depends on an unbound state or a
  probability outside the admitted interval.

Near implication has the same useful form. If
`P(A ∧ ¬B) ≤ ε`, buying `NO A + YES B` has expected-payout lower bound
`1 - ε`; the pre-fee edge floor is `q_A - q_B - ε`.

### 3. Estimation and calibration loop

Use multiple cheap Agents for distinct roles rather than asking one response
for a number:

1. a semantic scout proposes the adverse state and causal mechanism;
2. a falsifier enumerates routes by which the adverse state can occur;
3. an evidence worker searches rules, current facts, and historical analogues;
4. independent estimators return intervals and reference classes through tools;
5. a deterministic aggregator takes the conservative envelope;
6. shadow outcomes update calibration by family, horizon, and bound bucket.

Until a family/bucket has enough resolved outcomes, the dashboard shows the
opportunity and break-even epsilon but does not label the estimate calibrated.
The useful operator question becomes: “How wrong may this dependence estimate
be before the edge disappears?”

### 4. Opportunity taxonomy

- `HARD_ARBITRAGE`: every admitted settlement state has non-negative payoff
  and at least one has positive payoff after modeled costs.
- `PROBABILISTIC_SEMANTIC_ARBITRAGE`: expected-edge lower bound is positive
  under an evidence-bound adverse-state probability cap, with explicit tail
  loss and calibration status.
- `SEMANTIC_WATCH`: relation is meaningful but probability, price, liquidity,
  or evidence gates are incomplete.

These are promotion lanes, not cosmetic labels. Hard and probabilistic
opportunities must never share certificate semantics or risk accounting.

## Qualification gates

- The shooting/live-cola fixture survives as a probabilistic candidate when a
  non-fatal joint state exists and is rejected by the hard compiler.
- At `C = 0.80` and `ε = 0.05`, integer replay reports a pre-fee expected-edge
  floor of `0.15` per unit and the exact double-true tail loss; at `ε ≥ 0.20`
  it blocks promotion.
- Tampering with the adverse states, epsilon, evidence, expiry, or estimator
  lineage invalidates the artifact and downstream replay.
- Interval aggregation is conservative under disagreeing estimators and missing
  evidence; model confidence cannot substitute for a probability bound.
- Fees, depth, fillability, stale quotes, and correlation concentration each
  have independent fail-closed gates.
- Resolved shadow outcomes produce calibration metrics without rewriting prior
  estimates.
- Studio never renders probabilistic semantic arbitrage as guaranteed profit.

## 2026-08-02 compiler checkpoint

The first implementation keeps the hard verifier untouched and introduces two
content-addressed research artifacts:

- `pmh.probabilistic-semantic-bound.v1` retains a complete probabilistic truth
  matrix, one or more adverse states, counter-scenarios, evidence hashes, and
  2–8 independently named estimator intervals. Its conservative envelope uses
  the minimum lower bound, maximum upper bound, latest completion time, and
  earliest expiry. It grants estimate authority only.
- `pmh.probabilistic-semantic-arbitrage.v1` replays every joint state with
  bigint rational fixed-point arithmetic. It reports non-adverse and adverse
  payout floors, fee-adjusted expected edge, adverse tail loss, break-even
  epsilon, calibration posture, and separate freshness, depth, concentration,
  tail-loss, and positive-edge gates. It can only classify an idea as
  `PROBABILISTIC_SEMANTIC_ARBITRAGE` or `SEMANTIC_WATCH`; it cannot emit a hard
  certificate.

The Trump shooting/live-cola fixture deliberately retains the non-fatal joint
state. At a two-NO ask-plus-fee cost of 0.80 and epsilon 0.05, replay yields a
0.95 expected-payout floor, 0.15 expected-edge floor, 0.80 adverse tail loss,
and 0.20 break-even epsilon. At epsilon 0.20 the same prices become a semantic
watch. Tampered probability envelopes and replay arithmetic fail closed.

Next, expose the bound-submission effects as Agent tools, persist estimates and
evaluations, add role-separated estimation scheduling and calibration outcome
tracking, and render this lane in Studio without guaranteed-profit language.

## Authority boundary

This lane may rank, notify, simulate, and shadow-track bounded-risk ideas. It
does not weaken the exact verifier and does not authorize credentials, orders,
signing, funds, or value-moving actions.
