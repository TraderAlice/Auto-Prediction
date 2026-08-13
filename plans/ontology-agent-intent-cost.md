# Ontology Agent intent and cost attribution

Status: active mainline construction

Issue: [#164](https://github.com/luokerenx4/my-little-pony/issues/164)

Branch: `codex/ontology-agent-intent-cost`

## North-star role

Persistent AI-native discovery needs to measure what the Agent spends cognition
on, not merely total tokens and final proposal count. The current ledger knows
model invocations and tool effects independently, but cannot prove which
invocation produced an effect. Timestamp adjacency is not lineage and becomes
ambiguous for batched tool calls. Any intent-cost dashboard built on that would
manufacture attribution.

## Ontology decision

One model invocation is the smallest non-divisible cost unit. Every newly
retained tool effect binds to the exact invocation that emitted its call.
Provider-free projection may then classify the invocation from its purpose and
complete set of linked tool effects:

- evidence inspection;
- ordinary ontology result;
- mechanism-memory inspection;
- mechanism result;
- result repair;
- mixed tool intent;
- no retained tool effect.

An invocation is counted once. Mixed batches remain mixed instead of splitting
tokens by an arbitrary ratio. Historical effects without exact linkage remain
explicitly unlinked.

## Phase 1 — exact lineage

- [x] Add a successor tool-effect record binding `sourceInvocationId` without
  rewriting retained v1/v2 evidence.
- [x] Require same-run invocation/effect lineage in the runtime and pass the
  exact invocation that emitted every single or batched call.
- [x] Prove SQLite replay preserves both historical unlinked effects and new
  exact lineage.

## Phase 2 — behavior funnel

- [x] Derive ontology-only invocation strata without double counting.
- [x] Count accepted/rejected calls separately for ordinary ontology and
  world-state mechanism tools.
- [x] Reconcile stratum token totals with the ontology invocation ledger and
  expose incomplete usage and unlinked historical posture.
- [x] Keep projection reads provider-free and write-free.

## Phase 3 — operator surface and live evidence

- [x] Show the behavior funnel beside world-state mechanism memory in Agent
  Operations with one coherent type scale and bounded detail.
- [x] Qualify desktop and narrow viewport rendering without horizontal overflow.
- [ ] Run one bounded current-runtime specimen only when an operator-authorized
  campaign has budget; do not create spend merely to populate the chart.

## Non-goals

- estimating fractions of one invocation across several tools;
- treating tool choice as semantic correctness or causal truth;
- changing Agent prompts or budgets to improve the displayed funnel;
- automatic campaign activation or dispatch;
- live orders, credentials, signatures, approvals, transactions or funds.

## Live baseline

The first provider-free live read covers eight retained ontology runs and 29
model invocations: 543,273 input, 7,459 output and 4,149 reasoning tokens
(554,881 known total), with three incomplete usage records. Historical v1/v2
effects cannot be retroactively linked, so 20 invocations / 411,581 known
tokens remain explicitly `HISTORICAL_UNLINKED`. Six purpose-classified repair
invocations account for 118,794 known tokens. Three invocations / 24,506 known
tokens have no retained tool effect. Nineteen old effects remain unlinked.

The same ledger records zero mechanism-memory inspections and zero mechanism
result calls across those runs. This is evidence about Agent tool-choice
topology, not evidence that no useful mechanism exists. A future live specimen
must use the new runtime lineage and an already authorized budget; this change
does not activate or enlarge one merely to improve dashboard coverage.
