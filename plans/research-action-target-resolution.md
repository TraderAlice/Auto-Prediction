# Exact downstream research-action targets

Status: active mainline construction

Issue: [#106](https://github.com/luokerenx4/my-little-pony/issues/106)

Branch: `codex/research-action-targets`

## Product problem

The attention allocator selects the next useful kind of work, but an allocation
action is not yet a runnable or honestly blocked research object. The first live
LAFC action says `ADVANCE_RESEARCH_DEBT` and points at a semantic-review job.
Its durable lineage is more specific: one proposal has one current
`RESOLUTION_RULE` requirement, the route is unsupported, and the matching
official-source Agent already abstained after four provider requests and three
tool calls. Repeating that task would spend on retained negative evidence.

Persistent AI research needs a compiler between attention and execution. It
must resolve a selected action into the exact downstream object and current
state, or state why no non-duplicate action exists. A typed attention proposal
must never be interpreted as generic permission to invoke an Agent.

## Ontology decision

A research-action target is a content-addressed relation among:

- one selected attention action and stable work family;
- the proposal and newest independent review produced from that family;
- an exact active evidence requirement or provider-neutral discovery task;
- the newest matching downstream job and its retained attempts/outcome;
- a bounded manual operation, or the novelty condition required to reopen work.

The target is not the requirement, scheduler job, or model route itself. Those
objects may rotate independently. The target records their current composition
without rewriting any source artifact.

## State machine

The first-party resolver distinguishes:

- `READY_RELATION_DISCOVERY`: the selected exploration task has no retained run;
- `READY_OFFICIAL_SOURCE_DISCOVERY`: unsupported source debt has a genuinely
  new pending/retryable source-discovery job;
- `OFFICIAL_SOURCE_DISCOVERY_IN_FLIGHT`;
- `BLOCKED_BY_NEGATIVE_SOURCE_SEARCH`: the same source task ended in abstention,
  no-source, or exhaustion and no successor novelty exists;
- `READY_EVIDENCE_ACQUISITION`: a document or market-data requirement has a
  pending/retryable/stale acquisition job;
- `EVIDENCE_ACQUISITION_IN_FLIGHT`;
- `READY_RULE_INTERPRETATION`: source capture exists and interpretation has not
  produced a terminal claim;
- `RULE_INTERPRETATION_IN_FLIGHT`;
- `REVIEW_REENTRY_READY`: a terminal claim exists and independent review is the
  proper successor;
- `REQUIREMENT_SATISFIED`: the active lineage already contains a later admitted
  state and should not be scheduled again;
- `NEEDS_BOUNDED_REQUIREMENT`: a review opened debt but retained no structured
  requirement;
- `HOLD`: no exact useful successor can be proven.

Every target names its downstream system, exact artifact references, whether a
manual operation currently exists, and the first-party novelty gate for any
blocked retry. Terminal negative source search may reopen only when task
identity changes because of a new allowed official surface, changed requirement
scope, changed venue protocol, or explicit operator-supplied source evidence.
Elapsed time and a new projection read are never novelty.

## Construction

### Phase 1 — provider-free target compiler

- Resolve each selected portfolio action through relation proposal
  compilations and the newest semantic review per proposal.
- Join active and retained evidence requirements by identity and proposal.
- Join newest official-source, acquisition, and interpretation jobs without
  relying on compact Studio windows or array order.
- Retain exact attempt counts, provider/fetch/tool cost, terminal diagnostics,
  and negative outcomes in the target.
- Bound targets per action and make truncation explicit.

### Phase 2 — read and operator surface

- Add a read-only endpoint whose projection starts no provider request, fetch,
  Agent run, campaign, or scheduler dispatch.
- Attach target state to the Agent Operations portfolio so `READY`, `IN FLIGHT`,
  and `BLOCKED` cannot be confused.
- Do not add a generic “run debt” control. A later control may dispatch only the
  named current downstream job after its own capability and budget check.

### Phase 3 — live negative-memory qualification

- LAFC resolves to proposal `fa6e…`, requirement `c79d…`, and its terminal
  official-source job.
- It reports `BLOCKED_BY_NEGATIVE_SOURCE_SEARCH`, preserves one attempt / four
  provider requests / three tool calls, and exposes a named novelty condition.
- Repeated reads leave the Agent, campaign, provider, acquisition, and value
  ledgers unchanged.
- A synthetic successor task proves that real novelty can move the same family
  back to a ready state without deleting the abstention.

## Qualification gates

- [x] every selected attention action has at least one exact target or an
  explicit bounded unresolved target;
- [x] latest-job selection is independent of store return order;
- [x] active requirements are not confused with historical rotated debt;
- [x] terminal negative source work defaults to hold;
- [x] only a changed downstream task identity can reopen terminal source debt;
- [x] document acquisition and rule interpretation states route to their own
  queues instead of back to relation discovery;
- [x] projection reads cause zero provider, model, fetch, campaign, run,
  scheduler, external-write, certificate, or value-moving effects;
- [x] live LAFC target retains exact negative-search cost and refuses duplicate
  dispatch;
- [x] Studio desktop and 390 px checks have no horizontal overflow or
  application console errors;
- [x] full workspace checks, tests, and build pass.

## Non-goals

- automatic recurrence or generic downstream dispatch;
- inferring that one requirement semantically satisfies another;
- treating an Agent abstention as permanent proof that no source exists;
- model confidence as retry authority;
- live trading, account credentials, or value-moving operations.

## Live checkpoint — 2026-08-12

The retained two-action portfolio now compiles to exactly two targets. The
unattempted family is `READY_RELATION_DISCOVERY` with its provider-neutral task
identity. LAFC resolves through proposal `fa6e…`, newest semantic job `b449…`,
and current rebased `RESOLUTION_RULE` requirement `c79d…` to official-source
job `e610…`. That job is `ABSTAINED`; the target is therefore
`BLOCKED_BY_NEGATIVE_SOURCE_SEARCH`, exposes no manual operation, retains four
provider requests and three tool calls, and requires a
`NEW_OFFICIAL_SOURCE_TASK_IDENTITY` before reopening.

The first live pass also exposed a historical-debt false positive. A captured
and interpreted `OUTCOME_MAPPING` from the prior review generation initially
appeared as another current target. The compiler now reads the exact newest
semantic review record, matches its structured requirement intent to the
current rebased requirement identity, and excludes older requirements from
action supply without deleting them. Exact SQLite lookups by review and
requirement identity keep semantic, official-source, acquisition, and
interpretation lineage independent of scheduler display windows.

Before and after target reads remained identical at 241 Agent runs, 498 model
invocations, 20 campaigns, and 2,068,225 / 19,328 / 4,904 retained
input/output/reasoning tokens. The projection reports zero provider, model,
fetch, campaign, run, or scheduler-dispatch effects. Desktop and 390 px Studio
inspection found no horizontal overflow or application console issue and makes
the held operation plus retained 4/3 cost visible.

`pnpm check && pnpm test && pnpm build` passes across the workspace: 83
control-plane files / 578 tests and four Studio files / 24 tests, plus all
remaining suites. The repository's known Node 24 engine expectation on this
Node 22 host and existing Studio chunk-size warning remain non-blocking build
diagnostics.
