# Discovery falsification effects

Status: implemented; live Terra/high qualification complete

Created: 2026-08-09

## Evidence that changed the design

A real scheduled Luna/high equivalence scout inspected a Kalshi multi-condition
listing and a lexically similar Polymarket Cy Young listing, correctly concluded
that the contracts were not equivalent, then persisted that conclusion through
`record_hypothesis` because the discovery protocol had no negative-finding
effect. The candidate pool therefore gained a high-confidence non-candidate and
could have spent Pi and semantic-review work on a relation the scout had already
falsified.

Negative semantic work is useful search evidence, but it is not a proposal.
Forcing both dispositions through one tool destroys that distinction at the
first durable boundary.

## Contract

- Add a bounded `record_falsification` tool for a relation claim rejected by the
  scout after inspecting every referenced listing.
- Persist a content-addressed falsification artifact with exact listing refs,
  explicit tested relation kind, bounded claim and reason, and retrieval terms.
  A separate finding identity binds relation kind plus listing refs so recurring
  scans can deduplicate notices without discarding observation provenance. Do
  not solicit or persist a model confidence score for it.
- A falsification has search-negative-evidence authority only. It has no
  semantic-decision, certificate, execution, external-write, or value-moving
  authority.
- Falsifications never increment proposal counts, enter the candidate signature,
  launch Pi, create a semantic-review job, or enter an opportunity lifecycle.
- Discovery traces distinguish accepted/rejected hypothesis effects from
  accepted/rejected falsification effects. Historical v1/v2 traces and runs
  remain replayable unchanged.
- Scheduled leases retain falsification identities and count them by issue and
  semantic family, including leases with zero proposals.
- The semantic relation graph projects retained falsifications as empirical
  search feedback. Search prompts must describe prior outcomes as falsification
  evidence, never semantic truth.

## Qualification

- Focused session tests prove inspection, scope, duplicate, completion, and
  proposal separation.
- Discovery-ledger and SQLite restart tests prove v3 trace/artifact replay while
  retaining historical fixtures. The intermediate relation-unspecified v1
  artifact remains replayable; relation kind and finding identity are additive
  only in v2 rather than mutating persisted v1 meaning.
- Search-lease tests prove a falsification-only run passes the fast lane, launches
  no Pi work, and remains attributable to its issue/family.
- Semantic-graph tests prove the negative artifact appears once, affects graph
  identity, and creates no relation/proposal.
- All 532 workspace tests, workspace type checks, and the production build pass
  on Node 24.
- Natural Luna/high scheduler traffic proved v2 tool compatibility, including a
  three-falsification/zero-model-hypothesis run, but also exposed one residual
  disposition lapse: a negative conclusion was redundantly submitted as a
  positive hypothesis after its equivalence claim was falsified.
- The operator runtime was therefore advanced to Terra/high. A fresh bounded
  calibration completed `search_catalog -> inspect_listings ->
  record_falsification -> complete_search` in 14.2 seconds with one accepted v2
  falsification, zero hypotheses, zero rejected effects, and four provider
  requests.
- SQLite restart replay retained the Terra configuration at revision 8, the
  content-addressed artifact, and its v3 trace. Studio showed the run as `0
  leads / 1 falsified`, labeled the artifact `SEARCH_NEGATIVE_EVIDENCE_ONLY`,
  and exposed no proposal or promotion route; browser console inspection was
  clean.

## Open implementation decision

Keep falsification language bounded and inspectable rather than attempting a
deterministic natural-language negation classifier for `record_hypothesis`.
The tool boundary expresses the Agent's disposition; downstream independent
review remains the authority for any positive proposal.
