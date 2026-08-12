# Standing route seeding portfolio

Status: active mainline qualification — first paused live portfolio retained

Created: 2026-08-13

Branch: `codex/standing-route-seeding-portfolio`

## North-star role

Standing routes turn one expensive Agent insight into a durable semantic sensor,
but the current machine produces them accidentally. The relation Agent owns a
`record_ontology_route` tool while its task contract still asks generically for
payoff relations. The retained portfolio therefore has one legacy-derived
subject route and no native subject, event, or settlement route.

Persistent discovery needs a bounded way to invest in *search hypotheses* as a
portfolio. The product question is not “how many routes can we create?” It is:
which distinct ways of naming the market world are worth paying to observe over
time, and which routes should be retired after cost without novel reviewable
payoff work?

## Measured starting state

- 64 current ontology issues: 60 actionable, four held.
- 40 unattempted evidence-rich actions and 20 bounded ambiguity probes.
- Four attempted ontology issues spent 355,762 known input tokens and produced
  six relation-work items, five runnable neighborhoods, and one negative memory.
- The current relation portfolio has five runnable work items: one entity/subject
  neighborhood, two Lula world-proposition neighborhoods, and two
  settlement-divergence sports neighborhoods.
- The current standing-route portfolio has one legacy `SUBJECT_REFERENCE`
  family, zero native route effects, zero event routes, zero settlement routes,
  zero wakes, and zero retained downstream wake yield.

This means issue supply is not scarce. Intentional, differentiated route
authoring and its selection memory are scarce.

## Ontology position

A route seed is a proposal to spend one bounded Agent run on discovering a
literal, evidence-grounded sensor at exactly one layer:

1. `SUBJECT_REFERENCE`: continuity of a named actor/object across distinct
   predicates;
2. `EVENT_REFERENCE`: continuity of a named real-world occurrence or bounded
   event family across contracts;
3. `SETTLEMENT_REFERENCE`: continuity of the named rule/oracle/settlement
   mechanism across otherwise different traded propositions.

The seed is not the route. First-party selection may identify a promising work
neighborhood and target layer, but only the Agent can propose grounded literal
signals through `record_ontology_route`, and only first-party validation can
compile them. A counterexample or abstention is a valid terminal outcome.

## Phase 1 — provider-free differentiated selection

- [x] Define a content-addressed route-seed candidate over exact current
  relation task revision, work item, target layer, novelty posture, overlap with
  retained route families, and expected evidence fields.
- [x] Select at most one candidate per layer and at most three total.
- [x] Exclude standing-route follow-ups, negative-memory work, already attempted
  exact route-seed intents, and work already covered by an equivalent family.
- [x] Prefer entity-alias work for subject routes, world-proposition work for
  event routes, and settlement-divergence work with retained settlement text for
  settlement routes. Structural fit is routing evidence, not semantic truth.
- [x] Preserve unused capacity when no honest candidate exists.

## Phase 2 — immutable Agent intent

- [x] Extend the provider-neutral relation-discovery task contract with an
  optional first-party route-seeding intent containing target layer, objective,
  exact selection identity, and accepted terminal effect kinds.
- [x] A route-seed task may terminate only with a route at the assigned layer or
  a counterexample/abstention. It cannot silently publish a payoff hypothesis.
- [x] Bind the intent into task identity, campaign selection binding, run input
  annotation, and retained outcome attribution.
- [x] Historical v1-v3 tasks and ordinary relation campaigns remain replayable;
  new ordinary relation campaigns now also bind exact input revisions.

## Phase 3 — bounded campaign and selection evidence

- [x] Build a manual-only paused campaign preview over the selected candidates,
  with concurrency one and explicit aggregate model/token/wall-clock bounds.
- [x] Record candidate → campaign → run → native route/counterexample attribution
  and direct token/wall-clock cost. Existing route lifecycle value retains the
  later route → wake → reviewed payoff-work lineage.
- [x] Never retry the same exact seed intent without material relation input or
  route-portfolio novelty.
