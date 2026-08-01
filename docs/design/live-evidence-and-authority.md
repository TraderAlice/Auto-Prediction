# Live Evidence and Authority

Git owns small reviewed facts, source, tests, campaign definitions, and content-addressed manifests. SQLite WAL owns operational projections and idempotency state. Segmented NDJSON or Parquet owns dense streams.

The current SQLite schema stores bounded discovery runs, completed pi
investigations, anonymous catalog observations, and candidate-book
observations. Records bind their scope, completion/receive time, canonical JSON
or raw bytes, and content hashes. WAL
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

The disposition artifact is a separate, narrower authority: it may reject a
bound book snapshot without promoting the route. It binds official Limitless
fee prose showing a non-negative 42–150 bp sell-taker range. Combined with a
zero gross-floor upper bound, fee monotonicity proves that strict post-fee
positivity is impossible, so exact fee computation, route qualification,
independent review, and exact verification are unnecessary for rejection.
The result expires logically when either book identity changes and grants no
certificate or execution authority.

A rescreen is a new decision, not an extension of the expired one. Its lineage
rebuilds the prior disposition from immutable sources, binds fresh receive
times, distinguishes byte-identical observations from substantive raw or
native-generation changes, and requires at least one substantive book change.
Only then may it recompute current depth and disposition evidence. A test with
newly positive gross economics proves that an old rejection cannot be carried
forward: the rejection builder fails instead of manufacturing continuity.

Candidate Watch operationalizes this rule without widening authority. Both
venue observations must share a successful refresh identity before screening;
otherwise the projection is degraded and has no decision. Exact raw bytes are
retained under schema v5 and reverified during hydration. A bounded,
content-hashed refresh journal records success and failure outcomes separately;
its newest entry is the restart authority and every successful source outcome
must bind an exact retained observation. Unchanged identities may reuse only
their already-bound snapshot result. Changed identities produce a fresh depth
result; non-positive economics may be rejected, while positive gross economics
can only request later qualification. Independent review and the exact verifier
remain literal false in all watch outcomes.

The repository has no live-trading authority. No adapter method may turn configuration alone into permission to place an order or move value.

Order-shape research emits `pmh.inert-order-ack.v1` receipts. Each receipt
binds the target method, path, and unsigned request shape while proving that no
network, credential, or value-moving operation occurred. A later executable
gateway would require a separate authority design and cannot be activated by
supplying environment variables to an inert gateway.
