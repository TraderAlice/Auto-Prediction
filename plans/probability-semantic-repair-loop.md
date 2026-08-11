# Probability challenge to semantic-repair loop

Status: qualified construction

Created: 2026-08-10

## Product problem

Probability-case integrity can now stop an internally contradictory case, but
the durable effect ends at `NEW_SEMANTIC_REVIEW_REQUIRED`. The existing semantic
review scheduler owns one job per proposal and treats its passing review as
terminal. Re-running the same proposal, corpus, model, and protocol returns the
old review identity, so a probability challenge cannot yet create a repaired
constraint or re-enter estimation.

The semantic reviewer is also an early DeepSeek-only lane. Current operator
policy is `CODEX / gpt-5.6-terra / high` with automatic DeepSeek disabled. A
repair path that silently depends on DeepSeek would violate the durable spend
choice and remain inoperable on the live desk.

## Decision

- Build a content-addressed probability semantic-repair request from the exact
  challenge group, source review/report/constraint, expanded adverse-state
  interpretation, roles, engines, run/challenge IDs, and evidence hashes. It is
  review input only and cannot choose a corrected relation or state.
- Require at least two distinct probability roles before automatic enqueue.
  A single-role challenge remains visible but does not spend. This admission
  policy is first-party and deterministic.
- Reopen the retained semantic-review job in repair mode without deleting or
  rewriting the prior passing review. The repair request is durable job state.
  Its new review identity binds request, provider, model, effort, evidence
  scope, and current Agent protocol.
- Allow at most three repair generations for one proposal lineage. A later
  challenged generation becomes manual attention instead of an unbounded
  model-to-model loop.
- Supply the prior semantic constraint, exact adverse-state expansion, and all
  independent conflicts to the semantic Agent. The ordinary incremental tools
  remain authoritative: the Agent must reconstruct counterexamples,
  assessments, truth states, and evidence gaps, then submit or abstain. It may
  repair the constraint, conservatively reduce it to `RELATED`, or reject it;
  it cannot mutate the source artifact.
- Route repair reviews through the persisted AI runtime configuration. Codex
  uses OAuth-backed Vercel AI SDK Responses with response storage and parallel
  tool calls disabled; DeepSeek is eligible for automation only when its
  explicit gate is enabled.
- A passing repair review becomes the latest semantic-review job outcome and
  naturally creates a new probability case identity. Old challenged cases and
  old reviews remain replayable. A new challenge against the repaired lineage
  creates the next bounded generation.

## Compatibility and authority

- Historical semantic-review run V1/V2, report V1-V4, job V1-V4, probability
  run V1-V4, and probability job V1-V7 artifacts retain their original hashes
  and validation semantics.
- Current repair reviews use new identities and report/job protocol versions;
  the migration must be additive for retained JSON and widen only necessary
  SQLite status/record storage constraints.
- Enqueue performs no provider request. Scheduler dispatch is bounded by the
  existing concurrency, attempt, timeout, and runtime spending policy.
- Repair requests, Agent output, scheduler state, and Studio actions grant no
  production semantic-decision, certificate, simulation, execution, credential,
  signature, or value-moving authority.

## Qualification

- Deterministic request tests reject mismatched review, constraint,
  interpretation, listing, state, challenge, role, and evidence lineage.
- Scheduler tests prove two-role admission, single-role/manual posture,
  idempotent enqueue, bounded generations, restart replay, and no provider call
  at enqueue.
- Agent tests prove the repair prompt contains the exact conflicts and prior
  state expansion, uses incremental tools, and produces a new content identity
  without changing the source review.
- Provider tests prove Codex model/effort/storage metadata enter the identity
  and that DeepSeek automation remains gated.
- End-to-end tests prove a repaired probabilistic constraint creates a new
  probability case while the challenged case remains terminal and unbounded.
- Studio shows open, in-review, repaired/rejected, and manual-limit postures
  with source and successor identities. API reads do not call providers.
- The live three-role MLS repair runs on Terra/high. Inspect whether it produces
  a coherent new state table, reduces the relation to research-only, or
  abstains; do not force the conclusion in prompts or fixtures.
- Full workspace check, test, build, `git diff --check`, and desktop visual
  inspection pass.

## Selection signal

Adopt the loop if the live repair creates an auditable successor or honest
terminal reduction at materially lower cost than rediscovery, and the next
probability case no longer repeats the same challenge. Rework it if repair
generations oscillate, correlated Agents rubber-stamp one another, or provider
routing bypasses operator spend policy.

## Qualification evidence

- A challenged case now builds a content-addressed repair request from the
  retained probability job even when the source semantic review has rotated
  out of the 32-record Studio window. The semantic scheduler's retained
  `lastReviewId`, probability-owned constraint, report hash, expanded state,
  and three challenge effects preserve the source lineage without inventing a
  replacement review.
- Enqueue remains provider-free and idempotent. A one-role challenge is
  `MANUAL_SINGLE_ROLE`; generations one through three remain automatic, while
  generation four is `MANUAL_GENERATION_LIMIT`. A successor review/report,
  provider/model/effort, and source request all enter the new identity.
- First-party review disposition now distinguishes strict from probabilistic
  semantics. A found counterexample rejects a claimed hard settlement
  constraint, but becomes an estimable adverse state for a complete
  `PROBABILISTIC_DEPENDENCE`. Textual relatedness and incomplete state tables
  remain research-only instead of entering probability work.
- The retained MLS three-role challenge automatically ran one real repair on
  `CODEX / gpt-5.6-terra / high`: 85.615 seconds, 11 provider tool-loop
  requests, and 95,895 reported tokens. It created review
  `sha256:0157fe15891838d083a2cc4502b26b608c424c3eb2688255504136b321120bca`
  and constraint
  `sha256:c6352d9635a144514dfe0e88e6cdc9075d5f8aa4e1fda0effd0c90d45bc798d0`.
- The live Agent did not force the challenged `TF` direction or simply flip it
  to `FT`. It reduced the case to `TEXTUAL_RELATEDNESS / RELATED`, marked all
  four joint states `UNRESOLVED`, and emitted four typed requirements for
  Gemini outcome mapping, timing, contingency, and resolution-source rules.
  No new probability run was scheduled.
- The lifecycle projection reports open, pending, running, repaired,
  reduced-to-research, rejected, and manual postures with request, generation,
  engine, and successor identities. Studio shows the live MLS result as
  `REDUCED TO RESEARCH`; desktop inspection found no console warning or error.
- Full workspace qualification passes: 476 control-plane tests, 17 Studio
  tests, every package type check, the production build, and `git diff
  --check`. The Node 22.22.1 host retains the repository's expected Node 24
  engine warning and Vite's existing large-chunk warning.

The observed selection signal is positive. Repair produced an auditable,
honest terminal reduction from exactly the challenged state at lower cost than
rediscovery, and did not repeat the same probability challenge. The next
product increment is to turn its four typed unsupported Gemini requirements
into a source-discovery campaign, not to spend another estimator generation.
