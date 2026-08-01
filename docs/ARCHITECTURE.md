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
proposal-only scout hypothesis
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

The long-running control plane owns `ReplayBookDesk`. It verifies stream
artifacts, applies normalized events to deterministic books, and publishes
JSON/SSE projections. Studio is a read-only view of those projections and may
request an in-memory replay, but it never applies book events itself.

The same process owns bounded discovery, investigation, and catalog-observation operational state. In development it
opens `.data/control-plane.sqlite`, selects WAL journal mode with full
synchronous durability, applies an explicit schema migration, and hydrates the
Scout Inbox and latest catalog observations before publishing the first
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
