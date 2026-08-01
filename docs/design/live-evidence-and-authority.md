# Live Evidence and Authority

Git owns small reviewed facts, source, tests, campaign definitions, and content-addressed manifests. SQLite WAL owns operational projections and idempotency state. Segmented NDJSON or Parquet owns dense streams.

The current SQLite schema stores bounded discovery runs, completed pi
investigations, and anonymous catalog observations. Records bind their scope,
completion/receive time, canonical JSON or raw bytes, and content hashes. WAL
plus full synchronous mode protects local restart recovery; schema version,
retention deletion, and insertion occur transactionally. A duplicate `taskId`
never overwrites a previous scope, and database persistence never upgrades a
proposal's authority.

Every campaign binds source state, runtime, adapter/protocol versions, strategy and rule hashes, fee/capability/qualification state, dataset manifests, risk policy, authority, timestamps, and every simulated or observed lifecycle event.

Subjective discovery output is never rewritten into an approved object. A
separate review artifact binds the hypothesis and the complete set of accepted
market-link proposal/review hashes. Only that immutable review bundle may
authorize deterministic candidate compilation, and the resulting candidate
still has no authority until the independent exact verifier publishes a
certificate. A certificate in the current qualification campaign remains
synthetic and shadow-only.

The immutable real-candidate preflight is deliberately earlier than review or
certification. It binds an exact three-venue claim map to lexically preserved
catalog and venue-reported quote facts, recomputes costs with `bigint`, and
publishes a blocked trace when the reported buy floor is non-positive or
quantity, fee, and reviewer evidence is incomplete. Its
`verifierInvoked: false` field is positive evidence that screening did not
silently turn a nominal spread into a certificate.

The follow-on real-candidate depth artifact binds two anonymous public REST
books and walks them with conservative `bigint` rounding at a common
five-share quantity. It models Limitless NO acquisition as a complete-set split
followed by selling YES, but does not call either operation. A raw fixture hash
and receive time are not silently promoted into a venue generation: because
the Limitless REST response exposes no generation identity, the route remains
non-certificate-grade even before its dynamic taker fee and independent review
gaps are considered.

The repository has no live-trading authority. No adapter method may turn configuration alone into permission to place an order or move value.

Order-shape research emits `pmh.inert-order-ack.v1` receipts. Each receipt
binds the target method, path, and unsigned request shape while proving that no
network, credential, or value-moving operation occurred. A later executable
gateway would require a separate authority design and cannot be activated by
supplying environment variables to an inert gateway.
