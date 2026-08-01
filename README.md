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
- Fixture-backed catalog adapters for Polymarket Global, Polymarket US, Kalshi, Gemini Prediction Markets, Opinion, Myriad, and Limitless.
- Public book adapters for Polymarket Global, Polymarket US, Gemini, and Limitless with venue-specific snapshot, sequence, and rebuild semantics.
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
- A durable AI search-lease scheduler that advances equivalence, implication,
  partition, and mechanism-divergence lenses over each immutable live corpus.
  Cheap discovery is model-request-budgeted; only novel grounded multi-listing
  signatures may escalate once to pi, and duplicate lineage is retained without
  storing chain-of-thought. Every issued lease first retains its exact normalized
  corpus by content hash, so a restart resumes the original task evidence rather
  than substituting the latest catalog. A concurrent durable issue scheduler
  gives each lens its own priority and cadence, keeps up to three bounded Agent
  leases in flight, and emits deduplicated in-app findings for new signatures
  and failures. Exact radar scopes carry a price-independent semantic identity
  plus a price-sensitive routing identity. Each issue feeds its retained
  terminal scopes back into the next assignment, so an unchanged lexical false
  positive cannot monopolize the queue while a changed economic posture can
  still reactivate an economically blocked pair. Raw price motion inside the
  same posture does not restart semantic work.
- A bounded Scout Inbox that retains proposal-only runs, questions, venue scope, diagnostics, and unreviewed hypotheses in the control-plane projection.
- A deterministic Opportunity Radar that reduces fresh anonymous catalogs into at most 25 evidence-bound cross-venue pairs using rare-term weighting plus cadence/close-time rejection. It prices both canonical equivalent-claim portfolios with `bigint`, ranks positive gross search hints first, and still treats every pair as an unreviewed semantic lead rather than an opportunity. The focused two-leg issue requires a positive current hint before pi; fees, depth, fillability, and executability remain absent.
- A content-addressed real-candidate preflight that parses fixture prices and anonymous book depth lexically into `bigint`, binds a common five-share route, and rejects the current book snapshot when a non-positive gross floor plus official non-negative taker fees make strict post-fee positivity impossible; changed books require a fresh screen.
- A hash-linked real-candidate rescreen lineage that invalidates an earlier snapshot disposition when raw book content or a venue generation changes, rebuilds current economics from fresh anonymous fixtures, and proves that an unchanged conclusion was recomputed rather than inherited.
- An operator-triggered Candidate Watch that captures current Polymarket and Limitless books under one refresh identity, retains exact raw bytes plus a bounded hash-checked attempt journal in SQLite WAL schema v5, restores failures across restart, refuses mixed-time screens after partial failure, and either reuses an unchanged bound result or recomputes changed-book economics without invoking review or verification.
- An AI-to-simulation materializer that retains catalog outcome-token and fixed-point bindings through semantic review and payoff compilation, acquires the exact public books for an accepted portfolio, preserves raw response evidence in bounded SQLite WAL storage, and automatically runs bigint portfolio simulation only when every fee schedule is exactly representable. Dynamic or authenticated fee/book surfaces remain visible blockers.
- A narrow first-party exact-promotion boundary that rebuilds candidates only
  from compiler-bound relations plus durable anonymous book/fee evidence,
  rechecks canonical payouts, ticks, quantities, identities, and expiry, and
  persists either a certificate or an exact rejection.
- A deterministic operator attention queue over retained semantic reviews. It
  separates compiler-ready decisions from research-only relations, evidence
  escalations, and suggested rejections; checks whether current contracts still
  match captured semantics; and shows bigint indicative gross hints plus public
  adapter reach without making a model call or recording a decision.
- A deterministic pre-review economic frontier that reuses the same canonical
  `bigint` portfolio arithmetic, current-contract matching, and gross-price
  bounds as post-review attention. Exact current contract text that explicitly
  denies settlement makes the portfolio economically ineligible before price
  arithmetic. Otherwise a positive hint below priority five adds exactly one
  review-priority point; missing, stale, unsupported, non-positive,
  settlement-ineligible, and already-priority-five items stay at their original
  priority, and no hint can approve semantics.
