# Hypothesis family intent

Issue: https://github.com/luokerenx4/my-little-pony/issues/231

## Decision

Expose bounded exact family history in the V11 reasoning view and require every
new hypothesis to declare its relationship to prior work:

- `EXTEND` names an exact existing family and a materially new variation or
  search neighborhood;
- `REPLICATE` names an exact existing family and states why a new exact input or
  repeat observation is valuable;
- `DIFFERENT_TEST` is valid only when the selected exact test handle has no
  family on this prototype/axis.

The host—not the Agent—checks family IDs and test bindings. The declaration is
durable research intent with no semantic or scheduling authority. This
preserves mutation and replication while ending silent paraphrase-based repeat
spend.

Prototype actions now also form a strict falsification window: an exact
transfer-test or counter-scenario action is rejected unless a hypothesis is
active and bound to that exact handle. Post-effect readiness carries the active
binding, and a terminal remains ineligible until the hypothesis closes after
the action. The V11 profile permits 16 calls / 500,000 input tokens; this is an
upper bound, not a target, and has a distinct immutable execution revision.

## Selection

Adopt when a live V11 Terra/high episode sees family memory, opens an exactly
valid intent, completes a bounded terminal and retains the intent against exact
effects/tokens. Reject if context bloat is disproportionate, useful replication
is blocked, or prose acquires identity authority.

## Live evidence

Three pre-selection specimens exposed distinct engineering failures and remain
retained as negative evidence:

- revision 13 stopped after 12 calls at its 300,000-input ceiling with an open
  hypothesis;
- revision 14 completed an exact test and closed its hypothesis, but its 14th
  invocation took cumulative input to 414,487 and was discarded by the
  400,000-input ceiling before the final terminal effect;
- a first revision-15 attempt performed a transfer-test action before opening a
  hypothesis and was interrupted by a deliberate hot-reload after seven calls.
  That run motivated the host-enforced falsification window rather than another
  prompt-only instruction.

The selected revision-15 Terra/high specimen is run
`sha256:c70a89b9e897fc354d56fb37373dc2cd2b1d99f671c9b678f5e354d6885e151b`
and episode
`sha256:ea2dffac1209fd962493797a6855d54b00b14ab07db2c928240ea4d2088671f3`.
It completed in seven calls and seven accepted effects with a complete ledger:
lens → open hypothesis → role search → inspection → exact failed test → close
falsified hypothesis → bounded exhaustion. It used 166,824 input, 1,666 output
and 697 reasoning tokens; two raw/qualified hits yielded no role pair and one
inspection. The hypothesis declared `DIFFERENT_TEST` against exact
`transfer-test:1`, correctly named no prior family, and became the first
observation in exact family `8a44266b…`. Its exact open-to-close span used five
calls and 120,661 input tokens. No prose similarity, semantic truth, scheduling,
certificate, execution or value-moving authority was introduced.

## Selection

`ADOPT`. The successful specimen satisfies the selection contract and reduced
the prior 14-call interrupted path to a seven-call complete experiment by
making intent, action order and exact binding first-party invariants. The next
frontier is not more prompt text: compare family intent with realized novelty
and search yield over later exact inputs, so `EXTEND`, `REPLICATE` and
`DIFFERENT_TEST` become measurable research behaviors rather than unchecked
self-description.

## Status

Selected `ADOPT`.
