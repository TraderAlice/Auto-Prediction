# Plans

`plans/architecture-qualification.md` is the active execution plan.

## Current checkpoint

Architecture Qualification, pre-alpha. The work starts with venue reality and domain truth, then advances through exact verification, deterministic market state, shadow execution, and liquidity export.

## Stable decisions

- TypeScript strict monorepo with pnpm.
- First-party domain, verifier, risk, execution, and evidence boundaries.
- `bigint` fixed-point throughout Core.
- Composable venue capability ports instead of a universal optional adapter.
- Raw facts and normalized facts coexist.
- Live execution remains disabled.

## Findings log

- 2026-07-31: Input design document accepted as the initial baseline, with permission to revise abstractions when official venue evidence contradicts them.
- 2026-07-31: Local runtime is Node 22 / Python 3.9; repository targets remain Node 24+ / Python 3.12+.
- 2026-07-31: Seven of eight initial venue families returned anonymous JSON from public endpoints. Polymarket US documents a public gateway but its Cloudflare edge returned 403 from this host.
- 2026-07-31: Gemini is promoted to a first-wave adapter because its official surface now includes public catalog, realtime depth, Combo/RFQ, maker-only orders, and a full sandbox.
- 2026-07-31: Myriad's canonical Question / per-chain Market split and hybrid AMM/order-book modes independently support Claim-before-Listing and per-listing mechanism identity.
- 2026-07-31: Captured nine anonymous, content-addressed raw responses covering six required mechanism classes. Every fixture binds source, protocol, fetch time, headers, byte length, and SHA-256.
- 2026-07-31: JSON numeric tokens must be preserved lexically at adapter ingress. This prevents venue APIs that emit JSON numbers (including Polymarket and Myriad) from silently passing contract values through IEEE-754.
- 2026-07-31: First catalog qualification includes Polymarket Global, Kalshi, Gemini, Opinion, and Myriad; all remain `DISCOVER` and live-disabled.
- 2026-07-31: The complete-set compiler may optimize quantity under depth, common ticks, and venue capital, but cannot publish a verdict.
- 2026-07-31: Exact certificates bind rule, fee, book generation, exact book state, resolution partition, and expiry. BUY cost/fees round up, payouts round down, and arbitrage requires strictly positive post-fee payoff in every canonical state.
- 2026-07-31: Capital remains a per-venue silo and is conserved through reservation, partial deployment, unresolved lock, settlement receivable, recovery, and realized terminal PnL.
- 2026-07-31: Shadow execution intents bind certificate legs and obey DAG checkpoints. UNKNOWN is a reconcile-only state; complete fill is required before hedge lock.
- 2026-07-31: The fixed Risk Governor has no live mode and fails closed on invalid books, expiry, venue/residual/unresolved limits, heartbeat/cancel latency, and local/venue divergence.
- 2026-07-31: Executable hedge curves aggregate venue depth with conservative action-specific rounding and expose the exact book hashes behind every allocation.
- 2026-07-31: Low-liquidity maker quotes remain shadow-only and are bounded simultaneously by hedge depth, inventory, risk budget, payout range, and six explicit premium classes.
- 2026-07-31: CLI schema `pmh.cli.v1` publishes content-hashed read-only projections and literal-false external-write, value-moving, and live-execution effects.
- 2026-07-31: Harmony Studio uses Vite, React, and shadcn/ui components over a long-running HTTP/SSE control-plane process; it fails visibly when that process is absent.
- 2026-07-31: Subjective opportunity discovery is a first-class multi-worker layer. Cheap heuristic/model scouts run in parallel and emit only `PROPOSE_ONLY` / `UNREVIEWED` hypotheses; exact verification remains the sole certificate authority.
- 2026-07-31: Kalshi demo V2 and Gemini sandbox order shapes are represented by transport-free gateways. Submit, cancel, and reconcile calls terminate locally with deterministic `REJECTED_INERT` receipts; this is protocol discovery, not execution qualification.
- 2026-07-31: Replay integrity is qualified by six deterministic chaos cases. Invalid delta batches are validated before mutation, reconnect requires a fresh snapshot, tick-size changes invalidate prior bindings, and rebuilt generations cannot reuse old identities.
- 2026-07-31: `projects/campaigns/architecture-qualification/replay-integrity.v1.json` is the first checked-in immutable campaign artifact; a runtime builder and golden test bind it to current verified book evidence.
- 2026-07-31: Reviewed scout hypotheses can enter deterministic compilation only through a separate hash-bound hypothesis review plus accepted `EXACT` market-link reviews. The qualification path is exercised by an explicitly synthetic fixture; real Scout Inbox items remain locked.
- 2026-07-31: Studio no longer presents invented exact opportunities or venue balances as runtime facts. Its sole opportunity, payoff, capital, and verifier trace are derived from the synthetic reviewed-compilation certificate and labeled as fixture evidence.
- 2026-07-31: The long-running control plane persists its bounded discovery ledger in SQLite WAL at `.data/control-plane.sqlite`. Canonical record hashes detect corruption, `taskId` is the durable idempotency key, repeated requests return the original run, and concurrent in-process duplicates share one worker invocation.
- 2026-07-31: The full typecheck, 122-test workspace suite, and production builds pass under isolated Node.js 24.18.1, closing the target-runtime qualification gate while the default host remains on Node.js 22.
- 2026-07-31: Three anonymous exact-market fixtures map `Trump out as President before 2027?` across Polymarket Global, Opinion, and Limitless. Titles, binary partitions, and normalized resolution rules are identical; venue-specific listing windows remain separate metadata and do not masquerade as claim semantics.
- 2026-07-31: OpenAI Responses is the first optional model-scout adapter. It defaults to `gpt-5.4-mini`, strict non-stored JSON output, minimal reasoning, 800 output tokens, and an 8-second timeout; missing credentials and worker failures fail closed without disabling heuristic discovery.
- 2026-07-31: Discovery workers are grounded in content-addressed contexts selected from normalized verified fixture catalogs. Context identity participates in `taskId` and WAL scope; every non-empty hypothesis must cite in-scope listing references, and no grounded match is a valid zero-result run.
- 2026-07-31: The budgeted model-scout checkpoint passes the full 129-test workspace suite, typecheck, and production build under Node.js 24.14.0. Studio also passes desktop and 430px runtime inspection with zero console warnings or errors.
- 2026-07-31: Catalog-grounded discovery passes the expanded 134-test workspace suite, typecheck, and production build under Node.js 24.14.0.
- 2026-07-31: A one-request provider qualification command now exercises the production OpenAI adapter and emits a secret-free, content-hashed report without persistence or execution authority; the real `gpt-5.4-mini` run still awaits `OPENAI_API_KEY`.
- 2026-07-31: Provider-smoke qualification expands the Node.js 24.14.0 checkpoint to 136 passing tests plus full typecheck and production build; the bundled CLI also fails before network access when its key is absent.
- 2026-08-01: DeepSeek V4 Flash through Vercel AI SDK becomes the default lightweight discovery route, with direct OpenAI Responses retained as an explicit fallback. The provider-neutral smoke report records transport and honest retention posture; a real DeepSeek run awaits `DEEPSEEK_API_KEY`.
- 2026-08-01: The Vercel AI SDK / DeepSeek route expands the Node.js 24.14.0 checkpoint to 140 passing tests plus full typecheck and production build.
- 2026-08-01: A pinned pi CLI is the repository-aware investigator lane. It runs DeepSeek V4 Flash in an isolated, no-session final-text process with read/search/list tools only; reports remain task-scoped, self-hashed, unreviewed proposals with no execution authority.
- 2026-08-01: The pi investigator checkpoint passes the full 144-test workspace suite, typecheck, production build, pinned CLI/model discovery, and bundled missing-key fail-closed check under Node.js 24.14.0.
- 2026-08-01: Local control-plane credentials live in the Git-ignored root `.env.local`; process-level variables retain precedence, and Studio plus both qualification commands load the file automatically.
- 2026-08-01: Local environment loading and bounded pi stream handling expand the Node.js 24.14.0 checkpoint to 147 passing tests plus full typecheck and production build.
- 2026-08-01: Real pi qualification exposed quadratic JSON event amplification: repeated full streaming snapshots crossed 64 MiB. The investigator now uses bounded final-text output and records that per-tool traces are unavailable while retaining an application-owned read-only tool allowlist.
- 2026-08-01: Real `deepseek-v4-flash` qualification passes both lanes. Vercel AI SDK produced a grounded three-proposal report (`sha256:93e5612e…273735`); pi produced a scope-validated investigator report (`sha256:41cd6d74…10b2d1`) after the final-text boundary correction. Neither report has review, certificate, value-moving, or execution authority.
- 2026-08-01: pi is now an explicit operator-triggered Investigation Desk in the control plane and Studio. One task runs at a time; identical work is idempotent, competing work fails closed, sanitized RUNNING/FAILED/PASS records are streamed over SSE, and every report remains outside review, compilation, certification, and execution.
- 2026-08-01: The Investigation Desk checkpoint passes the full 153-test workspace suite, typecheck, and production build under Node.js 24.14.0.
- 2026-08-01: Operational schema v2 persists only completed pi investigations as canonical, hash-checked records. PASS/FAILED history, bounded retention, and passed-task idempotency survive restart; non-resumable RUNNING state remains process-local.
- 2026-08-01: Durable investigation recovery expands the Node.js 24.14.0 checkpoint to 159 passing tests plus full typecheck, production build, v1→v2 migration, tamper rejection, retention, failed-task retry, scope-conflict, and HTTP restart coverage.
- 2026-08-01: Limitless catalog normalization expands the verified scout corpus to 12 listings in seven fixture artifacts across six venues. Its prices are parsed lexically into `bigint` fixed point and its public catalog remains live-disabled.
- 2026-08-01: The control plane now refreshes six anonymous public catalog endpoints into an `OBSERVE_ONLY` layer. Raw responses are byte-capped, content-addressed, normalized per venue, and retained in bounded SQLite WAL schema v3; one source may degrade without discarding the last successful observation or blocking the other sources.
- 2026-08-01: Real anonymous refresh qualifies all six sources without credentials or a Polymarket proxy: 314 current listings under observation-set `sha256:4135ba…46b8`. Gemini protocol drift showed that active contracts may omit buy-side indicative prices, so the adapter now retains those contracts with absent prices instead of inventing zero or rejecting the complete response.
- 2026-08-01: Live catalog observation expands the Node.js 24.14.0 checkpoint to 168 passing tests plus full typecheck and production build. Studio displays current observation count, source health, durability, explicit fixture-vs-live labels, and an operator-triggered refresh while keeping live data outside scout context until separately qualified for promotion.
