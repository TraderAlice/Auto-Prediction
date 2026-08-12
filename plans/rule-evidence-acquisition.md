# Durable rule-evidence acquisition and review unblocking

Status: active implementation; typed-locator propagation is on serial PR #80

Created: 2026-08-02

## Outcome

Turn an Agent's structured evidence gap into a bounded, durable acquisition
job that captures official anonymous rule material, binds it byte-for-byte to
the affected listings, and resumes semantic review over a new immutable scope.
The loop should increase the fraction of discovered relationships that can be
falsified or compiled without giving an LLM arbitrary network access or any
certificate, credential, or execution authority.

## Measured reason for priority

The latest retained live corpus initially contained 947 listings, of which 387
(40.9%) had no `rulesText`: Gemini Predictions 347/347, Myriad 20/20, and
Polymarket Global 20/20. Sixteen semantic-review jobs are already
`BLOCKED_EVIDENCE`.

This is partly an information-flow defect, not merely absent venue data.
Myriad and Polymarket Global already carry their full settlement criteria in
`description`; their adapters did not also identify that text as `rulesText`,
so discovery truncated it through the 800-character description path. The
current #80 branch corrects those mappings, reducing the expected missing-rule
count after refresh from 387 to 347.

The remaining locator evidence has distinct semantics. Of 347 Gemini contracts,
286 point to one official `assets.gemini.com` terms PDF and 61 have an empty
locator. An anonymous qualification HEAD returned HTTP 200,
`application/pdf`, 106,576 bytes, ETag, and Last-Modified for that document, so
bounded conditional capture is viable. The first inspected 20-market Myriad
slice exposed 11 non-empty `resolutionSource` URLs, but
the official API documents that field alongside `resolutionTitle`, `oracle`,
and `externalSources`; observed values such as AP, league sites, and X are
outcome-resolution sources, not contract terms. The current 20 Polymarket
Global records have empty `resolutionSource`, while their descriptions contain
the operative rules. The #80 correction therefore separates
`resolutionSourceUrl` from `rulesUrl` at the protocol boundary rather than
pretending every URL is a rule document.

Before the first construction slice, `DiscoveryCatalogListing` and the retained
MarketFS corpus discarded both typed locators. The current branch now preserves
the two observed roles end to end. Agents can see where missing rule or oracle
evidence lives, but they still cannot ask the harness to acquire it. The current
review journal also contains 47 legacy reports without an explicit semantic
constraint and only one v2 constraint report, so repeatedly reviewing the same
incomplete corpus is poor use of provider budget.

## Implemented checkpoint — 2026-08-02

- Added the closed `pmh.discovery-evidence-locator.v1` schema for
  `CONTRACT_RULE_DOCUMENT` and `OUTCOME_RESOLUTION_SOURCE`. Its content hash
  binds role, canonical HTTPS URL, venue, and protocol identity. These are the
  only roles backed by current adapter evidence; oracle and venue-terms roles
  remain planned until an adapter can declare their policy explicitly.
- Catalog normalization now converts `rulesUrl` and `resolutionSourceUrl` into
  separately typed locators. Empty, non-HTTPS, credential-bearing, fragment,
  non-default-port, or overlong URLs are not admitted.
- Discovery tasks, retained corpora, and proposal evidence bundles fail closed
  on malformed, reordered, duplicated, extended, or identity-mismatched
  locators. The locator explicitly carries `fetchAuthority: false`; no network
  worker or model-selectable arbitrary URL exists in this slice.
- Locator data survives discovery context hashing, MarketFS materialization,
  per-listing proposal hashing, and SQLite Market Archaeologist restart replay.
  Historical listings without the optional field still replay unchanged.
- Search semantic and routing identities deliberately exclude locators: adding
  evidence retrieval posture does not make an old relation semantically novel.
  Corpus and proposal listing hashes do include it, so evidence posture remains
  immutable and auditable.
