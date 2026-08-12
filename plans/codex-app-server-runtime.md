# Codex app-server Agent runtime

Status: qualification complete; retire after merge

Issue: [#98](https://github.com/luokerenx4/my-little-pony/issues/98)

Branch: `codex/app-server-agent-runtime`

## Decision

Adopt Codex app-server as the primary Codex OAuth-backed runtime candidate.
Do not treat the OAuth credential as a generic Responses API key and do not ask
the model to serialize fake tool calls as free text.

Runtime, credential, model plus model-owned effort, workload route, task, run,
and campaign remain separate substrate objects. App-server owns the Codex
conversation and login lifecycle. PMH owns task evidence, dynamic tool
definitions, tool execution, effect retention, budgets, and all semantic,
probability, certificate, and execution authority.

## Evidence

The installed Codex CLI 0.147.0 generates an experimental v2 app-server schema
with `thread/start`, `turn/start`, per-turn model and effort selection,
client-hosted dynamic tools, token usage notifications, and account reads. A
zero-inference local `initialize -> account/read` probe recognized the current
ChatGPT login. This differs from the rejected direct backend probe because the
official app-server, rather than PMH, owns the Codex transport identity and
credential refresh behavior.

Official OpenAI web documentation currently confirms the product surface only
at a high level. The generated schema from the installed binary is therefore
the pinned integration contract. Its CLI version must be retained with every
runtime definition and capability observation.

The live model inventory returned seven models and explicitly exposed
`gpt-5.6-terra` with low, medium, high, xhigh, max, and ultra reasoning effort.
The first API preflight retained `CODEX_APP_SERVER_ACCOUNT / USABLE / ELIGIBLE`
with zero inference requests and zero model invocations.

Three bounded runtime observations then qualified the event contract:

- a Terra/high run completed in 57 seconds with seven measured model
  boundaries, six native tool effects, two rejected calls followed by repair,
  and two durable unreviewed world-proposition proposals;
- an experimental attempt to wait for `rawResponse/completed` before returning
  a dynamic tool result deadlocked at the intended authority boundary and was
  explicitly terminated; its failed run and exact first-response usage remain
  negative evidence;
- the corrected contract releases a dynamic tool request on the following
  `thread/tokenUsage/updated` notification and waits for the final notification
  after `turn/completed`; a 29-second follow-up retained two model invocations,
  zero unknown token fields, one accepted evidence read, and an honest no-
  proposal completion.

`tokenUsage.last` describes the most recent underlying model response. Input
growth across a long loop is therefore paid context replay, not a cumulative
counter to de-duplicate. Each notification becomes one immutable invocation.

## Runtime contract

1. Spawn `codex app-server --stdio` with a bounded output buffer and deadline.
2. Negotiate experimental v2 methods through `initialize` and `initialized`.
3. Start an ephemeral thread in an isolated temporary directory with read-only
   sandbox, no approval escalation, no environments, and no provider fallback.
4. Register only the first-party task tool manifest as dynamic tools.
5. Submit the evidence-bound task payload as untrusted data in one turn.
6. Map each `item/tool/call` server request to the existing provider-neutral
   long-loop tool call and return the first-party accepted/rejected result on
   the same app-server request.
7. Fail the run if Codex starts a shell, file change, MCP, web, image, subagent,
   or other undeclared runtime effect. Read-only sandbox remains defense in
   depth, not the authority boundary.
8. Convert app-server token notifications into immutable model invocation
   usage. A dynamic tool call is released to the host after its corresponding
   `thread/tokenUsage/updated`; a completed turn waits for the same boundary so
   final usage is not lost. Retain free-text completion only as a non-
   authoritative runtime artifact.
9. Interrupt the turn and terminate the process on cancellation, timeout,
   output overflow, malformed JSONL, identity drift, or budget exhaustion.
10. Delete the isolated runtime directory after every terminal outcome.

## Capability and routing

The zero-inference preflight for an app-server runtime must use its own
`initialize -> account/read` path. A successful account read proves only that
the runtime and credential are usable together; it does not spend model tokens
or prove that a particular model has capacity. Retain that distinction in the
capability observation.

The default portfolio should expose Terra/high ontology profiles for Codex
app-server and Pi separately, while keeping the same Codex OAuth credential and
model profile. The ontology workload route selects Codex app-server first. A
campaign may create a run only after a fresh usable preflight.

Execution profile and route keys changed with the runtime contract rather than
overwriting same-revision SQLite rows. Old direct-Codex records remain historical
evidence. Ontology campaigns select stable issue lineage and do not retry the
same issue merely because a newer ontology snapshot changes its task ID.

## Qualification gates

- [x] deterministic JSONL transport tests cover correlation, notifications,
  server requests, cancellation, timeout, and output bounds;
- [x] a fake app-server completes a multi-step dynamic-tool loop through the
  generic Agent execution substrate;
- [x] undeclared built-in effects fail closed and produce no accepted PMH tool
  effect;
- [x] the local zero-inference account probe produces a fresh usable capability
  observation;
- [x] ontology task payloads construct their tool hosts by task, not through a
  Rule-Evidence singleton;
- [x] a bounded Terra ontology campaign can be previewed without a provider
  request;
- [x] one explicitly activated live task retains tokens, proposals or
  counterexamples, and a terminal outcome;
- [x] full workspace tests and restart qualification pass (all 19 checked
  projects; control plane 558 tests, Studio 24 tests).

## Non-goals

- exposing shell or filesystem actions as ontology tools;
- treating app-server account readiness as model output quality;
- storing OAuth secret text in SQLite, logs, tasks, or diagnostics;
- automatic recurring spend before the first campaign's proposal and
  opportunity yield are reviewed;
- live orders, credentials for venues, signing, approvals, or value movement.
