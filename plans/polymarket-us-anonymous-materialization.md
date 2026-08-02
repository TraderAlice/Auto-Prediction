# Polymarket US anonymous exact materialization

Status: active
Started: 2026-08-02

## Outcome

Turn an accepted, compiler-ready Polymarket US relation into an anonymously
acquired, raw-evidence-bound FOK simulation plan. Qualify both YES and synthetic
NO depth and charge a conservative exact upper bound for the venue's theta
taker fee, without credentials, order entry, signing, or value movement.

## Runtime evidence

- The live review-attention queue contains 50 reviewed items, one
  `DECISION_READY` item, and zero exact anonymous adapter paths.
- The decision-ready item is the Atlanta Braves World Series champion implies
  National League champion pair on Polymarket US.
- Both anonymous book endpoints currently return open books with nanosecond
  transaction timestamps; the World Series book shows a 0.075 bid / 0.076
  offer at the qualification start.
- Anonymous market metadata binds each slug to distinct Yes/No side IDs,
  0.001 price ticks, one-contract minimum quantity, and fee coefficient 0.06.
- The public API is reachable through the operator-configured network path; no
  API key, cookie, account, or trading endpoint is involved.

## Protocol decision

Official Polymarket US documentation establishes:

1. the gateway market and book endpoints are public anonymous data;
2. only the long/YES instrument is directly traded;
3. buying NO at price `x` uses the long-side reference price `1 - x`;
4. therefore visible YES offers are executable YES asks, while visible YES
   bids become synthetic NO asks at `1 - bid`, retaining displayed quantity;
5. taker fee is `theta * contracts * p * (1 - p)` and is symmetric under the
   YES/NO complement;
6. fees round to the nearest cent with half-to-even rounding;
7. for an aggressive order with multiple fills, total charged fee never
   exceeds banker's rounding of the cumulative exact fee.

For a fixed requested quantity and captured book, the materializer will walk
the same price levels as the simulator, sum the exact rational theta fee, and
use the venue's rounded cumulative amount as a fixed conservative fee bound.
This may overstate actual commission but cannot overstate the arbitrage floor.

Primary evidence:

- https://docs.polymarket.us/api-reference/introduction
- https://docs.polymarket.us/api-reference/market/overview
- https://docs.polymarket.us/api-reference/orders/overview
- https://docs.polymarket.us/fees

## Construction slices

- [x] Record live protocol and bottleneck evidence.
- [x] Parse and bind anonymous Polymarket US book and market-detail sources.
- [x] Transform bid depth into synthetic NO asks without floating point.
- [x] Compute the cumulative theta fee upper bound with rational bigint
  half-to-even rounding at the one-cent quantum.
- [x] Expose Polymarket US as exact anonymous adapter coverage.
- [x] Prove raw-source persistence, restart, mismatch, quantity, and rounding
  failure paths.
- [x] Run full checks, production build, live two-leg smoke, and desktop/390 px
  Studio QA.
- [ ] Publish and serially merge the campaign PR.

## Safety and boundedness

- Only anonymous `GET` requests to documented public gateway endpoints occur.
- The trading host, order APIs, credentials, cookies, signing, accounts,
  balances, positions, and funding surfaces remain absent.
- Every normalized level and fee bound stays bound to retained raw bytes,
  source URL, receive time, native book generation, protocol identity, and
  content hash.
- Prices, quantities, complement arithmetic, fees, costs, and floors use
  bigint fixed-point/rational arithmetic only.
- The model and semantic reviewer still propose; only deterministic compilation,
  simulation, and the first-party verifier may promote evidence.
- Existing operator semantic-decision authority does not change. An adapter
  path being exact does not accept the Atlanta relation on the user's behalf.

## Qualification gate

- YES consumes offers; NO consumes complemented bids in best-price order.
- Side IDs, slug, open state, price tick, minimum quantity, and fee coefficient
  are bound to current anonymous market-detail evidence.
- A mismatched slug, side mapping, tick, state, malformed depth, or unaligned
  quantity fails visibly and yields no plan.
- The fee bound reproduces the venue's half-to-even examples and never uses
  JavaScript `number` for monetary arithmetic.
- A two-leg Polymarket US qualification produces a full raw-evidence-bound
  simulation plan when depth is sufficient.
- Existing Polymarket Global and Limitless behavior is unchanged.
- Live smoke performs four anonymous GETs for two legs, retains all four raw
  sources, and performs zero trading-host or value-moving calls.
- Studio shows the newly available exact adapter path and remains readable at
  desktop and 390 px without horizontal overflow or runtime errors.

## Qualification evidence

- Node 24 `pnpm check`, all 400 workspace tests, and the production build pass.
  The control-plane suite contains 251 passing tests.
- Focused qualification covers YES offers, complemented NO bids, side-ID and
  slug mismatch, closed or malformed evidence, quantity increment rejection,
  one-cent half-to-even ties, positive exact verification, and byte-exact
  SQLite restart with the theta fee bound intact.
- An ephemeral Atlanta smoke performed four anonymous gateway GETs and retained
  four raw sources. It materialized 11 synthetic-NO levels and seven YES levels
  for one contract per leg with no credentials or trading-host calls.
- The smoke consumed current prices 0.925 for World Series NO and 0.129 for
  National League YES. Conservative fee bounds of 0.00 and 0.01 produced cost
  1.064 and a -0.064 floor, correctly classifying the current pair as
  `NO_POSITIVE_SIMULATED_FLOOR`.
- The live operator queue now reports one exact adapter path instead of zero,
  while preserving one decision-ready item and zero positive gross hints.
- Studio renders the exact adapter label at desktop and 390 px; measured
  document width equals viewport width at both sizes and browser logs contain
  no errors or warnings.
