# Semantic review loop efficiency

Status: implemented locally; live-provider requalification and calibration remain

Created: 2026-08-02

## Problem observed

The retained local usage history contained 23 semantic-review failures with the
same terminal diagnostic: the model completed without submitting its tool
effect. Nine newly observed invocations also appeared as `UNAVAILABLE`, even
though a provider response can contain aggregated usage before first-party code
detects the missing terminal effect. Retrying that protocol failure consumes
tokens without producing a durable research artifact.

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
- Plain prose or exhaustion without either accepted terminal effect remains a
  retryable technical failure.

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

## Next checkpoint

1. Requalify one real DeepSeek semantic-review job after the running service is
   restarted onto this code and compare steps/tokens with the retained failure
   cohort.
2. Separate scheduler retry policy for provider/transport failures from stable
   tool-protocol violations once enough classified observations exist.
3. Add resolved-outcome calibration before using token efficiency as a quality
   signal; cheaper abstention is not automatically better semantic work.
