# Grounded candidate accounting

Status: active
Started: 2026-08-02

## Outcome

Make every future `novelCandidate` mean that the cheap search lane grounded a
relationship-shaped lead in at least two distinct in-context market listings.
Retain single-listing hypotheses as bounded search evidence and rotation
feedback, but do not assign them a candidate novelty identity, candidate yield,
or raw finding notification.

## Runtime evidence

- The retained live window contains 40 terminal leases and 10 records whose
  immutable outcome says `novelCandidate=true`.
- Two of those ten records have only one `candidateListingRef`, so the displayed
  candidate count is inflated by 20%.
- Both single-ref records followed a DeepSeek timeout or request failure and
  stopped at `NOT_MULTI_LISTING` with zero deep proposals.
- Lease `sha256:f4c882ba52bef3f515c583aa91adb0e5a6bc9d04e3d2935afb578b5f938ef364`
  is the Polymarket US/Gemini Riley collision. It retained only the Polymarket
  US ref yet emitted a `NOVEL_CANDIDATE` raw notification.
- The attention outbox did not emit an immediate action because it also
  requires a grounded proposal and positive economic gate. The defect is
  candidate identity, raw finding noise, and performance attribution—not an
  execution or certificate-authority leak.

## Architecture decision

1. For policy-free general issues, build a novelty signature only from
   hypotheses containing at least two distinct listing refs.
2. Preserve single-ref hypotheses, their diagnostics, and their scoped listing
   refs in the immutable lease record.
3. Classify a single-ref-only result as `NOT_MULTI_LISTING`, with a null novelty
   signature and `novelCandidate=false`; completed-scope rotation already
   treats that reason as an honest no-lead result.
4. Leave exact-context and model-selected candidate policies unchanged. Their
   arity and venue contracts already define qualification.
5. Do not rewrite historical lease records or raw notifications. Correct
   current performance and newly materialized attention digests with a
   backward-compatible derived qualification predicate.
6. Keep provider, pi, concurrency, context, retry, semantic-review, simulation,
   certificate, and execution budgets unchanged.

## Construction slices

- [x] Qualify the live single-ref candidate-accounting defect.
- [x] Centralize the grounded multi-listing candidate predicate.
- [x] Apply it to novelty creation, issue performance, and attention metrics.
- [x] Prove future single-ref results rotate without notification or pi.
- [x] Prove historical single-ref records remain readable but no longer inflate
      derived candidate yield.
- [x] Run full checks, production build, desktop QA, and 390 px QA.
- [ ] Publish and serially merge the campaign PR.

## Safety and boundedness

- This is a qualification tightening: no new model, network, notification, or
  execution action becomes possible.
- Raw historical leases and messages remain immutable and hash-valid.
- No hypothesis text, chain of thought, credential, or provider payload is
  newly persisted.
- AI still proposes only; semantic review and the exact verifier keep their
  existing independent authority.

## Qualification gate

- A policy-free run with one grounded listing retains one hypothesis and the
  listing ref, ends `NOT_MULTI_LISTING`, has no novelty signature, reports
  `novelCandidate=false`, does not call pi, and emits no issue notification.
- A policy-free run with two distinct in-context refs retains its existing
  novelty, duplicate, and optional pi behavior.
- Candidate-policy runs retain their exact arity, distinct-venue, economic-gate,
  and proposal-match behavior.
- A legacy hash-valid record with `novelCandidate=true` and one ref still loads,
  while performance and attention aggregation exclude it from candidate yield.
- Current live performance reclassifies the two retained single-ref records
  without mutating them or deleting their historical notifications.
- Studio remains readable at desktop and 390 px without horizontal overflow or
  browser warning/error logs.

## Runtime qualification

- The hot-reloaded live projection retains both historical single-ref records,
  their original `novelCandidate=true` fields, and their raw notifications.
- The derived retained-window candidate count changed from 10 to 8 and the rate
  from 2,500 bps to 2,000 bps across the same 40 terminal leases. No record or
  message was deleted or rewritten.
- The issue scheduler is idle with zero active work after reclassification;
  this campaign spent no additional provider or pi request for the live proof.
- A later browser sample caught one active scheduled lease, so the terminal
  measurement window was 39 records and displayed 7 qualified signatures at
  17.94%. The changing denominator is honest scheduler state, not a regression.
- Node 24 checks, 405 workspace tests, and the production control-plane/Studio
  build pass.
- Market Archaeologist renders the corrected performance at 1280 px and 390 px;
  document width equals viewport width and browser logs contain no warning or
  error.
