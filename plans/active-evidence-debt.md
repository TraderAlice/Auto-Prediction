# Active Evidence Debt

## Evidence

The first Evidence Debt Frontier correctly joined proposal value, but its source
set included every retained `UNSUPPORTED` acquisition job. Live inspection of
the leading House-control proposal showed that three displayed gaps already
have newer v2 requirements and captured contract documents. Their v1 jobs are
retained for replay, not active work. Only `ORACLE_SOURCE` remains unrouted.

Deleting or mutating the historical jobs would violate the evidence ledger.
Treating them as current debt misroutes operator and Agent attention.

## Decision

Bind the frontier to the exact requirement identities supplied to the current
acquisition reconcile. Keep retained unsupported jobs and requirements as
explicit historical counts, but group and rank only active unsupported
requirements. This identity filter is first-party and semantic-free: it does
not infer that one claim satisfies another, and it does not rewrite a legacy
requirement.

## Qualification

- Focused tests prove inactive retained jobs do not enter current cards, mixed
  jobs count correctly, and historical totals remain visible.
- Live House-control rows must drop the captured rule, time, and outcome gaps
  while retaining the truly unsupported oracle-source gap.
- Studio must distinguish retained no-locator inventory from active proposal
  debt at desktop and mobile widths.
- Full checks, tests, build, browser handoff, commit, and push remain required.

## Qualified result

- The retained ledger still exposes 196 unsupported jobs and 265 unique
  unsupported-route requirements. Forty-three requirement identities are not
  in the current reconcile and remain historical replay evidence only.
- The actionable frontier now contains 222 active unsupported requirements
  across 100 proposals. Two House proposals remain price-positive blockers;
  one dropped from four false-current kinds to the single genuine
  `ORACLE_SOURCE` gap, while one still has three active rule/time requirements.
- Browser checks at the default desktop size and 390 px retain a 12 px text
  floor, no horizontal overflow, and no console errors.
- Workspace type checks, all 615 tests, and the production build pass on the
  available Node 22.22.1 host with the known Node `>=24` warning.
