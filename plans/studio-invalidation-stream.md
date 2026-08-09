# Studio invalidation stream

Status: implemented and qualified

Created: 2026-08-10

## Product problem

The bounded live projection removed most retained-history bytes from Studio but
did not remove projection work from the mutation path. Every scheduler effect
still calls `broadcastProjection()`, which rebuilds, hashes, serializes, and
pushes the complete live view even when no browser is connected. Browser
connection also duplicates work: the initial projection GET and initial SSE
event each build the same view.

The retained local database is now roughly 87 MB. Runtime A/B with and without
the probability search-origin join left the control-plane at roughly 52–55%
CPU during the observed scheduled/full-projection workload, so the remaining
bottleneck is the transport topology rather than the new calibration lineage.
An AI-native search machine cannot let operator presentation compete with Agent
scheduling for the same event loop as evidence accumulates.

## Decision

- SSE becomes a presentation-only invalidation stream. A state effect advances
  a process-local monotonic revision and emits a small content-addressed
  `pmh.studio-projection-invalidation.v1` artifact; it never embeds a Studio
  projection or claims a source-state hash it has not built.
- Invalidations within 25 ms share one emitted event carrying the latest
  revision. Intermediate UI frames are not durable evidence and need not be
  rendered; retained desk records remain authoritative.
- `/api/v1/projection` remains the only live-view read. Concurrent reads for one
  revision share a build promise, and the resulting view remains cached until
  the next explicit revision. This absorbs the initial GET/SSE race and makes
  unchanged conditional reads constant-cost without time-based staleness.
- Live reads publish the exact projection `viewHash` as an ETag and the stream
  revision as `x-pmh-projection-revision`. A matching `If-None-Match` returns
  304 after current-state identity is established.
- Studio keeps at most one projection request in flight. Invalidations arriving
  during that request collapse into one follow-up read, and the top bar states
  whether data is live, updating, or reconnecting while retaining the last good
  view.
- Full projection reads, proposal handoffs, and all model/semantic/verifier/
  execution authority boundaries are unchanged.

## Compatibility contract

- The SSE event changes deliberately from `projection` to
  `projection-invalidated`; sending both would preserve the expensive behavior.
  Studio is updated in the same serial mainline change.
- Invalidation revision is process-local transport ordering, not a durable
  state sequence and not semantic evidence. Reconnect always performs an exact
  projection read.
- Projection v2 `stateHash`, `viewHash`, and collection-window manifests remain
  canonical. Invalidation hashes cannot substitute for them.
- A missing or malformed invalidation cannot mutate Studio state. The browser
  reports a connection diagnostic and waits for a valid same-origin refresh.
- The stream grants no semantic decision, certificate, credential, execution,
  or value-moving authority.

## Qualification

- Pure replay tests reject tampered invalidation revision/hash/authority.
- HTTP tests prove initial and changed SSE events remain below 1,000 bytes and
  contain no projection body, while an on-demand GET observes the durable
  change.
- Conditional GET tests prove stable ETags return 304 and a state invalidation
  forces a new projection/view identity.
- Discovery scheduling tests allow transient invalidations to coalesce while
  the eventual projection retains the completed run.
- Studio parser tests reject malformed revision/resource/view/authority data.
- Runtime measurement compares idle/scheduled CPU and projection request/event
  bytes before and after the transport change.
- In-app browser QA covers initial connection, live refresh status, an operator
  action, reconnect-safe stale rendering, typography, overflow, and console.
- Full workspace checks, tests, and production build pass.

## 2026-08-10 checkpoint

- Scheduler and tool effects now advance a process-local revision and publish a
  content-addressed invalidation. They do not construct a Studio projection when
  there is no subscriber, and invalidations within 25 ms collapse to the latest
  revision.
- Projection generation is now a read-only operation. Qualification exposed
  lifecycle synchronization hidden inside the old projection builder; that
  state transition now runs explicitly after startup and mutation effects.
- On the retained 87 MB SQLite state, one live projection is 2,270,415 bytes and
  took 0.854 seconds to construct. The new SSE event is about 0.5 KB. A matching
  conditional read returned 304 with zero body bytes in 0.000789 seconds.
- With the old projection fanout, the observed control-plane process consumed
  roughly 52–55% CPU during the scheduled/full-projection workload. With
  invalidation-only fanout and a per-revision cache, an idle sample fell to
  0.2%; projection cost is now paid on operator demand instead of every effect.
- Studio retains the last good projection, allows at most one request in flight,
  collapses invalidations into one follow-up read, and exposes Live data,
  Updating, Connecting, or Reconnecting in the product shell.
- Focused server/stream tests passed 28/28 and Studio projection tests passed
  11/11. Full workspace type checks, all 576 tests, and the production build
  passed; the existing Node 22 versus declared Node 24 engine warning remains.
- In-app browser visual qualification could not be completed: the existing
  Codex browser target timed out in `Page.navigate` even after the documented
  viewport reset and fresh-tab recovery, while the Studio HTTP service remained
  responsive. This is an environment limitation, not a visual-pass claim.

## Follow-on

Cursor resources are still required before any bounded live collection becomes
an interactive history browser. Once invalidation-only transport is qualified,
the next scalability slice should remove full-projection construction from
proposal-local and collection-local reads rather than widening live windows.
