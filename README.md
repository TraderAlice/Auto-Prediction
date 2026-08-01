# Prediction Market Interoperability Harness

Pre-alpha infrastructure for describing prediction-market contracts across venues, replaying their market data deterministically, and proving bounded portfolio payoffs with exact arithmetic.

This is not a trading bot and it has no live-trading authority. The repository does not contain or request production credentials, cannot place a live order, and must not move funds.

## What exists

- Strict TypeScript workspace with first-party domain, protocol, and market-state packages.
- `bigint` fixed-point parsing and conservative rounding helpers.
- Claim → Resolution Specification → Outcome Space → Venue Listing model.
- Explicit binary, categorical, scalar/range, conditional, multivariate, void, canceled, and invalid resolution states.
- Hash-bound market-link proposals and independent review artifacts.
- Composable venue capability ports and qualification evidence.
- Deterministic snapshot/delta book replay with gap, duplicate, out-of-order, tick, stale, and rebuild handling.
- Content-hash verification for immutable HTTP and stream fixtures, including subscription identity, frame boundaries, per-frame hashes, and anonymous acquisition metadata.
- Fixture-backed catalog adapters for Polymarket Global, Kalshi, Gemini Prediction Markets, Opinion, and Myriad.
- Public realtime-book adapters for Polymarket, Gemini, and Limitless with venue-specific sequence and rebuild semantics.
- Transport-free Kalshi demo and Gemini sandbox order-shape gateways whose submit, cancel, and reconcile methods always return hash-bound `REJECTED_INERT` receipts.
- Lexical JSON-number decoding so venue number tokens never pass through IEEE-754 before fixed-point conversion.
- Depth-, tick-, fee-, and per-venue-capital-aware complete-set candidate compilation.
- Independent exact certificate verification across every canonical resolution state.
- Certificate invalidation on rule, fee, book generation, book state, partition, or expiry changes.
- Per-venue capital reservations with conservation across available, reserved, deployed, unresolved, receivable, and realized-PnL states.
- Multi-leg shadow execution DAGs with idempotent submission, partial fills, cancel/release, UNKNOWN reconciliation, hedge locking, and terminal settlement.
- A fixed Risk Governor that blocks live mode, stale/gapped books, expired certificates, excessive residual/capital exposure, heartbeat/cancel failures, and state divergence.
- Executable cross-venue hedge curves with conservative BUY-cost and SELL-proceeds rounding.
- Shadow-only maker quotes bounded by common hedge depth, inventory capacity, risk budget, and explicit per-unit premiums.
- A bundled `pmh` CLI with a versioned JSON envelope, content-hashed state snapshots, explicit effects, diagnostics, and allowed next actions.
- A Node control-plane process exposing read-only HTTP/SSE projections, discovery runs, and health state.
- SQLite WAL operational state with bounded retention, content-hash verification, cross-restart `taskId` idempotency, and in-process concurrent-request coalescing.
- An AI-native discovery pool where cheap parallel scouts inspect bounded, content-addressed fixture catalogs and may propose hypotheses but can never certify or execute them; its default DeepSeek V4 Flash worker runs through Vercel AI SDK with timeout, token, schema, and application-side scope bounds, while direct OpenAI Responses remains an optional backend.
- A bounded Scout Inbox that retains proposal-only runs, questions, venue scope, diagnostics, and unreviewed hypotheses in the control-plane projection.
- An explicitly triggered pi Investigation Desk with one-at-a-time concurrency, cross-restart task-scope idempotency, bounded hash-checked SQLite retention, SSE running/failure/completion state, and no route into review or execution.
- A deterministic Research Case Desk that joins scout runs and pi retry history by question, venue scope, catalog-context identity, and source grade; it exposes candidate listing scope and missing-evidence intake without creating review or promotion authority.
- A bounded anonymous catalog-observation desk for six venues. It preserves raw public GET bytes in SQLite WAL, binds normalized listings to their source identities, isolates protocol drift per venue, and stays `OBSERVE_ONLY`; explicit fresh-context qualification grants proposal input only.
- A hash-bound reviewed-hypothesis pipeline that requires independent hypothesis and exact market-link reviews before deterministic compilation can invoke the exact verifier.
- Harmony Studio, a Vite + React + shadcn/ui cockpit connected to the control plane.
- A Books desk that replays verified public frames into generation-bound order books, broadcasts them over SSE, and exposes venue-native sequence posture.
- A deterministic replay-chaos suite covering gaps, stale input, reconnect without snapshot, off-tick atomic rejection, tick-size change, and generation invalidation.
- A checked-in, content-addressed replay-integrity campaign artifact bound to three verified books and six chaos-case evidence identities.
- A checked-in synthetic qualification artifact proving the full scout → review → compiler → verifier boundary without implying a real venue match or execution authority.
- A checked-in exact three-venue claim map whose independent fixtures bind identical Trump-removal rules on Polymarket Global, Opinion, and Limitless while preserving their different listing windows.
- Current official-source census for eight venue families.
- Focused unit and property tests.

