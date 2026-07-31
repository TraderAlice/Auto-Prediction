# Architecture

The harness separates contract truth from venue transport:

```text
raw venue facts
  -> normalized protocol events
  -> deterministic market state
  -> claim / resolution / outcome / listing graph
  -> bounded opportunity candidate
  -> exact payoff certificate
  -> capital + risk decision
  -> shadow execution + evidence
```

The fast loop reacts to book generations. The slow loop evaluates strategy revisions against immutable replay or shadow evidence.

## Authority layers

Agent-editable code may research venues, normalize fixtures, propose matches and opportunities, and generate shadow quotes. Reviewed equivalence, exact verification, risk policy, live authority, evidence identity, and campaign verdicts are separate authorities.

## Failure posture

Unknown protocol data, precision loss, incomplete resolution partitions, stale or gapped books, mismatched hashes, expired certificates, and unreconciled order state all fail closed. Live execution is unavailable by default.
