# Lens-scoped semantic novelty

Status: completed mainline predecessor

Issue: [#213](https://github.com/luokerenx4/my-little-pony/issues/213)

## Product question

When has a completed prototype-guided search actually become stale enough to
justify paying an Agent again? The first live specimen retained useful bounded
exhaustion, but a catalog refresh during the run changed the global corpus
semantic identity and immediately made the same lens eligible again. An
unrelated listing anywhere in the catalog can therefore repurchase every lens.

Exact global corpus identity remains essential evidence lineage. It is not an
attention policy. Persistent discovery needs a second identity that answers a
narrower question: did the semantic neighborhood relevant to this prototype
and variation axis change?

## Decision

Derive a provider-free lens coverage scope from exact corpus listings using
only declared prototype signals, variable-role values, typed predicate-family
cues, known-member exclusions, and deterministic seeds. Bind the exact full
corpus revision to every run as before, but use the lens coverage identity for
once-per-relevant-input campaign novelty.

An unrelated catalog addition must change the auditable input revision without
changing the lens coverage identity. A changed listing already in the scope, a
new deterministic seed, a new exact listing matching the lens's declared
signals/families, or a changed prototype must reopen the lens. Empty relevant
scopes are valid and must retain a stable identity rather than inheriting the
full corpus hash.

## Phase 1 — provider-free coverage identity

- [x] Define and assert an exact lens-scope projection with included listing
  refs, semantic listing identities, deterministic inclusion reasons, and zero
  Agent authority.
- [x] Add the scope identity to exploration input revisions and make semantic
  input identity depend on it rather than the whole corpus semantic identity.
- [x] Prove price/raw/receive-time changes and unrelated semantic additions do
  not reopen a lens, while relevant additions and changed in-scope listing text
  do.
- [x] Preserve full corpus snapshot identity, source set, and exact input hash
  so narrower scheduling novelty never weakens evidence auditability.

## Phase 2 — durable coverage and operation

- [x] Reconcile existing retained results against the new lens coverage
  identity without deleting old inputs or results.
- [x] Project global catalog change separately from relevant lens novelty and
  expose both in Studio.
- [x] Confirm the live counterexample exhaustion closes its relevant scope
  after ordinary refresh, with zero provider/model calls.
- [x] Change one in-scope listing's semantic text and prove the matching lens
  reopens while price/raw/receive-time changes and unrelated additions do not.

The first provider-free implementation keeps the exact full-corpus snapshot,
global semantic identity, source set and ontology identity on every input while
adding a deterministic coverage member ledger. Each member binds an exact
listing ref, price-independent semantic listing identity, and explicit reason.
For a lens with deterministic seeds, those seed refs are the narrowest admitted
coverage neighborhood; zero-seed lenses use declared prototype signals and
role/institution cues without treating the matches as semantic truth.

Live reconciliation now reports the retained counterexample lens as
`EXHAUSTED`, with two relevant contracts, zero uncovered members, one retained
semantic input, and no campaign eligibility. The other three never-attempted
lenses remain eligible. Focused fixtures prove that price/raw/receive-time-only
refreshes and an unrelated semantic catalog addition change the exact input
revision without reopening completed coverage, while changed text on an
in-scope relevant listing produces one uncovered semantic member and reopens
that lens. All derivation remains provider-free.

## Selection gates

- No model, provider request, campaign, run, or write is started by scope
  derivation or read projection.
- The exact full corpus revision remains retained and loadable for every run.
- Global catalog breadth cannot itself reopen every paid research lens.
- Deterministic relevance is only a scheduling boundary. It cannot assert that
  a listing instantiates a mechanism or reject an Agent-discovered analogy.
- Zero-seed and empty-scope lenses remain valid Agent work at least once; the
  scope identity controls repurchase, not initial eligibility.

## Non-goals

- embedding similarity as a hidden semantic authority;
- deleting the full-corpus semantic identity;
- preventing manual operator reruns;
- automatic recurring dispatch before refresh stability is qualified.
