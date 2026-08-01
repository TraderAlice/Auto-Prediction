# Architecture

The harness separates contract truth from venue transport:

```text
raw venue facts
  -> normalized protocol events
  -> deterministic market state
  -> claim / resolution / outcome / listing graph
  -> bounded opportunity candidate
  -> exact payoff certificate
  -> capital + risk decision
  -> shadow execution + evidence
```

AI-native discovery sits beside, not inside, the authoritative path:

```text
fresh anonymous catalogs
  -> deterministic cross-venue Radar blocks
  -> explicit cheap scout triage
  -> durable exact-context research case
  -> explicit read-only pi investigation
  -> proposal-only scout / investigator findings
  -> independent hypothesis review artifact
  -> accepted EXACT market-link review graph
  -> deterministic capital-bounded compiler
  -> independent exact verifier
  -> fixture certificate (shadow only)
```

The external scout rack uses `deepseek-v4-flash` through Vercel AI SDK by
default and retains direct OpenAI Responses as an explicit alternate route. It
sends no tools, requests validated JSON output, disables thinking for the
DeepSeek fast lane, caps output tokens, and aborts on a bounded timeout. OpenAI
requests set `store:false`; DeepSeek retention remains provider policy. Before
any worker runs, the control plane
normalizes verified catalog fixtures and selects a bounded task context. The
context binds concrete listing IDs, rules, indicative prices, source fixture
hashes, and protocol identities under its own SHA-256 identity. The adapter
accepts only task-scoped venue IDs and listing references and reconstructs
authority fields locally; model output cannot supply an
identity, review status, certificate, or execution flag. Missing credentials,
HTTP errors, refusals, incomplete output, malformed JSON, and out-of-scope
venues fail closed while independent heuristic workers may still finish.

`OpportunityRadar` is a deterministic workload router, not an arbitrage
solver. It uses integer rare-term-weighted title overlap to bound the search
surface, requires different venues, rejects incompatible recurring cadences
and exact close times, and retains no more than 25 pairs. Candidate identities
bind both listings' source receive time, raw hash, and protocol identity. Only
an explicit server-side triage action may create an exact two-listing discovery
context; the browser never supplies the evidence body.

Tasks that need repository-aware investigation use a second lane: a pinned pi
CLI launched as an isolated, no-session final-text subprocess. It uses DeepSeek V4
Flash but receives only read/search/list tools, a minimal environment, a hard
deadline, and a combined output cap. Extensions and user-level pi resources
are disabled. The resulting report is task-scoped, application-validated,
self-hashed, proposal-only, and never routed into execution or automatic
promotion. This heavier lane is explicit rather than part of every discovery
request. The control plane exposes it only as an operator-triggered
Investigation Desk: at most one task runs at a time, identical active or passed
task scopes are idempotent, and competing work fails closed. The last ten
completed records use canonical JSON plus content hashes in SQLite WAL, so
passed-task idempotency survives restart. RUNNING state remains process-local
because an interrupted child cannot be resumed. RUNNING, FAILED, and PASS state
is part of the SSE projection; no state transition grants review or execution
authority.

`ResearchCaseDesk` is a read-only coordination projection above the discovery
and investigation ledgers. It groups only identical question, venue,
catalog-context, and source-grade scopes; different live observation hashes
remain different cases even when the question text matches. It detects
conflicting listing counts for one context identity, bounds displayed listing
references, and preserves failed pi attempts beside the latest passed report.
Its `BOUND` / `PRESENT` stages describe retained research input, never semantic
approval. Review, compilation, exact verification, promotion, and execution
remain unavailable through this layer.

New Discovery Ledger records also retain the complete bounded normalized
catalog context used by their workers. This snapshot is hash-checked in SQLite
but stripped from HTTP/SSE projections. Research Case and Radar pi handoffs
load the stored context by task ID, so a catalog refresh or restart cannot
replace the evidence between cheap scouting and deep investigation. Legacy
runs without a snapshot fail closed and require a fresh scout.

The hypothesis remains `PROPOSE_ONLY` and `UNREVIEWED`; approval is a separate
content-addressed artifact. Compilation derives its claim-graph and resolution
partition identities from the hypothesis and complete reviewed-link set. A
candidate with a missing link, extra listing or venue, self-review,
non-`EXACT` link, stale input identity, or non-positive conservative floor is
rejected before publication.