Production equivalence-review workflow, dense long-run evidence storage, and
real-fixture candidate promotion remain active campaign work.

## Safety boundary

- No JavaScript `number` represents money, price, quantity, fee, payout, PnL, or tick in Core.
- Unknown precision, incomplete payout partitions, sequence gaps, stale books, and mismatched evidence fail closed.
- Solver output is never authoritative; only the independent exact verifier may publish a certificate.
- SDK types cannot cross venue-adapter boundaries.
- Live execution is disabled by construction and policy.
- An inert gateway has no transport, signer, nonce generator, credential input, or execution qualification; implementing a request shape does not make it trade-capable.

## Development

Requirements: Node.js 24+ and pnpm 11.

```bash
corepack enable
pnpm install
pnpm check
pnpm test
pnpm fixtures:capture:streams
pnpm pmh system status
pnpm pmh venue list
pnpm pmh venue inspect polymarket-global
pnpm studio
```

`pnpm studio` stores bounded Scout Inbox state in
`.data/control-plane.sqlite` using WAL mode. Set `PMH_STATE_DB` to an alternate
path when a different local operational volume is required. The database is
ignored by Git and contains bounded discovery runs, completed investigations,
and raw anonymous catalog observations, not credentials or immutable campaign
evidence.

The model scout is opt-in. Set `DEEPSEEK_API_KEY` in the control-plane process
to add a `deepseek-v4-flash` worker beside the free heuristic worker. It uses
Vercel AI SDK 7 with validated object output, thinking disabled, an 800
output-token ceiling, and an 8-second timeout. These non-secret bounds are
visible in Studio and `/health`; the key is never projected or persisted.
DeepSeek does not expose an OpenAI-style `store:false` request control, so the
projection reports `PROVIDER_POLICY` rather than making a retention claim.
Both workers receive only a task-scoped catalog context. Verified fixtures are
the default; an operator may explicitly select qualified current observations.
A context contains at most 30 listings, has its own SHA-256 identity, and is
bound into the default `taskId` and retained run. Every listing binds source
grade, receive time, raw-response hash, and protocol identity. Every non-empty
hypothesis must reference concrete listing IDs from that exact context, and all
venue titles, descriptions, and rules are treated as untrusted data rather than
model instructions.

At startup the control plane also performs an anonymous, read-only catalog
refresh for Polymarket Global, Kalshi, Gemini, Opinion, Myriad, and Limitless.
Each response has a 10-second timeout and 2,000,000-byte cap, is preserved
byte-for-byte under a SHA-256 identity in bounded SQLite WAL storage, and is
normalized by its venue adapter. Studio labels the desk `OBSERVE ONLY` and
never selects it automatically. An explicitly requested source is eligible for
proposal-only AI context only when its latest refresh succeeded, is non-empty,
and is at most 15 minutes old; stale, failed, or empty sources fail the request.
This qualification grants no review, compilation, certification, or execution
authority. Refresh explicitly with `POST /api/v1/catalog/observations/refresh`.
Select `PMH_DISCOVERY_PROVIDER=deepseek|openai` and override the model defaults
with `PMH_DISCOVERY_MODEL`,
`PMH_DISCOVERY_MAX_OUTPUT_TOKENS` (128–4096), and
`PMH_DISCOVERY_TIMEOUT_MS` (1000–30000). Without a key, the process fails
closed to heuristic-only mode and Studio shows `NEEDS KEY`.

