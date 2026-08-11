# Probability-estimation evidence debt

Status: implemented; live qualified, external-source selection remains active

Created: 2026-08-10

## Product problem

The first retained LAFC probability case now reaches three independent
Terra/high estimators after catalog rotation. All three honestly abstain, but
the durable run records preserve only a compact rationale. Their actionable
requests—complete Gemini settlement treatment, historical resolution outcomes,
postponement/cancellation reference classes, and causal base-rate parameters—do
not become schedulable work.

That is a broken Agent loop. An AI-native arbitrage machine must treat “I cannot
bound this relation until I learn X” as a typed effect, not terminal prose. The
effect must survive restart, deduplicate across roles, use existing official
evidence routes where possible, and remain visible when no approved external
source family exists yet.

## Decision

- Add `request_probability_evidence` as a first-class tool in the probability
  estimator loop. A request names a bounded evidence kind, exact listing and
  adverse-state scope, the question being resolved, why it affects the bound,
  and observations that would satisfy or contradict it.
- `abstain_probability_estimate` references accepted evidence-need identities
  instead of duplicating free-form `missingEvidence`. An Agent may record more
  than one need and may still submit a numeric estimate; non-blocking research
  debt is therefore not erased by a successful run.
- New run records retain content-addressed evidence needs. Historical V1/V2
  records remain readable without inferred needs. The changed tool protocol
  creates a distinct run and scheduler case rather than rewriting the six live
  V2-input runs.
- Contract-bound kinds reuse the existing first-party `EvidenceRequirement`
  compiler with `PROBABILITY_ESTIMATION` origin. This gives official document
  locators and market-data routes to the ordinary acquisition scheduler without
  granting the model fetch authority.
- Reference-class, resolution-history, causal-parameter, and external-anchor
  requests remain explicit research routes. They are not silently converted to
  open web browsing before a source policy is selected.
- Build a deterministic probability evidence-debt projection from durable run
  effects. Equivalent needs merge across roles while retaining every run,
  estimator role, case, and acquisition-requirement identity.
- Surface the queue through the control-plane API and Failure Budgets Studio
  view. Terminal abstention is no longer a dead end: it points to the exact
  evidence work that can reopen estimation.

## Lifecycle and authority

1. The estimator records at least one adverse counter-scenario.
2. It records zero or more structured evidence needs through a tool.
3. It submits an estimate, or abstains by referencing one or more accepted
   blocking need identities.
4. First-party code validates all listing/state scope and builds any compatible
   acquisition requirement from the exact retained listings.
5. SQLite persists the run and effects. Projection groups needs by semantic
   identity and reports `ACQUISITION_READY`, `EXTERNAL_SOURCE_POLICY_REQUIRED`,
   or a later satisfied posture.
6. Acquisition or external research may produce new evidence, but rerunning an
   estimator is always a new attributable case generation. Evidence debt itself
   has no semantic, certificate, simulation, execution, or value-moving
   authority.

## Qualification

- Tool tests reject invented listing refs, impossible/non-adverse state IDs,
  unbounded text, unknown need IDs, and abstention without a recorded need.
- New run artifacts replay through SQLite with exact need and acquisition
  identities; V1/V2 records retain their original artifact and run identities.
- Role wording is grouped by constraint, evidence kind, exact contract/state
  scope, temporal posture, and route. Every original need/question remains
  retained as a variant; materially different work scopes remain distinct.
- Contract-rule requests enter the ordinary acquisition reconcile, while
  reference-class requests remain visibly policy-gated and do not fetch.
- The retained LAFC case creates structured debt for the actual live gaps, or
  honestly demonstrates that the current model cannot use the richer tool
  contract. No numeric bound may be fabricated to satisfy the qualification.
- Studio and the read-only API distinguish in-flight estimation, model
  abstention, evidence acquisition, and external-source-policy debt.
- Workspace checks, focused tests, production build, live API inspection, and
  `git diff --check` pass.

## Qualified result

- The live V3 tool protocol produced 15 blocking needs across three Terra/high
  roles with zero failures or retries. Deterministic work-scope grouping reduced
  wording variants to nine actionable debt items without deleting a raw need.
- Five groups are official contract/rule debt. They compiled into eight
  `PROBABILITY_ESTIMATION` acquisition requirements and entered the existing
  scheduler as explicit `UNSUPPORTED` routes because the retained Gemini
  listing exposes no qualifying document locator.
- Four groups cover resolution history, reference classes, causal parameters,
  and external anchors. They remain `EXTERNAL_SOURCE_POLICY_REQUIRED` and
  started no fetch or provider request.
- Failure Budgets now shows 3 terminal estimator-abstention cases, 1 legacy
  evidence-blocked case, and a nine-item research queue. Desktop 1265 px and
  mobile 390 px checks preserve a 12 px text floor, zero horizontal overflow,
  and zero console warnings/errors.
- Full workspace qualification passes: all 470 control-plane tests, all 17
  Studio tests, every package type check, the production Studio build, and
  `git diff --check`. The host used Node 22.22.1 and emitted the repository's
  expected Node 24 engine warning; no qualification failure resulted.
