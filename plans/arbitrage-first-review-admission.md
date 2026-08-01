# Arbitrage-first semantic-review admission

Status: active
Started: 2026-08-02

## Outcome

Make recurring AI spend converge on candidates the current deterministic
payoff compiler can actually consume. Preserve every research proposal, but
admit only exact two-listing proposals with a currently compilable relation to
automatic semantic review. Everything else receives an explicit research-only
disposition and remains available for manual review or a future compiler lane.

## Runtime evidence

The live seven-source scheduler has attributed 105 proposals, started 108
semantic-review requests, completed 50 current reviews, and accepted zero
operator decisions. The current retained Market Archaeologist set contains 37
unique proposals:

- 3 are exact two-listing relations supported by the payoff compiler;
- 34 are `RELATED`, `CONFLICTING`, `CONDITIONAL`, or unsupported multi-listing
  relations;
- the 50 current reviews report 351 free-text evidence gaps;
- only one review is decision-ready, and its gross hint is -540 bps.

Automatic review currently treats research value as arbitrage readiness. At
the measured mix, more than 90% of the current candidate set cannot enter the
implemented compiler even after a successful review. More Agent concurrency
would amplify this mismatch.

After implementation, the live projection contained 97 retained review
candidates: 10 entered the automatic compiler-shaped lane and 87 remained
research-only. The reason split was 62 non-compilable relations and 25
unsupported-arity proposals. SQLite migrated in place to schema v16; 94 passed
historical reviews remained passed, five still-undecided jobs became durable
`RESEARCH_ONLY`, and the request-attempt counter stayed at 113 across repeated
ticks with no due work.

## Architecture decision

1. derive admission from immutable proposal fields, never model confidence;
2. admit exactly two distinct listing refs whose proposed relation is one of
   `EQUIVALENT`, `IMPLIES`, `SUBSET`, `MUTUALLY_EXCLUSIVE`, or `EXHAUSTIVE`;
3. retain non-admitted proposals as `RESEARCH_ONLY`, with a deterministic
   reason and no automatic reviewer request;
4. keep the direct manual-review endpoint able to inspect any proposal;
5. persist the scheduler disposition so restart cannot accidentally spend on a
   withheld proposal;
6. surface admission counts, reason distribution, and measured request posture
   in the control plane and Studio;
7. do not infer that admission proves semantics, economics, simulation
   readiness, or execution authority.

## Construction slices

- [x] Add a content-addressed admission classifier and projection.
- [x] Add a durable `RESEARCH_ONLY` scheduler disposition with restart-safe
  reconciliation for new and existing non-terminal jobs.
- [x] Ensure automatic ticks cannot rehydrate or dispatch withheld jobs while
  direct manual review remains available.
- [x] Add admission posture to the server projection and HTTP surface.
- [x] Show automatic-vs-research-only lanes and reasons in Studio.
- [x] Document the policy and its relationship to future multi-listing support.
- [x] Add classifier, scheduler, persistence, server, authority, and regression
  tests.
- [x] Run full checks, production build, live reconciliation smoke, and
  desktop/390 px QA.
- [ ] Publish and serially merge the campaign PR.

## Safety and boundedness

- Admission allocates automatic review work only; it cannot alter proposals or
  assert a semantic conclusion.
- `RESEARCH_ONLY` is not rejection. It means the current automatic compiler
  lane cannot consume the proposal shape.
- No passed historical review is erased or rewritten.
- A leased request may finish; admission never attempts to cancel an in-flight
  provider call.
- Counts, retained records, concurrent requests, and projected candidates
  remain bounded by existing scheduler retention.
- No order, signature, token approval, credential request, or value-moving
  operation is introduced.

## Qualification gate

- An exact two-listing compilable proposal creates or retains an automatic
  review job and can consume one bounded request attempt.
- A `RELATED`, `CONFLICTING`, or `CONDITIONAL` proposal consumes zero automatic
  requests and records the non-compilable-relation reason.
- A compilable relation with unsupported arity consumes zero automatic
  requests and records the arity reason.
- Repeated reconcile/tick calls and restart cannot change a research-only job
  into a due job without a new proposal identity or explicit future policy.
- Existing passed reviews remain passed and visible.
- Manual review of a research-only proposal still works and has advisory-only
  authority.
- Studio is readable at desktop and 390 px without horizontal overflow.

## Qualification evidence

- `pnpm check`, all 383 workspace tests, and `pnpm build` pass on Node 24;
- automatic ticks start zero requests for non-compilable and unsupported-arity
  proposals, while an explicit direct review can still complete one;
- a persisted research-only job survives restart without becoming pending or
  due;
- the live SQLite v15 database migrated to v16 and accepted the new state;
- repeated live scheduler reads held `requestAttemptsStarted` at 113 with no
  active, due, pending, leased, or retry-wait jobs;
- Studio displayed the measured 10/97 automatic posture with 87 research-only
  candidates and passed desktop plus 390 px checks without horizontal overflow
  or console warnings.