To qualify the production adapter independently of the long-running process,
place the selected provider credential (`DEEPSEEK_API_KEY` by default) in the
current process environment and run:

```bash
pnpm --silent discovery:smoke
```

This bounded command loads the verified Gemini fixture catalog, sends exactly
one request through the selected production adapter, and prints a
content-hashed `pmh.model-provider-smoke.v2` report. A valid zero-hypothesis
response still passes. The report contains no credential and the command
writes no file, changes no operational state, and has no execution authority.
OpenAI requests use `store:false`; DeepSeek retention follows provider policy.
Avoid putting a key directly on the command line or in shell history, and unset
it when the run is complete.

Longer investigations use a separate, explicitly invoked pi lane. The pinned
`@earendil-works/pi-coding-agent` process receives the same task-scoped fixture
catalog, starts with an isolated config directory, persists no session, disables
extensions/skills/templates/themes, and exposes only `read`, `grep`, `find`, and
`ls`. Its final-text output is bounded, scope-validated, and rebuilt into a
content-hashed `pmh.pi-investigation-report.v1` with proposal-only authority.
It is never scheduled automatically. A user may start it from Studio or
`POST /api/v1/investigations`; the control plane permits only one active task,
coalesces identical in-flight requests, retains at most ten completed reports
in the hash-checked SQLite WAL, and streams its state over SSE. RUNNING state is
deliberately process-local because a terminated subprocess cannot be resumed;
completed PASS/FAILED records and passed-task idempotency survive restart. It
cannot write files, run a shell, trade, review equivalence, or promote its own
findings.

For an official DeepSeek key, put it in the Git-ignored root `.env.local` file:

```dotenv
DEEPSEEK_API_KEY=your-key-here
```

The control plane and both smoke entrypoints load this file automatically;
an already-exported process variable takes precedence. Restart `pnpm studio`
after changing the file, then run the two independent qualification paths:

```bash
pnpm --silent discovery:smoke
pnpm --silent investigation:smoke
```

`PMH_PI_MODEL`, `PMH_PI_TIMEOUT_MS` (10000–300000), and
`PMH_PI_MAX_OUTPUT_BYTES` (100000–10000000) tune non-secret investigator
bounds. The default pi timeout is 300000 ms because a real high-thinking live
catalog investigation exceeded 120 seconds before passing within this bound.
Do not commit a key or place it inline in a command. A DeepSeek-compatible
proxy is not silently assumed; custom endpoint routing requires a separate,
explicit configuration change.

The default host exposes Node.js 22.22.1, so ordinary local commands correctly
warn about the engine mismatch. The full workspace checkpoint also passes under
an isolated Node.js 24.18.1 runtime, which is the qualified production target.

## Project map

- `packages/domain`: canonical contract truth, exact fixed-point values, identities, and links.
- `packages/protocol`: event envelopes, capability manifests, and narrow venue ports.
- `packages/market-state`: deterministic order-book state and replay.
- `packages/evidence`: HTTP/stream fixture identity and tamper detection.
- `packages/opportunity`: bounded candidate compilation and exact payoff certificates.
- `packages/capital`: per-venue reservations and settlement-capital conservation.
- `packages/risk`: fixed opening authority and kill conditions.
- `packages/execution`: validated multi-leg plans and shadow-only order lifecycle.
- `packages/liquidity`: executable hedge curves and constrained shadow maker quotes.
- `packages/cli`: versioned, machine-readable inspection commands.
- `packages/control-plane`: long-running projection, SQLite operational state, event-stream, deterministic book replay, AI SDK scout coordination, bounded pi investigations, and reviewed-hypothesis compilation boundary.
- `apps/studio`: responsive read-only cockpit for book state, fixture replay, bounded scout and pi investigations, and qualification evidence.
- `packages/venue-*`: venue-local codecs, manifests, and normalized adapters.
- `projects/venue-research`: dated official-source research.
- `projects/campaigns`: immutable content-addressed qualification checkpoints.
- `docs/design`: current architecture truth.
- `plans/architecture-qualification.md`: live qualification campaign.
- `AGENTS.md`: collaboration rules and the user-input/access ledger.

The original design brief remains at `prediction-market-harness-design-and-codex-prompt.md`; stable implementation truth belongs in `docs/`.
