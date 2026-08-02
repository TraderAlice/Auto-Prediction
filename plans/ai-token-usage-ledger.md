# AI token usage ledger

Status: active; contract designed, implementation pending

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
