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
2. Define structured evidence requirements and migrate semantic review to emit
   them without invalidating v1/v2 reports.
3. Implement the policy-constrained anonymous fetcher and raw/extracted
   evidence artifacts with SSRF and resource-bound tests.
4. Add the durable coalescing acquisition scheduler, restart recovery,
   freshness, retention, and terminal-state accounting.
5. Add the Agent tool loop for requesting eligible documents and submitting
   bounded evidence claims; preserve partial fetch success across model failure.
6. Build enriched semantic scopes and automatically resume blocked review jobs
   without repeating discovery or spending duplicate review attempts.
7. Surface the queue, provenance, coverage, and conversion funnel in Studio.
8. Qualify against live anonymous official sources, SQLite restart, desktop and
   390 px layouts, then publish as the next serial PR.

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
