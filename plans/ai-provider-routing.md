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
- The Codex OAuth backend requires streaming Responses and rejects
  `max_output_tokens`. The shared loop therefore consumes the stream natively;
  its projected output-token value is an Agent target, not a provider-enforced
  ceiling. Step, tool-call, task-deadline, and five-minute wall-clock bounds
  remain enforced externally.
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

## Live qualification

On 2026-08-09, Luna/high completed a three-step production control-plane run in
17.9 seconds: inspect six Boston temperature buckets, record one proposal, and
complete explicitly. The usage ledger retained 7,625 input tokens, 768 output
tokens, 253 reasoning tokens, three provider requests, and one durable effect.
A concurrent scheduled equivalence issue also completed four requests and
retained a falsification lead rather than promoting lexical similarity.

The first live attempt usefully failed: the Codex backend rejected non-streaming
requests and then rejected `max_output_tokens`. Both incompatibilities are now
covered by the mocked transport test. Studio also distinguishes partial pool
results from a fully passing model run, so a heuristic fallback can no longer
paint a failed model worker as “Proposal ready.”

A same-surface live comparison then exposed a quality distinction that provider
health alone could not show. Luna/high inspected the two Polymarket catalogs in
37.6 seconds with eight requests and 28,279 tokens, but recorded one durable
`COMPLETE_SET` hypothesis while its own thesis said no grounded relation was
supported. Terra/high received the same search surface plus an explicit
two-listing support condition and correctly abstained in 6.7 seconds with two
requests and 4,326 tokens. The operator selection therefore remains Terra/high
for semantic-relation discovery; Luna remains eligible for cheaper trailhead
work, but not as the assumed quality baseline.

This run also tightened the first-party effect contract. New semantic discovery
hypotheses must bind at least two inspected listings. A single-listing pricing
observation belongs to deterministic venue analysis, not the semantic Agent
proposal lane. Heuristic workers follow the same admission rule, while stored
historical artifacts retain their existing replay compatibility.

## Authority boundary

This configuration changes model supply only. It grants no equivalence-review,
certificate, execution, order, signing, approval, credential-custody, or fund
authority. Codex OAuth is an AI credential and is never treated as a venue or
trading credential.
