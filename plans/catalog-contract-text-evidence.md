# Catalog contract-text evidence

Status: active mainline construction

Created: 2026-08-13

Branch: `codex/catalog-rich-rule-evidence`

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

Evidence on 2026-08-13: schema 45 stores one content-addressed field artifact
behind a foreign key to the exact raw catalog observation. The artifact binds
the source hash, normalizer identity, normalized protocol listing hash, a
versioned `rulesText` field-derivation identity and the final text hash. Focused
tests prove two listings from the same response cannot share field text,
truncated text is ineligible, repeated derivation is idempotent, referenced raw
bytes survive per-venue pruning, restart is lossless and changed SQLite JSON
fails closed. The full control-plane suite passes 619 tests without a provider
request or model invocation.

## Phase 2 — requirement-bound supply

- [ ] Admit catalog text only for rule-semantic requirement kinds and only when
  requirement listing ref, venue, protocol, source raw hash and temporal posture
  match exactly.
- [ ] Keep linked-document and catalog-text supplies separate; do not merge or
  prefer by hash order. One requirement may expose both as alternative evidence.
- [ ] Reconcile one stable provider-neutral Rule Evidence AgentTask per exact
  requirement/evidence artifact without creating a legacy provider-shaped job.

## Phase 3 — Agent-native claim and operator proof

- [ ] Generalize the Rule Evidence text tools and claim lineage from
  document-only capture to an exact text-evidence source union while preserving
  all historical document claims byte-for-byte.
- [ ] Make the legacy `/rule-evidence-claims/:job/run` path compatibility-only;
  new catalog-text work executes through manual Agent runs or explicit campaigns.
- [ ] Qualify the retained LAFC oracle-source task with the selected execution
  profile only after preview confirms runtime/model/credential/budget. A second
  interpretation is prohibited until the exact catalog artifact is present.

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
