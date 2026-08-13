# Mechanism-prototype-guided exploration

Status: active mainline construction

Issue: [#211](https://github.com/luokerenx4/my-little-pony/issues/211)

## Product question

How can retained semantic-mechanism learning cause genuinely new search without
turning the prototype into a popular-market claim template? The first accepted
prototype is grounded in two independent Iowa and Alaska seat-to-Senate-control
routes, but both examples inhabit almost the same election neighborhood. A
query for another state Senate race would increase sample count while teaching
almost nothing about whether the abstraction transfers.

The reusable product object is therefore not a claim. It is a bounded
**exploration lens**: one accepted mechanism prototype, its exact source input,
known positive members, falsifiers, and a declared variation axis applied to a
current anonymous market corpus. It asks an Agent to search outward and return
either exact unfamiliar trailheads or useful exhaustion. It cannot itself
admit a route, relation, probability, opportunity, certificate, or trade.

## Decision

Compile an immutable exploration brief from each accepted prototype and its
exact source input. The brief must preserve:

- the prototype invariant, typed signature, variable roles, transfer tests,
  counter-scenarios, and search signals;
- every known member route family and baseline listing ref as positive memory,
  but also as an exclusion set for the new search result;
- one explicit variation axis that states what kind of semantic mutation the
  search should attempt;
- one exact current corpus input revision and bounded evidence-reading tools;
- a terminal result that is either a new exact-ref trailhead with a stated
  structural analogy and broken surface similarity, or an exhaustion record
  that names searched neighborhoods and failed transfer tests.

Variation axes are search-routing constraints, not ontology truth. The first
provider-free portfolio should distinguish at least:

1. `AGGREGATE_INSTITUTION` — retain component-to-aggregate posture while
   changing the aggregate institution or chamber;
2. `SUBJECT_AND_GEOGRAPHY` — vary subject and component geography beyond every
   known member;
3. `SURFACE_DOMAIN` — seek an analogy outside the source market taxonomy while
   retaining the proposed mechanism and explicitly testing where it breaks;
4. `COUNTEREXAMPLE_FRONTIER` — search first for markets that defeat a transfer
   test, preserving useful negative memory even when no candidate survives.

Deterministic code may bind the prototype, exact corpus, exclusions, and
historical results. It may rank corpus neighborhoods using lexical and typed
signals. It may not decide that a new market instantiates the mechanism.
Agent-proposed trailheads must flow back through the existing ontology and
world-state research paths before they can become a route. Existing discovery
inspirations remain useful downstream routing objects, but their cross-lens
contract is not silently widened to claim prototype transfer.

## Phase 1 — provider-free lens substrate

- [x] Define strict content-addressed exploration-brief and exact input-revision
  contracts over an accepted prototype, its source input, current corpus, known
  listing exclusions, and one variation axis.
- [x] Materialize a small differentiated portfolio rather than four duplicate
  prompts; collapse axes that have no independently testable effect in the
  current corpus.
- [x] Derive bounded lexical trailheads from prototype signals and role values,
  while retaining zero-result neighborhoods and never using receive time alone
  as semantic input novelty.
- [x] Project eligible, attempted, successful, exhausted, novel-family and
  known/unknown usage counts with zero provider or model calls.

Live provider-free qualification binds the accepted prototype to four distinct
variation axes over the current 799-listing anonymous corpus. The first broad
ranking incorrectly promoted proper-name collisions such as Gavin
Newsom/Gavin Williams and Kamala Harris/Michael Harris. Reusing the existing
proper-name-neighbor ambiguity gate removed those false variations. Requiring
different titles to expose component and aggregate roles then removed same-
topic interval and outcome-family pairs. The remaining deterministic seed is a
useful counterexample: a New Hampshire Senate-seat outcome paired with U.S.
House control breaks institution-family transfer. It is retained only under
`COUNTEREXAMPLE_FRONTIER`; the three positive-search axes truthfully have zero
programmatic seeds.

Zero seed does not make a lens Agent-ineligible. Doing so would make code the
discovery authority and relegate AI to checking pre-enumerated pairs. All four
lenses remain manual research assignments over the exact corpus; `seeded` and
`eligible` are independent states. A refresh that changed only receive time,
raw hash and indicative prices produced a new auditable input revision while
preserving the price-independent semantic input identity, so it cannot silently
repurchase the same research.

## Phase 2 — Agent-first exploration loop

- [x] Add isolated tools to read the lens, search the exact assigned corpus,
  inspect bounded listing evidence, submit a novel trailhead, or record
  exhaustion.
- [x] Require every positive result to bind two or more exact listing refs,
  name the tested variation axis, explain the structural analogy, identify the
  surface difference, and apply the prototype's transfer tests and
  counter-scenarios.
- [x] Reject source-member refs, wholly source-member route families, unknown
  refs, uninspected refs, and results that merely restate the prototype label.
- [x] Persist full result/exhaustion bodies, exact input revision, run and tool
  lineage, searched neighborhoods, and repair friction in additive SQLite.
- [ ] Route accepted trailheads into the existing heuristic/ontology research
  ecology with search-routing authority only; semantic admission remains a
  separate Agent/reviewer decision.

## Phase 3 — bounded operation and selection

- [x] Add a paused, manual-only, once-per-lens campaign preview with one exact
  candidate, one concurrent run, and explicit request/token/time ceilings.
- [x] Expose the prototype → exploration lens → trailhead/exhaustion chain and
  separate prototype-authoring versus exploration cost in Studio.
- [x] Qualify one Terra/high specimen and pause immediately after its terminal
  observation.
- [ ] Compare a discovered route's family/taxonomy distance or the retained
  exhaustion against the two source members, then choose `ADOPT`,
  `PARTIAL_ADOPT`, `HOLD`, or `ABANDON` for recurring attention allocation.

The Agent-first loop is now runnable without widening free-text authority. Five
first-party tools expose the exact lens, exact-corpus search, bounded listing
inspection, trailhead retention, and evidence-bound exhaustion. SQLite schema
55 durably retains exact input revisions, positives, and negatives; restart
reconciliation repairs a partially applied v55 migration even when the database
version was advanced before the three tables existed. This regression was
observed on the live 3.3 GB volume and repaired without deleting or rebuilding
evidence.

Campaign selection freezes one semantic input into a content-addressed
campaign lineage. Provider price/raw/receive-time refreshes may create a newer
auditable input revision, but a selected run still loads the original retained
revision and its exact corpus snapshot. The Studio now shows all four lenses,
distinguishes programmatic seeds from Agent-only frontiers, exposes retained
positive/negative counts and attributed usage, and can create only a paused
campaign. Read qualification over the live corpus reports four eligible lenses,
one seed and three zero-seed frontiers with no provider or model call. Visual
qualification at the live Studio port shows a coherent two-column exploration
desk without console errors.

The first Terra/high specimen selected the seeded
`COUNTEREXAMPLE_FRONTIER`, completed in 142 seconds, and was immediately
paused. Six successful model invocations used 133,346 input, 1,550 output and
481 reasoning tokens. The Agent read the lens, ran two exact-corpus searches,
inspected the New Hampshire Republican Senate-winner and U.S. House Republican
control contracts, and retained a bounded exhaustion: the pair crosses Senate
and House institutions and therefore defeats shared-chamber transfer rather
than instantiating the prototype. Its first terminal attempt invented a transfer
test and was rejected by the first-party host; it repaired the exact test list
in-session. The run created no trailhead, semantic decision, probability,
certificate or execution action.

Catalog rotation during the live turn exposed an accounting distinction that
the first projection blurred. Lens history is now separate from current
semantic-input state: the counterexample lens reports one historical bounded
negative and one historically attempted semantic input, while a materially new
corpus semantic identity may remain eligible. Usage remains attributed to the
retained result even when the current input advances. This prevents both false
freshness (forgetting paid research) and false closure (letting an old corpus
exhaustion permanently stop a changed search space).

## Selection gates

- Reads, materialization, ranking, preview, and restart reconciliation start
  zero provider requests and model invocations.
- Known member route IDs and listing refs remain unchanged and are excluded from
  terminal positive results.
- A positive result must be exact-evidence-bound and novel on the assigned axis;
  textual similarity alone is insufficient.
- Exhaustion is retained as a productive result only when it names inspected
  evidence and failed transfer tests; generic “nothing found” text is rejected.
- Exploration output has search-routing authority only and cannot create a
  semantic decision, probability, opportunity, certificate, order, signature,
  transaction, external write, or value-moving action.
- Repeated corpus observations with the same normalized exploration input do
  not silently repurchase the same search.

## Non-goals

- generating fixed claims from every prototype variable combination;
- treating embedding or model similarity as mechanism admission;
- requiring every analogy to remain in elections or Senate-control markets;
- forcing a positive candidate when counterexamples or bounded exhaustion are
  the more informative result;
- recurring/concurrent campaigns before one attributed live specimen selects
  the operating policy.
