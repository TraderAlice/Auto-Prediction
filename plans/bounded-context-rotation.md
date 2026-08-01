# Bounded context rotation

Status: active
Started: 2026-08-02

## Outcome

Make every durable semantic-search issue expand through the market corpus like
an Agent searching related files in a repository. A general issue must inspect
an unseen, content-addressed market neighborhood before repeating an unchanged
bounded context, while preserving deterministic fallback after the current
neighborhood pool is exhausted.

## Runtime evidence

The current live corpus contains 467 listings from seven eligible sources. The
implication issue has seven terminal leases and no candidate. Only the first
post-identity lease exposes its context: the same 18 listings from
`limitless:343640` through the Myriad `Up or Down?` contracts. The mechanism
issue likewise exposes one 23-listing context and three older unscoped leases.

`CatalogObservationDesk.context()` ranks a generic issue question and returns
one deterministic top slice. Catalog receive-time churn changes the corpus
identity but does not change that selection. `SearchLeaseScheduler` records a
`BOUNDED_CONTEXT` identity, yet its feedback collector explicitly retains only
`EXACT_PAIR` scopes. The server therefore has no signal or alternative context
pool with which to rotate general issues.

## Architecture decision

For non-radar search, construct a bounded candidate pool consisting of:

1. the existing question-ranked primary context;
2. deterministic anchor neighborhoods, each formed by adding one current
   listing's title trailhead to the issue query and reusing the bounded catalog
   selector;
3. unique contexts only, identified by the same price-independent semantic
   scope identity retained in the lease.

Candidates use the existing four routing tiers: unseen semantic/unseen routing,
unseen semantic/attempted routing, completed semantic/new routing, and fully
repeated fallback. Anchor order and all ties are deterministic. Feedback is
issue-local and includes successful terminal `BOUNDED_CONTEXT` scopes as well
as exact pairs. Failed or interrupted Agent work never suppresses a context.

This is retrieval routing, not model judgment. It changes which bounded public
contracts the cheap Agent sees; it cannot declare a relationship, approve a
review, certify economics, or authorize execution.

## Construction slices

- [ ] Build deterministic primary plus anchor-neighborhood context candidates.
- [ ] Select candidates with issue-local semantic/routing feedback tiers.
- [ ] Generalize terminal feedback from exact pairs to all retained scopes.
- [ ] Preserve current one-context API behavior for existing callers.
- [ ] Report bounded-context coverage, revisits, and no-lead scopes by issue.
- [ ] Expose exact-pair and bounded-neighborhood coverage separately in Studio.
- [ ] Prove receive-time/source-hash refreshes rotate to a different semantic
  neighborhood rather than merely reordering the same one.
- [ ] Run focused/full Node 24 checks, production build, live multi-refresh
  smoke, and desktop/390 px QA.
- [ ] Publish and serially merge the campaign PR.

## Safety invariants

- Context candidates contain only currently qualified anonymous catalog data.
- Context and ordering identities are deterministic and contain no model
  confidence or semantic decision.
- Every returned context remains within the existing 30-listing and 50,000
  character bounds.
- Completion feedback is issue-local and bounded by retained leases.
- Failed, interrupted, or corrupt work never suppresses a scope.
- Price and receive-time evidence never mutate semantic identity.
- Exhausting the current pool falls back deterministically instead of disabling
  an issue.
- No new credential, signing, order, transaction, fund, or live-execution path
  is introduced.

## Qualification gate

- Existing `buildDiscoveryCatalogContext()` callers receive the same primary
  selection.
- One issue receives different bounded semantic scopes on successive corpora
  when the first scope completed and contract semantics did not change.
- The same completed scope does not suppress another issue.
- A failed scope remains immediately eligible.
- Once every candidate is completed, deterministic fallback returns a valid
  bounded context.
- Retained legacy leases without semantic scope metadata still hydrate.
- Coverage totals distinguish exact pairs from bounded contexts without
  double-counting issue-local identities.
- Studio has no horizontal overflow at desktop or 390 px and introduces no new
  console errors.
- Full type checking, tests, build, and live seven-source smoke pass.
