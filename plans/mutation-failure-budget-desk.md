# Mutation plan: failure-budget desk

Status: candidate under selection

Issue: [#82](https://github.com/luokerenx4/my-little-pony/issues/82)

Branch: `codex/mutation-failure-budget`

This is a mutation specimen, not an active mainline decision. It is intentionally
not indexed as an active plan in `PLANS.md` until portfolio review produces
`ADOPT` or `PARTIAL_ADOPT`.

## Product proposition

The harness currently treats exact semantic equivalence, contradiction, or
exhaustiveness as the privileged destination. Those relations are valuable but
rare, crowded, and often discovered only after semantic review has removed the
interesting ambiguity.

The alternative proposition is that the desk creates more value by finding and
pricing *imperfect* semantic dependencies. The primary object should answer:

> How often may this proposed relation fail before the quoted portfolio loses
> its expected edge?

The product can then rank discrepancies by remaining failure budget instead of
forcing every candidate into either exact arbitrage or an undifferentiated
research-only bucket.

## Mutation thesis

Replace certificate proximity as the default product lens with a failure-budget
frontier:

1. heuristic Agents discover a relationship without needing a claim-first
   vocabulary;
2. independent estimators bound the adverse settlement state;
3. deterministic fixed-point arithmetic derives the price-implied break-even
   failure probability;
4. the difference ranks opportunities while preserving every unresolved gate.

This materially differs from the current opportunity frontier. The old surface
ranks gross price hints and asks which exact proof is missing. This surface ranks
the amount of semantic/model error a portfolio can survive and treats uncertainty
as an explicit priced input.

## What the candidate changes

- **Adds** a content-addressed `FailureBudgetFrontier` built from retained
  probability bounds and current anonymous indicative binary prices.
- **Adds** a read-only API and a dedicated Studio workspace that explains the
  method, ranks portfolios, names failure factors, and shows calibration,
  freshness, depth, tail-loss, and positive-edge blockers.
- **Restructures** the product narrative from “prove the relation, then inspect
  price” to “discover the relation, price how wrong it may be, then qualify.”
- **Does not replace** the first-party exact verifier, hard-arbitrage compiler,
  evidence retention, or authority boundary.
- **Does not add** provider requests, live books, orders, credentials, signatures,
  approvals, or value-moving operations.

## Arithmetic contract

For each retained probabilistic semantic bound, enumerate the binary TRUE/FALSE
portfolio choices supported by the related listings. Compile each choice through
the existing first-party probabilistic semantic-arbitrage evaluator.

```text
break-even epsilon = price-implied adverse probability tolerance
remaining failure budget = break-even epsilon - conservative adverse upper bound
```

The first specimen uses anonymous indicative catalog prices, zero fee, and zero
depth. Zero depth deliberately blocks actionability; the result is a ranking and
research object, never an executable quote or certificate.

## Expected value

- Surfaces sparse, semantically strange markets where exact-arbitrage scanners
  and claim-first search are least competitive.
- Makes the Agent's economically important assumption inspectable rather than
  hiding it inside a prose recommendation.
- Separates “the relation may fail” from “the trade is bad”: failure is acceptable
  when its conservative probability fits inside the price budget.
- Creates a comparable target for later estimator calibration and discovery-yield
  measurement.

## Failure modes and downside

- A weak probability upper bound can manufacture an attractive margin.
- Correlated estimators can create false independence and overconfidence.
- Indicative prices, zero-fee assumptions, and absent depth can materially
  overstate edge.
- Enumerating `2^n` portfolios does not scale to large relation sets; this
  specimen is intended for the currently bounded small semantic groups.
- Ranking by remaining probability margin can prefer cheap but operationally
  unusable portfolios unless liquidity and capital-normalized views are added.
- The new framing may distract from exact opportunities if it replaces rather
  than complements the verifier during evaluation.

## AI, token, and operational cost

The frontier compiler, API read, and Studio read cause zero provider requests.
They reuse probability artifacts already retained by the estimator workflow.
The incremental compute cost is deterministic `2^n` enumeration per small bound
and is negligible at the current portfolio size.

The upstream probability-estimation cost remains the dominant AI cost. Automatic
DeepSeek spending stays controlled by the SQLite runtime policy and is disabled
in the live desk. This mutation does not silently trigger it. The first retained
case consumed nine Terra/high invocations and 151,805 total tokens across three
input-protocol generations. All nine invocations produced durable effects; the
current V3 generation converted abstention into structured evidence work rather
than another opaque retry. A later adoption decision must still measure provider
tokens per bounded relation and per positive-margin frontier item.

The first runnable follow-up routes new probability-estimation cases through the
same durable provider snapshot used by the operator-selected runtime. Terra/high
can therefore populate the frontier without reopening DeepSeek spend. The
provider snapshot is part of case and run lineage; changing settings creates new
work rather than mutating old estimates.

## Reversibility and incompatibility

The candidate is additive at the protocol boundary: one module, one GET endpoint,
one route, and one Studio page. Removing them restores the prior product without
data migration. It intentionally competes with certificate-first navigation and
may be incompatible with a future product choice that admits only strict
arbitrage objects into the primary workspace.

## Selection signals available now

- Existing fixed-point probabilistic compilation already exposes break-even
  epsilon, expected edge floor, adverse tail loss, and independent gates.
- Deterministic tests show a 22% price-implied tolerance minus a 5% adverse upper
  bound leaves a 17% research margin while zero depth and no calibration remain
  explicit blockers.
- The live retained desk has no fabricated completed bound: three current-protocol
  Terra/high roles all terminated as `ABSTAINED`, while one older case remains
  `BLOCKED_EVIDENCE`. The frontier now distinguishes these postures instead of
  reporting all four as generic pending work.
- The current estimator protocol produced 15 blocking evidence needs and grouped
  them into nine exact work scopes: five official acquisition-route gaps and four
  external-source-policy decisions. This is selection evidence that the product
  can turn a failed numeric bound into attributable research work, but not yet
  evidence that it can produce positive-margin opportunities.
- SQLite provider policy keeps the live desk on `gpt-5.6-terra / high` and blocks
  automatic DeepSeek spend.

## Evidence still missing

- Yield: positive-margin candidates per heuristic scan and per provider token.
- Calibration: realized adverse-state frequency by semantic family.
- Market quality: executable fee/depth-adjusted margin versus indicative margin.
- Operator value: whether the failure-factor explanation enables a confident
  research decision faster than the current Findings/Review flow.
- Comparative selection: whether this surface should replace the current primary
  opportunity frontier, coexist as a specialist desk, or only donate its metric.

## Qualification plan

- [x] Implement a deterministic, content-addressed frontier with `bigint`
  arithmetic delegated to the existing compiler.
- [x] Prove positive, exhausted, authority, and deterministic-hash cases.
- [x] Expose a GET endpoint that performs no provider call or external write.
- [x] Add a Studio route that distinguishes illustrative math from live data.
- [x] Run the complete workspace check, test, and build qualification.
- [x] Inspect desktop and 390 px layouts for readability, overflow, and console
  errors.
- [x] Open a draft mutation PR and leave it unmerged for comparative review.

## Selection rule

- **ADOPT** if live scans produce calibrated positive-margin candidates at an
  acceptable token cost and operators prefer this ranking for research triage.
- **PARTIAL_ADOPT** if the remaining-failure-budget metric improves existing cards
  but the dedicated desk does not improve decisions.
- **HOLD**: the live Agent loop now exposes its evidence debt, but completed
  probability bounds and executable anonymous fee/depth observations are still
  missing.
- **ABANDON** if margins are dominated by estimator variance, disappear after
  basic market qualification, or fail to improve operator decisions.
