# Agent execution substrate

Status: active architecture migration

Started: 2026-08-10

Supersedes the target architecture in
[`ai-provider-routing.md`](ai-provider-routing.md) while retaining that plan's
live evidence and compatibility findings.

## Product problem

The current system treats `DEEPSEEK` and `CODEX` as interchangeable provider
values inside a singleton runtime setting, while Pi is wired as a separate
special-purpose path. That collapses several independent concerns:

- Pi and Codex are long-running Agent runtimes with different session,
  continuation, compaction, and tool-bridge behavior;
- Vercel AI SDK is a model access and in-process tool-loop library, not a peer
  Agent runtime;
- a credential says which account may access a model service, not which Agent
  runtime owns the task;
- a model owns its supported inference parameters; there is no provider-neutral
  global `effort` knob;
- selecting a runtime profile is capability and routing, not authorization for
  recurring spend;
- a business task should not change identity because it is retried on another
  runtime, model, credential binding, or reasoning setting.

This category error reached the scheduler. Routing Rule Evidence Claim work
from the legacy DeepSeek constructor toward the selected Codex configuration
changed the job generation identity for roughly 506 retained requirements. The
scheduler began reconciling a second job generation, and a temporary automatic
gate treated the selected Codex configuration as permission to dispatch it.
Six Terra requests were started and failed before the gate was closed. The
retained usage events, unfinished leases, and old jobs are migration evidence;
they must not be hidden, rewritten, or retried merely by loading new settings.

## Architecture decision

Build one provider-neutral Agent execution substrate. Its durable hierarchy is:

```text
AgentTask
  -> AgentRun (immutable ExecutionProfile snapshot)
       -> ModelInvocation (one model-service request)
       -> ToolEffect (first-party validated externality)
       -> RunArtifact

AgentCampaign
  -> explicitly selects AgentTasks
  -> explicitly authorizes bounded AgentRuns
```

`AgentTask` describes work. `AgentRun` records one chosen way of doing it.
`ModelInvocation` records one underlying model call. A runtime/model/settings
change can create another run for the same task; it cannot create another task
or dispatch anything on its own.

## Layer contracts

### 1. Agent task

`AgentTask` is independent of runtime, model service, credentials, and inference
parameters. It contains:

- task kind and protocol version;
- immutable input artifact references and content hashes;
- the requested first-party tool/effect contract;
- proposal-only authority and any narrower workload authority;
- deadline class, priority, and stable provenance;
- optional parent task, issue, finding, or campaign lineage.

Examples are `DISCOVERY_SCOUT`, `SEMANTIC_REVIEW`,
`PROBABILITY_ESTIMATION`, `PREMISE_ANALYSIS`, `OFFICIAL_SOURCE_DISCOVERY`,
and `RULE_EVIDENCE_CLAIM`. Workload-specific payloads remain typed, but the
scheduler contract is shared.

The task ID is derived only from the task kind/version, immutable input
identity, requested effect protocol, and authority. It excludes runtime,
provider, endpoint, credential, model, reasoning settings, retry policy, and
campaign.

### 2. Agent runtime definition

An `AgentRuntimeDefinition` describes the long-loop execution environment:

- `PI` — Pi process/runtime, including its continuation and tool protocol;
- `CODEX` — Codex Agent runtime, including session/resume and tool mediation;
- `HARNESS_IN_PROCESS` — the harness-owned bounded loop, which may use Vercel
  AI SDK internally.

The definition owns runtime version, capability declarations, session and
resume behavior, compaction behavior, cancellation, isolation, tool transport,
and safe projection. It does not own a credential or choose a model.

All runtime adapters implement one first-party lifecycle contract:

- `start(runSnapshot)`;
- `resume(runId, continuation)` when supported;
- `cancel(runId)`;
- stream bounded runtime events and proposed tool calls;
- return a terminal status without smuggling domain results through free-form
  text.

Unsupported capabilities fail during profile validation, before a task lease
or provider request. The system must not assume that every runtime can drive
every model access driver merely because the configuration fields exist.

### 3. Credential binding

A `CredentialBinding` is non-secret metadata pointing to a just-in-time secret
resolver. It contains a logical binding ID, credential kind, account/scope
identity, readiness, resolver kind, and audit metadata. Examples include
`CODEX_OAUTH`, `OPENAI_API_KEY`, and `DEEPSEEK_API_KEY`.

