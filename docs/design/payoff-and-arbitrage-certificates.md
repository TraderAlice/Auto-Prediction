# Payoff and Arbitrage Certificates

An opportunity is a bounded portfolio over a canonical resolution partition. The solver may optimize a candidate, but the TypeScript exact verifier independently recomputes costs, fees, payouts, capital, and the worst state using `bigint`.

A certificate binds claim graph, partition, listing rules, fee schedules, book generations, executable legs, payoff per state, venue capital, assumptions, and expiration. If any bound identity changes, the certificate is invalid.

Only fully proven contract-level or explicitly venue-bounded portfolios may be labeled arbitrage. Basis, semantic spread, and market making remain separate classifications.
