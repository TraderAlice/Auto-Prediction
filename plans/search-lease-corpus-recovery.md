# Search lease corpus recovery

Status: active
Started: 2026-08-02

## Outcome

Make scheduled AI search genuinely restart-safe. An `ISSUED` lease must retain
the exact immutable market corpus it was authorized to inspect, then resume the
same fast/deep task after a process restart without substituting a newer catalog
or consuming a second logical lease.

## Runtime evidence

The retained scheduler has 38 terminal/issued leases: 12 passed and 26 failed.
Twenty-one failures share one diagnostic: `issued search lease snapshot is no
longer available after restart`. Only five failures came from actual pi output,
schema, or timeout problems. The four durable issues have accumulated 91 runs,
so restart evidence loss dominates observed search reliability.

## Architecture decision

Add a content-addressed SQLite corpus store beside the lease journal. Persist a
bounded, normalized `pmh.market-corpus.v1` snapshot before writing a new
`ISSUED` lease. Multiple leases reference one snapshot identity; corpus rows are
retained while any lease record references them and are never projected with
their untrusted venue text.

On restart the issue scheduler first resumes an issued lease from its retained
corpus. The lease ID, question, graph context, scope, budgets, deadline, and
snapshot identity remain exactly those in the journal. If a legacy issued lease
has no retained corpus, it keeps the existing named failure and may schedule a
new lease on current evidence; the system never substitutes silently.

## Construction slices

- [x] Add bounded market-corpus assertion and SQLite schema-v13 storage.
- [x] Persist task corpus before every new issued search lease.
- [x] Resume issued issue leases from retained corpus across restart.
- [x] Expose retained/recoverable/missing corpus posture without projecting text.
- [x] Prove exact identity, deduplication, tamper rejection, pruning, legacy
  fallback, concurrency, and no-double-budget behavior.
- [x] Run a real SQLite restart drill, full Node 24 qualification, and Studio
  desktop/narrow-screen check.
- [ ] Publish the next serial PR.

## Safety invariants

- Venue-authored text remains untrusted data and stays server-side.
- A restored lease uses the original snapshot identity and source-set identity;
  current market data cannot replace either.
- Corpus size, listing count, and serialized bytes are bounded before storage.
- Content hashes are verified on every load; corrupt or mismatched evidence
  fails closed.
- One immutable corpus is stored once even when many issues reference it.
- Recovery does not add model or pi budget, semantic authority, certificate
  authority, execution authority, external writes, or value-moving actions.
- Terminal lease records remain immutable and corpus retention follows live
  journal references.

## Qualification gate

- A process can die after durable `ISSUED` and the next process completes that
  exact lease without receiving the old snapshot from its caller.
- A newer live corpus may coexist during recovery but cannot affect the resumed
  task context or MarketFS.
- Tampered corpus JSON/hash/identity is rejected before any Agent call.
- Legacy v12 databases migrate without rewriting existing lease records.
- The retained runtime reports corpus recovery posture separately from historic
  terminal failures.

## Qualification observation

The live control-plane process reopened the existing WAL as schema v13 and now
reports 40 retained leases: 15 passed, 25 historic failures, no issued work, 3
content-addressed corpora, and no issued-corpus gaps. All three 467-listing
corpora are referenced by retained lease rows. Historic failures remain
visible; migration does not rewrite them.

The Node 24 gate passes type checking, all package tests (including 182
control-plane and 10 Studio tests), and the production build. Browser
qualification shows the recovery posture as `3 CORPORA · 0 RESUMABLE` and
`0 issued corpus gaps`; the Scheduled Search Desk has no horizontal overflow at
the default desktop viewport or at 390 px, and emits no browser warnings or
errors.