- Catalog observations now declare a content-addressed normalizer identity in
  `pmh.catalog-observation.v2`. Historical v1 Myriad/Polymarket records are
  verified against their exact pre-role projection before the same retained raw
  bytes are upgraded in memory; unrelated normalization drift still fails
  closed. This prevents a sound adapter correction from looking like raw-byte
  corruption on restart.
- Replaying the latest retained 947-listing SQLite corpus produced 306 typed
  locators: 286 Gemini contract-rule documents and 20 Myriad outcome-resolution
  sources. No network request was used for this qualification.
- Node 24.14.0 type checks, all 448 workspace tests (299 control-plane), and the
  production build pass for this slice.

## Implemented stacked checkpoint — structured requirements

- Both Agent effect paths now submit bounded, proposal-scoped evidence
  requirements instead of leaving acquisition intent only in prose. Pi's
  `submit_market_findings` requires them on every proposal; the Vercel AI SDK
  `submit_semantic_review` effect requires them whenever `missingEvidence` is
  non-empty. Neither schema accepts a URL.
- First-party code derives `pmh.evidence-requirement.v1` artifacts from the
  immutable proposal listings. Each artifact binds its claim, satisfying and
  contradicting observations, historical/current posture, source listing/raw
  hashes, venue/protocol identity, and adapter-issued locator identities. It
  explicitly carries no fetch, provider-request, semantic-decision,
  certificate, or execution authority.
- Requirements route deterministically to `DOCUMENT_LOCATOR`, `MARKET_DATA`,
  or `UNSUPPORTED`. Unsupported requests remain represented instead of causing
  an improvised fetch or another model request.
- A shared official document is represented once with all affected listing
  refs. Its acquisition scope excludes proposal-local listing membership, so
  two Agents asking the same evidence kind and historical posture for the same
  Gemini PDF can share one future fetch while retaining distinct requirement
  IDs and claims.
- New Pi and semantic-review reports use v3 and persist requirements through
  SQLite restart. Historical v1/v2 reports remain valid and cannot be silently
  extended with v3 fields. Rehashed locator substitution and cross-listing
  rebinding fail closed against adapter/source lineage.
- Node 24.14.0 full workspace checks, all 452 tests (303 control-plane), and the
  production build pass on the unpublished stacked branch.
- That full qualification also exposed a pre-existing millisecond race in the
  search-lease failure path: the record and its fast lane sampled completion
  time separately even though v5 requires them to match. They now share one
  sampled timestamp, with an advancing-clock regression test, so overloaded
  parallel suites no longer turn an expected pre-Agent rejection into a
  malformed record.

## Implemented stacked checkpoint — constrained document capture

- Added a first-party `EvidenceDocumentFetcher` that accepts only a validated
  requirement plus an exact offered locator identity. A content-addressed
  adapter policy must independently match venue, protocol, locator role,
  hostname, and response content type before any request is admitted. The only
  built-in route is the currently evidenced Gemini contract-rule policy for
  `assets.gemini.com`; external Myriad resolution sources do not inherit it.
- Every hop is HTTPS-only, credential-free, manually redirected, revalidated
  against the exact host policy, DNS-resolved before use, and pinned into the
  TLS socket so a second lookup cannot rebind it to a private address. Public,
  private, link-local, documentation, benchmark, multicast, and reserved
  address postures are distinguished before network I/O.
- This host uses Clash fake-IP DNS (`198.18.0.0/15`). That range remains denied
  by default. An explicit `trustClashFakeIp` option admits only that range while
  retaining exact hostname allowlisting, pinned destination, normal TLS
  certificate/SNI verification, and an auditable `CLASH_FAKE_IP_PINNED` field
  in both capture and observation artifacts.
- `pmh.rule-document.v1` preserves exact bytes, requested and final locator
  identities, redirect trace, response metadata, receive time, raw hash, byte
  length, policy identity, and an authority-free anonymous acquisition record.
  `pmh.rule-document-observation.v1` represents both `200` and a later `304`;
  the latter points to the retained immutable document instead of duplicating
  its bytes.
