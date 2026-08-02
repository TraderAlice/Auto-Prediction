# Semantic-family retrieval trailheads

Status: active; deterministic retrieval, lease lineage, rotation, metrics, and
Studio visibility implemented locally; clean post-correction benchmark and
fresh-bundle pixel inspection remain

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
- If no family cue qualifies, the plan records an explicit lexical-query
  fallback instead of pretending a family neighborhood existed.

## Qualification

- The shooting/live-cola example is recalled by shared subject plus temporal
  and physical cues and remains search-only.
- Containment, partition, identity/succession, and physical co-occurrence have
  focused deterministic examples.
- Attempted neighborhoods rotate without crossing issue feedback.
- Plan hash tampering fails closed; historical leases without plans replay.
- Search lease v6 preserves the plan through failure, SQLite restart, bounded
  live projection, and Studio.
- Per-family trailhead, neighborhood, and fallback counts are visible without
  being rendered as confidence.
- A retained anonymous 947-listing corpus run measures real neighborhood yield,
  false-positive burden, provider work, and query fallbacks.

## Next decisions from evidence

After the anonymous qualification, revise token/cue weights only from retained
false-positive and abstention evidence. Do not add embedding or model reranking
until the deterministic baseline exposes which families need it. Retrieval
quality and semantic-review quality remain separate metrics.

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
