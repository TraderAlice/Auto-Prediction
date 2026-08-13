# World-state mechanism suitability allocation

Status: implemented and qualified on the live research corpus

Issue: [#168](https://github.com/luokerenx4/my-little-pony/issues/168)

Branch: `codex/mechanism-suitability-allocation`

## Evidence changing the plan

The dedicated role correctly removes ontology normalization as a terminal
shortcut, but all 64 current ontology inputs are initially eligible and the
campaign takes the first eight by priority and identity. Inspection of the
live exact evidence shows materially different research value:

- named-subject transitions such as an approval event versus a later award;
- nested sports outcomes such as one match versus a season championship;
- same-instrument crypto intervals that are better handled as time/payoff
  relations than latent world-state mechanisms;
- settlement-only pairs and generic first-name collisions with no reliable
  common subject;
- repeated subject families that could consume a whole campaign.

Eligibility therefore cannot mean only “no retained result for this exact
revision.” The machine needs provider-free structural suitability before it
spends Agent attention.

## Decision

Compile an explainable allocation projection from exact ontology evidence.
Suitability is a bounded vector, not causal truth or a learned scalar reward:

- subject coherence and specificity;
- predicate divergence;
- temporal ordering potential;
- distinct-role evidence breadth;
- weak-collision, same-event and settlement-only hazards;
- diversity debt against already selected subjects and relation patterns.

Each assignment receives an explicit disposition:

- `SELECTED_FOR_MECHANISM_RESEARCH`;
- `HELD_LOW_STRUCTURAL_SUITABILITY`;
- `HELD_PORTFOLIO_REDUNDANCY`;
- `COVERED_BY_EXACT_RESULT`.

Campaign membership must bind the allocation identity and exact source
revision. A read may rank and explain; it cannot create, activate, or dispatch
a campaign.

## Phase 1 — suitability facts

- [x] Derive first-party features only from retained trailheads and listing
  facets; do not ask a model to score its own inputs.
- [x] Fail closed on generic subject signals, missing predicate divergence,
  same-event interval patterns and settlement-only differences.
- [x] Keep unusual but coherent pairs visible as held or selected evidence
  rather than deleting them from the ontology ecology.

## Phase 2 — bounded portfolio

- [x] Select at most eight exact revisions with caps per canonical subject and
  relation pattern.
- [x] Preserve lane diversity only when a lane contains structurally suitable
  candidates; do not reserve quota for noise.
- [x] Bind campaign selection to one immutable allocation projection.

## Phase 3 — observability and qualification

- [x] Surface eligible → suitable → selected → attempted → result funnel and
  top hold reasons in Agent Operations.
- [x] Compare the selected live titles with the prior identity-ordered eight.
- [x] Qualify replay, zero-provider reads and desktop layout before any
  campaign activation.

## Qualification evidence

The live 2026-08-13 corpus changed the implementation twice before selection:

- the identity-ordered baseline selected eight from 64 unexplored inputs with
  no suitability evidence;
- an early structural pass still admitted cross-asset `up or down` contracts,
  same-asset interval variants, and repeated sports families;
- the qualified pass holds contract-role-only shared signals, same-event
  intervals, parallel outcome alternatives, aggregate titles, and weak
  single-name collisions; it also caps each predicate-family pattern at two;
- the current funnel is 64 eligible → 24 structurally suitable → 5 selected;
  the selected portfolio contains two sports event-to-championship relations,
  two local-election-to-national-composition relations, and one approval-to-
  award relation. The policy deliberately leaves three of eight budget slots
  empty rather than manufacture throughput.

Exact replay is permutation invariant. The campaign selection identity is the
allocation projection identity and each task binding names its allocation
action plus exact ontology issue revision. Projection and campaign-preview
reads started zero providers, model invocations, campaigns and runs. Focused
control-plane, server, Studio tests and the production Studio build passed; the
live Agent Operations view rendered the funnel without horizontal overflow at
1280 px. The responsive card primitives were unchanged from the separately
qualified 390 px mechanism-role surface.

## Non-goals

- deciding that a mechanism is true before Agent research;
- converting a structural score into probability or expected value;
- topic allowlists or handpicked celebrity/politics preferences;
- automatic campaign creation, activation, dispatch, or trading.
