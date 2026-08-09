# Heuristic-origin discovery

Status: implemented and live-qualified; comparative yield remains an ongoing measurement

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
- A v7 search lease copies the issue mode into immutable execution lineage.
- A v3 semantic-family retrieval plan binds `routingMode` and prohibits query
  signals for `HEURISTIC_FIRST` selection.
- Existing v1/v2 issues and v1-v6 leases remain valid and are attributed as
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

Focused control-plane tests cover query independence, rarity sampling, origin
partitioning, legacy replay, and SQLite restart. All 19 workspace checks and 563
workspace tests pass, as do the Studio production build and its ten focused
tests. In-app browser inspection at desktop and 390 px shows the two lanes,
current program labels, and origin yield without horizontal overflow; visible
text remains at least 12 px.
