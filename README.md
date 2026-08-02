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
- Public book adapters for Polymarket Global, Polymarket US, Gemini, Limitless,
  and bounded on-demand Opinion token snapshots with venue-specific evidence
  semantics.
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
- An AI-native discovery pool where cheap parallel agents search and inspect bounded, content-addressed catalogs through first-party tools, record grounded hypotheses as durable effects, and may never certify or execute them. DeepSeek V4 Flash is the default and OpenAI Responses is an optional parity backend; both use the same Vercel AI SDK tool-loop protocol.
- A durable AI search-lease scheduler that advances equivalence, implication,
  partition, and mechanism-divergence lenses over each immutable live corpus.
  Cheap discovery is agent-run-budgeted; only novel grounded multi-listing
  signatures may escalate once to pi, and duplicate lineage is retained without
  storing chain-of-thought. Every issued lease first retains its exact normalized
  corpus by content hash, so a restart resumes the original task evidence rather
  than substituting the latest catalog. A concurrent durable issue scheduler
  gives each lens its own priority and cadence, keeps up to three bounded Agent
  leases in flight, and emits deduplicated in-app findings for new signatures
  and failures. Focused parity work presents deterministic batches of radar
  leads and requires the cheap model to select one exact cross-venue pair before
  bigint economics can permit pi. When that selected pair lacks catalog prices,
  the control plane fetches only its missing anonymous Opinion outcome books,
  retains the response bytes and token binding, and recomputes a non-executable
  best-ask hint. General bounded neighborhoods carry the same
  price-independent semantic identities plus routing identities. Each issue
  feeds retained terminal scopes back into the next assignment: radar batches
  and title-anchor neighborhoods rotate past completed search territory. A
  changed economic posture can still reactivate an economically blocked pair,
  while raw price motion inside the same posture does not restart semantic work.
- A bounded Scout Inbox that retains proposal-only runs, questions, venue scope, diagnostics, and unreviewed hypotheses in the control-plane projection.
- A deterministic Opportunity Radar that reduces fresh anonymous catalogs into at most 25 evidence-bound cross-venue pairs using rare-term weighting plus cadence/close-time rejection. It prices both canonical equivalent-claim portfolios with `bigint`, ranks positive gross search hints first, and still treats every pair as an unreviewed semantic lead rather than an opportunity. The focused two-leg issue requires a positive current hint before pi; for an AI-selected pair only, missing Opinion catalog prices can be enriched from bounded anonymous token books whose raw bytes are retained. Fees, common depth, fillability, and executability remain absent.
- A content-addressed real-candidate preflight that parses fixture prices and anonymous book depth lexically into `bigint`, binds a common five-share route, and rejects the current book snapshot when a non-positive gross floor plus official non-negative taker fees make strict post-fee positivity impossible; changed books require a fresh screen.
- A hash-linked real-candidate rescreen lineage that invalidates an earlier snapshot disposition when raw book content or a venue generation changes, rebuilds current economics from fresh anonymous fixtures, and proves that an unchanged conclusion was recomputed rather than inherited.
- An operator-triggered Candidate Watch that captures current Polymarket and Limitless books under one refresh identity, retains exact raw bytes plus a bounded hash-checked attempt journal in SQLite WAL schema v5, restores failures across restart, refuses mixed-time screens after partial failure, and either reuses an unchanged bound result or recomputes changed-book economics without invoking review or verification.
- An AI-to-simulation materializer that retains catalog outcome-token and fixed-point bindings through semantic review and payoff compilation, acquires the exact public books for an accepted portfolio, preserves raw response evidence in bounded SQLite WAL storage, and automatically runs bigint portfolio simulation only when every fee schedule is exactly representable. Polymarket US YES offers and synthetic NO asks are qualified from its public long-side book; the documented cumulative theta-fee cap becomes a conservative fixed fee bound for that exact FOK request. Dynamic or authenticated fee/book surfaces remain visible blockers.
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
- A content-addressed arbitrage-first review admission policy. Automatic model
  review is reserved for proposals with exactly two distinct listings and a
  relation the current payoff compiler supports: `EQUIVALENT`, `IMPLIES`,
  `SUBSET`, `MUTUALLY_EXCLUSIVE`, or `EXHAUSTIVE`. Other findings remain
  durable `RESEARCH_ONLY` work with an explicit reason and a manual advisory
  review path; they are not rejected and consume no automatic review request.
