# Persistent research-attention allocation

Status: active mainline construction

Issue: [#104](https://github.com/luokerenx4/my-little-pony/issues/104)

Branch: `codex/research-attention-allocation`

## North-star role

The durable product is not an Agent that periodically emits ideas. It is a
research system that repeatedly spends bounded attention where another unit of
work is most likely to improve our understanding of a tradable semantic or
probabilistic mismatch. Attention allocation therefore sits between retained
research memory and explicit campaigns. It proposes what should run next; it
does not itself authorize a model call.

The allocator must optimize for movement through this evidence ladder:

1. a replayable research attempt or honest abstention;
2. an evidence-bound positive finding or counterexample;
3. an independently reviewed semantic relation;
4. an admitted probabilistic case or exact-state constraint;
5. an economically inspectable opportunity;
6. a calibrated shadow outcome.

Raw proposals, model responses, confidence prose, and graph size are not value.
Negative evidence has value when it prevents rediscovery or falsifies a costly
family, but it must not be confused with downstream opportunity yield.

## Ontology decision

Research attention is a relation between a durable work family, the evidence
state currently known about it, and a bounded future action. It is not a
property of a model and not merely a priority number on a task.

The stable family identity is `workItemId`. Corpus/task revisions, Agent runs,
findings, reviews, probability cases, and opportunities are observations of
that family over time. A future action has a separate content-addressed
identity so that changing evidence or budgets produces a successor allocation
without rewriting history.

## Phase 1 — provider-free family scorecard

Build a content-addressed projection for every current relation-work family.
It must derive, without provider calls:

- current and attempted task revisions;
- terminal, productive-interrupted, and failed run counts;
- known and unknown input/output/reasoning tokens plus wall-clock time;
- accepted/rejected tool effects;
- positive findings, counterexamples, and no-finding attempts;
- independent semantic-review state and classification;
- probability, economic, opportunity, and shadow lineage when present;
- freshness, repeated-input risk, and the reason another attempt would differ.

Unknown usage is explicit and cannot be treated as free. An interrupted run
with accepted findings remains productive; a successful run without an
accepted result does not receive synthetic yield.

## Phase 2 — typed next actions

Classify the next useful action rather than forcing every family back through
relation discovery:

- `EXPLORE_NEW_FAMILY`: no retained attempt exists;
- `RECHECK_CHANGED_EVIDENCE`: the current task revision is unattempted and the
  evidence/cooldown gate explains why replay is non-identical;
- `FALSIFY_RELATION`: a positive finding needs a bounded counterexample search;
- `ADVANCE_RESEARCH_DEBT`: review identified a specific evidence or probability
  gap; relation rediscovery would be waste;
- `EXPAND_REVIEWED_NEIGHBORHOOD`: a reviewed relation justifies a distinct child
  work family, never an untracked rerun;
- `PROPOSE_ONTOLOGY_MUTATION`: the current portfolio is homogeneous or has
  exhausted a family and a materially different search proposition is needed;
- `HOLD`: no bounded action currently has enough novelty or authority.

Only the first two may map directly to an existing relation-discovery task.
Every other action must point at its proper downstream queue or remain a
proposal until that queue exists.

## Phase 3 — bounded portfolio allocation

Produce a deterministic allocation preview with explicit lane budgets instead
of one opaque score. The initial maximum portfolio is eight actions:

- up to four exploration actions;
- up to two falsification or research-debt actions;
- up to one changed-evidence recheck;
- up to one ontology-mutation proposal.

Selection is lexicographic and evidence-based: downstream progress and
falsification value first, then novelty, then known cost and failure burden,
then stable identity. The projection may expose normalized comparison metrics,
but no model-generated confidence may become a scheduling probability.

Unused lane capacity stays unused unless a named spillover rule applies. Raw
proposal count cannot absorb the portfolio. At most one relation-discovery run
may be dispatched concurrently under the current campaign contract.

## Phase 4 — recurrence and anti-loop memory

A stable work family is not permanently exhausted after one attempt, but a new
corpus hash alone is not sufficient reason to spend again. Recheck eligibility
requires all of:

- a successor task revision not already attempted;
- a bounded minimum cooldown;
- a first-party novelty reason such as changed seed evidence, changed
  settlement text, a new venue/listing binding, or a downstream falsifier;
- no unresolved downstream action that would make relation rediscovery
  redundant;
- a per-family recheck cap and visible last-attempt cost.

Counterexamples, abstentions, rejected tool patterns, semantic downgrades, and
unsupported evidence locators form negative memory. Their identity must be
consulted before proposing another action and retained after catalog rotation.

## Phase 5 — persistent campaign gate

The allocator may prepare paused, manual-only campaign proposals. Automatic
recurrence remains false until retained evidence includes at least twelve
terminal relation-discovery runs across four stable families, two independently
reviewed positive findings, qualified cost completeness, and a demonstrated
novelty gate. Reaching those thresholds does not activate recurrence; it only
makes an operator decision meaningful.

Any later scheduler must retain allocation snapshot, campaign, run, result,
cost, and downstream outcome as one auditable chain. Runtime, credential,
model, and model-owned effort remain route configuration and do not define the
research family.

## Phase 6 — operator and learning surfaces

- expose why each action was selected, held, or omitted;
- show budget requested versus consumed and value-stage movement per family;
- notify on new independently reviewed relations, bounded opportunities,
  repeated costly failure, and portfolio exhaustion—not every Agent response;
- compare realized results with the allocation that caused them;
- use later calibration to change lane budgets through versioned policy, not a
  mutable hidden heuristic.

## Qualification gates

- [x] projection reads start zero provider/model calls and mutate no campaign;
- [x] stable family identity survives corpus/task revision rotation;
- [x] current and historical attempts retain exact cost and outcome lineage;
- [x] unknown usage is visible and penalized rather than coerced to zero;
- [x] productive interrupted runs receive finding yield without becoming
  successful runs;
- [x] successful free text without an accepted result receives zero finding
  yield;
- [x] a reviewed semantic downgrade routes to research debt or hold, not
  automatic relation rediscovery;
- [x] the same insufficient locator/task input cannot become an immediate
  recheck;
- [x] portfolio lane caps and deterministic tie-breaking hold under scarcity;
- [x] allocation preview creates zero campaign, run, invocation, external
  write, certificate, order, signature, transaction, or value-moving action;
- [x] full workspace checks, tests, and build pass;
- [x] one live retained-data qualification explains the next action for the
  LAFC specimen without starting a provider request.

## Initial implementation boundary

Implement Phases 1–3 as a provider-free domain projection and read endpoint,
then qualify it against the retained LAFC lineage. Do not add an interval timer
or automatic dispatch in this slice. The first real question is whether the
system can explain what deserves attention and what should be held before it is
allowed to schedule anything.

## Non-goals

- live trading or account credentials;
- currency-denominated ROI before provider pricing is qualified;
- a single scalar reward that hides the evidence ladder;
- model confidence as allocation authority;
- recurring model spend merely because a timer fired;
- treating every negative result as failure or every proposal as progress.

## Live checkpoint — 2026-08-12

The first provider-free projection evaluated two stable relation families. The
attempted LAFC family retains one productive interrupted run, 198,939 input,
1,895 output, and 971 reasoning tokens over 158,159 ms, one positive finding,
one counterexample, and one independent PASS review. Because that review is
`TEXTUAL_RELATEDNESS / ESCALATE`, the allocator proposes
`ADVANCE_RESEARCH_DEBT`, supplies no relation task ID, and explicitly says that
relation rediscovery would duplicate work. The second family has no retained
attempt and is the sole dispatchable `EXPLORE_NEW_FAMILY` action.

This qualification exposed windowed-lineage amnesia before it could become a
scheduling error. The LAFC PASS review was durable in SQLite but had rotated
out of the scheduler's 250-job working window, so the first projection saw only
the finding. Semantic and probability stores now support bounded exact lookup
by proposal identity using retained JSON lineage. Both the allocator and the
relation-discovery projection consume that targeted history; the latter again
reports `CONNECTED / SEMANTICALLY_NOT_ADMITTED` instead of regressing to
`CANDIDATE_READY / AWAITING_SEMANTIC_REVIEW`.

Repeated reads left the retained Agent registry unchanged at 241 runs, 498
model invocations, and 20 historical campaigns. The projection itself reports
zero provider requests, invocations, campaigns, and runs created by read,
automatic dispatch false, and no external/value-moving authority. Recurrence
remains unqualified: only one terminal relation run across one attempted
family exists, despite one independently reviewed positive finding.

Repeated semantic-review jobs for one proposal are reduced to the newest
durable state before classification, admission, recurrence accounting, or
action routing. A duplicate-proposal regression proves that an older textual
downgrade cannot overwrite a newer hard-constraint review merely because of
store return order.

Studio exposes the bounded portfolio under Agent Operations without adding a
dispatch control for downstream debt. Desktop and 390 px mobile visual checks
show a consistent type hierarchy and no horizontal overflow; application
console warnings and errors are zero. `pnpm check && pnpm test && pnpm build`
passes across the workspace: 82 control-plane files / 572 tests and four
Studio files / 24 tests, plus all remaining package suites. The known Node 24
engine expectation on the available Node 22 host and the existing Studio
chunk-size warning remain non-blocking build diagnostics.
