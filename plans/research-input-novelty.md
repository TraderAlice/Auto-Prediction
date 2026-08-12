# Research-input novelty and task continuity

Status: active mainline construction

Issue: [#110](https://github.com/luokerenx4/my-little-pony/issues/110)

Branch: `codex/research-input-novelty`

## North-star role

The AI-native discovery loop now remembers an operator research decision and
compares it with realized evidence. Live restart qualification exposed that a
stable relation family can nevertheless receive a new exact Agent task whenever
anonymous catalogs refresh. That makes observation transport metadata look like
new research, fragments attempt and token history, and turns an unchanged
decision into `REGRESSED_OR_RESCOPED`.

An engineered arbitrage finder must preserve fresh protocol evidence without
confusing freshness with semantic novelty. Otherwise more frequent observation
degrades the quality of the learning loop.

## Ontology decision

Catalog evidence participates in three linked, non-identical identities:

1. **Raw observation identity** binds venue bytes, protocol/normalizer identity,
   receive time, and raw content hash. Every admitted observation remains
   immutable and replayable.
2. **Purpose-specific research-input identity** binds the normalized contract
   semantics used by relation discovery. Receive time, opaque raw hash, current
   status, indicative price, and monetary scale belong to observation/economics,
   not to semantic-relation novelty. Market identity, title, description,
   mechanism, close time, bounded rules, outcome identity/labels, evidence
   locators, and protocol identity remain identity-bearing.
3. **Stable research-task identity** binds the work artifact and tool contract,
   while an exact task revision binds that task to one retained corpus input.
   Catalog changes may add an input revision, but cannot manufacture another
   logical Agent task for the same work proposition.

A reused task continues to cite its original exact corpus. New equivalent
corpora remain retained as fresh confirmations, but do not rewrite the task or
its prior findings. A later freshness-aware dispatch policy may require a recent
confirmation independently of task identity.

## Phase 1 — explicit research-input identity

- Add a canonical purpose-specific projection over normalized contract-semantic
  listing fields. Exclude transport provenance and downstream quote/economic
  state deliberately rather than by accident.
- Include protocol identity, evidence locators, bounded rules, mechanism, close
  time, market/outcome identity, and labels so a semantic contract change
  rotates identity.
- Introduce a v2 provider-neutral task whose identity is independent of a corpus;
  bind an exact corpus in the current retained task revision, which the manual
  preview/dispatch path resolves without changing the logical task identity.
- Live qualification showed that excluding the corpus was insufficient because
  the full ontology work artifact itself contains rotating source issue revision
  IDs. The selected v3 contract therefore separates the stable actionable work
  contract from its complete provenance-bearing work item as well.
- Emit v2 task revisions carrying the research-input identity while continuing
  to validate and replay retained v1 revisions byte-for-byte.
- Prove transport-only refresh is stable and listing/rules/price/source-content
  changes are novel.

## Phase 2 — retained-revision reconciliation

- Reconcile each runnable work artifact against retained revisions rather than
  blindly materializing a fresh batch.
- Resolve a v1 revision's research-input identity from its exact retained corpus;
  never rewrite the v1 record.
- Reuse an exact prior revision when work artifact and research input match,
  including an identical content state returning after an intervening change.
- Return explicit created/reused counts and identities for qualification.
- Always retain the new exact corpus observation, even when every task is reused.

## Phase 3 — startup integration and continuity

- Save only newly created relation revisions during startup reconciliation;
  idempotently retain one stable Agent task per work artifact and keep the
  current in-memory work mapping pointed at reused or newly bound input
  revisions.
- Do not create runs, campaigns, invocations, provider calls, fetches, or
  dispatch authorization.
- Preserve relation findings, semantic review, attention allocation, action
  targets, and decision-outcome lineage through observation-only refreshes.
- Keep material content changes visible as exact target rescope rather than
  over-deduplicating them.

## Phase 4 — qualification

- Unit-qualify transport-only, raw-hash-only, material listing, work-artifact,
  v1 replay, and missing-retained-corpus cases.
- Persist a v1 revision and prove a v2-era reconciliation can reuse it using its
  retained corpus without altering the stored record.
- Reconcile the same SQLite-backed fixture twice and prove the second pass adds
  one corpus confirmation but zero Agent tasks or task revisions.
- Restart the live read-only desk with all AI timers disabled; compare corpus,
  revision, task, run, invocation, campaign, and token counters.
- Run workspace check, full tests, production build, and inspect any changed
  Studio surface if one is introduced.

## Qualification gates

- [x] equivalent research content produces the same research-input identity;
- [x] receive-time, opaque-raw-hash, quote, scale, and status-only changes do not
  create tasks or semantic-input revisions;
- [x] normalized contract-semantic changes create a successor input revision;
- [x] corpus content changes do not create a second logical Agent task;
- [x] provenance-only work-artifact changes create a successor input revision but
  preserve the actionable work-contract task identity;
- [x] retained v1 and experimental v2 revisions replay without mutation;
- [x] missing evidence fails closed to a new exact revision rather than guessing;
- [x] repeated SQLite reconciliation retains observations but adds zero tasks and
  zero revisions;
- [x] live restart does not grow the relation-discovery logical Agent task ledger;
- [x] no provider, run, campaign, fetch, dispatch, external-write, or value-moving
  authority is introduced;
- [x] workspace check, all suites, and build pass after final qualification edits.

## Non-goals

- suppressing or deleting raw/catalog observations;
- treating elapsed time as semantic novelty;
- automatically re-running a task because evidence was freshly confirmed;
- collapsing materially changed rules, outcome semantics, locators, mechanism,
  close time, or protocol content;
- treating quote or availability change as relation-semantic novelty; those
  remain inputs to downstream economics and dispatch eligibility;
- provider choice, model routing, or learned scalar allocation policy;
- live orders, credentials, signatures, funds, or execution authority.

## Live checkpoint — 2026-08-12

The first v3 startup created one stable work-contract task for each of the two
live relation families. A second startup observed another exact catalog and
rotated both full provenance-bearing work artifacts and both purpose-specific
research inputs. The retained corpus count moved 27 → 28 and relation input
revisions moved 54 → 56, while relation Agent tasks remained exactly 54. Within
v3, each family now has two exact input revisions but one distinct task ID.

The qualification process had already created four experimental v2 tasks before
the full-work-artifact rotation was discovered, so the durable ledger contains
48 historical v1, four experimental v2, and two current v3 logical task IDs. No
record was rewritten or deleted. Runs remained 241, model invocations 498,
campaigns 20, and known input/output/reasoning usage remained
2,068,225 / 19,328 / 4,904. All Agent timers were disabled and startup reported
zero provider requests and model invocations.

Workspace check, all suites (84 control-plane files / 587 tests and four Studio
files / 24 tests), and production build pass. The known Node 24 engine
expectation and existing Studio chunk-size warning remain non-blocking.

The full Agent task ledger still grew 3,037 → 3,101 on the second v3 restart.
All 64 new records were upstream ontology-normalization tasks, not relation
tasks. This is new evidence for the next continuation: generalize stable work
contracts and exact input revisions to ontology normalization rather than
mistaking relation-local continuity for system-wide continuity.
