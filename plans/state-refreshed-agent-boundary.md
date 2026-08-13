# State-refreshed Agent boundary

Issue: https://github.com/luokerenx4/my-little-pony/issues/247

## Decision context

Closed mutation PR #246 falsified the premise that a static app-server tool
manifest can be made state-scoped through recovery prompts and composed JSON
Schema. Terra called an action before context, repeated a retired read, and
sampled only three `allOf/oneOf` branch fields while omitting six root-required
fields. The failed specimen spent 173,562 input tokens across eight
invocations.

Codex app-server exposes `dynamicTools` at `thread/start`, not `turn/start`.
True capability narrowing therefore requires a new Agent boundary whenever
the first-party host changes legal state.

## Architecture

1. Extend `AgentToolHost` with an optional current-manifest contract. Existing
   hosts remain static and behavior-compatible.
2. Extend `AgentRuntimeSession` with an optional manifest-refresh operation
   that receives the next exact manifest plus a bounded provider-neutral
   transcript checkpoint.
3. In the generic execution loop, recompute the manifest after accepted effects.
   When its content identity changes, first settle pending results, then ask the
   runtime to rotate before the next model invocation.
4. In Codex app-server, close the old connection and ephemeral workspace after
   the response is settled. Open a fresh connection/thread with only the new
   tools. Prompt it with immutable task identity, current first-party state and
   bounded exact prior calls/results; never replay free-form reasoning.
5. Give mechanism exploration explicit legal manifests for context, hypothesis,
   evidence collection, active outcome, closure and terminal states. Use simple
   schemas per state; no composed test/family branch schema.
6. Carry forward the validated host-bound symmetric prototype-outcome design:
   the model supplies only `SUPPORTED` or `FAILED`; the host resolves the active
   exact test.

## Invariants

- A tool removed after an accepted transition cannot be called in a later
  invocation because it is absent from the next thread.
- A pending dynamic tool call is answered exactly once before rotation.
- Transcript checkpoints are bounded, exact, untrusted data and contain no
  provider reasoning or secret material.
- Invocation/effect/hypothesis lineage remains one logical Agent run across
  physical app-server threads.
- Hosts that do not opt in retain the current static-session behavior.
- No semantic, probability, scheduling, certificate, external-write,
  execution, trading or value-moving authority is added.

## Verification

- adapter tests prove unchanged static-host behavior and refresh identity
  validation;
- app-server tests prove response settlement precedes close and the replacement
  `thread/start` receives only the new manifest;
- mechanism exploration tests prove exact legal tool names at each state and
  symmetric transfer/counter supported/failed outcomes;
- restart tests prove exact durable lineage across a multi-thread logical run;
- full control-plane and Studio qualification pass;
- a matched Terra/high specimen has zero structural rejections, no retired-tool
  repeats, a grounded terminal, and token accounting comparable to the failed
  173,562-input V12 run.

## Status

Selected `ADOPT`.

The implementation adds an opt-in manifest-refresh policy to the generic Agent
host/runtime boundary. After an accepted state-changing effect, Codex
app-server settles that call, closes its ephemeral connection/workspace, and
starts the next thread with only the newly legal tools plus a bounded
provider-neutral host checkpoint. Static hosts retain their prior behavior.

Terra/high run
`sha256:d972000e325cc5027d39b71b793ca44b33f366b397578ed220d01b950a95851f`
completed on execution profile revision 17 with 11 successful invocations, 11
accepted effects and zero rejected effects. It tested and rejected a national
Senate-control dependent, separately supported the exact state-seat component,
then retained a source-bound exhaustion over two exact role searches and five
inspected Polymarket US listings. The run used 237,918 input, 3,648 output and
1,386 reasoning tokens.

This exceeds the failed static specimen's 173,562 total input because the
adopted specimen completed 11 useful calls rather than failing after eight.
Per-invocation input stayed bounded between 17,673 and 23,338 tokens, including
after two searches and two hypothesis lifecycles. Selection therefore adopts
the state/authority boundary, not a claim of lower aggregate model cost.

Full qualification passed: 108 control-plane test files / 746 tests, 5 Studio
test files / 30 tests, and both production builds. The remaining Node 22 versus
repository Node 24 engine warning and Studio chunk-size warning are unchanged
environment/build debts rather than failures of this mutation.
