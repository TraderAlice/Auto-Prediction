# Relation-bound discovery findings

Status: implemented and locally qualified

Created: 2026-08-09

## Product problem

The fast discovery Agent currently records a positive hypothesis with a broad
arbitrage `strategyKind`, but not the exact semantic `relationKind` it believes
the inspected listings express. Search issues and candidate policies are typed
in relations such as `IMPLIES`, `MUTUALLY_EXCLUSIVE`, or `EXHAUSTIVE`, so the
scheduler can only admit a model hypothesis by listing arity and scope. It may
therefore spend Pi on a hypothesis that does not satisfy the issue that routed
it.

The first natural inspiration follow-up made this visible: one exact UFC pair
produced both a positive hypothesis and a falsification. That can be coherent
when, for example, mutual exclusion survives while exhaustiveness is falsified,
but the positive artifact lacks the relation type needed to prove that
distinction.

## Direction

- Require every new Agent `record_hypothesis` effect to state one supported
  `relationKind` in addition to its execution-oriented strategy kind.
- Preserve old hypotheses without a relation kind for replay, but make them
  ineligible for new typed issue-policy admission.
- Bind hypothesis identity, candidate novelty, fast-lane selection, and the Pi
  question to the asserted relation kind.
- Store the selected candidate relation in the lease fast lane.
- Derive a first-party finding summary from durable effects. A run may carry
  several simultaneous kinds—`LEAD`, `FALSIFIED`, and `INSPIRED`; `NO_LEAD`
  applies only when none exist. Do not collapse a mixed result into a false
  single disposition.
- Show those kinds and the selected relation in Studio search history and the
  latest trailhead result.

## Authority and compatibility

Relation typing is a model assertion and routing constraint, not semantic
approval. It grants no certificate, probability, simulation, or execution
authority. Historical untyped hypotheses remain readable and hash-stable; they
cannot satisfy a newly issued typed family policy.

## Qualification

- Missing or unsupported relation kinds fail inside `record_hypothesis` with
  repair guidance.
- A relation not allowed by the issue policy cannot select candidate refs or
  launch Pi even when its refs and arity match.
- An allowed relation retains its exact kind through SQLite restart and into
  the bounded Pi question.
- Mixed positive, negative, and inspiration effects project all three finding
  kinds; a genuinely empty terminal scan projects only `NO_LEAD`.
- Studio desktop and 390 px history remain readable without overflow or
  sub-12 px text.
- Full workspace checks, tests, build, and authority-boundary proofs pass.

## 2026-08-09 checkpoint

Agent trace hypotheses now require an explicit relation kind, while the durable
ledger still accepts historical untyped records without rewriting their hash.
Search lease v10 stores the selected relation and includes it in candidate
novelty and the bounded Pi question. A model-selected pair with the right arity
but a relation outside the issue policy remains a finding but cannot select
candidate refs or launch Pi.

The scheduler also projects a first-party v1 finding summary independently of
the stored lease artifact. Passing scans may expose `LEAD`, `FALSIFIED`, and
`INSPIRED` together; only a passing scan with no recorded effects is
`NO_LEAD`. Issued and failed work remain pending/incomplete rather than being
mislabelled as negative evidence. Studio exposes these kinds, counts, and the
selected relation in recent history and on the latest heuristic trailhead.

Focused qualification covers 62 discovery, ledger, issue, and lease tests,
including relation-policy rejection, deep-question lineage, SQLite restart,
and summary authority. Studio type checks, ten projection tests, and the
production build pass. Browser inspection at 1280 and 390 px confirms the
finding UI retains a 12 px text floor without horizontal overflow.