- `pmh.rule-document-text.v1` binds derived text to its parent raw/document
  hashes and versioned extractor identity. Plain UTF-8, JSON, HTML, XHTML, and
  PDF are supported only when the adapter policy declares their type. PDF.js
  receives in-memory bytes only, performs no range/stream/worker fetches, and
  is bounded by raw bytes, time, pages, declared direct/compressed objects,
  images, and extracted characters. Venue text remains explicitly untrusted;
  prompt instructions have no authority.
- Focused tests prove public-address capture, default-denied and explicitly
  recorded Clash fake IP, private-address rejection before fetch, same-policy
  and off-policy redirects, advertised and streamed byte bounds, compressed
  response rejection, type policy, PDF object/page posture, conditional ETag
  reuse, byte/text tamper detection, and closed authority schemas.
- Live anonymous qualification through the configured Clash path captured the
  historical Gemini BTC rule PDF at 87,279 bytes (`sha256:a6c0ab29827e5552…`),
  extracted 5,116 characters from two pages, bound the selected route to
  `198.18.0.55`/IPv4, then received HTTP `304` on the conditional request and
  reused the same document identity. No credential,
  browser state, provider request, semantic decision, or value-moving action
  was involved.
- Node 24.14.0 full workspace checks, all 457 tests (308 control-plane), and the
  production build pass for the stacked checkpoint.

## Implemented stacked checkpoint — durable acquisition scheduling

- Added a content-addressed acquisition job per evidence scope. Requirements
  from multiple proposals are retained separately but share one fetch, lease,
  retry budget, and current-document freshness cycle. Requirements arriving
  while a shared fetch is already leased are merged into the durable completion
  instead of being overwritten by the older dispatch snapshot.
- SQLite schema v19 independently retains acquisition jobs, exact document
  bytes, bounded text extractions, and every document observation. Jobs lease
  before network I/O, recover expired leases after restart, bound concurrency
  and requests per tick, and distinguish retry wait, exhaustion, unsupported,
  captured, and stale states. Unsupported routes spend neither fetch nor model
  budget.
- A successful current-document capture resets only its retry-cycle attempt
  count. Lifetime attempts and conditional-reuse counts remain auditable, so
  repeated freshness checks can continue past one cycle's maximum without
  erasing their cost. Historical captures never refresh.
- Current documents revalidate with retained ETag or Last-Modified metadata.
  `304` creates a new immutable observation over the prior document; changed
  bytes create a new document and extraction while preserving the old
  observation. After a fetch-policy change, the old observation remains
  immutable but the current job deliberately drops its conditional cursor and
  performs a full request under the new policy.
- The control-plane runtime collects requirements from both discovery and
  semantic-review reports, exposes bounded queue/accounting data at
  `/api/v1/evidence-acquisition`, and starts scheduled reads only after the HTTP
  listener wins startup admission. The Studio projection includes the queue but
  never embeds untrusted extracted text.
- A live Gemini qualification captured the shared PDF once for two requirements,
  restored the job and artifacts from SQLite, reached its freshness boundary,
  and received HTTP `304` while reusing the same 87,279-byte document identity.
  The recorded route remained Clash fake-IP `198.18.0.55`/IPv4, and no model,
  credential, semantic-decision, certificate, or execution authority was used.
- Node 24.14.0 full workspace checks, all 467 tests (318 control-plane), and the
  production build pass for this scheduler checkpoint.

## Implemented stacked checkpoint — Agent interpretation and review re-entry

- Added a bounded Vercel AI SDK tool loop for each exact
  requirement×document×extraction tuple. The initial request receives document
  metadata but not the full untrusted body; the Agent can perform literal
  searches and bounded reads before terminating through
  `submit_rule_evidence_claim`. Whole-response schema parsing is not used.
- `pmh.rule-evidence-claim.v1` binds the proposal-local requirement, immutable
  document and extraction hashes, interpreter identity, disposition, exact
  passage offsets, quotes, and quote hashes. First-party validation requires
  every quote to equal the retained text slice. Fabricated, overlapping,
  out-of-bounds, cross-proposal, or authority-bearing claims fail closed.
  Supporting and contradicting claims require citations and no unresolved gap;
  inconclusive claims must preserve unresolved evidence.