Secret values, bearer tokens, refresh tokens, API keys, and raw account headers
never enter SQLite, identity hashes, projections, logs, prompts, usage events,
or artifacts. Refreshing or rotating the same logical credential binding does
not create a new task or run. Choosing a different logical account binding
does create a distinct execution-profile snapshot for attribution.

The runtime adapter receives an expiring capability handle, not the raw
credential record. Credential readiness is capability, never automatic-spend
consent.

### 4. Model profile

A `ModelProfile` binds a model-access driver and model ID to that model's own
validated configuration. It contains:

- a stable profile ID and revision;
- model-service family and access driver, such as OpenAI Responses, the Codex
  backend, or an OpenAI-compatible DeepSeek endpoint;
- exact model ID;
- a model-specific configuration object;
- declared context, tool-calling, streaming, response-storage, and reasoning
  capabilities;
- canonical validation and hashing rules.

`effort` is deliberately **not** an independent global field. It is a property
inside the selected model's configuration schema. For example:

```ts
type TerraModelProfile = {
  model: "gpt-5.6-terra";
  configuration: {
    reasoning: { effort: "low" | "medium" | "high" | "xhigh" | "max" };
    responseStorage: false;
  };
};

type DeepSeekFlashModelProfile = {
  model: "deepseek-v4-flash";
  configuration: {
    thinking: { mode: "disabled" | "enabled" };
  };
};
```

These are illustrative domain shapes, not a promise that each listed option is
accepted by the live endpoint. Each registered model publishes its own option
schema and compatibility tests. Studio renders that schema after model
selection. Changing Terra from `high` to `max` changes the model-profile hash
and therefore the run identity; it never changes the task ID. A DeepSeek model
must not receive an OpenAI reasoning-effort value through a generic adapter.

### 5. Execution profile

An `ExecutionProfile` composes:

- `runtimeDefinitionRef`;
- `modelProfileRef`;
- `credentialBindingRef`;
- `toolPolicyRef`;
- `budgetPolicyRef`;
- optional isolation and data-retention policy refs.

The compatibility resolver validates the concrete composition. This is not an
unrestricted Cartesian product. For example, Pi with Codex OAuth is permitted
only when the installed Pi adapter declares that credential/model driver;
Codex runtime with a DeepSeek key is not inferred merely because both records
exist.

The execution-profile snapshot is immutable inside a run. Editing a reusable
profile creates a new revision. No in-flight or retained run is rewritten.

### 6. Agent run, model invocation, and tool effect

An `AgentRun` binds one task to one immutable execution-profile snapshot. It
owns runtime state, lease state, budget counters, terminal reason, usage
aggregation, and artifact lineage.

A `ModelInvocation` is one actual model-service request within a run. It records
ordinal, safe transport identity, start/end time, outcome, failure category,
token usage, latency, and response-storage posture. An Agent run may have many
model invocations because Pi, Codex, and the in-process loop can all act over
multiple turns. Model-invocation count is never inferred from task or run
count.

A `ToolEffect` is a first-party validated, idempotent externality such as
catalog inspection, hypothesis submission, evidence citation, abstention, or
run completion. The runtime may propose a tool call, but first-party code owns
schema validation, authority, identity, persistence, and rejection feedback.
Free-form final text is diagnostic only and cannot publish a claim or result.

### 7. Workload route, campaign, and result selection

A `WorkloadRoute` names the default execution profile for newly requested work
of a task kind. It is a routing default only.

An `AgentCampaign` is the explicit automatic-spend authority. It contains:

- a bounded task selector or explicit task membership;
- an execution-profile revision;
- activation state, with migrated campaigns paused by default;
- concurrency, provider-request, token, wall-clock, and optional currency
  ceilings;
- schedule, retry/fallback policy, and stop conditions;
- operator identity and activation audit event.

Changing a route, model profile, runtime, or credential binding makes zero
model invocations. Automatic work begins only through an active campaign.
Manual execution is a separate explicit operator command with a preview of the
exact run snapshot and budget.

Fallback never silently mutates an active run. It creates a separately
attributed run under a named fallback profile and only when the campaign or
manual command explicitly permits it.

Multiple runs may coexist for one task. A `ResultSelection` record identifies
which artifact is currently adopted for downstream use and why. Latest run,
most expensive model, or successful transport is not an implicit selection
policy.

## Identity and provenance rules

