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

1. Persist the now-negative Iowa complement construction as exact economic
   memory and make the next ontology frontier observe it without letting price
   become semantic truth or a popularity oracle.
2. Add freshness-aware targeted quote refresh for retained Gemini legs. Broad
   catalog absence must remain distinct from an inactive event, a missing
   instrument, a zero price and a stale exact quote.
3. Use that negative memory to seek a semantically distinct relation whose
   fresh complement asks leave positive failure budget before spending on
   settlement completion or probability estimation.
4. Generalize official entity-role acquisition beyond the Iowa-specific
   adapter only when a new positive-margin construction actually requires it.

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

The next input revision will bind that economic result as terminal research
memory rather than use price as a semantic ranking oracle. A retained memory
names the exact experiment, shadow hypothesis, adverse listing state, cost,
failure budget, blockers and deterministic route. The Agent may see that an
adverse state was already semantically interesting but economically retired;
the first-party tool host will reject selecting the identical retired adverse
state again unless a future input carries genuinely revised semantic evidence.
Price-only refreshes remain semantically deduplicated. This preserves the
ontology-first search direction while preventing repeated token spend on an
already falsified economic construction.

That boundary is now implemented as two ledgers. The durable Agent input binds
a stable economic memory compiled from the experiment's retained quote corpus;
the tool host exposes it in context and rejects an identical already-projected
adverse world. The read projection independently reprices the same semantic
experiment against the current listing-ref-matched corpus, so a price move can
change margin routing without manufacturing a new ontology fact or provider
request. Live qualification also found and retired an operational scaling
failure: four stale `tsx watch` supervisors were contending for port 4100, and
the world-relation endpoint reparsed every retained exact input on every read.
After restoring a single control-plane process and replacing the history scan
with indexed checkpoint → input lookups plus SQL count, three live reads fell
from 8–15 seconds to 0.53–0.54 seconds. The historical input count may grow,
but projection latency no longer grows linearly with it.

The first Iowa frontier specimen now supplies a differentiated second live
observation. Run `53e03c3d…` completed in nine accepted effects with zero
rejections, using 190,793 input, 3,081 output and 1,614 reasoning tokens. It
inspected six Gemini Iowa-winner and national-Senate-control contracts, selected
the complete `FFT` adverse world, and retained `SUPPORTED_PROBABILISTIC`: a
Democratic Iowa winner can coexist with failure to control the national Senate.
Unlike Alaska, the result cannot yet form any shadow legs because none of the
six inspected Gemini listings has a retained settlement projection. This is
not unsupported arity and not negative economics. The router now records
`INSPECTED_LISTINGS_LACK_SETTLEMENT_PROJECTIONS` and emits
`ACQUIRE_PROJECTION_COVERAGE`, ahead of settlement exactness and probability
estimation but after margin retirement. The next construction should compile
those exact inspected Gemini contracts into research-only settlement
projections from retained contract text, then re-run economics without another
relation Agent request.

That projection-coverage continuation is now compiled provider-free from the
exact retained Agent checkpoint and corpus. It only binds an inspected listing
when the frontier subject and every normalized event anchor occur in the
contract text; it explicitly separates opposing-party contracts from candidate
contracts whose party role still needs external evidence. The live Iowa replay
therefore recovers the Gemini national Democratic-control contract as one
research-only semantic leg, rejects the Republican counterpart as an opposing
subject, and records four Iowa candidate contracts as
`ENTITY_ROLE_EVIDENCE_REQUIRED`. It does not infer party membership from a
candidate name or model memory. The resulting one-leg `F` projection preserves
the semantic construction even when the current catalog temporarily omits the
Gemini listing; current price becomes unavailable rather than deleting the
historical leg. The router remains `ACQUIRE_PROJECTION_COVERAGE`, now with an
explicit incomplete-coverage blocker instead of generic arity.

Live startup also exposed two replay invariants and one read-model distinction.
Content-identical predicates/projections reconstructed by multiple retained
experiments must be deduplicated before batch persistence. A partially covered
shadow may legitimately have one listing leg. Finally, retained semantic
coverage is durable history, not a current-catalog projection: it may reprice
through a matching current listing but cannot inflate the current settlement
count after that listing disappears. Focused tests now cover all three. The
world-relation endpoint remains provider-free and settles at roughly 0.80s on
the live 162-projection history.

The next engineering continuation is entity-role evidence acquisition. It
should produce a content-addressed assertion that a named Iowa candidate was
the Democratic nominee/candidate for the exact election and bind that assertion
to the correct frontier predicate without rewriting the venue contract. Only
after both Iowa and national legs exist should the system calculate the
complement portfolio; settlement-rule exactness and fresh quote/depth remain
separate later gates.

Schema 64 now implements that entity-role evidence boundary. A requirement is
bound to the exact relation frontier, retained corpus, inspected listing,
person, organization and event. An official-source document retains the raw
bytes, extracted text, independent hashes, receive time and extractor identity.
Assertions record both the canonical organization (`Democratic Party`) and the
source's actual ballot label (`Democratic`), so normalization never alters the
evidence excerpt. SQLite persists all three artifact classes with restart tests;
the migration also detects and repairs the short-lived schema-64 draft table by
column capability rather than trusting only `user_version`.

