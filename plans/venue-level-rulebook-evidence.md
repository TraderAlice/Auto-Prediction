# Venue-level rulebook evidence

Status: passage-handle interpretation live; contract-specific locator gap measured

Created: 2026-08-10

## Product problem

A market's own resolution text may still depend on venue-wide review,
fallback, appeal, cancellation, or discretionary policy. Treating the listing
body as the whole settlement protocol can therefore manufacture certainty.
The evidence system already knows how to retain a content-addressed document,
but listings need a first-party locator that reaches the applicable venue-level
rules without giving the Agent open-web fetch authority.

## Decision

- Fresh Polymarket US catalog listings attach the current official CFTC-hosted
  rulebook as a `CONTRACT_RULE_DOCUMENT` locator.
- The catalog normalizer identity changes when this locator becomes part of the
  normalized listing. Historical observations replay under their original
  normalizer and require a fresh capture for the new evidence posture.
- The first-party fetch policy allows only the exact CFTC host, HTTPS, bounded
  bytes, and the official DOCX content type. Redirects, DNS, content encoding,
  and Clash fake-IP posture retain the existing fail-closed checks.
- DOCX extraction produces bounded untrusted text and preserves the raw bytes,
  receive time, headers, source URL, hashes, and protocol identity.
- Venue policy is evidence, not automatic support. A rulebook passage may
  support, contradict, or leave a requirement inconclusive; only quote-verified
  Agent claim effects enter an enriched review scope.

## Qualification

- Adapter and catalog tests bind the locator to every fresh Polymarket US
  listing and keep unrelated venues unchanged.
- A minimal DOCX fixture proves extraction and byte/text bounds.
- Historical catalog observations are verified against their old normalizer
  before being retired for fresh capture; no retained hash is reinterpreted.
- Live anonymous capture of the June 2026 CFTC filing retrieved 4,140,483 bytes
  and extracted 197,796 characters, including the Contract Outcome Review
  Process and venue-discretion language.
- Semantic review remains conservative when that language does not determine a
  listing-specific state. No document capture grants simulation, certificate,
  execution, credential, signing, or value-moving authority.

## Next evidence

The evidence path is now automatic. A proposal keeps its original evidence and
review immutable, but exact listing refs may be rebound to the current corpus
when contract semantics, official locators, or retained-rule completeness has
materially changed. The new v3 review scope binds that evidence capability;
price, receive-time, and raw-response churn do not trigger another model run.
Legacy v1/v2 scopes remain readable and migrate through ordinary scheduler
reconciliation.

Live qualification enabled the anonymous acquisition and rule-claim timers.
Eight official documents are now captured in SQLite, ten retained review jobs
use exact-current rebases, and the first persistent batch reached forty-one
conservative `INCONCLUSIVE` claims. The initial traffic also exposed 24
loops that inspected documents but never emitted a terminal claim. The Agent
protocol now forces reading before disposition, offers an explicit abstention
tool, narrows late steps to submit/abstain, and converts a still-nonterminal
bounded loop into an explicit first-party `INCONCLUSIVE` effect instead of
burning every retry. It cannot silently support or contradict a requirement.

Those safe recoveries exposed a second, more precise protocol defect: the Agent
was still asked to reproduce quote bytes in its terminal payload. Submission
now contains only start/end ranges that must lie inside a prior search/read
effect; first-party code copies the exact quote from retained text and verifies
the finished claim. A natural DeepSeek V4 Flash smoke then returned `SUPPORTS`
in one read plus one terminal effect with a verified 74-character citation.
Fixed-schema byte copying is no longer part of the model's job.
The legacy-format queue then drained completely: 41 PASS artifacts, zero
exhausted jobs, and zero remaining retries, all conservative rather than
silently promoted.

Persistent interpreter identity is now a first-class migration boundary. The
range-only and forced-terminal experiments remain readable as historical
protocol generations, but only the current identity can satisfy a current
requirement or count as a current Studio result. Scheduler projection v2 names
the current interpreter, separates current jobs from retained legacy jobs, and
keeps historical PASS totals explicit. This prevents a safe but low-yield
`INCONCLUSIVE` run from permanently deduplicating a materially improved Agent
tool protocol.

Live traffic then exposed two places where the harness was still assigning
machine work to the model. First, valid supporting citations were rejected
when the Agent also retained honest unresolved caveats; current claims allow
quoted `SUPPORTS`/`CONTRADICTS` and unresolved items to coexist. Second,
absolute character offsets remained brittle even after quote copying moved
outside the model. Search/read effects now mint content-addressed `passageId`
handles. The terminal tool accepts only handles previously returned in the
same loop; first-party code resolves their offsets, copies the retained quote,
and verifies the final artifact. Late loop states force one submit attempt and
then force explicit abstention, so parallel search calls cannot consume the
entire bounded loop without a terminal effect.

The first live passage-handle artifacts prove that exact citation transfer is
working: a current claim retained a first-party 2,000-character Contract Rules
passage without model-authored quote bytes or offsets. It remained
`INCONCLUSIVE` for a substantive reason. The captured CFTC venue rulebook says
that each contract's specifications live in the rules governing that contract,
but does not contain the House-control, UFC-champion, or individual market
definitions requested by the current requirements. The next evidence slice is
therefore not more generic-rulebook prompting. It is contract-specific official
locator discovery and capture, with venue policy retained as a separate
fallback/appeal layer.

An independent natural DeepSeek V4 Flash smoke over a controlled retained rule
then completed `SUPPORTS` in one read plus one terminal effect. The model
returned one passage handle; first-party resolution produced a verified
160-character citation and a content-addressed claim, with no whole-response
schema parse and no semantic, certificate, or execution authority. This
separates protocol capability from the low yield of the currently misrouted
generic venue document.

The retained House-control proposal itself cannot yet be rebound: its exact
Polymarket US refs are absent from the current 659-listing corpus, and attaching
a current rulebook to a historical observation would falsify temporal lineage.
The next honest qualification is a fresh House capture when those refs return,
or a separately designed historical-rule acquisition route. Studio's Evidence
page now presents the live four-stage funnel—Agent gap, official document,
verified claim, evidence-aware review—and names the active bottleneck.
