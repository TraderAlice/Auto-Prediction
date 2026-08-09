# Cross-lens inspiration effects

Status: qualified with live model, SQLite restart, and browser evidence

Created: 2026-08-09

## Product problem

A coherent heuristic trailhead may suggest a useful relation outside the
semantic family that happened to schedule it. The first v4 live trailhead was
issued by `PHYSICAL_CO_OCCURRENCE` but grouped eleven same-subject Hormuz
deadline contracts whose obvious next question is temporal implication. The
current Agent must either force that observation into the assigned family or
complete with no durable effect. Both destroy useful search information.

This is not yet a candidate. It is an inspiration: grounded evidence that a
specific inspected neighborhood deserves a differently shaped search.

## Direction

Add a first-class `record_inspiration` tool effect between trailhead inspection
and candidate formation. It must bind:

- two to six exact inspected listing refs;
- a bounded observation explaining the unexpected structure;
- a suggested search lens or semantic family, explicitly different from the
  current assignment when one exists;
- concise search signals and the source trailhead identity;
- content identity and routing-only authority.

An inspiration cannot launch Pi, semantic review, probability estimation,
certification, simulation, or execution. It enters a durable inspiration inbox
and may create a bounded follow-up search assignment without becoming an
operator claim.

## Implemented contract

Discovery Agent trace v4 now exposes `record_inspiration` beside positive and
negative findings. First-party validation derives content identity from the
sorted exact refs, suggested lens/family, and source trailhead; same-assignment,
uninspected, unknown, duplicate, oversized, and depth-two effects fail within
the tool loop. The effect has search-routing authority only.

Search lease v9 copies accepted inspirations into its durable fast-lane record.
The issue scheduler derives its inbox from those SQLite-backed leases rather
than a mutable side table. A deterministic v3 lease identity permits at most
one follow-up per inspiration. The follow-up bypasses lexical and family
retrieval and constructs its Agent context from the original exact refs; its
assignment depth is one, so it cannot spawn an autonomous issue tree.

Studio now gives these effects a separate cross-lens inbox with queued,
running, exhausted, complete, and failed states plus exact refs, search signals,
provider requests, and downstream positive/negative effects. Claim monitoring
remains a visibly separate operator lane.

## Follow-up topology

Discovery origin and routing posture must remain separate:

- corpus exploration creates a fresh trailhead;
- an inspiration follow-up starts from the exact inspected refs and tests the
  suggested lens;
- operator claim monitoring continues to route from a human hypothesis.

The follow-up must retain the original issue, lease, trailhead, Agent effect,
and new lease lineage. Dedupe uses the sorted refs plus suggested lens and
source trailhead identity. At most one active follow-up may exist for one
inspiration, and follow-up depth is bounded to prevent autonomous issue trees.

## Studio contract

The Market Archaeologist surface should distinguish `LEAD`, `FALSIFIED`,
`INSPIRED`, and `NO LEAD`. The latest-trailhead card remains the explanation of
where exploration started; a separate inspiration inbox explains what
unexpected direction the Agent wants to test, its exact refs, cost so far, and
whether a follow-up is queued, running, exhausted, or complete.

## Qualification

- An inspected out-of-family neighborhood can record an inspiration without a
  proposal or Pi invocation.
- Unknown or uninspected refs, same-lens non-observations, duplicate effects,
  and oversized text fail inside the tool contract with repair guidance.
- SQLite restart preserves the inspiration and at-most-one follow-up lineage.
- An inspiration follow-up receives the exact refs that motivated it; unrelated
  claim query terms cannot replace them.
- Scheduler and Studio attribute provider requests, downstream proposals,
  falsifications, and terminal outcome back to the source inspiration.
- Desktop and 390 px browser QA show the inbox and status without overflow.
- Full workspace checks, tests, build, and authority-boundary proofs pass.

Deterministic Agent, scheduler, exact-context, no-recursion, and lease replay
tests pass, including reopening the same SQLite database without spending
another Agent request or dispatching a second follow-up.

Natural live traffic produced inspiration
`sha256:5db6e9f56cf6e9a7e705906a88f72de7dbb4adc22a74e71dcefbf6b2fc1fd365`:
the temporal-impossibility program inspected the Jan Bachowicz and Alex Pereira
Polymarket US light-heavyweight champion contracts, then routed the unexpected
same-role structure from `IMPLICATION` / `TEMPORAL_IMPOSSIBILITY` to
`PARTITION` / `PARTITION_COMPLETENESS`. The source lease retained the effect
with `NO_CANDIDATES` and no Pi invocation. Its sole depth-one follow-up received
exactly those two refs, made four provider requests, retained one hypothesis
and one falsification, completed its independent deep investigation, and
recorded zero nested inspirations.

Studio browser inspection at 1280 and emulated 390 px shows one readable inbox
card with no horizontal overflow, a 12 px minimum main-content font size, and
no console errors. The loaded Market Archaeologist page remains the deliverable
browser tab.
