# Semantic scope rotation

Status: active
Started: 2026-08-02

## Outcome

Turn cheap-model negative and completed-search evidence into broader recurring
coverage. Each durable issue should inspect a new exact radar pair before it
repeats an unchanged semantic scope, while price changes remain capable of
reactivating economically blocked pairs.

## Runtime evidence

The fresh seven-source corpus contains 467 listings and five lexical radar
pairs. The top pair has an indicative 1,100 bps gross hint, but it joins
Gemini's `MLS Cup Champion — Nashville SC` contract to a Kalshi multi-game
parlay that merely contains “Nashville”. The cheap semantic lane returned no
hypothesis and correctly prevented pi escalation.

That negative result is retained in a search lease, but it does not influence
the next radar assignment. Candidate IDs bind source receive time and whole
response hashes, so every catalog refresh can make the same contract pair look
new even when its rules and outcome meanings did not change. The first radar
pair is selected again for every equivalence lease. Lower-ranked candidates may
therefore starve behind a persistent lexical collision.

## Architecture decision

Every bounded search context receives two content identities:

- a semantic-scope identity over exact listing refs, titles, descriptions,
  rules, status, mechanism, close time, outcome IDs/labels, scales, and protocol
  identity, excluding receive time and indicative prices;
- a routing identity over that semantic identity plus current indicative
  outcome prices.

The lease scheduler derives issue-local feedback from retained terminal exact
pair records. Completed semantic work deprioritizes the unchanged semantic
identity. Economic-gate blocks consume only the unchanged routing identity, so
a price change can reactivate the pair without pretending its contract meaning
changed.

For equivalence radar selection, candidates are tiered in this order:

1. unseen semantic scope and unseen routing posture;
2. unseen semantic scope with a previously attempted routing posture;
3. previously examined semantic scope with new routing evidence;
4. fully repeated scope after the current candidate pool is exhausted.

Original economic-first and lexical ordering remains stable inside each tier.
Feedback is issue-local, bounded by retained leases, auditable, and cannot make
a semantic or economic decision.

## Construction slices

- [ ] Add stable semantic and price-sensitive routing scope identities.
- [ ] Bind both identities into exact-pair lease audit records.
- [ ] Derive issue-local attempted and completed scope feedback.
- [ ] Rotate radar assignment with deterministic feedback tiers.
- [ ] Report unique semantic scopes, repeated scopes, and no-lead scopes by issue.
- [ ] Show semantic coverage feedback in Harmony Studio.
- [ ] Prove legacy retained leases still hydrate without scope metadata.
- [ ] Run focused/full Node 24 checks, live multi-refresh rotation, and responsive QA.
- [ ] Publish and serially merge the campaign PR.

## Safety invariants

- Identity construction is deterministic and contains no model judgment.
- Indicative price changes never mutate the semantic identity.
- Contract, outcome, status, close, mechanism, or protocol changes do mutate the
  semantic identity and make the scope eligible for fresh inspection.
- An economic block may be reconsidered when its routing identity changes.
- Failed or interrupted Agent work never suppresses a scope.
- Rotation is search routing only; it cannot approve semantics, suppress
  retained evidence, certify profit, authorize execution, or move value.
- General bounded contexts remain compatible even when they are not exact pairs.

## Qualification gate

- A price-only or receive-time-only refresh preserves semantic identity while a
  price change mutates routing identity.
- A rule, outcome-label, close-time, mechanism, status, or protocol change
  mutates semantic identity.
- After a terminal no-candidate exact-pair lease, the same issue selects the
  next unseen radar pair on the next corpus.
- After a non-positive economic block, an unchanged price posture rotates away
  while a changed price posture may be selected again.
- Once every current pair has been attempted, deterministic fallback keeps the
  issue live instead of dead-ending.
- Existing v1 lease records without scope metadata load after restart.
- Studio renders retained-window coverage and revisit counts without horizontal
  overflow at desktop and 390 px.
- Full type checking, tests, production build, and a live seven-source
  multi-refresh smoke pass.
