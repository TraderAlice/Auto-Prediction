# AI token usage ledger

Status: implemented locally; provider pricing and token-aware scheduler budgets remain

Created: 2026-08-02

## Objective

Explain where AI budget goes and whether it produces useful research effects.
The product must answer how token structure, invocation frequency, purpose, and
outcome change over time without retaining prompts, outputs, or credentials.

## Event contract

Every model invocation records one immutable usage event with:

- purpose, Agent role, provider, model, transport, operation identity, and UTC
  occurrence time;
- terminal outcome and whether the invocation produced a durable effect;
- request count plus provider-reported input, output, reasoning, cache-read,
  cache-write, and total token counts as non-negative integer strings;
- `COMPLETE`, `PARTIAL`, or `UNAVAILABLE` coverage, so missing Pi metadata can
  never be mistaken for zero consumption;
- no prompt text, model output, bearer token, provider raw metadata, or currency
  estimate.

AI SDK `generateText` usage is aggregated across all tool-loop steps and written
once at the terminal boundary. Failed requests with no provider usage still
record an invocation and explicit unavailable coverage. Pi records invocation,
duration, and outcome with partial coverage until the CLI exposes exact usage.

## Projection contract

The bounded live projection supplies:

- totals by purpose, role, model, and outcome;
- UTC hourly and daily buckets for frequency and token trends;
- complete/partial/unavailable coverage counts;
- durable-effect counts alongside tokens, enabling tokens per useful effect
  without inventing causal quality claims;
- string-valued integer totals throughout, avoiding precision loss.

The initial Studio surface should make expensive purposes and recent frequency
changes visible. Currency cost remains absent until a versioned provider price
table and effective-date policy exist.

## Qualification

- Each of the five Vercel AI SDK paths writes exactly one complete event for a
  successful multi-step tool loop.
- A provider failure writes one unavailable event rather than silently
  disappearing or reporting zero tokens.
- Pi completion/failure writes a partial event and never fabricates token
  counts.
- SQLite restart reproduces exact events and aggregates without double-counting.
- Hour/day, purpose, role, model, and outcome aggregates sum to the ledger total.
- Projection windows remain bounded while durable aggregate totals remain
  correct.
- No event or API response contains prompt/output text or environment secrets.

## Implemented checkpoint

- SQLite schema v26 retains immutable `pmh.ai-usage-event.v1` records and
  rebuilds all aggregates exactly after restart.
- Discovery, semantic review, evidence interpretation, premise analysis, and
  probability estimation record aggregated Vercel AI SDK usage at the terminal
  tool-loop boundary. Failures with no usage metadata remain `UNAVAILABLE`.
- Pi investigation and Market Archaeologist invocations record duration,
  purpose, role, outcome, and durable-effect status as `PARTIAL`; token fields
  remain null.
- The control plane exposes `GET /api/v1/ai-usage`; the full projection contains
  all aggregates while the live projection retains only 48 recent event rows.
- Studio shows totals, purpose-ranked consumption, coverage, recent invocations,
  and UTC hourly frequency. Desktop and 390 px QA have no horizontal overflow or
  browser warnings.

## Next implementation

1. Add versioned provider price schedules with effective dates before showing
   currency cost.
2. Derive tokens per durable effect and tokens per admitted candidate over
   sufficiently large samples; never equate low spend with semantic quality.
3. Let each durable Agent issue choose request, token, time, and currency ceilings
   from an explicit combined budget policy after the open product decision is
   answered.
