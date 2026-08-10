# Bounded official-source discovery Agent

Status: implemented; supply-scope coalescing and deterministic Gemini contract-rule
discovery are live-qualified, with exact resolution-source discovery still open

Created: 2026-08-10

Issue: https://github.com/luokerenx4/my-little-pony/issues/84

## Product problem

Semantic review and probability estimation now produce exact, typed evidence
requirements, but an item without an adapter-provided locator becomes terminal
`UNSUPPORTED`. That is the correct fetch posture, yet it leaves the AI-native
loop incomplete: the machine can say precisely what it must learn but cannot
create bounded work to discover where the venue publishes it.

The first live repair exposes the gap. The MLS relation was honestly reduced to
textual relatedness and produced four current Gemini requirements for outcome
mapping, timing, contingency handling, and resolution authority. Another
semantic or probability request cannot improve the case until a new official
source enters the evidence graph.

## Decision

- Derive durable source-discovery tasks only from current, unsupported typed
  requirements. Each task binds requirement/proposal/listing identities,
  source observation time, venue/protocol, required locator role, satisfying
  and contradicting observations, and priority lineage from repair progress or
  the evidence-debt frontier.
- Keep discovery and acquisition separate. An Agent may propose a locator
  candidate, but only first-party admission can mint a
  `DiscoveredEvidenceLocator`; the ordinary evidence acquisition scheduler
  remains the sole fetch/capture owner.
- Give the Agent bounded search tools over configured official surfaces:
  adapter-declared venue domains and endpoints, links from already captured
  official documents, and later an explicitly selected search provider. It may
  not submit or fetch an arbitrary URL.
- Require every candidate to name the exact evidence role, venue, contract or
  venue-level scope, temporal posture, and the requirement it could satisfy.
  Generic venue policy cannot satisfy a contract-resolution requirement merely
  because it shares a host.
- First-party admission rejects non-HTTPS schemes, userinfo, IP literals,
  private/reserved targets, unexpected ports, unofficial hosts, out-of-policy
  redirects, role mismatch, missing contract/venue binding, and candidates
  already disproved by retained captures.
- Terminal Agent effects are `PROPOSE_LOCATOR`, `NO_OFFICIAL_SOURCE_FOUND`, or
  `ABSTAIN_SOURCE_DISCOVERY`. All are durable and content-addressed. A timer may
  retry only when source policy, requirement generation, or official surface
  identity changes; it may not repeatedly ask the same model the same search.
- Rank tasks by decision value: active semantic-repair blocker, positive-gross
  evidence blocker, operator evidence escalation, active triage debt, then
  retained research debt. Within a tier use exact requirement breadth and stable
  identity rather than model confidence.
- Once acquisition and a first-party evidence claim complete, create a new
  enriched semantic-review scope. Do not reopen semantic or probability work
  merely because a URL candidate exists.

## Agent topology and cost contract

One cheap scout handles one issue-like discovery task. Concurrency comes from
independent durable tasks rather than one Agent scanning the entire unsupported
inventory. The task specifies maximum searches, inspected candidates, tool
steps, provider requests, elapsed time, and tokens. Runtime provider/model and
effort come from SQLite policy and enter the task/run identity.

The first implementation should reuse the incremental Agent-effect protocol:

1. `search_official_source_surface` returns first-party normalized candidate
   handles, not free-form fetchable URLs.
2. `inspect_official_source_candidate` returns bounded untrusted metadata or an
   already captured passage.
3. `record_source_candidate_assessment` records exact requirement fit and a
   falsifier.
4. One terminal effect proposes a handle or records a negative/abstained result.

Whole-response schema parsing is not an authority boundary. The fixed locator
shape is a tool effect; repair guidance can keep the loop alive after a rejected
candidate without discarding useful inspected-source effects.

## Compatibility and authority

- Existing adapter locators, acquisition jobs, documents, extracts, evidence
  claims, and enriched review scopes keep their identities and precedence.
