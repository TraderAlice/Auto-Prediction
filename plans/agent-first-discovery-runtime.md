# Agent-first discovery runtime

Status: completed

Started: 2026-08-02

Completed: 2026-08-02

## Outcome

Replace the cheap-model fast lane's one-shot `completeStructured` contract with
a bounded agent loop. The agent explores one immutable assigned market context
through first-party tools, records zero or more grounded hypotheses as explicit
tool effects, receives validation failures as tool results it can correct on a
later step, and ends explicitly or at a deterministic budget boundary.

The resulting system is agent-native without surrendering authority. The model
chooses search actions and proposals. First-party code owns catalog access,
scope validation, effect identity, budgets, persistence, semantic promotion,
exact verification, and every execution boundary.

## Why this is a full architecture migration

The current path is:

`DiscoveryWorker -> AiModelPort.completeStructured -> Output.object -> parseModelPayload`

It has one all-or-nothing parsing boundary. DeepSeek's provider reports that
response JSON Schema runs in compatibility mode by injecting the schema into the
system prompt. A locally invalid response loses every otherwise usable result.
The worker report can count one provider attempt but cannot explain a multi-step
search, tool rejection, recovery, or explicit no-candidate conclusion.

The target path is:

`AgenticDiscoveryWorker -> DiscoveryAgentPort.run -> bounded model/tool loop -> effect journal -> grounded hypotheses`

This is a protocol, data-model, persistence, scheduler-accounting, projection,
and UI change—not an adapter-only patch.

## Capability evidence

- AI SDK 7 exposes native tools, `stopWhen`, `prepareStep`, `stepCountIs`,
  tool-call repair, and per-step/tool callbacks through `generateText` and
  `ToolLoopAgent`.
- The installed DeepSeek provider translates function tools and tool choice to
  the API and parses complete and streaming `tool_calls`.
- DeepSeek documents tool calling in non-thinking and thinking modes. Strict
  function schema is beta-only and requires a beta base URL, so this campaign
  must not depend on provider strict mode.
- AI SDK automatically feeds successful tool results and tool execution errors
  back into later model steps. Input-schema failures require explicit repair or
  a deliberately tolerant first-party validation boundary.
- The existing five-minute total timeout can bound a multi-step call. It should
  not become five minutes per step.

## Agent protocol

### Immutable assignment

Each agent run receives only:

- task ID, bounded question, lens, venue scope, maximum hypotheses;
- immutable catalog-context identity and a compact listing index;
- a total deadline, maximum model steps, maximum tool calls, and maximum
  accepted proposals;
- proposal-only authority language and untrusted-content policy.

The initial prompt does not require or accept a final JSON answer.

### First-party tools

1. `search_catalog`
   - deterministic token search over the assigned immutable context;
   - accepts bounded search terms and optional in-scope venue filters;
   - returns compact identities and titles only;
   - cannot fetch the network or widen the lease corpus.
2. `inspect_listings`
   - accepts exact in-scope listing refs;
   - returns bounded title, description, rules, outcomes, close time, source
     identity, and receive time from the immutable context;
   - rejects unknown or out-of-scope refs as a recoverable tool result.
3. `record_hypothesis`
   - accepts thesis, strategy kind, listing refs, search terms, and confidence;
   - derives venue IDs from grounded refs rather than trusting model-supplied
     venue IDs;
   - validates arity, bounds, scope, and duplicates in first-party code;
   - appends an accepted or rejected effect. Rejection is returned to the model
     so it can self-correct without discarding earlier accepted effects.
4. `complete_search`
   - records an explicit terminal reason and optional bounded note;
   - carries no hypothesis payload and grants no semantic authority.

All tool inputs use the smallest practical schema. Semantic and scope checks
remain inside tool execution. No tool can certify equivalence, inspect secrets,
write external state, invoke execution, or access listings outside the assigned
context.

## Loop and budget semantics

- Use AI SDK `generateText` as the explicit loop primitive; do not hide the
  domain journal behind a generic agent abstraction.
- Require tool use on every step. Free-form model text is non-authoritative and
  is neither parsed as a result nor retained.
- Stop on `complete_search`, maximum accepted proposals, step budget, tool-call
  budget, total timeout, task deadline, or provider failure.
- Default to 8 model steps, configurable from 1–20 through
  `PMH_DISCOVERY_MAX_STEPS`.
- Keep the existing 300,000 ms as one total run budget. Provider request attempt
  count becomes the number of actual language-model calls across steps.
- Preserve fan-out as independent agent runs. Rename operator-facing
  “model-request budget” concepts that actually count workers to “agent-run
  budget”; retain backward-readable stored lease fields until a dedicated
  record-version migration is justified.
