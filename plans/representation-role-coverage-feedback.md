# Representation-role coverage feedback

Issue: https://github.com/luokerenx4/my-little-pony/issues/243

## Decision context

The adopted corpus-dialect atlas exposes 31 `SPORTS_RESULT` aggregate-role
listings and zero component-role listings. Durable earlier evidence proves that
the missing component role is not simply absent from the market world: run
`1396c099…` matched nine Opinion `A vs B` candidates and the first-party
component classifier rejected all nine as unclassified. The aggregate side
matched 232 raw candidates and accepted one.

"No pair" currently conflates three different ontological states:

- `SOURCE_ABSENT`: no lexical observation exists for the requested role;
- `ONTOLOGY_BLIND_SPOT`: lexical candidates exist but current role cues reject
  them;
- `BRIDGE_GAP`: both roles classify but exact bridge evidence produces no pair.

Only source absence is an acquisition problem. Blind spots are candidate
ontology mutations; bridge gaps are subject/competition identity research.
Buying another Agent search against an unclassified corpus is waste.

The same live generation exposed a second measurement boundary. Exact flat
searches affect Agent reasoning and inspection but their query and hit
coordinates are retained only as aggregate step counts. Intent realization can
therefore measure role search but not the independent F1 flat-search experiment.

## Product thesis

1. Retain every accepted flat-search result as an exact, content-addressed
   observation bound to input, run, call and corpus snapshot.
2. Compile provider-free representation-role feedback from exact atlas and
   search observations, preserving raw presence, classifier acceptance,
   unclassified exact refs, bridge yield and lineage.
3. Classify the observed gap as `SOURCE_ABSENT`,
   `ONTOLOGY_BLIND_SPOT`, `BRIDGE_GAP`, or `OBSERVATION_INSUFFICIENT`.
4. Return compact feedback to the Agent as descriptive evidence. A detailed
   zero-argument tool may expose bounded exact refs.
5. Extend hypothesis-intent realization with separately labelled flat-search
   retrieval coordinates. Lexical novelty is not semantic frontier realization;
   it becomes an observed retrieval frontier that requires inspection and exact
   hypothesis evidence.

The feedback may name `ACQUIRE_SOURCE`, `MUTATE_ROLE_ONTOLOGY`,
`INVESTIGATE_BRIDGE`, or `OBSERVE_MORE`. It cannot mutate regexes, schedule
work, assert a role/subject/relation, or grant probability, certificate,
execution, external-write or value-moving authority.

## Selection experiment

- Prove a fixture `A vs B` candidate is `ONTOLOGY_BLIND_SPOT`, not
  `SOURCE_ABSENT`.
- Prove empty raw buckets remain source absence rather than fabricated ontology
  debt.
- Prove classified two-sided/no-pair evidence is a bridge gap.
- Prove flat-search exact coordinates survive restart and remain labelled
  lexical retrieval only.
- Run Terra/high against compact feedback and compare whether it avoids a
  structurally impossible role search while retaining a grounded experiment.

## Status

Implementation and provider-free qualification complete on branch
`codex/representation-role-feedback`:

- operational schema 59 retains exact flat-search observations across SQLite
  restart, bound to input, run, call and corpus snapshot;
- hypothesis-intent realization V2 separately reports flat lexical retrieval
  coordinates and does not count them as semantic frontier evidence;
- provider-free feedback compiles exact-query `SOURCE_ABSENT`,
  `ONTOLOGY_BLIND_SPOT`, and `BRIDGE_GAP` diagnoses with bounded exact refs;
- reasoning view V6 exposes a compact diagnostic and the Agent may read full
  feedback through a zero-argument tool before choosing a search;
- the feedback has no automatic mutation, acquisition, scheduling, semantic,
  probability, certificate, execution, external-write or value-moving authority.

Qualification: control-plane 108 files / 745 tests, Studio 5 files / 30 tests,
and both builds pass.

Terra/high selection run
`f3889b1505519cc8c7857abc4c90254e0bea125821d84d61f3e55329138111f2`
retained one flat-search observation, two role-search observations and 15 exact
effects. After reading feedback at effect 6, the Agent left the previously
observed sports representation blind spot. It recovered 25 exact Senate flat
hits and then a role-aware Polymarket US frontier with 20 component listings,
two aggregate listings and grounded component/aggregate pairs.

The run is negative orchestration evidence: it used all 16 invocations and
537,506 input tokens, then interrupted on the input-token budget before closing
its hypothesis. Three effects were rejected. Before reading feedback, the Agent
re-read the lens and atlas and declared `DIFFERENT_TEST` against an existing
family. After one accepted counter-scenario action it attempted two other
counter-scenario tools that could not match the active exact binding.

Selection: `ADOPT` the feedback and durable flat coordinates as diagnostic and
measurement infrastructure. Do not claim an Agent-yield or token-efficiency
win. The next continuation should make the callable tool manifest follow the
first-party state machine so stale reads, incompatible hypothesis intents and
non-selected prototype actions are not offered as valid choices.