- A price-independent semantic-review scope ledger that makes recurring scans
  accumulate knowledge. Model wording, proposal IDs, receive times, raw catalog
  hashes, status, ticks, and prices cannot force another automatic review when
  the relation direction and exact contract semantics are unchanged. Symmetric
  relations canonicalize listing order; `IMPLIES` and `SUBSET` preserve it.
  Changed rules, outcomes, timing, mechanism, scales, or protocol identity form
  a new scope. Historical reviews remain immutable, while new repeats persist
  as `DUPLICATE_SCOPE` with canonical-job lineage and zero model requests.
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
   snapshot. Negative and completed results rotate that issue toward unseen
   semantic scopes on later corpora. Exact parity work advances through small
   batches of radar leads and lets the cheap model choose the exact pair;
   implication, partition, and mechanism work advances through related
   title-anchor neighborhoods without changing the issue question the Agent
   must answer. Price-only changes do not erase a semantic rejection, while a
   changed economic posture can reactivate a pair that stopped only at the
   economic gate. Raw quote motion inside the same posture does not repeatedly
   consume Agent budget.
   Adapter-provided rule documents and outcome-resolution sources travel with
   each listing as typed, content-addressed evidence locators. They are visible
   in MarketFS and proposal evidence but grant neither the Agent nor the harness
   permission to fetch an arbitrary URL. Catalog observations also bind the
   adapter normalizer identity, so a mapping revision changes the derived corpus
   without being confused with corruption of the retained raw response.
3. For the focused parity issue, lexical radar only supplies a replayable batch.
   A model worker must choose exactly two in-context listings from distinct
   venues. The server then prices only that chosen pair before pi. It first uses
   catalog prices; if the selected Opinion leg is still missing prices, it
   anonymously fetches only those outcome-token books, stores the exact bytes,
   and recomputes the hint from fixed-point best asks. Unsupported, partial,
   malformed, and non-positive results stop there and record why; a positive
   hint merely permits semantic investigation. It still excludes fees and
   common executable depth. pi cannot substitute a different pair in the
   counted result. A shared word plus attractive prices is not enough.
4. Read the **Attention inbox** first. Routine work is grouped into closed
   hourly digests; only a novel grounded proposal that also passes the
   deterministic positive-gross search gate, or the third consecutive failure
   of one issue, becomes an immediate alert. Acknowledgement updates only that
   in-app delivery record—the underlying message and lease evidence remain
   immutable. The **Raw finding events** panel remains available as the source
   event log. Set `PMH_SEARCH_ATTENTION_WEBHOOK_URL` to send new post-startup
   briefs to a generic HTTPS JSON webhook with an idempotency key, bounded
   retries, and visible dead-letter state. Historical unread events are not
   replayed when the channel is enabled. Each new proposal freezes the
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
6. Check **Arbitrage-first review admission**. Exactly two distinct listings
   with a compiler-supported relation enter the bounded automatic semantic
   reviewer; related/conflicting/conditional and unsupported multi-listing
   discoveries remain visible as `RESEARCH_ONLY` without spending a request.
   You can still trigger manual advisory review for any retained proposal.
   Before dispatch, the persistent queue compares the price-independent
   semantic-review scope with prior jobs. An unchanged scope reuses its
   canonical job; changed contract semantics or directional order get a fresh
   review. The reviewer must bind exact listing refs, rule identities, outcome
   mapping, time windows, and counterexamples. The **Operator attention queue** then
   tells you whether that advisory result defines a canonical payoff partition,
   whether current contract semantics still match the retained evidence, and
   whether the implemented anonymous adapters can reach its legs. Its
   gross-price hint excludes depth and fees and is never an executable quote.
7. Explicitly accept a compiler-ready item for research simulation, or leave it
   in research/evidence/rejection triage. The queue cannot make this decision.
8. Materialize a portfolio. The server reacquires current public books and fee
   evidence, walks depth with `bigint` arithmetic, and either produces a
   simulated worst-case floor or a precise blocker such as missing depth,
   unsupported fees, stale evidence, or incompatible outcome scope. For
   Polymarket US, YES consumes public offers and NO consumes public bids after
   the documented `1 - price` transform. The fixed request carries a
   half-to-even-rounded upper bound on cumulative theta taker fees, so any
   reported positive floor remains conservative even if the realized fee is
   lower.
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
SQLite schema-v18 AI search-lease lineage, deduplicated task corpora, deep-lane
attention alerts and deliveries, and durable semantic-review admission dispositions;
it contains no credentials or immutable campaign evidence. Snapshot bodies
remain server-side and are omitted from the Studio/SSE projection.

