# Polymarket US catalog breadth

Status: active
Started: 2026-08-02

## Outcome

Increase the Polymarket US market universe visible to recurring AI search from
20 to the gateway's bounded 500-record single-response maximum. Preserve the
existing raw byte cap and context-scope controls, then measure whether the
larger immutable corpus produces new semantic neighborhoods and candidates
before designing pagination rotation.

## Runtime evidence

- The live seven-source catalog contains 467 listings: 347 Gemini listings and
  exactly 20 from each of the other six venues.
- Polymarket US anonymous requests at offsets 0, 100, 200, 500, 1,000, 2,000,
  3,000, 5,000, and 10,000 all returned full pages, proving at least 10,100
  currently open, non-archived market records.
- Offset 20,000 returned an empty page, so the active universe is large but
  bounded below that probe.
- `limit=500` returns 500 records in about 1,393,229 raw bytes.
- `limit=1000` returns the same bytes and records, establishing a gateway-side
  maximum of 500 for this endpoint.
- The control plane already permits 2,000,000 bytes per catalog response, so a
  500-record response needs no authority or storage-cap expansion.
- A restart with historical `limit=20` evidence initially failed closed because
  the persisted source URL no longer matched. Hydration now preserves the old
  record but does not restore it as the current slice; the new URL must refresh
  successfully. A protocol-identity mismatch still fails closed.
- The first live restart qualified exactly 500 Polymarket US listings in
  1,393,229 bytes and 947 listings across all seven healthy sources.
- A scheduled refresh retained the next 500-record response in 1,393,232 bytes;
  the three-byte change produced a new content hash while remaining below the
  cap. A subsequent process restart restored that exact URL, hash, byte length,
  and all 947 listings from SQLite WAL v17 before another network refresh.
- The first current-corpus Agent run received a new exact-pair routing scope:
  Gemini golfer Davis Riley and Polymarket US MLB MVP candidate Austin Riley.
  This was surname collision, not a shared claim. The fast model timed out, the
  retained hypothesis referenced only the US listing, and the system correctly
  ran neither pi nor semantic proposal publication. The larger slice therefore
  changed the explored neighborhood without manufacturing an arbitrage claim.

## Architecture decision

1. change only the Polymarket US live catalog request from `limit=20` to
   `limit=500&offset=0`;
2. keep one content-addressed raw response and one normalized source identity;
3. keep the 15-minute freshness rule, byte cap, anonymous GET policy, and
   per-venue drift isolation unchanged;
4. keep Agent task contexts bounded to 30 listings and issue-local semantic
   scopes; expanding the catalog does not send 500 records to one prompt;
5. trigger a fresh catalog observation and let the existing content-addressed
   scheduler treat the larger corpus as new evidence;
6. measure listing count, bounded-scope rotation, candidate novelty, latency,
   raw bytes, and failures before deciding whether offsets beyond 0 should
   rotate across refreshes.

## Construction slices

- [x] Record live cardinality, response-size, and gateway-cap evidence.
- [x] Change the live source request and bind the new source URL in tests/docs.
- [x] Qualify a 500-market anonymous response below the existing byte cap.
- [x] Refresh the live seven-source corpus and measure search-scheduler impact.
- [x] Run full checks, production build, desktop QA, and 390 px QA.
- [ ] Publish and serially merge the campaign PR.

## Safety and boundedness

- One anonymous public GET replaces the existing anonymous public GET; request
  count, credentials, and authority do not increase.
- The raw response remains below the existing hard byte cap and uses existing
  bounded SQLite retention.
- Normalized market values remain bigint fixed point.
- Agent prompt context, hypothesis count, pi escalation, concurrency, retry,
  and provider budgets do not increase.
- Catalog breadth grants proposal input only; it grants no review, semantic
  acceptance, simulation, certificate, or execution authority.
- No order, account, signature, production credential, or value movement is
  introduced.

## Qualification gate

- A live refresh returns exactly 500 normalized Polymarket US listings and a
  total corpus near 947 when the other six sources remain healthy.
- Raw response bytes remain below 2,000,000 and survive SQLite restart with the
  exact source URL and content hash.
- A task-scoped Agent context remains at or below 30 listings.
- Existing 20-record fixture normalization remains valid; fixture evidence is
  not rewritten to impersonate the new live response.
- A malformed or oversized response fails only Polymarket US and cannot enter
  the current corpus.
- Studio remains responsive and readable at desktop and 390 px without
  horizontal overflow or browser errors.

## Qualification result

- All seven sources are current: Polymarket US contributes 500 of 947 listings.
- The live raw response is 1,393,232 bytes and restores byte-for-byte from
  SQLite WAL v17 with its content hash and explicit source URL.
- The new Agent run used two refs and retained no out-of-scope promotion; the
  general synthetic qualification test keeps contexts at 30 listings and 50 KB.
- Node 24 checks, 402 workspace tests, and the production control-plane/Studio
  build pass.
- Desktop 1280 px and mobile 390 px browser QA show the 947-listing observation,
  no horizontal overflow, and no warning or error logs.
