# Realtime book evidence

## Qualified public paths

| Venue | Transport | Normalization rule | Gap/rebuild posture |
| --- | --- | --- | --- |
| Gemini | native WebSocket | initial `U == u` message is a snapshot; later ranges become deltas | a range beginning after the next expected sequence marks the book stale |
| Polymarket | native WebSocket | only `book` messages become full snapshots | `price_change` is not treated as a safe delta because the public message has no venue sequence; replacement books require rebuild |
| Limitless | Socket.IO over WebSocket | `orderbookUpdate` becomes a versioned full snapshot | every replacement image requires rebuild |

The differences are intentional. A shared adapter interface does not imply a
shared guarantee.

## Evidence artifact

`pmh.stream-fixture.v1` binds:

- the exact subscription object and its canonical hash;
- transport and public source URL;
- connection and close times;
- requested instrument identities;
- ordered frame boundaries and receive times;
- recoverable frame text with a per-frame hash;
- a content hash and byte length for the complete acquisition artifact;
- literal proof that credentials and value-moving operations were absent.

The acquisition script is write-once for a fixture name. Checked-in tests
recompute every binding before a venue codec sees a frame.

## Runtime boundary

Transport sessions belong to the long-running control plane, not Studio.
Adapters may normalize facts into deterministic book events. They do not own
claim equivalence, opportunity certification, risk authority, or execution.

## Chaos qualification

The replay-chaos suite injects six hazards into a deterministic reference
book: a native sequence gap, an explicit stale mark, a reconnect delta before
a replacement snapshot, an off-tick multi-change delta, a tick-size change,
and reuse of a stale generation binding after rebuild. Each case emits a content hash over the
fixture identity, expected posture, observed posture, and diagnostic.

All delta levels are validated before any map mutation. A single invalid level
rejects the complete batch, preserves the previous depth and sequence, and
moves lifecycle to `GAP_DETECTED`.
