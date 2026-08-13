# Durable exploration experiment episodes

Status: active mainline construction

Issue: [#223](https://github.com/luokerenx4/my-little-pony/issues/223)

## Product question

What is the reusable unit of experience for an AI-native arbitrage explorer?
Search observations, prototype-test actions, generic tool-effect hashes and
terminal records are individually durable, but they do not yet preserve an
exact causal trace. In particular, the generic runtime knows the accepted or
rejected effect ordinal while the domain host knows the readiness transition;
neither side alone can state which effect changed terminal admissibility.

A completed result is not the only useful experiment. Interrupted and bounded
negative runs may contain the best evidence about which search neighborhood
failed, what the Agent inspected, and when a prototype test became falsified.
Cross-run learning needs those steps as one replayable episode rather than a
later heuristic join over timestamps and opaque hashes.

## Decision

Add a generic post-effect observation hook to the Agent runtime. The runtime
constructs and persists the exact ordered `AgentToolEffect`, then lets the
domain host retain a content-addressed step observation bound to that effect,
tool call, input revision and readiness-after state. The hook is observational:
it cannot change effect status, result settlement or run authority. If it
fails, the run fails closed because silently losing experiment lineage would
make the episode untrustworthy.

Compile retained step observations, model invocations, exact input, durable
search/action/terminal records and run state into one provider-free exploration
episode. Attribute per-step model purpose and tokens through the effect's exact
source invocation. Keep compact result summaries rather than replaying raw
untrusted listing text into every episode.

Advance exploration to V9 and execution revision 11 because every model-visible
tool result remains V8-compatible while the durable experiment contract and
post-effect host lifecycle change.

## Phase 1 — exact ordered step ledger

- [x] Add a post-effect Agent host hook that cannot mutate accepted effect state.
- [x] Define content-addressed exploration step observations with exact effect,
  call, input and readiness lineage.
- [x] Retain compact search/inspection/action/terminal summaries immediately.
- [x] Add schema 58 storage, idempotency and exact cross-table verification.

## Phase 2 — episode compiler

- [x] Compile completed, interrupted and failed runs into immutable episodes.
- [x] Join every step to its source invocation purpose and token vector.
- [x] Compute readiness transitions and first-terminal-eligible step.
- [x] Attribute search yield, rejection count, action count and terminal outcome.
- [x] Preserve zero semantic, probability, certificate, execution and value
  authority.

## Phase 3 — product feedback and qualification

- [x] Project episode counts and causal-cost summaries in Studio.
- [x] Pass focused and full provider-free qualification.
- [x] Run one V9 Terra/high specimen and verify a complete episode is durable
  before selecting the architecture.
- [x] End with `ADOPT`, `PARTIAL_ADOPT`, `HOLD`, or `ABANDON`.

## Selection

`ADOPT` on 2026-08-14.

The first V9 Terra/high specimen retained seven ordered effects while the run
was still in progress, then compiled one complete exhaustion episode. Two
search calls produced 32 raw hits, five qualified hits and zero role pairs;
three listings were inspected, one premature inspection was rejected, and the
fourth prototype transfer test was marked failed. Effect ordinal 6 was the
first state where exhaustion became eligible and effect 7 retained it. Seven
model invocations used 163,898 input, 1,162 output and 391 reasoning tokens.

The episode is not a retrospective timestamp join: the first durable step was
visible before the run terminated, every step binds an exact V3 effect and
source invocation, and schema 58 verifies the complete cross-table lineage.
Historical pre-V9 effects remain readable but are not fabricated into complete
episodes.

One separate observation emerged: the world-state read model temporarily hides
exploration memory when a catalog refresh yields an empty in-memory corpus,
even though the episode remains durable. A last-known research-memory read
model should be evaluated as the next continuation; catalog availability must
not erase operator visibility into completed experiments.

## Selection gates

- Step order comes from first-party effect ordinals, never timestamps.
- A readiness transition is recomputed or verified from exact retained state.
- The post-effect hook cannot rewrite tool status or canonical hashes.
- Episodes remain useful without a terminal result.
- Historical opaque effects are not fabricated into complete episodes.

## Non-goals

- treating model rationale as semantic truth;
- prescribing future queries from one specimen;
- storing raw credentials, chain-of-thought or provider responses;
- changing live trading or value-moving authority.
