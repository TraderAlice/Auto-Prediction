# Studio progressive readiness

Status: active mainline construction

Created: 2026-08-13

Branch: `codex/projection-performance-attribution`

## North-star role

A durable research machine accumulates evidence indefinitely. If every Studio
reload must synchronously reconcile and serialize the complete current research
state before rendering any workspace, product availability gets worse as the
machine succeeds. Current live measurements make that failure concrete:

- bounded main projection: about 2.3 MB and 13 seconds on live SQLite state;
- standing-route desk: about 45 KB and 21 seconds when contending with main
  projection materialization;
- the App shows only a full-page gate until the main projection completes.

The UI needs progressive readiness with explicit freshness. It must never pass
stale research off as current, but last-known bounded state is more useful than
an empty screen while a fresh view is materializing.

## Ontology position

There are three different objects that must not be collapsed:

1. durable evidence state in SQLite;
2. a content-addressed bounded Studio projection over that evidence;
3. the operator's current browser readiness and freshness posture.

The projection is a derived cache, not evidence and not authority. Reusing a
last-known projection cannot create research outcomes, dispatch work, or mutate
the durable ledger. Freshness must be visible until the current projection
replaces it.

## Phase 1 — measured projection boundary

- [x] Attribute first-projection latency across reconciliation, full projection
  construction, live-window reduction, hashing, and JSON serialization.
- [x] Record response bytes and elapsed time without provider/model calls or
  state mutation beyond existing first-party scheduler reconciliation.
- [x] Identify collections that can be independently loaded without changing
  route or view semantics.

## Phase 2 — last-known bounded snapshot

- [x] Persist only the bounded live projection plus its content hash, source
  projection revision, materialized time, and schema/version identity.
- [x] On restart, serve that snapshot as `STALE_REVALIDATING` while one fresh
  materialization runs. Never label it `LIVE`.
- [x] Replace it atomically after successful current materialization; retain the
  last-known snapshot if refresh fails and expose the failure separately.
- [x] Schema mismatch or malformed cache fails closed to the existing startup
  gate; the cache never becomes a compatibility shim.

## Phase 3 — progressive Studio shell

- [x] Render the normal navigation shell from last-known bounded state while
  displaying revalidation posture and age.
- [ ] Keep independently loaded route memory, seed portfolio, and later desks
  in local loading/error states rather than blocking the whole shell.
- [ ] Preserve deep links and operator context through stale-to-live replacement.

## Qualification gates

- cold restart returns an operator-usable last-known bounded view before fresh
  materialization finishes;
- freshness posture is machine-readable and visually explicit;
- no provider request, model invocation, campaign, run, external write, order,
  signature, transaction, or funds movement is started by cache read/write;
- corrupt or incompatible snapshots are rejected without deleting durable
  evidence;
- fresh projection replacement is atomic and idempotent;
- tests prove stale state cannot be reported as `LIVE`;
- current full and bounded projection endpoints remain available for exact
  diagnostics and compatibility during migration.

## First evidence target

Instrument the existing live projection path and measure one cold and one warm
request on the current SQLite state. Do not choose storage or change response
semantics until the dominant latency stage is known.

## 2026-08-13 evidence update

The first instrumented cold run separated the problem cleanly:

- bounded response: 2,339,479 bytes;
- handler projection: 20,079 ms, including 17,999 ms of reconciliation;
- live-window reduction: 15.5 ms;
- JSON serialization: 3.9 ms;
- same-revision cache hit: 0.1 ms before serialization;
- standing-route desk: 10,809 ms, including 6,924 ms of input loading
  and 3,331 ms of route projection; value, seed outcome, and selection
  together remained under 4 ms.

The first safe reuse pass removed repeated relation finding/revision loads,
deduplicated retained-corpus decoding and validation within a read batch, and
carried already-derived corpus identities across scheduler reconciliation. On
the same durable state:

- bounded handler projection fell to 9,712 ms (52% below the instrumented
  baseline);
- standing-route desk fell to 5,025 ms (54% below baseline);
- live-window reduction and serialization remained negligible;
- all 613 control-plane tests continued to pass.

Decision: Phase 2 is justified. The remaining cold cost is genuine complete
state derivation, not response size or bounded-window construction. A durable
last-known bounded snapshot should improve operator availability while current
revalidation continues; further derivation work remains observable through
the retained `Server-Timing` segments.

## 2026-08-13 progressive-readiness qualification

The schema-44 presentation cache is a single replaceable row, separate from
evidence tables. Its envelope binds the bounded projection view hash, source
revision, materialization time, cache authority, and zero provider/model
effects. Load revalidates both envelope and projection content identities;
malformation becomes a cache miss without rewriting or deleting evidence.

On the current durable database:

- first materialization remained a normal `LIVE` response and populated the
  cache;
- a subsequent cold process restart returned the 2.34 MB last-known workspace
  with 14.8 ms TTFB and 17 ms total response time;
- that response was explicitly `STALE_REVALIDATING` and retained its original
  materialization timestamp;
- background derivation then changed the endpoint to `LIVE` and startup
  readiness to `READY` with zero provider requests and zero model invocations.

Control-plane qualification now covers 88 files and 617 tests; Studio covers
26 tests. Phase 3 continues with independently ready route/seed desks so their
multi-second derived reads cannot block or ambiguously degrade the main shell.

## Authority boundary

This plan authorizes local derived projection measurement and caching only. It
does not authorize semantic decisions, model spend, external writes, live
orders, credentials, signatures, transactions, or funds.