- A separate durable scheduler leases one interpretation job per requirement
  and current captured document, bounds concurrency, attempts, and requests per
  tick, retries transient model failures, restores expired work after restart,
  and reuses an already-persisted PASS without another provider call. SQLite
  schema v20 retains jobs and immutable claim records independently from raw
  documents and extracted text.
- Complete current claim sets create
  `pmh.evidence-enriched-semantic-scope.v1` artifacts. The semantic-review
  scheduler reruns the same proposal under a new v2 scope and emits a v4 report
  without mutating the original review. Any resulting hard constraint binds the
  enriched scope identity; partial claim sets do not silently rebind a review.
- The control plane reconciles acquisition, claim interpretation, and enriched
  semantic review in order. `/api/v1/rule-evidence-claims`, `/health`, SSE, and
  Studio expose bounded scheduling and disposition counts without returning
  retained document text or granting claims semantic-decision authority.
- Focused qualification proves exact citation rejection, no full document in
  the first provider request, correction-capable tool iteration, independent
  claims over a coalesced document, bounded exhaustion, SQLite restart without
  duplicate model work, tamper rejection, and automatic evidence-enriched
  review re-entry while retaining the original report.
- A rejected terminal submission no longer ends either the evidence interpreter
  or semantic reviewer merely because the model called the submit tool. The
  first-party tool returns a bounded diagnostic and the loop continues until an
  effect is actually accepted or the step budget is exhausted. Regression tests
  cover premature submission, required evidence inspection, invalid exact
  quotes, and subsequent correction.
- A live DeepSeek V4 Flash interpretation passed in 14.4 seconds over a bounded
  local rule capture: two passage reads, one verified 160-character citation,
  `SUPPORTS`, no whole-response parsing, and no semantic-decision, certificate,
  or execution authority. Node 24.14.0 full workspace checks, all 477 tests
  (328 control-plane), and the production build pass. The dev server also
  admitted both Vite and the control plane; desktop/390 px visual inspection
  remains unclaimed because the browser-control URL policy rejected localhost.

## Implemented checkpoint — observation/content continuity (2026-08-13)

- A live Studio restart exposed an ontological category error in retained Rule
  Evidence work. A conditional `304 Not Modified` is a novel acquisition
  observation in time, but it still names the same immutable document bytes and
  extracted text. The scheduler had treated the changed observation identity as
  changed interpretation supply and failed the entire readiness projection.
- Interpretation supply is now explicitly the exact
  `requirement × proposal × document × extraction × raw hash × text hash`
  tuple. Observation identity remains preserved on every acquisition and on the
  original claim/job artifact, but does not authorize or require a second model
  interpretation when the byte-bound supply is unchanged.
- Reconciliation validates every current capture before comparing it with
  retained work, reuses a completed interpretation across a later `304`, and
  retains the old job byte-for-byte. A focused conditional-capture regression
  proves the later observation is distinct while document/extraction identity,
  provider attempt count, and retained job remain unchanged.
- The existing live SQLite state now reaches `READY` and materializes its 2.35 MB
  bounded Studio projection with zero provider requests and zero model
  invocations during startup/read qualification. This establishes a reusable
  ontology rule for the wider machine: **an observation is evidence that a
  proposition-bearing artifact was seen at a time; it is not itself the
  proposition-bearing artifact.** Fresh observation and semantic novelty must
  remain separate identities throughout durable scheduling.

## Evidence contract

1. Preserve adapter-owned typed locators in a backward-compatible discovery
   catalog revision. Locator roles include `CONTRACT_RULE_DOCUMENT`,
   `OUTCOME_RESOLUTION_SOURCE`, `ORACLE_REFERENCE`, and `VENUE_TERMS`; they are
   never interchangeable merely because all contain URLs. A locator identifies
   the venue, role, official URL or venue endpoint key, protocol identity, and
   adapter-declared host policy. It is data, never an instruction.
2. Add a content-addressed `pmh.rule-document.v1` artifact containing raw bytes,
   receive time, requested and final locator identities, HTTP status, content
   type, ETag/Last-Modified when present, redirect trace, protocol identity,
   byte length, and raw hash. Raw captures remain byte-for-byte authoritative.
