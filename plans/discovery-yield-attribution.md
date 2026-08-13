# Discovery yield attribution and policy evidence

Status: qualified; pending serial mainline integration

Created: 2026-08-13

Branch: `codex/discovery-yield-attribution`

Issue: [#152](https://github.com/luokerenx4/my-little-pony/issues/152)

## North-star role

The AI-native machine can now retain why attention was allocated, observe the
current result, wake persistently, and interrupt the operator only on meaningful
state transitions. It still cannot compare search strategies honestly. Current
decision outcomes are recomputed views from an immutable baseline to the latest
ledger state. If two decisions for one stable work family overlap, summing those
views double-counts both cost and downstream artifacts. A later finding can also
appear new relative to several old baselines.

The next product object is therefore not a scalar reward or a prettier chart. It
is an append-only, non-overlapping observational window that says which bounded
decision owned which interval of Agent attention, what was retained at the end
of that interval, and whether cost and yield are comparable.

## Ontology decision

A discovery-yield sample has five distinct objects:

1. **Decision episode** — the immutable allocation premise, exact target and
   baseline already retained by `pmh.research-decision-episode.v2`.
2. **Outcome observation** — one append-only snapshot of the first-party outcome
   resolver at an exact research-state transition. It records observation, not
   causal truth.
3. **Decision window** — the half-open interval from the episode baseline until
   a same-family successor takes over, or the latest terminal observation when
   no successor exists. Windows for one stable work family must not overlap.
4. **Yield vector** — typed positive findings, counterexamples, no-yield memory,
   review/probability artifacts, evidence-stage movement, token cost and wall
   time. Useful negative memory remains distinct from positive discovery.
5. **Policy stratum** — exact policy identity × lane × action kind × novelty
   reason × downstream system. Different runtimes are compared only through
   work whose cost lineage belongs to that downstream system; historical Rule
   Evidence failures cannot be charged to relation discovery.

No first-party scalar will collapse these dimensions. The product may show
separate rates per 100,000 known tokens, but it may not decide that one
counterexample equals one finding or mutate lane budgets automatically.

## Comparability contract

- `UNACTED_READY` and `IN_FLIGHT` are exposure/liveness evidence, not terminal
  yield samples.
- `ATTRIBUTION_INCOMPLETE` is retained but excluded from token-normalized rates.
- `REGRESSED_OR_RESCOPED` closes a window only when a same-family successor has
  an exact baseline at the handoff boundary; otherwise it remains incomparable.
- A successor episode closes the prior same-family window before its own
  baseline starts. Cost and artifact deltas may therefore be summed across
  closed windows without overlap.
- An artifact receives observational credit in at most one window. This is
  exclusive accounting, not a causal claim.
- A stratum needs at least three comparable terminal windows before its rate is
  marked qualified. Sparse strata remain visible and must not steer policy.
- All token and wall-time aggregation uses `bigint`; normalized rates are fixed-
  point decimal strings with an explicit scale, never JavaScript `number`.

## Phase 1 — append-only outcome observations

- [x] Extend the outcome vector with typed deltas for retained runs, positive findings,
  counterexamples, semantic reviews, probability jobs and exact target
  artifacts instead of asking consumers to infer kinds from a hash set.
- [x] Define a content-addressed `pmh.research-decision-outcome-observation.v1`
  that embeds one validated outcome plus the research-state transition that
  caused observation.
- [x] Persist observations idempotently in SQLite schema 49 and replay them with
  exact record hashes. Capture starts no provider, model, fetch, run or dispatch.
- [x] Observe after startup reconciliation, Agent completion, catalog-driven
  rescope and same-family successor capture; unchanged outcome identity is a
  no-op.

## Phase 2 — exclusive decision windows

- [x] Derive one current window per decision episode and order same-family
  episodes by capture time plus content identity.
- [x] Close the predecessor at the exact successor baseline and prove adjacent
  windows neither overlap nor leave an invented cost interval.
- [x] Assign each typed artifact to the latest eligible predecessor window once;
  retain shared-lineage diagnostics rather than duplicating credit.
- [x] Fail closed when timestamps, usage completeness or retained lineage cannot
  establish a comparable boundary.

## Phase 3 — provider-free yield strata

- [x] Aggregate selected, acted, in-flight, terminal, comparable and incomplete
  window counts by exact policy stratum.
- [x] Preserve positive findings, useful negative memory, stage movement and
  spent-without-movement as separate numerators.
- [x] Sum direct known input/output/reasoning tokens and wall time without mixing
  unrelated runtimes or downstream systems.
- [x] Emit separate fixed-point rates per 100,000 known tokens only when the
  denominator is complete and the three-terminal-window evidence minimum is met.
- [x] Keep `policyMutationAuthority=false`; changing lane caps requires a new
  versioned policy decision and explicit operator adoption.

## Phase 4 — API and Studio

- [x] Add the bounded yield projection to the Agent workspace read model without
  reintroducing the monolithic Studio projection.
- [x] Render `observation → allocation → membership → run → outcome` as a compact
  research funnel with exact counts and attributable cost.
- [x] Show strata as a vector comparison, including why a row is unqualified or
  incomparable; do not rank sparse rows with a synthetic score.
- [x] Keep the discovery-signal inbox as the interruption surface and the yield
  view as reflective policy evidence. Reading either remains effect-free.

## Phase 5 — qualification

- [x] Prove synthetic overlapping episodes no longer double-count one finding or
  one token interval.
- [x] Prove Rule Evidence history cannot enter relation-discovery strata.
- [x] Restart SQLite and reproduce observation, window and stratum identities.
- [x] Qualify the live 1.1 GB ledger and state the actual sample insufficiency
  rather than fabricating a strategy winner.
- [x] Pass full checks/tests/build plus desktop and 390 px Studio QA.

## Qualification evidence

SQLite schema 49 now retains a linear append-only observation chain and rejects
stale predecessors. The synthetic qualification proves adjacent same-family
windows close on the exact successor baseline, sum 60,000 + 40,000 attributable
tokens without overlap, and credit each finding once. Three complete relation-
discovery terminals qualify their own vector rate while a Rule Evidence sample
remains in a separate sparse stratum. An open allocation remains visible but is
not allowed to contaminate the completed cost denominator.

The retained 1.1 GB development ledger currently contains one novelty-bound
episode, one campaign-bound observation, zero retained runs after that baseline,
zero terminal windows and one represented but unqualified relation-discovery
stratum. The projection therefore publishes no rate and names the sample
insufficiency instead of inventing a winner. A full process restart reproduces
the same observation, window, stratum and projection identities. While schema
49 was still branch-local, its single reproducible observation was repaired as
the explicit successor boundary and typed run delta entered the final contract;
no external evidence or Agent work was deleted.

Desktop and 390 px Studio qualification pass without horizontal overflow or
application console errors. Full workspace checks, 95 control-plane test files
with 653 tests, five Studio test files with 30 tests, and the production build
pass. The only retained warnings are the known Node 24 engine expectation on the
available Node 22 host and the existing Studio bundle-size warning.

## Selection signal

Adopt this continuation if the system can explain the complete denominator and
exclusive lineage behind every displayed yield rate. Rework it if observations
are durable but windows still overlap. Abandon any scalar policy score that
cannot show which typed evidence and exact cost interval produced it.