- Certificate-bound shadow replay that derives intents from the certificate,
  uses virtual capital and the live-disabled ShadowExecutionEngine, records
  planned versus observed fills, and makes zero venue-gateway calls. Human
  approval authorizes only this replay.
- An explicitly triggered pi Investigation Desk with one-at-a-time concurrency, cross-restart task-scope idempotency, bounded hash-checked SQLite retention, SSE running/failure/completion state, and no route into review or execution.
- A deterministic Research Case Desk that joins scout runs and pi retry history by question, venue scope, catalog-context identity, and source grade; after a passed investigation it derives a self-verifying `pmh.review-intake-packet.v1` binding the exact scout, hypothesis, context, pi artifact, candidate scope, and unresolved evidence without accepting a review decision or creating promotion authority.
- A bounded anonymous catalog-observation desk for seven venues. It preserves raw public GET bytes in SQLite WAL, binds normalized listings to their source identities, isolates protocol drift per venue, and stays `OBSERVE_ONLY`; explicit fresh-context qualification grants proposal input only.
- A hash-bound reviewed-hypothesis pipeline that requires independent hypothesis and exact market-link reviews before deterministic compilation can invoke the exact verifier.
- Harmony Studio, a Vite + React + shadcn/ui cockpit connected to the control plane.
- A Books desk that replays verified public frames into generation-bound order books, broadcasts them over SSE, and exposes venue-native sequence posture.
- A deterministic replay-chaos suite covering gaps, stale input, reconnect without snapshot, off-tick atomic rejection, tick-size change, and generation invalidation.
- A checked-in, content-addressed replay-integrity campaign artifact bound to three verified books and six chaos-case evidence identities.
- A checked-in synthetic qualification artifact proving the full scout → review → compiler → verifier boundary without implying a real venue match or execution authority.
- A checked-in exact three-venue claim map whose independent fixtures bind identical Trump-removal rules on Polymarket Global, Opinion, and Limitless while preserving their different listing windows.
- Current official-source census for eight venue families.
- Focused unit and property tests.

Production equivalence-review workflow, certificate-grade book-generation and
fee qualification, dense long-run evidence storage, and real-candidate
promotion remain active campaign work.

## How the product looks for an opportunity

1. Refresh anonymous catalogs in Studio. The control plane freezes a
   content-addressed snapshot of current listings and rules; failed or stale
   venues stay visible but cannot enter the Agent context.
2. Use the five durable issues in **Market Archaeologist** as standing search
   briefs: same-claim aliases, exact two-leg parity, implication chains,
   partitions, and mechanism/oracle conflicts. Their independent cadences feed
   a three-slot Agent scheduler whenever the five-minute catalog refresh
   produces a new immutable corpus. You can also run any issue immediately or
   add a narrower brief. The cheap model searches a bounded context first; only
   a novel grounded lead can escalate to one pi run over the complete MarketFS
   snapshot. Negative and completed exact-pair results rotate that issue toward
   unseen semantic scopes on later corpora; price-only changes do not erase a
   semantic rejection, while a changed economic posture can reactivate a pair
   that stopped only at the economic gate. Raw quote motion inside the same
   posture does not repeatedly consume Agent budget.
3. For the focused parity issue, the server prices the exact radar-bound pair
   before pi. Missing prices and non-positive gross hints stop there and record
   why; a positive hint merely permits semantic investigation. The cheap model
   must still propose a grounded relationship. A shared word plus attractive
   prices is not enough.
4. Read the resulting proposals and falsifiers in the **Finding inbox** and
   issue funnel. Each new proposal freezes the
   exact normalized listings that produced it in a bounded, content-addressed
   evidence bundle, so a later review does not silently substitute whatever the
   live catalog happens to contain then. `EQUIVALENT`, `IMPLIES`,
   `MUTUALLY_EXCLUSIVE`, `EXHAUSTIVE`, and related labels are hypotheses, not
   trades. A valid run may conclude that no cross-venue relation exists.
