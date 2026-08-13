# Durable exploration memory across catalog gaps

Status: active mainline construction

Issue: [#225](https://github.com/luokerenx4/my-little-pony/issues/225)

## Product question

What remains true when the current market catalog is temporarily unavailable?
The first V9 experiment episode was durable in schema 58, but the world-state
read model returned `mechanismPrototypeExploration: null` during a short empty
catalog window. The retained experiment had not ceased to exist; only the
current observation needed to construct lenses was unavailable.

Completed research memory and current market observation are different kinds
of objects with different lifecycles. Coupling their visibility makes source
degradation look like epistemic amnesia and prevents the operator from judging
past Agent yield exactly when the live surface is least reliable.

## Decision

Split prototype exploration into two provider-free read models:

- a durable experiment-memory projection compiled only from retained exact
  inputs, step observations and Agent execution lineage;
- a nullable current-corpus workspace that alone owns lenses, coverage,
  eligibility and campaign preparation.

The memory projection must never claim that a historical input is current or
that an old lens remains eligible. The workspace must never substitute a stale
corpus for an unavailable current observation. Studio may show both together,
or memory alone with an explicit current-corpus-unavailable state.

## Phase 1 — independent memory read model

- [x] Define a content-addressed memory projection with episode and causal-cost
  summaries and no current-corpus fields.
- [x] Compile it with an empty current corpus and prove zero provider, model,
  task, campaign, dispatch, write and value-moving effects.
- [x] Keep episode identities identical between the memory projection and a
  recovered current workspace.

## Phase 2 — product continuity

- [x] Add the always-present memory projection to the world-state API.
- [x] Render Experiment memory independently from the nullable lens workspace.
- [x] Label current-corpus availability explicitly instead of hiding the whole
  research section.
- [x] Verify both empty-catalog and recovered-catalog UI states.

## Phase 3 — qualification and selection

- [x] Pass focused and full provider-free qualification.
- [x] Restart against the live schema-58 volume and verify the retained V9
  episode remains visible without issuing a model call.
- [x] End with `ADOPT`, `PARTIAL_ADOPT`, `HOLD`, or `ABANDON`.

## Selection

`ADOPT` on 2026-08-14.

The live schema-58 volume projects one complete memory episode with the same
`sha256:05276389…` identity as the recovered current-corpus workspace. It
retains seven causal steps and seven invocations using 163,898 input tokens;
the read starts zero provider requests, model invocations, tasks, campaigns,
dispatches or writes. Current-corpus and current-eligibility authority are
explicitly false.

Studio now renders this memory as a separate, compact section and renders a
distinct observation-gap state when the current workspace is null. Visual QA
passed at the live 5174 surface, and a clean reload produced zero new console
warnings or errors. The world-state projection advances to V6 because the
always-present memory read model is a public contract change.

## Selection gates

- Empty current corpus does not remove or rewrite retained episodes.
- Historical memory never creates a current lens, task or campaign membership.
- Current workspace recovery does not change episode identity or usage totals.
- No stale catalog is presented as current.

## Non-goals

- caching a prior corpus as if it were live;
- scheduling from historical memory while current input is unavailable;
- changing catalog refresh, semantic authority or trading authority.
