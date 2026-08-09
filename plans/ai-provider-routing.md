# AI provider routing

Status: active

Started: 2026-08-09

## Objective

Let an operator switch new discovery-scout work between DeepSeek V4 Flash and the Codex
Responses backend without restarting the control plane. Codex mode uses the
existing ChatGPT/Codex OAuth supply through the same Vercel AI SDK agent loops,
with an explicit GPT-5.6 model and reasoning effort. Provider instability must
not silently change the semantics, authority, or lineage of an in-flight run.

## Runtime contract

- One durable configuration selects `DEEPSEEK` or `CODEX` for new discovery
  Agent runs.
- DeepSeek keeps its configured model and does not expose a fake reasoning
  effort control.
- Codex initially allows `gpt-5.6-luna` and `gpt-5.6-terra`; reasoning effort is
  one of `none`, `low`, `medium`, `high`, `xhigh`, or `max`.
- The Codex transport is a normal Responses request to the Codex backend with a
  refreshed OAuth bearer, ChatGPT account ID, and bounded first-party headers.
- Credentials never enter SQLite, projections, logs, usage events, or browser
  responses. Only readiness and the selected non-secret configuration project.
- A configuration update affects work leased after the update. An active run
  keeps the immutable provider snapshot it started with.
- Every usage event records the effective provider, model, transport, and
  purpose. AI output remains proposal-only.

## Construction slices

1. Add a credential broker that can resolve a current Codex OAuth bearer and
   account ID without exposing either to callers beyond the transport boundary.
2. Route the discovery Agent pool through the selected runtime while preserving
   its tools and terminal effects. Semantic review, evidence interpretation,
   premise analysis, and probability estimation retain their independent model
   supplies until a later campaign has qualified cross-stage snapshot lineage.
3. Persist the selected provider, Codex model, and effort in the operational
   store; add a strict read/update API with optimistic revision checks.
4. Project effective configuration and credential readiness in Studio. Add
   provider, model, and effort controls with disabled states and clear failure
   diagnostics.
5. Prove restart replay, provider-specific request shape, redaction, hot pool
   replacement, usage attribution, and historical artifact compatibility.
6. Run focused and full workspace qualification, then inspect Studio at desktop
   and narrow widths.

## Qualification gates

- Switching to Codex changes the next mocked request to the Codex endpoint and
  includes neither token nor account ID in any API response or persisted row.
- Luna/Terra and every accepted effort round-trip through SQLite and Studio;
  unknown models, efforts, fields, and stale revisions fail closed.
- DeepSeek requests remain byte-compatible at the provider boundary apart from
  the shared routing wrapper.
- New discovery work consumes the selected provider snapshot rather than a
  startup-only environment value; retained and in-flight work is not rewritten.
- Restart restores the last configuration. Historical AI artifacts and usage
  events replay unchanged.
- Studio controls work at desktop and 390 px without horizontal overflow or
  console errors.

## Authority boundary

This configuration changes model supply only. It grants no equivalence-review,
certificate, execution, order, signing, approval, credential-custody, or fund
authority. Codex OAuth is an AI credential and is never treated as a venue or
trading credential.
