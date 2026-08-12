# Standing ontology routes

Status: active mainline construction — phases 1–4 and route-family consolidation qualified; lifecycle attribution next

Issue: [#125](https://github.com/luokerenx4/my-little-pony/issues/125)

Lifecycle continuation: [#127](https://github.com/luokerenx4/my-little-pony/issues/127)

Branch: `codex/standing-route-lifecycle`

## North-star role

Persistent AI-native discovery needs memory that can wake when the market
universe changes. A payoff relation constrains joint outcomes or conditional
probability. A routing relation says which contracts should be searched
together. These are different objects with different lifecycles and costs.

PR #124 stopped `RELATED` from creating new payoff-review supply, but future
Agents still author it through the payoff-hypothesis tool and the resulting
artifact has no structured standing query. The next construction makes a route
an evidence-bound, replayable ontology object. It observes a bounded membership
set now and wakes only on later membership or material-evidence novelty.

## Ontological position

A standing route is neither a claim that two contracts have the same meaning
nor a claim about the real-world event. It is a reusable observation that exact
venue text refers to a shared search object at one layer:

1. `SUBJECT_REFERENCE` — a named person, organization, team, asset, office, or
   other subject appears in the world-facing proposition text;
2. `EVENT_REFERENCE` — contracts refer to the same named event or bounded event
   family without asserting the same predicate or outcome; or
3. `SETTLEMENT_REFERENCE` — contracts share a named resolution source,
   mechanism, or settlement concept in settlement-facing evidence.

Each layer owns permitted evidence fields. Subject and event signals must be
grounded in listing titles. Settlement signals may use description or retained
rules text. Matching is literal, normalized, and bounded; free-form Agent prose
cannot become a standing query.

The route stores the exact source corpus membership it observed. A later corpus
is novel only when a listing enters, leaves, or materially changes inside that
same query. Receive time, unrelated listings, and global snapshot rotation are
not route novelty. Contraction remains visible lifecycle evidence but does not
spend on payoff search when it supplies no new live member or changed contract.

## Authority and recursion boundary

- The Agent may propose a route only through a declared tool.
- First-party code owns normalization, grounding checks, membership, identity,
  replay, and wake classification.
- A route has search-routing authority only. It has no semantic, probability,
  certificate, execution, external-write, or value-moving authority.
- One route may create at most one bounded follow-up generation for one novel
  membership identity. That follow-up cannot emit another autonomous route.
- Payoff-bearing findings still require independent semantic review.

## Phase 1 — split the Agent effect protocol

- [x] Add a first-class route observation effect with layer, bounded literal
  signals, exact inspected refs, rationale, and falsifiers.
- [x] Remove `RELATED` from the new payoff-hypothesis tool input while retaining
  byte-compatible replay of legacy findings.
- [x] Validate every signal against the layer's permitted fields and require it
  to ground at least two inspected listings.
- [x] Preserve tool-first completion semantics: diagnostic text has no route or
  hypothesis authority.

## Phase 2 — compile standing route memory

- [x] Compile both new route observations and legacy `RELATED` findings into one
  content-addressed standing-route contract.
- [x] Bind work, task revision, Agent run, finding/effect, exact source corpus,
  normalized query, baseline membership, evidence hashes, and falsifiers.
- [x] Fail closed when legacy evidence cannot yield a precise bounded query;
  retain the old finding even when route compilation is blocked.
- [x] Persist and replay route memory without creating a provider request.

## Phase 3 — observe temporal novelty

- [x] Compare each standing route with the current retained corpus and expose
  `QUIESCENT`, `EXPANDED`, `CHANGED`, `CONTRACTED`, and
  `BLOCKED_TOO_BROAD` explicitly.
- [x] Separate listing membership novelty from material evidence changes and
  from unrelated corpus churn.
- [x] Project exact added, removed, and changed refs plus baseline/current
  identities and zero-read-side-effect counters.
- [x] Keep the live Lula route quiet against the unchanged two-listing corpus.

## Phase 4 — one-hop payoff-search follow-up

- [x] Materialize a stable provider-neutral follow-up work identity only for a
  novel route observation identity.
- [x] Seed it with exact prior and novel refs from the current ontology/corpus;
  candidate relation kinds exclude `RELATED`.
- [x] Reconcile compiled follow-up work through ordinary relation-discovery task
  revisions, cost ledger, counterexample memory, campaign authorization, and
  independent review gates.
- [x] Prove unchanged replay creates no successor work, campaign, run, or
  model request and prove a route follow-up cannot recurse.

## Phase 5 — value attribution and operator surface

- [x] Consolidate independently discovered routes by canonical query scope while
  retaining every source observation, so repeated Agent discovery corroborates
  one route family instead of multiplying wake spend.
- [x] Bind family identity to normalized layer/query/field semantics, never to
  a source run, finding, global corpus identity, or model-generated prose.
- [x] Use the earliest exact baseline for family novelty, retain later baselines
  as corroborating temporal evidence, and emit one work item per family ×
  material membership identity.
- [x] Surface duplicate source count, baseline disagreement, and exact source
  route/finding/run lineage rather than silently discarding duplicate evidence.
- [ ] Attribute route creation cost, quiet duration, wake count, follow-up cost,
  payoff-review yield, counterexample yield, and opportunity progression.
- [ ] Expose standing routes and wakes in the Finding Inbox without presenting
  them as opportunities.
- [ ] Add notifications only through the existing future destination decision;
  in-app visibility is sufficient for qualification.

## Qualification

- [x] Legacy Lula `RELATED` memory compiles into an exact `SUBJECT_REFERENCE`
  route with two baseline members and zero review/action authority.
- [x] A synthetic third grounded subject listing wakes the route exactly once.
- [x] An unrelated corpus addition and receive-time-only refresh leave it quiet.
- [x] A broad or ungrounded Agent route is rejected and cannot create work.
- [x] The one-hop follow-up excludes `RELATED`, remains manually authorized, and
  cannot create another route.
- [x] Workspace checks, all suites, build, and retained-live-state reads pass for
  the completed phases.

## Implementation checkpoint — 2026-08-12

The Agent protocol now has a separate `record_ontology_route` result effect.
Subject/event routes accept title-grounded literal signals; settlement routes
accept description/rules-grounded signals. Every signal must occur in at least
two inspected listings, all inspected refs must belong to the derived complete
baseline membership, and membership over 24 is rejected. New payoff hypotheses
reject `RELATED` with guidance to use the route tool. Legacy findings remain
byte-compatible. Native routes are explicitly `SEARCH_ROUTING_ONLY` with
`NOT_APPLICABLE_ROUTING_ONLY` review posture; they no longer masquerade as a
payoff finding awaiting semantic review.

Schema 42 permits durable native route observations. The provider-free route
compiler also accepts legacy entity-neighborhood `RELATED` findings when their
work signals yield one grounded 2–24 member literal query. A route observation
compares material listing semantics while deliberately ignoring receive-time
and raw-envelope churn. Synthetic qualification stayed `QUIESCENT` after only
receive time changed and became `EXPANDED` after a third Mark Kelly contract was
added. The one-hop follow-up compiler then emitted exactly one stable runnable
work item containing all seven payoff-bearing relation kinds and no `RELATED`;
replay returned the same identity, unrelated global-corpus churn after the wake
also returned that same follow-up, a second material membership emitted a new
work identity, and a quiet route returned no work.
The follow-up retains the originating ontology proposals, issues, issue
revisions, ontology identities, trailheads, and exact wake observation rather
than overloading task or work IDs as ontology provenance. A dedicated durable
source query prevents standing routes from falling out of a recent-findings UI
window, and exact task-ID lookup restores every matching source revision.
Startup reconciliation now folds only eligible wake work into the ordinary
relation-discovery revision flow, so it inherits the existing manual campaign,
usage ledger, counterexample memory, and independent semantic-review gates.

Phase 5 now groups source routes by a provider-free identity over normalized
route layer, literal signals, and search fields. A synthetic case with two
independent native findings—whose signal casing differed—retained both source
routes/findings/runs but produced one corroborated family and one follow-up for
the current membership. Follow-up identity is now `family × material
membership`, so the same membership cannot multiply spend while a later real
membership still receives a distinct work identity. The live Lula source is
one quiet, uncorroborated family
`sha256:8a879cb7e3a223d7b32e7c83919f8b5d61adb50ddc72054e0b13aabbcaf83d8d`
with zero wake work. Qualification can disable only campaign polling with
`PMH_AGENT_CAMPAIGN_TICK_MS=0`; this leaves the control plane readable without
mutating persisted campaign authority or starting background model calls.

The retained live Lula finding compiled to standing route
`sha256:e68e800fd20be6566c112eae7972c9a94c637d9b9cc5df959d31da3e74c8d250`
with the exact signal `Luiz Inácio Lula da Silva` and its two Gemini members.
The current state is `QUIESCENT`, follow-up count is zero, and the read started
zero provider requests, model invocations, campaigns, or runs. SQLite migrated
to schema 42 without losing the legacy finding. Workspace checks, all suites
(86 control-plane files / 604 tests, four Studio files / 24 tests, and all
remaining packages), and the production build pass with only the known Node 24
engine expectation and existing Studio chunk-size warning.

## Non-goals

- treating route membership as entity identity or semantic equivalence;
- recursively crawling the entire market graph;
- using embeddings or model confidence as route identity;
- deleting legacy findings or historical semantic-review cost;
- automatically spending tokens merely because the global corpus rotated;
- live orders, credentials, signing, approvals, transactions, or funds.
