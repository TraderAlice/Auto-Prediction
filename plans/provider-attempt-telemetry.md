# Provider attempt telemetry

Status: active
Started: 2026-08-02

## Outcome

Make cheap-model reliability and actual provider request supply visible and
durable per search lease. Classify failures without retaining provider bodies,
prompts, stack traces, or credentials. Use the resulting evidence to decide a
later bounded retry or fallback policy without making the existing request
budget dishonest.

## Runtime evidence

- The retained window contains 40 terminal search leases.
- 38 leases invoked a model worker and 16 retained a DeepSeek failure, a 42.11%
  failure rate.
- Five diagnostics say `DeepSeek AI SDK request timed out`; eleven collapse all
  remaining causes into `DeepSeek AI SDK request failed`.
- The focused model-selected issue chose a pair in 5 of 11 retained batches and
  missed in 6.
- `SearchLeaseFastLane.modelRequestCount` counts model worker reports, not
  provider HTTP attempts. DeepSeek happens to set AI SDK `maxRetries=0`, so the
  values currently coincide; enabling retry would silently violate the name and
  budget contract.

## Architecture decision

1. Add a shared bounded model-failure taxonomy: timeout, task deadline,
   retryable provider, rejected provider, invalid provider output, invalid model
   output, and unknown network/runtime failure.
2. Model ports throw only a safe typed failure with category and exact request
   attempt count. Never retain error bodies, URLs with credentials, prompts,
   generated text, headers, or stack traces.
3. New discovery worker reports retain request attempts and one optional failure
   category. Historical reports remain readable.
4. New search leases copy aggregate provider telemetry into the immutable fast
   lane. Historical leases remain byte-identical and receive a conservative
   read-only derivation from their current one-attempt/no-retry contract and
   compact diagnostic.
5. Project provider attempts, failures, failure rate, category counts, and
   untyped legacy count globally and per issue. Studio displays the global
   posture next to search yield.
   Provider failure rate excludes pre-dispatch task deadlines and invalid model
   output; both remain visible categories, but neither is attributed to the
   provider.
6. Keep `maxRetries=0`, the one-model-worker budget, timeout, concurrency, pi,
   and every downstream authority unchanged in this campaign.

## Construction slices

- [x] Qualify the retained provider-failure baseline.
- [x] Add safe typed model failures for DeepSeek and OpenAI ports.
- [x] Persist backward-compatible worker and lease telemetry.
- [x] Add global/per-issue reliability projection and Studio posture.
- [x] Qualify timeout, retryable HTTP, invalid output, success, and historical
      fallback paths.
- [x] Re-run live scheduling to capture at least one natively typed attempt.
- [x] Run full checks, build, desktop QA, and inspect the existing 390 px
      single-column responsive contract reused by the new row.
- [ ] Publish and serially merge the campaign PR.

## Live checkpoint

- A real operator issue run made one DeepSeek request and durably classified
  the failure as `NETWORK_OR_UNKNOWN`; its lease stayed `PASS` with
  `NO_CANDIDATES`, so cheap-model degradation did not manufacture a lead.
- Subsequent normal scheduling produced three native telemetry leases in the
  retained 40-lease window. The current window contains 39 provider attempts
  and 17 provider-attributable failures (43.58%): five timeouts, one native
  network/unknown failure, and eleven conservative legacy-untyped failures.
- Three historical invalid-model-output classifications remain visible but are
  excluded from provider failure rate. Native/legacy coverage is 3/37.
- Final full workspace typecheck, 258 control-plane tests, 10 Studio tests, all
  other workspace tests, and the production build pass. Desktop browser QA
  shows one four-column reliability row with no console warnings. The new row
  reuses the existing narrow-screen issue-strip contract, which switches to one
  column and removes internal left borders; no responsive CSS changed.

## Safety and boundedness

- No retry or fallback request is introduced; provider supply does not change.
- Failure records contain an enum and counts only. They contain no provider
  response body, model output, prompt, header, URL, stack, or secret.
- Historical hash-valid records remain immutable and restart-compatible.
- Telemetry is operational evidence only. It has no semantic, simulation,
  certificate, or execution authority.

## Qualification gate

- A successful model call records one provider attempt and zero failures.
- A timeout records one attempt and `TIMEOUT`; a deadline that expires before
  dispatch records zero attempts and `TASK_DEADLINE`.
- HTTP 408/409/429/5xx records `RETRYABLE_PROVIDER`; other non-success HTTP
  records `REJECTED_PROVIDER`.
- Invalid JSON/schema/object output is distinct from provider/network failure.
- New lease telemetry survives SQLite restart and matches worker-report totals.
- Legacy leases still hydrate; derived attempts remain explicit and generic
  failures appear as untyped rather than fabricated categories.
- Studio exposes attempts, failure rate, timeouts, retryable failures, and
  untyped failures without horizontal overflow or browser warnings.
