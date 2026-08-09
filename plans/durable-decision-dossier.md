# Durable decision dossier

Status: implemented; operator re-review pending

Created: 2026-08-10

## Product problem

The Opportunity frontier makes six current positive-gross proposals visible,
but their Review handoff is not a durable decision object. Four jobs are direct
`PASS` and two are `DUPLICATE_SCOPE` references to one canonical `PASS`; only
one of the four underlying review reports remains in the semantic-review
detail window. The other jobs retain a recommendation and review ID but lose
relation conclusion, semantic-constraint classification, evidence-gap count,
and counterexample count when the fifty-record review window rotates.

This is not ordinary UI pagination. A persistent search machine cannot claim
that an independent review happened while discarding the bounded outcome a
human or browser Agent needs to decide what happens next. Counts remain useful
for attribution, but they are insufficient decision evidence.

## Decision

- Contemporary completed semantic-review jobs retain a content-addressed,
  bounded outcome capsule derived only from the exact passing review report.
  It stores review/report identities, recommendation, relation conclusion,
  semantic-constraint classification and identity when present, evidence-gap
  and counterexample counts, completion time, and advisory-only authority.
- Job schema v3 requires the capsule exactly for direct `PASS` jobs. Historical
  v1/v2 jobs replay unchanged. A retained historical PASS may upgrade to v3
  only when its exact review report is still present; no model output or field
  is reconstructed from a recommendation string.
- `DUPLICATE_SCOPE` jobs do not copy or rehash the canonical result. A
  proposal-local dossier resolves the exact `duplicateOfJobId` and labels the
  capsule basis as `CANONICAL_SCOPE_REUSE`; direct jobs use `DIRECT_REVIEW`.
  Missing historical detail is explicitly `LEGACY_DETAIL_UNAVAILABLE`.
- Proposal handoff v2 joins the proposal, current economic-triage item, review
  job, resolved review capsule, lifecycle case, and operator-attention posture.
  A deterministic next gate names one of: independent review, recover review
  detail, resolve evidence gaps, operator decision, fee/depth qualification, or
  retain as research-only.
- Studio renders the focused handoff as a decision dossier. It never converts
  an advisory recommendation or gross hint into an operator acceptance.

## Compatibility and authority

- Stored v1/v2 job hashes and handoff v1 clients remain replay-compatible.
  The local Studio moves atomically to handoff v2.
- The capsule is a summary of a first-party retained report, not a replacement
  semantic report and not a certificate input. Full report/evidence artifacts
  retain their existing validation contracts and windows.
- Dossier economics remain pre-fee, pre-depth, non-executable scheduling
  evidence. Current-price changes may change a dossier projection but never
  rewrite a stored review capsule.
- No dossier field grants semantic-decision, simulation, certificate, signing,
  credential, execution, or value-moving authority.

## Qualification

- Scheduler tests prove v3 PASS capsules replay, reject tampering, survive
  SQLite restart, and upgrade only when an exact retained report exists.
- Duplicate-scope tests prove dossier resolution uses the named canonical job
  and cannot silently fall back to another same-scope job.
- Server tests prove handoff v2 joins economics and direct/reused/legacy review
  dispositions while remaining proposal-local and authority-false.
- Studio tests cover deterministic next-gate labels and explicit legacy gaps.
- Live qualification evaluates all six frontier proposals and records how many
  are direct, canonical reuse, evidence-blocked, and legacy-detail unavailable.
- In-app browser QA covers focused navigation, dossier hierarchy, 390 px
  layout, overflow, typography, and console diagnostics when the browser target
  is available.
- Full workspace checks, tests, and production build pass.

## Qualification evidence — 2026-08-10

- Job v3 capsule validation, tamper rejection, exact-report-only upgrade, and
  SQLite restart retention pass focused scheduler coverage. Duplicate dossier
  resolution selects only the named `duplicateOfJobId`; it never substitutes
  an unrelated retained PASS.
- Handoff v2 is now the local Studio contract. It joins proposal, economic
  triage, review job, resolved outcome disposition, lifecycle case, attention,
  and deterministic next gate while keeping every semantic, simulation,
  certificate, and execution authority false.
- The live six-item positive-gross frontier resolves as one direct contemporary
  capsule and five explicit historical-detail gaps. Two gaps are duplicate-
  scope references whose named canonical capsules are unavailable; three are
  historical direct PASS jobs. The one contemporary capsule is `ESCALATE`,
  concludes `RELATED`, retains three evidence gaps, and routes to
  `RESOLVE_EVIDENCE_GAPS` rather than fee/depth qualification.
- Studio shows economics, outcome provenance, evidence gaps, and next gate in
  the focused dossier. In-app-browser qualification at 1280×720 and 390×844
  found no horizontal overflow, a 12 px main-text floor, Inter body typography,
  both economic summaries, the explicit legacy warning after persisted handoff
  load, and no console warnings or errors.
- Node 24.14.0 full-workspace check, all 581 tests, and the production build
  pass. The existing Studio bundle-size advisory remains non-blocking.

## Follow-on

Once semantic outcome evidence is durable, anonymous fee and depth acquisition
can attach a separate expiring microstructure preflight to dossiers whose
semantic gate is genuinely eligible. It must not spend requests on legacy or
research-only cases merely because their catalog midpoint looked positive.
