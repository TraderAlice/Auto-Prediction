# CLI

The bundled `pmh` CLI emits schema `pmh.cli.v1`. Every response contains command identity, current state, diagnostics, an explicit no-side-effects declaration, content-hashed artifacts, allowed next actions, and an `ok` verdict.

Implemented commands:

```bash
pnpm pmh system status
pnpm pmh venue list
pnpm pmh venue inspect <venue-id>
```

Unknown commands and venue identities fail closed with a non-zero process exit code and a JSON diagnostic. The present CLI cannot write external state or move value; both effects are literal `false` in every response.

Claim/link inspection, opportunity verification, deterministic replay, shadow execution, campaign inspection, and Core projections remain planned surfaces. Human-readable Studio views will consume the same projections and must never recompute verdicts.
