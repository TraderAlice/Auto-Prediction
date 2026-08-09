# Traded-state premise route expansion

Status: qualified — HOLD

Created: 2026-08-10

## Product problem

Premise evidence routing now identifies traded markets that may turn an
otherwise subjective causal premise into an explicit Boolean state. A candidate
may be a newly discovered market, or an existing member of the source relation
whose meaning changes once it is bound to the hidden premise. The route artifact
is still only advice: no durable worker consumes that binding, no reformulated
relation proposal is produced, and independent semantic review therefore has
nothing new to admit or reject.

The live route portfolio contains three `TRADED_STATE_CANDIDATE` groups versus
one contract-rule group. The rule group currently points at Gemini catalog text
without a typed rule-document locator, so pretending that the document
acquisition pipeline can execute it would create an `UNSUPPORTED` dead end. The
strongest executable next slice is traded-state expansion.

## Decision

Add a durable route-expansion scheduler. For each current passing traded-state
group it builds one exact, retained corpus containing the original proposal
listings and any additional Agent-observed candidate listings. It then asks the
existing Pi Market Archaeologist to bind the hidden premise to the candidate
traded state and reformulate the relation. The output remains an ordinary unreviewed proposal with its own immutable
evidence bundle, so the existing independent semantic-review scheduler—not the
route Agent or expander—decides whether the relation survives.

The expansion question is content-addressed and includes the original thesis,
the premise propositions assigned to the group, the router's evidence question,
and an explicit falsification-first instruction. The scheduler never asks Pi to
confirm the old proposal. Zero proposals is a valid terminal PASS and selection
evidence that the candidate market did not repair the relation.

## Persistence and budget

- One job scope is keyed by source route group and expander identity. The
  terminal artifact is additionally bound to the exact corpus it inspected.
- The job retains that corpus and source route lineage before any provider
  request, leases durably, survives restart, and permits at most two attempts.
- A retained PASS or EXHAUSTED job cannot replay because prices or the ambient
  market catalog change.
- Concurrency is one. Automatic dispatch is separately configurable and uses
  the existing Pi/DeepSeek Market Archaeologist supply.
- The resulting Market Archaeologist run and proposal evidence bundles remain in
  their existing first-party stores. The expansion job stores only their hashes
  and proposal IDs as downstream lineage.

## Authority boundary

Expansion may read retained anonymous market evidence and invoke Pi. It may only
propose relations. It cannot accept a semantic relation, mutate the source
premise capsule, simulate, certify, notify as an opportunity, or execute an
order. New proposals re-enter every existing independent gate.

## Product handoff

Studio must show, per evidence route:

- whether exact-ref expansion is pending, running, exhausted, or complete;
- how many candidate listings were inspected, including candidates already in
  the source relation;
- whether Pi produced zero or one-or-more new proposals;
- that the next gate is independent semantic review;
- provider-attempt budget without exposing prompts or model output.

The route card remains collapsed by default. Humans and browser Agents should
be able to distinguish “Agent suggested a market,” “Pi reformulated the state
space,” and “first-party review accepted it” without reading internal tables.

## Qualification

- Validator tests cover exact source-route lineage, bounded exact corpora,
  candidate inclusion (both overlapping and additional refs), closed authority
  fields, and tamper rejection.
- Scheduler tests cover lease, retry, terminal zero-yield PASS, proposal-yield
  PASS, restart replay, and no replay after ambient corpus changes.
- Integration tests prove generated proposals become ordinary semantic-review
  candidates and receive no shortcut authority.
- Live qualification executes the three retained traded-state groups, measures
  proposal yield and downstream review yield, and records token cost.
- Studio desktop and compact views are inspected in a browser with overflow,
  console, and route-state checks.
- Node 24 full checks, workspace tests, and production build pass.

## Selection rule

Adopt expansion as a persistent lane only if at least one live group produces a
new, independently reviewable relation or useful falsification at acceptable
cost. If all three yield zero proposals or only restate the source relation,
retain the jobs as negative evidence and improve route quality before adding
more model supply.

## Live selection evidence — 2026-08-10

- All three current traded-state groups executed against their exact retained
  two-listing corpora. One ended PASS with zero proposals; two each produced one
  reformulated `MUTUALLY_EXCLUSIVE` proposal.
- Both generated proposals inherited the source search issue and priority and
  entered the ordinary semantic-review scheduler. First-party scope derivation
  classified both as `DUPLICATE_SCOPE`: same exact contracts, same relation
  kind, and unchanged contract semantics. No extra reviewer request was spent.
- The first attempt exposed a real shared-contract defect rather than a model
  failure: 2.3–2.6k character reformulation questions exceeded the Market
  Archaeologist record's old 1k persistence bound after Pi had already returned.
  The bounded question contract is now 8k at both invocation and persistence,
  storage errors retain their underlying diagnostic, and the worker identity was
  versioned before replay.
- The scheduler, SQLite lineage, API, and Studio visibility remain useful as an
  evaluable lane, but automatic dispatch is now opt-in. Selection outcome is
  `HOLD`: improve router criteria so a candidate changes refs or relation kind
  before buying more Pi supply for this portfolio.
