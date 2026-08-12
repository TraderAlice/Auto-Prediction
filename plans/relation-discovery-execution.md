# Relation-discovery execution and downstream lineage

Status: active mainline construction

Issue: [#102](https://github.com/luokerenx4/my-little-pony/issues/102)

Branch: `codex/relation-work-lineage`

## North-star role

The product creates value when a bounded unit of AI attention turns an unusual
semantic seed into a replayable finding, survives independent semantic and
probability challenge, and reaches an economically inspectable opportunity.
Ontology graph size, proposal count, and model activity are intermediate
inventory—not success metrics.

PR #101 established stable relation-neighborhood work. This plan makes that
work executable without letting an Agent collapse search, semantic decision,
probability estimation, and opportunity promotion into one opaque response.

## Ontology and authority decision

A prediction-market contract is an observed traded payoff whose settlement is
defined by venue rules and whose wording gestures at one or more world
propositions. A relation-discovery Agent searches possible correspondences and
constraints among those three layers. Its output is a *finding*: evidence that
a particular relation deserves independent review. It is not the relation
itself, a probability estimate, or an arbitrage certificate.

The pipeline therefore remains:

`ontology seed → relation work → Agent finding → semantic review → probability
case / exact-state analysis → economics → opportunity → shadow outcome`.

Negative findings and abstentions are retained because they measure search
cost, prevent automatic rediscovery loops, and improve later attention
allocation.

## Stable identity chain

- `workItemId` is stable across added source proposals and catalog rotation.
- `taskId` binds one work artifact to one exact corpus snapshot and task
  protocol revision.
- `runId` binds runtime, credential profile, model plus model-owned effort,
  budget, and authorization.
- `findingId` binds the accepted tool input to work, task, run, corpus, exact
  listing evidence, relation kind, and falsifiers.
- downstream proposal/review/probability/opportunity artifacts must embed a
  content-addressed origin object rather than reconstructing it from a bounded
  UI projection later.

No identity is based on free-text final output or one mutable latest-task join.

## Phase 1 — provider-neutral executable work

- add `RELATION_DISCOVERY` as an Agent task kind;
- materialize replayable task revisions from runnable relation work and the
  exact current corpus snapshot;
- preserve blocked and negative-memory work in the read projection without
  creating runnable tasks;
- add a dedicated Codex-app-server execution profile and workload route while
  retaining runtime/credential/model/effort separation;
- reconcile tasks only; do not create a campaign or run on read/startup.

## Phase 2 — tool-first finding protocol

First-party tools own every externally meaningful effect:

1. read the assigned work contract;
2. search the exact assigned anonymous catalog using bounded literal terms;
3. inspect exact listing evidence before use;
4. record a positive relation hypothesis using only an allowed candidate
   relation kind and two to eight inspected listings;
5. record a counterexample or no-relation result as negative evidence.

The tool host retains complete content-addressed findings in SQLite. Agent free
text has no result authority. Tool calls are idempotent, scope-checked, and
bounded; rejected calls remain execution evidence but do not create findings.

## Phase 3 — explicit campaign and measurable yield

- expose provider-free work, finding, and campaign-preview resources;
- select a small differentiated work portfolio, de-duplicated by stable work
  identity rather than latest task ID;
- require a fresh capability preflight and explicit operator activation before
  any run;
- retain input/output/reasoning tokens, wall-clock time, accepted/rejected tool
  effects, positive findings, counterexamples, and no-finding completions per
  work item;
- keep automatic dispatch off until reviewed yield justifies recurring spend.

## Phase 4 — semantic-review bridge

- compile each accepted positive finding into the existing
  `MarketRelationProposal` contract plus an exact proposal evidence bundle;
- embed a first-party `RelationDiscoveryOrigin` containing work, task, run,
  finding, and corpus identities;
- admit through the existing semantic scheduler; never mark the Agent's
  relation as reviewed merely because the finding tool accepted it;
- counterexamples and incomplete findings remain negative research memory and
  cannot enter review automatically.

## Phase 5 — probability and opportunity lineage

- carry the immutable origin into semantic constraints and the existing
  `ProbabilitySearchOrigin` rather than inventing a parallel probability lane;
- preserve origin through probability bounds, calibration observations,
  economic analyses, lifecycle cases, and shadow outcomes;
- expose `work → finding → reviewed relation → bound/certificate → opportunity`
  coverage with explicit missing-stage reasons;
- never classify bounded-risk semantic arbitrage as hard arbitrage.

## Phase 6 — persistent attention allocation

Only after phases 1–5 produce real observations, rank recurring work families
by reviewed findings, economically inspectable opportunities, falsification
value, calibration quality, token cost, and wall-clock cost. Allocate a bounded
portfolio across exploration, exploitation, negative-memory rechecks, and
deliberate ontology mutations. Raw proposal volume must not win the allocator.

## Qualification gates

- [x] task identity changes with corpus evidence but stable work identity does
  not;
- [x] unrelated work cannot share a finding through a common Agent run;
- [x] uninspected listings, disallowed relations, and one-listing relations are
  rejected by first-party tools;
- [x] equivalent effect submissions are idempotent;
- [x] complete findings replay byte-for-byte after SQLite restart;
- [x] read, reconciliation, and campaign preview start zero provider requests;
- [x] no campaign or run exists without explicit authorization;
- [x] positive findings enter semantic review with immutable origin and remain
  unreviewed until the independent reviewer passes;
- [x] counterexamples remain negative memory;
- [x] probability and opportunity artifacts expose the same origin or an
  explicit not-yet-connected state;
- [x] full workspace checks, tests, build, and live anonymous qualification
  pass.

## Initial implementation boundary

The first commit covers phases 1–2 and provider-free projections. It is useful
without spending tokens: it proves whether the new unit of work and finding
contract can coexist with the execution substrate. Phase 3 may then run one
explicit Terra/high qualification against retained work. Phases 4–6 follow on
the same branch/issue only while each boundary stays independently replayable.

## Non-goals

- automatic model spend during construction;
- accepting ontology normalization as a cross-contract relation;
- allowing a model to publish semantic truth, probability, or certificates;
- production venue credentials, orders, signing, approvals, transactions,
  funds, or live execution.

## Live checkpoint — 2026-08-12

SQLite schema 40 now retains content-addressed relation-discovery corpora, task
revisions, and complete findings. The live 4,706-listing desk materialized two
tasks from the two retained Terra ontology seeds. A second startup refresh
changed the anonymous corpus snapshot and correctly produced two successor
task revisions while preserving both stable work IDs. This is catalog evidence
rotation, not two new research questions; later campaign selection must
de-duplicate on work identity.

Across both starts the ledger retained zero relation-discovery runs, zero model
invocations, zero findings, and zero tokens. The read projection itself reports
zero provider/model calls and automatic dispatch false. Focused tests prove
scope rejection, idempotent positive findings, negative counterexample memory,
and byte-for-byte corpus/task/run/finding replay across SQLite reopen.

The first explicit Terra/high campaign then searched the LAFC neighborhood. It
used eight model responses, 198,939 input tokens, 1,895 output tokens, and 971
reasoning tokens; one malformed catalog search was first-party rejected and
repaired. The Agent inspected exact Gemini and Polymarket US rules, retained a
`CONDITIONAL` hypothesis for the ordinary single-winner completion path, and a
counterexample rejecting unconditional `EQUIVALENT` because Polymarket US has
cancellation/non-rescheduling and multiple-winner settlement branches absent
from Gemini's binary rule. Both findings bind exact listing evidence and remain
unreviewed.

The final positive effect arrived on response eight, leaving no response budget
for a terminal turn; the run is truthfully `INTERRUPTED` with two useful
findings. This is a budget defect, not a reason to rewrite run status. The next
execution profile allows twelve responses, 300,000 input tokens, 30,000 output
tokens, and 32 tool calls. Yield separately counts finding-bearing interrupted
runs so partial long-loop value is visible.

The positive finding now compiles deterministically into the existing
`MarketRelationProposal` and durable exact-evidence bundle contracts. Its
content-addressed `RelationDiscoveryOrigin` binds the ontology proposal and
issue lineage, relation work artifact, task revision, Agent run, finding, and
retained corpus. The real LAFC finding produced exactly one priority-3
semantic-review job in `PENDING`; the counterexample produced none. Reconcile
added no model invocation and did not change the retained eight-response usage.

Live qualification also exposed an unrelated scheduler defect that would have
made persistent discovery illusory: 470 durable semantic jobs existed, while a
250-record in-memory history window sorted only by priority. The new job was
correctly durable yet absent from the working set. Active and terminal retention
are now separate: every non-terminal job is retained ahead of a bounded terminal
history, durable startup loads enough records to recover that set, and SQLite
orders active work first. After restart, the relation job is visible and
schedulable with complete origin and evidence.

One explicit Codex OAuth `gpt-5.6-terra`/high semantic review then completed in
about two minutes through the existing Vercel AI SDK reviewer. It concluded
`RELATED / TEXTUAL_RELATEDNESS`, recommended `ESCALATE`, and therefore did not
admit the finding to probability estimation. That is the desired gate, not a
failed yield: the reviewer retained the multiple-winner payout counterexample
and identified the missing ordinary sole-winner Polymarket US payout mapping
and resolution authority. The relation projection now distinguishes
`AWAITING_SEMANTIC_REVIEW`, `SEMANTICALLY_NOT_ADMITTED`, `CANDIDATE_READY`, and
`CONNECTED` instead of reporting one ambiguous not-connected state.

The review emitted a content-addressed `OUTCOME_MAPPING` evidence requirement
against the exact Polymarket US listing locator. An explicit anonymous capture
returned HTTP 200 and retained observation, document, and extraction hashes;
the Rule Evidence interpreter now has a pending provider-neutral job for that
same requirement. This demonstrates a closed research-debt handoff:
`finding → review → missing evidence → anonymous capture → interpretation
task`, even though this specimen correctly stopped before probability.

`ProbabilitySearchOrigin` now has a relation-discovery v2 form that embeds the
full origin(s) and leaves legacy semantic families explicitly empty. Relation
origin identity participates in probability-case identity, so a different
research lineage creates a successor case rather than rewriting an old
estimate. Existing semantic-family origins remain byte-compatible v1.

The first Rule Evidence Agent qualification exposed a terminal-authority bug:
Codex app-server could finish with diagnostic free text after a rejected tool
call and the generic runtime would label the run successful. App-server final
text is now explicitly `DIAGNOSTIC_ONLY`; success requires an accepted
workload-specific result tool. Rejected effects use an additive v2 record with
a bounded diagnostic while legacy migration reproduces byte-identical v1
effects. Execution-profile revisions preserve the old observations rather than
rewriting them.

The real failing tool call requested `start=0,length=12000` against a 653-byte
document. The first-party read tool originally rejected the safe intent because
its response cap was 4,000 characters. It now accepts a large bounded request,
returns at most 4,000 characters, and reports truncation. This changed the real
run from two false-success/failed attempts into a truthful success: four Terra
responses produced two accepted reads and one accepted
`submit_rule_evidence_claim` effect. A later materialization qualification used
five responses, retained three accepted effects plus one rejected out-of-range
continuation, and persisted the submitted conclusion as a first-class
`AGENT_RUNTIME` Rule Evidence claim. The pre-existing provider-shaped evidence
job closes by business lineage without pretending that its interpreter identity
matches the Agent runtime.

That claim classified the 653-byte listing text as `SUPPORTS`. Its exact quote
was genuine, but its rationale overreached: elimination-at-zero and
multiple-winner division do not expressly supply the ordinary sole-winner
affirmative mapping or controlling resolution authority. An independent
Terra/high semantic review correctly rejected that inference, retained the
claim as advisory evidence, and again concluded
`RELATED / TEXTUAL_RELATEDNESS / ESCALATE`. The scheduler now recognizes
enriched v5 reports, so the relation lineage is durably `CONNECTED` to the
review while probability is explicitly `SEMANTICALLY_NOT_ADMITTED` and the
opportunity stage remains `NOT_YET_CONNECTED`.

The successor resolution-rule requirement initially pointed back to the exact
market locator whose captured bytes had just failed review. A first-party
evidence-novelty gate now excludes locators already represented by claims in
the review that re-emitted the gap. With no unused locator, the real requirement
became `UNSUPPORTED` and entered bounded official-source discovery across
Polymarket US docs, gateway, and CFTC surfaces instead of recapturing the same
document. Its first explicit run made four provider requests and three tool
calls, retained no candidate, and ended `ABSTAINED`; this is negative search
evidence, not proof that no governing rule exists.
