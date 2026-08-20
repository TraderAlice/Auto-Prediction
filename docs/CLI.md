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

Exact target/task inspection, previewable manual runs, campaign control,
catalog refresh, claim/link inspection, opportunity verification,
deterministic replay, shadow execution, and Core projections remain planned CLI
surfaces. Human-readable Studio views and compact CLI views consume
control-plane projections and must never recompute verdicts.
