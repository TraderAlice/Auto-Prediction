# Bounded official-source discovery Agent

Status: active design

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
