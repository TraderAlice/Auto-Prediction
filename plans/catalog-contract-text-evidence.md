# Catalog contract-text evidence

Status: active mainline construction

Created: 2026-08-13

Branch: `codex/contract-semantic-continuity`

## North-star role

Durable semantic-arbitrage discovery depends on proving settlement meaning from
the evidence a venue actually publishes. Gemini's anonymous Events response
contains listing-specific contract text that is richer than its linked rules
PDF. Treating the PDF as the only evidence document leaves a false oracle-source
debt; copying catalog prose into a prompt without its source bytes and listing
lineage would create an unauditable semantic shortcut.

## Ontology decision

A venue catalog observation and a linked document are distinct evidence
objects even when both describe one contract:

- a linked document is identified by its fetched bytes, locator, redirect and
  network observation;
- catalog contract text is a field-level derivation from one retained anonymous
  catalog observation, bound to the observation bytes, normalizer identity,
  exact normalized listing identity, listing ref, field name and text hash;
- either may support an advisory claim, but neither inherits facts from the
  other and neither proves the eventual external outcome.

No synthetic URL or invented document observation may bridge these sources.

## Phase 1 — evidence object and retention

- [x] Define and validate a content-addressed `CATALOG_CONTRACT_TEXT` artifact
  with exact raw-observation and normalized-listing lineage.
- [x] Derive it only from complete retained `rulesText`; truncated or absent
  catalog text remains ineligible.
- [x] Persist the text and metadata additively in SQLite and prove restart,
  tamper rejection, idempotency and retention independence from catalog pruning.

Evidence on 2026-08-13: schema 46 stores one content-addressed field artifact
behind a foreign key to the exact raw catalog observation. The artifact binds
the source hash, normalizer identity, normalized protocol listing hash, a
versioned `rulesText` field-derivation identity and the final text hash. Focused
tests prove two listings from the same response cannot share field text,
truncated text is ineligible, repeated derivation is idempotent, referenced raw
bytes survive per-venue pruning, restart is lossless and changed SQLite JSON
fails closed. The full control-plane suite passes 619 tests without a provider
request or model invocation.

## Phase 2 — requirement-bound supply

- [x] Admit catalog text only for rule-semantic requirement kinds and only when
  requirement listing ref, venue, protocol, source raw hash and temporal posture
  match exactly.
- [x] Keep linked-document and catalog-text supplies separate; do not merge or
  prefer by hash order. One requirement may expose both as alternative evidence.
- [x] Reconcile one stable provider-neutral Rule Evidence AgentTask per exact
  requirement/evidence artifact without creating a legacy provider-shaped job.

Evidence on 2026-08-13: catalog supply additionally matches the exact discovery
listing hash and is limited to one current listing for a rule-semantic
requirement. Historical, multi-listing, stale-hash and cross-listing inputs fail
closed. Document and catalog supplies produce independent tasks for one
requirement; only the document path enters the compatibility scheduler. Catalog
tasks are reconciled after refresh and during projection without model dispatch.

## Phase 3 — Agent-native claim and operator proof

- [x] Generalize the Rule Evidence text tools and claim lineage from
  document-only capture to an exact text-evidence source union while preserving
  all historical document claims byte-for-byte.
- [x] Make the legacy `/rule-evidence-claims/:job/run` path compatibility-only;
  new catalog-text work executes through manual Agent runs or explicit campaigns.
- [x] Qualify the retained LAFC oracle-source task with the selected execution
  profile only after preview confirms runtime/model/credential/budget. A second
  interpretation is prohibited until the exact catalog artifact is present.

Evidence on 2026-08-13: the shared first-party search/read/terminal-effect tools
now resolve passages over a validated text-source union. Historical v1/v2
document claims and their Agent task identities are unchanged. Catalog claims
write v3 source lineage into a dedicated schema-46 table with a foreign key to
the catalog artifact; citation slices are rechecked against retained field text
on save and restart. Historical document-only enriched scopes retain their exact
v1 field shape and identity; only catalog-backed scopes use the new source-union
v2. Semantic-review enrichment selects one current claim per requirement across
alternative document or catalog supplies. The full suite passes 621 tests with
zero provider requests or model invocations.

## Phase 3 qualification recovery

- [x] Keep startup reconciliation proportional to new Agent tasks instead of
  rewriting and reloading the complete execution ledger for an unchanged set.
