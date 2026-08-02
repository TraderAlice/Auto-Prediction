# Semantic search issue families

Status: active; durable family contract, scheduling, attribution, payoff lineage,
and Studio visibility implemented locally

Created: 2026-08-02

## Outcome

Turn recurring Agent search from a broad prompt into a measured portfolio of
durable semantic-search issues. Each issue family should own a falsifiable
relationship pattern, bounded candidate universe, scheduling budget, and
downstream yield attribution. The product-level result is not more model calls;
it is more independently reviewed, economically testable relations per unit of
provider work and elapsed time.

## Initial families

1. Temporal impossibility: a required appearance, publication, certification,
   or office-holding event occurs after a traded death, incapacity, deadline,
   or disqualification event.
2. Event containment: a narrow event implies a broader event, while venue
   wording, time windows, and void rules may create counterexamples.
3. Partition completeness: several candidate or range markets purport to form
   an exhaustive and mutually exclusive partition but may omit an `other`, tie,
   cancellation, or boundary state.
4. Identity and succession: two listings refer to an office, nominee, winner,
   team, asset, or person whose identity can change between observation and
   settlement.
5. Physical co-occurrence: location, participation, performance, or public
   appearance contracts may be mutually exclusive only under an explicit
   timing and identity premise.

## Issue contract

Extend the durable search-issue schema with an optional closed `semanticFamily`
and family-specific parameters. The Agent prompt remains tool-driven and may
propose any supported relation, but the issue must state:

- the intended relation pattern and concrete falsifiers;
- venue/entity/time filters and maximum corpus fanout;
- fast/deep lane budget and recurrence;
- whether 2-, 3-, or 4-listing proposals are expected;
- which premise kinds are acceptable for research retention;
- the metrics used to continue, pause, or revise the issue.

Do not encode a family as a regex-only detector. Deterministic retrieval should
produce a bounded neighborhood; the Agent owns semantic hypothesis generation,
and the existing reviewer/premise/verifier chain owns admission.

## Attribution and measurements

Every proposal, semantic-review job, premise-analysis job, notification, and
payoff qualification must remain traceable to the source issue and family.
Measure per family:

- scans, novel grounded proposals, and duplicate-scope suppression;
- semantic-review pass/escalate/reject rates;
- premise classifications and counterexample rate;
- exact-admission and payoff-template yield;
- economically positive portfolios after quote, fee, and depth checks;
- provider attempts, wall-clock latency, and retry/exhaustion rate;
- age from first observation to operator notification.

Counts are descriptive, not model confidence and not trading authority.

## Scheduler policy

- Run families concurrently under explicit per-tick and per-family budgets.
- Preserve immutable issue versions; changing a family prompt or parameter set
  creates a new scope identity rather than rewriting prior outcomes.
- Prefer adaptive recurrence based on measured yield and market freshness, but
  enforce hard minimum/maximum intervals and global request ceilings.
- A failing family does not block others. Three consecutive infrastructure
  failures should raise degraded attention without classifying the semantic
  hypothesis itself.
- Duplicate semantic scopes reuse retained reviews and premise audits instead
  of spending another request.

## Qualification gates

- At least one fixture and one retained anonymous-corpus example per initial
  family reach proposal attribution.
- A three-market temporal example traverses the premise lane and retains its
  family/issue lineage through payoff replay and notification.
- Duplicate candidates across two families share the same semantic review
  scope while preserving both issue attributions.
- Per-family budgets remain exact across concurrency, retries, restart recovery,
  and disabled issues.
- Studio shows yield and failure metrics without presenting model confidence as
  probability or a research relation as guaranteed arbitrage.
- Full checks, tests, build, and responsive visual QA pass; live execution and
  value-moving authority remain absent.

## Authority boundary

Issue families decide where Agents look and how much provider work they may
spend. They do not decide semantic truth, economic profitability, certificate
eligibility, or execution.

## 2026-08-02 implementation checkpoint

- Search issue v2 binds a content-addressed family definition, prompt,
  falsifiers, expected 2–4 listing range, acceptable premise kinds, and maximum
  corpus size. Editing any of those fields creates a new immutable issue ID.
- Five initial family issues are seeded alongside the general searches. A
  deterministic bounded catalog preserves venue representation before the
  Agent sees it, and one family may consume at most one concurrent lease by
  default while unrelated families continue.
- Provider attempts, failures, tool work, escalations, and the full downstream
  proposal-to-certificate funnel are aggregated by semantic family. Proposal
  attribution is deduplicated within a family and preserved when one proposal
  originates from multiple families.
- Qualified relation payoffs carrying search provenance use v4 and bind their
  source issue IDs and semantic families into replay identity. The three-market
  temporal fixture retains that lineage through premise analysis and payoff
  compilation; deleting it fails replay validation.
- Studio shows family definitions, falsifiers, bounded context, provider work,
  and downstream yield. Responsive visual QA found and fixed a wrapped family
  badge at the narrow viewport.
- A first anonymous-corpus run exercised all five families. Temporal,
  containment, partition, and identity correctly produced no grounded
  candidate; physical co-occurrence produced one novel fast candidate but had
  not produced a deep proposal at observation time. These are abstentions and
  work measurements, not failed semantic judgments.

The qualification gates above remain open until every family has a retained
proposal example and restart/retry/disable budget behavior is demonstrated.
The next engineering steps are automatic supersession of obsolete default issue
versions, family-specific retrieval trailheads and adaptive cadence, followed
by compact/paginated operator projections so retained evidence is not repeatedly
serialized into a multi-megabyte SSE snapshot.
