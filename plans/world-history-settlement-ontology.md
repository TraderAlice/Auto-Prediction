# World-history settlement ontology

Issue: https://github.com/luokerenx4/my-little-pony/issues/249

## Decision context

The state-refreshed Agent boundary is adopted, so long-loop mechanics are no
longer the dominant structural defect. The deeper discovery bottleneck is that
four representations stop at different layers:

- market ontology recognizes separate world, settlement and traded facets but
  gives world predicates only bounded lexical families;
- world-state mechanisms retain causal search routes without canonical
  predicate identities shared by later relation work;
- semantic constraints start from a preselected listing truth table;
- probabilistic semantic arbitrage prices an adverse state only after another
  subsystem has selected its listing scope.

The result is a safe pipeline that can validate a supplied relationship more
readily than it can accumulate a reusable theory of what relationships to seek.

## Ontological position

A prediction-market listing is a venue-defined contingent claim, not a direct
sample of reality's probability. Its settlement rules define a partial
function from evidence-observable world histories to contract outcomes. A
quote is a time-bound traded valuation of that contingent claim. The following
must therefore remain distinct:

1. **World history**: entities, events, states and intervals that may obtain.
2. **World predicate**: a bounded proposition evaluated over a world history.
3. **Settlement projection**: a venue rule mapping evidence about a world
   predicate (and possibly special resolution conventions) to an outcome.
4. **Traded state**: quotes, depth, fees, availability and time observed.
5. **Attention state**: why a claim exists or is salient; potentially useful
   explanatory evidence, but not world truth by default.

An opportunity may arise because related predicates are projected differently,
because settlement functions diverge, because the market valuations violate a
hard constraint, or because valuations exceed an evidence-bound probabilistic
constraint. Title similarity is only a routing signal.

## Mutation thesis

Build a content-addressed, first-party world-history ontology whose unit of
reuse is a typed predicate and its settlement projections, rather than a claim
label or an already-selected listing tuple. Let AI propose and falsify relation
hypotheses through state-scoped tools; let the host bind exact evidence,
identity, state and authority.

This is deliberately not an exhaustive world model. It is a sparse experimental
memory containing only predicates and relations that were useful enough to
search, inspect, test or falsify.

## Core artifacts

### World predicate

`pmh.world-predicate.v1` should carry:

- canonical predicate identity and a bounded operator kind;
- typed subject references, predicate/action/state, interval and parameters;
- polarity and observability posture;
- source listing/evidence bindings and Agent/run lineage;
- ambiguity and explicit counterworld descriptions;
- `SEARCH_HYPOTHESIS_ONLY`, `EVIDENCE_BOUND_PROPOSITION`, or
  `SETTLEMENT_BOUND_PREDICATE` epistemic posture;
- no probability, certificate, execution or value-moving authority.

Initial operator kinds should be intentionally small: occurrence, state
presence, threshold, membership/selection and public action. They describe the
world, not venue resolution quirks.

### Settlement projection

`pmh.settlement-projection.v1` binds one exact listing and outcome space to one
or more world predicates plus rule evidence. It records whether the mapping is
total, partial, ambiguous, voidable or contains venue-specific overrides. Only
first-party validation may mark it exact enough for compiler use.

### Relation experiment

`pmh.world-relation-experiment.v1` is a lifecycle, not a naked label:

- typed relation hypothesis: equivalence, implication, exclusion, temporal
  prerequisite, state-mediated inhibition, common-cause dependence, or
  unresolved association;
- antecedent/consequent predicate identities and temporal alignment;
- adverse world assignments and named latent/premise predicates;
- search neighborhoods, inspected projections and evidence bindings;
- concrete counterworld attempts and outcomes;
- terminal disposition: supported hard, supported probabilistic, falsified,
  exhausted, or unresolved;
- exact run/effect/invocation/token lineage.

`STATE_MEDIATED_INHIBITION` is the intended representation for broad shooting
→ capacity/state → later public act. It must not collapse into mutual exclusion.

## Agent topology

Use the adopted state-refreshed boundary:

1. read a compact ontology frontier selected from lexical trailheads, standing
   mechanisms, negative memory and price divergence;
2. open one predicate/relation hypothesis;
3. search multiple independently named neighborhoods;
4. inspect exact listing and rule evidence selected by the host;
5. declare a concrete counterworld or latent predicate when the relation is not
   hard;
6. record a host-bound test outcome;
7. close into a durable relation experiment or bounded negative memory.

The manifest changes with state. Large structured objects are emitted by tools,
not parsed from final prose. A terminal is never a semantic certificate.

## Compiler bridges

- Hard settlement-bound predicates may deterministically generate the existing
  complete semantic truth table and enter current exact admission unchanged.
- Probabilistic relations may generate adverse state identities for the
  existing probability-bound workflow, but estimator intervals remain separate
  evidence-bearing artifacts.
- Search-only hypotheses can generate neighborhoods and monitoring work but
  cannot change feasible states or probability bounds.
- Existing market ontology, mechanism routes, semantic premises and negative
  experiments are inputs/adapters; this mutation must not rewrite their history.

## Engineering phases

1. Write failing domain tests for predicate identity, settlement projection,
   relation lifecycle, counterworlds and authority separation.
2. Implement immutable artifacts and validation in a focused module.
3. Persist artifacts and experiments in SQLite with restart/replay tests.
4. Build adapters from current ontology nodes and mechanism proposals.
5. Add deterministic hard/probabilistic bridge outputs with fail-closed tests.
6. Add a state-refreshed Agent host and bounded campaign selection.
7. Expose a compact projection in the control-plane and Studio.
8. Run full qualification and a Terra/high live specimen; compare semantic
   yield, structural rejection, calls and token cost to the current exploration
   episodes.

## Selection signals

- The shooting/cola example retains broad shooting, fatal/incapacitating state,
  and later public action as distinct predicates; broad shooting and cola do
  not become a false hard exclusion.
- At least two real listings bind to reusable predicate and settlement
  identities without using title equality as semantic proof.
- One supported/falsified relation experiment survives restart with exact
  evidence, counterworld and token lineage.
- Only admitted hard/probabilistic projections reach their respective existing
  compiler bridges.
- Terra completes one state-refreshed experiment with zero structural
  rejections and either a grounded relation or useful negative memory.

## Failure modes and reversibility

- **Ontology inflation**: cap artifacts per experiment and require evidence or
  negative-memory value for persistence.
- **False precision**: keep textual/causal conjecture distinct from evidence-
  bound and settlement-bound postures.
- **Duplicate ontology**: adapters and shared identities must replace, not sit
  beside, downstream predicate prose before adoption.
- **Token expansion**: checkpoints contain only current sparse state; track
  input per accepted experiment outcome.
- **Schema rigidity**: the host owns fixed artifacts through tools while Agent
  reasoning remains a long loop.

The mutation is reversible because raw venue evidence, existing ontology
snapshots and payoff compilers remain unchanged.

## Authority boundary

Anonymous evidence research, deterministic replay, simulation and shadow
evaluation only. No live orders, credentials, signing, funds, external writes,
or value-moving operations.

## Status

Domain, SQLite persistence, legacy adapters and both compiler bridges are
implemented. The state-refreshed Agent protocol now supports up to eight
independently named corpus neighborhoods, exact evidence inspection, an
Agent-selected complete true/false counterworld assignment, host-bound outcome
recording, bounded terminal dispositions, and post-run injection of exact
run/effect/invocation/token lineage. Focused protocol tests reject stale tools,
incomplete counterworlds and unsupported hard conclusions. Campaign selection,
runtime routing, durable input revisions and the compact Studio projection are
the active implementation frontier.
