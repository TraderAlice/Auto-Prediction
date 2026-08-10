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
- `execution_capability_observations` (non-secret, expiring preflight evidence);
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

The UI must make “configured,” “runtime available,” “service usable,” “route selected,” and
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
  leases still need one-time incident annotations in the new tables. The
  Phase 3 adapter boundary now consumes `ExecutionProfile` in mocked
  qualification, but production Pi/Codex/in-process drivers and an active
  campaign dispatcher have not been enabled.

### Phase 3 adapter checkpoint

- A common session lifecycle now drives Pi, Codex Agent, and in-process
  adapters through the same `advance(toolResults)` loop. The runtime kind is
  independent of the model driver and credential kind; the compatibility
  matrix is still enforced before a session opens.
- Logical credential bindings resolve just in time through a broker. Codex
  OAuth cache and environment API-key resolvers return secret-bearing values
  only to the adapter-open context; readiness and execution results retain the
  binding identity and redacted status, never the bearer, account credential,
  or API key.
- Each successful runtime turn creates one model invocation record. Invocation,
  token, tool-call, and wall-clock limits are checked at every loop boundary;
  exceeding a budget interrupts the run before another model call. Invocation
  chronology and cumulative token overshoot also fail closed.
- Tool calls cross a first-party `AgentToolHost`. Accepted and rejected calls
  become hashed `AgentToolEffect` records with no semantic, certificate,
  external-write, or value-moving authority. A rejected submission is returned
  to the session so the Agent can repair it in a later turn.
- Mocked compatibility qualification covers Pi with Codex OAuth and DeepSeek,
  Codex Agent with Codex OAuth, and the in-process harness with both model
  supplies. No credential, provider request, subprocess, or live runtime is
  used by these tests.
- Production CLI drivers now exist for Pi and Codex Agent behind that same
  lifecycle. Pi runs with built-in tools, extensions, skills, prompt templates,
  themes, and context files disabled; Codex runs in an isolated `CODEX_HOME`
  with user configuration/rules ignored and a read-only sandbox. Both accept
  only the advertised first-party tool manifest and a small control-flow action
  schema; domain claims and results still cross first-party tools instead of a
  brittle fixed business-output schema.
- Codex OAuth material is written only to a mode-0600 per-session temporary
  runtime home and removed at completion/cancellation. DeepSeek API keys exist
  only in the Pi child environment. Bounded subprocess runners enforce timeout
  and output ceilings, parse token usage, preserve Pi session IDs and Codex
  thread resume, and fail closed when either CLI reports an undeclared shell,
  file, MCP, web, or internal tool event.
- Injected-process qualification exercises Pi + DeepSeek, Pi + Codex OAuth,
  and Codex Agent + Codex OAuth without a live model call. Together with the
  common lifecycle suite, all 518 control-plane tests and its TypeScript check
  passed at the CLI-driver checkpoint.
- The in-process Vercel AI SDK driver now composes either Codex Responses OAuth
  or DeepSeek OpenAI-compatible access behind `HARNESS_IN_PROCESS`. It exposes
  the same first-party tool manifest plus one reserved completion control tool,
  carries rejected effects into a bounded transcript, performs exactly one
  provider invocation per substrate turn, and ignores prose as publication
  authority. Completion cannot be mixed with domain effects. Model-owned Terra
  effort and DeepSeek thinking options are translated only inside their own
  provider adapters.
- Injected-turn qualification covers both in-process credential/model supplies,
  rejected-effect recovery, malformed mixed completion, timeout attribution,
  and secret-free durable results. Phase 3 production drivers are therefore
  implemented without making a live model call; shadow use still requires a
  later explicit manual run or active campaign. All 522 control-plane tests,
  its TypeScript check, and its production bundle pass after this Phase 3
  checkpoint; the Node 22 versus declared Node 24 host warning remains.

### Historical Rule Evidence migration checkpoint

