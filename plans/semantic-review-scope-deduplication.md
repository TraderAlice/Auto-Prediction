# Semantic-review scope deduplication

Status: active
Started: 2026-08-02

## Outcome

Make recurring AI search accumulate semantic knowledge instead of paying for a
new adversarial review whenever pi phrases the same relation differently or a
new catalog snapshot produces a new proposal artifact. Preserve every proposal
and historical review, but dispatch at most one automatic review for an
unchanged semantic relation scope.

## Runtime evidence

The live seven-source system currently retains 102 automatic-review candidates:

- 11 proposal artifacts pass the compiler-shape admission policy;
- those 11 artifacts describe only eight relation-and-listing scopes before
  contract evidence is considered;
- the same directional Atlanta `IMPLIES` pair appears three times;
- the same symmetric Myriad `EQUIVALENT` pair appears twice with reversed refs;
- automatic semantic review has started 114 requests;
- current pre-review economics contain zero positive gross hints, five
  non-positive hints, three unavailable prices, two explicit settlement
  blockers, and one current-contract mismatch.

Search-level novelty already prevents repeated pi escalation for an identical
selected listing signature. It does not protect the semantic-review scheduler
from multiple proposal artifacts emitted for the same exact relationship or
retained from earlier scheduler generations.

After scope backfill on the live v17 store, 102 durable jobs mapped to only 81
price-independent semantic scopes. Seventeen completed reviews were redundant
passes inside a scope; one repeated four-listing `RELATED` scope alone retained
six passed reviews plus one current research-only disposition. The migration
preserved every historical result, and repeated live ticks held the request
counter at 114 with no active, due, pending, leased, or retry-wait work.

## Architecture decision

1. derive a price-independent contract-semantic identity from the exact listing
   evidence used by search, excluding receive time, raw catalog hash, and
   indicative prices;
2. bind that evidence identity to relation kind and relation direction;
3. canonicalize listing order only for symmetric `EQUIVALENT`,
   `MUTUALLY_EXCLUSIVE`, and `EXHAUSTIVE` relations;
4. preserve order for `IMPLIES` and `SUBSET`;
5. treat proposals without a durable v2 evidence bundle as unscoped and never
   deduplicate them by guesswork;
6. keep historical passed reviews passed; expose redundant historical passes
   as measured evidence rather than rewriting them;
7. persist new same-scope proposals as `DUPLICATE_SCOPE`, linked to one stable
   canonical job, with zero automatic model requests;
8. allow an explicitly requested manual advisory review to complete a duplicate
   proposal independently;
9. changed title, description, rules, outcomes, close, mechanism, scales, or
   protocol identity creates a new review scope and may be reviewed again;
10. project unique scopes, withheld duplicates, and historical redundant passes
    over HTTP and in Studio.

## Construction slices

- [x] Add a content-addressed semantic-review scope identity with symmetric and
  directional relation tests.
- [x] Add durable `DUPLICATE_SCOPE` scheduler disposition and canonical-job
  lineage.
- [x] Preserve passed and leased work while reconciling legacy jobs into scopes.
- [x] Add SQLite schema v17 migration and restart qualification.
- [x] Expose scope efficiency and historical redundancy in scheduler projection
  and HTTP.
- [x] Show scope reuse and avoided automatic work in Studio.
- [x] Document how recurring scans reuse semantic knowledge.
- [x] Run full checks, production build, live v16-to-v17 migration smoke, and
  desktop/390 px QA.
- [ ] Publish and serially merge the campaign PR.

## Safety and boundedness

- Scope reuse grants no semantic acceptance, simulation, certificate, or
  execution authority.
- A prior review is reusable only for an identical relation direction and
  price-independent contract-semantic identity.
- Proposal artifacts and historical reviews remain immutable and visible.
- A leased request may finish; reconciliation does not cancel provider work.
- Missing evidence fails open to separate review work rather than deduplicating
  unrelated contracts.
- No order, signature, token approval, credential request, or value-moving
  operation is introduced.

## Qualification gate

- Same evidence plus the same directional relation dispatches one automatic
  review even when statement, rationale, falsifiers, proposal ID, or catalog
  snapshot differ.
- Reversed `EQUIVALENT` refs share a scope; reversed `IMPLIES` and `SUBSET` refs
  do not.
- A semantic contract-field change produces a new scope.
- A missing or legacy evidence bundle is never scope-deduplicated.
- Existing passed jobs remain passed; new matching jobs become
  `DUPLICATE_SCOPE` without incrementing request attempts.
- Restart cannot turn a duplicate back into pending or due work.
- Explicit manual review can still produce a proposal-specific advisory report.
- Studio remains readable at desktop and 390 px without horizontal overflow.

## Qualification evidence

- `pnpm check`, all workspace tests, and the production build pass; the
  control-plane suite contains 245 passing tests, including scope identity,
  dispatch, restart, lease preservation, and manual-review qualification.
- The live SQLite WAL store migrated from schema v16 to v17 without replaying
  provider work. It projects 102 scoped jobs, 81 unique semantic scopes, 17
  historical redundant passes, zero due/leased/retry work, and a stable 114
  request-attempt count across repeated ticks.
- Historical passes remain immutable. The live store has no newly arriving
  duplicate after migration, so `duplicateScopeCount` is currently zero; unit
  and SQLite-restart tests prove that the next same-scope proposal persists as
  `DUPLICATE_SCOPE` and dispatches no automatic request.
- Studio renders the scope ledger at desktop and 390 px. Measured document
  width equals viewport width at both sizes, long evidence identities wrap,
  and the browser reports no runtime error or warning.