3. Derive a bounded normalized-text view with its own extractor identity and
   parent raw hash. Extraction never replaces the raw artifact and must make
   truncation or unsupported content explicit.
4. Add a proposal-only `pmh.rule-evidence-claim.v1` tool effect that maps exact
   listing refs and structured evidence requirements to bounded passages in
   captured documents. The model may interpret evidence but cannot create its
   provenance, rewrite raw bytes, or declare a hard constraint.
5. Create an evidence-enriched semantic scope rather than mutating the original
   corpus or review. Scope lineage binds the original proposal/corpus hashes,
   every acquired document and extraction hash, the requirement set, and the
   reviewer version.

## Structured requirements instead of prose-only gaps

The semantic-review tool protocol should emit bounded evidence requirements in
addition to human-readable `missingEvidence`. Each requirement carries:

- a stable requirement ID and one or more exact listing refs;
- a kind such as `RESOLUTION_RULE`, `VOID_CANCELLATION`, `ORACLE_SOURCE`,
  `TIME_BOUNDARY`, `OUTCOME_MAPPING`, `FEE_SCHEDULE`, or `QUOTE_DEPTH`;
- the claim that cannot yet be falsified, why the evidence matters, and what
  observation would satisfy or contradict it;
- eligible adapter-provided locator identities, never a free-form model URL;
- freshness and scope requirements, including whether historical rules at the
  captured market timestamp are required.

Requirements unsupported by an adapter remain visible and blocked. They do not
consume fetch attempts or another semantic-review request merely because a
timer fired.

## Agent-first acquisition loop

- A review or Market Archaeologist run submits evidence requirements through a
  tool effect. The durable scheduler coalesces them by locator, document kind,
  protocol identity, and required historical posture.
- The first-party fetcher performs only adapter-authorized anonymous public
  reads. Captured text is returned to the Agent as untrusted evidence data for
  further reading, counterexample construction, or a bounded evidence-claim
  effect.
- The Agent may request another eligible document, mark a requirement
  unsupported, or finish with unresolved gaps. It cannot call arbitrary URLs,
  shell out to a browser, add credentials, or write the evidence ledger.
- A terminal evidence effect ends the Agent loop immediately. Useful acquired
  documents survive model timeout or later interpretation failure.
- Once the requirement set is satisfied or conclusively unsupported, the
  scheduler resumes semantic review over the enriched scope. The original
  review attempt and evidence posture remain replayable.

## Durable scheduling and freshness

- Persist requirement, fetch-attempt, document, extraction, evidence-claim,
  and enriched-scope records in SQLite WAL with independent content hashes.
- Coalesce concurrent requests for the same immutable locator identity. Use
  conditional GET when ETag or Last-Modified permits it, and record `304` as a
  new observation pointing to the retained raw artifact.
- Separate transient retry, terminal unsupported, stale, and captured states.
  Bound timeout, response bytes, redirects, attempts, and retention explicitly.
- Never overwrite a historical rule document. A changed response creates a new
  raw hash and invalidates only semantic scopes that depended on the previous
  current-document assertion; historical replay remains intact.
- Start acquisition workers only after HTTP listener admission, matching the
  existing catalog and Pi startup-safety contract.

## Network and prompt-injection boundary

- The adapter owns an exact HTTPS host allowlist and URL/endpoint constructor.
  The model can select an offered locator but cannot supply or modify a URL.
- Reject userinfo, non-HTTPS schemes, IP literals, private/link-local/reserved
  destinations, DNS rebinding, overlong URLs, unexpected ports, and redirects
  outside the adapter policy. Revalidate every redirect target.
- Bound compressed and decompressed bytes, content types, redirect count,
  request duration, and normalized-text length. HTML, JSON, plain text, and PDF
  use versioned extractors. PDF additionally bounds page count, object count,
  embedded payloads, and extracted characters; unsupported binaries remain raw
  evidence only.