The model scout is opt-in. Set `DEEPSEEK_API_KEY` in the control-plane process
to add `deepseek-v4-flash` beside the free heuristic worker. It uses
Vercel AI SDK 7 with native tool calls, thinking disabled, an 800-token
per-step ceiling, an eight-step/24-tool default loop, and one five-minute total
timeout. The model never submits a whole-response result object. It calls
`search_catalog`, `inspect_listings`, `record_hypothesis`, and
`complete_search`; first-party code validates scope and records accepted,
rejected, or idempotent effects so a bad proposal can be corrected on a later
step without losing prior work. Each tool publishes a small descriptive input
schema; deterministic JSON repair turns malformed syntax into an ordinary
tool-validation result instead of aborting the whole run. These non-secret bounds and aggregate agent
activity are visible in Studio and `/health`; prompts, free-form reasoning,
provider bodies, and the key are never projected or persisted.
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
The Polymarket US source retains a bounded 500-record first page. This expands
the searchable corpus without expanding a model request: every issue-local
context remains capped at 30 listings and 50 KB. If a source URL changes, old
content-addressed observations remain durable evidence but are not restored as
the current slice; a new successful refresh must qualify the new identity.
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
exact. Polymarket Global zero-fee responses are supported; non-zero Global
curved fees remain calibration-gated. Polymarket US uses its anonymous market
book and market-detail endpoints, binds current Yes/No side IDs, turns long-side
bids into synthetic NO asks at `1 - bid`, and models the official cumulative
banker's-rounded theta-fee cap as a conservative fixed fee bound for the exact
requested quantity. Limitless dynamic taker fees, authenticated-only books, and
partial failures return retained research evidence with a blocking diagnostic. These
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
`PMH_DISCOVERY_TIMEOUT_MS` (1000–300000, default 300000).
`PMH_DISCOVERY_MAX_STEPS` (1–20, default 8) and
`PMH_DISCOVERY_MAX_TOOL_CALLS` (1–64, default 24) bound the loop; the timeout is
one total run budget rather than a per-step allowance. The enclosing manual
task and scheduled lease deadlines are never shorter than this provider budget.
`PMH_DISCOVERY_FANOUT` accepts 1–4
and defaults to 1, so merely adding a key does not multiply request volume.
Without a key, the process fails
closed to heuristic-only mode and Studio shows `NEEDS KEY`.

To qualify the production adapter independently of the long-running process,
place the selected provider credential (`DEEPSEEK_API_KEY` by default) in the
current process environment and run:

```bash
pnpm --silent discovery:smoke
```

This bounded command loads the verified Gemini fixture catalog, requires a
native multi-step run with at least one catalog read, and prints a
content-hashed `pmh.model-provider-smoke.v3` report with safe step, request,
tool, proposal-effect, and termination telemetry. An explicit no-candidate
completion can pass without fabricating a hypothesis. The report contains no credential and the command
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

Scheduled search leases retain the issue's requested venue universe separately
from the sources that happen to be healthy for one refresh. An empty default
issue scope means every registered source, not merely today's eligible subset.
Each v5 lease binds a content-hashed coverage manifest with requested, eligible,
actually represented, and omitted venue IDs plus bounded omission reasons and
the latest raw identity when available. Equivalence, implication, and mechanism
work requires two eligible and actually represented venues; an ordinary
partition issue may proceed with one. Relevance ranking reserves one bounded
representative from each available requested venue before filling remaining
slots, and the Agent receives only those represented venues. If the minimum is
not met, the lease fails before a model request but retains the manifest.
Explicit operator catalog-context APIs remain strict. Historical v1 and
coverage-aware v2/v3 plus provisional v4 leases replay unchanged and do not
suppress a v5 qualification scan.

Fast and deep work are independent durable v5 stages. The cheap Agent receives
its own configurable provider deadline and, on success, the control plane
commits an immutable `FAST_COMPLETE` checkpoint before optional pi work starts.
The default Pi queue runs one deep investigation at a time with its own
300-second process budget; unrelated fast scans remain concurrent. A Pi timeout
or failure produces `DEEP_UNAVAILABLE` while the lease stays `PASS`, the exact
candidate refs and corpus remain retained, and issue failure streaks remain
truthful. A successful retry appends a hash-bound attempt over the original
corpus, question, candidate refs, graph neighborhood, and novelty signature;
it makes zero fast-model requests. `POST
/api/v1/search-leases/:leaseId/deep-retries` and the Studio **Retry Pi only**
action coalesce concurrent retries and permit at most three attempts by
default.

