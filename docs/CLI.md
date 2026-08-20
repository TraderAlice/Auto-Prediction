# CLI

For installation and process startup, see [Operations](OPERATIONS.md). The CLI
is the machine-readable operator surface for external Agents. Auto Prediction
Studio remains the human observability surface; both read the same first-party
control-plane projections.

The bundled `pmh` CLI emits schema `pmh.cli.v1`. Every response contains command identity, current state, diagnostics, an explicit no-side-effects declaration, content-hashed artifacts, allowed next actions, and an `ok` verdict.

Begin with no arguments or `help`. This does not require a running control
plane and returns the exact command catalog and valid next actions:

```bash
pnpm --silent pmh
pnpm --silent pmh help
```

Implemented commands:

```bash
pnpm --silent pmh help
pnpm --silent pmh system status
pnpm --silent pmh control status
pnpm --silent pmh agent workspace
pnpm --silent pmh agent target inspect <target-id>
pnpm --silent pmh agent task inspect <task-id>
pnpm --silent pmh agent task preview <task-id> <execution-profile-id>
pnpm --silent pmh agent task execute <task-id> <execution-profile-id> <preview-ref> <authorization-ref>
pnpm --silent pmh agent run inspect <run-id>
pnpm --silent pmh agent run wait <run-id> [wait-ms]
pnpm --silent pmh venue list
pnpm --silent pmh venue inspect <venue-id>
```

`control status` reads the versioned startup-readiness projection. `agent
workspace` reads `/api/v1/agent-workspace/routing`, a first-party bounded
projection: execution counts and retained capability outcomes, the first 12
attention actions and research targets, relation-campaign eligibility, and
discovery-cycle state. It retains exact task/action/target identities needed
for later commands and never downloads the multi-megabyte Studio workspace or
copies semantic or economic verdict logic into the CLI.

Continue by following the exact commands in `allowedNextActions`. A routable
relation-discovery target supplies its bound task identity; task inspection
supplies only the execution profiles compatible with that task kind. A
`RUNNABLE` task then supplies a fully populated preview command. Historical or
superseded tasks remain inspectable evidence but do not advertise an invalid
preview action.

`agent task preview` posts `mode: PREVIEW` to the first-party manual-run route.
The response binds the requested task and profile identities and explicitly
reports zero provider requests, model invocations, writes, and created runs.
It grants no execution authority. The response supplies a content-addressed
`previewRef` and the exact execute command. The suggested authorization ref is
`external-agent:<previewRef>`: it is an idempotency key, not trading authority.

`agent task execute` accepts only that exact task/profile/preview binding. A
first request creates one research run and may start provider/model work; a
retry with the same authorization ref returns the same retained run without
starting duplicate work. Reusing an authorization ref for any other binding
fails closed. Every response keeps trading, external-write, value-moving, and
live-execution authority literal `false`.

`agent run inspect` returns one exact run plus bounded, run-bound invocation,
tool-effect, artifact, annotation, and result-selection collections. A terminal
run points back to its task and workspace.

`agent run wait` avoids a client-side polling loop. It waits up to 30 seconds
by default (configurable from 1 to 60,000 milliseconds and never beyond the run
profile's wall-clock budget) on the already-authorized in-process run. It does
not create, cancel, or redispatch work. `TIMEOUT` means the same run is still
active; `NOT_AWAITABLE_IN_THIS_PROCESS` means the durable run exists but this
process no longer owns its completion promise. This makes the current machine
journey:

```text
agent workspace
  -> agent target inspect <exact-target-id>
  -> agent task inspect <exact-task-id>
  -> agent task preview <exact-task-id> <exact-profile-id>
  -> agent task execute <exact-task-id> <exact-profile-id> <preview-ref> external-agent:<preview-ref>
  -> agent run wait <exact-run-id>
  -> agent run inspect <exact-run-id>
```

The default control plane is `http://127.0.0.1:4100`. Override it for another
local or tunneled environment without changing command output:

```bash
PMH_CONTROL_PLANE_URL=http://127.0.0.1:14100 pnpm --silent pmh control status
```

Use `--silent` for machine consumption: stdout is then exactly one JSON
envelope. The root launcher incrementally builds only the CLI and its referenced
packages instead of rebuilding the whole monorepo; compiler diagnostics remain
on stderr.

Control-plane reads have a 30-second bounded timeout and fail with stable diagnostic
codes: `CONTROL_PLANE_UNREACHABLE`, `CONTROL_PLANE_TIMEOUT`,
`CONTROL_PLANE_HTTP_ERROR`, or `CONTROL_PLANE_MALFORMED_RESPONSE`. The envelope
always includes valid recovery commands in `allowedNextActions`; external
Agents should follow that field rather than guessing a route.

Unknown commands and venue identities fail closed with a non-zero process exit code and a JSON diagnostic. The present CLI cannot write external state or move value; both effects are literal `false` in every response.

True runtime resume, campaign control,
catalog refresh, claim/link inspection, opportunity verification,
deterministic replay, shadow execution, and Core projections remain planned CLI
surfaces. Human-readable Studio views and compact CLI views consume
control-plane projections and must never recompute verdicts.

There is deliberately no `agent run resume` command. `INTERRUPTED` is a
terminal retained attempt and a restarted process cannot honestly restore the
lost runtime session today. Retrying requires a new task preview, a new
`previewRef`, and a new authorization reference, producing a higher run
ordinal. Reusing the interrupted run's old authorization reference only returns
that same retained run and never silently redispatches it.
