# Cross-episode hypothesis family memory

Issue: https://github.com/luokerenx4/my-little-pony/issues/229

## Observation

The first adopted V10 Terra/high experiment spent 217,978 input tokens to
falsify one bounded conjecture. Its intent and outcome are durable, but a later
Agent can paraphrase the same test and repurchase nearly identical work because
selection currently sees input coverage, not hypothesis history.

## Decision

Compile a provider-free hypothesis-family projection from exact episode
coordinates:

- family identity is prototype + variation axis + exact test kind/ordinal/text;
- material-variation prose is retained evidence, never identity or semantic
  equivalence;
- each family reports distinct inputs/runs, disposition counts, effect-span
  yield and exact unique invocation/token cost;
- selection signals are descriptive (`FIRST_OBSERVATION`, `MIXED_EVIDENCE`,
  `REPLICATED_FALSIFICATION`, `REPLICATION_YIELD`) and have no block, campaign,
  semantic or execution authority;
- V9 episodes without hypotheses remain valid memory but cannot enter a family.

The first slice informs an operator and future Agent context. It must not
silently skip a current input: a repeated exact test on new corpus evidence can
be valuable replication.

## Selection

Adopt if the retained live V10 episode compiles to one stable family with exact
hypothesis-span cost; reads remain zero-provider; historical V9 stays outside
the family count; and Studio clearly labels the grouping as test-family memory,
not semantic truth.

Hold if exact span attribution cannot avoid double-counting multi-effect model
invocations. Abandon if grouping needs prose similarity or acquires scheduling
authority.

## Status

Selected `ADOPT`.

The retained live V10 episode compiled into one exact
`COUNTEREXAMPLE_FRONTIER / transfer-test:4` family. The whole episode used
217,978 input tokens; the exact hypothesis span (effects 3→9) used seven unique
invocations and 155,406 input tokens. Inside that span, three searches produced
38 raw hits, 16 qualified hits, zero pairs and one inspection. The family is a
`FIRST_OBSERVATION` with one falsified hypothesis on one exact semantic input.

Historical V9 memory remains replayable and is excluded from hypothesis-family
counts. Studio labels the grouping `NO SCHEDULING AUTHORITY` and says explicitly
that identity uses exact coordinates, not prose similarity or semantic truth.
The public exploration memory projection advanced to V2 and its containing
world-state projection to V7 after hot-reload QA exposed the incompatibility of
adding required fields under the old version.

Qualification passed 108 control-plane files / 737 tests, 30 Studio tests and
the production build. The compiler and UI perform zero provider or model work.

The next frontier is to deliver this compact family memory to the V11 Agent
reasoning view with an explicit `EXTEND / REPLICATE / DIFFERENT_TEST` intent.
That should improve mutation pressure without turning family history into an
automatic block.
