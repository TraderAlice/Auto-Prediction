# Operator finding inbox

Status: qualified

Created: 2026-08-09

## Product problem

Studio labels its second primary destination “Findings”, but the destination is
still the legacy Scout Inbox: a claim-first compose form prefilled with a Boston
temperature example, followed by raw manual discovery runs and Pi reports. It
does not surface the durable scheduled-search findings produced by the primary
heuristic lane, and it asks the operator to invent another question before they
can understand what the machine already found.

This contradicts the heuristic-first product entry and makes the human/Agent
browser workflow depend on internal subsystem knowledge.

## Decision

Derive a bounded first-party finding inbox from durable search-lease records.
Each item preserves the existing multi-kind result summary and receives one
deterministic operating disposition:

- `RETRY_DEEP` when the fast result survived a failed Pi attempt and retry
  budget remains;
- `PROPOSAL_AVAILABLE` when Pi retained one or more proposal artifacts;
- `DEEP_IN_PROGRESS` while a selected candidate is queued or running;
- `DEEP_UNAVAILABLE` when Pi exhausted its retained retry budget but the fast
  result remains available;
- `FAST_LEAD` when a positive fast effect exists without a deep proposal;
- `INSPIRATION_ROUTED` when a cross-lens effect was retained and routed;
- `NEGATIVE_EVIDENCE` for falsification-only results;
- `NO_LEAD`, `SCAN_FAILED`, or `SCAN_PENDING` for the remaining states.

This priority is workflow ordering, not model confidence or expected return.
Every item binds the source lease artifact, exact candidate refs, selected
relation, effect kinds, proposal/evidence counts, and available action. The
projection is derived from durable records and grants no new authority.

## Studio contract

- Findings opens on the durable inbox, not a compose form.
- The header explains that ordering represents required attention, not profit.
- Operators and browser Agents can filter attention-required, positive,
  negative, and archived results without parsing protocol strings.
- Retry Pi is available only when the retained deep input and budget permit it.
- The old manual scout/Pi form remains under an explicitly secondary “Ad-hoc
  investigation” disclosure with no prefilled claim.
- Recent manual run and Pi evidence remains readable below the disclosure; it
  is not confused with the scheduled heuristic inbox.

## Qualification

- Focused scheduler tests cover positive fast effects, falsification-only
  effects, retained Pi proposals, retryable deep failure, policy-invalid
  proposals, and SQLite restart identity.
- SQLite restart reproduces the same inbox because its inputs are durable lease
  artifacts; the inbox itself does not invent a second persistence ledger.
- The live 799-market projection exposed 40 retained inbox items. During
  qualification, 4 and then 5 items required attention as new scheduled work
  completed; all were retained `PROPOSAL_AVAILABLE` artifacts. No item had an
  empty thesis, and every item retained its `sha256:` source-artifact binding.
- Desktop and 390 px browser inspection verifies filters, disclosure, retry
  affordance, an empty ad-hoc textarea, 12 px minimum main text, and no
  horizontal overflow (`390 == documentElement.scrollWidth`).
- Control-plane and Studio type checks, the 28 focused scheduler tests, the 10
  Studio tests, and the Studio production build pass. The final full-workspace
  `pnpm check && pnpm test && pnpm build` gate also passes across 19 projects
  (with the existing host Node 22 versus required Node 24 engine warning).

## Qualified checkpoint

Findings is no longer a synonym for the legacy claim-first Scout Inbox. The
default surface is a bounded projection over durable scheduled-search effects,
with attention reserved for work an operator can actually advance. Generic
fast leads, exhausted deep work, and scan failures remain inspectable without
becoming urgent. The prior manual scout and Pi history remains available under
an explicitly secondary disclosure, so claim monitoring survives without
defining the product's discovery method.

Issue #90 removed a contradictory action boundary found in direct use:
Findings no longer offers `Explore next` while the routed discovery profile is
blocked. It shares the lightweight discovery-capability projection and
preflight control with Discover, so the operator sees one
runtime/model/capability fact at both scan entry points. The backend scheduler
remains the fail-closed final gate even if a stale client attempts the request
directly.
