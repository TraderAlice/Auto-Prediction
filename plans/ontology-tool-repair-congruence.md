# Ontology tool contract and repair congruence

Status: active mainline construction

Issue: [#162](https://github.com/luokerenx4/my-little-pony/issues/162)

Branch: `codex/ontology-tool-repair-congruence`

## North-star role

An AI-native discovery machine cannot treat a tool manifest as documentation
and a private validator as the real contract. The model plans inside the former
and persistence is decided by the latter. Any mismatch becomes repeated repair
spend, not useful semantic search.

The first live V3 ontology qualification made this measurable. Terra/high read
the assigned trailheads, then ended `INTERRUPTED` after eight invocations and
149,864 / 2,700 / 1,939 known input/output/reasoning tokens. Six calls were
result repair. Three counterexample calls failed an unnamed item-count bound and
one failed assigned-scope validation. No result effect or mechanism route was
accepted. The validator correctly protected the ledger; the public tool schema
and feedback failed to make that boundary actionable.

A bounded follow-up qualification established two distinct facts. First, the
Codex app-server accepts the refined schema, including `minItems`, `maxItems`,
`uniqueItems`, enums, string bounds, nullable strings and hash patterns at
`thread/start`; schema lowering is therefore neither justified nor desirable.
Second, a fresh live run used the refined contract successfully for two
accepted evidence-read tools (37,647 input, 244 output and 59 reasoning tokens)
before the campaign's final two-invocation budget interrupted it. The two prior
zero-token protocol failures were transient and were made uninterpretable by a
real observability defect: the runtime replaced the protocol message with the
word `Error`. The transport and runtime now preserve bounded JSON-RPC
code/message detail for any recurrence.

## Ontology decision

A first-party Agent tool has one contract expressed through three congruent
surfaces:

1. **planning schema** — every expressible type, length, item-count, uniqueness,
   enum, and closed-object constraint is declared to the runtime;
2. **persistence validator** — exact lineage, assigned evidence, canonical
   identity, cross-field, semantic and authority constraints remain final;
3. **repair diagnostic** — a bounded machine-actionable explanation identifies
   the field, expected constraint and received posture without leaking secrets
   or weakening validation.

JSON Schema cannot prove that a reference belongs to the current assignment or
that two roles form a meaningful mechanism. Those remain first-party checks,
but rejection may safely return the bounded public listing references that were
outside the exact assignment.

## Phase 1 — contract inventory

- [x] Inventory every V1/V2 ontology result field against its runtime validator.
- [x] Add reusable closed text/array/ref schema builders with explicit bounds.
- [x] Preserve byte-compatible task and result artifacts; tool schema refinement
  must not rotate retained business identities.

## Phase 2 — actionable rejection

- [x] Replace generic item-count diagnostics with exact minimum, maximum and
  received counts.
- [x] Return bounded unknown assigned-evidence references for scope failures.
- [x] Keep diagnostics deterministic, length-bounded and free of credentials or
  opaque runtime internals.
- [x] Preserve rejected effect lineage and RESULT_REPAIR attribution.

## Phase 3 — repair qualification

- [x] Prove declared schemas expose counterexample minimum-two and all maximum
  bounds to Codex, Pi and in-process runtime adapters unchanged.
- [x] Prove malformed and out-of-scope calls still persist no proposal.
- [x] Prove exact feedback allows a same-thread synthetic repair to reach an
  accepted result without widening scope or count limits.
- [x] Run one manually authorized, concurrency-one Terra/high V3 ontology task
  and compare accepted effects, repair calls and token cost with the live
  149,864-input-token negative baseline.

## Phase 4 — mechanism-yield interpretation

- [x] Separate `accepted ontology result` from `mechanism proposal`; a suitable
  counterexample or ordinary proposition is valid yield.
- [ ] Attribute mechanism-tool inspection, proposal, rejection and accepted
  route cost without claiming the model should force a mechanism.
- [x] If structurally successful runs never inspect mechanism coverage, treat
  tool choice/prompt topology as the next experiment rather than relaxing
  validation.

## Non-goals

- increasing run budgets to overpower malformed tool calls;
- accepting free-form completion text as a result;
- making every ontology issue produce a world-state mechanism;
- moving entity, semantic, probability, certificate, campaign, execution or
  trading authority into the model;
- live orders, credentials, signatures, approvals, transactions or funds.
