# World-history settlement ontology

Issue: https://github.com/luokerenx4/my-little-pony/issues/249

## Decision context

The state-refreshed Agent boundary is adopted, so long-loop mechanics are no
longer the dominant structural defect. The deeper discovery bottleneck is that
four representations stop at different layers:

- market ontology recognizes separate world, settlement and traded facets but
  gives world predicates only bounded lexical families;
- world-state mechanisms retain causal search routes without canonical
  predicate identities shared by later relation work;
- semantic constraints start from a preselected listing truth table;
- probabilistic semantic arbitrage prices an adverse state only after another
  subsystem has selected its listing scope.

The result is a safe pipeline that can validate a supplied relationship more
readily than it can accumulate a reusable theory of what relationships to seek.

## Ontological position

A prediction-market listing is a venue-defined contingent claim, not a direct
sample of reality's probability. Its settlement rules define a partial
function from evidence-observable world histories to contract outcomes. A
quote is a time-bound traded valuation of that contingent claim. The following
must therefore remain distinct:

1. **World history**: entities, events, states and intervals that may obtain.
2. **World predicate**: a bounded proposition evaluated over a world history.
3. **Settlement projection**: a venue rule mapping evidence about a world
   predicate (and possibly special resolution conventions) to an outcome.
4. **Traded state**: quotes, depth, fees, availability and time observed.
5. **Attention state**: why a claim exists or is salient; potentially useful
   explanatory evidence, but not world truth by default.

An opportunity may arise because related predicates are projected differently,
because settlement functions diverge, because the market valuations violate a
hard constraint, or because valuations exceed an evidence-bound probabilistic
constraint. Title similarity is only a routing signal.

## Mutation thesis

Build a content-addressed, first-party world-history ontology whose unit of
reuse is a typed predicate and its settlement projections, rather than a claim
label or an already-selected listing tuple. Let AI propose and falsify relation
hypotheses through state-scoped tools; let the host bind exact evidence,
identity, state and authority.

This is deliberately not an exhaustive world model. It is a sparse experimental
memory containing only predicates and relations that were useful enough to
search, inspect, test or falsify.

## Core artifacts

### World predicate

`pmh.world-predicate.v1` should carry:

- canonical predicate identity and a bounded operator kind;
- typed subject references, predicate/action/state, interval and parameters;
- polarity and observability posture;
- source listing/evidence bindings and Agent/run lineage;
- ambiguity and explicit counterworld descriptions;
- `SEARCH_HYPOTHESIS_ONLY`, `EVIDENCE_BOUND_PROPOSITION`, or
  `SETTLEMENT_BOUND_PREDICATE` epistemic posture;
- no probability, certificate, execution or value-moving authority.

Initial operator kinds should be intentionally small: occurrence, state
presence, threshold, membership/selection and public action. They describe the
world, not venue resolution quirks.

### Settlement projection

`pmh.settlement-projection.v1` binds one exact listing and outcome space to one
or more world predicates plus rule evidence. It records whether the mapping is
total, partial, ambiguous, voidable or contains venue-specific overrides. Only
first-party validation may mark it exact enough for compiler use.

### Relation experiment

`pmh.world-relation-experiment.v1` is a lifecycle, not a naked label:

- typed relation hypothesis: equivalence, implication, exclusion, temporal
  prerequisite, state-mediated inhibition, common-cause dependence, or
  unresolved association;
- antecedent/consequent predicate identities and temporal alignment;
- adverse world assignments and named latent/premise predicates;
- search neighborhoods, inspected projections and evidence bindings;
- concrete counterworld attempts and outcomes;
- terminal disposition: supported hard, supported probabilistic, falsified,
  exhausted, or unresolved;
- exact run/effect/invocation/token lineage.

`STATE_MEDIATED_INHIBITION` is the intended representation for broad shooting
→ capacity/state → later public act. It must not collapse into mutual exclusion.

## Agent topology

Use the adopted state-refreshed boundary:

1. read a compact ontology frontier selected from lexical trailheads, standing
   mechanisms, negative memory and price divergence;
2. open one predicate/relation hypothesis;
3. search multiple independently named neighborhoods;
4. inspect exact listing and rule evidence selected by the host;
5. declare a concrete counterworld or latent predicate when the relation is not
   hard;
6. record a host-bound test outcome;
7. close into a durable relation experiment or bounded negative memory.

The manifest changes with state. Large structured objects are emitted by tools,
not parsed from final prose. A terminal is never a semantic certificate.

## Compiler bridges

- Hard settlement-bound predicates may deterministically generate the existing
  complete semantic truth table and enter current exact admission unchanged.
- Probabilistic relations may generate adverse state identities for the
  existing probability-bound workflow, but estimator intervals remain separate
  evidence-bearing artifacts.
- Search-only hypotheses can generate neighborhoods and monitoring work but
  cannot change feasible states or probability bounds.
- Existing market ontology, mechanism routes, semantic premises and negative
  experiments are inputs/adapters; this mutation must not rewrite their history.

## Engineering phases

1. Write failing domain tests for predicate identity, settlement projection,
   relation lifecycle, counterworlds and authority separation.
