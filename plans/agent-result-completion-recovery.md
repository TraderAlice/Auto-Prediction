# Bounded Agent result-completion recovery

Status: active mainline construction

Issue: [#119](https://github.com/luokerenx4/my-little-pony/issues/119)

Branch: `codex/agent-result-completion-recovery`

## North-star role

AI-native research requires long-loop runtimes to inspect evidence, call tools,
repair rejected effects, and deliberately publish a typed result. Tool-first
authority must not collapse back into parsing free text, but a runtime that
ends one turn after research without a result tool should not necessarily lose
the entire bounded run.

The first allocation-connected relation run exposed this exact gap. Codex
app-server and Terra/high used four successful invocations, read the exact work,
inspected listings twice, and then completed with diagnostic text. The executor
correctly refused to treat text as a result, but failed the run while eight
invocation slots remained.

## Decision

Add one optional completion-recovery capability to the provider-neutral Agent
runtime session contract. The generic executor may invoke it only when:

1. the runtime reports a completed diagnostic artifact;
2. no declared result tool has produced an accepted effect;
3. the session explicitly supports recovery;
4. existing run and campaign budgets still admit another model invocation; and
5. no previous completion recovery has occurred in this run.

The recovery prompt remains inside the same ephemeral Agent thread and names
only the declared result tools. It asks for one typed result or an explicit
counterexample based on already inspected evidence. It grants no new tools,
authority, budget, filesystem, shell, web, MCP, subagent, or external-write
capability.

## Implementation phases

### Phase 1 — provider-neutral bounded contract

- [x] Add an optional session completion-recovery method with bounded declared
  result-tool names.
- [x] Meter the recovered turn as an ordinary model invocation inside all
  existing run/campaign budgets.
- [x] Permit at most one recovery turn; a second diagnostic-only completion
  fails closed.
- [x] Explicitly cancel sessions on all terminal completion paths.

### Phase 2 — Codex app-server same-thread recovery

- [x] Keep the ephemeral thread open after diagnostic-only completion.
- [x] Start a second turn in the same thread with a fixed first-party recovery
  instruction; do not replay or expand the task payload.
- [x] Continue dynamic tool handling and exact token accounting normally.
- [x] Preserve built-in-tool rejection and result-tool authority.

### Phase 3 — qualification

- [x] Prove diagnostic-only → accepted result recovery succeeds with every
  model/tool boundary metered and one accepted effect.
- [x] Prove diagnostic-only → diagnostic-only still fails closed after one
  recovery.
- [x] Prove a rejected result followed by free text does not become success
  merely because recovery exists.
- [x] Run checks, full control-plane tests, and production build. Run a bounded live
  retry only after the contract is merged.
- [x] Retry the retained relation task under a new explicit manual-only campaign
  revision and inspect exact findings, cost, and downstream projection behavior.

## Live evidence

Run `sha256:fa2992feb05e7bbd1c0df474f254d9293321c8b9a66a5ad6b00a185938c8f0bc`
is the retained negative specimen: four successful invocations, 74,669 / 997 /
715 input/output/reasoning tokens, three accepted research effects, zero result
effects, 113,684 ms, and terminal failure
`runtime completed without an accepted result effect`. Its campaign is paused;
the implementation must not silently retry it.

The explicit post-merge retry is run
`sha256:f59503c187007eefe89969d69876d541ffe94a503e682bfbb0758c4bc7370ea5`.
It succeeded in 127,143 ms with eight successful invocation boundaries,
179,293 / 1,722 / 740 input/output/reasoning tokens, seven accepted tool
effects, one retained relation hypothesis, and one retained counterexample.
The model called the result tools in its ordinary long loop, so this specimen
did not need the recovery turn. Reading the downstream relation projection then
exposed issue #121: a valid refreshed-corpus finding was paired with an older
input revision because both revisions deliberately share a stable task ID.
That follow-up is exact-lineage compilation work, not evidence against the
completion-recovery contract.

## Implementation checkpoint — 2026-08-12

The generic session contract now exposes optional
`prepareCompletionRecovery`. Preparation starts no inference; the next ordinary
loop iteration rechecks wall-clock, invocation, input/output token, tool-call,
and campaign budgets before the runtime can start another turn. The executor
permits the capability once, meters every subsequent model/tool boundary, and
explicitly cancels the session on terminal success, diagnostic failure, or
budget exhaustion.

Codex app-server retains the same ephemeral thread after a diagnostic-only
completion and stages a fixed recovery prompt containing only declared result
tool names. It does not replay the task payload or expand the tool manifest.
Tests prove recovery into one accepted result effect, fail-closed behavior after
a second diagnostic completion, rejected-effect non-authority, and zero staged
or started recovery after invocation budget exhaustion. Workspace checks, all
control-plane suites (86 files / 601 tests), Studio suites (four files / 24
tests), remaining workspace suites, and production build pass; only the known
Node 24 engine expectation and existing Studio chunk-size warning remain.

## Non-goals

- accepting or parsing diagnostic free text as a semantic result;
- unlimited self-repair turns;
- retrying model, transport, timeout, built-in-tool, or budget failures;
- changing provider/model/effort selection;
- weakening campaign authorization or exact input-revision binding;
- live orders, signatures, transactions, credentials, or funds.
