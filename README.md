# Prediction Market Interoperability Harness

Pre-alpha infrastructure for describing prediction-market contracts across venues, replaying their market data deterministically, and proving bounded portfolio payoffs with exact arithmetic.

This is not a trading bot and it has no live-trading authority. The repository does not contain or request production credentials, cannot place a live order, and must not move funds.

## What exists

- Strict TypeScript workspace with first-party domain, protocol, and market-state packages.
- `bigint` fixed-point parsing and conservative rounding helpers.
- Claim → Resolution Specification → Outcome Space → Venue Listing model.
- Explicit binary, categorical, scalar/range, conditional, multivariate, void, canceled, and invalid resolution states.
- Hash-bound market-link proposals and independent review artifacts.
- Composable venue capability ports and qualification evidence.
- Deterministic snapshot/delta book replay with gap, duplicate, out-of-order, tick, stale, and rebuild handling.
- Content-hash verification for immutable raw fixtures and anonymous acquisition metadata.
- Fixture-backed catalog adapters for Polymarket Global, Kalshi, Gemini Prediction Markets, Opinion, and Myriad.
- Lexical JSON-number decoding so venue number tokens never pass through IEEE-754 before fixed-point conversion.
- Depth-, tick-, fee-, and per-venue-capital-aware complete-set candidate compilation.
- Independent exact certificate verification across every canonical resolution state.
- Certificate invalidation on rule, fee, book generation, book state, partition, or expiry changes.
- Per-venue capital reservations with conservation across available, reserved, deployed, unresolved, receivable, and realized-PnL states.
- Multi-leg shadow execution DAGs with idempotent submission, partial fills, cancel/release, UNKNOWN reconciliation, hedge locking, and terminal settlement.
- A fixed Risk Governor that blocks live mode, stale/gapped books, expired certificates, excessive residual/capital exposure, heartbeat/cancel failures, and state divergence.
- Current official-source census for eight venue families.
- Focused unit and property tests.

Realtime adapters, persistent SQLite operational state, hedge curves, CLI, campaign evidence, and Studio remain active campaign work.

## Safety boundary

- No JavaScript `number` represents money, price, quantity, fee, payout, PnL, or tick in Core.
- Unknown precision, incomplete payout partitions, sequence gaps, stale books, and mismatched evidence fail closed.
- Solver output is never authoritative; only the independent exact verifier may publish a certificate.
- SDK types cannot cross venue-adapter boundaries.
- Live execution is disabled by construction and policy.

## Development

Requirements: Node.js 24+ and pnpm 11.

```bash
corepack enable
pnpm install
pnpm check
pnpm test
```

The host used for the initial checkpoint exposed Node.js 22.22.1, so the repository correctly warns about the engine mismatch even though the current checks pass there. A Node 24 checkpoint is still required before runtime qualification.

## Project map

- `packages/domain`: canonical contract truth, exact fixed-point values, identities, and links.
- `packages/protocol`: event envelopes, capability manifests, and narrow venue ports.
- `packages/market-state`: deterministic order-book state and replay.
- `packages/evidence`: raw fixture identity and tamper detection.
- `packages/opportunity`: bounded candidate compilation and exact payoff certificates.
- `packages/capital`: per-venue reservations and settlement-capital conservation.
- `packages/risk`: fixed opening authority and kill conditions.
- `packages/execution`: validated multi-leg plans and shadow-only order lifecycle.
- `packages/venue-*`: venue-local codecs, manifests, and normalized adapters.
- `projects/venue-research`: dated official-source research.
- `docs/design`: current architecture truth.
- `plans/architecture-qualification.md`: live qualification campaign.
- `AGENTS.md`: collaboration rules and the user-input/access ledger.

The original design brief remains at `prediction-market-harness-design-and-codex-prompt.md`; stable implementation truth belongs in `docs/`.
