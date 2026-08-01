# Attention-aware scheduled search notifications

Status: active
Started: 2026-08-02

## Outcome

Turn concurrent recurring search into a sustainable human-attention loop. The
five durable research issues should keep scanning independently, while the
notification layer distinguishes routine coverage, interesting research leads,
actionable economic candidates, and operational degradation. Ordinary work is
aggregated into hourly digests; only bounded high-value or repeated-failure
signals may bypass the digest. Every delivery is content-addressed,
restart-safe, retry-bounded, and independent of Agent authority.

## Runtime evidence

The issue scheduler already owns five durable briefs, priority ordering,
independent cadence, a three-slot lease pool, immutable-corpus replay, and
restart recovery. The live scheduler has retained 97 unread search
notifications even though the Studio inbox renders only twelve. Raw event
deduplication works, but the product currently treats a weak fast-lane lead, a
deep grounded proposal, and a run failure as similarly attention-worthy.

This is the next measured funnel bottleneck. Adding more issues or more Agent
slots without attention policy would increase operator load faster than search
coverage.

## Architecture decision

1. preserve existing lease results and source notifications as immutable input;
2. derive a separate first-party attention classification from exact lease
   fields—never from model confidence;
3. aggregate normal scans, proposals, economic blocks, pi calls, and quote
   rescues into closed UTC-hour windows, grouped by issue, after a one-minute
   close grace so concurrent completions settle before immutable materialization;
4. reserve immediate delivery for a novel grounded proposal with a positive
   economic gate, or for repeated operational failure;
5. create an immutable attention message, then a separate per-channel delivery
   record with its own idempotency identity and bounded attempts;
6. initialize external-channel cutover at process start so enabling a channel
   never floods it with the historical unread backlog;
7. expose delivery posture, digest contents, retries, and dead letters in Studio;
8. keep notification acknowledgement independent from semantic review,
   simulation, certification, and execution.

## Construction slices

- [x] Add deterministic attention classification and closed-window digest
  materialization over retained terminal issue leases.
- [x] Add immutable attention messages and per-channel outbox deliveries.
- [x] Persist messages and deliveries in SQLite WAL with schema migration,
  hash verification, bounded retention, and restart recovery.
- [x] Add an optional bounded JSON webhook adapter with no projected/stored
  destination, redirect following, credentials, or unbounded response body.
- [x] Add retry/backoff, terminal dead-letter state, and concurrent-tick
  idempotency.
- [x] Orchestrate attention ticks after issue completion and on a bounded timer.
- [x] Expose hourly digests, immediate alerts, delivery health, and channel
  configuration in Studio.
- [x] Add focused policy, persistence, restart, webhook, failure, and authority
  tests.
- [x] Run full Node 24 checks, production build, local webhook smoke, live
  scheduler smoke, and desktop/390 px QA.
- [ ] Publish and serially merge the campaign PR.

## Attention policy v1

- `ROUTINE`: completed scan, no new grounded proposal; digest only.
- `WATCH`: novel result with at least one grounded proposal or pi escalation;
  digest only.
- `ACTION`: novel result with at least one grounded proposal and a positive
  deterministic economic gate; immediate plus digest.
- `DEGRADED`: the same issue has three consecutive failed terminal leases;
  immediate plus digest, emitted once per failure streak.

An economic gate is not required for general semantic issues, so their
proposals remain `WATCH`, never `ACTION`. Evidence gaps, model confidence, and
raw hypothesis count cannot increase severity.

## Safety and boundedness

- Attention policy can suppress or aggregate delivery only; it cannot mutate
  research evidence or candidate state.
- A notification never accepts semantics, authorizes simulation, publishes a
  certificate, or grants execution authority.
- Window size, issue count, message count, request count, response size,
  timeout, retries, backoff, and retention are statically bounded.
- Webhook delivery uses one JSON `POST`, omitted credentials, redirects
  disabled, an idempotency header, and a process-only destination.
- Production destinations require HTTPS; loopback HTTP is accepted only for
  local qualification.
- Response bodies are discarded under a strict byte limit and never become
  research evidence.
- A channel failure cannot fail or delay an Agent lease.

## Qualification gate

- The same retained lease/window creates one message and at most one delivery
  per channel across repeated ticks and restart.
- Two or three concurrent issue completions in one hour produce one digest with
  issue-local counts and exact source lease ids.
- A closed window has one stable identity; a late retained record cannot create
  a second operator-visible digest for the same hour.
- A weak candidate remains digest-only; a positive grounded pair produces one
  immediate `ACTION` message.
- One or two failures remain digest-only; the third consecutive failure emits
  one `DEGRADED` message, and a later pass resets the streak.
- Enabling a webhook does not enqueue any message older than the process
  activation time.
- Network timeout, non-2xx, oversized response, and restart during retry remain
  durable without duplicate sends beyond the explicit at-least-once boundary.
- Studio is readable at desktop and 390 px without horizontal overflow.
