# Harmony Studio

Harmony Studio is the read-only visual surface for architecture qualification. It uses Vite, React 19, Tailwind CSS 4, and repository-owned shadcn/ui components.

## Process boundary

`packages/control-plane` is a long-running Node process. It owns the current projection, AI discovery coordination, and an SSE event stream. Studio reads:

- `GET /api/v1/projection`
- `GET /api/v1/events`
- `GET /api/v1/books`
- `POST /api/v1/books/replay`
- `POST /api/v1/discovery/runs`

If the process is unavailable, Studio shows an explicit offline state. It does not silently fall back to a build-time snapshot.

The current opportunity, payoff, verifier-trace, and capital panels remain illustrative fixture-replay presentation data. They demonstrate the intended projection shape; they are not connected to a live market and cannot produce an executable action.

## Book desk

The Books projection is backed by `ReplayBookDesk` in the control plane. On
startup it verifies the checked-in Polymarket, Gemini, and Limitless stream
artifacts, decodes them with venue-local codecs, and applies the resulting
events to deterministic books.

`GET /api/v1/books` returns the current read-only projection.
`POST /api/v1/books/replay` repeats the in-memory replay, declares external
writes, value movement, and live execution as literal `false`, and broadcasts
the updated projection to Studio over SSE.

The UI displays lifecycle, generation, native sequence policy, top depth,
state identity, and evidence identity. It does not recompute book truth.

## AI boundary

Discovery workers may be cheap heuristics or external models. They can propose search terms, possible same-claim links, and strategy hypotheses. Every hypothesis is `PROPOSE_ONLY` and `UNREVIEWED`.

AI output cannot:

- publish a semantic equivalence decision;
- publish an arbitrage certificate;
- bypass depth, fee, precision, payout, or capital checks;
- grant execution authority.

Deterministic candidate compilation and the independent exact verifier remain downstream authority boundaries.

## Local use

```bash
pnpm studio
pnpm studio:build
```

The first command runs the control plane and Vite dashboard together.
