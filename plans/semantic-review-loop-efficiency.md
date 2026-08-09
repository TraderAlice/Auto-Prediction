# Semantic review loop efficiency

Status: incremental Agent effects and first-party disposition qualified

Created: 2026-08-02

## Problem observed

The retained local usage history contained 23 semantic-review failures with the
same terminal diagnostic: the model completed without submitting its tool
effect. Nine newly observed invocations also appeared as `UNAVAILABLE`, even
though a provider response can contain aggregated usage before first-party code
detects the missing terminal effect. Retrying that protocol failure consumes
tokens without producing a durable research artifact.

Live House-control qualification on 2026-08-09 supplied complete 1,890-character
rules and exposed the remaining protocol loss. The conditional reviewer built a
sound `(No, No)` boundary analysis but reported five rejected
`submit_semantic_review` calls before safely abstaining. The mutual-exclusion
reviewer recorded counterexample work, then exhausted all three scheduler
attempts because each invocation ended without an accepted terminal effect.
Current tool failures return one compact generic diagnostic, do not consistently
increment terminal rejection state, and discard already-recorded counterexample
work when the final call is still malformed.

The failure conflated two different outcomes:

- the Agent cannot responsibly complete the semantic classification inside the
  evidence or reasoning budget; and
- the provider/model violates the required tool protocol and returns no
  terminal effect at all.

## Implemented terminal contract

- Semantic review now has two accepted terminal effects:
  `submit_semantic_review` and `abstain_semantic_review`.
- Both require a prior, explicit counterexample attempt.
- An abstention produces a durable `RELATED` / `TEXTUAL_RELATEDNESS`,
  research-only artifact with its reason and genuine external evidence gaps.
  It cannot enter the exact compiler or grant semantic, certificate, or
  execution authority.
- Near the end of the bounded loop, first-party step preparation forces the
  abstention tool. A rejected premature terminal call forces the next step back
  through `record_counterexample`.
- Plain prose or exhaustion with no recorded counterexample remains a retryable
  technical failure. Once a bounded counterexample effect exists, exhaustion
  retains that work as a conservative recovered abstention.

## Active recovery contract

- A rejected terminal call returns a bounded machine-readable repair envelope:
  stable error code, exact field path, compact diagnostic, requested next tool,
  and resubmission instruction. It never echoes the submitted payload.
- Submission validation covers every terminal field before accepting the tool,
  including truth-state arity/uniqueness, in-scope evidence refs, structured
  evidence requirement scope, and the missing-evidence/requirement invariant.
- Every rejected terminal call increments bounded rejection telemetry. Repeated
  invalid submissions force the remaining loop toward explicit abstention
  rather than allowing unlimited near-identical repair attempts.
- If the model has recorded at least one counterexample effect but reaches the
  hard step boundary without an accepted terminal call, first-party code emits
  a `RECOVERED_ABSTENTION`: a `RELATED`, research-only artifact containing the
  counterexample and last repair diagnostic. It cannot assert the attempted
  relation, enter the exact compiler, or grant semantic/certificate/execution
  authority. A run with no counterexample effect remains a technical failure.
- Trace telemetry separates model-submitted abstention from recovered
  abstention and records rejected terminal count plus the last bounded repair
  diagnostic, so scheduler retry policy and token efficiency can be calibrated
  from durable evidence.

## Usage attribution

Once Vercel AI SDK returns a completed `generateText` result, its aggregated
usage is recorded even if first-party terminal validation subsequently fails.
The event is `FAILED`, `durableEffect: false`, and retains provider request and
token counts. The catch path records an unavailable event only when no returned
usage was available. The same rule now applies to semantic review, rule evidence
interpretation, premise analysis, and probability estimation, with focused
tests proving one event rather than a lost or double-counted invocation.

## Qualification

- explicit semantic abstention ends as `PASS`, carries
  `terminalEffect: ABSTAINED`, remains research-only, and records one complete `ABSTAINED` usage
  event;
- prose in place of a required terminal tool ends as technical `FAILED` while
  retaining complete provider usage;
