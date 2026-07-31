# Live Evidence and Authority

Git owns small reviewed facts, source, tests, campaign definitions, and content-addressed manifests. SQLite WAL owns operational projections and idempotency state. Segmented NDJSON or Parquet owns dense streams.

Every campaign binds source state, runtime, adapter/protocol versions, strategy and rule hashes, fee/capability/qualification state, dataset manifests, risk policy, authority, timestamps, and every simulated or observed lifecycle event.

The repository has no live-trading authority. No adapter method may turn configuration alone into permission to place an order or move value.

Order-shape research emits `pmh.inert-order-ack.v1` receipts. Each receipt
binds the target method, path, and unsigned request shape while proving that no
network, credential, or value-moving operation occurred. A later executable
gateway would require a separate authority design and cannot be activated by
supplying environment variables to an inert gateway.
