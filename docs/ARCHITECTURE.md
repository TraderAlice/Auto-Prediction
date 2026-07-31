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

Public HTTP and WebSocket/Socket.IO facts first cross a content-addressed
evidence boundary. Realtime codecs then preserve each venue's native
sequencing guarantee: Gemini ranges may produce deltas, while Polymarket and
Limitless public full-book images produce explicit rebuild snapshots.

The long-running control plane owns `ReplayBookDesk`. It verifies stream
artifacts, applies normalized events to deterministic books, and publishes
JSON/SSE projections. Studio is a read-only view of those projections and may
request an in-memory replay, but it never applies book events itself.

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