| Identity | Includes | Explicitly excludes |
| --- | --- | --- |
| `taskId` | task protocol, immutable inputs, requested effect contract, authority | runtime, model, credential, inference settings, campaign |
| `modelProfileHash` | access driver, exact model, model-specific configuration | secret values, live token expiry |
| `executionProfileHash` | runtime revision, model-profile snapshot, logical credential binding, tool/budget policy | credential material |
| `runId` | task ID, execution-profile hash, runtime/tool protocol versions, run generation | provider-attempt ordinal |
| `invocationId` | run ID and model-invocation ordinal | response text and secret material |
| `effectId` | run ID, tool protocol, canonical accepted input | free-form reasoning |

Every result artifact binds its task, run, execution-profile snapshot, accepted
tool effects, citations, and source content hashes. Historical artifacts retain
their original engine projection; migration may add an interpretation wrapper
but must not falsify old provenance.

## Durable data model

Add new append-oriented tables instead of destructively repurposing the current
singleton and workload-specific job tables:

- `agent_runtime_definitions`;
- `credential_bindings` (metadata only);
- `model_profiles`;
- `execution_profiles`;
- `workload_routes`;
- `agent_tasks`;
- `agent_runs`;
- `model_invocations`;
- `agent_tool_effects`;
- `agent_campaigns` and `agent_campaign_memberships`;
- `result_selections`.

The existing `ai_runtime_configuration` v2 row is imported as legacy routing
evidence and used to propose initial profiles; it is not deleted or treated as
automatic campaign consent. Existing workload jobs and artifacts remain
readable through compatibility projections until their workload migrates.

Writes that materialize or reconcile many tasks/runs are batch transactions
with bounded queries. Reconciliation must never perform one transaction and a
full in-memory sort per retained job. Projections are read-only and make zero
provider requests.

## API and Studio product model

Replace the single provider/model/effort control with explicit surfaces:

1. **Agent runtimes** — Pi, Codex, and in-process readiness, versions,
   capabilities, session support, and diagnostics.
2. **Credentials** — logical bindings and readiness only; no secret values.
3. **Models** — model profiles with model-specific option forms. Reasoning
   effort appears only inside models that declare it.
4. **Execution profiles** — compatible runtime + credential + model + tool and
   budget policy compositions, with a validation preview.
5. **Workload routes** — defaults for discovery, review, estimation, premise,
   evidence, and source work.
6. **Campaigns** — paused/active state, task scope, schedule, concurrency,
   budgets, last/next dispatch, and an explicit activation action.
7. **Task review** — one task with its alternative runs, model invocations,
   tool effects, artifacts, costs, and selected result.

The UI must make “configured,” “credential ready,” “route selected,” and
“campaign authorized” visually distinct. Saving a model or route must never
look like starting work. Activation previews the maximum immediate fan-out and
budget before the operator confirms it.

## 2026-08-10 implementation checkpoint

The first migration checkpoint is additive and intentionally makes no model
request:

- **Phase 0 containment is active.** Automatic Rule Evidence Claim dispatch
  remains closed. Changing Terra effort no longer creates another generation
  of the same business job. A retained expired `LEASED` record remains
  quarantined and projects as `interruptedLeaseCount`; restart and reconcile
  do not convert it to retry work or call the model.
- **Phase 1 is implemented.** Canonical contracts and validators now cover
  runtimes, logical credential bindings, model-owned configurations,
  execution profiles, stable tasks, runs, model invocations, first-party tool
  effects, campaigns, workload routes, and result selection. Terra/Luna effort
  is validated inside each Codex model profile; a DeepSeek Flash profile has
  its own thinking configuration and cannot accept Codex effort.
- **Phase 2 storage is partially implemented.** SQLite schema 35 adds the
  execution-substrate tables, foreign keys, immutable-record checks, bounded
  batch persistence, and restart replay. Legacy `CODEX` configuration imports
  as `HARNESS_IN_PROCESS + CODEX_OAUTH + CODEX_RESPONSES`, not as the Codex
  Agent runtime. Re-import and configuration revision create profiles/routes
  only: task, run, invocation, and campaign counts remain zero.
- **Rule Evidence task dual projection is implemented.** A requirement and
  capture reconcile to one `AgentTask`; priority, provenance, runtime,
  credential, model, and effort changes cannot alter its task identity. A
  506-input batch persists transactionally without provider work or per-row
  queue generation.
