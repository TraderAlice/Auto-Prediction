# Architecture Qualification Campaign

Status: active
Started: 2026-07-31

## Outcome

Qualify a prediction-market interoperability architecture against current official venue evidence without using credentials or real funds.

## Campaign A — Venue reality

- [x] Census at least eight venue families from official sources.
- [x] Capture at least six heterogeneous mechanism fixtures.
- [x] Implement at least five catalog adapters.
- [x] Implement at least three realtime-book adapters.
- [x] Implement two inert order-gateway contracts, including one demo/sandbox-shaped gateway.
- [x] Publish capability, precision, limitations, and qualification evidence per adapter.

## Campaign B — Contract truth

- [x] Implement Claim, Resolution Specification, Outcome Space, Listing, and payout algebra.
- [x] Represent binary, exhaustive/non-exhaustive categorical, scalar/range, conditional, multivariate, void, and canceled states.
- [x] Implement hash-bound UNREVIEWED proposals and independent accepted/rejected review artifacts.
- [x] Map one claim across at least three venue fixtures.

## Campaign C — Arbitrage truth

- [x] Compile complete-set, exhaustive multi-outcome, and same-claim cross-venue candidates.
- [x] Reject resolution mismatch.
- [x] Account for fee, depth, precision, and capital bounds.
- [x] Independently verify candidates with exact `bigint` arithmetic.
- [x] Bind certificates to every changing input and book generation.

## Campaign D — External loop

- [x] Capture raw streams and content-addressed manifests.
- [x] Deterministically replay snapshot/delta books.
- [x] Fail closed on gap, stale, reconnect, tick change, and generation mismatch.
- [x] Simulate multi-leg execution, partial fills, UNKNOWN reconciliation, and capital conservation.
- [x] Emit immutable campaign evidence.

## Campaign E — Liquidity export

- [x] Generate executable hedge curves from multiple venues.
- [x] Generate constrained shadow maker quotes for one low-liquidity venue.
- [x] Prove spread, size, inventory, and hedge constraints.

## Campaign F — AI-native discovery desk

- [x] Run a long-lived control-plane process behind Studio.
- [x] Define parallel heuristic/model discovery-worker ports.
- [x] Bound model scouting to an explicit 1–4 role fan-out and retain per-worker outcome telemetry.
- [x] Enforce proposal-only, unreviewed, no-execution AI output.
- [x] Retain bounded discovery runs and stream the Scout Inbox projection.
- [x] Persist discovery runs and task idempotency across control-plane restarts.
- [x] Connect a fail-closed, budgeted external model provider adapter.
- [x] Ground every non-empty scout hypothesis in a bounded, content-addressed catalog context.
- [x] Capture bounded anonymous live catalog observations and admit them to proposal-only scout context through an explicit freshness gate.
- [x] Add a one-request, secret-free, content-hashed provider qualification command.
- [x] Add a bounded, read-only pi investigator qualification command for repository-aware work.
- [x] Expose pi as an explicitly triggered, one-at-a-time Investigation Desk with SSE state and bounded durable completion retention.
- [x] Join scout and pi history into deterministic, context-versioned research cases without granting promotion authority.
- [x] Reduce fresh live catalogs into deterministic cross-venue Radar pairs and preserve exact scout-to-pi context across refresh and restart.
- [x] Screen the real three-venue exact-claim fixtures with lexical `bigint` quotes and fail closed before verification when reported buy economics or prerequisite evidence is insufficient.
- [x] Bind the real candidate to anonymous Polymarket and Limitless book depth at a common quantity without invoking the simulated complete-set route.
- [x] Publish a deterministic snapshot-scoped rejection when official non-negative taker-fee evidence proves a non-positive depth-bound floor cannot become strictly positive.
- [x] Invalidate and recompute a real candidate after a fresh anonymous book generation changes, preserving explicit prior/current decision lineage.
- [x] Retain operator-triggered current candidate books in SQLite and screen only complete same-refresh pairs, with partial failure and positive-gross outcomes failing closed before review.
- [x] Qualify real AI SDK and pi responses with a user-supplied `DEEPSEEK_API_KEY`.
- [x] Feed reviewed hypotheses into deterministic candidate compilation.
- [x] Stream real replay book state into Studio.

