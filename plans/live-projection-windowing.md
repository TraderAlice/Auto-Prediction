# Live projection windowing

Status: implemented through bounded live view; cursor paging remains follow-on

Created: 2026-08-02

## Evidence that triggered this campaign

The retained local control-plane projection reached 5,439,400 JSON bytes. A
single read spent about 0.72 seconds locally, and every scheduler mutation sent
the same full body to every SSE subscriber. The largest collections were 189
semantic-review jobs (1.72 MB), 947 semantic-graph listing nodes (0.75 MB), ten
Market Archaeologist reports (0.47 MB), and forty search leases (0.45 MB).
Studio renders only small recent/attention windows from most of these arrays.

This is a persistence bug rather than cosmetic frontend work: retained evidence
should grow without making operator liveness, notification delivery, or model
scheduling progressively slower.

## Outcome

Separate authoritative retained state from the bounded live operator view.
Studio receives enough active, actionable, and recent records to operate; exact
totals and a source-state identity prove what was omitted. Full retained state
remains available through an explicit read-only endpoint and later moves to
cursor-based collection resources.

## Contract

- The full projection remains an immutable view of current retained desks.
- A live projection has its own content hash and carries the source full-state
  hash from which it was derived.
- Every truncated array publishes its path, exact total, included count, limit,
  selection policy, and full-history resource.
- Selection is deterministic. Active/actionable records are admitted before
  recent terminal history; identities break timestamp ties.
- Aggregate counters are never recomputed from the live slice. They continue to
  describe the full retained state.
- Graph listing nodes are omitted from the live body because Studio currently
  consumes only exact graph counts and identities. Relation/feedback windows
  remain bounded search memory, not semantic authority.
- SSE broadcasts the bounded live view. Full history is never pushed merely
  because one counter changed.
- Full reads and future page reads are anonymous/read-only and grant no model,
  semantic, certificate, or execution authority.

## Initial live limits

- semantic review jobs: 16, notifications: 12;
- semantic reviews: 16;
- search leases: 8;
- Market Archaeologist runs: 4;
- lifecycle cases: 32, with linked decision/simulation/shadow records retained;
- economic and review attention: 8 each;
- evidence acquisition jobs: 12;
- search attention messages: 12, deliveries: 12;
- discovery runs: 8, research cases: 12;
- graph listings: 0, relations: 16, feedback: 16.

These are transport limits, not storage retention limits.

## Qualification gates

- A fixture with more records than every limit proves exact totals, deterministic
  selection, active-first behavior, source/full identity, and tamper-sensitive
  live identity.
- The default projection endpoint and SSE use the live view; an explicit full
  endpoint returns the complete source projection.
- Runtime measurement reduces the current live body below 1.5 MB and avoids
  full-history bytes in an SSE event.
- Studio renders all current views and clearly signals that history is windowed.
- Full checks, tests, build, default viewport, and narrow visual QA pass.

## Follow-on

Add cursor-based resources for individual collections before any live window is
expected to support interactive history exploration. Then make SSE an identity
invalidation stream with client-side coalescing so bursts do not rebuild even a
bounded projection once per tool effect.

## 2026-08-02 checkpoint

- Studio projection v2 separates the authoritative retained `stateHash` from a
  transport-specific `viewHash`. The live view binds the source hash and an
  exact manifest for every bounded collection; no history is deleted.
- `/api/v1/projection` and SSE now emit `LIVE_BOUNDED`. The explicit
  `/api/v1/projection?view=full` resource retains the complete current view, and
  malformed view selectors fail closed.
- Active review, acquisition, notification, and lifecycle records win their
  deterministic windows before retained terminal history. Lifecycle side
  artifacts are included only when linked to a visible case. Graph listing
  nodes are omitted from the live transport while exact counts and graph
  identity remain intact.
- On the retained local state, the full body measured 5,484,465 bytes and about
  0.80 seconds. The live body measured 1,023,698 bytes and about 0.40 seconds;
  the initial SSE event was 1,023,723 bytes. That is an 81% byte reduction, with
  eighteen collections visibly marked as windowed.
- Studio displays its v2/live posture and window count. Default and temporary
  390 px visual QA showed the window badge and retired issue state without
  horizontal overflow.

Cursor resources and invalidation-only/coalesced SSE remain deliberately open;
the current checkpoint removes full-history fanout but does not claim constant
cost as retained summaries and cross-linked active work grow.
