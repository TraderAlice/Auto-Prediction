# Semantic constraint search and payoff compilation

Status: active

Created: 2026-08-02

## Outcome

Turn LLM-discovered cross-event relationships into explicit, falsifiable
settlement constraints that a deterministic compiler can either translate into
state-wise payoff inequalities or reject as statistical intuition. This makes
the system search beyond same-claim aliases without letting language-model
confidence masquerade as arbitrage.

## Core distinction

- **Hard semantic constraint:** contract rules make some joint settlement
  states impossible or force one outcome from another. This may support exact
  arbitrage after executable prices, fees, depth, and venue mechanics are bound.
- **Probabilistic dependence:** one real-world event changes the likelihood of
  another but does not eliminate a settlement state. This is a forecasting or
  statistical-trading lead, never an exact certificate input.
- **Textual relatedness:** titles share entities or topics without a proven
  payoff constraint. This is routing evidence only.

Example: “Trump is shot in August” and “Trump publicly drinks cola in
September” are not inherently mutually exclusive because the shooting may be
non-fatal. An Agent must inspect the exact shooting definition, survival and
public-appearance possibilities, time windows, cancellation rules, and both
resolution sources before proposing a hard relation. A large probability gap
alone proves nothing.

## Relation proof objects

1. Add a proposal-only `pmh.semantic-constraint-proposal.v1` tool effect with:
   exact listing/outcome refs, proposed relation, normalized time predicates,
   entity identity, required world assumptions, counterexample states, rule
   excerpts by content hash, and unresolved evidence.
2. Represent the candidate joint settlement space explicitly. Relations such
   as `IMPLIES`, `MUTUALLY_EXCLUSIVE`, `EXHAUSTIVE`, `EQUIVALENT`, and bounded
   conditional claims must state which outcome vectors are claimed impossible.
3. Require the deep Agent to attempt at least one counterexample construction
   before completion. A surviving proposal remains unreviewed evidence.
4. Keep causal/statistical claims in a separate research-only type that cannot
   reach the exact payoff compiler.

## Deterministic compilation

- Compile independently accepted hard constraints into a finite outcome-state
  matrix using `bigint` fixed-point payouts only.
- Derive no-arbitrage inequalities from the feasible state set rather than from
  relation labels. For mutual exclusion, for example, the compiler may derive
  `p(A)+p(B) <= 1`; it must not infer a guaranteed long portfolio unless the
  actual tradable sides and prices establish one.
- Bind side mapping, shortability or synthetic complements, tick rounding,
  fees, common executable depth, close/settlement timing, void handling, and
  collateral residence before an exact candidate can reach the verifier.
- Emit an explicit rejection when the relation needs an unstated assumption or
  admits a counterexample state.

## Search architecture

- Add issue templates for cross-event exclusion, one-way implication, temporal
  succession, threshold nesting, and exhaustive partitions.
- Let cheap Agents search broad semantic neighborhoods and emit bounded
  candidate refs; use the durable Pi lane for rule acquisition and
  counterexample search over the exact retained corpus.
- Feed reviewed rejection codes and discovered counterexample patterns back to
  later issue routing without allowing model confidence to become authority.
- Measure proposed hard constraints, downgraded statistical relations,
  counterexamples found, compiler-ready relations, exact inequality
  rejections, and price-qualified opportunities separately.

## Qualification gates

- The shooting/cola example is rejected as hard mutual exclusion when the rules
  permit a non-fatal shooting and later public appearance.
- A fixture with explicit fatality and later-live-appearance definitions can
  compile mutual exclusion, but produces no arbitrage merely from unequal
  probabilities.
- A tradable price fixture violates a compiled inequality and yields a
  bigint-only candidate; fee or depth insufficiency still blocks certification.
- Statistical/causal relations cannot enter semantic review jobs intended for
  exact compilation.
- Tool effects, review artifacts, compiled state matrices, and verifier inputs
  are content-addressed and survive SQLite restart without rerunning the Agent.
- Full checks, tests, build, live configured search, desktop, and 390 px Studio
  QA pass without adding live execution authority.

## Authority boundary

LLMs propose and falsify relationship hypotheses. Independent review decides
whether rule evidence supports a hard constraint. The first-party compiler and
exact verifier alone derive payoff claims. No live order, credential, signing,
fund, or execution authority is introduced.
