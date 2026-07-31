# Payoff and Arbitrage Certificates

An opportunity is a bounded portfolio over a canonical resolution partition. The solver may optimize a candidate, but the TypeScript exact verifier independently recomputes costs, fees, payouts, capital, and the worst state using `bigint`.

A certificate binds claim graph, partition, listing rules, fee schedules, book generations, executable legs, payoff per state, venue capital, assumptions, and expiration. If any bound identity changes, the certificate is invalid.

Only fully proven contract-level or explicitly venue-bounded portfolios may be labeled arbitrage. Basis, semantic spread, and market making remain separate classifications.

## Exact rounding policy

- BUY notional and fees round upward.
- BUY payouts round downward.
- SELL proceeds round downward and SELL liabilities round upward.
- A certificate uses the minimum net payoff across the complete canonical partition.
- `CERTIFIED_CONTRACT_ARBITRAGE` and `VENUE_BOUNDED_ARBITRAGE` require a strictly positive post-fee minimum.

The bounded complete-set compiler may choose a candidate quantity using depth, common quantity ticks, and per-venue capital limits. It has no authority. The verifier independently checks its output and binds both book generation and exact book-state hashes; an in-generation depth change therefore invalidates the certificate.
