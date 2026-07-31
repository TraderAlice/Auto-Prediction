# Live Evidence and Authority

Git owns small reviewed facts, source, tests, campaign definitions, and content-addressed manifests. SQLite WAL owns operational projections and idempotency state. Segmented NDJSON or Parquet owns dense streams.

The current SQLite schema stores only bounded discovery-run records. Each row
binds `taskId`, `runId`, completion time, canonical JSON, and its content hash.
WAL plus full synchronous mode protects local restart recovery; schema version,
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

The repository has no live-trading authority. No adapter method may turn configuration alone into permission to place an order or move value.

Order-shape research emits `pmh.inert-order-ack.v1` receipts. Each receipt
binds the target method, path, and unsigned request shape while proving that no
network, credential, or value-moving operation occurred. A later executable
gateway would require a separate authority design and cannot be activated by
supplying environment variables to an inert gateway.