- SQLite schema 36 adds append-only run artifacts and run annotations. Result
  selection now requires an artifact retained on the selected run with the
  exact content hash; a successful transport or a legacy job hash cannot stand
  in for a result artifact.
- Schema repair checks table families as well as `user_version`. This repaired
  a real version-skewed database whose version was already 36 while its schema
  35 execution tables were absent, and a regression now proves the same repair
  from a current-version partial database.
- The provider-free Rule Evidence importer reconstructs stable tasks from
  retained captures and records three honest legacy-input gaps where bytes are
  outside retention. It wraps terminal and attempt-bearing jobs as
  `LEGACY_IMPORT` runs, retains a claim effect/artifact only when the claim body
  remains available, and adds explicit annotations instead of synthesizing
  missing content, attempts, timings, or token allocations.
- The retained local database now reopens with 530 tasks, 229 historical runs,
  462 model-invocation projections, one accepted claim effect/artifact, and 801
  annotations. Those annotations include all six failed Terra/Codex requests,
  all twelve expired leases, and all fifty attempt-bearing retry-wait jobs. It
  creates no campaign and started zero provider requests.
- The legacy usage ledger contains 425 older DeepSeek events that cannot be
  joined to the currently retained job time windows, including 210 requirement
  identities whose jobs aged out. Their original usage rows remain intact;
  migration reports the attribution gap and deliberately does not fabricate
  runs or request-level token splits. Likewise, aggregate usage events retain
  their observed provider-request count in annotations rather than being
  expanded into invented per-request records.

### Campaign dispatcher and Studio checkpoint

- The execution catalog now registers Pi CLI, Codex CLI, and the in-process AI
  SDK loop independently from Codex OAuth and DeepSeek key bindings. The
  current model configuration seeds five Rule Evidence compositions: Pi with
  either model supply, Codex Agent with Codex OAuth, and the in-process loop
  with either model supply. Terra/Luna effort remains inside its immutable
  model profile. Saving the catalog or changing a route starts zero requests.
- `AgentCampaignDispatcher` supports provider-free manual previews, explicitly
  authorized manual runs, paused/active append-only campaign revisions,
  bounded interval ticks, concurrency, invocation, token, and wall-clock
  checks before every model turn, and incremental invocation/tool-effect
  persistence. Only the latest revision of a campaign key is effective; pause
  supersedes the old active revision so it cannot keep dispatching.
- A restart converts durable `PREPARED` runs to visible `INTERRUPTED` outcomes
  without inferring retry authority. The legacy Rule Evidence scheduler keeps
  its compatibility projection and manual endpoint, but its automatic timer is
  removed; recurring spend for this workload now exists only in effective
  active campaigns.
- The first-party Rule Evidence tool host owns bounded retained-text search,
  reads, passage-handle resolution, draft validation, and advisory claim
  submission. Models receive repairable rejections and cannot publish through
  free-form text. Accepted effects remain non-semantic, non-certificate, and
  non-execution authority.
- Studio now has a URL-stable `?view=agents` operations surface. It separates
  runtime capability, credential readiness, model-owned profiles, execution
  compositions, routes, tasks, runs, invocations, incidents, token purpose
  breakdown, manual preview/execute, and paused/active campaign controls.
  Currency cost stays explicitly unavailable until immutable price schedules
  are retained. A configuration or credential-ready badge is not presented as
  spend authority.
- Mock qualification proves a concurrency-three interval campaign starts at
  most three invocations, stops at its request ceiling, and cannot dispatch an
  older active revision after pause. HTTP qualification proves create,
  activate, and pause start zero requests. A manually previewed local Studio
  run created no run or invocation. No live model request was made during this
  checkpoint.
- Visual qualification at 1280×720 and 390×844 found no horizontal overflow
  and a 12 px minimum main-text size. The desktop surface fits its primary
  metrics and capability/cost split without the former mixed-scale control
  rack; the mobile surface collapses to one column.