Public HTTP and WebSocket/Socket.IO facts first cross a content-addressed
evidence boundary. Realtime codecs then preserve each venue's native
sequencing guarantee: Gemini ranges may produce deltas, while Polymarket and
Limitless public full-book images produce explicit rebuild snapshots.

Current catalog discovery has two deliberately separate evidence grades. The
verified fixture corpus is the default catalog input supplied to AI tasks. A live
observation desk performs bounded anonymous GETs against six venue catalogs,
preserves each raw response byte-for-byte in SQLite WAL, and binds its
normalized listing identity to source URL, receive time, protocol identity,
headers, raw hash, and byte length. Per-source timeout, response-size, HTTP, or
codec failure degrades only that source and retains its last successful
snapshot. An operator may explicitly select current observations for proposal-
only AI context when every requested source is successful, non-empty, and at
most 15 minutes old. The context binds source grade, receive time, raw hash,
protocol identity, and an untrusted-venue-text policy. This does not promote
the observation desk: live data still cannot enter review, compilation,
certification, or execution by this path.

The real-candidate watch is a separate operational evidence grade. An explicit
operator refresh anonymously reads the current Polymarket and Limitless books
and binds both raw observations to one `candidate-watch-refresh` identity.
SQLite schema v5 retains the raw BLOB, response metadata, protocol identity,
receive time, raw hash, native generation when available, and candidate claim
identity. It also retains a bounded canonical attempt journal with the common
refresh ID, per-source outcome and observation binding, deterministic decision,
diagnostics, and literal-false effects. The newest journal entry is hydration
authority, so a failed attempt survives restart instead of allowing older raw
books to revive a `READY` projection. Screening is permitted only when both
latest observations share the same successful refresh ID. Partial failure
preserves evidence for diagnostics but publishes no decision, preventing a
fresh source from being stitched to an older counter-leg. Unchanged source
identities reuse only their already-bound snapshot result; substantive changes
rebuild the `bigint` depth screen. A
positive gross screen stops at `POSITIVE_GROSS_REQUIRES_QUALIFICATION`; it does
not call review or the verifier.

The long-running control plane owns `ReplayBookDesk`. It verifies stream
artifacts, applies normalized events to deterministic books, and publishes
JSON/SSE projections. Studio is a read-only view of those projections and may
request an in-memory replay, but it never applies book events itself.

The same process owns bounded discovery, investigation, catalog-observation,
and candidate-book operational state. In development it
opens `.data/control-plane.sqlite`, selects WAL journal mode with full
synchronous durability, applies an explicit schema migration, and hydrates the
Scout Inbox, latest catalog observations, and latest candidate books before publishing the first
projection. Canonical records carry SHA-256 identities; catalog rows also keep
the exact raw response BLOB. Malformed, tampered, or newer-schema state fails
closed at startup/read time.

Normalized question, venue scope, and catalog-context identity produce a stable
default `taskId`.
Completed IDs survive restart, conflicting scope reuse returns `409`, and
concurrent requests for the same ID share one worker promise. SQLite state is
operational and bounded; immutable protocol and qualification evidence remains
content-addressed in Git.

The fast loop reacts to book generations. The slow loop evaluates strategy revisions against immutable replay or shadow evidence.

## Authority layers

Agent-editable code may research venues, normalize fixtures, propose matches and opportunities, and generate shadow quotes. Reviewed equivalence, exact verification, risk policy, live authority, evidence identity, and campaign verdicts are separate authorities.

## Failure posture

Unknown protocol data, precision loss, incomplete resolution partitions, stale or gapped books, mismatched hashes, expired certificates, and unreconciled order state all fail closed. Live execution is unavailable by default.

Replay integrity is continuously exercised by deterministic chaos cases for
sequence gaps, stale input, reconnect without a fresh snapshot, off-tick
deltas, tick-size change, and generation mismatch. Delta batches validate every level before
mutating the book; any invalid level rejects the whole batch and moves the
book to `GAP_DETECTED`.

## Capital and shadow execution

Capital is a venue silo. Reservations move exact values through available, reserved, deployed, unresolved, receivable, and recovered states; every mutation proves conservation against initial capital plus realized terminal PnL.

An execution plan is a validated DAG whose intents bind exact certificate legs. Dependency checkpoints gate submission. UNKNOWN state forbids resubmission and requires reconciliation with exact cumulative quantity and debit. A plan reaches `LOCKED` only after all legs fill, and terminal PnL is recognized only through settlement—not mark-to-market.