- [x] Prefer self-describing relation-work revisions before loading a retained
  legacy corpus, and raise the explicit bounded live-catalog ceiling from 5,000
  to 10,000 listings after the anonymous catalog crossed the former limit.
- [x] Preserve mutable task metadata updates on the full store path; use the
  additive path only for genuinely new task identities.
- [x] Materialize catalog evidence for the requirement's semantic source
  generation rather than assuming the latest price-bearing listing hash must
  match. This must remain fail-closed when contract text or other contract
  semantics change.

Live evidence on 2026-08-13 found startup was dominated by repeated full-ledger
writes and legacy relation-corpus hydration. Incremental task reconciliation,
revision preference and bounded catalog growth reduced measured internal
startup reconciliation to about 13 seconds: rule-evidence task reconciliation
3.495 seconds, legacy migration 0.377 seconds, ontology 1.637 seconds, and
relation reconciliation 7.820 seconds. The full 90-file control-plane suite
passes 625 tests; check and build pass on Node 22 with only the repository's
known Node 24 engine expectation.

The same qualification found 80 exact catalog field artifacts but zero v2 Rule
Evidence Agent tasks. Requirements retained the listing/source observation that
created the research question, while the supply path only materialized the most
recent catalog observation. Quote changes rotated the complete discovery
listing identity even though `rulesText` was unchanged, so the exact validator
correctly rejected the mismatched generations. The next phase must separate
market observation identity from contract-semantic and field-evidence identity;
it must not weaken source hashes or silently call a changed contract current.

## Phase 4 — observation/contract continuity

- [x] Separate volatile catalog-observation identity from contract-semantic
  identity without discarding either one.
- [x] Persist a self-verifying continuity artifact containing the prior exact
  listing, current exact field artifact, both raw/time/listing identities, the
  bounded contract-semantic projection and rules-text hash.
- [x] Reconcile one stable `RULE_EVIDENCE_TASK_V3` from the requirement,
  contract semantics and field text; keep current observation lineage in the
  tool host and final claim rather than rotating the research task.
- [x] Persist v4 claims with the exact continuity generation they actually read,
  while allowing unchanged semantics/text to satisfy the current review scope.

Live evidence on 2026-08-13: schema 47 retained eight independently replayable
continuity artifacts and restored eleven v3 Rule Evidence tasks from the same
ledger that previously supplied zero. A successor startup retained the current
task identity for each unchanged requirement/contract/text tuple. Two live
startup failures also corrected real construction defects before inference:
catalog limits moved to a leaf module to remove an ESM initialization cycle,
and V3 now hashes and executes the same stable research payload. Pre-runtime
failures retain their bounded concrete diagnostic rather than collapsing into a
generic dispatcher error.

One operator-authorized Codex app-server / `gpt-5.6-terra` high run then
completed the LAFC ordinary-settlement-source requirement. Eight successful
model invocations used 151,110 input, 840 output and 315 reasoning tokens; five
searches, two reads and one terminal submission were accepted by first-party
tools. The resulting v4 claim is intentionally `INCONCLUSIVE`: the exact
653-character Polymarket US field proves elimination, cancellation and
multi-winner treatments, but does not state the sole-winner affirmative mapping,
controlling result source or finality standard. The claim retains the exact
current catalog artifact, continuity ID and stable contract-semantic identity.
This is useful negative evidence, not a failed attempt and not permission to
infer equivalence.

The same live run exposed a product-level successor question: historical Agent
tasks remain audit-visible after their stable contract changes, but the console
does not yet distinguish a current runnable task from a superseded task whose
input resolver has intentionally moved on. That must become explicit before
recurring dispatch is widened.

## Qualification gates

- projection/reconciliation starts zero provider requests, model invocations,
  campaigns, runs, external writes or value-moving actions;
- current catalog text cannot satisfy a historical-source requirement;
- one raw observation containing many listings cannot let one listing cite
  another listing's text;
- citation ranges resolve against the retained field text, not reconstructed or
  freshly fetched prose;
- claim authority remains advisory; semantic review and exact verification stay
  independent;
- full tests, checks, production builds and live SQLite restart pass before
  selection.

## Authority boundary

This plan authorizes deterministic derivation and local persistence from
already retained anonymous catalog bytes. It authorizes no new network fetch,
provider request, model invocation, campaign activation, live order, signature,
transaction, credential access or funds movement.
