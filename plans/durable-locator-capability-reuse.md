# Durable Locator Capability Reuse

## Problem

An active legacy proposal can outlive the catalog observation or evidence bundle
that first named its contracts. A sibling v2 requirement for the exact same
listing may already retain a validated official locator and source observation,
yet the legacy requirement remains `UNSUPPORTED` because rebasing only consults
the current catalog/candidate bundle.

The live House-control case has this shape: one proposal still reports three
active rule/time gaps, while another requirement over the same two exact refs
retains and has captured both slug-specific contract documents.

## Decision

Allow a current unsupported requirement to reuse durable locator capability
from retained requirements only when all of these identities agree:

- exact listing ref;
- current temporal posture;
- venue and protocol identity;
- locator identity recorded in the donor source observation;
- locator role admitted for the target evidence kind.

The target claim, reason, satisfying/contradicting observations, proposal ID,
and requested listing scope remain unchanged. V1 is upgraded to v2 only when
its own listing refs already contain a valid two-or-more contract proposal
scope; no missing peer is invented. The new requirement is content-addressed,
the old requirement/job stays replayable, and reuse grants acquisition routing
only—not claim satisfaction or semantic equivalence.

## Qualification

- Unit tests prove exact reuse, role mismatch rejection, listing/protocol
  mismatch rejection, no invented v1 scope, and input-order independence.
- Scheduler integration proves a reused claim coalesces onto an already captured
  acquisition scope without another fetch.
- Live current debt should remove only gaps for which retained locator
  capability is temporally valid. Historical-at-source gaps must remain
  explicit rather than being satisfied by a current document.
- Full tests/build and desktop/mobile browser checks precede push.

## Qualified result

The batch rebase is deterministic and conservative. Across 408 retained unique
requirements it completed in roughly 105 ms and found 46 exact capability
matches; after current-generation reconciliation, three formerly active gaps
moved out of the current unsupported set. Reusing the acquisition scope after a
capture schedules no second anonymous read, as the scheduler regression proves.

The live frontier now separates 46 inactive retained requirements from 219
active unsupported requirements across 100 proposals. It intentionally leaves
the leading House proposal's three `RESOLUTION_RULE` / `TIME_BOUNDARY` gaps in
`HISTORICAL_AT_SOURCE_OBSERVATION`: present-day contract text cannot establish
what an older source observation said. The sibling House proposal correctly
retains only its current `ORACLE_SOURCE` gap. Studio exposes those postures as
`Historical snapshot` and `Current`, so the operator can distinguish missing
history from fetchable present evidence.

This is locator capability reuse, not semantic claim reuse. No observation is
added to a claim, no authority flag changes, no peer listing is invented for a
v1 requirement, and no model request or value-moving effect is introduced.
All 616 workspace tests, type checks, and the production build pass. Desktop
and 390 px Evidence checks have no horizontal overflow or console errors, and
the visible type floor is 12 px on both surfaces.