- premature semantic submission remains repairable inside the same loop;
- rule evidence, premise analysis, and probability estimation retain complete
  provider usage on the equivalent missing-terminal path;
- historical report versions replay because `terminalEffect` is additive and
  optional.

The active upgrade adds:

- malformed nested truth-state and evidence-requirement inputs receive exact
  field-level repair feedback and can be corrected within the same invocation;
- prose or repeated invalid terminal calls after a valid counterexample end as
  one durable recovered abstention rather than three scheduler attempts;
- a terminal-less run with no counterexample still fails;
- the live House mutual-exclusion proposal is manually re-reviewed against its
  complete evidence bundle and no longer exhausts solely on terminal protocol.

Live qualification on 2026-08-09 exposed and closed one final validator/builder
gap. The reviewer can record several individually bounded counterexample
narratives whose concatenation exceeds the semantic-constraint builder's
2,000-character bound. The tool previously accepted that terminal effect and
the first-party artifact builder failed afterward. Counterexample effects now
bind truth-vector arity to proposal arity and deterministically bound the
combined narrative before terminal acceptance. A focused three-counterexample
regression proves the builder cannot rediscover this error after the tool says
`accepted`.

The same content-addressed House `MUTUALLY_EXCLUSIVE` proposal was then rerun
against the live 1,890-character complete rules. It ended `PASS` with a
model-submitted `ABSTAINED` terminal effect, three retained counterexample
attempts, zero claimed truth states, and a `RELATED` /
`TEXTUAL_RELATEDNESS` / `RESEARCH_ONLY` artifact. Its rationale distinguishes
reasoning-budget exhaustion from missing rule evidence. The previous scheduler
exhaustion is therefore no longer reproducible as a terminal-protocol failure,
and no recovered abstention was needed for this natural run.

## Failure-aware scheduler contract

Durable review failures now carry a first-party classification and immutable
retry policy instead of leaving the scheduler to parse one opaque diagnostic:

- retryable provider/transport failures and timeouts receive the normal bounded
  request budget;
- a model that records no counterexample and violates the terminal protocol may
  receive one repair retry, but cannot consume all three default attempts;
- first-party artifact-contract failures, persistence failures, and provider
  errors explicitly marked non-retryable stop after the first request;
- lease expiry remains retryable because it does not prove a model-quality
  failure;
- `UNKNOWN` preserves the historical standard policy rather than silently
  converting old records into terminal failures.

The policy and last failure class live on the durable job, survive SQLite
restart, appear in the scheduler projection and Studio, and are covered by the
same content hash as the rest of the job. Historical retry/exhausted jobs remain
valid; their compact diagnostics are conservatively classified at projection
time. The retained live history that motivated the policy contains 31 exhausted
terminal-protocol jobs, 13 lease-expiry jobs, and three first-party constraint
builder failures. Those classes no longer share one retry rule.

Live restart qualification classifies every failed job in the current
250-record interactive scheduler window: 28 `MODEL_PROTOCOL`, three
`FIRST_PARTY_CONTRACT`, and ten `LEASE_EXPIRED`, with zero unclassified jobs.
The full durable SQLite history remains larger (31, three, and 13 respectively),
which is expected because interactive detail retention stays bounded. The
projection performs no migration write and starts no reviewer request. Studio
desktop and 390 px views render the complete 41/41 classified mix. Workspace
checks, all 547 tests, and the production build pass.

## First-party workflow disposition

Live measurement on 2026-08-10 exposed a different protocol loss in the
price-positive House-control review. The Agent had already reasoned over the
complete rules and submitted the semantic body repeatedly, but supplied a
workflow `recommendation` literal outside the three-value enum. Three rejected
calls forced an abstention even though the malformed field was not part of the
settlement analysis.

The terminal contract now separates semantic work from harness workflow:

- `submit_semantic_review` accepts the relation conclusion, assessments,
  evidence gaps, structured requirements, rationale, and explicit state matrix;
  it no longer asks the Agent to choose `REJECT`, `ESCALATE`, or
  `ACCEPT_FOR_RESEARCH_SIMULATION`;
