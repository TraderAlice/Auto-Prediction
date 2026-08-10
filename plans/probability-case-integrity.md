# Probability-case integrity and semantic repair

Status: implemented and live-qualified; adopted as a probability-case gate

Created: 2026-08-10

## Product problem

The first live Terra/high probability case exposed an internally contradictory
semantic-review artifact. Its structured `TF` state means Gemini YES and
Polymarket NO, while the retained counterexample prose primarily describes the
opposite Gemini non-YES and Polymarket YES route. The probability scheduler
currently derives a state ID, supplies the whole artifact, and asks estimators
to continue. A careful role noticed the conflict, but the only available exit
was ordinary evidence abstention.

This is not missing market evidence. It is a broken probability-case premise.
Spending more tokens or collecting a reference class cannot repair it, and any
numeric bound built on the wrong direction would contaminate the failure-budget
frontier.

## Decision

- Build a content-addressed adverse-state interpretation for every current
  probability case. It expands each compact state symbol into the exact ordered
  listing, venue outcome IDs and labels corresponding to TRUE/FALSE, the
  semantic-review disposition/rationale, and the retained counterexample
  posture. It grants interpretation authority only; it does not decide that the
  prose is semantically consistent.
- Make current-protocol Agents inspect that artifact before probability work.
  They must call `accept_probability_case` with its exact identity before they
  may record counter-scenarios, evidence needs, estimates, or abstention.
- Add `challenge_probability_case` as a terminal tool for structured premise
  defects: relation direction, counterexample/state conflict, outcome mapping,
  state selection, or evidence-scope mismatch. A challenge binds exact state,
  listing, evidence, explanation, expected interpretation, and observed
  conflict.
- Persist challenges as successful, non-numeric run effects rather than model
  failures or ordinary evidence abstentions. Scheduler cases become
  `CHALLENGED`, never retry automatically, never aggregate into a probability
  bound, and create a semantic-repair projection visible in Studio.
- Current input, run, and scheduler protocol identities advance. Historical
  input V1-V3, run V1-V3, and job V1-V6 artifacts remain byte-for-byte
  replayable and retain their original scheduling/result semantics.
- A repaired semantic review creates a new constraint/review/case identity. A
  challenge cannot rewrite the review, choose a corrected state, certify a
  probability, fetch evidence, or move value.

## Qualification

- Deterministic interpretation tests prove listing order, TRUE/FALSE outcome
  mapping, evidence lineage, content hashes, and tamper rejection.
- Tool-loop tests reject probability effects before exact acknowledgement,
  reject invented challenge refs/states/evidence, and persist a valid challenge
  without an estimate or evidence debt.
- SQLite restart replays the challenge and scheduler terminal posture without a
  provider request. Legacy run/job validators and identity tests continue to
  pass.
- Aggregation and failure-budget tests prove challenged cases cannot become
  bounds and are not labelled awaiting, abstained, exhausted, or
  evidence-blocked.
- The retained MLS case is rerun with Terra/high. At least one role should
  challenge the supplied direction if the richer artifact exposes the observed
  contradiction; if all roles accept it, their accepted interpretation
  identities still make the resulting evidence work auditable. No prompt or
  fixture may force the live conclusion.
- Studio/API show the repair item, exact affected state/listings, independent
  role support, and zero semantic/certificate/execution authority. Desktop and
  390 px layouts, workspace checks/tests/build, and `git diff --check` pass.

## Selection signal

Adopt the layer if it prevents ambiguous cases from consuming repeated
probability estimation or producing bounds, while repaired cases naturally
re-enter through new semantic-review lineage. Rework it if Agents mostly
challenge clear cases because the interpretation artifact itself remains too
opaque.

## Qualification evidence

- Deterministic tool-loop, scheduler, SQLite migration, API, and frontier tests
  pass. A probability effect attempted before acknowledgement is rejected, and
  challenges carrying an invented state, listing, or evidence hash fail at the
  tool boundary.
- SQLite schema 33 replays historical run V1-V3 and job V1-V6 artifacts while
  persisting current run V4/job V7 `CHALLENGED` terminals. Explicit retry can
  reopen exhausted roles without starting a provider request, but cannot reopen
  a challenged case.
- The retained MLS case was rerun on `CODEX / gpt-5.6-terra / high`. All three
  roles independently challenged `TF` on their first tool call. Each identified
  that the structured state means Gemini YES / Polymarket NO while the retained
  postponement route describes Gemini non-YES or undefined / Polymarket YES;
  the elimination route never establishes Gemini YES.
- The three challenges group into one content-addressed repair item with all
  three roles and one next action: `NEW_SEMANTIC_REVIEW_REQUIRED`. No estimate,
  probability bound, ordinary evidence debt, retry, certificate, or execution
  authority was produced.
- The live qualification used 16,530 reported tokens across three provider
  requests and completed in roughly 10-12 seconds per role. This exposed and
  corrected a usage-ledger classification gap: future challenge effects record
  `CHALLENGED`, not `ABSTAINED`.

The observed selection signal is positive: the gate stopped a broken premise
before numeric work and reduced the case to one attributable repair task. The
next slice is not another estimator retry; it is a new semantic-review lineage
that can accept, reject, or reformulate the challenged state.
