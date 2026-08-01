# AI discovery and control-plane boundary

## Why AI belongs here

Opportunity discovery is not a purely mechanical scan. Choosing themes, recognizing paraphrased claims, deciding which venue families to inspect, and forming candidate strategies are subjective search problems. The architecture therefore treats one or more inexpensive, fast AI workers as normal discovery infrastructure.

## Authority chain

1. Discovery workers inspect bounded inputs and emit hypotheses.
2. Claim-link proposals remain `UNREVIEWED` until independent review.
3. Deterministic compilers turn accepted inputs into bounded candidates.
4. The exact `bigint` verifier evaluates every canonical resolution state.
5. Only a valid verifier certificate may reach the Risk Governor.
6. Live execution remains disabled.

An AI worker cannot collapse or skip a stage.

## Worker pool

Workers implement one narrow interface and declare:

- identity;
- heuristic or model kind;
- free or low cost tier;
- structured output schema.

The pool may run workers concurrently, tolerate individual failures, deduplicate equivalent theses, and cap hypotheses per task. The model fan-out is explicit and bounded from one to four; its ordered lenses are equivalence, partition, mechanism, and skeptic. The default remains one, and no request is scheduled without an operator action. A model provider is an adapter behind `AiModelPort`; model names and credentials never enter Core domain types.

Workers do not search from the question alone. The control plane first loads
verified raw catalog fixtures, applies the venue adapters, and builds a
relevance-ranked context of at most 30 concrete listings. Titles, compact rules,
outcomes, indicative prices, source hashes, and protocol identities are
content-addressed as `pmh.discovery-catalog-context.v2`. The context identity is
part of task idempotency and durable run scope. A worker may return no lead, but
every returned lead must name at least one listing from that exact context.

## Live catalog observation

Fresh public catalog data enters a separate `OBSERVE_ONLY` desk rather than
silently replacing the fixture-grounded default context. The desk issues anonymous
GET requests only, sends no authorization material, follows no redirects, and
caps each source at 10 seconds and 2,000,000 response bytes. Polymarket Global,
Kalshi, Gemini, Opinion, Myriad, and Limitless refresh independently.

Every successful response is preserved byte-for-byte in bounded SQLite WAL
schema v3. Its record binds receive time, source URL, protocol identity, HTTP
metadata, byte length, raw SHA-256, normalized listing count, and a second hash
over the normalized listings. Hydration re-runs the venue codec and rejects a
raw or normalized mismatch. Failure is source-local: the projection becomes
degraded, records a compact diagnostic, and retains the last successful
content-addressed snapshot for that venue.

An operator may explicitly request `CURRENT_OBSERVATIONS` for either AI lane.
Each requested source must have a successful, non-empty latest refresh no older
than 15 minutes; a stale, failed, empty, or unknown source rejects the task.
`pmh.discovery-catalog-context.v2` binds its fixture/live source grade, receive
time, raw response hash, protocol identity, and an untrusted-venue-text policy.
Prompts reinforce that titles, descriptions, and rules are data, never
instructions. Qualification permits only bounded `PROPOSE_ONLY` search input;
it creates no path into hypothesis review, compilation, certification, or
execution.

The default adapter binds that port to `deepseek-v4-flash` through Vercel AI
SDK. It requests validated `pmh.discovery-output.v1` object output, disables
thinking for the fast lane, exposes no tools, and allows at most 800 output
tokens within an 8-second timeout. Only task-scoped venue IDs and listing
references survive an additional application-side validation boundary. The
API key remains in a native private field in the control-plane process and is
absent from JSON projections, diagnostics, SQLite, and Git. Direct OpenAI
Responses remains an explicit alternate route and retains its `store:false`
request control; DeepSeek is labeled `PROVIDER_POLICY` because its API exposes
no equivalent per-request storage switch.

Provider qualification is a separate one-shot path over the selected
production adapter. It loads the verified Gemini catalog context, permits
exactly one request, and emits a self-hashed `pmh.model-provider-smoke.v2`
report to standard output. The report records provider and transport posture,
bounded task identity, grounded hypotheses or a valid empty result,
literal-false side effects, and no credential. It does not persist the response
or mutate the Discovery Ledger.

Every pool run records one bounded worker report per configured worker: worker
identity, kind, cost tier, PASS/FAILED status, start/completion timestamps,
duration, lead count, and a compact failure diagnostic. Reports survive in the
hash-checked Discovery Ledger and Studio projection. They deliberately do not
invent billed cost, token usage, or quality scores when the provider/CLI does
not expose a uniform trustworthy fact.

## Two AI lanes

The quick lane and the investigator lane deliberately have different process
shapes:

- Vercel AI SDK owns cheap, structured, one-request scouting. It has no tools,
  low output and time budgets, and can join the parallel discovery pool.
- pi owns work that benefits from a coding-agent loop and repository context.
  It is a pinned CLI subprocess, not an SDK abstraction hidden behind the same
  interface.

pi is available through both an independent one-shot qualification command and
an explicitly operator-triggered control-plane route; it is never a scheduler.
Each invocation creates an empty temporary pi home, disables user extensions,
skills, prompt templates, themes, version checks, telemetry, and session
persistence, and enables only repository `read`, `grep`, `find`, and `ls`. The
child receives a minimal environment allowlist containing `PATH`, its temporary
home, and `DEEPSEEK_API_KEY`; no shell or write tool is available. Process time
and combined output bytes are hard bounded, stderr is not surfaced, and the
temporary home is removed after the run.

