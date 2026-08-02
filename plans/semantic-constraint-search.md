# Semantic constraint search and payoff compilation

Status: implemented; PR #80 ready 2026-08-02

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

## Implemented checkpoint — 2026-08-02

- Added content-addressed `pmh.semantic-constraint-proposal.v1` artifacts with
  an explicit joint truth table, hash-bound listing/rule evidence, assumptions,
  unresolved evidence, and a mandatory counterexample attempt.
- Added deterministic admission that separates hard settlement constraints from
  probabilistic dependence and textual relatedness. Found/inconclusive
  counterexamples, incomplete state spaces, missing evidence, and relations that
  forbid no state remain research-only.
- Replaced AI SDK whole-response `Output.object` parsing with a bounded tool
  loop: `record_counterexample` effects precede one
  `submit_semantic_review` effect. The five-minute default deadline is
  configurable up to ten minutes.
- Replaced Pi final-text JSON parsing with the repository-owned
  `submit_market_findings` extension. Pi keeps recursive read-only corpus tools;
  only the bounded effect tool writes once inside the ephemeral run directory,
  its atomic publication terminates the Pi loop, and final prose is ignored.
- Upgraded ready payoff artifacts to v2. The compiler enumerates guaranteed
  portfolios from feasible matrix states, not relation labels, and serializes
  every payout unit as a bigint decimal string. Legacy v1 artifacts remain
  replayable but old semantic reviews are visibly blocked until rerun.
- Added bigint rational price-inequality evaluation binding ask prices, explicit
  fees, normalized requested quantity, and available depth. The same hard
  relation can therefore produce a positive gross floor, a fee-blocked result,
  or a depth-blocked result without gaining certificate or execution authority.
- Qualification fixtures now reject the non-fatal shooting/later-live example,
  admit the explicit-fatality variant, and prove the price/fee/depth distinctions.
- Live DeepSeek qualification passes on both paths. The AI SDK smoke recorded a
  found non-fatality counterexample and deterministic admission kept the model's
  inconsistent hard-constraint label research-only. Pi submitted five grounded
  candidates through `pmh.market-archaeologist-report.v2`; the terminal effect
  ended the process, and the same `sha256:0ba0953d...` report restored from
  SQLite after restart without rerunning the completed job.
- Control-plane type checks and all 294 package tests pass on Node 24.
- Full-workspace Node 24 type checks, all 443 tests, and the production build
  pass after live qualification and terminal-effect lifecycle hardening.
- Studio visual qualification passes at 1280 px and emulated 390 px: the
  constraint card exposes classification, exact admission, artifact hash,
  counterexample narrative, feasible/impossible/unresolved counts, rule hashes,
  assumptions, and unresolved evidence with no horizontal overflow or runtime
  console errors.

## Publication

- Commit `a23291a` is published in ready-for-review PR #80.
