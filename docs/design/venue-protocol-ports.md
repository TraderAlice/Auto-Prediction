# Venue Protocol Ports

Adapters are compositions of narrow capabilities: catalog, contract rules, realtime book, trade tape, order, position, balance, settlement, conditional token, liquidity provision, combo/RFQ, and AMM pool.

Each adapter owns its external codecs and publishes protocol identity, official sources, raw fixtures, precision rules, limitations, and qualification evidence. No generated or SDK type enters Core.

Qualification is capability-specific: `DISCOVER`, `OBSERVE`, `PRICE`, `EXECUTE`, `HEDGE`, `MAKE`, `SETTLE`. Research may automatically establish only the read-side stages. A gateway implementation is not permission to execute.

## Inert order gateways

Kalshi demo and Gemini sandbox provide the first order-shape contracts. They
validate venue-local decimal strings, map intents to current official paths,
and bind the unsigned target request to a SHA-256 receipt. They intentionally
have no HTTP transport, nonce generator, signer, credential input, or response
decoder.

`submit`, `cancel`, and `reconcile` all terminate locally with
`REJECTED_INERT`, `networkAttempted: false`, `credentialsUsed: false`, and
`valueMovingOperation: false`. Their capability qualification is `DISCOVER`
only. Adding configuration cannot promote either gateway to `EXECUTE`.
