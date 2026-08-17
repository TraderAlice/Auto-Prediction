# Auto Prediction Studio

Auto Prediction Studio is the non-value-moving operator cockpit for discovery,
qualification, and architecture evidence. It uses Vite, React 19, Tailwind CSS
4, and repository-owned shadcn/ui components.

For installation and runtime configuration, see [Operations](OPERATIONS.md).
For the system's ontology and opportunity model, see [Concepts](CONCEPTS.md).

## Process boundary

`packages/control-plane` is a long-running Node process. It owns the current projection, AI discovery coordination, and an SSE event stream. Studio reads:

- `GET /api/v1/projection`
- `GET /api/v1/events`
- `GET /api/v1/books`
- `GET /api/v1/qualification`
- `GET /api/v1/investigations`
- `GET /api/v1/research-cases/review-intake?caseId=...`
- `GET /api/v1/radar`
- `POST /api/v1/books/replay`
- `POST /api/v1/discovery/runs`
- `POST /api/v1/investigations`
- `POST /api/v1/radar/triage`
- `POST /api/v1/radar/investigate`
- `POST /api/v1/research-cases/investigate`

If the process is unavailable, Studio shows an explicit offline state. It does not silently fall back to a build-time snapshot.

The normal development process opens `.data/control-plane.sqlite` in WAL mode.
`PMH_STATE_DB` may override the path. The health, discovery, and investigation projections
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

## Opportunity radar

The Opportunity Radar is the bounded search-reduction layer before the Scout
Inbox. It examines only fresh, context-eligible anonymous catalog observations,
forms cross-venue pairs, weights rare shared title terms, and rejects known
cadence or exact close-time conflicts. It emits at most 25 candidates. A
100.00% score means only that the remaining normalized title tokens overlap;
it is not model confidence, equivalence, or expected return.

Every candidate identity binds the algorithm version, fresh source-set
identity, listing references, receive times, raw response hashes, and protocol
identities. `POST /api/v1/radar/triage` accepts only that candidate identity;
the server reconstructs an exact two-listing `pmh.discovery-catalog-context.v2`
and runs the cheap heuristic/model pool. The browser cannot provide its own
listing payload. No candidate is sent automatically, so catalog refresh does
not silently spend provider budget.

The resulting discovery record durably retains its exact normalized context
server-side. Studio and SSE receive only `catalogContextRetained: true`, not the
potentially large context body. A later pi action therefore reuses the original
snapshot after catalog refresh or process restart; it cannot substitute the
new current Radar candidate. Context tampering fails both the enclosing record
hash and the nested context identity check.

## Candidate preflight

The Candidate Preflight view is the economic screening layer between a real
exact-claim fixture map and any future reviewed candidate. It is derived from
the three checked-in `Trump out as President before 2027?` venue fixtures and
the immutable `pmh.real-candidate-preflight.v1` and
`pmh.real-candidate-depth.v1` artifacts, followed by the snapshot-scoped
`pmh.real-candidate-disposition.v1` artifact. JSON numeric tokens are preserved
lexically and all prices, quantities, costs, payout floors, and basis-point
values are recomputed with `bigint` fixed point.

The real fixture illustrates why catalog spreads are only search hints.
Polymarket YES at catalog indication `0.0650` plus Limitless NO at `0.9295`
appears to cost `0.9945`, a gross 55 bp floor. Repricing the same outcomes at
the venues' reported buy quotes (`0.0700` and `0.9300`) consumes the entire
`1.0000` payout before fees. The next screen binds anonymous books at five
shares: buying Polymarket YES costs `0.3500`; simulating a complete-set split
on Limitless and selling YES returns `0.3500`, making the effective NO cost
`4.6500`. The route therefore consumes the full `5.0000` payout before fees.

The depth artifact is intentionally not certificate-grade. Polymarket binds a
venue book hash, while the anonymous Limitless REST book binds raw bytes and
receive time but exposes no venue generation. Limitless also reports dynamic
taker fees, and its complete-set split plus YES sale is a simulation-only route.
Studio shows these facts without invoking a split, approval, signature, order,
or any other value-moving operation.

The disposition strip then explains why the current bound books can be
rejected without an exact dynamic fee amount: the gross upper bound is zero,
while official Limitless sell-taker fees are non-negative. Studio renders
`REJECTED_ECONOMICS`, the 42–150 bp documented range, the skipped review and
verifier stages, and the requirement to rescreen changed books. It reports
`verifierInvoked: false` plus `arbitrageVerified: false` and never adds the
candidate to the opportunity list. The browser only presents the control-plane
result and performs no price, depth, fee, route, or payoff calculation.

When a bound book changes, the control plane also publishes
`pmh.real-candidate-rescreen.v1`. Studio renders the previous snapshot, the
substantive venue-book changes, and the new snapshot as a lineage rather than
silently replacing one result with another. The current qualification fixture
shows a Polymarket raw-hash and native-generation change. Its old rejection is
invalidated; fresh depth and disposition identities reach the same rejection
independently. At narrow widths the lineage becomes a vertical sequence while
preserving the explicit `prior decision reused: NO` assertion.

Above that immutable lineage, Candidate Watch is the operator-facing runtime
surface. `Refresh books` requests one anonymous two-source batch from the
control plane. Studio renders each source's health, raw hash, native generation
posture, change-from-bound result, common refresh ID, deterministic screen
disposition, and SQLite durability. It does not fetch or calculate books in the
browser. `DEGRADED` means no complete same-refresh pair exists and therefore no
decision is displayed. A newly positive gross result is labeled qualification
required; Studio does not offer review, verifier, certificate, or execution
controls. The refresh journal shows the three newest attempts, source success
count, disposition, failure diagnostic, and whether the history is restart-safe.
This makes a persisted failure visible even when older successful raw books are
still retained for diagnostics.

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

