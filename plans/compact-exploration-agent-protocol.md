# Compact prototype-exploration Agent protocol

Status: completed mainline predecessor

Issue: [#215](https://github.com/luokerenx4/my-little-pony/issues/215)

## Product question

Can a long-running exploration Agent spend its context on ontology-guided
search and falsification rather than repeatedly decoding durable scheduler
metadata or copying exact prose back to the host?

The second live prototype-guided specimen gives a negative answer for protocol
v1. A zero-seed `SURFACE_DOMAIN` run made eight successful Terra/high model
invocations over 230 seconds and consumed 231,850 known input, 2,395 output,
and 1,000 reasoning tokens. It called the lens read tool four times, searched
once, inspected once, and then lost the terminal negative result because its
paraphrase did not byte-match a retained transfer test. The run was interrupted
after crossing the 200,000-input-token budget and retained no research result.

This is an interface failure, not evidence that the lens was exhausted and not
a reason to relax exact evidence checks.

## Decision

Split the durable exploration input from its model-facing reasoning view.
SQLite continues to retain the exact corpus revision, global identities,
coverage scope, every coverage member, exclusions, and seeds. The ordinary
`read_mechanism_exploration_lens` result exposes only the bounded information
needed to reason: lens/prototype identity, axis, exact seeds, compact prototype
roles and signals, and stable content-addressed references for transfer tests
and counter-scenarios. It reports coverage counts and identities without
serializing the member ledger.

Terminal tools accept those first-party references. The host validates every
reference against the bound prototype and materializes the exact retained text
before building a trailhead or exhaustion. Unknown references fail closed.
The protocol version advances rather than pretending the breaking tool schema
is compatible with retained v1 executions.

An attempted campaign run without an accepted terminal result is operational
history, not semantic coverage. Campaign eligibility remains governed by
durable trailheads/exhaustions and relevant coverage novelty; protocol repair
may therefore retry the same unresolved lens under a new exact task/profile
binding.

## Phase 1 — compact, reference-safe protocol

- [x] Add deterministic transfer-test and counter-scenario references bound to
  the exact prototype.
- [x] Replace terminal free-text copies with reference arrays and materialize
  the exact retained prose inside the first-party host.
- [x] Return a bounded reasoning-complete lens view without coverage members or
  other scheduling-only ledgers.
- [x] Advance the execution/tool protocol revision and preserve retained v1
  runs as historical evidence.
- [x] Prove unknown references fail closed and accepted results still retain
  exact prototype prose.

## Phase 2 — retry and measure

- [x] Stop treating a merely attempted run as completed semantic coverage when
  no durable trailhead or exhaustion exists.
- [x] Run focused and full qualification without provider calls.
- [x] Retry one unresolved zero-seed lens with Codex OAuth, Terra/high, manual
  dispatch, and no automatic recurrence.
- [x] Compare read payload size, model invocations, input/output/reasoning
  tokens, tool yield, terminal acceptance, and wall time with the failed v1
  specimen.
- [x] Feed the live result into the next ontology/search-ecology decision.

## Live qualification

The repaired `SURFACE_DOMAIN` task ran through Codex app-server with Codex
OAuth, `gpt-5.6-terra`, and high effort under one manual single-task campaign.
It succeeded in seven invocations over roughly 145 seconds, using 145,294
known input, 1,439 output, and 351 reasoning tokens. It made two accepted
searches, one rejected malformed-regex search, one exact inspection, two compact
lens reads, and one accepted trailhead submission. The campaign was paused
immediately after completion.

The failed v1 specimen used eight invocations, 231,850 input, 2,395 output, and
1,000 reasoning tokens, then lost its terminal result. V2 reduced input by
86,556 tokens (37.3%), stayed below the unchanged 200,000-input campaign bound,
and retained a terminal result without repair. Early per-invocation context
fell from roughly 31–36k to 18–21k tokens. Full control-plane qualification
passes 108 files / 728 tests; the focused successor run passes 40 tests and the
whole workspace type check passes on Node 22 with only the repository's known
Node 24 engine warning.

The accepted trailhead itself is selection evidence against the current
`SURFACE_DOMAIN` semantics. It paired an Iowa Republican Senate-seat contract
with a national Republican Senate-control contract and called cross-venue,
different rule expression, and changed party/state a surface-domain mutation.
That pair remains close to the already known component-seat / chamber-control
family. Because a trailhead has routing authority only, no semantic truth was
admitted; nevertheless, the next construction should make a variation axis a
falsifiable first-party admissibility object rather than an unconstrained
prompt label. More paid exploration before that gate would optimize for
formally new but ontologically familiar candidates.

## Selection gates

- Exact durable input and corpus lineage remain unchanged and loadable.
- The model-facing read does not contain `coverageMembers`.
- Each terminal prototype reference is valid for the exact bound prototype;
  no fuzzy host matching is introduced.
- A protocol failure or interrupted run cannot silently close semantic scope.
- Read projection, reference derivation, campaign preview, and qualification
  do not themselves start a provider request or model invocation.
- No result gains semantic, probability, certificate, execution, external
  write, or value-moving authority.

## Non-goals

- hiding exact evidence to reduce token cost;
- accepting paraphrases as exact transfer tests;
- embedding similarity as semantic authority;
- automatic recurring dispatch;
- increasing budget without first correcting the protocol.
