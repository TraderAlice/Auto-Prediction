# Discovery time budget and SDK diagnostics

Status: completed 2026-08-02

Started: 2026-08-02

## Outcome

Cheap-model discovery receives enough wall-clock budget to complete useful
reasoning, while operators can still bound it explicitly. Every enclosing task
deadline is at least as long as the provider request budget. The Vercel AI SDK
path reports safe failure categories instead of one ambiguous adapter message,
and the installed dependency versions are current on their existing major
lines. Pi remains the separate deep-investigation lane.

## Runtime evidence

- The production fast lane is `DeepSeekAiSdkModelPort -> Vercel AI SDK ->
  @ai-sdk/deepseek`; Pi is not invoked for ordinary cheap-model scans.
- The adapter and environment parser defaulted to 8,000 ms and rejected values
  over 30,000 ms.
- `POST /api/v1/discovery/runs` independently created a 10,000 ms task deadline,
  so changing only the adapter would not make the route usable for long
  reasoning.
- Search leases already default to 300,000 ms and accept up to 600,000 ms.
- Five minimal real DeepSeek requests completed. A full fixture request later
  failed local structured/grounding validation, and earlier runs included both
  explicit timeouts and SDK errors without an HTTP status. This is not evidence
  of a globally broken proxy route.
- Current dependency audit: `ai@7.0.44` versus `7.0.48`,
  `@ai-sdk/deepseek@3.0.17` versus `3.0.19`, and current
  `@earendil-works/pi-coding-agent@0.83.0`.
- The user explicitly accepts a five-minute timeout and requires it to remain
  configurable.

## Construction slices

1. Set the discovery provider default and accepted maximum to 300,000 ms for
   both DeepSeek and OpenAI.
2. Give manually submitted discovery tasks a deadline derived from the selected
   provider timeout; keep scheduled search leases at no less than that timeout.
3. Upgrade `ai` to 7.0.48 and `@ai-sdk/deepseek` to 3.0.19. Do not change Pi,
   which is already current.
4. Classify Vercel AI SDK retry wrappers, provider rejections, malformed or
   missing structured output, timeouts, and otherwise unknown transport errors
   without persisting provider bodies, URLs, headers, prompts, stacks, or keys.
5. Document the configuration, expose the effective value in projections, and
   lock the default and bounds into focused tests.
6. Run focused tests, all workspace checks and tests, production build, a real
   configured DeepSeek smoke, and browser QA before offering the serial PR for
   merge.

## Qualification gates

- Default projections report `timeoutMs: 300000`.
- `PMH_DISCOVERY_TIMEOUT_MS=300000` is accepted and `300001` is rejected.
- A manual discovery task cannot expire before its configured provider request.
- Scheduled lease deadlines cannot be shorter than the configured provider
  timeout.
- Representative Vercel AI SDK output and provider failures retain only bounded
  categories and attempt counts.
- The real smoke completes or returns a specific safe category; the old generic
  `DeepSeek AI SDK request failed` string is not an operator diagnostic.
- No retry count, request fan-out, model authority, execution authority, or
  value-moving surface changes.

## Authority boundary

This campaign changes request timing, dependency patches, and observability
only. AI output remains proposal-only. It cannot certify equivalence, publish an
exact certificate, place an order, sign, approve, move funds, or obtain trading
credentials.

## Completion evidence

- `ai@7.0.48`, `@ai-sdk/deepseek@3.0.19`, and transitive provider utilities are
  locked under the repository's supply-chain policy. Pi remains unchanged at
  current `0.83.0`.
- Default and maximum provider timeout tests pass for both DeepSeek and OpenAI.
  A server integration test captures at least 301,000 ms of remaining time on a
  manual request and exactly 300,000 ms on its scheduled lease budget.
- A malformed HTTP 200 provider body is classified
  `INVALID_PROVIDER_OUTPUT`; retryable provider responses remain
  `RETRYABLE_PROVIDER`. Neither test diagnostic retains the response body.
- A real configured DeepSeek smoke completed from
  `2026-08-02T01:24:25.336Z` to `01:24:26.082Z`, made exactly one request, and
  returned `PASS` with `timeoutMs: 300000` and no execution authority.
- The running control plane projects provider and lease budgets of 300,000 ms.
  Browser QA shows `300s · 1 model scout · VERCEL AI SDK` and no console errors
  or warnings.
- Full workspace TypeScript checks pass. The complete 407-test workspace suite
  passes, as does the production build.
