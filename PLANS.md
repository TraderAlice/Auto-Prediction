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
