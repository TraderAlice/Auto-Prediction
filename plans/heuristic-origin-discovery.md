# Heuristic-origin discovery

Status: coherent trailhead construction is implemented and live-qualified

Created: 2026-08-09

## Product problem

The scheduler currently persists every recurring search as an issue with a
question. Even broad semantic-family issues are routed toward terms from that
question when a match exists. This makes claim-shaped work the implicit source
of discovery and biases spend toward familiar, easy-to-name market clusters.
The deterministic family ranker already produces unusual neighborhoods, but it
is not a distinct product lane and its yield cannot be compared with operator
claim monitoring.

## Decision

Discovery has two explicit origins:

- `HEURISTIC_EXPLORATION` starts from corpus structure. It ranks fresh rare
  entity/time/mechanism neighborhoods without query-term preference, rotates
  through retained routing and semantic feedback, and asks the Agent to form or
  falsify a claim only after inspecting exact listings.
- `CLAIM_MONITORING` starts from an operator or product hypothesis. It may use
  query signals to retrieve the most relevant neighborhood and remains useful
  for scheduled monitoring, regression, and known constraints.

The five managed semantic-family programs become heuristic exploration. Legacy
and manually created question issues remain claim monitoring. Origin is bound
to the durable issue, search lease, and retrieval plan so restart and historical
analysis do not infer it from mutable UI labels.

## Artifact and scheduling contract

- A v3 search issue binds `discoveryMode` into its definition and identity.
- A v8 search lease copies the issue mode into immutable execution lineage and
  keeps graph refs outside the assigned context as lineage-only evidence.
- A v4 semantic-family retrieval plan binds `routingMode` and prohibits query
  signals for `HEURISTIC_FIRST` selection.
- Existing v1/v2 issues and v1-v7 leases remain valid and are attributed as
  claim monitoring; managed v2 family issues are superseded, not rewritten.
- Scheduler performance reports retained terminal yield separately by origin:
  scans, fresh candidates, proposals, falsifications, provider requests and
  failures, Agent tool calls, and Pi escalations.

Scores and origin labels are routing evidence only. They grant no semantic,
probability, certificate, simulation, or execution authority.

## Studio contract

Market Archaeologist must explain the exploration/monitoring split before the
dense issue ledger. It shows origin-specific yield and labels every program.
The manual creation form is explicitly a claim monitor, preventing an operator
question from masquerading as open-ended exploration.

## Qualification

- A query mentioning a common market can change claim-monitoring selection but
  cannot change heuristic-first rank order for the same corpus and feedback.
- Fresh heuristic neighborhoods rotate after retained routing/semantic feedback.
- Search issue, lease, retrieval plan, SQLite restart, and projection preserve
  origin exactly; legacy artifacts continue to validate.
- Origin summaries partition all retained issue leases without double counting.
- Desktop and 390 px Studio views explain both lanes without horizontal
  overflow, and program controls remain operable.
- Workspace checks, focused tests, Studio tests, and production build pass.

## 2026-08-09 live checkpoint

The 799-listing, seven-source process migrated the five managed semantic-family
programs to `HEURISTIC_EXPLORATION` without rewriting older issue or lease
artifacts. A clean restart retained 18 issue records, hid six superseded
revisions from the operating list, and showed twelve current programs: five
exploration programs and seven claim monitors.

The first origin-attributed window contains five heuristic scans and 34 claim
monitor scans. The heuristic lane spent four provider requests and created no
candidate or Pi escalation; the claim lane's historical window contains ten
novel signatures, 16 falsifications, 29 deep proposals, 112 provider requests,
and twelve Pi escalations. These windows are not a quality comparison yet—the
claim lane includes older traffic—but they prove the two sources no longer
collapse into one denominator.

Live v7 evidence includes a physical-co-occurrence exploration lease with
`HEURISTIC_FIRST` routing and an 18-listing corpus rarity sample, while a
House-control monitor retained `QUERY_FIRST` and selected its query-relevant
partition neighborhood. The first exploration window produced no useful lead;
that negative result remains the correct baseline rather than being presented
as an arbitrage opportunity.

## 2026-08-09 trailhead-quality finding

The first live fallback was reproducible but not coherent. Its unnormalised
rarity sum preferred verbose Kalshi multigame titles, so one 18-listing context
contained many unusual but unrelated contracts. The model then received prior
semantic-graph refs in its question even when those refs were outside the
assigned context; retained traces show `UNKNOWN_LISTING` tool rejections and
wasted provider steps.

The next retrieval revision therefore replaces the rarity sample with a typed
heuristic trailhead:

- one rare, family-cued seed listing;
- bounded rare signals that explain why the seed was selected;
- lexically and structurally related neighbors ranked around that seed, with a
  cross-venue preference but no requirement that hides same-venue relations;
- a content identity, exact refs, routing-only authority, and feedback-driven
  rotation as durable evidence.

Rarity is normalised by title-token count so verbosity is not novelty. A graph
neighborhood remains immutable lease lineage, but only relations whose complete
ref set is readable in the current context may enter the Agent prompt. Excluded
graph refs are not silently treated as inspectable. Studio must show the seed,
signals, neighbor count, and graph-ref readability on each recent lease.

Live requalification on the 799-listing corpus selected
`gemini-predictions:GEMI-HORMUZNORMAL-APRIL15` as the seed and ten other Hormuz
deadline contracts as its related neighborhood. The Agent completed explicitly
in three tool steps with one accepted catalog read, no `UNKNOWN_LISTING`
rejection, no proposal, and no Pi spend. This is a coherent negative scan, not
an arbitrage claim. It also shows the next architectural gap: a physical-lane
scan can discover a useful implication-shaped neighborhood. Cross-lens
inspiration must become a first-class durable effect rather than being lost as
an empty family-constrained result.

Focused control-plane tests now cover query independence, rare-seed
neighborhoods, inaccessible graph refs, origin
partitioning, legacy replay, and SQLite restart. All 19 workspace checks and 564
workspace tests pass, as do the Studio production build and its ten focused
tests. In-app browser inspection at desktop and 390 px shows the two lanes and
the stable latest-trailhead card with no horizontal overflow, no console errors,
and visible text of at least 12 px.

## 2026-08-09 product-entry correction

The Studio itself still contradicted the architecture: it opened on a system
overview whose primary scout action submitted a hard-coded Boston temperature
question. That made a legacy claim-shaped demo the default product behavior
even though scheduled discovery was already heuristic-first.

Studio now opens on Discover. Its primary action issues the next bounded search
lease, allowing the scheduler to choose a fresh corpus trailhead before the
Agent forms a claim. Operator-authored questions remain available as explicit
claim monitors and ad-hoc investigations, but neither is presented as the
default way to find an opportunity.

## 2026-08-10 selection-pressure clarification

Operator review sharpened the reason this separation matters. Claim-first is
not merely one more discovery input: it systematically selects markets that are
easy for many participants to name, search, and monitor. Those crowded semantic
neighbourhoods can still contain opportunities, but the product should not
spend its default search budget reproducing the market's most obvious queries.

The default lane therefore remains heuristic-origin in both architecture and
presentation. Corpus rarity, odd co-occurrence, timing tension, rule changes,
and cross-lens inspirations produce trailheads; an Agent earns a claim only
after reading the exact contracts. Claim monitoring is explicitly secondary
and lives with search operations, where it remains useful for operator ideas,
regression cases, and scheduled re-checks.
