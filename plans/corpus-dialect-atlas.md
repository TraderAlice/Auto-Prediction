# Corpus-dialect atlas for Agent query construction

Issue: https://github.com/luokerenx4/my-little-pony/issues/241

## Decision context

The first portfolio-guided Terra/high `EXTEND` specimen chose a legal hypothesis
family intent but spent 155,304 hypothesis-span input tokens on a rigid role
query whose sports vocabulary did not occur in the assigned corpus. Its flat
fallback crossed into election listings and correctly produced
`NO_EVIDENCE_FRONTIER_CHANGE`.

The failure is not evidence that the model lacks the concept of sport. The exact
600-listing corpus contains multiple venue-local representation dialects:
Opinion uses `A vs B`, Myriad uses natural-language questions, Polymarket US
uses em-dash candidate templates, and Kalshi may expose an outcome bundle as a
listing title. The Agent currently has no bounded way to observe those dialects
before constructing a query.

## Product thesis

Compile a provider-free, content-addressed corpus-dialect atlas from the exact
assigned market corpus. The atlas will expose:

- listing and predicate-family populations by venue;
- bounded title-form populations such as interrogative, versus, em-dash
  candidate, up/down, threshold and outcome-bundle forms;
- the current first-party component and aggregate role-cue populations;
- venue-diverse exact title/listing exemplars for each predicate neighborhood.

The initial lens carries only the atlas identity and compact counts. A separate
zero-argument read tool returns the bounded atlas, so detailed lexical context
is purchased only when the Agent chooses or recovery recommends reconnaissance.
The first-party continuation router may recommend the atlas before search, but
the atlas does not choose an intent, hypothesis, query, listing, pair or action.

## Authority and ontology

A title is an observed venue rendering of a contract surface, not the world
event itself. Predicate labels, title forms and role cues are lexical routing
hypotheses. They cannot assert subject identity, semantic implication,
mutual-exclusion probability, certificate validity, scheduling priority or
execution authority. Existing exact inspection, hypothesis lifecycle, axis
admission and verifier boundaries remain unchanged.

The atlas is reconstructible from its exact corpus snapshot and algorithm
version. It does not need a second mutable persistence table.

## Selection experiment

1. Qualify deterministic identity, boundedness, venue diversity and explicit
   false authority in fixtures.
2. Confirm the lens omits atlas detail and the zero-argument tool returns it.
3. Confirm continuation routing recommends reconnaissance before blind search
   without making atlas use a terminal or semantic requirement.
4. Run a separately authorized Codex OAuth Terra/high `EXTEND` specimen.
5. Compare exact role/flat yield, inspected-domain relevance, rejections,
   hypothesis disposition and token span against run `1f4973c8…`.

Adopt if the Agent uses corpus-grounded language to improve relevant exact
retrieval or reaches a cheaper grounded negative result. Redesign or reject if
the atlas merely adds context cost, duplicates existing lens evidence, or is
treated as semantic truth.

## Status

The first live Terra/high specimen `cecb9202…` used the initial 36,696-character
atlas without enforcement. It called atlas → lens → open `EXTEND` → role search
→ inspect → fail `transfer-test:2` → close → exhaustion. All eight effects were
accepted with zero rejections; the run used 258,937 input tokens.

The Agent stayed inside the intended sports domain and constructed exact
Polymarket US queries for `American League + Division` versus `American League
+ Champion`, rather than repeating the baseline's election-contaminated flat
fallback. The aggregate side found 15 exact listings (eight returned), while
the component side found zero. The hypothesis closed `FALSIFIED` with a
grounded negative result.

This is improved relevance but not yet an efficiency win: the pre-atlas
baseline used 204,543 total input. The live evidence also reveals a deeper
ontological mismatch. In the current corpus, the first-party role classifier
recognizes 31 `SPORTS_RESULT` aggregate listings and zero `SPORTS_RESULT`
component listings. No sports query can currently produce a role-qualified
pair even though Opinion exposes `A vs B` component-like surfaces.

The atlas has therefore been compressed from 36,696 to 11,597 serialized
characters (about 68%) and now reports predicate-family role asymmetry
directly. Exact exemplars are bounded more tightly and annotation repetition is
removed. A second live specimen will decide whether the compressed atlas
produces a lower-cost grounded negative and whether this iteration should be
adopted before repairing the role ontology.

The compressed-atlas Terra/high run `f388add1…` completed nine accepted effects
with zero rejections and 257,359 total input tokens. It read lens → atlas, then
opened a legal independent `DIFFERENT_TEST` hypothesis on `transfer-test:4`.
Seeing the sports role asymmetry, it did not repeat a structurally one-sided
role search. Two exact flat searches returned 56 raw / 16 retained F1
driver/constructors surfaces; it inspected two listings, failed the exact test,
closed `FALSIFIED`, and retained bounded exhaustion. Complete episode
`f6c358e6…` is durable.

The atlas did not beat the no-atlas baseline's token cost (204,543 versus
257,359 total input). It did improve domain relevance and expose why current
retrieval cannot form the desired pair. The compressed context also changed
the experiment rather than merely shortening the first run: it selected a
different exact test and avoided a known-empty role lane. The resulting flat
search is currently absent from intent-realization coordinates, so this
independent hypothesis remains unmeasurable by the role-search-only frontier.

## Selection result

`ADOPT` as an ontological observation instrument, not as a proven token or
opportunity-yield optimization. The atlas makes a missing half of the search
world explicit and changes Agent behavior without enforcing a query. The next
generation must use representation/role coverage gaps as acquisition and
ontology feedback, and must retain exact flat-search coordinates without
mistaking broad lexical hits for semantic realization.

## Status

Selected `ADOPT` and qualified for merge. The full workspace passes with 108
control-plane files / 743 tests, 30 Studio tests and a production build. The
only environment warning is the already-known local Node 22 versus declared
Node 24 engine mismatch; no qualification failed.