- A discovered locator is a new provenance class; it never masquerades as an
  adapter-owned locator. Its artifact binds the discovery run, official policy
  version, exact normalized URL/endpoint key, and admission evidence.
- Search reads and anonymous official capture are research operations only.
  No credentials, private browser session, production trading data, semantic
  decision, certificate, simulation, execution, signature, or value-moving
  authority is introduced.
- Projection and enqueue are pure reads/writes to the local research ledger and
  start no provider request. Only a leased discovery job may spend AI budget.

## Qualification

- Unit tests reject invented requirement/listing refs, unofficial domains,
  role substitution, ambiguous venue-level/contract-level scope, bad redirects,
  stale task generations, and candidate URLs supplied outside tool handles.
- Scheduler tests prove prioritization, bounded concurrency, idempotent enqueue,
  provider-policy routing, restart recovery, negative-result dedupe, and no
  provider call from projection/API/enqueue.
- Integration tests prove an admitted locator enters ordinary acquisition, raw
  evidence remains byte-exact, a captured claim creates an enriched review
  identity, and unsupported/negative results do not reopen review.
- Studio shows source-discovery tasks, spend posture, inspected candidates,
  rejected reasons, admitted locator/capture lineage, and terminal negative
  results without presenting a URL as evidence by itself.
- The live MLS qualification uses the four repair-derived Gemini requirements.
  Success is either a current official source that passes exact role/scope
  admission and changes the semantic evidence posture, or a durable
  `NO_OFFICIAL_SOURCE_FOUND`. Do not force a locator or weaken current-time
  requirements to reuse an unrelated historical PDF.
- Measure admitted-locator yield, captured-claim yield, changed-review yield,
  false-candidate rejection, provider requests, elapsed time, and tokens per
  changed decision. Full workspace checks/tests/build and desktop/compact visual
  inspection pass.

## Selection signal

Adopt if bounded discovery closes high-value evidence debt with attributable
official sources at acceptable cost and materially changes review decisions.
Rework if most value comes from deterministic adapter metadata extraction; in
that case improve the adapter rather than buying Agent search. Abandon open
search if it mainly finds generic venue pages, unofficial mirrors, or sources
that cannot bind exact contract semantics.

## 2026-08-10 implementation evidence

- Added content-addressed discovery tasks, inert Agent candidates, deterministic
  admissions, and provenance-bearing `pmh.discovery-evidence-locator.v3`
  locators. A candidate never grants fetch authority; only an admitted locator
  can rebase an unsupported requirement into the ordinary acquisition loop.
- Added a Vercel AI SDK tool loop with the SQLite-selected provider/model/effort.
  Codex Responses runs in streaming mode and exposes only bounded
  `search -> inspect -> record -> complete` effects. Search traverses exact
  adapter-declared official hosts and never accepts a free-form model URL.
- Added schema 34 SQLite persistence for job/task/candidate/admission lineage,
  leases, retries, terminal negatives, provider request counts, and tool call
  counts. Agent-generation changes create a new job while older generations
  remain durable and are excluded from the active queue.
- Added exact manual dispatch alongside the disabled-by-default timer. Manual
  dispatch obeys the same concurrency budget and exists so one high-value task
  can be qualified without activating the retained inventory.
- Added the source-discovery stage to Studio's evidence pipeline and exposed the
  scheduler through health, projection, and a dedicated read endpoint.
- Unit and integration qualification covers official-host admission, off-host
  rejection, v3 locator validation, requirement rebasing, bounded scheduling,
  SQLite restart recovery, server projection, all workspace checks, 480
  control-plane tests, 17 Studio tests, and production builds.

### Live MLS result

The four requirements emitted by the repaired MLS semantic review were run on
Codex OAuth using `gpt-5.6-terra` at high effort. All four terminated as durable
`NO_OFFICIAL_SOURCE_FOUND`; none produced a locator or reopened review:

- outcome mapping: 4 provider requests / 4 tool calls;
- time boundary: 10 provider requests / 10 tool calls;
- void/cancellation: 7 provider requests / 7 tool calls;
- oracle source: 9 provider requests / 9 tool calls.

The Agents inspected Gemini's official Prediction Markets Terms, Events,
getting-started, and related API documentation. Those pages describe generic
event discovery, expiration examples, and terms retrieval/acceptance, but did
not contain the current `GEMI-MLSCUP26-MLSCUP26LAFC` winner predicate, payout
mapping, delay/cancellation treatment, or resolution authority. The negative
result therefore preserves the repaired case as research-only instead of
admitting a generic documentation page as contract evidence.

### Follow-up evidence from the live queue

The first reconciliation produced 235 current-generation tasks and also
revealed many near-duplicate requirements from retained semantic/probability
generations. Provider generations are now filtered from the active queue, but
the next implementation must coalesce semantically equivalent requirements by
acquisition scope and split multi-venue requirements into explicit per-source
coverage obligations. Before buying broader web search, inspect Gemini's
official Terms API and event/catalog responses for a deterministic
contract-to-terms locator; if it exists, adapter extraction is the higher-value
solution predicted by the rework selection signal.

## 2026-08-10 supply-scope and adapter qualification

The follow-up changed the unit of work from one Agent prompt per requirement to
one exact official-document supply scope with up to twelve typed obligations.
The scope binds one venue, protocol, listing set, document role, temporal
posture, and official-surface policy. Multi-venue requirements are split before
search, while requirements from different proposal generations may share a
single search when they ask the same source to provide the same role. Terminal
jobs from superseded obligation bundles remain replayable but cannot be run.
Priority may rise when a shared source blocks a more valuable proposal, but a
lightweight retained-state reconciliation cannot lower it later.

Gemini's anonymous Events response proved that the Agent had been searching at
the wrong abstraction layer. The full 496-event response is 7,352,066 bytes and
the MLS contract carries rich-text contract rules plus a markdown `Full rules`
link to an official contract PDF. The Gemini adapter now extracts both fields,
binds them to a new normalizer identity, and retires old captures rather than
reinterpreting their truncated shape. The constrained document policy admits
the observed Gemini asset hosts, including the contract-bound
`cdn.builder.io` PDF, without granting arbitrary web-fetch authority.

On current retained state, the active source queue is 147 tasks covering 223
obligations; 353 older task generations remain durable but inactive. Only 24
active tasks target Gemini. For the LAFC cross-venue case, the former four
Gemini searches collapse to one positive-gross-blocking
`OUTCOME_RESOLUTION_SOURCE` obligation: outcome mapping, time boundary, and
void/cancellation are now supplied deterministically by the contract payload,
while an exact named resolution-source URL is still honestly missing. No new
provider request was needed and automatic source-discovery spending remains
disabled.

The live qualification also exposed two operational constraints and fixed
them. Evidence documents referenced by durable claim records now survive
acquisition-job retention pruning, and the Studio live projection windows all
new high-cardinality evidence schedulers. The bounded projection is 2.12 MB,
serves from the revision cache in about 0.02 seconds, retains aggregate counts,
and exposes explicit full-resource links for rotated detail. The dedicated
source endpoint reconciles directly and returned the 147-job queue in 0.39
seconds. Browser inspection of the live Evidence route showed the five-stage
pipeline, the LAFC 110 bps gross hint blocked only on oracle source, and no
console errors.

This is positive evidence for the plan's `REWORK` signal: deterministic adapter
extraction should consume all official data the venue already publishes, while
the Agent remains valuable for the smaller residual set where source location
or semantics cannot be derived mechanically. The next selection question is
whether exact resolution-source discovery can produce a named official oracle
at acceptable provider cost; generic Gemini policy pages remain inadmissible.

Qualification passes 487 control-plane tests, 17 Studio tests, all 649 workspace
tests, all TypeScript project checks, and the production build on the available
Node 22 host. The repository continues to emit its expected Node 24 engine
warning.