- **Qualification passes at this checkpoint.** All 506 control-plane tests,
  all 17 Studio tests, and all 666 workspace tests pass, together with every
  TypeScript project check and the production build. The available host is
  still Node 22 against the repository's Node 24 engine declaration, and the
  existing Studio bundle-size warning remains.
- **Execution is not migrated yet.** Historical claim jobs have not yet been
  wrapped as historical runs, the six Terra failures and retained interrupted
  leases still need one-time incident annotations in the new tables, and Pi,
  Codex Agent, and in-process runtime adapters do not yet consume
  `ExecutionProfile`. No active campaign dispatcher has been enabled.

This checkpoint proves the identity, compatibility, persistence, and
zero-dispatch boundary. It does not claim Phase 3–8 adoption.

## Migration sequence

### Phase 0 — contain and preserve the incident

- Keep automatic Rule Evidence Claim dispatch closed.
- Make no live model request during architecture construction and migration
  tests.
- Preserve the six failed Terra usage events and old DeepSeek histories.
- Classify the twelve retained `LEASED` records as interrupted legacy attempts;
  do not automatically retry or count them as twelve active requests.
- Quarantine the current uncommitted provider-routing probe. Harvest its mocked
  transport, usage-accounting, and batch-persistence tests where valid, but do
  not make its provider-shaped job identity the new foundation.
- Add an incident regression asserting that configuration load/change performs
  zero task creation, leases, and model invocations.

### Phase 1 — contracts and capability registry

- Define the task, runtime, credential, model profile, execution profile, run,
  attempt, tool effect, campaign, and result-selection contracts.
- Implement canonical validators/hashes and a capability compatibility
  resolver.
- Register Pi, Codex, and in-process runtimes without starting them.
- Register initial Terra/Luna and DeepSeek Flash model-profile schemas from
  tested endpoint capabilities, not a shared effort enum.

### Phase 2 — SQLite substrate and legacy import

- Add non-destructive tables, indexes, revision checks, and bounded batch APIs.
- Import current runtime settings into candidate model/execution profiles and a
  workload route; create no active campaign.
- Project current legacy jobs as tasks/runs without changing their stored bytes
  or scheduling state.
- Add one-time incident annotations for the six failed attempts and interrupted
  leases.

### Phase 3 — runtime and credential adapters

- Implement the common runtime lifecycle for Pi, Codex Agent, and the bounded
  in-process harness.
- Move Vercel AI SDK code behind the in-process runtime adapter instead of
  exposing it as an Agent runtime choice.
- Implement independent just-in-time credential resolvers, redaction, refresh,
  and readiness checks.
- Mock every runtime/model/credential combination first. Live qualification is
  a later, separately authorized campaign.

### Phase 4 — scheduler and campaign semantics

- Lease runs, not provider-shaped business jobs.
- Make task reconciliation provider-neutral and idempotent.
- Require a manual command or active campaign before creating a dispatchable
  run.
- Persist restart-safe run leases, per-invocation accounting, explicit fallback,
  and deterministic cancellation/recovery.
- Enforce concurrency and every configured budget before each model invocation,
  not merely before an Agent run begins.

### Phase 5 — Rule Evidence Claim proving migration

- Convert each durable evidence requirement into one stable `AgentTask`.
- Wrap historical DeepSeek claim jobs as historical runs of that task.
- Treat the six failed Terra calls as failed attempts/runs, never as new tasks.
- Allow an explicit manual or paused-by-default campaign to create a Terra,
  DeepSeek, Pi, or Codex-runtime run without changing task count.
- Retain citations and claim submissions only through first-party tool effects.
- Recover interrupted leases as an explicit operator-visible migration outcome,
  not an invisible retry wave.

Rule Evidence Claim is the proving ground because it exposed the bug. No other
workload migrates until its retained task count stays stable while runtime,
credential, model, and model-specific settings change.

### Phase 6 — migrate remaining workloads

Migrate one workload at a time, preserving existing protocol evidence:

1. semantic review and probability estimation;
2. premise analysis, evidence routing, and semantic repair;
3. official-source discovery;
4. heuristic discovery fast/deep lanes;
5. Pi investigation and traded-state expansion.

Remove a legacy provider-shaped scheduler only after its history replays, its
new task/run projection matches, and its automatic-spend behavior is proven
closed by default.

### Phase 7 — Studio and operator workflow

- Build the seven product surfaces above using the existing shadcn-compatible
  component layer and bounded type scale.