2. Implement immutable artifacts and validation in a focused module.
3. Persist artifacts and experiments in SQLite with restart/replay tests.
4. Build adapters from current ontology nodes and mechanism proposals.
5. Add deterministic hard/probabilistic bridge outputs with fail-closed tests.
6. Add a state-refreshed Agent host and bounded campaign selection.
7. Expose a compact projection in the control-plane and Studio.
8. Run full qualification and a Terra/high live specimen; compare semantic
   yield, structural rejection, calls and token cost to the current exploration
   episodes.

## Selection signals

- The shooting/cola example retains broad shooting, fatal/incapacitating state,
  and later public action as distinct predicates; broad shooting and cola do
  not become a false hard exclusion.
- At least two real listings bind to reusable predicate and settlement
  identities without using title equality as semantic proof.
- One supported/falsified relation experiment survives restart with exact
  evidence, counterworld and token lineage.
- Only admitted hard/probabilistic projections reach their respective existing
  compiler bridges.
- Terra completes one state-refreshed experiment with zero structural
  rejections and either a grounded relation or useful negative memory.

## Failure modes and reversibility

- **Ontology inflation**: cap artifacts per experiment and require evidence or
  negative-memory value for persistence.
- **False precision**: keep textual/causal conjecture distinct from evidence-
  bound and settlement-bound postures.
- **Duplicate ontology**: adapters and shared identities must replace, not sit
  beside, downstream predicate prose before adoption.
- **Token expansion**: checkpoints contain only current sparse state; track
  input per accepted experiment outcome.
- **Schema rigidity**: the host owns fixed artifacts through tools while Agent
  reasoning remains a long loop.

The mutation is reversible because raw venue evidence, existing ontology
snapshots and payoff compilers remain unchanged.

## Authority boundary

Anonymous evidence research, deterministic replay, simulation and shadow
evaluation only. No live orders, credentials, signing, funds, external writes,
or value-moving operations.

## Status

Domain, SQLite persistence, legacy adapters and both compiler bridges are
implemented. The state-refreshed Agent protocol now supports up to eight
independently named corpus neighborhoods, exact evidence inspection, an
Agent-selected complete true/false counterworld assignment, host-bound outcome
recording, bounded terminal dispositions, and post-run injection of exact
run/effect/invocation/token lineage. Focused protocol tests reject stale tools,
incomplete counterworlds and unsupported hard conclusions. Campaign selection,
runtime routing, durable exact input/corpus revisions, post-run materialization,
manual campaign creation and a compact Studio projection are implemented.
Price-only corpus refreshes preserve the semantic input identity, while a new
frontier evidence revision or terminal experiment memory produces a new bounded
experiment input. The live Studio projection currently exposes two untested
common-cause frontiers and four current settlement projections. Retained
projection history is reported separately from the current generation so an
Agent cannot mistake superseded mappings for concurrent truths.

## Active continuation

1. Route durable settlement blocker observations into evidence acquisition and
   measure blocker retirement by new evidence revision.
2. Run a Terra/high world-relation specimen against the current four real
   research-only projections; compare terminal yield, counterworld
   coverage, structural rejection and token cost with mechanism exploration.
3. Feed admitted hard/probabilistic bridges into shadow opportunity construction
   and measure whether they produce new payoff-state candidates rather than only
   ontology artifacts.
4. Generalize venue-policy interpretation from the first conservative
   settlement-discretion pattern into a bounded rule-policy compiler with
   explicit positive and negative fixtures per supported venue dialect.

No user decision blocks this continuation. Subject/alias promotion authority
remains a separate queued policy question; current artifacts retain research
authority only.

The first settlement compiler and durable observation ledger are now active.
On the live Polymarket US frontier they produce four current research-only
projections, two per relation frontier. All four retain
`MISSING_NEGATIVE_RESOLUTION_CLAUSE` and now also carry
`VOID_REFUND_OR_DISCRETION_OVERRIDE`. A newly captured, correctly typed
`VENUE_RULE_DOCUMENT` is bound by venue, protocol and locator identity; its
content-addressed extraction contains the venue-wide pre-settlement review and
final-outcome discretion clauses. The deterministic compiler therefore marks
the mapping `VOIDABLE_OVERRIDE` and includes the venue text hash in each truth
state's rule-evidence lineage. This is stronger negative ontology evidence than
the earlier generic ambiguity: the current official policy itself prevents a
total world-history → contract-outcome mapping.

Live operation also exposed two infrastructure debts and retired both. The
document validator had admitted venue-rule fetch policies but rejected the
resulting role at persistence; it now accepts the bounded role with focused
coverage. A previously exhausted anonymous read can now be explicitly retried
through a control-plane transition without resetting lifetime request usage.
The live CFTC DOCX retry succeeded on attempt four and retained raw document,
extraction and observation lineage. Finally, a successful evidence acquisition
now reconciles world relations immediately rather than waiting for restart, and
the projection API separates four current mappings from twenty-four retained
historical artifacts.

