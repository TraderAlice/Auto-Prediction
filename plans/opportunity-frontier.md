# Opportunity frontier

Status: implemented; runtime and automated gates qualified, in-app visual QA unavailable

Created: 2026-08-10

## Product problem

The live machine has already retained 428 attributable proposals and 247
passed semantic reviews. Current contract prices produce six positive gross
hints, but the primary Finding inbox exposes only lease-level search outcomes.
The economic frontier lives deep inside the Opportunity lifecycle diagnostics,
and the generic eight-item live window currently retains only three of the six
positive candidates because non-settling high-priority records occupy the same
window.

This is a north-star failure: the machine can discover a potentially valuable
relationship without placing it where a human or browser Agent can inspect the
exact proposal and advance it. Adding more search volume would increase the
backlog without increasing opportunity yield.

## Decision

- Treat a current `POSITIVE_GROSS_HINT` as a presentation-priority signal, not
  semantic truth, net profitability, or execution authority.
- The bounded live projection admits positive-gross economic items before other
  retained statuses. Exact totals remain unchanged and the window manifest
  records the active-first selection.
- Finding inbox gains an above-fold Opportunity frontier built from those exact
  economic items. It shows gross basis points, current contract coverage,
  relation, search-issue lineage, and the missing fee/depth qualification.
- Every frontier card hands off the exact proposal ID through the existing
  stable Review route and persisted proposal-local endpoint. It does not infer
  a lease, merge candidates, or submit an operator decision.
- The displayed visible/total count is explicit when the positive set exceeds
  the bounded live window. A later cursor resource can page the remainder
  without widening every Studio projection.

## Authority contract

- Gross hints use existing first-party bigint indicative arithmetic and exact
  current-contract matching. They exclude fees, depth, fillability, and final
  semantic approval.
- Frontier ordering and navigation grant no semantic-decision, simulation,
  certificate, credential, signing, execution, or value-moving authority.
- Missing positive detail is shown as windowed, never interpreted as zero.
- Existing settlement-ineligible and negative findings remain retained in the
  full projection and durable scheduler inputs; they are not suppressed.

## Qualification

- Projection tests prove positive items win the bounded window even when
  higher-priority non-settling items precede them in retained order, while exact
  totals and full history remain unchanged.
- Studio tests cover the visible/total frontier derivation and empty state.
- Live qualification must expose all six current positive hints, including the
  three previously absent proposal IDs, and preserve their exact Review links.
- In-app browser QA covers default and 390 px layouts, review navigation,
  minimum typography, horizontal overflow, and console diagnostics.
- Full workspace checks, tests, and production build pass.

## Follow-on

The frontier is still pre-review economics. The next product slice should join
durable semantic-review disposition and current quote/depth qualification into
a proposal-local decision dossier, rather than asking the operator to correlate
multiple bounded diagnostic windows manually.

## 2026-08-11 identity-first checkpoint

Direct use of Findings exposed a presentation-level duplication failure. The
eight positive items in the bounded view contained only four distinct
relation/contract structures: Atlanta equivalence appeared twice, House-control
mutual exclusion three times, and LAFC equivalence twice. These were legitimate
retained proposal variants, but rendering each as a separate opportunity
inflated research breadth and displaced unrelated candidates.

The frontier now derives a presentation identity from relation kind and exact
listing refs. `EQUIVALENT`, `MUTUALLY_EXCLUSIVE`, and `EXHAUSTIVE` are symmetric
and sort refs; directional relations preserve ref order. The representative is
selected deterministically by gross edge, current-contract coverage, review
priority, then proposal ID. Proposal variants remain in the evidence ledger;
the card retains their IDs, merges exact issue lineage, and displays how many
variants were collapsed. Inspecting the card still opens one canonical
representative rather than fanning duplicate reviews into the operator flow.

Counts now distinguish visible unique structures, visible raw hints, collapsed
visible variants, and raw hints outside the bounded projection. Unseen detail
is never guessed to be unique or duplicate. Focused tests cover symmetric
collapse, directional inverses, relation-kind separation, deterministic
selection, lineage aggregation, and window counts. Browser qualification on
the retained desk changed `8/16 visible` into `4 UNIQUE SHOWN · 16 raw · 4
collapsed · 8 outside view`, with one card each for LA Galaxy, Atlanta, House
control, and LAFC.

## 2026-08-10 checkpoint

- The live projection now uses `ACTIVE_THEN_RETAINED_ORDER` for economic
  triage, with `POSITIVE_GROSS_HINT` as the sole active predicate. Full retained
  order, totals, negative records, and scheduler priority inputs are unchanged.
- The 87 MB live state now exposes all six positive hints in the bounded view,
  rather than three. The restored set includes the two additional House-control
  analyses and the New Hampshire Senate pair that were previously outside the
  live economic-detail window.
- Finding inbox opens with a two-column Opportunity frontier. It sorts visible
  candidates by bigint gross-edge basis points, clamps long Agent statements,
  names exact contract/issue coverage, and routes one exact proposal ID to the
  persisted Review handoff. At 900 px and below it becomes one column; at 640 px
  the primary action becomes full width.
- All three previously absent proposal IDs returned one proposal, one review
  job, and one lifecycle case from the read-only handoff endpoint. No operator
  decision or scheduler action was triggered by qualification.
- Projection-window tests prove active-first retention. Studio tests prove
  gross-edge ordering, status filtering, empty state, and explicit omitted
  counts. Full workspace type checks, all 578 tests, and the production build
  pass on Node 22.22.1; the repository's Node 24 engine warning remains.
- In-app browser visual QA remains unavailable. The persistent Codex browser
  target again timed out on `Page.navigate` and retained an `about:blank` title
  after the documented recovery check; the failed tab was closed. The Studio
  URL itself returns HTTP 200 in 0.0026 seconds. No desktop, 390 px, overflow,
  or console claim is made from this checkpoint.