- Add compatibility explanations and model-specific configuration editors.
- Add task/run/attempt/cost comparison and result selection.
- Qualify desktop and 390 px layouts with no horizontal overflow, sub-12 px
  main text, credential exposure, or misleading activation language.

### Phase 8 — shadow qualification and adoption

- Run deterministic fixtures and mocked adapters first.
- Run one manually authorized, one-task shadow campaign with a strict request
  ceiling only after the operator reviews its exact execution profile.
- Compare Pi, Codex Agent, and in-process runs on result yield, accepted tool
  effects, provider requests, tokens, wall-clock time, failure modes, and
  resumability.
- Adopt runtime routes per workload from evidence; do not force one runtime to
  win every workload.

## Qualification gates

### Identity and compatibility

- The same input/effect contract has one task ID across Pi, Codex, in-process,
  DeepSeek, Terra, credential rotation, and model-configuration changes.
- Changing Terra `high` to `max` changes the model-profile and run identities,
  not the task identity.
- Unsupported model-specific settings and runtime/model/credential
  compositions fail before leasing or requesting.
- A DeepSeek profile never accepts a global OpenAI effort value by accident.
- Refreshing a secret for one logical credential binding changes no durable
  identity and exposes no secret material.

### Dispatch and spend safety

- Creating or editing runtimes, credentials, model profiles, execution
  profiles, and workload routes makes exactly zero model invocations.
- Importing the current 506-work-item evidence queue creates no new business
  tasks and activates no campaign.
- Restarting during migration makes no attempt and does not duplicate a lease.
- A campaign with concurrency three never has more than three active runs or
  exceeds its per-invocation budget checks.
- Runtime fallback creates a new attributed run only when explicitly enabled.
- Projection, API GET, Studio rendering, reconciliation, and result selection
  are provider-free.

### Runtime and effect semantics

- Pi and Codex both pass the same multi-step tool-effect contract while
  retaining their distinct runtime/session telemetry.
- The in-process Vercel AI SDK loop passes the same effect contract without
  masquerading as Pi or Codex.
- Rejected tool submissions are recoverable inside a long loop; accepted prior
  effects survive later failures.
- Free-form runtime text alone can never publish a claim, probability,
  certificate, or result.
- Cancellation, timeout, compaction, resume, and runtime crash produce explicit
  terminal/interrupted states and complete usage attribution.

### Persistence and performance

- Legacy DeepSeek jobs, all historical artifacts, the six Terra failures, and
  interrupted leases replay byte-for-byte where currently retained.
- Every actual provider call maps to exactly one model invocation and one usage
  record; failed streams retain partial usage when the transport provides it.
- Reconciliation of at least 506 retained tasks uses bounded batch
  transactions, does not perform per-record full sorts, and does not starve the
  control-plane event loop.
- Full workspace tests, type checks, production build, SQLite restart tests,
  and Studio visual qualification pass before the architecture becomes the
  mainline route.

## Rollback and reversibility

- New tables and projections are additive until every workload qualifies.
- Runtime/profile/campaign feature gates can route a workload back to its
  legacy scheduler without deleting new evidence.
- Campaigns can be paused independently of routes and credentials.
- No migration rewrites historical task, artifact, or usage identities.
- If dual projection diverges, stop migration for that workload and retain both
  records for comparison; do not “repair” history by choosing the newer one.
- The current provider-routing probe remains recoverable in Git/worktree until
  its valid tests and transport learnings have been deliberately extracted.

## Adoption signals

Adopt the substrate when:

- changing runtime/model/credential configuration causes zero automatic
  requests and no task fan-out;
- one task can be deliberately compared across Pi, Codex Agent, and the
  in-process harness with complete attempt/cost/effect attribution;
- model-specific options are validated and presented without a global effort
  fiction;
- the evidence queue migrates with stable task count and no silent retries;
- campaigns provide explicit, restart-safe spending authority.

Rework the design if runtime-specific state leaks into task identity,
model-specific settings escape their profile schema, credentials become part
of persisted secret-bearing state, or adapters require incompatible domain
result schemas. In those cases the substrate has reproduced the current
coupling under new names.

## Authority boundary

This migration governs AI research work only. It grants no live order,
transaction signing, token approval, credential custody for venues, capital
movement, production equivalence authority, or certificate publication. All
Agent tool effects remain proposal-only unless a separate first-party policy
already grants narrower deterministic authority.
