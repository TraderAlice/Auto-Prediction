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
- Current official-source census for eight venue families.
- Focused unit and property tests.

The exact arbitrage verifier, fixture-backed venue adapters, shadow execution, capital/risk state, hedge curves, CLI, and Studio remain active campaign work.

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
- `projects/venue-research`: dated official-source research.
- `docs/design`: current architecture truth.
- `plans/architecture-qualification.md`: live qualification campaign.
- `AGENTS.md`: collaboration rules and the user-input/access ledger.

The original design brief remains at `prediction-market-harness-design-and-codex-prompt.md`; stable implementation truth belongs in `docs/`.