This checkpoint proves the identity, compatibility, persistence, explicit
dispatch, and operator-surface boundaries for the Rule Evidence proving
ground. It does not claim that the remaining legacy workloads have migrated or
that the operator has authorized the optional live one-task comparison.

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

## Use-driven qualification checkpoint — 2026-08-10

The first Studio-driven, one-task Codex/Terra campaign exposed a product defect
before it produced any research artifact. Run `sha256:05fc06406146…` made one
model invocation, retained zero known tokens and zero tool effects, and failed
with `CODEX_CLI_EXIT`. The original projection only named that wrapper error,
which made an authentication failure look indistinguishable from a timeout,
model failure, or runtime crash.

Model invocation protocol v2 now retains a bounded, credential-redacted process
diagnostic for failed CLI turns. The diagnostic survives SQLite restart and is
available from the Agent run ledger in Studio. Historical v1 invocations remain
honest: their identities and bytes are preserved, and Studio explicitly says
that no transport diagnostic was retained rather than inventing one during
projection. The legacy Rule Evidence importer constructs exact v1 invocations
so a restart cannot rebind an existing invocation identity to a v2 record.

The retained live evidence identifies the next product gate: the configured
Codex OAuth binding and Codex runtime both projected `READY`, but the isolated
CLI received HTTP 401 from the model and websocket endpoints and HTTP 451 from
the transport. Readiness currently proves credential shape, not usable service
capability. No blind retry is justified until configuration readiness and live
capability have distinct, operator-readable states.

Selection signals from this checkpoint:

- keep the bounded diagnostic because it changed the diagnosis without adding
  another provider request;
- keep v1/v2 records distinct because additive migration otherwise rewrites
  retained invocation identity on restart;
- treat zero known tokens as incomplete transport telemetry, not proof that the
  failed request was free;
- block further Codex/Terra shadow comparison on an honest OAuth capability
  preflight rather than increasing timeout or retry budgets.

### Execution-profile capability checkpoint

The former credential `READY` state has been replaced by four separately
projected layers: credential configuration, runtime availability, expiring
service capability, and dispatch eligibility. A capability observation belongs
to the complete immutable execution profile, because the same OAuth material
can behave differently under Pi, Codex CLI, an in-process SDK, or another
runtime integration. SQLite schema 37 stores only the profile ID, outcome,
probe kind, bounded diagnostic, observation/expiry times, and zero-inference
authority flags; bearer, account header, response body, and model output are
never retained.

The bounded preflight uses a non-inference service request for Codex-backed
profiles. It classifies accepted, authentication-rejected, transient, missing-
configuration, and unsupported-probe outcomes. A fresh `USABLE` observation is
required before a Codex OAuth profile can create a run. Missing, rejected,
transient, unverified, or stale Codex capability blocks dispatch before the run
and model-invocation records exist. DeepSeek API-key profiles remain eligible
when configured but explicitly `UNVERIFIED`, because no zero-inference service
probe is currently defined for that access driver.

Real host evidence materially changed the runtime choice:

- `codex login status` proved only that credentials were present;
- the supported Codex app-server path successfully initialized, listed models,
  and read service-backed rate limits without inference;
- the same cached ChatGPT credential was rejected by the current direct
  `codex_cli_rs`, `pi`, and `prediction-market-harness` originators (HTTP 403),
  matching the earlier CLI run's 401/451 transport failure;
- therefore OAuth capability is execution-path-specific. Copying or reshaping
  `auth.json` is not evidence that Pi or a custom SDK route can use it.

The current Codex CLI, Pi+Codex, and in-process Codex profiles must remain
blocked on this host. The next runtime specimen should integrate the supported
Codex app-server account/model surface (or another officially supported Codex
runtime route), then earn its own `USABLE` observation before shadow work.

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
- Capability evidence is scoped to an execution profile, expires to `STALE`,
  survives SQLite restart, and never changes task or profile identity.

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
- A known Codex authentication rejection and a stale/unverified Codex profile
  block dispatch before an Agent run or model invocation is created.

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
