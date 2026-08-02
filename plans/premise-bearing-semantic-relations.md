# Premise-bearing semantic relations

Status: queued design; implement after the active rule-evidence serial stack is
published

Created: 2026-08-02

## Outcome

Represent the hidden premises behind an Agent-discovered market relationship as
first-class, evidence-bound artifacts. Preserve useful causal and conditional
hypotheses for search and monitoring, while allowing only settlement-intrinsic
or explicitly traded premises to alter the exact feasible-state space.

The north-star contribution is a higher durable rate of meaningful semantic
leads without converting an LLM's plausible world story into a guaranteed
arbitrage claim.

## Motivating example

Let:

- `A`: Trump is shot in August;
- `B`: Trump personally drinks cola on a public livestream in September;
- `C`: the August shooting is fatal or makes a September personal appearance
  impossible.

`A` and `B` are not mutually exclusive. The sound relationship is closer to
`C ⇒ ¬B`, with `C ⇒ A` under the example's definitions. A large displayed
probability difference between `A` and `B` is not itself an arbitrage.

There are three materially different implementations:

1. If market `A` itself resolves Yes only for a fatal/incapacitating shooting,
   the premise is settlement-intrinsic and `A ⇒ ¬B` may become a hard relation.
2. If `C` is a separately traded binary claim, the compiler may include it as a
   third truth variable and search exact three-leg portfolios.
3. If `C` is only an Agent inference or an external future observation, the
   relationship is useful for monitoring and conditional relative value but is
   not a pre-resolution guaranteed arbitrage.

## Current gap and immediate safety posture

Historical `pmh.semantic-constraint-proposal.v1` stores `assumptions` as bounded prose but
does not give them an evidence identity, truth binding, observation source, or
resolution status. Before this audit, exact admission ignored the field. The
current local stack emits v2 and fails closed: any non-empty free-form
assumption yields `UNVERIFIED_ASSUMPTION` and remains research-only. Historical
v1 artifacts retain their original validation semantics so SQLite replay does
not rewrite past evidence.

This guard is intentionally conservative. It should not be relaxed until a
structured premise can prove how its truth participates in settlement.

Node 24.14.0 full workspace checks, all 479 tests (330 control-plane), and the
production build pass with the v2 guard and historical-v1 replay regression.

## Proposed artifacts

### Premise hypothesis

Add a content-addressed `pmh.semantic-premise.v1` with:

- `premiseId`, proposition, temporal interval, referenced entities, and Agent
  origin;
- one closed kind:
  `SETTLEMENT_INTRINSIC`, `TRADED_OUTCOME`, `EXTERNAL_OBSERVATION`, or
  `CAUSAL_HYPOTHESIS`;
- exact listing/outcome bindings for traded premises;
- rule-evidence claim IDs and exact semantic-review scope for intrinsic
  premises;
- observation protocol, receive time, and content hash for external premises;
- explicit truth posture: `PROVEN_IN_SCOPE`, `TRADED_VARIABLE`, `OBSERVED`,
  `UNRESOLVED`, or `CONTRADICTED`;
- no semantic-decision, certificate, provider-request, or execution authority.

### Premise-bearing relation

Add `pmh.premise-bearing-relation.v1` that binds:

- the original proposal and evidence scope;
- antecedent/consequent boolean expressions over listing outcomes and premise
  IDs, using a small closed AST rather than prose or executable code;
- counterexample attempts and the exact evidence claims used for each leaf;
- a deterministic classification:
  `UNCONDITIONAL_HARD`, `CONDITIONAL_TRADED`, `CONDITIONAL_OBSERVED`, or
  `CAUSAL_RESEARCH_ONLY`.

Expressions remain bounded to a small number of leaves and operators
(`AND`, `OR`, `NOT`, `IMPLIES`). The Agent proposes the AST through a tool; a
first-party validator owns identities, lineage, and admission.

## Agent loop

1. Search nearby events and propose a semantic relation.
2. Call `record_hidden_premise` for every fact needed to make a forbidden state
   impossible.
3. Bind each premise through offered tools to an exact market outcome, verified
   rule-evidence claim, or retained external observation. The Agent cannot
   create URLs or observation identities.
4. Call `record_premise_counterexample` with a concrete world and settlement
   state that attempts to satisfy the listings while falsifying the premise.
5. Submit one premise-bearing relation effect. A rejected effect returns a
   bounded diagnostic and does not terminate the loop; only an accepted effect
   ends it.

Partial premise work survives timeout and remains searchable. It does not enter
the exact compiler.

## Deterministic compiler policy

- `SETTLEMENT_INTRINSIC + PROVEN_IN_SCOPE`: the premise may be eliminated into
  the bound listing's truth definition.
- `TRADED_OUTCOME + TRADED_VARIABLE`: add its exact listing/outcome as another
  state variable and enumerate all feasible joint settlement states.
- `EXTERNAL_OBSERVATION + OBSERVED`: useful after the observation for a bounded
  conditional screen, but not a guaranteed pre-observation payout floor unless
  the portfolio itself settles on that observation.
- `CAUSAL_HYPOTHESIS`, `UNRESOLVED`, or any free-form assumption: research-only.
- Every exact portfolio still needs current asks, depth, fees, timing, capital,
  and first-party verifier admission. Semantic consistency never substitutes
  for executable economics.

## Persistence and scheduling

- Persist premise hypotheses, bindings, counterexamples, and relation effects
  independently in SQLite WAL.
- Re-run only relations whose bound premise evidence changed; preserve prior
  scopes and reviews.
- Add issue templates for temporal incapacitation, office-holder succession,
  mutually exclusive physical appearances, and event-containment relations.
- Deduplicate by canonical entity/time/relation/premise scope rather than title
  similarity alone.

## Product measurements

Studio should separate:

- unconditional hard relations;
- traded conditional relations eligible for multi-leg compilation;
- observed conditional signals;
- unresolved causal hypotheses;
- premise counterexample rate, premise evidence coverage, and
  premise-to-exact-admission conversion;
- economically positive portfolios after fees/depth, not merely semantic leads.

## Qualification gates

- The broad shooting/cola pair remains research-only with an explicit surviving
  non-fatal counterexample.
- A fatal-shooting market whose own rules bind fatality can produce an
  unconditional hard constraint with no free-form assumption.
- A separate fatality market produces a three-variable state space; the
  compiler derives portfolios from feasible states rather than relation labels.
- An external news observation never creates a guaranteed pre-observation
  certificate.
- Rehashed premise substitution, cross-proposal binding, missing rule claims,
  stale observations, malformed ASTs, and non-terminal rejected tool calls fail
  closed.
- SQLite restart does not rerun accepted Agent effects, while changed evidence
  creates a new immutable scope.
- Full checks, tests, build, and Studio desktop/390 px QA pass without adding
  live order, signing, credential, fund, or execution authority.

## Authority boundary

Agents discover, structure, and challenge premises. First-party code validates
bindings and compiles feasible states. Independent semantic review remains
mandatory, the exact verifier remains the sole certificate authority, and live
execution remains absent.
