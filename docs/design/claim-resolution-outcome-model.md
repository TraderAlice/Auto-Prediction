# Claim, Resolution, Outcome, and Listing Model

The canonical chain is:

```text
Claim -> Resolution Specification -> Outcome Space -> Venue Listing
```

A Claim identifies a world proposition. A Resolution Specification owns sources, rule text/version/hash, observation windows, timezone, void/cancel/appeal semantics, and provenance. An Outcome Space enumerates every canonical terminal state. A Listing binds venue rules and a payout vector to those states.

Binary markets are one instance, not the root abstraction. Links are `EXACT`, `CONDITIONAL`, `RELATED`, `CONFLICTING`, or `UNREVIEWED`; automated matching can only propose `UNREVIEWED`.
