# Finding-to-review handoff

Status: qualified

Created: 2026-08-09

## Product problem

The durable Finding Inbox can identify a search lease with retained Pi
proposals, but its only transition is a generic navigation to the top of the
large Opportunity Lifecycle page. The selected finding, its proposal IDs, and
their current workflow states are lost. A human has to rediscover the same
artifacts manually, while a browser Agent cannot preserve or share the task
across a refresh.

Live evidence makes the gap concrete. Five attention findings currently retain
18 proposal IDs. Ten proposal details remain in the bounded Studio projection,
five have a visible lifecycle case, and two have a visible operator-attention
item. These are useful but disjoint windows; a generic page jump does not form
an operable handoff and incorrectly suggests the review page itself is the
context.

## Decision

Make Studio workspace navigation URL-addressable and carry a bounded proposal
focus from Findings into Review queue.

- Every primary Studio destination has a stable `?view=` value and restores
  after refresh or browser history navigation.
- A Finding transition writes up to five exact `sha256:` proposal IDs into the
  URL. Invalid, duplicate, or over-bound values are discarded at the boundary.
- Review queue opens with a focused handoff panel before global dashboard
  metrics. A bounded read-only endpoint resolves the selected IDs against the
  full retained proposal, review-job, lifecycle-case, and operator-attention
  sources without sending the multi-megabyte full projection to the browser.
- Missing persisted detail is named as unresolved handoff data; it is never
  presented as a missing durable artifact or completed workflow.
- A focused case may start or restore the existing independent semantic review
  request. The handoff itself grants no review, decision, simulation,
  certificate, execution, or trading authority.
- Clearing focus returns to the unfiltered Review queue and removes proposal
  IDs from the URL.

## Agent and human UX contract

- The URL is sufficient for a human or browser Agent to reopen the same
  proposal focus after refresh.
- The focused panel states how many proposal details, lifecycle cases, and
  operator postures are visible before offering an action.
- Every focused proposal shows its exact short identity and the strongest
  current workflow state available. Proposal statements and listing refs are
  shown only when retained first-party projection data supplies them.
- Normal sidebar or command navigation clears stale proposal focus.
- Desktop and 390 px layouts preserve the 12 px text floor and no horizontal
  overflow.

## Qualification

- Pure route parsing/serialization tests cover valid views, invalid views,
  hash validation, de-duplication, the five-proposal bound, and focus clearing.
- The handoff endpoint rejects invalid hashes and more than five IDs, retains
  authority-false fields, and returns only proposal-local summaries rather than
  evidence documents or full workspace state.
- A refreshed `?view=review&proposals=...` URL restores Review queue with the
  same exact proposal focus against the live 799-market persisted state.
- Browser inspection follows one real Finding into its focused Review queue,
  verifies truthful visible-window counts, clears focus, and repeats at 390 px.
- Studio checks/tests/build and full-workspace gates pass.

## Qualified checkpoint

The live House-control Finding is the qualification specimen. Its two proposal
IDs initially reproduced the exact product defect: after scheduled work moved
the live projection window, Review queue could recover zero proposal details,
zero review jobs, and zero lifecycle cases. The URL still retained the IDs, so
the UI named the absence without inventing state.

The proposal-local endpoint now resolves the same two IDs from full retained
state without transferring the 8.2 MB full projection. It restores two proposal
summaries, two `DUPLICATE_SCOPE` review jobs (including their canonical reuse
identities), and two `AWAITING_SEMANTIC_REVIEW` lifecycle cases. Refresh keeps
the exact URL focus, Clear focus removes only the proposal query, and browser
history restores it. The duplicate jobs offer no new review action and spend no
model request.

Desktop browser inspection uses compact five-line thesis disclosures with full
text and listing refs available on expansion. At 390 px, both proposal cards
form a 356 px single column, document and body scroll widths remain 390 px, and
the minimum main-text size is 12 px. Server integration covers the read-only
endpoint contract and invalid-ID rejection; Studio route tests cover stable
view names, validation, de-duplication, the five-ID bound, and focus clearing.