## Research case desk

The Research Cases view is a deterministic join over the bounded Discovery
Ledger and Investigation Desk projections. A case identity binds normalized
question, sorted venue scope, catalog-context identity, and fixture/live source
grade. A catalog refresh therefore creates a new evidence revision rather than
silently folding new venue bytes into an older case.

Each dossier projects retained task IDs, scout lead count, pi attempts and
failures, the latest investigation summary and bounded findings, candidate
listing references, and the passed report's missing-evidence intake. Legacy scout records without a bounded
catalog identity are labeled `NEEDS_CONTEXT`; grounded leads without a passed
pi report are `NEEDS_INVESTIGATION`. A passed pi process with reported gaps is
`EVIDENCE_GAPS`, not reviewed or complete.

New scout runs retain their exact bounded catalog context in SQLite. A
`NEEDS_INVESTIGATION` dossier can explicitly hand that immutable snapshot to pi
through `POST /api/v1/research-cases/investigate`. Older runs are visibly
disabled when no snapshot exists; the operator must create a fresh bounded
scout rather than reconstructing or guessing its evidence.

The six case stages deliberately use `BOUND` and `PRESENT` for AI inputs. They
do not use verifier `PASS` terminology. Independent review, deterministic
compilation, and exact verification remain `BLOCKED`, and every case carries
literal-false promotion and execution authority. The view performs no write and
does not create a new persistence authority; it is rebuilt from hash-checked
bounded operational records on every control-plane projection.

After both retained scout context and a passed pi report exist, the dossier
renders the derived `pmh.review-intake-packet.v1` identity, readiness or first
blocker, and the required independent-review assessments. The dedicated GET
endpoint exposes that same self-verifying JSON packet for handoff. Studio still
has no accept/reject form: the packet declares decision ingestion, promotion,
execution, external writes, and value movement literal false.

## AI boundary

Discovery workers may be cheap heuristics or external models. They can propose search terms, possible same-claim links, and strategy hypotheses. Every hypothesis is `PROPOSE_ONLY` and `UNREVIEWED`.

The worker rack reflects actual control-plane configuration. Its model card
publishes only the provider and transport names, model ID, output-token ceiling,
timeout, configured fan-out, reasoning posture, and provider-retention posture.
`NEEDS KEY` means
the selected provider key was absent at process start and no model request can
be made; the browser never receives that credential. When configured, the external
workers run in parallel with the free heuristic and a failure is retained as
a diagnostic rather than granting or widening authority. Each Scout Inbox run
shows per-worker PASS/FAILED state, duration, lead count, and compact diagnostic.
These are operational facts, not model quality scores or cost estimates.

Studio also shows the separate pi investigator posture: model, one-shot text
mode, read-only tool list, and whether its process credential was present at
startup. A deliberate operator action can start the current bounded question
through `POST /api/v1/investigations`; nothing schedules this lane
automatically. The server permits one active investigation, coalesces an
identical in-flight task, rejects competing work, and returns an already-passed
report for the same task scope. Studio receives RUNNING, FAILED, and PASS state
over the same SSE projection and renders summary, candidate listing references,
findings, missing evidence, and artifact identity.

The Investigation Desk retains at most ten completed records in the same
SQLite WAL as the Scout Inbox, under a separate table and idempotency contract.
Canonical JSON plus a SHA-256 identity is verified again during hydration;
tampered state fails closed. PASS/FAILED records and passed-task replay survive
restart. RUNNING state is intentionally process-local because the isolated pi
subprocess cannot be resumed after termination. Every record and report is
`PROPOSE_ONLY`, `UNREVIEWED`, and `executionAuthority: false`, and it remains
outside review and compilation. `pnpm --silent investigation:smoke` remains the
independent one-shot qualification path.

The Catalog Facts panel reflects the verified discovery corpus: 12 normalized
listings from seven fixture artifacts across six venues. Each task receives at
most 30 relevance-ranked listings. Studio shows the corpus identity, retained
context identity, and concrete listing references used by each hypothesis;
zero hypotheses is a valid grounded result rather than a transport failure.

The adjacent Live Catalog Observation row is a separate authority surface. It
shows the current listing count, healthy/total and context-eligible source
counts, refresh state, and an operator-triggered refresh action. These records
come from anonymous public GETs, are content-addressed and durably retained,
and remain `OBSERVE ONLY`. The Scout form defaults to verified fixtures and
requires an explicit operator choice for current observations. Every requested
live source must have a successful, non-empty observation no older than 15
minutes or both AI actions fail closed. The resulting context is proposal-only;
it cannot enter equivalence review, compilation, certification, or execution.

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

The first command runs the control plane on `127.0.0.1:4100` and the Vite
dashboard together. Vite starts at `127.0.0.1:5173` and automatically advances
to the next free port. The dashboard uses a same-origin development proxy for
the control plane; always follow the URL printed by Vite.

On first use, check readiness and storage posture before refreshing catalogs or
starting a campaign. Catalog refresh is anonymous and does not call a model.
Agent work begins only through an explicit action or an enabled durable
scheduler. The selected provider, runtime capability, model, reasoning effort,
campaign state, and usage lineage remain visible in Studio.