- No automatic provider retry is introduced. Agent continuation after a tool
  result is intentional work, not a transport retry.

## Effect journal

Each model worker report gains a bounded `agentTrace`:

- schema version and protocol identity;
- total steps, provider requests, tool calls, accepted proposals, rejected
  proposals, and catalog reads;
- ordered tool effects containing tool name, ordinal, status, safe reason enum,
  input identity hash, output identity hash, and accepted hypothesis ID when
  applicable;
- terminal reason: explicit completion, proposal limit, step limit, tool-call
  limit, timeout, task deadline, provider failure, or protocol failure;
- literal-false semantic, certificate, execution, external-write, and
  value-moving authority.

The journal never stores prompts, free-form chain of thought, provider response
bodies, headers, URLs, credentials, or raw hidden reasoning. Accepted hypothesis
content remains in the existing immutable discovery record; read-tool outputs
are recoverable from the catalog-context identity and listing refs.

The journal is embedded in discovery run records so SQLite persistence and
restart validation cover it atomically. New runs use
`pmh.discovery-agent-trace.v2`; replay remains compatible with v1 records,
whose catalog-read metric included rejected read attempts. Historical records
without a journal remain valid and project as legacy one-shot runs.

## Migration slices

1. Add agent protocol types, validators, deterministic tools, effect identities,
   and an in-memory bounded runner test harness.
2. Implement the DeepSeek AI SDK multi-step agent port with actual request,
   step, tool, stop, timeout, and failure accounting.
3. Implement an OpenAI agent port with the same domain contract or explicitly
   disable that route until parity exists; do not retain `completeStructured` as
   a hidden production fallback.
4. Replace `StructuredModelDiscoveryWorker` and `AiModelPort`; migrate all
   fixtures and tests to agent effects.
5. Extend discovery record validation, lease aggregation, issue outcome
   attribution, SQLite restart, and backward projections.
6. Add agent-step/tool-yield metrics and per-run trace summaries to Studio.
7. Replace the provider smoke with a required multi-step tool smoke and qualify
   it against the configured DeepSeek endpoint.
8. Remove response-format compatibility mode from the production DeepSeek fast
   lane and delete dead output-object schemas and error branches.

## Qualification gates

- A hypothesis is publishable only after an accepted `record_hypothesis` effect.
- One rejected hypothesis tool call can be followed by a corrected accepted call
  in the same agent run; earlier accepted effects survive later rejection.
- A no-candidate run ends via `complete_search` or an explicit budget reason and
  never fabricates a placeholder hypothesis.
- Unknown listing refs never escape the tool as accepted data.
- The same tool call is idempotent by canonical input identity within a run.
- Step, tool, proposal, context-byte, output-token, and total-time budgets have
  focused boundary tests.
- Provider attempt counts equal actual model calls, not agent count.
- Restart preserves and validates the exact effect journal while historical
  one-shot records still load.
- Search leases and issue metrics distinguish agent runs, provider calls, tool
  calls, rejected effects, accepted effects, and termination reasons.
- DeepSeek requests use native tools and no `response_format` compatibility
  path.
- OpenAI is either feature-equivalent or honestly projected unavailable; it
  cannot silently use the removed one-shot path.
- Real DeepSeek qualification performs at least two model steps with one catalog
  read and one terminal/proposal effect under the five-minute total budget.
- Full checks, tests, production build, SQLite restart, desktop QA, and 390 px QA
  pass before the serial PR is offered for merge.

## Authority boundary

Every tool in this campaign is local, corpus-bound, and proposal-only. There is
no live order, signing, approval, token movement, production trading credential,
semantic acceptance, certificate publication, or external write authority.

## Qualification evidence

- The configured `deepseek-v4-flash` endpoint completed the v3 provider smoke
  in two model steps and two native tool calls: one accepted catalog inspection
  followed by explicit completion. The run used trace v2 and finished in 3.554
  seconds under the single 300-second deadline.
- An earlier live qualification attempt exhausted eight steps after malformed
  tool JSON and incomplete proposal inputs. The harness accepted no hypothesis.
  Descriptive per-tool schemas plus deterministic syntax repair now convert
  malformed JSON into bounded, recoverable tool validation; a focused DeepSeek
  wire test covers that behavior.
- SQLite restarted against retained v1 traces without deleting or rewriting
  data. New v2 traces count accepted catalog reads; v1 replay retains its
  original all-read-effect metric, with a migration regression test.
- Node 24.14.0 workspace check, 416 tests (267 in control plane), and production
  build pass.
- Studio desktop QA and 390 px QA pass. The Market Archaeologist projects agent
  runs, steps, tool calls, catalog reads, accepted/rejected proposal effects,
  and explicit/budget/failure terminations without horizontal overflow.
