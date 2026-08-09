# Semantic-family retrieval trailheads

Status: v5 query-first monitoring and heuristic-first trailheads are
live-qualified; relation-axis coverage is enforced for partition work

Created: 2026-08-02

## Problem

The five semantic search families previously shared one exact-token query
ranker. That is useful for literal aliases but systematically misses the reason
for using an Agent: two contracts can share a subject and temporal or physical
structure while their surface predicates are unrelated. A broad Agent context
does not fix this; it spends model budget without making the search path
reproducible.

The motivating example is an August Trump shooting contract and a September
Trump live-cola contract. The pair is a useful retrieval neighborhood even
though a non-fatal shooting permits both outcomes. Retrieval must surface the
pair without claiming hard mutual exclusion, probability, or arbitrage.

A second product failure is now explicit: treating a pre-written claim as the
default discovery input drives the system toward obvious, well-covered market
clusters. Those are easy to name precisely but often have the least remaining
semantic edge. A claim is therefore a useful unit of validation and monitoring,
not the only or primary source of search inspiration.

## Discovery posture

Default discovery is heuristic-first. The system should generate bounded
trailheads from observable oddities in the corpus—rare entity/time/mechanism
intersections, newly listed or materially changed rules, unusual relation
neighborhoods, cross-venue wording divergence, and price-shape anomalies—then
let the Agent inspect, branch, falsify, and only afterwards record a candidate
claim or a durable negative finding.

Claim-first search remains a supported exploitation lane for known semantic
constraints, scheduled monitoring, regression cases, and operator-supplied
hypotheses. It must not dominate the exploration queue or be presented as the
product's primary discovery method. The selection metric is useful retained
novelty per unit of AI and operator cost, not the number of familiar claims
matched.

## Contract

- A first-party deterministic ranker generates at most 64 family-specific
  two-listing trailheads from one immutable corpus.
- Rare shared subject terms provide the core. Family cues add temporal,
  threshold, partition, succession, or physical-event structure.
- One trailhead expands to the issue's bounded context limit and rotates using
  retained semantic-completion and routing-attempt feedback.
- A content-addressed `pmh.semantic-family-retrieval.v1` plan binds corpus,
  family, eligible venues, anchors, signals, score, selected rank, context, and
  rotation reason.
- Scores rank retrieval only. They are not probabilities, semantic decisions,
  certificates, or execution authority.
- If no family cue qualifies, claim monitoring records an explicit lexical-query
  fallback while heuristic exploration constructs a typed rare-seed
  neighborhood with verbosity-normalised rarity and exact related refs.
- Query-first monitoring stays on the highest-ranked query-relevant,
  family-valid neighbourhood. Scope rotation applies to heuristic-first
  exploration; it must not silently redirect an exact operator assignment to a
  merely fresh but unrelated topic.
- Partition and partition-completeness Agent runs treat mutual exclusion and
  exhaustiveness as independent axes. Completion requires a grounded positive
  hypothesis or falsification for each axis.

## Qualification

- The shooting/live-cola example is recalled by shared subject plus temporal
  and physical cues and remains search-only.
- Containment, partition, identity/succession, and physical co-occurrence have
  focused deterministic examples.
- Attempted neighborhoods rotate without crossing issue feedback.
- Plan hash tampering fails closed; historical leases without plans replay.
- Search lease v8 preserves the plan through failure, SQLite restart, bounded
  live projection, and Studio.
- Per-family trailhead, neighborhood, and fallback counts are visible without
  being rendered as confidence.
- A retained anonymous 799-listing corpus run measures real neighborhood yield,
  false-positive burden, provider work, and query fallbacks.

## Next decisions from evidence

After the anonymous qualification, revise token/cue weights only from retained
false-positive and abstention evidence. Do not add embedding or model reranking
until the deterministic baseline exposes which families need it. Retrieval
quality and semantic-review quality remain separate metrics.

The next discovery comparison must measure heuristic-origin and claim-origin
work separately: unique relation neighborhoods reached, useful falsifications,
review-worthy candidates, repeated/common-market concentration, token cost, and
operator follow-up. That evidence decides the exploration/exploitation mix; a
fixed claim queue must not silently become the default again.

## 2026-08-09 v4 checkpoint

The heuristic fallback now records one content-addressed rare seed, its bounded
signals, and related refs instead of an unrelated rarity sample. Rarity is
normalised by title-token count. Search lease v8 stores the original question
separately from semantic-graph lineage and only gives the Agent graph relations
whose complete ref set is readable in the selected context.

The live 799-listing scan selected one Hormuz deadline contract and ten related
same-subject deadlines. It completed in three tool steps with one accepted
catalog read, no unknown-ref rejection, no proposal, and no Pi spend. Studio
keeps the latest retained seed, signals, neighbors, graph readability, steps,
reads, and terminal result above the scrolling lease ledger. Desktop and 390 px
inspection show no overflow, no console errors, and no text below 12 px.

The scan also shows that a coherent trailhead may suggest a different relation
family than its scheduled lens. That observation moves to
`cross-lens-inspiration-effects.md`; retrieval must not force it into a false
candidate merely to satisfy the current family.

## 2026-08-10 v5 checkpoint

A live House-control claim monitor exposed that feedback rotation could move an
exact operator assignment from the Democratic/Republican House pair to an
Arizona governor pair. Retrieval v5 keeps query-first work on the top
query-relevant family-valid neighbourhood while preserving rotation for the
default heuristic-first lane. The rerun selected the two exact House refs at
rank one with six query signals and no unrelated substitution.

That run also exposed an Agent-loop defect: disproving exhaustiveness caused
the model to finish without testing mutual exclusion. The tool session now
rejects partition completion until both axes have a durable positive or
negative effect, and step preparation keeps the required tools available even
after one proposal consumes the positive-hypothesis budget. A natural
Terra/high rerun completed in four steps with one `EXHAUSTIVENESS`
falsification and one `MUTUALLY_EXCLUSIVE` hypothesis. The deep lane correctly
reported duplicate scope and spent no redundant Pi request.

## 2026-08-02 anonymous-corpus checkpoint

The first live pass ran all five families against a retained 947-listing,
seven-venue corpus. It immediately found and corrected two deterministic noise
sources: venue rules/description boilerplate containing “live” was leaking
crypto hourly markets into physical co-occurrence, and month/UTC/close/hourly
template terms were outranking real subjects. Family cues now use title,
outcome labels, and close time only; temporal impossibility also requires an
incapacity cue or two physical events with different time cues.

After that correction:

- identity/succession selected the cross-venue Myriad/Polymarket Democratic
  presidential-nominee pair from 64 neighborhoods and the Agent retained it as
  a two-listing candidate for Pi;
- containment and partition each selected a pair of heavily overlapping Kalshi
  multileg sports contracts, then produced no policy-qualified candidate;
- temporal and physical found no deterministic family neighborhood and recorded
  explicit query fallbacks instead of fabricated scores;
- the retained performance window contained 11 v6 family retrieval plans, 535
  ranked neighborhoods, and two explicit fallbacks across current and prior
  snapshots. Those aggregate counts include the pre-correction runs and are
  therefore evidence history, not a clean benchmark.

The current snapshot produced no new deep proposal at observation time. The
identity and temporal candidates were still pending Pi; no result is described
as arbitrage or probability evidence. Desktop DOM checks showed no horizontal
overflow, and a 375 px responsive check showed no document overflow or browser
errors. Browser navigation could not hard-reload a fresh bundle while the local
SSE page was active, so final pixel inspection of the newly added trailhead
labels remains open rather than inferred from source code.
