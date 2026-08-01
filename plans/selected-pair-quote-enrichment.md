# Selected-pair anonymous quote enrichment

Status: active
Started: 2026-08-02

## Outcome

Let an AI-selected exact two-listing pair acquire the minimum anonymous public
book evidence needed to calculate a current indicative gross gate when catalog
prices are absent. Retrieval stays bounded to the selected pair and remains a
search-prioritization screen before fees, quantity, semantic review, or exact
verification.

## Runtime evidence

The live seven-source corpus contains 467 listings. Radar currently exposes
three temporally aligned, exact-title hourly pairs across Limitless and Opinion
(BTC, BNB, and ETH). The cheap model can select an exact pair, but the focused
issue stops at `PRICE_UNAVAILABLE` because Opinion catalog records retain
outcome token ids without indicative prices.

This is now a funnel bottleneck: semantic retrieval and AI candidate selection
can identify the pair, while the economic gate cannot consume the venue's
current public book. Two fresh AI-selected pairs in the previous campaign
stopped before pi for this reason.

Official Opinion documentation describes a token orderbook endpoint. A bounded
anonymous GET against the live endpoint succeeded without an API key and
returned token-bound bid/ask lexemes. The catalog already binds both YES and NO
token ids, so an on-demand selected-pair enrichment can remain anonymous,
read-only, content-addressed, and exact to the leased corpus.

## Architecture decision

1. evaluate the existing catalog-only gate first;
2. only when a required gate is `PRICE_UNAVAILABLE`, ask a bounded quote
   enricher for the exact selected listings;
3. fetch only missing outcome books from explicitly supported anonymous public
   venue endpoints;
4. preserve every response byte with receive time, source URL, protocol
   identity, token id, content hash, and native timestamp;
5. derive best asks with fixed-point `bigint`, bind them to copied leased
   listings, and recompute only the search gate;
6. leave failures and unsupported venues as honest `PRICE_UNAVAILABLE` results;
7. never label enriched best asks executable or fee/depth complete, and never
   use them as semantic, review, certificate, or execution authority.

## Construction slices

- [x] Add a bounded anonymous quote-enrichment desk with Opinion book parsing.
- [x] Persist raw quote observations byte-for-byte in SQLite WAL.
- [x] Call enrichment only for an exact AI-selected pair whose catalog gate is
  price-unavailable.
- [x] Bind gate provenance to catalog and anonymous-book source identities.
- [x] Report enrichment attempts, successes, failures, and rescued gates by
  issue.
- [x] Expose the enriched-gate funnel and evidence posture in Studio.
- [x] Add focused adapter, scheduler, persistence, restart, and authority tests.
- [x] Run full Node 24 checks, production build, live smoke, and desktop/390 px
  QA.
- [ ] Publish and serially merge the campaign PR.

## Qualification evidence

- Full workspace type checking, tests, and production build pass on Node 24.
- Control-plane coverage passes 36 files and 218 tests; Opinion adapter coverage
  passes three focused tests.
- A live seven-source refresh retained 467 listings and produced four radar
  candidates, including three aligned hourly Limitless/Opinion pairs.
- DeepSeek selected `limitless:343824` and `opinion:26459` for the focused issue.
  Exactly two anonymous Opinion GETs returned 308 and 309 bytes and persisted as
  two hash-verified observations in SQLite WAL schema v14.
- Both Opinion best asks were `0.999`; the recomputed conservative portfolio
  cost was 14,185 bps, giving a -4,185 bps gross floor. The gate became
  `NON_POSITIVE_GROSS_HINT` and pi stayed `NOT_RUN`.
- Studio exposes `1/1` rescued missing-price gates, two raw books, two retained
  observations, and fourteen economically avoided pi calls in the retained
  window.
- Desktop 1148×819 and mobile 390×844 have no horizontal overflow or console
  warnings/errors. The responsive pass caught and fixed a clipped mobile page
  title.

## Safety invariants

- Only `GET` requests with omitted credentials and redirects disabled are
  permitted.
- A request is derived only from outcome token ids already bound to the exact
  selected leased listings.
- Hosts, paths, request count, response size, timeout, and result count are
  statically bounded.
- Raw bytes are stored before their normalized best ask can influence a gate.
- All prices use venue-declared fixed-point `bigint`; JavaScript `number` never
  represents price, quantity, fee, payout, or PnL.
- Catalog and book prices are search hints only. Fees and common executable
  depth remain absent, so `executable` and every decision authority stay false.
- Acquisition failure cannot fail the semantic lease or manufacture a price.
- No key, wallet, signature, order, token approval, transaction, or fund path is
  introduced.

## Qualification gate

- Catalog-complete pairs do not invoke the enricher.
- Unsupported venues and non-exact scopes do not invoke the network.
- Opinion requests use the two leased outcome token ids and no credential.
- Malformed, oversized, mismatched-token, non-200, and partial responses leave
  the gate price-unavailable with bounded diagnostics.
- A complete two-outcome response produces fixed-point best asks and can turn a
  price-unavailable catalog gate into a positive or non-positive gross hint.
- Every normalized price points to retained raw bytes whose hash and record
  identity verify after restart.
- Enriched evidence cannot set fee/depth/executable or downstream authority.
- Existing catalog-only, exact-context, general issue, and pi gating tests pass.
- Full type checking, tests, build, live anonymous smoke, and responsive Studio
  QA pass.