## Verification gate

- [x] Focused fixture and contract tests.
- [x] Fixed-point and payout property tests.
- [x] Replay chaos tests.
- [x] Solver/verifier adversarial tests.
- [x] Execution and capital state-model tests.
- [x] CLI JSON-envelope tests.
- [x] Studio projection safety and production-build tests.
- [x] SQLite migration, corruption, retention, restart, and concurrency tests.
- [x] Explicit live-disabled proof.
- [x] Full workspace checkpoint on the target runtime.

## Decisions and deviations

Record evidence-driven changes here before promoting them into stable design documents.

- 2026-07-31: Hedge curves rank executable depth by all-in marginal collateral. BUY allocations round costs up; SELL allocations round proceeds down.
- 2026-07-31: Maker export remains shadow-only and requires an economically valid spread after fee, execution, resolution-mismatch, venue, capital-lock, and inventory premiums.
- 2026-07-31: CLI schema `pmh.cli.v1` makes external writes, value movement, and live execution explicit literal-false effects.
- 2026-07-31: The target-runtime gate is qualified under isolated Node.js 24.18.1 with the full typecheck, 122-test workspace suite, and production builds passing.
- 2026-07-31: OpenAI Responses is the first external discovery adapter. It defaults to `gpt-5.4-mini`, strict Structured Outputs, `store:false`, minimal reasoning, an 800 output-token ceiling, and an 8-second timeout; without `OPENAI_API_KEY`, the model worker is absent and heuristic discovery remains available.
- 2026-07-31: The budgeted model adapter passes the full 129-test workspace suite, typecheck, and production build under Node.js 24.14.0; the live Studio projection also passes desktop and 430px layout inspection without console warnings or horizontal overflow.
- 2026-07-31: Catalog-grounded discovery expands the Node.js 24.14.0 checkpoint to 134 passing tests plus typecheck and production build.
- 2026-07-31: Provider qualification reuses the production adapter for exactly one non-stored request and emits a secret-free, self-hashed report without touching operational state; the real-response gate remains open until a user-supplied key is available.
- 2026-07-31: The provider-smoke checkpoint passes the full 136-test workspace suite, typecheck, production build, and bundled missing-key fail-closed check under Node.js 24.14.0.
- 2026-07-31: Studio consumes a live control-plane projection and SSE stream; browser code presents state and does not recompute verifier verdicts.
- 2026-07-31: AI is trusted for subjective search hypotheses only. Every model output remains UNREVIEWED, has no execution authority, and must cross deterministic compilation plus independent exact verification.
- 2026-07-31: Public realtime qualification is venue-specific. Gemini deltas use native update ranges and fail closed on gaps; Polymarket and Limitless replacement images enter explicit rebuild because their public full-book paths do not provide equivalent delta sequencing guarantees.
- 2026-07-31: The control plane owns deterministic book replay and broadcasts projections over SSE. Studio renders lifecycle and depth but never derives authoritative state in the browser.
- 2026-07-31: Discovery runs are retained in a 25-entry SQLite WAL ledger and streamed to Scout Inbox. Promotion controls remain absent until independent equivalence-review authority is configured.
- 2026-07-31: Kalshi demo and Gemini sandbox order gateways model current official submit/cancel/reconcile request shapes but have no transport, nonce generator, signer, credential input, or value-moving path. Every operation returns a hash-bound `REJECTED_INERT` receipt and qualifies only at `DISCOVER`.
- 2026-07-31: Replay chaos qualification deterministically injects sequence gaps, stale marks, reconnect-without-snapshot, off-tick deltas, tick-size change, and generation mismatch. Off-tick batches validate atomically before mutation and invalidate the book on rejection.
- 2026-07-31: The replay-integrity campaign artifact binds three verified stream/state identities, six chaos-case evidence hashes, literal-false effects, and a self identity. A golden test locks the checked-in JSON to the runtime projection.
- 2026-07-31: A hypothesis never mutates into an approved fact. A separate `pmh.hypothesis-review.v1` artifact must bind it and the complete exact market-link evidence set before compilation; proposer self-review, substituted links, non-exact grades, unreviewed venues, stale books, and non-positive floors all fail closed.
- 2026-07-31: `reviewed-compilation.v1.json` qualifies the synthetic compilation handoff but grants no runtime review or execution authority. The separate `three-venue-claim.v1.json` artifact binds identical real resolution rules across Polymarket Global, Opinion, and Limitless without treating different listing windows as claim semantics.
- 2026-07-31: SQLite WAL owns bounded operational state; Git remains the authority for immutable fixtures and campaign artifacts. Records are stored as canonical JSON with SHA-256 identities, newer incompatible schemas fail closed, and normalized task content produces a stable default `taskId`.
- 2026-07-31: External model discovery is an optional control-plane capability, never a browser capability. The projection exposes non-secret budget posture only, and model output is schema-checked plus task-scope-checked before the process reconstructs `PROPOSE_ONLY` / `UNREVIEWED` authority fields.
- 2026-07-31: A discovery task is grounded in at most 30 listings selected from normalized verified fixture catalogs. Context identity participates in default `taskId` and durable scope; every non-empty hypothesis cites in-scope listing references, while an empty grounded result remains valid.
- 2026-08-01: DeepSeek V4 Flash through Vercel AI SDK is the default lightweight discovery route; direct OpenAI Responses remains an explicit fallback. DeepSeek fast-lane thinking is disabled, output is SDK-validated and then scope-validated, and retention is labeled as provider policy rather than an unsupported `store:false` claim.
- 2026-08-01: The Vercel AI SDK / DeepSeek checkpoint passes the full 140-test workspace suite, typecheck, and production build under Node.js 24.14.0.
- 2026-08-01: Repository-aware investigations use pinned pi 0.83.0 as an explicit second lane. Its isolated one-shot process disables sessions and extensibility, exposes only read/search/list tools, validates bounded final-text output against task scope, and reconstructs non-executable proposal authority locally.
- 2026-08-01: The pi investigator checkpoint passes the full 144-test workspace suite, typecheck, production build, pinned CLI/model discovery, and bundled missing-key fail-closed check under Node.js 24.14.0.
- 2026-08-01: The root `.env.local` is the local secret-injection boundary for the control plane and qualification commands. It is Git-ignored, optional, and lower precedence than inherited process variables.
- 2026-08-01: Local environment loading and bounded pi stream handling expand the Node.js 24.14.0 checkpoint to 147 passing tests plus full typecheck and production build.
- 2026-08-01: Real pi qualification rejected JSON event mode after its repeated full streaming snapshots crossed the 64 MiB wire cap. Final-text mode avoids transport amplification; the report records the configured read-only allowlist and honestly marks per-tool trace data unavailable.
- 2026-08-01: Real DeepSeek V4 Flash qualification passes both production paths: Vercel AI SDK emits a grounded three-proposal report (`sha256:93e5612e…273735`), and pi emits a scope-validated investigator report (`sha256:41cd6d74…10b2d1`). Both retain literal-false external-write, value-moving, and live-execution effects.
- 2026-08-01: The control plane and Studio expose pi only through an explicit operator action. The Investigation Desk serializes work to one active task, coalesces identical scope, rejects competing work, permits retry after failure, retains ten sanitized records, and streams state without granting review or execution authority.
- 2026-08-01: The Investigation Desk checkpoint passes the full 153-test workspace suite, typecheck, and production build under Node.js 24.14.0.
- 2026-08-01: Operational schema v2 adds a separate bounded investigation table. Only completed PASS/FAILED records persist; canonical record and nested report hashes are validated during hydration, while non-resumable RUNNING state remains process-local.
- 2026-08-01: Durable investigation recovery expands the Node.js 24.14.0 checkpoint to 159 passing tests plus full typecheck, production build, v1→v2 migration, tamper rejection, retention, failed-task retry, scope-conflict, and HTTP restart coverage.
- 2026-08-01: Operational schema v3 adds bounded raw catalog observations beside discovery and investigation records. Each record binds source URL, receive time, protocol identity, headers, byte length, raw SHA-256, normalized listing count, and normalized listing identity; hydration rejects raw or normalized tampering.
- 2026-08-01: Six anonymous public GET sources now refresh independently under a 10-second and 2,000,000-byte per-source cap. They are projected as `OBSERVE_ONLY`; no observation can enter AI context, equivalence review, compilation, certification, or execution by this path.
- 2026-08-01: The real refresh returns 314 current listings from Polymarket Global, Kalshi, Gemini, Opinion, Myriad, and Limitless with no credential. Gemini's missing indicative-price fields are represented as absent optional facts rather than zero values or a whole-source failure.
- 2026-08-01: The live-observation checkpoint passes 168 tests, full typecheck, production build, durable restart/tamper coverage, per-venue retention, bounded-response failure coverage, partial-source degradation, and the HTTP refresh authority check under Node.js 24.14.0.
- 2026-08-01: `pmh.discovery-catalog-context.v2` keeps verified fixtures as the default and permits explicitly selected live observations only when every requested source is successful, non-empty, and at most 15 minutes old. Venue text is untrusted data; context admission grants proposal authority only.
- 2026-08-01: A real Polymarket live-context run grounded both DeepSeek/Vercel AI SDK and pi in two hash-bound listings. pi exposed a structured-close/rules-time conflict and missing rule evidence under durable artifact `sha256:d3a42fde…8e599d`; its successful high-thinking run required a 300-second process budget and retained no review or execution authority.
- 2026-08-01: Qualified live AI context expands the Node.js 24.14.0 checkpoint to 171 passing tests plus full typecheck and production build, including stale/failed-source rejection, explicit HTTP source selection, prompt-injection posture, and Studio default-state proofs.
- 2026-08-01: The Research Case Desk groups discovery and investigation records only when question, venues, catalog-context identity, and source grade match. It distinguishes missing context, missing investigation, evidence gaps, and absent review authority while retaining literal-false promotion and execution effects.
- 2026-08-01: Real SQLite state projects five context-versioned cases: one passed live Polymarket intake with seven evidence gaps, one earlier live revision needing a pi retry after two failed attempts, one grounded Boston fixture case needing investigation, and two legacy records folded into the `NEEDS_CONTEXT` count. Desktop and 430px Studio inspection show no horizontal overflow.
- 2026-08-01: Research case coordination expands the Node.js 24.14.0 checkpoint to 175 passing tests plus full typecheck and production build, including cross-task scope joining, retry retention, upstream-authority rejection, and conflicting-context-count rejection.
- 2026-08-01: Opportunity Radar uses deterministic rare-term lexical blocking only, rejects explicit cadence and exact-close conflicts, compares different venues, and publishes at most 25 proposal-only candidates. It is a workload reducer, never a confidence score, equivalence review, or arbitrage verdict.
- 2026-08-01: Discovery Ledger records retain the exact bounded catalog context server-side and omit it from HTTP/SSE projections. Candidate IDs rotate with live evidence, while an existing case can still start pi from its hash-checked scout snapshot after refresh or restart; pre-snapshot records fail closed and require rescouting.
- 2026-08-01: A real six-source refresh reduced 314 observed listings to three aligned hourly BTC/ETH/BNB Opinion–Limitless pairs. DeepSeek fast scouting and a retained-context pi run both rejected title-level equivalence, identifying Pyth-versus-Chainlink settlement, strict-versus-inclusive thresholds, and asymmetric outage handling; the pi artifact is `sha256:7d0cd196…e1d908` and remains unreviewed and non-executable.
- 2026-08-01: Opportunity Radar and durable AI handoff expand the Node.js 24.14.0 checkpoint to 182 passing tests plus full typecheck and production build, with nested-context tamper rejection, refresh-race coverage, idempotent case investigation, and desktop/mobile Studio inspection.
- 2026-08-01: Real-candidate preflight binds the exact three-venue claim and lexically parsed fixture quotes into an immutable artifact. A 55 bp catalog hint collapses to 0 bp at venue-reported buy costs before fees, so depth, fee, and independent-review gaps keep the verifier uninvoked and the candidate non-executable.
- 2026-08-01: The preflight checkpoint expands the Node.js 24.14.0 suite to 188 passing tests plus full typecheck, production build, and clean desktop/430px Studio inspection.
- 2026-08-01: Anonymous public books bind five shares of the real Polymarket YES / Limitless NO route. Direct YES costs `0.35`; a simulated Limitless complete-set split and YES sale makes NO cost `4.65`; the full `5.00` payout is consumed before fees.
- 2026-08-01: The depth screen is quantity-bound but not certificate-grade. Limitless REST exposes no venue generation, its dynamic taker fee is unbound, the split/sell route is simulation-only, and independent review remains absent; verifier invocation and all value-moving effects stay literal false.
- 2026-08-01: The official Limitless fee document binds sell-taker fees to a non-negative 42–150 bp range with no maker rebate. Since the five-share gross-floor upper bound is already zero, `pmh.real-candidate-disposition.v1` rejects only the current book snapshot before review or verification; changed book identities require a fresh screen.
- 2026-08-01: A second anonymous book capture changes the Polymarket raw hash and native generation while Limitless remains byte-identical. `pmh.real-candidate-rescreen.v1` rebuilds and invalidates the prior decision, recomputes fresh depth and disposition identities, and independently reaches `REJECTED_ECONOMICS`; prior-decision reuse, review, verification, and value-moving effects remain literal false.
- 2026-08-01: Operational schema v4 adds per-venue candidate-book observations with exact raw BLOBs, source/protocol/claim binding, common refresh IDs, bounded per-source retention, restart hydration, and tamper rejection. Candidate Watch publishes no decision unless both sources succeeded in the same refresh.
- 2026-08-01: The first runtime Candidate Watch batch succeeds without credentials or proxy changes. Limitless remains `sha256:bb0ad494…a6cf`; Polymarket advances to `sha256:dcdc0fae…c6e8` / generation `36bbecef…b57e`. Fresh `bigint` screening produces depth `sha256:ea217c9e…cb89` and disposition `sha256:d0f7fd48…de86`, rejects the unchanged zero gross floor, and keeps prior reuse, review, verifier, certificate, and value movement false.
- 2026-08-01: Candidate Watch closes the checkpoint at 209 passing tests with full typecheck, production build, and clean desktop/430px Studio layouts. Refresh IDs include a per-operation nonce, and the no-stitch test deliberately repeats the same clock instant across a successful and partial refresh.
- 2026-08-01: Operational schema v5 adds a bounded canonical Candidate Watch attempt journal. On restart, the newest journal entry restores per-source success/failure state and diagnostics; successful outcomes must reference an exact retained raw observation, and the recomputed decision must match the journal hash.
- 2026-08-01: Durable Candidate Watch recovery closes at 214 passing tests with full typecheck and production build. Tests cover source-failure and screen-failure restart hydration, rollback/ignore behavior for raw observations orphaned by journal persistence failure, journal retention, canonical tamper rejection, and HTTP history; Studio renders the latest three attempts without granting review or execution authority.
- 2026-08-01: Model scouting now defaults to one equivalence lens and permits an explicit maximum-four fan-out adding partition, mechanism, and skeptical lenses. No model request is automatic. Hash-checked Discovery Ledger records retain per-worker status, timing, lead count, and failure diagnostics while leaving cost/usage claims absent when unavailable.
- 2026-08-01: AI scout fan-out and telemetry close at 216 passing tests with full typecheck and production build, including bounded environment configuration, concurrent specialized requests, partial-worker failure, durable telemetry integrity, and legacy records without reports.
- 2026-08-01: Real default configuration remains one model scout and hydrates five pre-telemetry runs. A new durable run records heuristic PASS (2 ms, one lead) beside an isolated DeepSeek failure (6,401 ms, zero leads); a separate one-request provider smoke then passes with three grounded proposals under `sha256:e421c1fe…e76aa`. The telemetry therefore distinguishes worker failure without mislabeling the key or widening authority.

## Blockers

No current campaign blocker. Real AI SDK and pi qualification completed with a
user-supplied local credential; the credential remains outside Git and all
outputs remain proposal-only.
