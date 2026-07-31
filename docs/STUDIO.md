# Harmony Studio

Harmony Studio is the read-only visual surface for architecture qualification. It uses Vite, React 19, Tailwind CSS 4, and repository-owned shadcn/ui components.

## Process boundary

`packages/control-plane` is a long-running Node process. It owns the current projection, AI discovery coordination, and an SSE event stream. Studio reads:

- `GET /api/v1/projection`
- `GET /api/v1/events`
- `GET /api/v1/books`
- `GET /api/v1/qualification`
- `POST /api/v1/books/replay`
- `POST /api/v1/discovery/runs`

If the process is unavailable, Studio shows an explicit offline state. It does not silently fall back to a build-time snapshot.

The normal development process opens `.data/control-plane.sqlite` in WAL mode.
`PMH_STATE_DB` may override the path. The health and discovery projections
publish only storage posture (`SQLITE_WAL`, schema version, durability, and
`taskId` idempotency), never the local filesystem path.

The opportunity, payoff, verifier-trace, and capital panels are now derived
from the control plane's checked-in reviewed-compilation qualification
artifact. The artifact is a synthetic two-venue fixture and is labeled as such
throughout the UI; it is not connected to a live market and cannot produce an
executable action. Studio no longer invents venue balances, shortened
certificate identifiers, or exact opportunity rows as presentation-only data.

The Venue Matrix exposes order posture separately from capability names.
Kalshi is labeled `INERT DEMO`, Gemini is labeled `INERT SANDBOX`, and every
other venue is labeled absent. These labels describe request-shape coverage,
not trading readiness; the projection keeps `liveExecutionEnabled: false` for
every venue.

## Book desk

The Books projection is backed by `ReplayBookDesk` in the control plane. On
startup it verifies the checked-in Polymarket, Gemini, and Limitless stream
artifacts, decodes them with venue-local codecs, and applies the resulting
events to deterministic books.

`GET /api/v1/books` returns the current read-only projection.
`POST /api/v1/books/replay` repeats the in-memory replay, declares external
writes, value movement, and live execution as literal `false`, and broadcasts
the updated projection to Studio over SSE.

The UI displays lifecycle, generation, native sequence policy, top depth,
state identity, and evidence identity. It does not recompute book truth.

## Scout inbox

Completed discovery runs are retained by a `DiscoveryLedger` with a fixed
25-run bound backed by the SQLite operational store. Each record binds the
original question, venue scope, and catalog-context identity to worker
identities, diagnostics, and proposal-only hypotheses. The control
plane rejects any record that is not `PROPOSE_ONLY`, `UNREVIEWED`, and
`executionAuthority: false`.

Studio can submit bounded tasks and renders start/completion state from SSE.
Identical normalized tasks reuse their persisted ID and return the original
run after restart; simultaneous duplicates share one worker invocation. The
State Store metric exposes whether the current projection is durable WAL or an
ephemeral test process.
It deliberately exposes no accept or promote control: equivalence-review
authority has not been configured, so every hypothesis remains visibly locked
before deterministic candidate compilation.

Above the runtime queue, Studio renders the five-stage promotion contract using
the synthetic golden fixture: discovery, independent review, deterministic
compilation, exact verification, and blocked execution authority. This proves
the code path without suggesting that a runtime scout result has been reviewed.

## AI boundary

Discovery workers may be cheap heuristics or external models. They can propose search terms, possible same-claim links, and strategy hypotheses. Every hypothesis is `PROPOSE_ONLY` and `UNREVIEWED`.

The worker rack reflects actual control-plane configuration. Its model card
publishes only the provider name, model ID, output-token ceiling, timeout,
minimal-reasoning posture, and `store:false` setting. `NEEDS KEY` means
`OPENAI_API_KEY` was absent at process start and no model request can be made;
the browser never receives that credential. When configured, the external
worker runs in parallel with the free heuristic and its failure is retained as
a diagnostic rather than granting or widening authority.

The Catalog Facts panel reflects the verified discovery corpus: 11 normalized
listings from six fixture artifacts across five venues. Each task receives at
most 30 relevance-ranked listings. Studio shows the corpus identity, retained
context identity, and concrete listing references used by each hypothesis;
zero hypotheses is a valid grounded result rather than a transport failure.

AI output cannot:

- publish a semantic equivalence decision;
- publish an arbitrage certificate;
- bypass depth, fee, precision, payout, or capital checks;
- grant execution authority.

Deterministic candidate compilation and the independent exact verifier remain downstream authority boundaries.

The qualification compiler requires a separate hash-bound hypothesis review,
the exact set of accepted `EXACT` market-link proposal/review hashes, a
connected listing graph, current rule/fee/book identities, and a positive
worst-case payoff after conservative rounding. Browser state cannot fabricate
any of these inputs.

## Evidence inventory

The Evidence view consumes replay qualification from the control-plane
projection. Its summary counts, all six chaos cases, observed fail-closed
postures, suite identity, and immutable campaign artifact identity are runtime
facts rather than hard-coded presentation data.

The projection also carries the synthetic reviewed-compilation artifact,
including every stage identity, the full certificate hash, literal-false
effects, and its explicit fixture scope.

## Local use

```bash
pnpm studio
pnpm studio:build
```

The first command runs the control plane and Vite dashboard together.
