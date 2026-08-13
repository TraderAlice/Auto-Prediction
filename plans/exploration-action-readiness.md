# First-party exploration action readiness

Status: active mainline construction

Issue: [#221](https://github.com/luokerenx4/my-little-pony/issues/221)

## Product question

How should an AI-native semantic explorer know what its own experiment has
made admissible? The adopted V7 run reached a correct bounded exhaustion, but
it first attempted that terminal without a failed transfer test and then
without an exact search. Both calls failed closed. The Agent was choosing its
own route, yet the first-party host exposed its state machine only through
errors.

The same specimen also revealed an attribution defect. Once one result tool
was rejected, the generic runtime labelled every later invocation
`RESULT_REPAIR`, including productive search and inspection continuations.
Repair is an episode, not a permanent run mode: after the Agent accepts a
nonterminal tool result that advances first-party state, the next turn is an
ordinary tool continuation unless another result is rejected.

## Decision

Expose a compact, provider-free readiness projection on every exploration tool
result. It describes accumulated search, inspection and exact prototype-test
actions; separately states whether positive and exhaustion terminals are
currently eligible; and names unmet prerequisites. It must not prescribe a
query, candidate or conclusion. This is introspection over the Agent's own
experiment, not a claim-first workflow.

Return the same readiness projection with terminal precondition rejections so
one failed attempt is sufficient to repair. Start a successor V8 tool protocol
because the model-visible result contract changes. Preserve V1-V7 lineage for
read-only historical evidence without dispatching it.

End a generic result-repair episode after an accepted non-result tool effect.
The immediate turn responding to a rejected result remains `RESULT_REPAIR`;
subsequent productive turns return to `TOOL_CONTINUATION`. This changes
attribution only and cannot grant result authority.

## Phase 1 — readiness algebra

- [x] Define and validate a compact exact action-readiness projection.
- [x] Derive positive eligibility from a prior role pair, inspection and an
  applied transfer-test action.
- [x] Derive exhaustion eligibility from exact search, inspection and a failed
  transfer-test action.
- [x] Attach readiness after every accepted exploration effect and terminal
  precondition rejection.
- [x] Keep missing prerequisites descriptive and query-agnostic.

## Phase 2 — runtime attribution and protocol lineage

- [x] End result-repair attribution after one accepted non-result action.
- [x] Prove repeated rejection re-enters repair and accepted results still
  terminate immediately.
- [x] Advance exploration to V8 and execution revision 10 without historical
  dispatch shims.

## Phase 3 — qualification and selection

- [x] Pass provider-free exploration, adapter, full control-plane and Studio
  checks.
- [x] Show repair burden beside the exact search/action experiment funnel in
  Studio, without presenting it as semantic confidence.
- [x] Run one eligible Terra/high specimen and compare rejected-terminal count,
  repair share and token cost with the 10-call / 264,109-token V7 baseline.
- [x] End with `ADOPT`.

## Live selection

V8 run
`sha256:1821445c1eb1594af98935d103bcbdf03e6252d2a619d560881e24891a05e5d0`
selected `ADOPT`. Terra/high completed in 134 seconds with six successful
invocations and six accepted tool effects. It spent 138,071 input, 1,172
output and 508 reasoning tokens (139,751 total), versus the V7 baseline's ten
invocations, 264,109 total tokens and two rejected terminal attempts. V8 had
zero rejected effects and zero result-repair invocations.

Readiness did not prescribe the exploration. The Agent independently tried a
narrow Formula 1 component/constructors neighborhood, then expanded to a
cross-venue election/game/match versus championship/playoff/control
neighborhood. It inspected exact Myriad constructors evidence, marked transfer
test 4 failed, and retained bounded exhaustion
`sha256:d5634ac5fc5b97e12336df3eef0d4c0306fbe875b1488fa3b1b9ef71f2abc73f`.
The two role searches produced no distinct component/aggregate pair; the
terminal preserved both exact search summaries and one durable action.

The result is not proof that every future lens will save 47% of input tokens;
the axes differ. It is direct evidence that the first-party state contract can
remove prerequisite-guessing without reducing search variation. Studio now
shows repair calls and repair input beside the search/action funnel. Browser
inspection confirmed the metric wraps to two readable lines at the live
desktop viewport, and the page emitted no console errors.

## Selection gates

- Readiness is computed without a model call or external write.
- It contains only exact host-observed state and deterministic prerequisites.
- It cannot assert that a pair instantiates the prototype or that exhaustion is
  semantically true.
- A readiness flag cannot bypass the existing terminal verifier.
- Repair attribution cannot change execution, result or value-moving authority.

## Non-goals

- prescribing a fixed search query or claim;
- turning prerequisite completion into semantic confidence;
- automatically submitting a terminal when readiness becomes eligible;
- changing trading authority, credentials or live execution policy.