## Transport-free order shapes

Kalshi demo and Gemini sandbox adapters model submit, cancel, and reconcile
request shapes behind the common order-gateway port. These implementations are
deliberately terminal: they hash the unsigned target request and return
`REJECTED_INERT`. There is no HTTP client, authentication material, nonce
generation, or route from configuration to execution.

## Campaign evidence

The control plane folds verified book evidence and replay-chaos results into a
`pmh.campaign-evidence.v1` bundle. The bundle has literal-false effects and a
canonical SHA-256 identity. The same value is checked into
`projects/campaigns/architecture-qualification` and a golden test prevents the
runtime projection and immutable artifact from drifting independently.

The same directory also contains `reviewed-compilation.v1.json`. That artifact
is deliberately scoped `SYNTHETIC_ARCHITECTURE_QUALIFICATION`: it proves the
software handoff from subjective discovery through independent review and
exact verification, but it is not evidence that any real venue listings are
equivalent.

`three-venue-claim.v1.json` closes the separate real mapping checkpoint. Three
anonymous official API fixtures bind the same Trump-removal claim on
Polymarket Global, Opinion, and Limitless. The evidence builder requires
identical titles, binary partitions, and normalized resolution rules, plus the
Limitless external Polymarket slug. Trading-window metadata remains
listing-local and is deliberately excluded from the canonical claim identity.

`real-candidate-preflight.v1.json` advances that exact claim map one step into
economic screening without pretending that fixture prices are executable. It
parses every numeric quote from its source lexeme into `bigint` fixed point.
The catalog indications suggest a 55 bp gross complete-payout floor, but the
same Polymarket YES and Limitless NO legs total exactly one unit at the venues'
reported buy quotes. The artifact remains `SEARCH_LEAD_ONLY` and explicitly
blocks fee/depth qualification, independent review, candidate compilation, and
the exact verifier. This rejected handoff is campaign evidence: it proves that
a plausible nominal spread cannot enter the authoritative path merely because
the underlying claim map is exact.

`real-candidate-depth.v1.json` adds anonymous, byte-preserved order books for
the same Polymarket YES and Limitless NO route. Polymarket exposes a public
token book with a venue hash; Limitless exposes a public market book whose
YES bids imply a NO acquisition route through a simulated complete-set split
and YES sale. At the common five-share minimum, one Polymarket ask level costs
`0.35` and the Limitless route costs `4.65`, consuming the full `5.00` payout
before fees. The screen is quantity-bound but not certificate-grade: the
Limitless REST response has no venue generation identity, its taker fee is
dynamic and unbound, and the split/sell route remains simulation-only. No
value-moving method is invoked.

`real-candidate-disposition.v1.json` turns that snapshot's intermediate
`BLOCKED` economics into a terminal, snapshot-scoped
`REJECTED_ECONOMICS` decision. An anonymous byte-preserved copy of the
official Limitless fee document binds sell-taker fees to a non-negative
42–150 bp range with no maker rebate. Because the quantity-bound gross floor
is already zero, no exact dynamic fee amount can make the post-fee floor
strictly positive. The pipeline therefore does not spend independent-review
or exact-verifier authority on this snapshot. The disposition is not a
permanent market judgment: any changed book identity must be screened again.

`real-candidate-rescreen.v1.json` exercises that invalidation rule with a
second anonymous capture. Polymarket changes both raw book hash and native
venue generation, while the byte-identical Limitless book is freshly observed
but does not masquerade as a content change. The prior depth and disposition
are rebuilt from their original fixtures, marked invalid for the new snapshot,
and never reused. Fresh depth and disposition hashes independently reproduce
the zero-floor economic rejection. The lineage records
`priorDecisionReused: false`, skips review and verification again, and requires
another rescreen on the next substantive book change.

At runtime, Candidate Watch applies that same invalidation rule to later public
books without manufacturing new immutable fixtures. Its first retained live
batch on 2026-08-01 changed only Polymarket (`sha256:dcdc0fae…c6e8`, native
generation `36bbecef…b57e`); Limitless remained `sha256:bb0ad494…a6cf`. The
new screen produced depth `sha256:ea217c9e…cb89` and disposition
`sha256:d0f7fd48…de86`, again rejecting a zero gross floor. The old decision
was not reused, and review, verifier, certificate, and execution effects stayed
absent.
