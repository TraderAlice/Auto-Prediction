# Market ontology for persistent AI-native discovery

Status: active mainline construction

Issues: [#94](https://github.com/luokerenx4/my-little-pony/issues/94),
[#96](https://github.com/luokerenx4/my-little-pony/issues/96)

Current continuation branch: `codex/ontology-search-ecology`

## North star

The project should continuously and engineeringly discover prediction-market
relative value. That requires a reusable search space that survives individual
prompts, models, venues, and market generations.

The current durable corpus is listing-first and the semantic graph is
relation-first. A listing title is hashed into a per-listing claim node, while a
shared world object appears only after an Agent proposes a relation. The machine
therefore remembers contracts and conclusions but not the intermediate ontology
that made a search direction interesting.

## Ontological position

A prediction-market listing is not identical to a probability of reality. It is
a traded contingent payoff whose venue-specific settlement contract refers to a
world proposition. Its price is an observation of how that payoff is valued
under a particular mechanism, liquidity state, participant population, access
boundary, fee schedule, and time. It may be useful evidence about belief, but it
is not itself the world proposition or an authority-certified probability.

The first ontology therefore has three layers:

1. **World proposition** — the subjects, predicate family, parameters,
   quantifiers, and time scope a listing purports to reference.
2. **Settlement contract** — the venue predicate that turns evidence into a
   terminal outcome, including source authority, rule version, observation
   boundary, outcome mapping, and exceptional states.
3. **Traded state** — the payoff instrument and its observed mechanism, price,
   depth, fee, freshness, and access posture.

These layers must not be collapsed:

- similar world propositions may have different settlement predicates;
- one settlement predicate may be packaged into several traded instruments;
- a price difference may reflect semantics, microstructure, access, or stale
  observation rather than a disagreement about the world;
- unknown facets remain unknown and do not become false facts.

## AI-native operating model

First-party deterministic code owns identities, bounded extraction, evidence
lineage, replay, and authority. Agents own open-ended abstraction and search:

1. deterministic corpus projection emits evidence-bound ontological facets;
2. the scheduler chooses unusual world/settlement/traded neighborhoods rather
   than relying only on predefined claims or lexical families;
3. an Agent inspects exact refs and may propose richer world propositions,
   relations, counterexamples, or missing facets through tools;
4. first-party review binds or rejects those effects without rewriting source
   evidence;
5. search yield, falsification, probability bounds, economic qualification, and
   token cost feed back into future ontology trailhead priority.

The ontology is a search substrate, not a universal truth graph. Agent-proposed
facets need versioned provenance and may coexist or conflict until evidence or
review resolves them.

## Phase 1 — provider-free evidence projection

Build `pmh.market-ontology.v1` from a retained `MarketCorpusSnapshot`.

Each listing projection binds:

- exact listing, venue instrument, protocol, receive time, and raw source hash;
- bounded subject signals and predicate/event cues derived only from the
  untrusted proposition title; description/rules prose remains settlement
  evidence and cannot silently redefine the world facet;
- temporal cues and the venue close boundary without pretending close equals
  resolution;
- outcome-space shape and settlement-evidence posture;
- mechanism and indicative-price observation posture.

The projection creates world-reference clusters only when listings share
bounded subject signals. It explicitly labels clusters as routing hypotheses.
It also produces pairwise ontology trailheads whose novelty comes from changed
predicate, temporal, settlement, outcome, venue, or traded-state facets.

Hard constraints:

- provider-free and deterministic;
- no inferred equivalence, implication, probability, or arbitrage;
- no JavaScript-number monetary arithmetic;
- source hashes and exact refs retained;
- bounded nodes, signals, clusters, and trailheads;
- content-addressed replay and a strict validator;
- zero certificate and execution authority.

## Phase 2 — discovery integration

Add an ontology trailhead to heuristic-first semantic retrieval. It must be
chosen only as search routing evidence, preserve ordinary family routing, and
carry an exact ontology identity into the Agent assignment. The Agent prompt
must say which facets differ and require inspection before forming a claim.

Selection is based on changed search behavior, not the existence of a graph:

- unique exact semantic scopes per provider attempt;
- ontology trailhead to proposal/falsification yield;
- fraction of trailheads later explained by semantic, settlement, or traded
  divergence;
- token and wall-clock cost per reviewed opportunity;
- duplicate-scope and unsupported-evidence rates.

## Phase 3 — Agent-proposed ontology effects

After the deterministic layer has measurable value, expose tool effects for
Agents to propose:

- canonical subjects and aliases;
- world predicates and causal/temporal links;
- settlement predicate decompositions;
- ambiguity, exception, and missing-source facets;
- attention/commodification observations.

Free-form output is diagnostic only. Every accepted effect is scoped to exact
source evidence and cannot publish probability, a semantic certificate, or an
order.

The provider-neutral substrate is now implemented. `ONTOLOGY_NORMALIZATION`
tasks carry exact ontology/snapshot/trailhead identities and can run through
Pi, Codex, or the in-process AI SDK adapter. The first-party tool host exposes
bounded assignment listing, exact trailhead evidence reads, entity-alias
proposals, world-proposition proposals, and counterexample retention. Accepted
effects bind the Agent run plus exact node/world/settlement/traded facet IDs;
unknown fields and out-of-assignment refs fail closed. SQLite schema 38 retains
the complete unreviewed proposal content, while the generic execution ledger
independently retains invocation, tool-effect, token, and run identities. The
read-only proposal ledger is projected at
`/api/v1/market-ontology/agent-proposals`.

Automatic dispatch remains deliberately absent. Provider-free issue
materialization and the zero-cost yield baseline are now implemented in Phase
4. The next controlled increment can let an explicitly activated campaign
choose runtime, credential, model, and model-owned effort through the existing
execution substrate.

## Phase 4 — persistent search ecology

Schedule differentiated ontology issues concurrently: unexplored clusters,
settlement divergence, time-boundary ladders, causal incompatibility,
attention/liquidity anomalies, and falsification revisits. Allocate budgets by
measured marginal discovery value and retain negative results so the machine
does not rediscover the same dead neighborhood indefinitely.

### Implemented search-work substrate — 2026-08-12

The first ecology materializes one durable issue per `selection lane × relation
pattern`, rather than collapsing all instances of a lexical pattern into the
highest-priority lane. This distinction matters: the same surface relation can
be interesting because the world predicates differ, because settlement terms
differ, or because the same proposition appears at multiple venues. Folding
those together had erased the settlement-divergence lane in the first live
attempt.

Each issue revision contains:

- a stable issue identity and content-addressed revision;
- the exact ontology and corpus identities;
- up to eight assigned trailheads and their exact listing refs;
- bounded title, description, rule, outcome, close-boundary, protocol, raw-hash,
  and world/settlement/traded facet evidence;
- a provider-neutral `ONTOLOGY_NORMALIZATION` task;
- coverage state derived from attributed proposals or counterexamples;
- explicit zero semantic, probability, certificate, execution, external-write,
  and value-moving authority.

The task payload is self-sufficient. A Pi, Codex, or in-process runtime can
recreate its first-party tool host from the persisted payload after the live
catalog and ontology have rotated; it does not need to reconstruct a historical
4,706-listing corpus. Validators recheck every trailhead, node, facet, source
hash, assignment boundary, and task-payload hash before exposing evidence or
accepting a proposal.

SQLite schema 39 retains issue revisions separately from generic Agent tasks.
The control plane currently materializes 64 active issues with lane diversity:
26 cross-venue, 24 world-divergence, and all 14 available distinct
settlement-divergence patterns. The two spare settlement slots are filled by
the next highest-ranked cross-venue work rather than left idle. Startup creates
64 tasks but zero runs, campaigns, provider requests, model invocations, or
tokens. `/api/v1/market-ontology/search-ecology` joins revisions, Agent runs,
tool effects, proposals, counterexamples, and bigint token totals into an
honest baseline. Downstream opportunity attribution is explicitly
`NOT_YET_CONNECTED` rather than inferred.

Live profiling exposed and corrected an architectural performance error. The
first batch implementation revalidated and rehashed the complete corpus once
per issue, making ontology reconciliation take 23.904 seconds. Snapshot
validation now occurs once before batch construction, while each smaller task
evidence package retains its own validator. The same live reconciliation takes
1.214 seconds; the readiness envelope records individual reconciliation step
times so this regression cannot hide inside a broad startup phase again.

### Next gates

1. Add an opt-in ontology campaign selector that samples a small differentiated
   portfolio and resolves the operator's persisted Terra-first route; do not
   create a run until runtime, credential, model, and capability preflight all
   pass.
2. Let accepted ontology proposals and counterexamples create or update
   relation-bound discovery work without granting the proposing Agent semantic
   authority.
3. Carry ontology issue/revision/trailhead lineage into reviewed findings,
   probability cases, and opportunity structures so yield can be measured as
   reviewed economic value per token and wall-clock minute.
4. Feed negative evidence, duplicate scope, review rejection, and successful
   opportunity delivery back into lane/pattern allocation. Start with bounded
   deterministic scoring; adopt adaptive allocation only after enough outcomes
   exist to avoid optimizing noise.
5. Expand the tool protocol only when the first campaign demonstrates a need:
   settlement-predicate decomposition, causal or temporal incompatibility, and
   attention/liquidity observations are candidates, not presumed additions.

## First qualification

- [x] Define and validate the v1 ontology projection.
- [x] Prove identity changes when world, settlement, or traded evidence changes.
- [x] Prove price strings remain evidence and are never parsed through
  JavaScript `number`.
- [x] Produce ontology trailheads from mixed cross-venue fixtures.
- [x] Integrate ontology trailheads into heuristic-first retrieval.
- [x] Inspect the retained anonymous live corpus and record cluster/trailhead
  counts plus representative exact refs.
- [x] Compare the new trailhead with existing family/rare-token routing.
- [x] Update the issue and this plan with selection evidence.

### Anonymous live-corpus evidence — 2026-08-12

With every recurring AI tick disabled, the provider-free endpoint projected a
4,706-listing retained corpus in 0.522 seconds. The bounded output contained
512 rare-signal clusters, 128 trailheads, and 99 distinct relation templates:
58 cross-venue, 42 world-divergence, and 28 settlement-divergence. Ten listings
had no retained subject signal. Projection identity
`sha256:1e27e9dc0dcc762baa855bbf69980bf178b52f4712998bb460801fd4d8c0dbd6`
was bound to corpus snapshot
`sha256:9edefb9b2eee2d8c13142870be49874cbb35f5140f91f830dc59d230b892ad31`.

Representative search-positive structures included:

- equivalent F1, NASCAR, MLB-award, and MLS contracts observed on two venues;
- the same named person in an office-departure proposition and a later
  election/nomination proposition;
- a season championship and a single-event win for the same competitor;
- nested time boundaries for the same event;
- the same real-world event packaged with different outcome spaces.

Qualification also falsified three naive ranking choices. Largest lexical
clusters were dominated by repetitive sports books; description text polluted
world facets with venue template words; and rare single-token names produced
false entity matches. The adopted lexical v2 behavior now uses rare-signal,
venue-diverse cluster samples; keeps world extraction title-only; allocates
separate trailhead budgets across venue/world/settlement divergence; limits
each relation template; and permits at most four single-signal fuzzy entity
explorations. This is materially different from the old rare-token fallback:
it emits exact pairs plus a named facet divergence and relation-template
identity instead of a context seed with no ontological question.

The remaining bottleneck is no longer pair generation. It is Agent-authored,
evidence-bound entity and proposition normalization, followed by durable yield
attribution. Phase 3 is therefore the next construction target.

## Non-goals

- one canonical ontology imposed on every venue or language;
- treating market price as calibrated probability;
- replacing raw protocol evidence with normalized semantic text;
- allowing an Agent to certify its own abstractions;
- live trading, credentials, signing, approvals, or value movement.
