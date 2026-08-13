# World-state subject-binding research

Status: active mainline construction

Issue: [#181](https://github.com/luokerenx4/my-little-pony/issues/181)

## Product question

The first retained world-state mechanism route connects an Iowa Democratic
Senate-seat outcome to national Democratic Senate control. It cannot be
observed until both listing roles are proven to bind the same real-world
subject. The authoring Agent proposed that binding, but letting the same result
approve its own subject identity would collapse discovery and review into one
model assertion. Keeping every binding manual, however, would prevent the
machine from persistently qualifying its own search routes.

## Ontology decision

Subject identity is a reviewed relation among role-bound market predicates and
a canonical world object. A shared string is evidence but not identity; a
canonical label is a routing key but not a universal entity record. The machine
therefore separates four objects:

1. an immutable mechanism proposal that names candidate subject labels;
2. a stable subject-binding research case over one mechanism family;
3. an evidence-bound Agent assessment with approval, rejection, or evidence-gap
   recommendation and explicit counterexamples;
4. a promoted subject-binding review that alone may enable provider-free route
   membership observation.

The assessment never has semantic-relation, probability, certificate,
campaign, execution, external-write, or value-moving authority. Promotion is
an independent policy decision and must remain explicit until the operator
answers the authority question in `QUESTIONS.md`.

## Phase 1 — stable case and typed effects

- [x] Materialize one stable case per route family with versioned exact proposal
  and listing-evidence inputs.
- [x] Define accepted assessment and evidence-bound abstention effects with
  explicit supporting facts, ambiguity tests, and counterexamples.
- [x] Preserve source Agent run, invocation, tool effect, route family, proposal,
  exact listing evidence, model/runtime, and token lineage.
- [x] Make free text diagnostic-only and fail closed on missing historical
  evidence.

The provider-free substrate is live on SQLite schema 53. One retained mechanism
family now produces one stable case and one exact input revision over its
proposal, authoring run, candidate label, ambiguity note, two role-bound listing
records and three counter-scenarios. Restart does not rotate identity; changed
route evidence does. Assessment and abstention ledgers require an exact retained
input, proposal set and Agent run, while assessment remains explicitly distinct
from promoted review authority. The live route projects `1 UNEXPLORED / 0
ASSESSED / 0 ABSTAINED / 0 REVIEWED`, and migration added one input row with no
new model invocation or token spend. All 688 control-plane tests and workspace
checks pass.

## Phase 2 — independent Agent execution

- [x] Add a dedicated provider-neutral task kind, tool manifest, payload and
  configurable execution profile.
- [x] Exclude the mechanism-authoring run from review authority and surface that
  independence in projection.
- [x] Preview a paused, manual-only, concurrency-one campaign before any model
  spend.
- [x] Qualify one bounded Terra/high assessment for the live Democratic Party
  route, then pause immediately.

The execution layer now proves that runtime, credentials and model are reusable
without making AI roles homogeneous. `SUBJECT_BINDING_RESEARCH` has its own
stable task contract and first-party tool protocol while using the existing
Codex/Pi-capable execution substrate and configured Terra model profile. Only a
typed assessment or evidence-bound abstention can terminate the run; case reads
are non-terminal and free text is diagnostic. SQLite independently verifies
that the result's run belongs to the same stable case. Campaign selection binds
one exact input revision and hash, is manual-only/concurrency-one/once-per-
lineage, and caps the specimen at six invocations and 100k input tokens. The
live zero-inference preview selected the one Democratic Party case and correctly
held dispatch pending capability preflight. All 692 control-plane tests and
workspace checks pass.

The first explicitly activated live specimen is currently
`HOLD_RUNTIME_DIAGNOSTIC`, not a subject-identity verdict. Codex app-server /
Terra high passed account preflight with zero inference, and the paused campaign
bound the one exact case revision. Its first run failed before any first-party
tool effect when app-server emitted an error notification on the first model
invocation. Usage is unknown, no assessment or abstention exists, and the
campaign was paused immediately. The runtime had collapsed the notification to
a generic sentence, so the next gate is bounded retention of only its protocol
code and diagnostic message before a deliberately authorized probe. The failed
attempt remains terminal evidence and cannot recur implicitly.

After bounded error-notification diagnostics shipped, an explicitly authorized
manual probe retained the old failure and created run ordinal two. The runtime
error did not recur. Terra/high used three successful invocations and 55,659 /
649 / 147 input/output/reasoning tokens, accepted two exact case reads and one
`APPROVE` assessment, and terminated in about 106 seconds. The assessment
supports only `democratic party` as the same routing subject across both exact
role listings. It explicitly does not approve the mechanism relation and
retains the win-Iowa/lose-control, lose-Iowa/win-control and other-seat/control-
rule counter-scenarios. No review, observation, wake or execution authority was
created.

## Phase 3 — promotion and observation

- [x] Project assessment sufficiency separately from subject-binding review
  status.
- [ ] Implement an explicit promotion policy that can retain `NEEDS_EVIDENCE`
  without retrying on elapsed time or catalog refresh.
- [ ] Re-observe the route provider-free only after a promoted review and retain
  exact observation lineage.
- [ ] Verify no wake is fabricated when promotion merely reveals listings that
  were already present; the first approved observation is a baseline.

## Phase 4 — value and cost

- [x] Attribute authoring and binding-review tokens separately.
- [x] Compare approved, rejected, abstained and no-result yield by stable route
  family.
- [ ] Bound repeated context and tool output before adding more review cases.
- [x] Expose the case, assessment, review and observation states in Studio as
  distinct stages rather than one confidence score.

Issue [#187](https://github.com/luokerenx4/my-little-pony/issues/187) now binds
AI cost to exact authoring and assessment run IDs. The live route projects seven
authoring invocations at 148,341 / 2,749 / 648 and three assessment invocations
at 55,659 / 649 / 147 input/output/reasoning tokens, with incomplete usage
counted separately instead of guessed. Studio accepts the v3 projection and
renders case → assessment → readiness → review → observation as five distinct
states. Desktop and 390 px qualification have no horizontal overflow or
application console warnings. Issue #188 resolves the adjacent accounting gap
with two explicit ledgers. `currentAssignmentYield` measures only the current
ontology-assignment task window and is allowed to report zero attempts after a
revision changes. `retainedMechanismMemory` follows durable proposal,
counterexample and abstention records across revisions to de-duplicated source
Agent runs and exact invocations. It reports missing retained runs and incomplete
usage separately instead of interpreting either as zero cost. Studio names both
windows, so a current-window zero no longer contradicts the retained route.
Live schema-53 qualification reports `64 eligible / 0 attempted / 0 input` for
the current window beside `1 proposal / 1 route / 1 source run / 7 invocations /
148,341 input` for retained memory, with no missing run and no incomplete usage.
Desktop browser inspection at 1280 px shows the two scopes, the existing five
stage lifecycle and no horizontal overflow; the added 720 px breakpoint reduces
the two-column accounting strip to one column, while the prior 390 px lifecycle
qualification remains unchanged.

Issue [#193](https://github.com/luokerenx4/my-little-pony/issues/193) adds one
non-scalar evidence-and-cost scorecard per stable route family. It keeps
proposal, falsification, subject assessment, review, observation and wake stages
distinct while attributing authoring and assessment usage through exact,
de-duplicated run IDs. The live Democratic Party family is
`READY_FOR_PROMOTION`: one proposal, three counter-scenarios, one independent
approval assessment, no promoted review, 62 blocked observations and no wake.
Its two independent source runs reconcile to 148,341 authoring plus 55,659
assessment input tokens, or 204,000 unique total, with zero shared runs, missing
runs or incomplete usage. The scorecard has no scalar ROI, dispatch, attention
policy, semantic, probability, review, execution or value-moving authority.
The 62 blocked observations reveal a separate write-amplification question:
provider-free reconciliation may be retaining unchanged blocked state on every
cycle instead of one baseline plus meaningful transitions.

Issue [#195](https://github.com/luokerenx4/my-little-pony/issues/195) resolves
that amplification without rewriting history. An observation is now a semantic
baseline or transition over route revision, exact subject-review binding,
status and membership identity—not a catalog-refresh heartbeat. The first
blocked state remains retained; a new review, route revision, status or
membership produces a new baseline/transition; an unchanged refresh produces
no observation. The live database had reached 64 historical blocked rows over
64 distinct corpus snapshots but one membership identity. Two subsequent READY
anonymous refreshes over 4,267 listings left the row count exactly 64. Existing
rows were not deleted, and the original changed-membership wake tests still
pass with zero model or provider calls from observation.

Issue [#185](https://github.com/luokerenx4/my-little-pony/issues/185) now
materializes provider-free promotion readiness without choosing the promotion
authority. Exact current-input coverage, independent authoring and assessment
runs, trigger/dependent/cross-role findings, candidate-label coverage,
counterexamples, conflicts, abstentions and exact review absence are separate
checks. The live case is `READY_FOR_INDEPENDENT_PROMOTION`, while
`reviewerPolicyConfigured=false`, `automaticPromotion=false` and
`promotionAuthority=false`. Reviews are now exact-proposal-set evidence: a
stable route family cannot inherit an old review after its retained proposal
set changes.

## Qualification gates

- [ ] Same surface label across role listings cannot self-approve identity.
- [ ] A party, person, team, office or asset ambiguity can produce a retained
  rejection or evidence gap without creating route work.
- [ ] An approved review enables only subject membership observation; it cannot
  certify the downstream relation or probability.
- [ ] Refresh and restart preserve the stable case and exact assessment lineage
  without model calls on read.
- [x] Full tests, checks and production build pass.

## Live qualification ledger

- Capability preflight observation:
  `sha256:74c784be64090dfa372841bb9d3856876dd9f9f48a432dc4842dbedf5e56ffa3`
  (`USABLE`, zero inference).
- Exact subject-binding input revision:
  `sha256:a63d23b457f1d725b9c0bc2b7e17573d89b107af77880247cb86717c6a1a79a1`.
- Failed Agent run:
  `sha256:403d9b0376d70a960c1b970e9fc9e8bfa4af12e31bdb4c2e2761137b1dc60405`.
- Failed invocation:
  `sha256:45408019a4193330cee1e800a1dcdfa436688fb1c41696f2a1d7296613a44021`
  (`CODEX_APP_SERVER_PROTOCOL`, unknown token usage, zero tool effects).
- The exact-input run annotation succeeded before execution; no subject-binding
  assessment, abstention, review or route observation was created.
- Successful diagnostic probe run:
  `sha256:f755bc5360cf86a9b5a712c7589417954c75e41fde5d73f3208db63108320cc2`
  (three successful invocations; 55,659 / 649 / 147 known tokens).
- Accepted assessment:
  `sha256:f9d1bac3bc70eef14534ca81de87e4a8817db7d45c635fdc51f3ce602b6ba2dd`
  (`APPROVE`, assessment evidence only, independent promotion required).
- Provider-free readiness:
  `sha256:9da6c0a11bdb42cc74f6dc91ccbdb050e35def7070612e8dc3e41f8ba1bd21be`
  (`READY_FOR_INDEPENDENT_PROMOTION`, no promotion authority).

## Non-goals

- a universal global entity graph;
- accepting model confidence as subject identity;
- automatically activating campaigns or recurring review;
- estimating probabilities or certifying arbitrage;
- live orders, credentials, signatures, transactions or funds.
