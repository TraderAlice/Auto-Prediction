# Budget-bounded Agent result repair loop

Status: active mainline construction

Created: 2026-08-13

Branch: `codex/agent-result-repair`

Issue: [#154](https://github.com/luokerenx4/my-little-pony/issues/154)

## North-star role

The first real run measured by discovery-yield attribution proved that the
tool-first architecture fails closed, but not yet that it repairs well. Terra
read its exact relation work, searched the retained catalog, and proposed a
counterexample. First-party validation rejected the terminal call because it
contained too few listing references. One generic recovery turn then ended in
free text, so the run retained no accepted result after 91,187 known tokens.

A durable AI-native arbitrage machine cannot treat every correctable tool
rejection as a fresh job, and it cannot weaken validation to improve apparent
yield. Rejection is typed environmental feedback inside the same Agent loop.
The loop must continue until an accepted result effect or an already configured
run/campaign budget terminates it.

## Ontology decision

An Agent result attempt is distinct from an Agent run and from an ordinary model
turn:

1. **Primary reasoning** inspects the assigned evidence and chooses tools.
2. **Tool continuation** incorporates an accepted or rejected nonterminal tool
   effect inside the same runtime thread.
3. **Result repair** begins after a declared result call is rejected or the
   runtime tries to complete without an accepted declared result tool. The
   episode survives intervening tool continuations and receives bounded
   first-party diagnostics, never raw secrets or inferred semantic truth.
4. **Terminal result** exists only when the host accepts a declared result tool.
   Diagnostic model text remains non-authoritative.
5. **Budget termination** is a valid explicit outcome when invocation, token,
   tool-call, wall-clock, or campaign budget closes the repair loop.

No hidden retry count should compete with the execution profile. The existing
budgets are the loop bound and every recovery turn remains a retained model
invocation.

## Phase 1 — recovery contract

- [x] Replace the one-shot completion-recovery boolean with a budget-bounded
  sequence that may continue while existing run and campaign budgets remain.
- [x] Pass only recent declared-result rejection tool names and bounded
  first-party diagnostics into recovery; do not replay raw tool inputs.
- [x] Make Codex app-server recovery prompts name the attempt and exact rejected
  constraints while preserving the same ephemeral thread and dynamic tools.
- [x] Keep Pi, CLI, and in-process runtimes provider-neutral: runtimes without a
  recovery capability still fail closed.

## Phase 2 — purpose and cost evidence

- [x] Add an explicit invocation phase to new model-invocation records so
  primary reasoning, tool continuation, and result repair token cost can be
  measured without guessing from timestamps.
- [x] Preserve historical invocation records as exact evidence; old records are
  unclassified rather than retroactively assigned a purpose.
- [x] Expose repair attempt, accepted-after-repair, budget-terminated, and known
  token totals in the Agent workspace without model or write effects on read.

## Phase 3 — actionable tool feedback

- [x] Make shared collection validators report exact minimum/maximum counts so
  an Agent can repair a rejected schema call deterministically.
- [x] Prove rejection diagnostics remain bounded and scrub opaque secret-like
  text before entering a model recovery prompt.
- [x] Preserve every rejected effect in the durable ledger even when a later
  repair succeeds.

## Phase 4 — qualification

- [x] Prove two rejected terminal calls can repair to one accepted effect inside
  one run and that accepted effects stop the loop immediately.
- [x] Prove repeated diagnostic-only completion terminates at configured budget,
  never through free-text authority or an unbounded retry.
- [x] Replay the live failed run as retained negative evidence, then qualify one
  new relation task with the repaired Codex/Terra loop.
- [x] Pass full checks/tests/build and update the Studio/API evidence surface if
  purpose-level observability changes it.

## Construction evidence

The runtime now treats a rejected declared-result effect as the beginning of a
repair episode and retains every subsequent repair invocation as
`RESULT_REPAIR`. Each v3 invocation binds an attempt ordinal to up to four exact
rejected effect IDs; this makes repair cost and recovery yield derivable without
timestamp inference. Historical v1/v2 invocations remain byte-exact and are
reported as unclassified.

Synthetic Codex app-server qualification retains two rejected result effects,
then one accepted effect in the same run. A separate four-invocation specimen
refuses result tools until the configured invocation budget terminates it.
Opaque diagnostic fragments and URLs are scrubbed before recovery prompting,
while each rejected effect remains in the durable ledger. The read-only
`pmh.agent-result-repair-projection.v1` reports accepted-after-repair,
budget termination, integrity, exact linked rejections, incomplete usage and
repair-only token totals in both API and Agent Operations.

Workspace type checks, 96 control-plane test files / 654 tests, five Studio
test files / 30 tests, and the production build pass on the available Node 22
host. Desktop and 390 px Studio inspection show no horizontal overflow or
application console warning/error. The expected Node 24 engine warning and the
existing Studio chunk-size warning remain.

Live Codex/Terra-high qualification used the exact successor task
`sha256:f04c…69ab` under the already active, single-concurrency research campaign.
Run `sha256:0834…81b1` inspected its retained Lula leave-office seed, searched the
current catalog, and had `record_ontology_route` rejected because its signal was
not grounded in two inspected listings. The next invocation was retained as
`RESULT_REPAIR`, bound to rejection effect `sha256:f1d0…c875`, and its corrected
call was accepted as effect `sha256:4ce2…061a`. The run succeeded after six model
invocations; repair itself cost 26,996 input, 292 output and 83 reasoning tokens
(27,371 known total), compared with the prior 91,187-token failed fresh run.

The accepted result is a subject-reference search route, not a payoff relation.
The outcome layer correctly classifies the whole 138,396/1,565/750-token run as
`SPENT_WITHOUT_MOVEMENT`: it overlaps a retained Lula event-reference route and
does not advance evidence stage. This selects result repair for adoption while
providing the next north-star problem: first-party admission must reject or
explicitly classify semantically redundant routing memory before an Agent can
spend a full discovery run recreating it.

## Selection signal

Adopt when a recoverable result rejection is demonstrably cheaper than starting
a fresh task and produces either an accepted structured result or an exact
budget termination. Rework if repair cost cannot be isolated. Abandon any path
that parses free text as a result, hides rejected effects, or relaxes first-party
validation.
