# Venue Protocol Ports

Adapters are compositions of narrow capabilities: catalog, contract rules, realtime book, trade tape, order, position, balance, settlement, conditional token, liquidity provision, combo/RFQ, and AMM pool.

Each adapter owns its external codecs and publishes protocol identity, official sources, raw fixtures, precision rules, limitations, and qualification evidence. No generated or SDK type enters Core.

Qualification is capability-specific: `DISCOVER`, `OBSERVE`, `PRICE`, `EXECUTE`, `HEDGE`, `MAKE`, `SETTLE`. Research may automatically establish only the read-side stages. A gateway implementation is not permission to execute.