- `FIRST_PARTY_CONSERVATIVE_V1` derives that posture after validating the tool
  effect. Any missing/unresolved evidence or inconclusive counterexample is
  escalated; a complete discovered counterexample or unsupported relation
  reformulation rejects the original proposal; only complete,
  counterexample-free work is accepted for research simulation;
- abstentions and recovered abstentions are also labelled with the same
  first-party policy. None of these dispositions grants simulation,
  certificate, production-review, or execution authority;
- the policy identity is retained in the content-addressed Agent trace, while
  historical model-selected reports replay without reconstruction;
- Studio distinguishes retained first-party workflow dispositions from legacy
  model-selected postures, so protocol adoption and remaining losses are
  observable rather than inferred from recommendation text.

Focused tests prove all three conservative branches: incomplete work escalates,
a complete found counterexample rejects, and complete counterexample-free work
is accepted for research simulation. The Agent tool schema contains no
`recommendation` property.

## Incremental Agent-effect protocol

Removing the workflow enum exposed the deeper failure mode rather than moving
it. A first live rerun invented an unsupported `relationConclusion`; after that
field was derived by policy, a second rerun omitted the giant terminal tool's
`assessments` object. Both cases show that a single terminal payload containing
the whole report is still fixed-schema parsing disguised as a tool.

`pmh.semantic-review-agent-effects.v2` replaces that terminal form with a
stateful effect journal:

- `record_counterexample` retains each bounded falsification attempt;
- `record_semantic_assessment` retains or replaces the four review lenses;
- `record_truth_state` adds one unique, proposal-arity joint settlement state;
- `record_evidence_gap` pairs one human-readable gap with one structured
  acquisition requirement;
- `submit_semantic_review` contains only classification, assumptions, and
  rationale, and seals the previously recorded effects;
- `abstain_semantic_review` contains only a reason and preserves whatever
  incremental assessment, state, and evidence effects already exist.

The first-party assembler validates the aggregate invariants, derives missing
evidence and unresolved states, then applies `FIRST_PARTY_CONSERVATIVE_V1` to
both the retained relation conclusion and workflow posture. A materially
different relation must become another proposal instead of being smuggled into
the review conclusion.

Protocol identity is now part of review-run identity. Historical v1 runs remain
valid and replayable, while a new protocol can produce a distinct review over
the same proposal/evidence/model scope. Scheduler reconciliation prefers the
current protocol and atomically replaces a contemporary PASS capsule when the
new review is durable; this prevents legacy idempotency from silently freezing
the old Agent contract.

Live canonical House-control qualification completed in 29 seconds and was
persisted to SQLite as review
`sha256:8f9f75e6b39c2edd82ea706a72d5ba82d4c18ae2fad6da48c799af65b4629545`.
The Agent recorded one assessment, one counterexample attempt, four unique
truth states, and zero evidence gaps, then submitted a real terminal effect.
One duplicate `TT` state was rejected and repaired in-loop. First-party policy
derived `MUTUALLY_EXCLUSIVE` / `ACCEPT_FOR_RESEARCH_SIMULATION`; the constraint
is `HARD_SETTLEMENT_CONSTRAINT`, and no recovered abstention was used. Restart
reconciled the canonical scheduler capsule to this review. The 190 bps gross
hint remains non-executable and advances to `BIND_PREMISE_EVIDENCE`, because the
separate premise audit still contains four unbound propositions.

Node 24.14.0 workspace checks, all 596 tests (435 control-plane and 17
Studio), and the production build pass. The in-app browser refused the local
5174 URL under its URL safety policy, so this slice does not claim a fresh
browser screenshot qualification; Studio remained available at 5174 and its
typed production build completed.

## Next checkpoint

1. Replace the four unbound House premise propositions with listing-intrinsic
   expressions or explicit evidence obligations; do not advance to fees/depth
   merely because the semantic review is now complete.
2. Observe new real-provider failures until each retry class has natural live
   samples, then calibrate class-specific delays without changing attempt caps.
3. Add resolved-outcome calibration before using token efficiency as a quality
   signal; cheaper abstention is not automatically better semantic work.
