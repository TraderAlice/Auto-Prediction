# Exact relation-finding input lineage

Status: active mainline construction

Issue: [#121](https://github.com/luokerenx4/my-little-pony/issues/121)

Branch: `codex/exact-relation-finding-lineage`

## North-star role

AI-native research must be free to revisit one stable research task as market
evidence changes without allowing outputs from different evidence snapshots to
bleed together. A task names the durable question; a task revision binds the
exact work artifact and corpus observed by one run. Downstream semantic review
must therefore compile findings from exact revision lineage, never from a
task-only shortcut.

## Live evidence

Run `sha256:f59503c187007eefe89969d69876d541ffe94a503e682bfbb0758c4bc7370ea5`
retained a valid relation hypothesis and counterexample against corpus
`sha256:786b28be4f3b7e5b5c4773743c86dc4054480171279d66c0f9c08029239adfed`.
The same task ID also has an older revision bound to corpus
`sha256:dbf535ab6266905f453b53d9b46bb82dc3ec7543c30c844521fb86a7431866a0`.
SQLite loads revisions newest-first, but a `Map<taskId, revision>` let the older
record overwrite the newer one. `/api/v1/relation-discovery` then failed the
valid finding's lineage assertion and terminated the process through an
unhandled asynchronous request rejection.

## Decision

Compile each finding against an exact composite lineage key:

1. stable Agent task ID;
2. ontology relation work-item ID;
3. immutable work-artifact hash; and
4. retained corpus snapshot identity.

Different revisions may share a task ID. No exact match fails closed, and more
than one distinct revision for the same exact tuple is ambiguous and also fails
closed. Request-level projection failures return a bounded error response
instead of terminating the control-plane process; they do not silently discard
or reinterpret the offending record.

## Implementation phases

### Phase 1 — exact compiler selection

- [x] Replace task-only revision lookup with exact composite lineage.
- [x] Preserve deterministic compilation independent of durable load order.
- [x] Reject missing or ambiguous exact lineage.

### Phase 2 — process containment

- [x] Contain uncaught asynchronous route failures at the HTTP request boundary.
- [x] Return no execution, external-write, or value-moving authority on failure.

### Phase 3 — qualification

- [x] Reproduce old and refreshed corpus revisions sharing one task identity in
  a focused regression test.
- [x] Run workspace checks, all suites, and the production build.
- [x] Restart mainline candidate against the retained live SQLite state and
  prove relation discovery, allocation, and decision projections are readable.

## Implementation checkpoint — 2026-08-12

The batch semantic compiler now indexes corpus-bound task revisions by the exact
task/work/artifact/corpus tuple and rejects a second distinct revision for that
same tuple as ambiguous. A regression compiles findings from both old and
refreshed corpus revisions while supplying revisions in durable newest-first
order. The HTTP request boundary now contains otherwise-unhandled asynchronous
projection errors as bounded 500 responses with no execution, external-write,
or value-moving authority.

Workspace checks, all suites (86 control-plane files / 602 tests, four Studio
files / 24 tests, and all remaining packages), and the production build pass.
The known Node 24 engine expectation and existing Studio chunk-size warning
remain.

The candidate restarted against the unchanged live SQLite database and returned
HTTP 200 for relation discovery, research attention allocation, research
decision outcomes, and ontology allocation outcomes. The live hypothesis now
compiles through exact revision
`sha256:4abcb2d74a16c540aa34efdae817424e40eaf5e3e78440478c8e6bb937d56b46`
and corpus
`sha256:786b28be4f3b7e5b5c4773743c86dc4054480171279d66c0f9c08029239adfed`.
The original ontology allocation outcome retains both relation runs and their
combined downstream cost: 12 model invocations, 10 tool effects, 253,962 input,
2,719 output, 1,455 reasoning tokens, and 240,827 ms. Reads started zero model
invocations, provider requests, campaigns, runs, scheduler dispatches, or
writes. Runtime configuration remains Codex Terra/high with DeepSeek automation
disabled.

This verification also exposed a separate stage-classification issue: the
relation projection correctly reports `AWAITING_SEMANTIC_REVIEW` for a merely
`LEASED` semantic-review job, while ontology allocation outcomes currently call
the same lineage `SEMANTICALLY_REVIEWED`. That becomes the next mainline issue;
it is not folded into exact-lineage selection.

## Non-goals

- changing stable task identity or corpus-refresh materialization;
- auto-admitting relation hypotheses into semantic or probability authority;
- deleting or rewriting either retained revision or live finding;
- retrying another model run;
- live orders, signatures, transactions, credentials, or funds.
