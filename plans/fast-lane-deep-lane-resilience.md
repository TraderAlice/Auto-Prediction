# Fast-lane result preservation and deep-lane resilience

Status: active

Started: 2026-08-02

## Outcome

Preserve useful cheap-Agent search work when optional pi investigation times
out, fails, or must be retried. Fast and deep lanes become independently
observable durable stages rather than one top-level success bit. A deep failure
must never fabricate a semantic proposal, but it also must not erase a grounded
fast candidate, distort issue health, or force the cheap Agent to repeat the
same immutable search.

## Evidence for priority

The live v3 implication qualification represented all seven registered venues.
The fast Agent completed 8 model steps and 12 tool calls, read the catalog three
times, and accepted one grounded proposal effect. Pi then consumed the remaining
shared lease budget and timed out. The terminal lease became `FAILED`, so issue
health and failure notifications describe the whole search as failed even
though the fast lane succeeded and retained candidate refs.

The same running SQLite window also contains expired, resumable `ISSUED` leases.
Recovery currently drains them through ordinary issue scheduling and can create
deadline-expired failure streaks. These are lifecycle/recovery failures, not
new model-quality evidence.

## Proposed stage contract

- `fastLane.status=PASS` remains immutable evidence once persisted.
- `deepLane.status=FAILED` records a bounded deep diagnostic without changing
  the truth of the fast result.
- The lease outcome explicitly distinguishes `FAST_COMPLETE`,
  `DEEP_COMPLETE`, and `DEEP_UNAVAILABLE`; a top-level issue failure means the
  fast lane itself did not complete or the immutable corpus contract failed.
- A grounded fast signature without a deep proposal enters a deduplicated deep
  retry queue or research case. It is not admitted to semantic review until pi
  returns an exact grounded proposal.
- Retrying deep work reuses the original stored corpus, exact candidate refs,
  question, graph context, and novelty signature. It never repeats the cheap
  Agent merely to recover pi.
- Fast and deep requests have separately configurable budgets. The enclosing
  lease budget is their bounded sum plus fixed orchestration overhead, not a
  race for one shared deadline.
- Deep timeout/failure metrics and notifications remain visible but do not
  increment the issue's consecutive fast-search failure streak.
- Expired issued leases that never entered a lane fail deterministically during
  restart recovery without spending model or pi budget; recoverable in-flight
  evidence is resumed only while its stage deadline remains valid.

## Construction slices

1. Define a backward-compatible lane outcome projection and derive historical
   records without rewriting their artifacts.
2. Persist the fast terminal checkpoint before optional deep launch and make
   deep completion an idempotent transition over that exact checkpoint.
3. Split fast/deep deadlines and configuration while retaining bounded total
   spend and one active deep run per novelty signature.
4. Add a durable, deduplicated deep retry record linked to issue, lease, corpus,
   candidate refs, and signature; expose manual retry before considering an
   automatic retry policy.
5. Separate fast-search health, deep-investigation health, and restart-recovery
   diagnostics in metrics, notifications, and Studio.
6. Compact expired issued backlog on startup without provider work, then
   qualify restart during fast work, restart before deep work, pi timeout,
   successful retry, duplicate retry, and retention pruning.

## Qualification gates

- A fast PASS followed by pi timeout retains its candidate refs and counts as a
  completed issue scan, with `DEEP_UNAVAILABLE` visible separately.
- No semantic-review job or proposal authority appears until a grounded deep
  proposal passes existing first-party validation.
- Retrying the deep stage makes zero fast-model requests and uses the exact
  original corpus hash and candidate scope.
- Concurrent retries for one novelty signature coalesce; a completed retry is
  idempotent across SQLite restart.
- Expired never-started leases are terminalized without model/pi calls and do
  not create a false consecutive issue-degradation alert.
- Historical v1/v2/v3 leases and notifications continue to validate unchanged.
- Full checks, tests, build, live configured smoke, SQLite restart, desktop,
  and 390 px Studio QA pass.

## Authority boundary

This campaign changes durable search-stage accounting and retries only. A fast
candidate remains proposal preparation, not a semantic decision. Pi remains
read-only and proposal-only. No certificate, execution, external-write, signing,
credential, order, or value-moving authority changes.
