# Auto Prediction — Collaboration Ledger

This repository is a pre-alpha, research-first interoperability harness. It must never place a live order, sign a transaction, approve a token, move funds, or request/store production trading credentials unless the user separately and explicitly expands authority.

## Working rules

- Treat official venue documentation, schemas, contracts, and anonymous public API responses as protocol evidence.
- Preserve raw fixtures byte-for-byte and bind normalized data to source, receive time, protocol identity, and a content hash.
- Core monetary values, prices, quantities, fees, payouts, and PnL use `bigint` fixed-point values, never JavaScript `number`.
- Solvers propose candidates. Only the first-party exact verifier may publish a certificate.
- Venue SDK and generated API types stay inside their adapter package.
- Live execution is disabled by construction and by policy. Tests must prove this.
- Read `PLANS.md` before non-trivial construction; it indexes the active plan
  under `plans/` when one exists and defines when completed plans should be retired.
- Update `PLANS.md` and the active file under `plans/` when evidence changes a decision.
- Put non-blocking user decisions in `QUESTIONS.md` for batch support and remove
  each question as soon as it is answered or no longer needed.
- Do not create placeholder packages. A package must own working source and focused tests.

## Mutation development

This repository has two development lanes:

- **Mainline work** advances the selected product direction incrementally. Keep
  it serial, verified, and aligned with the active plans.
- **Mutation work** deliberately explores a materially different product
  proposition, behavior, architecture, interface, Agent topology, or operating
  model. A mutation may add, remove, replace, simplify, or reorganize; novelty
  is not required to be additive.

A mutation is a candidate under selection, not a feature presumed to merge.
Use GitHub issues as the problem/evidence ledger and pull requests as runnable
mutation specimens.

### From problem to candidate

- Start from a GitHub issue describing an observed problem, or state the deeper
  product proposition explicitly when it spans or precedes individual issues.
- Record why the current local optimum may be insufficient, what evidence
  motivated the exploration, and which observation would make the mutation
  worth adopting or abandoning. Do not disguise a predetermined implementation
  as a problem statement.
- One issue may produce competing mutations, and one mutation may address
  several issues. Preserve these links rather than forcing a one-to-one map.
- Use `codex/mutation-<short-name>` for the branch and prefix the pull request
  title with `[mutation]`.

### Mutation pull-request contract

Every mutation pull request must make it possible to evaluate the idea without
first accepting it. It must state:

- the issue or underlying product proposition it serves;
- the mutation thesis and how it materially differs from the current system;
- what it adds, removes, replaces, or restructures;
- expected value, failure modes, operational and AI/token cost, and reversibility;
- the evidence or selection signals available now and the evidence still missing;
- focused verification and any deliberate incompatibility with other candidates.

Mutation code must still respect the repository authority boundary, retain
protocol evidence correctly, and be runnable enough to evaluate. It is not an
excuse for placeholder packages, weakened tests, fake fixtures, or live-trading
authority. Competing mutation PRs may intentionally be mutually incompatible;
do not manufacture compatibility merely to make every candidate mergeable.

### Portfolio selection

- While the operator is away, Agents may open issues and isolated mutation PRs,
  but must not merge them or let them silently redefine the stable mainline.
- Keep the active mutation portfolio small and differentiated. Before opening a
  new candidate, explain what selection-relevant variation it adds.
- Review the portfolio comparatively, using product value, evidence, semantic
  search yield, AI and operational cost, complexity, downside, and reversibility.
- End review with one of: `ADOPT`, `PARTIAL_ADOPT`, `HOLD`, or `ABANDON`.
- `ADOPT` means update the candidate to the current mainline, rerun qualification,
  and merge it through the serial mainline flow.
- `PARTIAL_ADOPT` means extract the selected learning into a clean follow-up;
  the entire experimental branch need not merge.
- `HOLD` requires a named missing observation or dependency.
- `ABANDON` is a successful selection outcome. Close with the reason and retain
  the issue/PR as negative evidence instead of repeatedly rescuing the idea.

Candidate mutations do not become active-plan decisions merely by existing.
Update `PLANS.md` when selection or evidence changes a real project decision;
until then, keep the experiment's thesis and state in its issue and pull request.

## User input / access ledger

Delete an item as soon as the user supplies it or the project no longer needs it. Do not place secrets themselves in this file.

### Deferred decisions (not blockers)

- Equivalence-review authority for production decisions.
- First account-eligible region and first live venue.
- Initial real-capital and per-venue limits.
- Credential custody design.
- Dense evidence object-store destination.
- Whether this remains standalone or later becomes an OpenAlice desk.
- First external-anchor family after prediction-market qualification.

### Environment gaps Codex owns

- The host currently exposes Python 3.9.6; the optional solver-sidecar target is Python 3.12+.

## Authority boundary

Anonymous catalog, rules, market-data research, fixture capture, deterministic replay, simulation, and shadow execution are authorized. Real credentials and all value-moving operations are out of scope.
