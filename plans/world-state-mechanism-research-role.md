# World-state mechanism research role

Status: implemented; live specimen awaits separately activated campaign

Issue: [#166](https://github.com/luokerenx4/my-little-pony/issues/166)

Branch: `codex/mechanism-research-role`

## North-star role

Ontology normalization asks what venue contracts refer to. Mechanism research
asks how one real-world transition could change the feasibility or likelihood
of another event and which market families should be searched when that state
changes. They share evidence, but they do not have the same success condition.

The initial V3 design put both into one Agent run. Live evidence now rejects
that topology: across eight ontology runs, 29 invocations and 554,881 known
tokens, mechanism coverage was inspected zero times and a mechanism result tool
was called zero times. Any accepted entity, proposition, or ordinary
counterexample ended the generic run before mechanism work was required; result
repair additionally favored the most conservative applicable result.

## Ontology decision

Create a distinct `WORLD_STATE_MECHANISM_RESEARCH` role. It consumes an exact,
immutable ontology issue revision and retained mechanism memory, but its result
policy contains only:

- mechanism coverage inspection;
- exact assigned trailhead/evidence inspection;
- world-state mechanism proposal;
- mechanism counterexample;
- an explicit evidence-bound mechanism abstention when the assigned issue has
  no defensible directional route.

Normalization results cannot terminate this role. Mechanism results do not
replace normalization or gain semantic, causal, probability, certificate,
campaign, execution, or trading authority. Both roles join through immutable
source issue revision and evidence identities.

## Phase 1 — provider-neutral role contract

- [x] Add a distinct Agent task kind and stable mechanism-research task
  contract derived from eligible current ontology issue revisions.
- [x] Reuse exact retained task payload evidence without copying or widening
  listing scope.
- [x] Define a mechanism-only tool protocol and first-party result policy,
  including explicit abstention as useful negative memory.
- [x] Preserve source issue revision, trailhead, relation pattern, ontology and
  corpus lineage in every result.

## Phase 2 — selection and campaign boundary

- [x] Build provider-free mechanism-task reconciliation with stable task
  identity and versioned exact inputs.
- [x] Add an independently budgeted, manual-only campaign proposal; never
  inherit activation from ontology normalization.
- [x] Exclude issue revisions already covered by a retained mechanism proposal
  or abstention unless material semantic input changes.
- [x] Keep runtime, credential, model and effort composition independent from
  the role while binding the tool protocol in its execution profile.

## Phase 3 — cost and product evidence

- [x] Extend the intent-cost funnel to treat mechanism-research runs as their
  own denominator rather than hoping normalization selects mechanism tools.
- [x] Surface eligible, attempted, abstained, proposed and falsified mechanism
  research in Agent Operations.
- [x] Qualify provider-free replay, storage, desktop and narrow viewport before
  any model call.
- [ ] Run a bounded live specimen only under explicit campaign authorization;
  compare inspection, result, repair and token posture with the zero-inspection
  baseline.

## Qualification evidence

- SQLite schema 52 retains evidence-bound mechanism abstentions with exact
  source issue revision and Agent-run foreign keys.
- The current live corpus materializes 64 eligible mechanism issues and an
  eight-task campaign preview with concurrency one. Reads created no campaign,
  run, model invocation, or provider request.
- The mechanism-only manifest has two read tools and three terminal results:
  proposal, counterexample, and abstention. Ordinary ontology results are
  absent and explicitly rejected if invoked out of protocol.
- Control-plane qualification passes 101 files / 675 tests; Studio type-check
  passes. Desktop and 390 px Agent Operations render the honest `64 / 0 / 0 /
  0` lifecycle baseline without horizontal overflow or console warnings.

## Non-goals

- forcing every ontology issue to yield a mechanism proposal;
- treating abstention as failure or proposal count as semantic quality;
- weakening counter-scenario, evidence-scope or subject-binding validation;
- automatic campaign activation or dispatch;
- live orders, credentials, signatures, approvals, transactions or funds.
