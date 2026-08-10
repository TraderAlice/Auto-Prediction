# Oracle evidence layering

Status: routing live-qualified; catalog-rich-text evidence remains active;
runtime wiring deferred to the Agent execution substrate

Created: 2026-08-10

Related issue: https://github.com/luokerenx4/my-little-pony/issues/84

## Product problem

`ORACLE_SOURCE` currently accepts only an `OUTCOME_RESOLUTION_SOURCE` locator.
That conflates the proposition being proved with the kind of document carrying
the proof. A contract rule can explicitly state which authority or record will
resolve the market even when it does not link directly to that authority.

The live Gemini LAFC contract is the concrete case. Its retained contract text
says the primary resolution source is Major League Soccer's official
announcement and match records, with named fallbacks. The adapter now provides
that exact contract document, yet the requirement remains unsupported and
creates another source-search task because its locator role is
`CONTRACT_RULE_DOCUMENT` rather than `OUTCOME_RESOLUTION_SOURCE`.

## Decision

- Keep locator roles distinct. A contract document never becomes an outcome
  source merely because it names one.
- Allow an `ORACLE_SOURCE` evidence requirement to acquire either a direct
  `OUTCOME_RESOLUTION_SOURCE` or a `CONTRACT_RULE_DOCUMENT` that may prove the
  market's declared source policy.
- Prefer a direct outcome-resolution locator when both exist. Canonical hash
  order must not decide evidence strength.
- A verified contract passage can support only the claim that the venue names
  a particular source or fallback policy. It cannot certify the external
  outcome, prove that the named authority actually published a record, or
  replace an independent resolution observation.
- Preserve the ordinary Agent-first claim boundary: acquisition retains raw
  bytes and first-party passage handles; an interpreter may submit support or
  contradiction, while exact offsets, quote bytes, lineage, and artifact
  validity remain first-party work.
- Source discovery should run only when no compatible evidence document exists.
  Reconciliation may therefore retire a prior oracle-source search task after
  a richer adapter generation supplies contract rules.

## Qualification

- Requirement tests prove both locator roles are admitted for
  `ORACLE_SOURCE`, remain typed, and direct outcome sources win deterministic
  selection when both are fetchable.
- Existing rule/time/void requirements remain contract-rule-only, venue policy
  remains venue-rule-only, and historical posture does not borrow a current
  contract document.
- Scheduler restart tests preserve the chosen locator and do not refetch a
  captured compatible document.
- Live Gemini reconciliation removes the LAFC source-discovery task, routes the
  requirement to the retained contract document, and does not make a provider
  request merely to change routing.
- A focused manual interpretation may be run only after routing is qualified.
  It succeeds only if its evidence artifact actually contains the exact Gemini
  passage; semantic knowledge without citable retained bytes is insufficient.
- Full workspace tests/checks/build and Studio Evidence inspection pass.

## Selection signal

Adopt if this removes false no-source debt without overstating evidence
strength and lets a verified contract passage close the declared-oracle claim.
Rework if the claim kind itself is too ambiguous; split declared resolution
policy from observed external resolution before admitting the broader route.

## 2026-08-10 implementation evidence

- `ORACLE_SOURCE` now admits both typed document roles without relabelling
  either locator. Acquisition gives a direct `OUTCOME_RESOLUTION_SOURCE`
  deterministic precedence over a contract document when both policies are
  fetchable.
- Current contract-rule capabilities can rebase an unsupported oracle claim
  across proposal generations while preserving the target proposal, claim,
  requirement authority, and temporal posture.
- Live reconciliation retired the LAFC source-search task without a provider
  request. The official-source queue moved from 147 to 120 active tasks and
  Gemini from 24 to 19; no active task contains the LAFC ref.
- The LAFC oracle requirement reused an already captured Gemini contract PDF.
  Its acquisition job is `CAPTURED`; the targeted rule-evidence claim completed
  once as `INCONCLUSIVE` because the retained document lacked the catalog text.
- Qualification exposed opposite retention ordering between SQLite and the
  in-memory acquisition and claim schedulers. Both now retain newest
  `updatedAt` generations consistently. The claim window grows to 2,000 and
  fails explicitly if active inputs exceed the configured bound, preventing
  repeated prune/recreate loops. Live acquisition, claim, and source endpoints
  subsequently returned in 0.37-0.41 seconds.
- The contract text itself explicitly names Major League Soccer official
  announcements and match records as the primary resolution source and names
  official club announcements plus four news organizations as fallbacks. The
  pending interpretation may support only that declared-source proposition.

The first targeted interpretation completed in 22 seconds and one attempt, but
exposed two further boundaries. The desk ignored SQLite's `CODEX / terra / high`
selection and used its legacy DeepSeek-only constructor. It also read the
653-character PDF extraction, which contains payout and contingency rules but
not the richer Events-API sentence naming Major League Soccer. The result was
correctly `INCONCLUSIVE` with one first-party passage handle; no false support
was manufactured. Manual dispatch now refuses to run when the selected runtime
provider does not match the desk, preventing another accidental DeepSeek spend.

The next slice must first retain adapter catalog rich text as a source-hashed
evidence artifact rather than assuming the linked PDF contains every catalog
statement. Runtime migration now follows
[`agent-execution-substrate.md`](agent-execution-substrate.md): the requirement
becomes one provider-neutral task, and Pi, Codex, or in-process execution become
separate runs. Do not extend the legacy provider-shaped job generation. Only
after both evidence retention and the new run boundary qualify should this
exact claim be interpreted again. Neither layer may pretend that a declared
source proves the eventual match outcome.

Qualification passes 492 control-plane tests, 17 Studio tests, all 654
workspace tests, all TypeScript project checks, and the production build on the
available Node 22 host. The expected Node 24 engine warning and existing Studio
chunk-size warning remain.
