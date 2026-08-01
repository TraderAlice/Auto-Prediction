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

The pool may run workers concurrently, tolerate individual failures, deduplicate equivalent theses, and cap hypotheses per task. A model provider is an adapter behind `AiModelPort`; model names and credentials never enter Core domain types.

Workers do not search from the question alone. The control plane first loads
verified raw catalog fixtures, applies the venue adapters, and builds a
relevance-ranked context of at most 30 concrete listings. Titles, compact rules,
outcomes, indicative prices, source hashes, and protocol identities are
content-addressed as `pmh.discovery-catalog-context.v1`. The context identity is
part of task idempotency and durable run scope. A worker may return no lead, but
every returned lead must name at least one listing from that exact context.

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
be retried. It keeps at most ten RUNNING/PASS/FAILED records in process memory
and publishes them through the Studio projection and SSE. This operational
memory is deliberately not the durable SQLite Discovery Ledger. Diagnostics
are sanitized, and every record reconstructs proposal-only, unreviewed, and
literal-false execution authority locally.

The first real DeepSeek V4 Flash qualification passed both paths on 2026-08-01.
The AI SDK path emitted three fixture-grounded proposals under artifact
`sha256:93e5612e…273735`. The corrected pi final-text path emitted a bounded,
scope-validated investigation under `sha256:41cd6d74…10b2d1`. These identities
record protocol qualification only; neither artifact is an equivalence review
or arbitrage certificate.

Completed runs enter a bounded Discovery Ledger. It retains the
question, venue scope, worker identities, diagnostics, and hypotheses so an
HTTP response is not the only copy of subjective work. The ledger accepts
proposal-only, unreviewed, non-executable records and is projected to Studio
over SSE.

The Scout Inbox has no review button. Until an independent reviewer authority
is configured, hypotheses cannot become accepted market links and therefore
cannot enter deterministic candidate compilation.

## Control plane

The control plane is the long-running owner of projections, discovery runs, event streams, and future venue sessions. Studio is a client. This keeps runtime state, credentials, venue transports, and exact verification out of the browser.
