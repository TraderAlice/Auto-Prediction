# Polymarket US anonymous materialization evidence — 2026-08-02

## Scope

Qualify public, read-only evidence sufficient to materialize a fixed-quantity
YES/NO FOK research simulation. This does not qualify authentication, account
state, order entry, execution, or funding.

## Official protocol evidence

- The API introduction separates the anonymous
  `https://gateway.polymarket.us` market-data API from the authenticated
  trading host: <https://docs.polymarket.us/api-reference/introduction>.
- The market overview defines public full books as long-instrument bids and
  offers with quantity and transaction time:
  <https://docs.polymarket.us/api-reference/market/overview>.
- The orders overview states that only YES is directly traded and that buying
  NO at `x` uses long-side `price.value = 1 - x`:
  <https://docs.polymarket.us/api-reference/orders/overview>.
- The fee schedule effective 2026-07-01 defines taker fee
  `theta * contracts * p * (1 - p)`, one-cent half-to-even rounding, and a
  cumulative-order adjustment that never charges more than half-to-even
  rounding of the cumulative exact fee: <https://docs.polymarket.us/fees>.

## Anonymous live observations

At 2026-08-02 qualification time, anonymous GETs returned HTTP 200 JSON for:

- `/v1/markets/tec-mlb-champ-2026-09-27-atl/book`;
- `/v1/market/slug/tec-mlb-champ-2026-09-27-atl`;
- `/v1/markets/tec-mlb-nlchamp-2026-09-27-atl/book`;
- `/v1/market/slug/tec-mlb-nlchamp-2026-09-27-atl`.

The market-detail responses bound open status, distinct Yes/No side IDs,
0.001 price ticks, one-contract minimum quantity, and `feeCoefficient = 0.06`.
The World Series contract showed a 0.075 bid and 0.076 offer during the first
observation. The subsequent materializer smoke retained all four responses in
memory and normalized 11 synthetic-NO ask levels plus seven YES ask levels.

For one contract, the smoke consumed the World Series NO ask at 0.925 and the
National League YES ask at 0.129. The conservative cumulative fee bounds were
0.00 and 0.01 respectively, producing total simulated cost 1.064 and a -0.064
worst-case floor. The adapter therefore proved the candidate was not currently
an arbitrage; it did not submit or prepare an order.

## Arithmetic decision

For each leg, the materializer walks displayed normalized ask levels up to the
fixed requested quantity and sums the exact rational fee numerator. It rounds
the cumulative rational once to the one-cent quantum using integer
half-to-even arithmetic. The result is stored as a fixed fee bound on the exact
book- and quantity-bound simulation request.

Because the venue states that actual multi-fill taker commission never exceeds
that cumulative rounded amount, this construction may underestimate profit but
cannot manufacture a positive floor. Any changed market detail, side binding,
book bytes, requested quantity, theta, tick, or protocol identity changes the
bound identity.
