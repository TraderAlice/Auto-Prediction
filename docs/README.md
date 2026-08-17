# Documentation

This index separates product explanation, operator instructions, stable
architecture, and evolving research evidence. Start with the row matching what
you are trying to do; the `plans/` directory is intentionally not the primary
onboarding surface.

## Start here

| Audience / task | Document | What it answers |
| --- | --- | --- |
| New reader | [Concepts](CONCEPTS.md) | What is a prediction market in this system, and what counts as an opportunity? |
| Operator | [Operations](OPERATIONS.md) | How do I install, run, configure, and qualify the local system? |
| Operator | [Auto Prediction Studio](STUDIO.md) | What do the desks show, and what actions are safe? |
| Contributor | [Architecture](ARCHITECTURE.md) | Where are the authority boundaries and major data flows? |
| Contributor | [Project format](PROJECT_FORMAT.md) | Where does each kind of source or evidence belong? |
| Automation / tooling | [CLI](CLI.md) | Which machine-readable commands exist today? |
| Research collaborator | [Active plans](../PLANS.md) | Which product proposition and experiment are currently selected? |
| Operator support | [Questions](../QUESTIONS.md) | Which non-blocking decisions are waiting for batch input? |

## Design references

These documents describe focused, relatively stable contracts. When a design
document disagrees with executable code or a retained qualification artifact,
the executable evidence wins and the document should be corrected.

- [AI discovery and control plane](design/ai-discovery-and-control-plane.md)
- [Live evidence and authority](design/live-evidence-and-authority.md)
- [Claim, resolution, and outcome model](design/claim-resolution-outcome-model.md)
- [Payoff and arbitrage certificates](design/payoff-and-arbitrage-certificates.md)
- [Realtime book evidence](design/realtime-book-evidence.md)
- [Venue protocol ports](design/venue-protocol-ports.md)

## Evidence and research

- `projects/venue-research/` contains dated official-source censuses and venue
  qualification notes.
- `projects/fixtures/` contains small immutable raw protocol fixtures and their
  provenance.
- `projects/campaigns/` contains content-addressed replay, shadow, and
  architecture-qualification artifacts.
- [`PLANS.md`](../PLANS.md) is the current plan ledger; files under `plans/`
  retain the evidence and decisions behind each generation.
- [`QUESTIONS.md`](../QUESTIONS.md) is the non-blocking operator support queue.

## Source-of-truth order

For release and maintenance decisions, prefer evidence in this order:

1. first-party tests and exact verifier output;
2. content-addressed fixtures and campaign artifacts;
3. current control-plane projections and durable SQLite effects;
4. stable documents in `docs/`;
5. active and historical plan narratives;
6. the original design brief.

The lower layers explain intent; they do not override newer executable
evidence.
