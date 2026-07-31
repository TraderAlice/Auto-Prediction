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
- 2026-07-31: The full typecheck, 118-test workspace suite, and production builds pass under isolated Node.js 24.18.1, closing the target-runtime qualification gate while the default host remains on Node.js 22.
