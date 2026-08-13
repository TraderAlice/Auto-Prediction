# World-state mechanism prototypes

Status: active mainline construction

Issue: [#207](https://github.com/luokerenx4/my-little-pony/issues/207)

## Product question

What should the reusable unit of semantic-arbitrage search be? A concrete
route such as “Alaska Republican Senate-seat win influences Republican Senate
control” is evidence-bound and observable, but too specific to transfer its
learning. A phrase such as “component influences aggregate” transfers, but is
too weak to be useful or falsifiable by itself.

Live evidence supplies the first bounded middle ground. The retained Iowa
Democratic and Alaska Republican routes have distinct subjects, state labels,
relation-pattern IDs and listing evidence. They nevertheless share the typed
causal posture `MAY_ENABLE_STATE / OFFICE_HOLDING /
STATE_INFLUENCES_LIKELIHOOD / TRIGGER_OVERLAPS_DEPENDENT` and both connect one
component seat outcome to a chamber-wide control outcome.

## Decision

Keep concrete route families unchanged as exact world/evidence instances. Add
a second, explicitly proposed **mechanism prototype** layer over two or more
route families. A prototype binds:

- exact member route-family IDs;
- invariant trigger, state, dependent and temporal roles;
- named variable slots whose values differ across instances;
- an abstraction label and bounded search vocabulary;
- counter-scenarios that would falsify transfer to another instance.

Deterministic code may identify compatible comparison sets from typed route
fields, but it may not erase names from prose or declare semantic equivalence.
An Agent must propose the abstraction via a first-party tool, or retain an
abstention. Both outcomes remain research memory with no probability,
certificate, execution, external-write or value-moving authority.

## Phase 1 — provider-free comparison substrate

- [x] Define a content-addressed prototype-candidate cluster over at least two
  independent concrete route families.
- [x] Use typed route posture as the strict compatibility floor while retaining
  every concrete predicate, subject and evidence binding for Agent inspection.
- [x] Materialize one stable prototype-research task per candidate identity and
  one exact input revision when member routes change.
- [x] Project candidate count, member diversity, retained outcomes and known
  Agent cost with zero provider/model calls.

Live qualification materializes one candidate from the two retained routes. It
binds two route families, two authoring runs and two proposals under typed
signature `MAY_ENABLE_STATE / OFFICE_HOLDING /
STATE_INFLUENCES_LIKELIHOOD / TRIGGER_OVERLAPS_DEPENDENT`. Its stable task is
registered under a dedicated Terra/high execution profile. At that phase it
remained campaign-ineligible; schema 54 and the Agent tools now make the exact
unexplored input eligible only for a manually created paused campaign. The read
projection starts no provider or model request and attributes 252,178 /
4,719 / 1,357 known input/output/reasoning tokens across twelve historical
authoring invocations, with zero unknown-usage invocations. Concrete route
families and their prior projections are unchanged.

## Phase 2 — Agent-first prototype proposal

- [x] Add an isolated tool protocol to list the assigned candidate, read exact
  member routes, propose a parameterized prototype, or abstain.
- [x] Require every invariant and variable slot to be grounded in the assigned
  member routes; reject unbound route IDs and one-instance abstractions.
- [x] Persist full proposal/abstention bodies, source input revision, run ID and
  immutable member-route identities in SQLite.
- [x] Preserve result repair as a same-run tool loop; free text has no result
  authority.

The result protocol now exposes exactly three tools: read the exact comparison,
submit one parameterized prototype, or retain an abstention. Variable slots
must cover every route family, vary across at least two values, and match the
corresponding subject, trigger, state, or dependent route text. SQLite schema
54 retains exact inputs, proposals and abstentions independently, checks their
task/run lineage, and rebuilds proposals against the exact input before
admission. Content-hash validation is repeated after restart.

## Phase 3 — bounded operation and product surface

- [x] Add a paused, manual-only, once-per-task campaign preview that freezes one
  exact unattempted candidate and never auto-dispatches.
- [x] Add route-instance versus prototype projections and usage/yield
  scorecards to the control-plane API and Studio.
- [ ] Qualify the first prototype decision against the Iowa/Alaska candidate
  using Terra/high and pause immediately after the terminal observation.
- [ ] Use accepted prototype, abstention, repair friction and exact token/runtime
  cost to decide whether prototype-driven search should enter attention
  allocation.

The current preview freezes candidate `sha256:83b564…` and input revision
`sha256:b86969…` under one paused manual campaign. It permits one concurrent
run, eight model invocations, 200,000 input tokens, 20,000 output tokens and
600 seconds total wall time. Preview reads remain zero-call. Studio now shows
concrete routes and prototype candidates as distinct layers with exact inherited
authoring cost; visual inspection found no console errors and the new panel
uses the existing product typography and spacing system.

## Selection gates

- Concrete `routeFamilyId`, proposal, evidence and observation history remain
  byte-for-byte unchanged by prototype construction.
- Input permutation cannot change candidate/prototype identities.
- A candidate requires at least two distinct concrete route families and two
  distinct source Agent runs.
- Typed compatibility is retrieval evidence, not semantic identity.
- Reads, previews and materialization start zero provider requests and model
  invocations.
- Prototype acceptance cannot create probability estimates, opportunities,
  certificates, orders, signatures, transactions or fund movement.

## Non-goals

- deriving prototypes by regex-based removal of state, party or person names;
- treating a shared state dimension as sufficient semantic equivalence;
- automatically approving subject bindings or transfer to unseen markets;
- using model confidence as admission authority;
- recurring or concurrent prototype campaigns before one live specimen is
  attributed end to end.
