# Evidence Debt Frontier

## Product problem

The retained acquisition scheduler currently reports 196 unsupported fetch jobs
covering 278 requirements, but that inventory does not say which missing source
blocks a proposal that is still economically or semantically worth pursuing.
Treating every missing locator equally turns evidence work into another large,
low-signal queue.

The first bounded live audit contained no `POSITIVE_GROSS_HINT` items, while a
fresh full reconciliation exposed three 190 bps House-control gross hints whose
official-source routes are unsupported, plus six operator evidence escalations.
That is precisely why the join must be built from the current full retained
state rather than inferred from independently compacted Studio windows. The
frontier must put those three price-positive blockers first without presenting
their before-fee, before-depth indication as executable profit.

## Decision

Build a deterministic first-party Evidence Debt Frontier from durable scheduler
state. It groups unsupported requirements by proposal and joins, without an AI
call, to current proposal economics and operator review attention.

The priority contract is:

1. `POSITIVE_GROSS_BLOCKER`: a missing route on a current positive gross hint;
2. `EVIDENCE_ESCALATION`: a missing route on an operator evidence escalation;
3. `ACTIVE_TRIAGE_DEBT`: a missing route on a current economic-triage item;
4. `RETAINED_RESEARCH_DEBT`: retained unsupported work with no current join.

Within a tier, gross edge uses bigint comparison, review/economic priority is
descending, missing-evidence breadth is descending, and proposal identity is the
stable tie-breaker. One card represents one proposal rather than one fetch job.
It retains the exact requirement and job identities, missing evidence kinds,
proposal contract scope, and route absence that created the debt.

This is routing priority only. A positive gross hint remains before fees and
depth, and the frontier gains no semantic, certificate, simulation, execution,
external-write, or value-moving authority.

## Construction

- Add a bounded, content-addressed control-plane projection with stable item
  identities and explicit source/window counts.
- Build it from the full retained evidence scheduler projection before the live
  Studio window is compacted.
- Include it in the ordinary Studio projection and a read-only JSON endpoint so
  humans and browser Agents can inspect the same contract.
- Present the leading proposal debts in Evidence with a small, readable queue;
  show the tier, statement, missing kinds, exact scope, and gross-edge caveat.
- Keep unsupported inventory counts visible, but make the frontier the action
  surface.

## Qualification

- Focused tests prove grouping, deterministic identity, tier precedence,
  bigint gross-edge sorting, bounded requirements, and authority invariants.
- Projection/API tests prove the frontier survives the normal control-plane and
  live-window path.
- The real SQLite corpus must show the measured intersections and must not add
  an AI request or evidence fetch while projecting.
- Run workspace checks/tests/build, then inspect Evidence at desktop and 390 px
  widths for readable hierarchy, no horizontal overflow, and no console error.

## Qualified result

- The live frontier reads 196 unsupported jobs, 265 unsupported-route
  requirements, and 113 proposal groups from the retained scheduler window.
- Three House-control proposals with 190 bps gross hints rank ahead of six
  operator evidence escalations. The three are separate retained proposals over
  the same contract pair, so the frontier preserves their identities rather
  than silently deduplicating semantic work.
- The read-only endpoint and Studio projection add no model call, fetch,
  scheduler mutation, external write, or execution authority.
- Desktop and 390 px browser inspection found a 12 px minimum text size, no
  horizontal overflow, six semantic Review links, a resolved proposal-local
  handoff, and no console errors.
- Workspace type checks, all 614 tests, and the production build pass on the
  available Node 22.22.1 host. Node reports the repository's `>=24` engine
  warning; no Node-24-only qualification is claimed in this slice.
