# World-state mechanism live-yield qualification

Status: bounded runtime retest gated by once-per-lineage policy qualification

Issue: [#170](https://github.com/luokerenx4/my-little-pony/issues/170)

Branch: `codex/mechanism-live-yield-experiment`

## Product question

The machine has a dedicated mechanism-research role and an explainable input
allocator, but its live funnel is still 64 eligible → 24 structurally suitable
→ 5 selected → 0 attempted → 0 terminal result. Architecture alone does not
show whether an Agent can turn retained ontology evidence into durable world-
state routes, useful falsifiers, or principled abstentions.

## Decision

Qualify exactly the immutable five-task allocation selected on 2026-08-13.
Use its existing independent Codex/Terra profile only after capability
preflight. Create one paused manual campaign, inspect the exact binding, then
activate and dispatch it once. Do not add recurrence or evolving membership.

The experiment budget is a ceiling, not a throughput target:

- maximum five tasks from one allocation projection;
- maximum one concurrent run;
- maximum eight model invocations across the campaign;
- maximum 200,000 input and 20,000 output tokens;
- maximum 900 seconds wall-clock time;
- one run per exact task/revision lineage.

## Phase 1 — frozen specimen

- [x] Record the allocation identity, five action IDs, exact revision bindings,
  profile, model, effort, and preflight observation.
- [x] Verify campaign preview reads still cause zero provider requests, model
  invocations, campaigns and runs.
- [x] Create one paused campaign and prove it cannot spend before activation.

## Phase 2 — bounded execution

- [x] Activate with an explicit experiment reference and dispatch exactly once.
- [x] Observe the first run to a terminal state without dispatching the other
  four tasks.
- [ ] Retain accepted proposal, counterexample, or abstention effects with exact
  invocation, run, issue-revision and allocation lineage.

## Phase 3 — yield and selection evidence

- [x] Report proposal / falsifier / abstention / no-terminal-result counts.
- [x] Attribute input, output and reasoning tokens by terminal result kind.
- [ ] Inspect whether selected relations are true mechanism research or reveal
  another structural allocation defect.
- [x] Update the plan with `CONTINUE`, `REVISE_SELECTION`, or `HOLD_RUNTIME`
  before allowing any recurring mechanism campaign.

## Stop conditions

Stop this specimen without retrying when capability cannot be verified, exact
input binding changes, campaign limits are exhausted, or an authority boundary
is violated. A no-yield terminal result is evidence; it is not permission to
silently enlarge the budget.

## Live observation and disposition

Disposition: `HOLD_RUNTIME`.

Capability preflight proved Codex app-server, the configured ChatGPT account,
`gpt-5.6-terra`, and high effort usable without an inference request. Preview,
campaign creation, and paused inspection retained the exact allocation
`sha256:f904a3d84ff56d9e2ed8c522aa28fd8ac630a1761b4dfdefbacba798339c80c0`
and started zero runs or model calls.

The campaign was explicitly activated under
`experiment:github-issue-170:operator-authorized-north-star`. Its first task
completed two accepted read effects—mechanism coverage and assigned
trailheads—then the third Codex dynamic-tool continuation timed out after 300
seconds before evidence read or a terminal result. The run was interrupted
with:

- 3 invocations, one with unknown usage because it timed out;
- 34,895 known input, 361 output, and 222 reasoning tokens;
- 0 proposal, 0 falsifier, 0 abstention, and 1 no-accepted-result run;
- 0 external writes and 0 value-moving effects.

The active campaign was immediately paused; the other four frozen tasks were
not dispatched. Issue #171 captures the runtime defect: a 300-second app-server
turn wait could extend the nominal 300-second run wall-clock budget because the
generic loop checked time only between turns. The runtime now passes one common
run deadline into every session turn, and Codex app-server bounds thread start,
turn start, and each inbound event wait by the remaining run time. Exact result-
kind/no-result token strata make this failed specimen selection evidence rather
than unstructured logs.

Do not resume this campaign until deadline enforcement and yield strata pass
full qualification. This observation does not yet justify revising structural
selection: the Agent never reached the assigned evidence.

The first post-fix activation preview exposed a second execution-contract gap
before any additional provider work began. Although this plan and the mechanism
selection policy both require one run per exact task/revision lineage, the
mechanism campaign creation path had persisted a selection-bound v2 campaign
without `taskRunPolicy`. The dispatcher therefore still reported all five
tasks dispatchable after the first task's interrupted run, and a second dispatch
would have repeated that task instead of advancing through the frozen specimen.
The campaign was paused again with zero new invocations. Issue #173 now binds
mechanism campaign creation to `ONCE_PER_TASK_PER_LINEAGE`; activation upgrades
an existing selection-bound mechanism v2 specimen through an append-only v3
revision before granting authority. Interrupted, failed, and successful runs
all count as attempts. Resume only after that policy passes full qualification
and the upgraded live preview reports four—not five—dispatchable tasks.

The anonymous corpus refreshed while this hold was being qualified, moving the
current allocator from 24 suitable / 5 selected to 25 / 6. The paused campaign
correctly retains the original five allocation actions and exact issue
revisions. This is positive evidence that a campaign specimen and the current
recommendation set are separate temporal objects; no membership drift occurred.

## Non-goals

- semantic acceptance of a proposed mechanism;
- probability estimation or opportunity certification;
- automatic recurrence or membership evolution;
- external writes, notifications, live execution, or value movement.
