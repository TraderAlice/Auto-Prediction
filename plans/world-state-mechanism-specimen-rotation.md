# World-state mechanism specimen rotation

Status: active mainline construction

Issue: [#199](https://github.com/luokerenx4/my-little-pony/issues/199)

## Product question

The current ontology window contains eight structurally diverse world-state
mechanism candidates, but the campaign budget is global: eight model
invocations and 200,000 input tokens across the entire campaign. The one
productive historical mechanism run used seven invocations and 148,341 input
tokens. Freezing all eight candidates into that campaign therefore presents a
portfolio that the execution budget cannot actually explore and gives the
first sorted task nearly all effective attention.

## Decision

Keep the eight-action provider-free allocation as the comparative attention
portfolio. Freeze exactly one previously unattempted selected action into each
manual mechanism campaign. Any terminal campaign run—successful, failed,
interrupted, or cancelled—moves that exact task out of the next specimen
preview. The next preview selects the next action in the allocator's
deterministic ranked order.

This is not a retry scheduler. A terminal no-result is useful negative evidence
and causes exploration to rotate. The campaign remains paused on creation,
manual-only, concurrency-one, once-per-task-per-lineage, exact-revision bound,
and incapable of automatic dispatch, semantic approval, trading, external
writes, or value movement.

## Phase 1 — honest executable selection

- [x] Preserve allocator ranking order separately from display grouping.
- [x] Bind one exact allocation action and input revision per campaign preview.
- [x] Give the specimen-selection policy its own content identity so a one-task
  binding cannot masquerade as the full allocation projection.
- [x] Expose selected, attempted, frozen and deferred counts without a model
  call.

The implementation revealed that `selectedActions` previously inherited the
display projection's mechanism-issue hash order even though selection itself
was built in structural rank order. It now retains the actual deterministic
allocator order; the complete `actions` list remains disposition-grouped for
inspection.

## Phase 2 — terminal-attempt rotation

- [x] Recognize only terminal runs authorized by a selection-bound world-state
  mechanism campaign as specimen attempts.
- [x] Skip attempted selected task IDs and choose the next ranked action.
- [x] Derive a new campaign/selection identity from allocation, policy and the
  one chosen action.
- [x] Verify that two catalog snapshots of one stable issue do not create false
  rotation candidates.
- [x] Qualify the preview and rotation against the live SQLite ledger.

The live schema-53 ledger projects 64 eligible assignments and eight selected
portfolio actions, while preview v2 freezes only the highest-ranked unattempted
specimen: Andrea Kimi Antonelli as Dutch Grand Prix winner versus 2026 Formula
1 Drivers' Champion. Seven selected actions are explicitly deferred. No current
selected task has a terminal mechanism-campaign attempt; the retained Iowa
mechanism run belongs to covered historical lineage and does not consume a new
specimen. The preview remained at zero provider requests and model invocations.
Capability was correctly blocked only because its prior zero-inference
preflight observation had expired.

## Phase 3 — bounded Agent observation

- [ ] Refresh the configured Terra/high capability without inference.
- [ ] Create and inspect one paused exact specimen campaign.
- [ ] Activate and dispatch once under an explicit research reference, then
  pause the campaign after the terminal observation.
- [ ] Attribute accepted proposal, falsifier, abstention, no-result and exact
  token/runtime cost before selecting the next engineering change.

## Construction qualification

Workspace type checks, 105 control-plane files / 700 tests, five Studio files /
30 tests and the production Studio build pass on the available Node 22 host.
The known Node 24 engine expectation and existing Studio chunk-size warning
remain; neither is introduced by this change.

## Selection gates

- One campaign must advertise exactly the amount of work its whole-campaign
  budget is designed to support.
- Replay and input permutation must preserve portfolio and specimen order.
- An active or prepared run is not yet a completed observation and must not
  rotate the preview.
- A manual run outside the immutable mechanism campaign protocol must not
  consume a campaign specimen.
- Read and preview paths must start zero provider requests, model invocations,
  campaigns and runs.

## Non-goals

- automatic campaign creation, activation, dispatch or recurrence;
- interpreting an Agent proposal as semantic truth or an arbitrage certificate;
- choosing candidates by model confidence;
- retrying terminal attempts because a catalog refresh or clock interval passed;
- live orders, signatures, transactions, credentials or funds.
