# AI-selected radar batches

Status: implemented and qualified for serial merge
Started: 2026-08-02

## Outcome

Make the settlement-qualified two-leg issue AI-native at the candidate-selection
boundary. Programs may assemble a bounded, replayable batch of lexical/economic
search leads, but one cheap model must choose the exact two-listing claim it
wants investigated before bigint economics can permit a pi escalation.

## Runtime evidence

The live seven-source corpus contains 467 listings. In the retained 40-lease
window, the focused parity issue used 16 leases, reached a positive gross gate
twice, avoided nine pi calls, and produced only four retained proposals. The two
most recent positive gates were both lexical false positives: an MLS Cup winner
listing was paired with a multi-game Kalshi parlay because a city name happened
to overlap. The cheap model correctly returned no hypothesis.

The server currently chooses one exact radar pair before invoking any model.
`SearchLeaseScheduler` then treats the two context refs as the candidate even
when the model did not select them. This makes AI a pair validator rather than
the search engine, and consumes one recurring lease for every program-selected
false pair.

## Architecture decision

For the settlement-qualified issue only:

1. group the current ordered radar into deterministic bounded batches;
2. retain every listing in the selected batch byte-for-byte inside the immutable
   discovery context;
3. require a successful model worker hypothesis with exactly two distinct
   cross-venue listing refs from that context;
4. bind the candidate signature and bigint economic gate to that selected pair;
5. allow pi only after a positive gate, and retain only deep proposals whose
   relation and exact listing set match the selected pair;
6. rotate completed batches with the existing issue-local semantic/routing
   feedback and fall back deterministically after exhaustion.

Legacy exact-context candidate policies keep their existing behavior. General
semantic issues keep their bounded title-anchor rotation. AI selection is still
proposal-only: it cannot approve equivalence, certify economics, or authorize
execution.

## Construction slices

- [x] Add an exact bounded-context constructor that never silently drops a
  requested radar listing.
- [x] Build deterministic radar batches and route them with issue-local feedback.
- [x] Add an explicit model-hypothesis selection mode to candidate policy.
- [x] Bind the economic gate, novelty signature, and pi prompt to one selected
  exact pair.
- [x] Reject deep proposals that change the selected listing set.
- [x] Report model-selection attempts, successful pairs, and misses by issue.
- [x] Explain and expose the AI-first pair-selection flow in Studio.
- [x] Run focused/full Node 24 checks, production build, live multi-refresh
  smoke, and desktop/390 px QA.
- [x] Publish and serially merge the campaign PR.

## Safety invariants

- Radar batching is lexical/economic retrieval only and never semantic proof.
- Every batch is content-addressed, source-bound, at most 30 listings, and below
  the existing 50,000-character context limit.
- A model-selected ref must belong to the immutable leased context.
- A selected pair contains exactly two distinct refs from distinct venues.
- The economic gate uses only bigint fixed-point arithmetic over the selected
  current-context pair.
- Pi cannot substitute another pair and cannot create decision authority.
- Failed or interrupted work never suppresses a batch.
- No credential, signing, order, transaction, fund, or live-execution path is
  introduced.

## Qualification gate

- Exact two-listing triage contexts still retain both requested listings.
- A multi-pair batch preserves every requested listing and remains bounded.
- A heuristic-only hypothesis cannot satisfy model-selection policy.
- A model hypothesis with the wrong arity, duplicate refs, one venue, or an
  out-of-context ref cannot become the selected candidate.
- A valid model-selected pair alone reaches the economic gate.
- Non-positive or unavailable economics prevent pi.
- A positive pair reaches pi once; a proposal for another pair remains research
  evidence but is excluded from the issue outcome.
- Completed batch scopes rotate without suppressing another issue.
- Existing exact-context and unconstrained issue tests remain unchanged.
- Studio has no horizontal overflow at desktop or 390 px and introduces no new
  console errors.
- Full type checking, tests, build, and live seven-source smoke pass.

## Live selection evidence

The seven-source runtime retained 467 listings. After the new default policy
reconciled into the durable focused issue, three fresh non-idempotent leases
used one model request each. Two four-listing radar batches produced exact model
selections (`limitless:343816` + `opinion:26456`, then
`limitless:343822` + `opinion:26454`). Both stopped before pi at
`PRICE_UNAVAILABLE`; the gate was bound only to the selected pair.

After another all-source refresh, issue-local feedback routed the task to a
different four-listing batch (`343815`, `343822`, `26454`, `26455`). The model
returned no valid exact cross-venue pair, so `candidateListingRefs` stayed empty,
the economic gate remained `NOT_RUN`, and pi was not invoked. The retained
window reports four model-selection attempts, three selected pairs, one honest
miss, and twelve pi calls avoided. This proves a model now chooses—or declines
to choose—inside bounded retrieval instead of inheriting a program-selected
pair.

## Qualification evidence

The Node 24 workspace `check`, complete test suite, and production build pass.
Control-plane coverage includes 212 tests across 35 files; focused tests prove
exact batch retention, issue-local rotation, model-only pair selection, bigint
gating of only the chosen pair, and rejection of pi substitutions.

Desktop and 390 px browser QA both have zero horizontal overflow and no console
warnings or errors. The live Market archaeologist view reports `3/4`
AI-selected exact pairs, one bounded batch with no model pair, an `11.76%`
positive-gate rate after selection, and twelve pi calls avoided.
