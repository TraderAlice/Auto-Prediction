# Hypothesis intent realization

Issue: https://github.com/luokerenx4/my-little-pony/issues/233

## Decision

Treat Agent-declared family intent as a hypothesis about research behavior, not
as proof that novelty or replication occurred. Compile a provider-free report
for each closed V11 hypothesis by joining its exact effect window to durable
role-search observations:

- `EXTEND` compares the current exact listing/pair frontier with the named prior
  family and asks whether a new semantic input added exact evidence coordinates;
- `REPLICATE` rewards an independent exact input/run even when the evidence
  frontier intentionally overlaps;
- `DIFFERENT_TEST` compares against sibling families on the same prototype/axis
  and asks whether the different exact test reached new evidence coordinates;
- absent comparison evidence is `UNMEASURABLE`, not guessed from prose.

Reports expose reference-family counts, exact overlap/new listing and pair
counts, input/run independence, realized classification, hypothesis-span yield
and token cost. Raw refs remain in the durable role-search observations; the
public report carries bounded counts and hashes. It has no scheduling, semantic,
probability, certificate, execution or value-moving authority.

## Selection

Adopt when retained V11 live evidence produces a replay-stable report whose
identity and counts survive restart, and when fixture tests distinguish useful
replication from failed extension. Reject if prose similarity or current-corpus
state enters the comparison, or if the report silently becomes an attention
policy.

## Live evidence

The provider-free V3 memory projection compiles two retained V11 declarations
from the same prototype and `SURFACE_DOMAIN` axis:

- interrupted revision-14 hypothesis `0e759cb3…` is `UNMEASURABLE`: at its
  completion time no earlier sibling exact-test family existed. Its window used
  11 calls / 335,843 input, reached one exact listing ref and no pair, and had no
  accepted terminal;
- selected revision-15 hypothesis `3cf35b27…` is
  `REALIZED_DIFFERENT_TEST`: against the now-earlier sibling family it reached
  two exact listing refs, one overlapping and one new, on an independent exact
  semantic input and run. Its hypothesis window used five calls / 120,661 input
  and closed into accepted exhaustion.

The comparison is causally truncated at each episode completion time, so later
families cannot rewrite an earlier experiment with hindsight. A control-plane
restart added four newly reconciled retained inputs and therefore correctly
changed the parent projection identity, while both realization report IDs,
classifications and comparison counts remained unchanged. Studio presents run
status and terminal outcome beside the realized classification.

## Selection result

`ADOPT`. Exact evidence coordinates distinguish a cheaper realized exploration
from an earlier expensive but then-unmeasurable declaration. Fixture policy
tests separately prove that an independent `REPLICATE` can be realized with no
new refs, while an `EXTEND` with no frontier change cannot. No report can affect
scheduling or semantic admission.

## Status

Selected `ADOPT`.