A new grounded multi-listing signature creates one deduplicated Finding Inbox
notification as soon as the fast checkpoint exists; empty scans and known
signatures stay quiet. Deep failures create a separate WATCH notification, and
a later grounded Pi proposal can enter semantic review without changing the
truth of the earlier fast scan. “Candidate” in
these metrics means at least one hypothesis binds two distinct in-context
listing refs. A single-listing hypothesis remains searchable evidence and
completes its semantic scope as `NOT_MULTI_LISTING`, but gets no novelty
identity, candidate yield, pi escalation, or finding notification. Historical
hash-valid records keep their original bytes; derived performance and new
attention digests apply the stricter qualification without rewriting them. Issues,
issued and terminal leases, acknowledgement state, and notifications survive
restart in the hash-checked SQLite WAL. Before `ISSUED` is committed, the server
stores the exact bounded `pmh.market-corpus.v1` body once by snapshot identity.
If the process stops during fast work, the next process reloads that corpus and
resumes the original issued lease even when a newer catalog is current. If it
stops after the fast checkpoint, a retained pending deep stage starts without
rerunning the Agent; an interrupted RUNNING attempt is closed explicitly and a
new bounded attempt uses the same input identity. Expired issued work is
terminalized before any recovery provider call and is excluded from
model-quality, issue-health, and degraded-streak metrics. Corpus text
stays server-side and is pruned only after no retained lease references it.
Legacy issued records without corpus evidence fail visibly and schedule fresh
work; they never borrow a newer snapshot silently.

Process admission precedes mutable startup. The production entry point first
binds the HTTP listener, then releases catalog refresh, Pi recovery, and all
background timers. A dev watcher or replica that loses the port race therefore
closes its store without mutating catalog observations or search leases. This
prevents multiple local watchers from consuming the same durable Pi retry
budget while only one process actually serves the control plane.

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

Both AI paths use tool effects instead of treating a model's entire final
answer as a fixed-schema document. Pi retains its recursive read-only MarketFS
tools and receives one repository-owned `submit_market_findings` extension;
only that tool may write one bounded effect into the ephemeral run directory,
the atomically published effect ends that Pi loop, and final prose is ignored.
The independent AI SDK reviewer runs a bounded
multi-step loop: it must call `record_counterexample` before
`submit_semantic_review`. That submitted effect carries an explicit joint
truth-state matrix bound to retained rule hashes. Probabilistic dependence,
textual relatedness, surviving counterexamples, and incomplete state spaces
remain research-only. The deterministic compiler enumerates guaranteed
portfolios from feasible states rather than trusting the model's relation label,
and serializes payout arithmetic as bigint decimal strings.

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
Semantic review independently uses `PMH_SEMANTIC_REVIEW_TIMEOUT_MS`
(1000–600000, default 300000), `PMH_SEMANTIC_REVIEW_MAX_OUTPUT_TOKENS`
(512–4096, default 1800), and `PMH_SEMANTIC_REVIEW_CONCURRENCY` (1–8,
default 3). Its timeout covers the complete AI SDK tool loop rather than
imposing a short response cutoff.
`PMH_DISCOVERY_TIMEOUT_MS` independently bounds the fast lane;
`PMH_SEARCH_DEEP_MAX_ATTEMPTS` (1–5) and
`PMH_SEARCH_ORCHESTRATION_GRACE_MS` (0–60000) bound retry history and fixed
handoff overhead. The lease derives its lane deadlines from the actual worker
runtimes, so projected budgets cannot claim time that the provider or Pi
process does not honor.
Do not commit a key or place it inline in a command. A DeepSeek-compatible
proxy is not silently assumed; custom endpoint routing requires a separate,
explicit configuration change.

The default host exposes Node.js 22.22.1, so ordinary local commands correctly
warn about the engine mismatch. The full workspace checkpoint also passes under
an isolated Node.js 24.14.0 runtime, which is the qualified production target.

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
- `plans/polymarket-us-anonymous-materialization.md`: active anonymous exact
  materialization campaign; retired plans remain recoverable from Git history.
- `QUESTIONS.md`: non-blocking user decisions queued for batch support.
- `AGENTS.md`: collaboration rules and the user-input/access ledger.

The original design brief remains at `prediction-market-harness-design-and-codex-prompt.md`; stable implementation truth belongs in `docs/`.
