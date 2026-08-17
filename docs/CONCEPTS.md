# Concepts: an AI-native semantic arbitrage machine

## North star

The project should find prediction-market opportunities **persistently and
engineerably**. That means more than producing an occasional clever pair: it
must repeatedly observe the market universe, direct bounded research, retain
negative and positive evidence, measure its cost and yield, and change its
search behavior when a generation fails.

## What a prediction market is here

A prediction market is not one probability attached directly to reality. The
harness models three distinct objects:

1. **World proposition** — a statement about a possible world history, such as
   a person performing an action before a date.
2. **Settlement contract** — a venue's exact projection from admissible
   evidence about that history into an outcome and payout.
3. **Traded state** — orders and quotes expressing participants' current
   valuations of the contingent payout.

This separation matters. Two markets can concern almost the same world event
but settle differently. Conversely, very different surface text can expose a
useful relationship between their world propositions. A quote is therefore an
observation of traded valuation under a contract—not certified truth and not a
standalone world probability.

## Opportunity spectrum

The harness searches a spectrum instead of admitting only textbook risk-free
arbitrage.

### Exact relationships

Examples include equivalent contracts, a complete payout partition, or a
provable implication. Once the semantics, rules, books, fees, depth, and timing
are exact, deterministic code can enumerate every canonical payoff state and
verify a non-negative floor.

### Failure-budget relationships

Many valuable relationships are softer: likely exclusion, state-mediated
inhibition, shared causal mechanisms, or dependence that holds only under an
explicit premise. These are not mislabeled as guarantees. Instead, the system
asks:

- under which world states does the construction fail?
- how much price margin is available to absorb that failure?
- which premise or external fact controls the residual risk?
- what evidence would falsify the relationship cheaply?

This turns “not perfectly strict” from an error into a measured research
object. It still does not turn model confidence into expected profit.

## Why Agents belong upstream

The semantic search space is too large and too contextual for a fixed list of
claims. Agents are useful for:

- browsing unfamiliar clusters and choosing promising neighborhoods;
- translating between venue dialects and real-world mechanisms;
- proposing implications, exclusions, partitions, and counter-scenarios;
- finding missing rules or evidence requirements;
- revising a hypothesis across a long tool loop;
- deciding that a neighborhood is exhausted.

The Agent records bounded tool effects. It does not submit one fragile
whole-response schema and it never gains authority by writing persuasive
prose.

## Where deterministic authority begins

First-party code owns the hard boundaries:

- exact evidence identity and retention;
- task, corpus, and listing scope;
- semantic-review admission and independent decisions;
- payout-state enumeration and fixed-point arithmetic;
- current book, fee, depth, tick, and freshness checks;
- certificate publication, capital accounting, and risk policy;
- the permanent absence of live execution authority.

Agents may propose a relation and its falsifier. They cannot certify the
relation, invent source evidence, substitute a different listing, or turn an
indicative quote into an executable price.

## Persistent discovery loop

One useful unit of progress is a complete experiment episode:

```text
observe corpus
  -> allocate attention
  -> browse and pin a neighborhood
  -> open a falsifiable hypothesis
  -> search and inspect exact listings
  -> apply prototype/counter-scenario tests
  -> close or revise the hypothesis
  -> retain yield, failure, and token lineage
  -> select the next generation
```

A zero-yield run can be valuable if it retires a mechanism, exposes an ontology
blind spot, or prevents the next Agent from buying the same failed search with
another 200,000 tokens. Persistence comes from retaining those outcomes as
search memory rather than repeatedly starting from an empty prompt.

## Product success

The useful metrics are not raw proposal count or model confidence. They are:

- novel grounded multi-market relationships per immutable corpus;
- proportion surviving independent semantic review;
- proportion reaching fresh economic qualification;
- positive failure budget or exact worst-case floor after fees and depth;
- time and token cost per useful frontier change;
- repeated-search avoidance from retained negative evidence;
- operator attention required per actionable finding.

The current implementation and live evidence behind this model are indexed in
[`PLANS.md`](../PLANS.md). The runtime boundaries are described in
[Architecture](ARCHITECTURE.md).
