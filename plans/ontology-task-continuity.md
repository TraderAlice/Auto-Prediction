# Ontology issue task continuity

Status: active mainline construction

Issue: [#112](https://github.com/luokerenx4/my-little-pony/issues/112)

Branch: `codex/ontology-task-continuity`

## North-star role

Relation discovery now keeps a stable Agent task while exact catalog and work
provenance inputs evolve. Its live qualification exposed the same identity
error one layer upstream: ontology normalization creates 64 new tasks per
startup. The retained 512-revision window currently contains 512 task IDs but
only 104 stable issue IDs; frequently retained issues have eight revisions and
eight tasks.

This corrupts the AI-native search ecology. An attempted issue can appear new
after refresh, costs attach to transient corpus identities, and recurring
selection cannot distinguish a genuinely new ontology question from fresh
evidence for an old question.

## Ontology decision

An ontology search issue consists of four non-identical objects:

1. **Stable issue contract** — selection lane, relation pattern, objective,
   tool protocol, and bounded research authority.
2. **Exact input revision** — ontology identity, corpus snapshot, selected
   trailheads, and the exact listing/node/facet evidence available to tools.
3. **Coverage observation** — matched proposals/counterexamples and campaign
   eligibility at a point in time.
4. **Attempt** — an authorized run against one exact input revision.

Task identity belongs to the issue contract. Input and coverage changes create
immutable revisions. An attempted stable issue does not become unattempted just
because the ontology snapshot rotated.

## Phase 1 — contract and compatibility

- [x] Define a strict content-addressed ontology issue contract.
- [x] Add a task payload/protocol that carries the stable contract, not a full
  corpus-bound normalization payload.
- [x] Add a successor issue revision that retains the exact current normalization
  payload and all existing ontology/corpus/trailhead lineage.
- [x] Continue validating and replaying retained v1 revisions byte-for-byte.
- [x] Resolve the exact full payload from the selected revision when constructing
  the first-party tool host; never let task ID alone choose an ambiguous input.

## Phase 2 — reconciliation and selection

- [x] Reconcile the 64 selected issue groups against retained revisions.
- [x] Reuse one exact revision when contract, input, and coverage are unchanged.
- [x] Create a successor input revision when ontology, corpus, trailheads, or
  proposal coverage changes, while idempotently retaining the stable task.
- [x] Save only newly created revisions and previously unseen task contracts
  during startup.
- [x] Make campaign selection and yield attribution key attempts by stable issue,
  then bind any new authorized run to one exact current revision.

## Phase 3 — qualification

- [x] Prove receive-time observation changes do not change a contract.
- [x] Prove trailhead/ontology changes create exact successor inputs.
- [x] Prove coverage changes affect eligibility without manufacturing a new task.
- [x] Persist and replay mixed v1/successor revisions in SQLite.
- [x] Run two consecutive live startups with every AI timer disabled and compare
  ontology revisions, ontology tasks, runs, invocations, campaigns, and tokens.
- [x] Run workspace check, all tests, and production build.

## Live checkpoint — 2026-08-12

The first successor startup performed the intentional one-time migration: 64
current v2 issue revisions created 64 v2 tasks. The next anonymous catalog
refresh did not preserve the exact 64-member portfolio: 51 issue contracts
remained current and 13 genuinely new `selection lane × relation pattern`
contracts entered. Reconciliation therefore created 64 new input revisions but
only 13 new tasks.

Across the retained successor window there are 128 v2 revisions, 77 issues,
and exactly 77 tasks. Fifty-one issues have two input revisions and one task;
26 newly observed issues have one revision and one task. No provenance contract
has more than one v2 task. This rejects the original overly broad gate that a
second live startup must add zero tasks: a changing catalog is allowed to
surface genuinely new research issues. The correct invariant is zero duplicate
tasks for a stable issue contract.

Both startups left 241 runs, 498 model invocations, 20 campaigns, and known
2,068,225 / 19,328 / 4,904 input/output/reasoning tokens unchanged. Reconciliation
started no provider, model, run, campaign, or dispatch. The retained 512-row
window continues to accept mixed v1/v2 records byte-for-byte; normal bounded
window eviction remains the existing storage policy rather than a migration
rewrite.

Workspace check passes. All control-plane suites pass (84 files / 590 tests),
Studio passes (four files / 24 tests), and production build passes on the
available Node 22 host with the expected Node 24 engine warning and existing
Studio chunk-size warning.

## Qualification gates

- [x] stable issue contract identity is independent of ontology/corpus snapshot;
- [x] exact normalization payload remains retained and tool-addressable;
- [x] two revisions of one contract share one Agent task ID;
- [x] attempted issue history survives input rotation;
- [x] proposal/counterexample coverage remains deterministic;
- [x] retained v1 records replay without rewrite;
- [x] a stable issue adds zero duplicate task IDs across startup refreshes;
- [x] genuinely new issue contracts remain eligible to create new tasks;
- [x] reconciliation starts zero providers, models, runs, campaigns, or dispatches;
- [x] full workspace verification passes.

## Non-goals

- weakening exact listing/node/facet evidence binding;
- automatically dispatching newly observed inputs;
- treating every catalog delta as sufficient recheck novelty;
- changing lane budgets or ontology ranking policy in the same slice;
- live orders, credentials, signatures, funds, or execution authority.
