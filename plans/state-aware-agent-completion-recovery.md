# State-aware Agent completion recovery

Issue: https://github.com/luokerenx4/my-little-pony/issues/235

## Decision

Separate long-loop continuation routing from terminal result authority.

- `resultToolNames` remains the complete and exclusive set of accepted tool
  effects that may finish a run;
- an optional dynamic `completionRecoveryToolNames` host policy returns the
  bounded next-step tools appropriate to current first-party state whenever a
  model turn naturally completes without a terminal result;
- the Codex app-server recovery prompt states whether the recommendation is a
  continuation or a terminal and retains up to four bounded rejected-tool
  diagnostics;
- a successful continuation tool never becomes a result artifact and never
  ends the run merely because recovery recommended it.

The first policy is mechanism-prototype exploration. It routes through the
existing exact state machine: lens, hypothesis, search, inspection, bound test
action, hypothesis closure, then an eligible terminal. It does not choose a
query, infer a semantic relationship, decide probability, or expand authority.

## Selection

Adopt when focused qualification proves the separation of continuation and
terminal authority, and a matched Terra/high live specimen completes a coherent
hypothesis lifecycle with materially fewer rejected terminal calls and lower
token cost than the pre-change specimen. Reject if the host becomes a semantic
planner, if a nonterminal recommendation can finish a run, or if exact tool
rejections disappear from the ledger.

## Baseline live evidence

The first post-V12 specimen, run `f95e18e9…`, was interrupted after exhausting
16 model invocations. It consumed 351,340 input, 4,113 output and 2,782 reasoning
tokens. Of ten retained tool effects only three were accepted. Five calls
prematurely attempted terminal tools; the static completion-recovery prompt had
repeatedly instructed the Agent to call only a terminal despite missing
first-party prerequisites. This is orchestration failure evidence, not a
negative result about Terra or the searched ontology.

## Verification so far

- adapter qualification proves a dynamically recommended inspection remains a
  nonterminal continuation and a later declared result alone creates the final
  artifact; a mixed continuation/terminal recommendation fails closed before
  the runtime sees an ambiguous prompt;
- Codex app-server qualification preserves the same-thread recovery path and
  distinguishes continuation language from terminal language;
- mechanism-exploration qualification proves the exact recovery sequence from
  unopened lens through eligible bounded exhaustion;
- focused suite: 51 passing tests; TypeScript project check passes;
- full workspace qualification: control plane 108 files / 740 tests, Studio 30
  tests, all package tests and the complete monorepo build pass.

## Remaining live selection

The matched Codex OAuth Terra/high run `1396c099…` used the same active
`SURFACE_DOMAIN` input and unchanged 16-call / 500k-input / ten-minute ceiling.
It completed in seven calls with seven accepted effects and zero rejections:

1. read lens;
2. open a `REPLICATE` hypothesis against exact prior family `8d47341d…`;
3. role search;
4. exact listing inspection;
5. fail bound `transfer-test:2`;
6. close the hypothesis `FALSIFIED`;
7. retain bounded exhaustion.

The complete episode `b2e7ba40…` consumed 174,981 input, 2,283 output and
1,413 reasoning tokens. It reduced 241 raw hits to one qualified aggregate
listing, no pair and one inspection. The V12 compiler classifies the exact
declaration as `REALIZED_REPLICATION` against one causally prior family on an
independent semantic input/run.

After a full control-plane restart, episode `b2e7ba40…`, realization report
`b38ae4c9…`, classification, exact comparison counts and usage remained
identical. The parent memory projection identity changed only because startup
reconciliation added current retained inputs, matching the established
projection contract.

Against baseline run `f95e18e9…`, invocation count fell 16→7 (56%), input fell
351,340→174,981 (50%), accepted effects rose 3→7, rejections fell 7→0, and a
missing hypothesis lifecycle became complete. The matched budget was not
increased.

## Selection result

`ADOPT`. The runtime now preserves model agency over queries and semantic
judgment while using first-party state only to stop completion recovery from
prescribing impossible terminal actions. Continuation and terminal authority
remain independently tested.

## Status

Selected `ADOPT`; qualified and ready to merge.
