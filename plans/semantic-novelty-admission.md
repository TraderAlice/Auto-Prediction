# Semantic novelty admission

Status: active mainline construction

Issue: [#156](https://github.com/luokerenx4/my-little-pony/issues/156)

Branch: `codex/semantic-novelty-admission`

## North-star role

The persistent discovery machine can now repair a rejected Agent result inside
one budget-bounded thread. Its first live repair also proved the next failure
mode: the accepted Lula subject-reference route repeated a retained title query
and advanced no research state. Correct syntax is not useful discovery.

An engineered AI-native arbitrage finder needs an explicit memory boundary
between evidence observation, reusable search coverage, and payoff-bearing
semantic claims. More inference must expand or falsify that memory, not merely
restate it with fresh prose and a fresh run identity.

## Ontology decision

Admission distinguishes three content layers:

1. **Protocol evidence** remains immutable and observation-specific. Raw bytes,
   receive time, evidence hashes, and exact corpus lineage are never deduplicated
   away by semantic admission.
2. **Search memory** is operational query coverage. A standing route's canonical
   identity is the normalized literal signals plus permitted search fields. Two
   labels that compile to the same exact query are redundant search memory even
   when the Agent calls one a subject and the other an event.
3. **Payoff research** is a proposed constraint over an exact listing set. Its
   first-party skeleton is finding kind, relation kind, and canonical listing
   refs. Normalized statement, rationale, and falsifiers can prove exact
   repetition, but first-party code cannot prove that differing prose is new
   semantic evidence.

The provider-free classifier therefore emits one of:

- `NOVEL_SEARCH_ROUTE`;
- `NOVEL_PAYOFF_EVIDENCE`;
- `REDUNDANT_SEARCH_MEMORY`;
- `REDUNDANT_PAYOFF_EVIDENCE`; or
- `INCOMPARABLE_PAYOFF_EVIDENCE`.

Only proven redundancy is rejected. Incomparable payoff evidence remains
admissible but carries no novelty, semantic, probability, certificate, or
execution authority. No model, embedding, similarity scalar, elapsed time, run
identity, or prose confidence participates in admission.

## Phase 1 — canonical coverage identities

- [x] Define and validate a provider-free v1 admission decision with exact
  candidate/overlap identities and bounded retained references.
- [x] Derive search coverage from normalized signals and fields, independent of
  route label, source run, corpus receive time, and baseline membership.
- [x] Derive payoff skeleton and exact-content identities from kind, relation,
  canonical refs, and normalized bounded Agent content.
- [x] Prove settlement queries do not collapse into title queries and distinct
  literal queries remain distinct even when their current membership matches.

## Phase 2 — complete retained semantic memory

- [x] Add a dedicated finding-store read for admission; do not depend on a
  recent-findings UI limit or standing-route compilation window.
- [x] Validate every retained finding against its immutable corpus before it can
  influence admission.
- [x] Freeze one memory snapshot per Agent host so read and result decisions are
  replayable within a run.
- [x] Keep memory reads provider-free and side-effect-free.

## Phase 3 — Agent-readable coverage before spend

- [x] Extend `read_relation_work` with a bounded, authority-labelled semantic
  coverage summary relevant to the assigned work and seed listings.
- [x] Include exact retained finding references and canonical query/payoff
  skeletons, not arbitrary historical prose or hidden similarity scores.
- [x] Report truncation explicitly; a truncated summary may guide the Agent but
  cannot weaken the complete first-party admission check.
- [x] Preserve byte-compatible task and finding replay; memory is execution
  context, not task identity.

## Phase 4 — admission and repair

- [x] Classify every declared result after evidence validation and before local
  retention or durable persistence.
- [x] Reject proven redundancy with bounded diagnostics naming the class and
  exact overlapping finding IDs, allowing the existing result-repair loop to
  seek a different result inside unchanged budgets.
- [x] Return the admission decision beside accepted tool output so downstream
  projections can distinguish novelty from incomparable evidence.
- [x] Ensure rejected candidates create no finding, standing route, follow-up,
  semantic-review supply, campaign, provider call, or value-moving effect.

## Phase 5 — attribution and operator surface

- [x] Derive admission and repair counts from retained exact effects without
  inventing causal value claims.
- [x] Expose repeated-memory rejection, accepted novelty, incomparable payoff
  evidence, and resulting token cost in Agent Operations.
- [x] Keep route memory distinct from payoff opportunity supply in Studio.
- [x] Preserve zero-read provider/model/dispatch/write effects.

## Qualification gates

- [x] The live Lula title query is classified as redundant against its retained
  route even when the proposed route layer differs.
- [x] A genuinely different grounded query is admitted as novel search memory.
- [x] An exact payoff restatement is rejected while differing payoff prose on
  the same skeleton is admitted only as incomparable evidence.
- [x] The Agent sees bounded retained coverage before choosing its result.
- [x] A redundant first result can repair to a distinct accepted result within
  the same run and existing budgets.
- [x] SQLite restart reproduces the same admission decision and creates no read
  side effects.
- [x] Workspace checks, all suites, build, and changed Studio surfaces pass.

## Live checkpoint — 2026-08-13

The provider-free replay of the complete retained finding ledger classifies
eight findings as two novel search routes, five novel payoff skeletons, and one
historical redundant search route. The redundant candidate is the repaired live
Lula subject route
`sha256:21104983a44a6c64346ffcde36b6b01f0cd19b2ae7b984a66a5093bd16ad1a39`;
its exact operational query overlaps the earlier Lula event route
`sha256:fd2a01a31f80720d3771fa7a4113d44d81c63e15d727e5a4a3824e323315547e`.
Changing the ontology annotation did not create another normalized literal
query. Historical records remain immutable; the new gate prevents the same
mistake from producing a ninth finding.

SQLite close/reopen qualification freezes all three relevant Mark Kelly
coverage objects into the next host's bounded work read. Re-submitting the same
title query as a different route layer is rejected before persistence with the
exact overlapping finding ID; the durable finding count and local host result
count do not move. Runtime qualification preserves `sha256:` content addresses
in repair diagnostics while continuing to redact URL and opaque secret-like
fragments. Existing budget-bounded repair tests prove the rejected result can
continue to a distinct accepted result in the same thread.

Agent Operations now separates historical accepted novelty, historical
redundancy, new admission rejections, affected-run token cost, and result-repair
outcomes. The live read reports 1,028,481 known tokens across five relation runs
without starting a provider request, model invocation, dispatch, or write.
Desktop and 390 px visual qualification has no horizontal overflow or
application console error. Workspace check, all suites (97 control-plane files
/ 660 tests and five Studio files / 30 tests), and production build pass. The
known Node 24 engine expectation and Studio chunk-size warning remain.

## Non-goals

- treating market price as truth about the world;
- suppressing immutable raw observations or materially changed contract text;
- using embeddings or another Agent as admission authority;
- claiming differing natural-language evidence is semantically novel without
  independent review;
- automatically dispatching a task because memory is sparse;
- live orders, credentials, signatures, approvals, transactions, or funds.
