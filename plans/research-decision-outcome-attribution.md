# Durable research-decision outcomes

Status: active mainline construction

Issue: [#108](https://github.com/luokerenx4/my-little-pony/issues/108)

Branch: `codex/research-decision-outcomes`

## North-star role

The system can now select a bounded research action and resolve it to an exact
downstream target. It still cannot learn whether that allocation was useful.
Every read reconstructs the present, but no durable object says what was known
when attention was assigned, whether the target was ever acted on, what new
evidence appeared afterward, or how much incremental AI/fetch cost accompanied
that movement.

An AI-native arbitrage machine needs memory at the decision boundary. Without
it, an allocator can repeatedly optimize from current state but cannot compare
its expectations with realized research yield.

## Ontology decision

A research decision episode is a content-addressed historical relation among:

- one exact attention allocation action and its policy/projection identity;
- one exact downstream action target and its ready/blocked state;
- the stable work family and proposal/requirement/task lineage known then;
- a bounded baseline of evidence stage, artifact identities, and cumulative
  provider/model/tool/fetch/token/wall-clock cost;
- an explicit capture time and operator or first-party trigger identity.

The episode does not claim that later artifacts were caused by the decision.
An outcome observation states which retained artifacts are downstream of the
same exact lineage and appeared after the baseline. Causal strength is explicit:
`NOT_ACTED`, `TARGET_LINEAGE_OBSERVED`, or `DISPATCH_LINKED`. The first slice
must not infer dispatch linkage from temporal proximity.

The episode is append-only. A later outcome projection may change as evidence
arrives, while the recorded baseline and decision identity never change.

## Outcome vocabulary

Each current outcome distinguishes:

- `UNACTED_READY`: the selected target remains ready and no new exact-lineage
  artifact or cost is observed;
- `USEFUL_NEGATIVE_MEMORY`: the decision retained a terminal negative target
  that prevents duplicate spend;
- `IN_FLIGHT`: the named downstream job is actively moving;
- `ADVANCED`: the exact lineage moved to a later evidence stage;
- `SPENT_WITHOUT_MOVEMENT`: cumulative attributable cost increased without
  advancing the evidence stage;
- `REGRESSED_OR_RESCOPED`: current target identity or structured requirement
  changed and the old decision can no longer be evaluated as the same action;
- `TERMINAL_HOLD`: the target remains boundedly blocked without new spend;
- `ATTRIBUTION_INCOMPLETE`: retained lineage or usage is insufficient for an
  honest comparison.

Stage movement is a vector, not a single reward: attempted relation research,
positive finding, counterexample, independent semantic review, structured
evidence requirement, evidence capture, interpreted claim, probability case,
economic inspection, exact certification, and shadow observation remain
separate dimensions. Negative evidence is productive when it closes a loop or
prevents duplicate work, even when it does not advance toward certification.

## Phase 1 — bounded episode contract and SQLite ledger

- Define a strict v1 episode with exact allocation/action/target lineage,
  immutable baseline, effect counters fixed at zero, and content hash.
- Capture only an action currently present in the exact target projection;
  reject stale/mismatched allocation and target identities.
- Persist episodes idempotently in additive SQLite schema v41 with bounded
  chronological reads and byte-for-byte canonical validation on replay.
- Capturing an episode is a local research-ledger write only. It starts no
  provider/model/fetch/campaign/run/scheduler work.

## Phase 2 — provider-free realized-outcome resolver

- Resolve each retained episode against the same durable stores used by the
  allocator and target compiler, never compact Studio windows.
- Compare exact target state, artifact-set additions, value-stage movement,
  and cumulative attributable cost against the baseline.
- Preserve unknown token/wall-clock fields as incomplete; never coerce them to
  zero or mix unrelated family-wide spend into a proposal-local claim.
- Separate negative-memory value from positive evidence progress and expose
  attribution confidence/basis explicitly.

## Phase 3 — API and Studio learning surface

- Add an explicit `POST` capture endpoint and a read-only outcome endpoint.
- Put a `Record decision` control only on exact current targets. It must not be
  visually or behaviorally confused with `Run`, `Dispatch`, or `Activate`.
- Show baseline, current posture, stage delta, cost delta, new artifact count,
  attribution basis, and the named reason an episode is useful or unresolved.
- Reads retain zero effects; repeated capture of the same decision is
  idempotent and does not fabricate a new sample.

## Phase 4 — live qualification

- Capture the current provider-neutral exploration target as an unacted-ready
  baseline. If corpus/task identity rotates, retain the episode and report an
  exact rescope rather than pretending the selected task survived.
- Capture the LAFC negative-source target and show useful negative memory with
  four provider requests and three tool calls already retained, no new spend,
  and no manual operation.
- Restart SQLite and reproduce both episodes. Outcome identity may change only
  when the current exact-lineage observation changes.
- Repeated outcome reads leave Agent, provider, fetch, campaign, scheduler, and
  value ledgers unchanged.

## Qualification gates

- [x] stale allocation/action/target combinations are rejected;
- [x] episode identity and baseline replay exactly across SQLite restart;
- [x] capture is idempotent and bounded;
- [x] GET outcomes perform zero writes and start zero external effects;
- [x] unknown usage remains explicit and prevents false efficiency claims;
- [x] same-lineage movement is distinguished from temporal coincidence;
- [x] negative memory can be useful without becoming positive opportunity
  yield;
- [x] incremental spend without stage movement is visible;
- [x] Studio labels record-decision as a local baseline, separate from dispatch
  authority;
- [x] live exploration and LAFC episodes survive restart; an exact task
  rotation is reported as rescope rather than erased;
- [x] desktop and 390 px Studio checks have no overflow or application console
  errors;
- [x] full workspace checks, tests, and build pass.

## Selection boundary

This slice does not change lane budgets, rank families from a learned scalar,
or automatically dispatch a target. Policy learning becomes meaningful only
after multiple honest episodes cover different families and outcomes. Until
then, the ledger exposes comparable evidence for a later versioned-policy
decision; it does not pretend two specimens constitute an optimizer.

## Non-goals

- live trading, credentials, orders, signatures, or funds;
- automatic Agent recurrence;
- inferred causal credit from timestamps alone;
- currency cost before provider pricing is qualified;
- one scalar reward that conflates negative evidence and opportunity progress;
- rewriting old decisions when ontology, policy, or target state changes.

## Live checkpoint — 2026-08-12

Two explicit local captures created two SQLite v41 episodes and started zero
provider requests, model invocations, fetches, campaigns, runs, or scheduler
dispatches. The exploration target initially resolved to `UNACTED_READY`. The
LAFC resolution-rule target resolved to `USEFUL_NEGATIVE_MEMORY`: its baseline
retains the prior four provider requests and three tool calls, while subsequent
cost delta is exactly zero.

Before and after capture remained 250 tasks, 241 runs, 498 model invocations,
20 campaigns, and 2,068,225 / 19,328 / 4,904 retained
input/output/reasoning tokens. Repeated outcome reads report zero writes and
zero external effects.

Restart evidence changed one qualification assumption. Both immutable episodes
replayed exactly, but startup materialized a successor relation-discovery task
from a new corpus identity. The stable exploration family remained
`UNATTEMPTED`, while its exact source task no longer matched the captured
target. The resolver correctly changed that outcome to
`REGRESSED_OR_RESCOPED`; LAFC's exact requirement/source lineage did not rotate
and remained `USEFUL_NEGATIVE_MEMORY`. Episode persistence, family continuity,
and task continuity are therefore three distinct facts. Outcome identity is a
content hash of the current comparison and is expected to change when one of
those facts changes.

Studio renders both outcome postures beside their exact target. `Record
decision` is labelled as a local baseline that does not run or dispatch an
Agent. Desktop and 390 px inspection found no application console errors or
horizontal overflow; mobile cards measured 322 px inside a 390 px document.
Workspace check, all suites (84 control-plane files / 586 tests and four Studio
files / 24 tests), and production build pass. The known Node 24 engine
expectation and existing Studio chunk-size warning remain non-blocking.
