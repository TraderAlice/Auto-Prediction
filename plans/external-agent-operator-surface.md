# External Agent operator surface

## Product proposition

Auto Prediction has two AI layers. Internal Agents perform bounded research
inside the control plane. External Agents and humans operate the product from
outside it. Studio is the human observability surface; the versioned CLI and
local HTTP control plane are the machine surface. Neither layer should require
an Agent to infer UI labels, scrape rendered text, or reverse-engineer server
routes before it can decide what to do next.

## Observed gap

The 2026-08-20 external-operator audit found that the released `pmh` CLI only
read static venue manifests. It advertised a stale Node 24 runtime target and
did not expose the existing startup-readiness or Agent-workspace projections.
An external Agent could see that a CLI existed but could not use it to discover
the running product, distinguish an offline control plane from startup work, or
obtain bounded routing state.

Grok Build topic session `61394efb-bf73-45af-aac2-a995c46d2585` was retained
for the non-frontend audit and implementation. Its initial read expanded beyond
100k tokens without producing a diff; a broad continuation exhausted its turn
budget. Two later atomic continuations produced the bounded HTTP and CLI diffs
and focused tests. This is operational evidence for topic-session reuse with
strict per-turn scope: long-lived external operator sessions need proactive
context budgets, and Git state remains the acceptance boundary.

## Selected direction

Build the external surface as a progression of versioned, bounded affordances:

1. **Discover and diagnose.** A zero-context Agent can ask the CLI for its exact
   command catalog, inspect control-plane readiness, and read a compact Agent
   routing workspace. Connection, timeout, HTTP, and schema failures retain
   stable codes plus valid recovery commands.
2. **Inspect exact work.** Add bounded commands for a selected task, campaign,
   run, finding, or market evidence object. Compact listings must retain exact
   identities needed for the next read rather than dumping whole projections.
3. **Preview before mutation.** Every state-changing research command first
   returns an exact preview and required authorization/idempotency fields.
4. **Act and resume.** External Agents can create/activate/dispatch/pause
   research campaigns, refresh anonymous catalogs, and resume failed work while
   preserving the no-live-execution boundary.
5. **Measure operator friction.** Retain command failures, retries, payload size,
   time-to-first-valid-action, and context consumed per completed workflow.

The CLI must remain a transport and projection client. It may compact and
validate server state, but it must not reproduce semantic, economic,
qualification, or verification verdict logic.

## Current acceptance evidence

- `pnpm --silent pmh` and `pnpm --silent pmh help` return the versioned command
  catalog without a running control plane.
- `pnpm --silent pmh ...` keeps stdout to one JSON envelope and incrementally
  builds only the CLI dependency graph instead of the whole monorepo.
- `pnpm pmh control status` reads `/api/v1/readiness` and distinguishes READY,
  STARTING, FAILED, unreachable, timeout, malformed JSON, and HTTP failure.
- `pnpm pmh agent workspace` validates the dedicated
  `/api/v1/agent-workspace/routing` projection rather than downloading and
  trimming the multi-megabyte Studio workspace.
- Runtime qualification reduced that read from 5,696,671 bytes in 21.7 seconds
  to 1,828 bytes in 42 milliseconds at the server; the hot CLI path completed
  in about 0.9 seconds with one JSON envelope on stdout.
- Every envelope still declares external writes, value movement, and live
  execution as literal `false`.
- Exact target and task reads are bounded first-party projections. Their CLI
  validators reject identity drift, missing authority fields, and non-zero read
  effects rather than inferring a safe result.
- A runnable task emits its exact compatible profile and preview command;
  historical tasks do not emit invalid actions. Manual preview binds both
  identities while proving zero provider/model/write/run effects and grants no
  execute authority.

## Next implementation frontier

The machine surface can now discover, inspect, and preview exact work but cannot
yet execute and follow a research run to a retained outcome. The next mainline
slice should require a caller-supplied authorization/idempotency reference,
execute only a previously previewed task/profile binding, expose bounded run
inspection and wait/resume commands, and test the whole journey with a fresh
external Agent session under an explicit context budget.
