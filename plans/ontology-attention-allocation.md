# Ontology research attention allocation

Status: active mainline construction

Issue: [#114](https://github.com/luokerenx4/my-little-pony/issues/114)

Branch: `codex/ontology-attention-allocation`

## North-star role

Stable ontology issue tasks preserve research memory, but they do not decide
where the next unit of AI attention creates value. The current three-task
campaign selector ranks by lane and relation-pattern hash. It therefore spends
inside a lane in effectively arbitrary order and cannot explain why one
heuristic relation deserves a costly Agent loop before another.

The live successor inventory contains 77 stable issues and 109 retained
trailheads. Twenty-four trailheads share only one lexical signal and twelve use
an aggregate outcome-list title. This pool mixes valuable non-obvious semantic
relations with obvious name collisions. Hard exclusion would make the system
conservative and popular-market seeking; uniform spend would make persistence
economically brittle.

## Ontology decision

Ontology research attention is a versioned relation among:

1. a stable issue contract;
2. its exact current ontology/corpus/trailhead input revision;
3. structural search evidence and ambiguity posture;
4. retained AI attempts, accepted proposals/counterexamples, and cost;
5. downstream relation, review, probability, economics, opportunity, and
   shadow movement;
6. one bounded proposed next action.

Structural ambiguity is a search stratum, never semantic authority. A single
shared token or aggregate title can lower exploitation priority while remaining
eligible for a bounded ambiguity probe. An AI counterexample is useful negative
memory, not proof that every future input in the family is worthless.

## Phase 1 — provider-free issue scorecards

- [x] Bind every newly prepared stable ontology/relation task run to the exact input
  revision selected at preparation time. Persist this as a first-party run
  annotation in the same batch as the run, so failed/no-finding attempts remain
  attributable after later input rotation.
- [x] Derive one content-addressed scorecard per current stable issue.
- [x] Retain exact current revision, revision count, lane, trailhead count, maximum
  heuristic score, shared-signal distribution, and aggregate-title posture.
- [x] Attribute runs and model invocations through stable task provenance, with
  known/unknown input, output, reasoning tokens and wall-clock time.
- [x] Attribute accepted entity/world proposals and counterexamples to their
  originating issue, then connect any relation-work and review lineage.
- [x] Distinguish unattempted, negative-memory, positive-proposal, downstream-work,
  reviewed, and exhausted states without a scalar model confidence.

## Phase 2 — typed next actions

Each issue now proposes exactly one of:

- `EXPLOIT_EVIDENCE_RICH_ISSUE` — unattempted, multiple grounded signals, no
  aggregate-title warning;
- `PROBE_AMBIGUOUS_ISSUE` — unattempted single-signal or aggregate-title work,
  bounded so it cannot consume the portfolio;
- `RECHECK_CHANGED_INPUT` — a prior attempt exists and a named material input
  change makes another run non-identical;
- `ADVANCE_DOWNSTREAM` — a proposal already produced relation work or review;
- `HOLD_NEGATIVE_MEMORY` — retained counterexample/abstention and no bounded
  novelty;
- `HOLD_NO_NOVELTY` — attempted work has no named useful successor action.

Only the first three may point at an ontology Agent task. Downstream and hold
actions cannot be silently translated into another normalization run.

## Phase 3 — bounded portfolio

The first implementation builds a deterministic maximum-four action portfolio:

- up to two evidence-rich exploitation issues;
- up to one ambiguity probe;
- up to one changed-input recheck;
- preserve lane diversity when it does not displace the explicit caps;
- compare downstream yield first, then input novelty, ambiguity posture,
  known/unknown cost burden, heuristic score, and stable identity;
- leave capacity unused when no issue satisfies its lane.

The portfolio is a proposal only. It creates no campaign, run, invocation,
provider request, external write, or execution authority.

## Phase 4 — campaign binding and recurrence

- [x] Replace hash-order campaign selection with the selected dispatchable
  portfolio actions and retain allocation identity in campaign provenance.
- [x] Bind each selected action, stable issue/task, exact input revision, full
  input hash, and purpose-specific semantic input identity inside the immutable
  campaign before activation. Resolve payload, first-party tool host, and run
  annotation from that same retained binding after catalog rotation.
- [ ] Project allocation → campaign → run → proposal/counterexample → relation work
  → review/probability/opportunity outcome as one auditable chain.
- [ ] Add an explicit recurring policy only after live scorecards show enough
  terminal attempts to estimate yield/cost by stratum.
- [ ] Recurrence must use a configured interval, maximum concurrent runs, token and
  wall-clock budgets, per-issue cooldown/recheck caps, and a global pause.
- [ ] New catalog observations alone do not authorize repeat spend.

## Phase 5 — notification and operator surface

- Show why each issue was selected, held, or omitted.
- Separate evidence-rich exploitation, ambiguity probes, and changed-input
  rechecks in Studio.
- Notify on new accepted ontology proposals, useful counterexamples, downstream
  reviewed relations, repeated costly no-yield work, and portfolio exhaustion;
  do not notify on every model response.
- Show spend and stage movement by stable issue and allocation generation.

## Qualification gates

- [x] every new stable-task run retains exactly one resolvable input-revision
  annotation before model execution;
- [x] repeated projection over identical retained state is byte-identical;
- [x] structural ambiguity never becomes semantic decision authority;
- [x] single-signal and aggregate-title work remains eligible only in a bounded
  ambiguity lane;
- [x] issue attempts and cost survive input revision rotation;
- [x] accepted proposals/counterexamples and downstream relation work are
  attributed to the correct stable issue;
- [x] attempted issues do not rerun without a named material novelty reason;
- [x] portfolio caps and tie-breaking are deterministic;
- [x] campaign preview follows allocation rather than relation-pattern hash;
- [x] projection creates zero providers, invocations, runs, campaigns,
  dispatches, external writes, or value-moving actions;
- [x] live retained-data qualification explains all selected and held actions;
- [x] workspace check, all tests, and production build pass.

## Current implementation boundary

Phases 1–3 and immutable campaign input binding are complete. Keep ontology
campaigns manual-only while the next slice projects realized allocation outcomes
and gathers enough exact terminal attempts to estimate yield and cost by
stratum. Do not infer recurrence merely because the generic dispatcher supports
an interval schedule.

## Live checkpoint — 2026-08-12

The provider-free allocator evaluated 64 current live issues. It classified 61
as actionable and three as held, then selected exactly two evidence-rich tasks,
one ambiguity probe, and no recheck. The evidence-rich specimens are a
cross-venue NASCAR champion contract family and the world-divergence relation
between Lula winning Brazil's 2026 presidential election and leaving office in
2026. The bounded ambiguity specimen is Formula 1 Ferrari versus `Patins da
Ferrari`: likely polysemy, but deliberately retained as one falsification probe
rather than silently deleted or allowed to consume the portfolio.

The other scorecards explain 44 unattempted evidence-rich issues, seventeen
unattempted ambiguity issues, one issue already routed downstream, and two
historical attempts held because their pre-binding runs cannot prove which
input revision they consumed. No elapsed-time or snapshot-only rule turns those
two into rechecks. Purpose-specific input identity ignores receive time, raw
transport hashes, status, and quotes while retaining titles, descriptions,
rules, outcome semantics, locators, world/settlement facets, mechanism, scales,
and ticks.

Campaign preview consumes the three allocation actions rather than hash order.
Repeated live reads left 241 runs, 498 model invocations, 20 campaigns, and
known 2,068,225 / 19,328 / 4,904 input/output/reasoning tokens unchanged. The
allocator itself reports zero providers, invocations, runs, campaigns, and
automatic dispatch. The SQLite ledger currently contains no new annotation
because no Agent was dispatched; all future ontology and relation runs will
persist their exact input binding before runtime execution.

Workspace checks pass. All control-plane suites pass (85 files / 593 tests),
Studio passes (four files / 24 tests), and production build passes on the
available Node 22 host with the expected Node 24 engine warning and existing
Studio chunk-size warning.

## Campaign-binding checkpoint — 2026-08-12

Agent campaign v2 now retains one generic, content-addressed selection binding.
For ontology attention it records the allocation and policy identities plus,
for every selected action, the stable issue/task, action kind, exact retained
revision, full task-input hash, and purpose-specific semantic input identity.
Paused → active revisions preserve that body unchanged. Campaign execution
resolves its payload, tool host, and pre-execution run annotation from the exact
bound revision; manual runs still resolve the current revision. Historical v1
campaigns remain replayable, but an old ontology campaign cannot claim a bound
input and is rejected if someone tries to dispatch it.

The live 64-issue allocation produced a three-task v2 campaign specimen:
two evidence-rich actions and one ambiguity probe. It remains `PAUSED` and
`MANUAL_ONLY`. A process restart replayed the complete binding byte-for-byte
from SQLite. Campaign count moved 20 → 21 while runs stayed 241, invocations
stayed 498, and known input/output/reasoning tokens stayed
2,068,225 / 19,328 / 4,904. Campaign creation and replay started zero model or
provider requests. Workspace checks, all control-plane suites (85 files / 595
tests), Studio suites (four files / 24 tests), and the production build pass;
the existing Node 24 engine and Studio chunk-size warnings remain.

## Non-goals

- treating lexical quality as truth or deleting ambiguous candidates;
- claim-first enumeration of popular market topics;
- model confidence as a scheduling probability;
- recurrence merely because a timer fired;
- automatic acceptance of entity/world proposals;
- live trading, credentials, signatures, transactions, or funds.
