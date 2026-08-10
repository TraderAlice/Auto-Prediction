# Durable evidence requirement scope

Status: implemented and live-qualified

Created: 2026-08-10

## Product problem

An evidence requirement may target only one contract inside a two-to-eight
contract semantic proposal. Requirement v1 retained the targeted `listingRefs`
but not the complete proposal scope. Once the originating Agent report, review
job, and bounded proposal window rotated away, a single-contract requirement
could no longer recover which other contracts made it economically or
semantically meaningful. The evidence document remained durable while the
arbitrage relation needed to use it did not.

This is especially damaging for a persistent heuristic system: catalog
generations rotate more often than high-value semantic findings, so contract
locators can improve after the proposal that requested them has left the
interactive window.

## Decision

- Evidence requirement v2 persists the complete ordered
  `proposalListingRefs` alongside the smaller requirement-local `listingRefs`.
- The proposal scope is bounded to two through eight exact refs, content-hashed
  into the requirement, and must contain every requirement-local ref.
- Builders emit v2. The validator continues to read byte-identical v1 records
  without guessing missing proposal lineage.
- A current v1 requirement migrates to v2 only when a retained candidate or
  another authoritative caller supplies the complete proposal refs.
- A v2 requirement can rebind current catalog listings using its own durable
  scope after every proposal/review record has rotated away.
- Acquisition scope remains based on the evidence kind, targeted refs,
  temporal posture, route, and locator identities. Proposal-scope retention
  must not cause an extra anonymous fetch when the acquisition route is
  otherwise unchanged.
- When v2 supersedes the same logical v1 requirement inside an acquisition
  job, the scheduler replaces the old generation instead of accumulating both
  identities. Unrelated v1 and v2 requirements may coexist in a shared fetch.

No requirement schema grants fetch, model, semantic, certificate, simulation,
or execution authority.

## Qualification

- A single-contract current requirement rebases from its persisted two-contract
  proposal scope without an external proposal record.
- A v1 single-contract requirement remains readable and unchanged when no full
  proposal scope exists; supplying the scope produces v2.
- Price/source-time churn with unchanged locators preserves the existing v2
  requirement identity.
- The acquisition scheduler replaces v1 with v2 for the same logical
  requirement and does not spend fetch budget during the migration.
- SQLite restart retains v2 requirements and their full proposal refs.
- Live retained state has no duplicate v1/v2 generation group inside one
  acquisition job.
- Studio exposes scoped and legacy counts from the full retained scheduler,
  not the twelve-job live interaction window, at desktop and 390 px.
- Focused tests, workspace checks, production build, and `git diff --check`
  pass.

## Live checkpoint

The retained 250-job SQLite queue restarted successfully after a real migration
failure was found and repaired. An intermediate implementation replaced a v1
requirement inside a captured job but left the immutable document observation
pointing at the old requirement ID; the next process correctly refused to bind
that capture. Acquisition job v2 now retains a separate
`captureRequirementId`, so current requirement generations may advance without
rewriting which requirement authorized the historical fetch. A focused
three-restart SQLite test reproduces the interrupted legacy shape, repairs it,
and proves the capture survives with zero extra network requests.

The live queue now contains 260 proposal-scoped v2 requirements and 145 readable
legacy v1 requirements. Two mixed-generation jobs contain unrelated proposals
that legitimately share one acquisition scope; there are zero duplicate
evolution groups within a job. The House requirements retain both exact House
refs even when an individual requirement targets only one side. All 54 captured
documents remain bound, with zero active or due acquisition work after restart.

Studio reads these counts from full scheduler aggregates. Desktop inspection at
1,280 px and a temporary 390×844 viewport show the scope-lineage strip without
horizontal overflow; the viewport override was reset after qualification.
