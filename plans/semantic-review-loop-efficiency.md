# Semantic review loop efficiency

Status: terminal recovery and failure-aware retry policy qualified

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

## Next checkpoint

1. Observe new real-provider failures until each retry class has natural live
   samples, then calibrate class-specific delays without changing attempt caps.
2. Add resolved-outcome calibration before using token efficiency as a quality
   signal; cheaper abstention is not automatically better semantic work.