The first constrained source adapter admits only the Iowa Secretary of State's
HTTPS document path, caps responses at 10 MB / 25 pages / 30 seconds, performs
no model call and coalesces concurrent capture requests. Live capture retained
the 218,755-byte July candidate-list PDF with raw hash
`081e64911b5c6db9248b7565e7b4168c98f6f3430b9795c0673c25898d3dc438`.
The deterministic office-scoped parser yields `Josh Turek = SUPPORTED`,
`Ashley Hinson = CONTRADICTED`, and `Nathan Sage / Zach Wahls = INCONCLUSIVE`.
Absence from a current list is deliberately not promoted into permanent
exclusion.

A supported assertion is now a first-class supplemental predicate evidence
binding. Its assertion, requirement, source-document, raw and extracted-text
hashes enter both predicate and settlement-projection lineage. The conservative
settlement compiler verifies the exact retained assertion before it may satisfy
subject grounding; event terms still have to occur in the venue contract. Live
reconciliation therefore added the Josh contract as a second Iowa leg beside
national Democratic Senate control. Unresolved alternative candidates no
longer globally block this two-leg construction because the same observable
Iowa predicate is already covered; the untraded latent office-holding predicate
is correctly excluded from settlement-coverage completeness.

The current live shadow construction is now semantically complete at two legs
and no longer carries `INSPECTED_LISTING_PROJECTION_COVERAGE_INCOMPLETE`. It
remains `SETTLEMENT_MAPPING_BLOCKED` for two independent empirical reasons:
the retained Gemini text does not prove both affirmative and negative
resolution clauses, and the current anonymous corpus omits both retained
listings so indicative asks are unavailable. `ADVERSE_PROBABILITY_BOUND_UNAVAILABLE`
remains downstream. The next generation should acquire those rule and quote
artifacts provider-free before spending another relation-Agent token.

That quote gate is now qualified. Gemini's official public event-detail
endpoint uses an event ticker while its returned markets and trading streams use
instrument symbols; treating those identities as interchangeable had made a
page-limited catalog look like the contracts were gone. Schema 65 adds a
Gemini-capable exact quote-observation ledger beside Opinion, including a
capability-detecting migration for the earlier Opinion-only table. Each retained
observation binds the requested event ticker, exact returned instrument symbol,
raw response bytes, receive time, protocol identity and outcome ask. A read
projection may overlay those observations only onto the exact retained listing
revision; it performs no network request.

The operator-authorized live targeted refresh issued two anonymous official GETs
and retained four outcome observations with zero model calls. National
Democratic Senate control has a current YES ask of `0.47`; Josh Turek winning
Iowa has a current NO ask of `0.56`. The complement portfolio therefore costs
`1.03`, has a gross failure budget of `-0.03`, and a break-even adverse-state
probability of zero before fees or depth. The deterministic router correctly
chooses `RETIRE_NON_POSITIVE_MARGIN` despite remaining probability and
settlement debt. More rule research or estimator spend cannot rescue this
quote state, so Iowa is now a useful negative economic specimen rather than an
unfinished opportunity.

The first-party settlement compiler also advances to a content-addressed V2
identity. Its bounded Gemini dialect recognizes official `if … then this market
resolves to Yes` and `… to No otherwise` clauses across abbreviations such as
`U.S.`, and normalizes `winner/wins` and `controls/control` only for lexical
grounding. Projections retain the compiler identity; coverage recompiles stale
artifacts provider-free and the live read model prefers the current compiler
generation over identical legacy projection keys. This prevents a semantic
cache from silently surviving a changed deterministic interpretation policy.

The next selection pressure is now clear: exact targeted prices should be a
cheap early falsifier after a relation has enough semantic legs, while costly
probability estimation and generalized rule acquisition remain downstream of a
positive complement budget. The next ontology neighborhood must differ from the
retired Iowa adverse state rather than merely search the same popular election
contracts under new prose.

Live schema-65 restart qualified the complete replay path and exposed one
history-only invariant before persistence. A V2 recompile may receive a frontier
predicate that already carries the same listing evidence from an earlier
generation; evidence identity is unique by listing ref, not by the incidental
ontology-node revision. Coverage now replaces that binding with the current
exact node/facet binding and deduplicates repeated supplemental assertion IDs.
The process failed closed before writing the malformed predicate, the focused
history-replay regression passes, and the subsequent startup completed. The
retained ledger now contains a current-compiler exact national Democratic
control projection and a current-compiler Josh projection whose only local rule
debt is the missing negative clause. The live shadow still routes Iowa to
`RETIRE_NON_POSITIVE_MARGIN` with two exact targeted quote legs and zero
read-triggered requests or jobs.

The quote-bound retirement now also reaches the durable Agent input instead of
existing only in the read projection. A shared pure overlay compiler selects
the newest exact targeted observation or matching current instrument for each
retained semantic listing. Reconciliation uses that quote corpus to build
economic memory, while `semanticInputIdentity` still records only that the
frontier's adverse world has already received an economic projection—not its
price or margin. Thus a first projection can prevent repeated semantic work,
but later price movement only changes the exact observation revision and cannot
manufacture a new ontology task. Live SQLite now binds the Iowa input to
`RETIRE_NON_POSITIVE_MARGIN`, cost `103000000`, failure budget `-3000000` at
scale `100000000`; the Alaska input independently retains positive indicative
budget `49300000` but routes to projection coverage. These two differentiated
memories are the first raw material for cross-frontier economic selection
pressure.
