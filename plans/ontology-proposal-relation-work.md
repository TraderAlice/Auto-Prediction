# Ontology proposal to relation-bound work

Status: implemented and qualified in PR #101; downstream execution continues
under [`relation-discovery-execution.md`](relation-discovery-execution.md)

Issue: [#100](https://github.com/luokerenx4/my-little-pony/issues/100)

Branch: `codex/ontology-relation-work` (merged)

## Product proposition

An Agent-authored entity alias, world proposition, or counterexample is a
search seed, not a relation between contracts. The system creates value only
when that seed produces differentiated relation work, reviewed findings,
probability bounds, and eventually economically qualified opportunities.

Do not pair every proposal emitted by one run. A run may normalize unrelated
listings and explicitly reject a relation between them. Instead, consolidate
semantically identical proposal scopes and derive explicit candidate relation
families around each scope.

## Stable lineage

Ontology tasks carry `ontology-issue:<issueId>` provenance. Historical yield
must join `issue -> task -> run -> invocation/effect -> proposal`, not compare
only the latest snapshot-dependent task ID. This lineage survives ontology and
catalog rotation and keeps failed/no-proposal runs as real cost evidence.

Each derived relation-work object retains:

- a stable semantic scope and work identity;
- all source proposal, Agent run, ontology issue, relation-pattern, trailhead,
  listing, node, world-facet, settlement-facet, and traded-facet identities;
- bounded search signals and falsifiers;
- explicit candidate relation kinds and the originating selection lanes;
- whether it is runnable research or negative evidence only;
- zero semantic, probability, certificate, execution, external-write, and
  value-moving authority.

## Work semantics

- `WORLD_PROPOSITION_NEIGHBORHOOD` searches for equivalent, containing,
  implied, incompatible, conditional, or conflicting contracts around one
  normalized proposition. It does not assert any of those relations.
- `ENTITY_ALIAS_NEIGHBORHOOD` searches identity/succession and apparent-
  equivalence neighborhoods without accepting the alias as canonical truth.
- `COUNTEREXAMPLE_MEMORY` prevents an already rejected claim from becoming an
  automatic retry while preserving signals for a later evidence-changed
  revisit.

Repeated proposals with the same canonical semantic scope consolidate into one
work item. Source lineage is additive evidence; it is not part of the stable
work identity. Listing bindings are accumulated deterministically; the compact
projection retains the first 32 plus the complete source count and an explicit
truncation bit instead of failing when a long-lived scope crosses the bound.
Counterexample search signals are accumulated evidence rather than identity.

## Construction phases

1. Correct ontology yield joins to stable issue provenance.
2. Build and validate a bounded, provider-free relation-work projection from
   durable proposals, historical issue revisions, and execution lineage.
3. Expose proposal-to-work coverage and negative-memory counts without
   creating a model request.
4. Add a provider-neutral executable relation-discovery task and first-party
   tools only after the work contract is qualified against live retained
   proposals.
5. Carry work identity through Findings, probability cases, and opportunities;
   then allocate recurring attention from reviewed value per token and minute.

## Qualification gates

- [x] a newer ontology task ID cannot erase historical run, token, effect, or
  proposal attribution for the same stable issue;
- [x] unrelated propositions from one Agent run remain separate work scopes;
- [x] duplicate semantic proposals consolidate without losing source lineage;
- [x] counterexamples are negative memory and are not runnable by default;
- [x] every work item names candidate relations, signals, falsifiers, exact
  evidence lineage, and authority boundaries;
- [x] the read endpoint starts zero provider requests and model invocations;
- [x] live retained proposals yield replayable work after restart;
- [x] full workspace checks and tests pass.

## Live checkpoint — 2026-08-12

After restart, stable issue provenance recovered three historical ontology
runs that the snapshot-local join had projected as zero: two successes, one
explicitly terminated protocol experiment, ten model responses, five accepted
and two rejected tool effects, 203,613 known input tokens, 2,738 output tokens,
and 1,637 reasoning tokens. One early successful run retains one unknown usage
boundary as truthful pre-fix evidence.

The two durable world propositions produce two separate runnable relation-work
items—LAFC/2026 MLS Cup and Club Brugge/2026-27 UEFA Champions League—with
100% proposal-to-work coverage and no missing lineage. Both originated from a
settlement-divergence issue, so the deterministic work policy proposes only
`EQUIVALENT`, `CONDITIONAL`, and `CONFLICTING` as candidate relations. Each
retains exact proposal/run/issue/revision/pattern/trailhead and listing-facet
lineage. Neither asserts a relation between the two sports propositions. The
projection and the ecology read started zero provider requests and zero model
invocations; automatic dispatch remains false.

## Non-goals

- certifying the Agent's world proposition or alias;
- interpreting a world proposition as a cross-listing relation;
- automatic recurring model spend in this phase;
- live venue credentials, orders, signing, approvals, or value movement.