pi emits only its final text because JSON event mode repeats the growing
assistant snapshot on every streaming delta and can amplify a normal long-
thinking response into tens of MiB. The allowed tool set is fixed in the
application-owned CLI arguments; the report explicitly states that per-tool
execution traces are unavailable. The application discards unknown fields and
rejects missing or malformed required fields, oversized text, and every listing
reference outside the supplied catalog context. It then reconstructs
`PROPOSE_ONLY`, `UNREVIEWED`, and literal-false effects locally and hashes the
complete `pmh.pi-investigation-report.v1`. The report does not enter candidate
compilation or the Discovery Ledger automatically.

The long-running `InvestigationDesk` serializes this expensive lane to one
active task. A duplicate active request shares its promise, a passed task scope
is replayed idempotently, a competing task is rejected, and a failed task may
be retried. It publishes RUNNING/PASS/FAILED records through the Studio
projection and SSE. Completed PASS/FAILED records are canonicalized, hashed,
and retained in a separate bounded SQLite table; storage hydration validates
both the report's self-hash and the enclosing record hash. Passed-task
idempotency therefore survives restart. RUNNING state remains process-local
because an interrupted isolated subprocess cannot be resumed. Diagnostics are
sanitized, and every record reconstructs proposal-only, unreviewed, and
literal-false execution authority locally.

## Research case coordination

`ResearchCaseDesk` derives a bounded operational dossier from Discovery Ledger
and Investigation Desk projections; it owns no mutable store. Scope identity is
the hash of normalized question, sorted venues, catalog-context identity, and
fixture/live source grade. This keeps successive live observation revisions
separate and permits scout and pi task IDs to differ without losing their shared
research scope.

The desk retains retry history, latest scout proposals, the latest passed pi
artifact, candidate listing references, warnings, and missing-evidence intake.
It fails closed on any upstream authority assertion or conflicting listing
counts for one context identity. `BOUND` and `PRESENT` mean only that evidence
or model output exists. The case projection always reconstructs
`PROPOSE_ONLY`, `UNREVIEWED`, `promotionEligible: false`, and
`executionAuthority: false`; it cannot create a review or feed compilation.

A case with a retained exact scout context and passed pi report also derives a
`pmh.review-intake-packet.v1`. This is a content-addressed handoff contract, not
a review: it binds the latest proposal hashes and proposer identities to the
catalog context, pi artifact, candidate listing scope, evidence gaps, and the
required rule/outcome/timing/void/resolution-source assessments. The verifier
recomputes the packet hash and rejects malformed or authority-widening fields.
`GET /api/v1/research-cases/review-intake?caseId=...` returns only an existing
packet and has no decision-write counterpart.

## Opportunity radar and durable handoff

Prompt-driven discovery alone does not search a changing multi-venue catalog.
`OpportunityRadar` therefore performs a deterministic first reduction over
fresh live observations. It scores only cross-venue title pairs using integer
rare-term weighting, rejects explicit cadence and exact close-time conflicts,
and caps the output at 25. This layer proposes workload, not meaning: the score
is labeled lexical blocking only and every candidate remains `PROPOSE_ONLY`,
`UNREVIEWED`, `arbitrageVerified: false`, and non-executable.

An operator may send one candidate to the fast pool. The control plane resolves
the candidate against its current evidence identity and constructs an exact
two-listing context itself; clients supply only the candidate ID. The resulting
Discovery Ledger record stores the complete bounded context beside its compact
identity/count/source summary. The full snapshot is intentionally removed from
the public projection to keep SSE bounded, while `catalogContextRetained`
advertises whether a safe deep handoff is possible.

Case-driven pi investigation loads that stored task context rather than asking
the mutable live catalog to rebuild it. A refresh may and should create new
Radar candidate IDs, but it cannot change an existing research case's pi
input. Canonical record hashes, nested context identities, scope checks, and a
rehashed-tamper test protect this boundary across restart. Pre-snapshot legacy
runs cannot use the handoff and must be rescouted.

A real six-source refresh qualified the reduction on 2026-08-01: 314 observed
listings became three aligned hourly Opinion–Limitless pairs for BTC, ETH, and
BNB. Fast DeepSeek scouting and a pi investigation started from a retained
pre-refresh context both found contract-level mismatches instead of claiming
equivalence: Pyth versus Chainlink settlement, strict versus inclusive
thresholds, and asymmetric outage fallbacks. The pi artifact
`sha256:7d0cd196…e1d908` remains an unreviewed proposal with no compilation,
certificate, or execution authority.

The first real DeepSeek V4 Flash qualification passed both paths on 2026-08-01.
The AI SDK path emitted three fixture-grounded proposals under artifact
`sha256:93e5612e…273735`. The corrected pi final-text path emitted a bounded,
scope-validated investigation under `sha256:41cd6d74…10b2d1`. These identities
record protocol qualification only; neither artifact is an equivalence review
or arbitrage certificate.

Completed runs enter a bounded Discovery Ledger. It retains the
question, venue scope, worker identities, per-worker reports, diagnostics, and hypotheses so an
HTTP response is not the only copy of subjective work. The ledger accepts
proposal-only, unreviewed, non-executable records and is projected to Studio
over SSE.

The Scout Inbox has no review button. Until an independent reviewer authority
is configured, hypotheses cannot become accepted market links and therefore
cannot enter deterministic candidate compilation.

## Control plane

The control plane is the long-running owner of projections, discovery runs, event streams, and future venue sessions. Studio is a client. This keeps runtime state, credentials, venue transports, and exact verification out of the browser.
