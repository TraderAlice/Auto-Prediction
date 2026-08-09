# Premise decision dossier

Status: implemented and qualified

Created: 2026-08-10

## Product problem

The semantic-review dossier stops at the first hard constraint. It does not
join the next Agent stage even when premise analysis has already classified the
hidden facts that make a settlement state impossible. The live Arizona
governor candidate therefore appears only as `RETAIN_AS_RESEARCH_ONLY`, while a
durable premise analysis already names six unbound causal premises and the
exact `BASE_CONSTRAINT_RESEARCH_ONLY` blocker.

This is both a product and an Agent-control defect. A human cannot see what
evidence to acquire next, a browser Agent cannot distinguish an exhausted
premise run from a useful research result, and a future acquisition scheduler
has no compact durable handoff after the 250-record analysis-detail window
rotates.

Live cost evidence makes the gap material: the retained premise lane reports
265 provider attempts, 25 passing research outcomes, 75 failed outcomes, and
zero exact admissions. More premise traffic is not the next step. Existing
outcomes must first become durable, attributable decision evidence.

## Decision

- Add `pmh.premise-analysis-outcome-capsule.v1`, retained on a completed v3
  premise job. It binds the exact analysis, semantic-review artifact, relation,
  completion time, compiler admission, blocker, classification, and a bounded
  list of premise obligations.
- An obligation retains premise identity, proposition, kind, truth posture,
  binding kind, evidence-claim count, exact-state authority, and counterexample
  result. It is descriptive evidence, not a new semantic decision.
- New passing jobs create the capsule in the same persistence transaction as
  terminal job completion. A retained v1/v2 PASS may upgrade to v3 only from
  its exact still-retained passing analysis; the v3 record preserves the prior
  job artifact hash and spends no provider request.
- Proposal handoff v3 joins the latest premise job and outcome resolution.
  Handoff distinguishes not scheduled, waiting, exhausted, legacy detail,
  research-only obligations, and exact compiler admission.
- Deterministic next gates become explicit:
  `HIDDEN_PREMISE_ANALYSIS`, `AWAIT_PREMISE_ANALYSIS`,
  `RETRY_PREMISE_ANALYSIS`, `BIND_PREMISE_EVIDENCE`, and the existing
  fee/depth or operator gates. A stale semantic-review attention posture cannot
  hide a newer premise outcome.
- Studio presents the premise stage inside the focused decision dossier, above
  the legacy operations console. Human-readable propositions are primary;
  hashes and raw scheduler diagnostics remain secondary.

## Authority and compatibility

- Capsules are `ADVISORY_SUMMARY_ONLY`; semantic decision, simulation,
  certificate, and execution authority are all false.
- V1/v2 jobs and v1 analysis artifacts continue to validate byte-for-byte.
  Upgrade is explicit, content-addressed, and lineage-bound to the prior job
  artifact rather than silently reinterpreting an old terminal label.
- The slice performs no new model request, network fetch, simulation, order,
  credential access, signing, or value movement during migration.
- A missing analysis cannot be reconstructed from job labels. It remains an
  explicit legacy-detail gap.

## Qualification

- Validator tests cover capsule hashing, bounded obligations, exact analysis
  lineage, v1/v2 replay, v3 upgrade provenance, and tamper rejection.
- Scheduler tests prove a retained PASS upgrades after SQLite restart without
  an analyst call and that new completion persists the capsule atomically.
- Dossier and server tests cover every premise resolution and next gate.
- Live qualification restarts against retained state, upgrades the Arizona
  outcome without provider spend, and exposes its six causal obligations in
  proposal handoff.
- The retained database upgraded ten v2 PASS jobs whose exact passing analyses
  are still present. Fifteen older PASS jobs correctly remain v2 because their
  analysis detail has rotated; no capsule is fabricated from a terminal label.
  Provider-attempt count remained 265 throughout migration and QA.
- The live Arizona handoff is `pmh.proposal-handoff.v3` with one premise job,
  one outcome, six obligations, and `BIND_PREMISE_EVIDENCE` as its next gate.
- The in-app browser remained on the live 5174 page, but its inspection bridge
  timed out for DOM and screenshots. Read-only visual QA therefore used a
  temporary local Chrome tab at the normal desktop viewport and at 200% zoom
  (about 620 CSS px). The single dossier fills the content width, the sidebar
  collapses at the compact breakpoint, and the six-obligation list is readable
  but closed by default. The temporary Chrome tab and zoom are restored after
  inspection.
- Node 24.14.0 full workspace checks, all 584 tests (423 control-plane), and the
  production build pass.

## Follow-on exposed by this slice

`BIND_PREMISE_EVIDENCE` is intentionally a real named boundary, not a claim
that external-source acquisition already exists. The next plan must compare
two evidence routes per obligation: search the traded corpus for an outcome
that makes the premise a state variable, or acquire an allowlisted official
source and bind a verifiable claim. The selection must be driven by obligation
yield and cost rather than automatically sending every causal story to the open
web.

Direct two-listing relations whose semantic constraint already has first-party
exact admission no longer enter this lane. Running a second Agent to restate
listing-intrinsic truth states created artificial obligations and obscured the
real external evidence gap. Premise analysis remains required for conditional,
multi-listing, or otherwise premise-bearing relations; historical premise jobs
remain durable evidence but do not control the current direct-exact gate.
