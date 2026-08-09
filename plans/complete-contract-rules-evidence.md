# Complete contract-rules evidence

Status: qualified

Created: 2026-08-09

## Evidence that changed the design

The live search funnel has 144 durably completed semantic reviews but no
operator-ready exact decisions. This is not an operator-click backlog: the
current review-attention window contains zero `DECISION_READY` items. The most
promising retained candidate is the Polymarket US Democratic/Republican 2026
House-control pair. Its public catalog response contains 1,896 characters of
rules and completes the disputed party-switch, independent-member, and caucus
clauses. The retained market corpus instead ends after 1,200 characters, in the
middle of “the seat is attributed to…”. Semantic review correctly leaves the
`TT`/`FF` states unresolved and refuses exact admission.

The truncation is local: `toDiscoveryCatalogListing` compacts every venue's
rules to 1,200 characters before the same object is used both as cheap-Agent
context and as the proposal evidence bundle. A token/context optimization has
therefore silently become an evidence-quality loss.

Live qualification exposed a second, adjacent defect. A durable issue aimed
explicitly at the 2026 U.S. House/Senate control contracts was dispatched into
an unrelated UFC-champion neighborhood. Family retrieval currently receives
the issue question but ignores it whenever any deterministic family
neighborhood exists. The issue mechanism therefore schedules a family, not the
operator-authored research topic it claims to schedule.

## Contract

- Separate full retained contract evidence from the bounded text presented in
  an initial discovery context. The market corpus and proposal evidence bundle
  retain normalized rules up to an explicit 20,000-character evidence bound;
  Agent task contexts remain capped at 1,200 characters per listing and 50,000
  characters overall.
- Every newly normalized discovery listing records whether its rules text is
  `COMPLETE` or `TRUNCATED` and the normalized source character count. Context
  compaction changes posture to `TRUNCATED`; it must not masquerade as complete
  evidence. Legacy records without posture remain readable but grant no new
  completeness claim.
- Retrieval may rank over the fuller corpus, while the Agent can inspect only
  its bounded assigned context. A proposal evidence bundle is built from the
  full, content-addressed corpus snapshot, so independent review sees the best
  retained contract evidence without trusting the Agent to reproduce it.
- Family retrieval must use discriminative title tokens from the durable issue
  question to prioritize family-valid neighborhoods. Query relevance is only a
  routing signal: family cues still gate eligibility, completed/attempted scope
  feedback still rotates work, and the retained plan records the matched query
  signals and their routing score. Generic issues with no corpus-matching
  discriminative signal preserve family-first rotation.
- Partition-family eligibility covers both numeric/range siblings and
  categorical siblings with at least two uncommon shared event signals. This
  remains a trailhead heuristic, not evidence that the categories are actually
  mutually exclusive or exhaustive.
- The bounded lease query preserves the operator-authored issue topic before
  its family/ref-count/falsifier contract. Family metadata must not consume the
  500-character lease trace budget and silently erase the actual assignment.
- Full rules remain untrusted venue text, bound to raw source hash, receive
  time, protocol identity, snapshot identity, and listing hash. This change
  grants no semantic decision, certificate, order, credential, signing, fund,
  or value-moving authority.
- Rules longer than the 20,000-character evidence bound are explicitly marked
  `TRUNCATED`; downstream exact admission must continue to treat unresolved
  omitted text conservatively.

## Qualification

- Focused tests prove that a 1,896-character rule survives into the market
  corpus/evidence bundle byte-for-byte after normalization while its Agent
  context copy remains within 1,200 characters and reports `TRUNCATED`.
- Corpus identity and proposal evidence identity change when the previously
  omitted rule tail changes.
- A source rule beyond 20,000 characters is bounded and explicitly marked
  `TRUNCATED`; malformed posture/count combinations are rejected.
- Restart the live control plane from retained anonymous catalog bytes, confirm
  the House-control listings contain the completed seat-attribution and
  independent-caucus clauses, then trigger a fresh issue-directed partition
  scan/review. The retained retrieval plan must anchor the requested Congress
  contracts rather than an unrelated family-valid neighborhood.
- Full workspace tests, type checks, production build, and Studio desktop/390 px
  inspection pass before commit.

## Live qualification evidence

- A fresh 799-listing anonymous catalog capture retained both House-control
  rules at 1,890 normalized characters with `rulesTextPosture: COMPLETE` and
  the same 1,890-character source count. The proposal evidence bundles include
  the final January 4 independent-caucus/no-party clause; the cheap scout
  context remains bounded and Terra/high correctly abstained on that shorter
  view.
- The durable House issue selected the exact Democratic/Republican refs as its
  rank-1 v2 trailhead with six matched query signals. DeepSeek completed seven
  steps/ten tool calls and Pi subsequently read the full MarketFS venue files,
  returning two proposals and six evidence gaps.
- Full evidence falsifies unconditional exhaustiveness: a no-majority House
  with a first elected Speaker unaffiliated with either major party permits the
  `(No, No)` state. Pi retained `MUTUALLY_EXCLUSIVE` and `CONDITIONAL` proposals
  instead of reproducing the earlier unsupported `EXHAUSTIVE` claim.
- The independent conditional reviewer received the complete rules and agreed
  that `(No, No)` lies outside the stated condition, but safely abstained after
  repeated terminal-tool validation failures. The mutual-exclusion reviewer
  exhausted all three bounded attempts after returning no terminal effect.
  Complete evidence retention is therefore qualified; semantic-review
  terminal-effect recovery is the next distinct bottleneck, not a reason to
  reintroduce truncation.
- All 539 workspace tests, workspace type checks, and the production build pass.
  Studio desktop and 390 px inspection show the new active House issue, the
  superseded broad Congress issue paused, no horizontal overflow, and no
  runtime console error.

## Follow-on use

Once complete rules are retained, measure how many evidence-escalated reviews
become exact-decision-ready after a fresh scope review. Only then design a
policy-owned research auto-decision lane; do not automate acceptance around
missing contract evidence.

The immediate follow-on is narrower than auto-decision: make rejected semantic
review tool submissions expose field-level, bounded repair feedback and ensure
the final permitted step can always emit either a valid review or an explicit
abstention. Preserve the complete House bundles as the regression fixture.

## 2026-08-10 venue-policy follow-on

Complete market text is necessary but not always sufficient. Fresh Polymarket
US listings now also carry the official CFTC-hosted exchange rulebook as a
`CONTRACT_RULE_DOCUMENT` locator. Catalog normalizer v2 binds that new locator;
historical v1 observations are verified under their original normalization and
marked for fresh capture rather than silently reinterpreted.

The constrained document boundary now accepts the official DOCX MIME under a
5 MB first-party policy and extracts its bounded text. Live capture retrieved
the 4,140,483-byte June 2026 rulebook and extracted 197,796 characters. The
document contains the Contract Outcome Review Process and states that the
exchange retains discretion in reviewing markets. This is useful negative
protocol evidence: a venue-level document may expose a remaining uncertainty
instead of promoting the House pair to exact settlement admission.