5. Let the **Pre-review economic frontier** order the bounded review queue. It
   prices only the canonical portfolio declared by the proposal, and only when
   current contracts still match captured semantics and none explicitly denies
   settlement. A positive gross hint adds one priority point below P5; every
   other candidate keeps its original priority. Lack of a detected denial does
   not prove settlement. The hint excludes fees and depth, suppresses nothing,
   and is not evidence that the proposed relationship is true.
6. Send a grounded proposal through independent semantic review. The reviewer
   must bind exact listing refs, rule identities, outcome mapping, time windows,
   and counterexamples. The **Operator attention queue** then tells you whether
   that advisory result defines a canonical payoff partition, whether current
   contract semantics still match the retained evidence, and whether the
   implemented anonymous adapters can reach its legs. Its gross-price hint
   excludes depth and fees and is never an executable quote.
7. Explicitly accept a compiler-ready item for research simulation, or leave it
   in research/evidence/rejection triage. The queue cannot make this decision.
8. Materialize a portfolio. The server reacquires current public books and fee
   evidence, walks depth with `bigint` arithmetic, and either produces a
   simulated worst-case floor or a precise blocker such as missing depth,
   unsupported fees, stale evidence, or incompatible outcome scope.
9. Only the first-party exact verifier can issue a short-lived certificate.
   The configured policy then notifies, requests human approval for shadow, or
   runs automatic shadow. A later observation reacquires the market and records
   whether it still matches the certificate bounds or has diverged.

The intended funnel is therefore **AI search → deterministic economic queueing
→ skeptical semantic review →
deterministic payoff compilation → fresh exchange simulation → exact
certificate → policy-controlled shadow observation**. Model confidence is
never used as profit confidence.

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
ignored by Git and contains bounded discovery runs plus their exact normalized
catalog snapshots, completed investigations, and raw anonymous catalog
observations, Candidate Watch raw books and its bounded refresh journal, and
SQLite schema-v13 AI search-lease lineage plus deduplicated task corpora;
it contains no credentials or immutable campaign evidence. Snapshot bodies
remain server-side and are omitted from the Studio/SSE projection.

The model scout is opt-in. Set `DEEPSEEK_API_KEY` in the control-plane process
to add `deepseek-v4-flash` beside the free heuristic worker. It uses
Vercel AI SDK 7 with validated object output, thinking disabled, an 800
output-token ceiling, and an 8-second timeout. These non-secret bounds are
visible in Studio and `/health`; the key is never projected or persisted.
DeepSeek does not expose an OpenAI-style `store:false` request control, so the
projection reports `PROVIDER_POLICY` rather than making a retention claim.
The default fan-out is one model scout. `PMH_DISCOVERY_FANOUT=2..4` explicitly
adds partition, mechanism, and skeptical search lenses; requests still run only
after an operator starts a scout. Every worker receives only a task-scoped
catalog context. Verified fixtures are
the default; an operator may explicitly select qualified current observations.
A context contains at most 30 listings, has its own SHA-256 identity, and is
bound into the default `taskId` and retained run. Every listing binds source
grade, receive time, raw-response hash, and protocol identity. Every non-empty
hypothesis must reference concrete listing IDs from that exact context, and all
venue titles, descriptions, and rules are treated as untrusted data rather than
model instructions.

At startup the control plane also performs an anonymous, read-only catalog
refresh for Polymarket Global, Polymarket US, Kalshi, Gemini, Opinion, Myriad,
and Limitless.
Each response has a 10-second timeout and 2,000,000-byte cap, is preserved
byte-for-byte under a SHA-256 identity in bounded SQLite WAL storage, and is
normalized by its venue adapter. Studio labels the desk `OBSERVE ONLY` and
never selects it automatically. An explicitly requested source is eligible for
proposal-only AI context only when its latest refresh succeeded, is non-empty,
and is at most 15 minutes old; stale, failed, or empty sources fail the request.
This qualification grants no review, compilation, certification, or execution
authority. Refresh explicitly with `POST /api/v1/catalog/observations/refresh`.

