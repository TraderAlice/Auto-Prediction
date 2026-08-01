# AI-native Market Archaeologist Campaign

Status: active
Started: 2026-08-01

## Outcome

Make semantic market discovery AI-native: programs acquire, freeze, index, and
verify evidence; an agent owns the open-ended search for relationships across
markets. Every result remains an unreviewed research proposal.

## Architecture decision

Programmatic pair generation is a useful blocking optimization, but it is not
the discovery authority. Event meaning spans entities, actions, time windows,
resolution sources, thresholds, exceptions, and venue-specific rules. The
primary discovery loop therefore starts with an agent exploring a complete,
content-addressed market corpus. Deterministic code resumes authority at input
validation, evidence binding, relationship verification, pricing, fees, risk,
and certification.

The two AI lanes have different jobs:

- Vercel AI SDK: cheap structured transformations such as query expansion,
  ranking, and bounded classification.
- pi: recursive research over MarketFS when the work cannot be reduced to one
  request in advance.

Neither lane can review its own work, compile a certificate, or execute.

## Phase 1 — searchable market repository

- [x] Freeze all fresh eligible public listings into `pmh.market-corpus.v1`.
- [x] Bind the corpus to observation identities, protocol identities, receive
  times, normalized contents, and one deterministic snapshot identity.
- [x] Provide bounded literal/regular-expression search and exact listing
  retrieval without exposing credentials or write capabilities.
- [x] Materialize an ephemeral MarketFS view for pi with stable paths and an
  NDJSON index. Venue text is marked untrusted data.

## Phase 2 — agent-owned discovery loop

- [x] Let pi recursively use read/find/grep/list over the complete MarketFS
  snapshot instead of receiving a preselected 30-listing context.
- [x] Emit typed relation proposals: equivalent, implication, subset,
  mutually-exclusive, exhaustive, conditional, related, or conflicting.
- [x] Bind every proposal to exact listing refs and the corpus snapshot; retain
  falsifiers, rule differences, and missing evidence.
- [x] Serialize runs, cap output/time/retention, and keep model output
  `PROPOSE_ONLY`, `UNREVIEWED`, and non-executable.

The recursive lane uses medium reasoning and at most five relation proposals per
run. A trailhead scopes attention but never narrows the searchable corpus.

## Phase 3 — scheduling and product surface

- [x] Add an opt-in interval scheduler that runs only for a changed eligible
  corpus, never overlaps, and is disabled by default.
- [x] Expose corpus/search/run state in the control plane and Studio.
- [x] Run one operator-triggered investigation against the real anonymous
  corpus and preserve its exact outcome without promoting it.

## Later phases

- Add Vercel AI SDK query expansion before pi for cheap breadth.
- Use prior investigations and changed-listing diffs to choose seeds.
- Convert supported accepted relations into deterministic payoff constraints.
- Add independent semantic review and adversarial counterexample agents.
- Measure useful-lead yield, false-positive classes, latency, and model cost
  without turning model confidence into authority.

## Safety invariants

- Anonymous public acquisition only.
- No production credentials, orders, signatures, approvals, token movement, or
  live execution.
- Temporary MarketFS files contain only frozen public catalog evidence and are
  removed after the run.
- The agent receives no shell, write, extension, skill, or session capability.
- A proposal can become a certificate only through separate first-party exact
  verification after independent semantic review.

## Findings log

- 2026-08-01: A broad, high-reasoning whole-corpus run reached the 300-second
  boundary and failed closed. Recursive discovery now defaults to medium
  reasoning, starts from an operator/scheduler trailhead, searches the complete
  corpus, and emits at most five relationships.
- 2026-08-01: The real fresh snapshot binds 314 listings from six eligible
  anonymous sources. A BTC-trailhead run completed in 194 seconds and published
  five unreviewed relationships under artifact
  `sha256:3faec2c7875855e1a6a08f9fcf995fed49c332e636229055e2bbd488c27826f1`.
  It rejected title-level equivalence and surfaced strict Pyth `>` versus
  inclusive Chainlink `>=`, time-window, source, and outage/void differences.
- 2026-08-01: The checkpoint passes 224 workspace tests, full typecheck, and
  production build under Node.js 24.14.0. Desktop and 430px Browser inspection
  show no console warnings/errors or horizontal overflow; the 430px document
  has `scrollWidth === clientWidth === 415`.
