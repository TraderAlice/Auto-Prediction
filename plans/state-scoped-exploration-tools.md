# State-scoped exploration tools

Issue: https://github.com/luokerenx4/my-little-pony/issues/245

## Decision context

Terra/high run `f3889b15…` proved that representation-role feedback can move
search onto a grounded 20-component / 2-aggregate Senate frontier. It also
spent all 16 invocations and 537,506 input tokens before interruption. Three
effects were structurally impossible under first-party state: an existing
hypothesis family was declared `DIFFERENT_TEST`, then two counter-scenario
actions targeted tests other than the active exact binding. The Agent also
re-read separate lens and atlas tools before reaching feedback.

Codex app-server declares `dynamicTools` when the thread starts; its current
local protocol does not expose a supported per-turn tool-manifest replacement.
The equivalent safe design is therefore to make the static capability surface
state-safe by construction:

1. one context-read tool returns the compact lens, atlas and representation
   feedback together;
2. the open-hypothesis JSON schema enumerates only legal exact
   test/intent/prior-family combinations;
3. one active-binding outcome tool records support or failure against whichever
   exact test the open hypothesis selected, without exposing unrelated ordinal
   actions;
4. completion recovery continues to choose the next legal state transition,
   but schema validation prevents impossible calls before a provider request
   becomes a rejected first-party effect.

## Authority

This restructures an existing research-only tool protocol. It does not grant
semantic, probability, certificate, scheduling, external-write, execution or
value-moving authority. Historical V11 effects remain replayable.

## Selection experiment

- prove the manifest contains no per-test ordinal action tools;
- prove every open-hypothesis schema branch is legal against exact retained
  families;
- prove active transfer and counter-scenario tests can each record supported or
  failed observations without naming another test;
- prove one context read contains all three evidence layers and subsequent
  recovery never recommends a stale read;
- run Terra/high and compare rejected effects, invocation count and input token
  cost against run `f3889b15…` while requiring a grounded experiment.

## Live selection evidence

Two Terra/high specimens used execution-profile revision `20016` and the V12
manifest against the same exact surface-domain lens.

- Run `c950fda1…` spent eight invocations and 173,562 input tokens. It read the
  combined context twice, then made five rejected hypothesis calls before a
  development hot reload interrupted the prepared run. The original generic
  key diagnostic did not expose which fields were missing.
- Run `fdd6602e…` used an improved exact-key diagnostic. Its first effect tried
  to open a hypothesis before reading context. Codex supplied only the three
  fields inside the dynamic `allOf/oneOf` branch and omitted all six root-level
  required research fields. The host rejected it, after which the Agent read
  context. This isolates the failure to static capability visibility and
  composed-schema sampling rather than an illegal family choice.

Focused qualification still proves that the host-bound outcome tool removes
caller-selected ordinals and makes transfer/counter-scenario success and
failure symmetric. The complete control-plane suite passes 745/745 tests.

## Selection

`ABANDON` as a state-scoping architecture. A static thread-start manifest is
not state-scoped merely because completion recovery recommends a subset, and a
composed JSON schema is not a reliable enforcement surface for Codex sampling.
The mutation therefore fails its primary zero-structural-rejection signal.

Retain two learnings for a clean successor rather than merge this branch:

1. bind prototype outcomes to the single active exact hypothesis in the host;
2. model both transfer tests and counter-scenarios as symmetric supported or
   failed prototype tests.

The next candidate should rebuild the Codex Agent boundary at each state
transition (or add an equivalent runtime manifest-refresh contract), expose
only the legal tools for that state, and carry a bounded durable transcript
between fresh threads. This trades some thread-cache reuse for enforceable
capability narrowing and must measure total input cost as well as rejection
count.