Candidate Preflight also exposes `POST /api/v1/candidate-watch/refresh` for the
single checked-in real claim. The control plane issues anonymous public GETs to
the Polymarket and Limitless books, gives both observations one refresh ID, and
stores their exact bytes and source bindings in SQLite. A complete unchanged
batch may reuse only the result already bound to those exact identities. A
changed batch is screened again; a partial batch returns `DEGRADED` with no
decision, so a new book can never be paired with the other venue's older book.
Every attempt is retained in a bounded canonical journal. On restart the latest
journal entry, including per-source failures, is authoritative; a stale prior
success cannot silently revive the watch as `READY`. Journal records and their
referenced raw observations are hash-checked during hydration.
The endpoint can reject economics or request later qualification, but it cannot
invoke independent review, publish a certificate, or move value.

After an operator accepts an AI relation for research simulation, Studio can
call `POST /api/v1/opportunity-lifecycle/materializations` with the compiled
portfolio identity and a base-unit quantity. The server—not the browser—derives
the venue outcome tokens from hash-bound review evidence, captures current
anonymous books, enforces token, scale, tick, byte-cap, and receive-time-skew
contracts, and feeds a complete plan to the bigint simulator only when fees are
exact. A public Polymarket zero-fee response is supported. Non-zero Polymarket
curved fees, Limitless dynamic taker fees, authenticated-only books, and partial
failures return retained research evidence with a blocking diagnostic. These
materialization records and their byte-exact public sources are stored
atomically in SQLite WAL and revalidated on restart. A positive exactly modeled
bundle then enters the first-party verifier automatically; generic browser POST
simulations cannot certify. A certificate follows the configured notify,
human-approved shadow, or auto-shadow policy. The shadow-decision endpoint can
only start a local replay and returns literal-false production, execution, live,
and value-moving authority.

`GET /api/v1/radar` projects only fresh-source candidate pairs. A Studio action
may send one server-bound pair to `POST /api/v1/radar/triage`; the browser
cannot substitute listing text or references. The lexical score is a blocking
score, never confidence, semantic equivalence, profit, or a verifier verdict.
Select `PMH_DISCOVERY_PROVIDER=deepseek|openai` and override the model defaults
with `PMH_DISCOVERY_MODEL`,
`PMH_DISCOVERY_MAX_OUTPUT_TOKENS` (128–4096), and
`PMH_DISCOVERY_TIMEOUT_MS` (1000–30000). `PMH_DISCOVERY_FANOUT` accepts 1–4
and defaults to 1, so merely adding a key does not multiply request volume.
Without a key, the process fails
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
The task-scoped Investigation Desk is never scheduled automatically. A user may
start it from Studio, `POST /api/v1/investigations`, or a retained Research
Case; the control plane permits only one active task,
coalesces identical in-flight requests, retains at most ten completed reports
in the hash-checked SQLite WAL, and streams its state over SSE. RUNNING state is
deliberately process-local because a terminated subprocess cannot be resumed;
completed PASS/FAILED records and passed-task idempotency survive restart. It
cannot write files, run a shell, trade, review equivalence, or promote its own
findings.

The Market Archaeologist pi lane is orchestrated by durable search issues.
Studio starts with four durable work themes—equivalence, implication,
partition, and mechanism conflicts—and lets an operator add, pause, resume, or
run a bounded issue immediately. Set `PMH_SEARCH_ISSUE_TICK_MS` to 1000–60000
to poll the priority queue automatically; scheduling is explicit and off by
default so starting the server never silently spends model budget. Up to three
different issues may run concurrently, while the same issue and immutable
corpus snapshot coalesce to one lease. The older
`PMH_SEARCH_LEASE_INTERVAL_MS` sequential lens timer remains compatible but is
suppressed when the issue timer is enabled.

Recurring issues require recurring market evidence. Set
`PMH_CATALOG_REFRESH_INTERVAL_MS=300000` to refresh the anonymous public
catalogs every five minutes (the accepted range is one to ten minutes, below
the 15-minute context freshness window). Startup, operator, and scheduled
refreshes share one coalesced request-bounded path. Issue ticks pause while a
refresh is in flight, then consume the resulting immutable corpus immediately;
an empty corpus creates no AI lease. Studio reports the timer, next refresh,
READY/degraded counts, and current corpus identity.

