# Polymarket US catalog breadth evidence — 2026-08-02

## Question

How much of the current anonymous Polymarket US catalog can one bounded control
plane observation retain without changing credentials, storage authority, or
Agent prompt budgets?

## Official protocol surface

- Public API introduction: <https://docs.polymarket.us/api-reference/introduction>
- Market overview and pagination: <https://docs.polymarket.us/api-reference/market/overview>
- Observed endpoint: `GET https://gateway.polymarket.us/v1/markets`

All probes used `active=true`, `closed=false`, and `archived=false`. They sent no
credentials and performed no write or value-moving operation.

## Anonymous observations

- Full 100-record pages were returned at offsets 0, 100, 200, 500, 1,000,
  2,000, 3,000, 5,000, and 10,000. This proves at least 10,100 currently open,
  non-archived records; it is not a claim about the exact catalog cardinality.
- Offset 20,000 returned an empty page.
- `limit=200` returned 200 records in 664,687 raw bytes.
- `limit=500` returned 500 records in 1,393,229 raw bytes.
- `limit=1000` returned the same record count and response bytes as `limit=500`,
  establishing an observed gateway-side page maximum of 500.

## Decision

The live Polymarket US observation uses
`limit=500&offset=0`. One response fits below the existing 2,000,000-byte hard
cap, so it can use the existing content-addressed evidence record and bounded
SQLite retention. The source URL includes the explicit offset so later rotation
cannot silently reuse the same protocol identity.

This expands the immutable search corpus, not a single model prompt. Discovery
contexts remain issue-local and capped at 30 listings and 50 KB. The prior
20-record fixture remains historical protocol evidence and is not rewritten to
pretend it was the new live response.

Offsets beyond zero remain a measured follow-up, not an implicit expansion:
first qualify actual scheduler yield, latency, novelty, and failure behavior on
the 500-record slice.