- Send no cookies, authorization headers, production credentials, or browser
  session state. Rule text and fetched pages are untrusted venue content and
  cannot issue instructions to tools or change authority.

## Product surface and measurements

Studio should expose an Evidence acquisition queue with:

- missing-rule coverage by venue and evidence kind;
- pending, fetching, retry-wait, captured, unsupported, stale, and failed jobs;
- locator provenance, raw/document hashes, receive time, freshness, and
  extraction posture;
- jobs unblocked without another broad search, semantic reviews resumed, hard
  constraints admitted or rejected, and remaining exact-path blockers;
- fetch latency, byte volume, cache/304 rate, coalescing rate, model requests
  avoided, and evidence-to-decision conversion.

The north-star measurement is not documents downloaded. It is the durable rate
at which previously blocked, economically relevant candidates receive enough
official evidence to reach a deterministic accept/reject decision.

## Construction sequence

1. **Implemented on PR #80:** preserve and hash adapter-owned typed evidence
   locators through catalog observation, discovery context, MarketFS, proposal
   evidence bundles, and SQLite replay.
2. **Implemented on the unpublished serial stack:** define structured evidence
   requirements and migrate both Pi discovery and AI SDK semantic review to
   emit them without invalidating v1/v2 reports.
3. **Implemented on the unpublished serial stack:** implement the
   policy-constrained anonymous fetcher and raw/extracted evidence artifacts
   with SSRF, DNS rebinding, proxy-posture, redirect, conditional request, and
   resource-bound tests plus a live Gemini PDF qualification.
4. **Implemented on the unpublished serial stack:** add the durable coalescing
   acquisition scheduler, restart recovery, freshness, retention, policy-change
   invalidation, and terminal-state accounting.
5. **Implemented on the unpublished serial stack:** add the Agent tool loop for
   bounded search/read over eligible captured documents and terminal evidence
   claims; preserve captured artifacts across model failure.
6. **Implemented on the unpublished serial stack:** build enriched semantic
   scopes and automatically resume the same proposal's review without repeating
   discovery or reusing a PASS from another evidence scope.
7. **Implemented on the unpublished serial stack:** expose the interpretation
   queue, durable posture, disposition counts, attempt budget, and jobs in
   Studio without exposing raw document text.
   Live Studio use later found a retained model-origin locator whose hostname
   violated the adapter policy. Reconciliation now classifies that locator as
   `UNSUPPORTED` with zero fetch attempts instead of letting policy validation
   terminate the control-plane process; a regression test covers the stored
   untrusted-locator path.
8. Qualify against live anonymous official sources and the configured model,
   SQLite restart, desktop and 390 px layouts, then publish after serial PR #80
   merges.

## Qualification gates

- A fixture with null inline rules and an adapter-owned official PDF locator is
  captured byte-for-byte, text-extracted under PDF resource bounds, attached to
  a new semantic scope, and unblocks review without rerunning discovery.
- Duplicate concurrent requirements perform one network request and share one
  content-addressed document; restart does not duplicate completed work.
- A changed official document creates a new artifact and scope. The old review
  remains replayable and is never silently rebound.
- Off-policy redirects, private-address resolution, oversized/decompression
  responses, unsupported types, and prompt-injection text cannot escape the
  anonymous read-only boundary or produce a semantic decision.
- Missing/unsupported locators stay explicitly blocked and spend zero provider
  or fetch budget on timer ticks.
- A terminal Agent evidence effect ends its process while retaining every
  already captured document if interpretation later fails or times out.
- Live qualification captures at least one official source for each adapter
  family that currently exposes a rule locator, then restores all artifacts and
  scheduler states from SQLite.
- Full checks, tests, production build, desktop, and 390 px Studio QA pass with
  no credential, certificate, order, signing, fund, or value-moving authority.

## Authority boundary

This campaign authorizes only anonymous official rule-document reads and local
evidence persistence. Adapters, not models, define reachable sources. Agents
request and interpret evidence; deterministic code owns acquisition policy,
provenance, state transitions, and semantic re-admission. The exact verifier
remains the sole certificate authority, and live execution remains absent.