Each lease still permits one cheap model request, one optional pi escalation,
eight hypotheses, and a 300-second deadline. A new grounded multi-listing
signature creates one deduplicated Finding Inbox notification; empty scans and
known signatures stay quiet, while failures notify separately. Issues,
issued and terminal leases, acknowledgement state, and notifications survive
restart in the hash-checked SQLite WAL. Before `ISSUED` is committed, the server
stores the exact bounded `pmh.market-corpus.v1` body once by snapshot identity.
If the process stops mid-run, the next process reloads that corpus and resumes
the original lease even when a newer catalog is already current. Corpus text
stays server-side and is pruned only after no retained lease references it.
Legacy issued records without corpus evidence fail visibly and schedule fresh
work; they never borrow a newer snapshot silently.

The Scheduled Search Desk also derives a bounded operations window from the
retained terminal leases. It reports new-signature, duplicate, and pi-escalation
rates plus proposal and evidence-gap counts, both globally and per issue. These
numbers describe search workload only: they are not model confidence, semantic
review, an arbitrage verdict, or all-time totals.

A separate content-addressed attribution projection follows distinct proposal
IDs from passed issue leases through independent review, local research
decisions, anonymous materialization, deterministic portfolio simulation, exact
verification, and certificate-bound shadow observation. Studio exposes the
funnel globally and per issue, including proposals discovered outside scheduled
issues, multi-issue discoveries, missing lifecycle records, and current
bottlenecks. It is derived evidence only and cannot tune a schedule or promote a
candidate by itself.

Attributed proposals now seed one persistent semantic-review job per proposal.
Set `PMH_SEMANTIC_REVIEW_TICK_MS` to 1000–60000 to dispatch the queue
automatically; it is off by default in the committed example so a fresh clone
does not silently spend provider budget. Jobs inherit the highest contributing
issue priority, retain all contributing issue identities, lease up to three
independent review requests concurrently, spend at most three request attempts
per job, and retry with bounded backoff. Expired leases are recovered after
restart, while completed reports and exhausted jobs create deduplicated in-app
notifications. New Market Archaeologist proposals carry a
`pmh.proposal-evidence-bundle.v2` containing the full proposal, original corpus
identity, exact referenced normalized listings, per-listing hashes, and a bundle
hash. The job copies that bundle into its own SQLite record, so review survives
catalog rotation, archaeologist-report retention, and process restart. Legacy
jobs backfill only when every exact ref is present in the current corpus;
otherwise they wait in `BLOCKED_EVIDENCE` without spending an attempt. Studio
separately reports original captures, exact-current rebases, and unresolved
legacy evidence debt. These reports remain advisory: they cannot accept a
proposal, simulate it, certify it, or route an order.

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
- `packages/execution`: validated multi-leg plans, exact simulation bundles,
  certificate-bound replay, and shadow-only order lifecycle.
- `packages/liquidity`: executable hedge curves and constrained shadow maker quotes.
- `packages/cli`: versioned, machine-readable inspection commands.
- `packages/control-plane`: long-running projection, SQLite operational state,
  event-stream, deterministic book replay, AI SDK scout coordination, bounded
  pi investigations, reviewed-hypothesis compilation, first-party exact
  promotion, and non-value-moving lifecycle routing.
- `apps/studio`: responsive read-only cockpit for book state, fixture replay, bounded scout and pi investigations, and qualification evidence.
- `packages/venue-*`: venue-local codecs, manifests, and normalized adapters.
- `projects/venue-research`: dated official-source research.
- `projects/campaigns`: immutable content-addressed qualification checkpoints.
- `docs/design`: current architecture truth.
- `PLANS.md`: short construction-plan index and current checkpoint.
- `plans/durable-proposal-evidence.md`: active content-addressed evidence
  continuity campaign; retired plans remain recoverable from Git history.
- `QUESTIONS.md`: non-blocking user decisions queued for batch support.
- `AGENTS.md`: collaboration rules and the user-input/access ledger.

The original design brief remains at `prediction-market-harness-design-and-codex-prompt.md`; stable implementation truth belongs in `docs/`.
