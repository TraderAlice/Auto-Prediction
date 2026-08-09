# Premise-obligation evidence routing

Status: active measurement

Created: 2026-08-10

## Product problem

The premise dossier names the facts blocking a candidate, but `BIND_PREMISE_EVIDENCE`
is still a human-readable boundary rather than an engineered loop. Sending every
unbound proposition to document acquisition would be both expensive and wrong:
the current exact compiler admits only settlement-intrinsic or traded-outcome
state, while an external official fact remains probabilistic research evidence.

The first live v3 corpus contains ten premise capsules and 39 retained premises.
Only 19 are unbound causal hypotheses; 20 are already listing-bound. Several of
the 19 are duplicate or derived restatements such as “at most one YES” and “the
joint YES state is impossible,” rather than independent facts that deserve
separate searches. Blindly creating 19 web jobs would inflate spend and hide a
premise-quality defect.

## Decision

Add a durable, Agent-native evidence router that works on one complete premise
capsule at a time. The router sees the proposal and the bounded obligation set,
but not the whole market corpus. It receives read-only tools to search the
semantic corpus and inspect exact listing records, then must submit a terminal
route set covering every unbound premise exactly once.

Route groups may combine premises that share one evidence need. Every group has
one of these dispositions:

- `DERIVED_RESTATEMENT`: not an independent fact; name its acyclic dependencies
  and send the relation back for premise rewrite without external acquisition.
- `TRADED_STATE_CANDIDATE`: name exact corpus listing refs that could turn the
  hidden fact into a traded Boolean state; expand and independently re-review
  the relation before exact admission.
- `CONTRACT_RULE_EVIDENCE`: name proposal listings whose retained or typed-locator
  rule evidence could establish the proposition; feed the existing raw capture,
  quote verification, and semantic-review re-entry pipeline.
- `EXTERNAL_FACT_RESEARCH`: retain bounded official-source search objectives,
  but route the result to probability research because external observations
  cannot acquire exact-state authority.
- `COUNTEREXAMPLE_CANDIDATE`: retain the falsifier and re-run premise analysis or
  reject the relation; never search for confirming evidence first.
- `UNRESOLVED`: retain the failed routing attempt and stop spending automatically.

The terminal artifact is advisory. Candidate refs must have been observed via a
router tool or belong to the proposal; dependency graphs must be acyclic;
external-source objectives contain no URL; and every action is explicit about
whether exact admission is even possible.

## Persistence and scheduling

- One content-addressed job scope is keyed by premise outcome, proposal, and
  router identity. Its terminal artifact is also bound to the semantic corpus
  snapshot it actually searched; that identity ignores price/receive-time churn
  but includes titles, rules, outcomes, and evidence-locator identities.
- Jobs lease before provider requests, survive restart, bound concurrency and
  retries, and retain PASS or EXHAUSTED outcomes independently from the 250-row
  premise-analysis detail window.
- Neither price churn nor ambient catalog growth silently spends a second
  provider budget for a retained PASS or EXHAUSTED scope. A future policy or
  operator refresh must be explicit, observable, and separately attributed.
- AI usage is recorded under `PREMISE_EVIDENCE_ROUTING`, including provider
  request count, tokens, duration, durable-effect posture, and terminal outcome.
- The scheduler cannot fetch a URL, create a certificate, simulate, execute, or
  mutate a premise artifact. Downstream effects are separate first-party gates.

## Product handoff

Proposal handoff and Studio show routing as the next stage after premise audit:

- number of unbound premises versus deduplicated route groups;
- route mix, exact-potential groups, probabilistic-only groups, and unresolved
  groups;
- each group’s evidence question, candidate markets or target listings, and
  explicit next action;
- pending, retrying, exhausted, historical/superseded, and completed states;
- provider attempts and token cost without exposing prompt/output text.

The focused dossier remains readable by default: show the route summary above
the fold and keep full group detail collapsible. A human or browser Agent should
be able to answer “what will the machine do next, and can that action ever make
this exact?” without reading scheduler internals.

## Qualification

- Validator tests cover exact unbound-premise coverage, group deduplication,
  acyclic dependencies, observed candidate refs, action/disposition consistency,
  semantic corpus identity, tamper rejection, and closed authority fields.
- Scheduler tests cover lease/retry/exhaustion, restart replay, and no provider
  request for a retained PASS even when the surrounding semantic corpus changes.
- Tool-loop tests prove bounded search/read, rejected terminal correction, no
  whole-response schema parsing, and exact first-party validation of submitted
  refs and groups.
- Live qualification routes the ten retained v3 capsules, measures route-group
  compression and exact-versus-probabilistic yield, and confirms premise-analysis
  attempt count does not increase merely because routing is introduced.
- Studio is inspected at desktop and compact widths with the built-in browser
  when its inspection channel is available; any fallback and missing console
  evidence are recorded rather than silently claimed.
- Node 24 full checks, all workspace tests, and production build pass.

## Follow-on selection rule

Do not pre-commit to an open-web search provider. After live routing, implement
the downstream with the strongest measured exact-potential yield first:

1. traded-state expansion if the corpus contains credible candidates;
2. existing typed-locator rule capture if rule evidence dominates;
3. official-source discovery for probabilistic research only when its expected
   decision value justifies another external dependency.

If most groups are derived restatements, fix premise generation and replay
before buying more evidence. `UNRESOLVED` is a valid terminal result.

## Implementation evidence — 2026-08-10

- The v4 tool-loop router, durable scheduler, SQLite job table, read-only API projection,
  AI-usage purpose, and focused Studio route card are implemented.
- Live qualification immediately found two integration defects: the pre-v31
  AI-usage table rejected the new purpose after a provider loop completed, and
  current-only corpus construction excluded proposal listings retained in an
  immutable evidence bundle. Schema 31 now migrates the usage constraint
  without dropping history, and routing corpora merge current observations with
  the exact retained proposal bundle.
- The first four provider loops consumed all 24 steps without an accepted
  terminal effect (1,211,745 tokens total, 1,135,872 cache-read). The router now
  forces terminal submission from step eight onward, returns the last rejected
  first-party diagnostic, and supersedes earlier router/corpus revisions in
  current operating counts while retaining them as negative evidence.
- Desktop 1440×1000 and compact 390×844 rendering have no horizontal overflow
  and no rendered leaf text below 12 px. The built-in browser inspection channel
  timed out on both existing and fresh local tabs; a one-off isolated local
  browser profile provided the visual and mechanical fallback evidence.
- Live v4 routing produced seven current PASS routes and one terminal exhausted
  scope. The passing set compressed 13 unbound premises into 12 groups: three
  traded-state candidates, one contract-rule task, six external-fact research
  tasks, two counterexample tasks, and zero unresolved groups. Four groups may
  return to exact review; external research remains probabilistic.
- Across router revisions the ledger retained 19 provider invocations,
  4,510,755 total tokens (4,056,448 cache-read), and eight durable effects. That
  cost exposed a second defect: ambient corpus revisions could enqueue another
  job for an already terminal premise outcome. Scheduling now spends once per
  proposal/outcome/router scope; retained historical jobs remain visible but
  cannot steal the current projection or silently run again.
- Live Studio inspection found and fixed a projection-churn race that repeatedly
  cancelled the proposal handoff while background Agents changed the global
  state hash. The focused dossier now resolves by proposal identity and its
  route card updates from the live bounded projection. The Gemini specimen shows
  one unbound obligation compressed into one rule-evidence action, with no
  horizontal overflow at 1440×1000.