- [x] Keep route-seeding separate from ordinary payoff-relation campaigns so one
  purpose cannot consume the other's budget invisibly.

## Phase 4 — operator selection and recurrence gate

- [x] Show selected/held/omitted route seeds alongside existing route lifecycle
  value: authoring cost, quiet time, wake cost, reviewed yield, and overlap.
- [ ] Define `ADOPT`, `HOLD`, and `RETIRE` signals per family. A quiet route is
  not automatically bad; retirement requires a named cost/horizon/overlap rule.
- [x] Recurring route seeding remains unavailable until each layer has at least
  three terminal seed attempts or is explicitly classified as structurally
  unavailable in the retained corpus.

## Qualification gates

- repeated selection over identical state is byte-identical and starts zero
  providers, model invocations, campaigns, runs, or writes;
- at most one candidate per ontology layer and three overall;
- an existing equivalent route suppresses duplicate seeding without deleting
  its source work;
- target-layer mismatch and payoff-hypothesis submission fail closed;
- one counterexample terminal outcome prevents retry on unchanged input;
- all campaign/run/outcome/cost identities survive SQLite restart;
- no route seed, route, wake, or UI action grants semantic, probability,
  certificate, external-write, execution, or value-moving authority.

## Live qualification evidence — 2026-08-13

- The current five-candidate relation portfolio selected one event seed (Lula
  leaving-office proposition, priority 5) and one settlement seed (LAFC MLS Cup
  settlement divergence, priority 3). Subject capacity remained unused because
  the existing Lula subject route family covers the only entity-alias work.
- Preparing the portfolio retained one paused v2 campaign and two V4 tasks.
  Runs remained 244 and model invocations remained 517; only the two explicit
  tasks were added. Repeating the identical request returned 409 and retained
  no duplicate campaign.
- The outcome ledger reports two selected actions, zero acted, zero terminal,
  and zero of three ontology layers qualified for recurrence. Reads start zero
  providers and zero model invocations.
- After restart, the exact V4 revisions, campaign selection binding, and outcome
  episode remained recoverable. During that restart the anonymous catalog's
  semantic research identity changed from `sha256:6a4c…` to `sha256:3960…`, so a
  new selection was correctly eligible. This is material-input novelty, not
  restart-induced identity drift; the earlier selection remains retained.
- Desktop and 390 px Studio checks show the three ontology layers without page
  overflow or console errors. The prepare action is explicitly labelled paused
  and does not activate an Agent.
- The retained Codex app-server capability later projected as `STALE/BLOCKED`
  while reusing its last successful “recognized account” diagnostic. A fresh
  zero-inference `account/read` preflight restored `USABLE/ELIGIBLE`; the
  execution path is healthy, but stale capability needs a first-class
  operator-readable diagnosis or refresh policy instead of an apparently
  contradictory message.
- The first explicitly activated settlement seed produced one native route
  family after the exact host rejected its first ungrounded signal attempt.
  The corrected terminal used eight Codex/Terra model turns, 208,229 known
  input tokens, 1,757 output tokens, and 157,626 ms. A second dispatch exposed
  a substrate bug: `MANUAL_ONLY` campaigns considered a successfully attempted
  task dispatchable again and started run ordinal two instead of the untouched
  event task. The campaign was paused immediately; its duplicate cost remains
  retained as operational evidence. The dispatcher now treats manual-only task
  membership as an exactly-once attempt ledger while preserving recurring
  `INTERVAL` campaign semantics.

## Next evidence target

The portfolio mechanics are qualified, but no seed Agent has yet produced a
terminal native route or counterexample. The next bounded evidence question is
whether event and settlement route authoring produces reusable literal sensors
at acceptable cost. Recurrence stays blocked; operator activation of the
retained paused campaign is the next spend-bearing decision.

## Authority boundary

This plan authorizes provider-free selection, local durable scheduling, and—only
after an explicit campaign activation—bounded model research through the
existing Agent runtime. It does not authorize automatic spend, arbitrary web
access, live orders, credentials beyond existing logical bindings, signatures,
transactions, or funds.
