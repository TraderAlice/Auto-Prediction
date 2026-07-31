# Prediction Market Interoperability Harness — Collaboration Ledger

This repository is a pre-alpha, research-first interoperability harness. It must never place a live order, sign a transaction, approve a token, move funds, or request/store production trading credentials unless the user separately and explicitly expands authority.

## Working rules

- Treat official venue documentation, schemas, contracts, and anonymous public API responses as protocol evidence.
- Preserve raw fixtures byte-for-byte and bind normalized data to source, receive time, protocol identity, and a content hash.
- Core monetary values, prices, quantities, fees, payouts, and PnL use `bigint` fixed-point values, never JavaScript `number`.
- Solvers propose candidates. Only the first-party exact verifier may publish a certificate.
- Venue SDK and generated API types stay inside their adapter package.
- Live execution is disabled by construction and by policy. Tests must prove this.
- Update `PLANS.md` and the active file under `plans/` when evidence changes a decision.
- Do not create placeholder packages. A package must own working source and focused tests.

## User input / access ledger

Delete an item as soon as the user supplies it or the project no longer needs it. Do not place secrets themselves in this file.

### Needed now

None.

### Deferred decisions (not blockers)

- Final product/repository name (working name: `prediction-market-harness`).
- Equivalence-review authority for production decisions.
- First account-eligible region and first live venue.
- Initial real-capital and per-venue limits.
- Credential custody design.
- Dense evidence object-store destination.
- Whether this remains standalone or later becomes an OpenAlice desk.
- First external-anchor family after prediction-market qualification.
- First discovery-model provider, model budget, and credential source. This is not needed for heuristic/replay mode.

### Environment gaps Codex owns

- The host currently exposes Node.js 22.22.1; the production target is Node.js 24+.
- The host currently exposes Python 3.9.6; the optional solver-sidecar target is Python 3.12+.

## Authority boundary

Anonymous catalog, rules, market-data research, fixture capture, deterministic replay, simulation, and shadow execution are authorized. Real credentials and all value-moving operations are out of scope.