The first Terra/high relation specimen (`b89e2974…`) consumed 12 invocations,
276,021 input tokens and 4,710 output tokens. It produced ten accepted effects
with zero structural rejection: context, a bounded common-cause hypothesis,
three independent searches, search closure, two listing inspections, one
complete counterworld selection and its host-bound outcome. It then hit the
12-invocation ceiling immediately before terminal experiment memory, so it is
an orchestration-budget interruption rather than negative semantic yield. The
immutable execution profile advances to revision 2 with 16 invocations and a
400,000-input-token ceiling; the next specimen must prove that this margin
closes the lifecycle instead of merely expanding exploration.

The revision-2 Terra/high specimen (`7fcbe4bf…`) did close the complete
lifecycle: ten accepted effects, zero rejections, a successful terminal,
190,626 input tokens, 2,635 output tokens and 1,359 reasoning tokens. It then
exposed a first-party materialization defect rather than a model defect.
Multiple listings from one immutable catalog response legitimately shared one
`sourceRawHash`, while the experiment validator requires evidence identities
to be unique. The materializer now deduplicates shared raw evidence and
repeated search neighborhoods, and post-run failure annotations retain the
compact diagnostic instead of only its hash.

That failure also changes the durable boundary. A successful Agent terminal
can no longer exist only inside the live tool-host process. Schema 63 adds a
content-addressed world-relation checkpoint that binds the exact retained
input, frontier revision, corpus snapshot, accepted effect IDs, invocation
IDs, usage, searched neighborhoods, inspected listing refs, complete
counterworld and terminal disposition. The checkpoint is written before
experiment compilation. Reconciliation replays any checkpoint whose
successful run has no materialized experiment, using retained first-party
inputs and projections without another provider request. Focused tests cover
exact replay equivalence, mismatched-input rejection, durable restart and the
requirement that both the exact input and a successful run already exist.

The next live specimen must prove both layers together: successful terminal →
durable checkpoint → materialized experiment, followed by a process restart
that leaves the artifact idempotently recoverable. After that evidence, the
active continuation moves from lifecycle durability to shadow opportunity
construction from supported probabilistic relations.

Live qualification now satisfies that gate. Terra/high run `1fa6115b…`
completed the Alaska Republican Senate seat ↔ national Republican Senate
control frontier with ten accepted effects and zero rejections. It consumed
199,996 input, 2,147 output and 691 reasoning tokens, retained checkpoint
`b1230ea5…`, and materialized experiment `2b9b7a0a…` as
`SUPPORTED_PROBABILISTIC`. The adverse `Alaska Republican seat = true /
national Republican control = false` world survives because the national
contract settles from the aggregate qualifying-seat count and tie rules. This
is useful soft dependence, not manufactured implication or hard exclusion.
Two inspected listings shared one catalog-response hash; the evidence binding
was correctly deduplicated to one immutable raw identity. After a real
control-plane stop and fresh process startup, retained experiment count stayed
one and the artifact hash, disposition and full token lineage were unchanged.

Lifecycle durability is therefore qualified. The next engineering phase is to
compile supported probabilistic relation experiments into explicit shadow
trade hypotheses: map traded outcome legs to the adverse-state probability
bound, retain quote-time and settlement-policy uncertainty separately, and
measure whether the implied interval can dominate executable cost without
calling the result strict arbitrage.

The first shadow compiler is now active. For each supported probabilistic
experiment it projects the adverse world into listing truth, buys the
per-listing complement of that adverse state, and computes the indicative
failure budget with bigint rational fixed-point arithmetic. It never invents
an adverse probability upper bound: `ε` remains a separate estimator artifact.
It also retains quote posture (`indicative`, zero fee, zero depth), exact-input
lineage, settlement admission and authority denial. The live Alaska specimen
produces `Alaska NO + national Republican control YES`; at retained prices
`0.54 + 0.507 = 1.047`, so its zero-fee gross failure budget is `-0.047` and
break-even `ε` is zero. The projection is additionally blocked by non-exact
venue settlement mapping and missing probability bound. This negative
economic screen is useful: it prevents spending estimator tokens on a semantic
relation whose current complement portfolio has no indicative margin even
before fees and depth.

The next continuation should distinguish blocker priority in the scheduler:
retire non-positive indicative margin immediately; route positive-margin but
non-exact mappings to settlement evidence; and only route positive-margin,
exact-mapped hypotheses to adverse-probability estimation. Then bind fresh
book asks and depth before calling any result a bounded shadow candidate.

The deterministic attention router now enforces that ordering. It ranks only
exact, positive-margin hypotheses for adverse-probability estimation; positive
margin with settlement debt routes to evidence acquisition; non-positive
indicative failure budget retires before either expensive path; unsupported
shapes remain held research memory. Projection reads create no jobs and start
no provider requests. The live Alaska hypothesis is therefore
`RETIRE_NON_POSITIVE_MARGIN`, even though it also has settlement and probability
debt: fixing those cannot rescue a complement portfolio already priced above
its minimum non-adverse payout. The next search generation should use this
negative economic memory to favor relation neighborhoods whose complement-leg
prices leave a positive failure budget, while preserving semantic novelty so
the system does not collapse back into claim-first popularity search.
