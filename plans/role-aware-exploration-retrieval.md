# Role-aware prototype exploration retrieval

Status: selected `ADOPT`; implemented and live-qualified

Issue: [#219](https://github.com/luokerenx4/my-little-pony/issues/219)

## Product question

What should an AI-native discovery machine retrieve when its reusable memory is
a mechanism rather than a claim? The first V3 live specimen searched a flat OR
set containing `winner`, `control`, and `seat`. It received Baltimore and
Buffalo AFC Championship winner markets: exact evidence, but parallel choices
at the same ontological level. The Agent correctly exhausted the lane, yet the
search algebra made an irrelevant neighborhood easier to reach than a
component outcome and its aggregate dependent.

The system should not pre-author claims, but it can expose the roles inside an
accepted mechanism prototype. That changes retrieval from “find documents with
these words” to “find unfamiliar candidate bindings for these two roles.” The
result remains heuristic inspiration: a component cue, an aggregate cue, and a
shared string do not prove subject identity or a world relation.

## Decision

Add a content-addressed role-aware search operation to the current exploration
Agent protocol. The Agent supplies separate component and aggregate subqueries
and optional bridge signals. The first-party host executes both exact corpus
queries, admits hits to a role bucket only when their retained title grounds
that role, and constructs a bounded pair frontier from distinct refs sharing a
grounded bridge signal.

Each result records both subqueries, raw and role-qualified hit counts,
unclassified refs, pair candidates, truncation posture, and zero authority
beyond evidence routing. The operation must remain useful when no pair exists:
zero-pair output is explicit negative evidence, not a tool failure.

Current terminal trailheads must name one component ref and one aggregate ref
that appeared together in a prior role-aware result. Exhaustion may cite either
a role-aware result or the older flat search during in-loop repair, but the live
selection specimen should exercise the role-aware path. Historical V1-V3 task
and result lineage remains readable without pretending it was role-gated.

## Phase 1 — search algebra

- [x] Define and validate exact component/aggregate probe schemas.
- [x] Execute both probes against one assigned corpus snapshot.
- [x] Separate raw hits, role-qualified hits, and unclassified diagnostics.
- [x] Build bounded distinct-ref pairs with exact grounded bridge signals.
- [x] Reject parallel alternatives such as Baltimore/Buffalo championship
  winners while surfacing a race/constructors pair.

## Phase 2 — Agent protocol and durable lineage

- [x] Expose the role-aware operation in a successor tool protocol.
- [x] Bind terminal positive results to a prior exact pair candidate.
- [x] Preserve searched role-result identities on positive and negative memory.
- [x] Attribute pair, inspection, terminal, and token yield separately.
- [x] Retain accepted role-search summaries immediately so an interrupted Agent
  loop cannot erase its search yield.
- [x] Separate the 5-minute per-model wait posture from a 10-minute exploration
  loop wall-clock budget.
- [x] Keep restart lineage for historical protocols without dispatch shims.

## Phase 3 — product qualification

- [x] Project the current role-search contract and historical posture in Studio.
- [x] Pass provider-free fixtures, full tests, build, and browser inspection.
- [x] Run one unresolved axis with Terra/high and compare irrelevant inspection
  count and useful pair yield against the 171,542-token V3 baseline.
- [x] End with `PARTIAL_ADOPT`: keep role-aware retrieval, its durable
  observation ledger, the yield funnel and decoupled time budget; replace
  model-facing content hashes with stable first-party semantic handles in V5.

The first live V4 specimen reached three accepted role searches after two
compact lens reads, then rejected one inspection whose ref was outside the
role-qualified hits and used one flat-search repair. Its eighth invocation was
interrupted at exactly the execution profile's 300-second wall-clock boundary.
Seven preceding invocations succeeded; the run consumed at least 192,586 known
input tokens before the final timed-out call and retained no terminal result.
This is not evidence against role-aware retrieval. It reveals that the
5-minute model-wait preference and the whole Agent-loop budget are accidentally
the same parameter, and that accepted nonterminal searches leave only opaque
tool-effect hashes when a run ends without a terminal result. Both defects must
be fixed before another paid specimen.

The second V4 Terra/high specimen used the successor 600-second loop budget and
completed all eight model turns in 196 seconds rather than timing out. It spent
174,788 input, 2,638 output, and 1,184 reasoning tokens (178,610 total). A
counterexample-frontier lens first used one flat search and one inspection,
then issued one role search over a shared `Reg Time:` bridge: 3+3 raw hits,
0+0 role-qualified hits, and zero pairs. That negative search observation was
durably readable from SQLite even though the run ended without a terminal.

The run tried to retain an exhaustion three times, but every terminal effect
was rejected because the model invented or malformed a content-addressed
transfer-test reference. This identifies the next protocol defect: first-party
reference choices were visible in prose but not constrained in the tool
grammar. Terminal schemas now inject the exact current transfer-test and
counter-scenario refs as dynamic enums. A final paid specimen is required to
measure whether grammar-level affordance turns the observed negative search
into durable exhaustion without repair churn. The axis also shows why flat and
role-aware retrieval should coexist: component/aggregate pairs are a strong
default for transfer lanes, while a counterexample frontier may rationally
search for same-role rule variants that violate an invariant.

The dynamic-enum qualification falsified that repair. It spent 194,013 input,
2,372 output and 1,208 reasoning tokens (197,593 total) across eight successful
model invocations, yet retained no search or terminal. The app-server/model did
not reliably obey the long-hash enum: three exhaustion attempts still supplied
malformed references, and one otherwise repaired attempt correctly failed the
first-party precondition that an exhaustion must follow a search. Adding more
invocations would only hide a bad affordance. Selection is `PARTIAL_ADOPT`:
role-aware retrieval, immediate observation persistence, the Studio funnel and
the 10-minute loop remain; model-facing content hashes are abandoned.

V5 separates the two identities. Durable evidence and record identities remain
content-addressed. Agent action inputs now use ordinal handles such as
`transfer-test:1` and `counter-scenario:2`; the first-party host resolves them
to exact retained prose before building any trailhead or exhaustion. The
reasoning view omits the hashes entirely and terminal schemas enumerate only
these short handles. This is an interface change, not weaker evidence lineage.

The first V5 qualification showed that values alone do not define the Agent
affordance. It spent 163,526 input, 3,168 output and 2,573 reasoning tokens
(169,267 total). It eventually performed one flat search, but the terminal
fields were still named `failedTransferTestRefs` and
`activatedCounterScenarioRefs`; the model continued to supply hash-shaped or
otherwise invalid values and exhausted eight turns. V6 therefore completes the
separation at the language boundary: the fields themselves are now
`appliedTransferTestHandles`, `failedTransferTestHandles`, and
`activatedCounterScenarioHandles`, with descriptions explicitly directing the
Agent to the short handles. V4/V5 remain durable negative interface evidence.

V6 falsified parameterized handles as well. It spent 192,899 input, 4,281
output and 3,297 reasoning tokens (200,477 total), completed a flat search,
but still exhausted eight turns around terminal construction. The selection
problem itself belongs in the action trace, not in a final JSON payload. V7
therefore exposes one zero-argument action tool per exact prototype test and
counter-scenario: `mark_transfer_test_1_applied`,
`mark_transfer_test_1_failed`, and `activate_counter_scenario_1`. The host
accumulates accepted actions, rejects contradictory marks, and terminal tools
consume that first-party state without any reference or handle parameters.
This is the architecture originally intended by the Agent-first tool model:
structured externality happens when the Agent acts, while the terminal only
summarizes the searched neighborhood and rationale.

The first V7 specimen validated that topology before persistence was added. It
spent 190,458 input, 997 output and 392 reasoning tokens (191,847 total). All
eight tool effects were accepted: lens read, role search, inspection, three
applied transfer tests and two activated counter-scenarios. It reached the
eight-invocation ceiling immediately before a terminal result. This is strong
evidence that zero-argument action tools remove the malformed-reference loop;
it also means a nonterminal action trace is valuable research memory in its
own right.

Schema 57 therefore retains every accepted transfer-test and counter-scenario
action immediately, keyed to the exact input, run and tool call. The store
revalidates the ordinal and exact prose against the retained prototype before
commit. Studio projects the durable action count. The successor execution
profile allows 12 model invocations and 300,000 input tokens while keeping the
10-minute loop wall clock and 5-minute per-turn timeout; this adds terminal
tail room only after the action protocol demonstrated useful work.

The final Terra/high specimen selected `ADOPT`. Run
`sha256:d31ed316cd174c89397927f1df1595b1a7da430d134c6d21cc9b0fa50eaa6cbb`
completed in 214 seconds with 10 successful invocations, spending 259,067
input, 2,884 output and 2,158 reasoning tokens (264,109 total). It durably
marked transfer test 1 failed, searched 23 component candidates and zero
aggregate candidates, inspected exact Alaska evidence, and retained bounded
exhaustion `sha256:950fb874a2733921d94f98e82a22f01a0d79c9dabb9136b4a7808ea044782051`.
The role-aware summary was 23+0 raw, 8+0 qualified and zero pairs. No semantic,
probability, certificate, execution or value-moving authority was granted.

This success also exposes the next cost frontier. The Agent attempted a
terminal twice before its first-party prerequisites were met, and eight of ten
invocations were classified as result repair. The next mainline continuation
should expose a compact first-party action-readiness state after every effect,
so the Agent can see which terminal is currently admissible without learning
the state machine through rejected calls.

## Selection gates

- Search starts no provider/model call and performs no external write.
- Pair construction is replayable from exact retained listing titles and the
  exact probes.
- A listing cannot occupy both roles in one pair.
- A shared bridge signal is required but never treated as subject identity.
- Empty role buckets and empty pair frontiers are valid bounded results.
- No output gains semantic, probability, certificate, execution,
  external-write, credential, or value-moving authority.

## Non-goals

- proving that a role-qualified pair instantiates the prototype;
- deterministic extraction of every possible world role;
- embeddings as hidden admission authority;
- requiring the Agent to begin from a prewritten market claim;
- automatic recurring dispatch before useful pair yield is measured.
