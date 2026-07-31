# AI discovery and control-plane boundary

## Why AI belongs here

Opportunity discovery is not a purely mechanical scan. Choosing themes, recognizing paraphrased claims, deciding which venue families to inspect, and forming candidate strategies are subjective search problems. The architecture therefore treats one or more inexpensive, fast AI workers as normal discovery infrastructure.

## Authority chain

1. Discovery workers inspect bounded inputs and emit hypotheses.
2. Claim-link proposals remain `UNREVIEWED` until independent review.
3. Deterministic compilers turn accepted inputs into bounded candidates.
4. The exact `bigint` verifier evaluates every canonical resolution state.
5. Only a valid verifier certificate may reach the Risk Governor.
6. Live execution remains disabled.

An AI worker cannot collapse or skip a stage.

## Worker pool

Workers implement one narrow interface and declare:

- identity;
- heuristic or model kind;
- free or low cost tier;
- structured output schema.

The pool may run workers concurrently, tolerate individual failures, deduplicate equivalent theses, and cap hypotheses per task. A model provider is an adapter behind `AiModelPort`; model names and credentials never enter Core domain types.

The initial adapter binds that port to OpenAI Responses. The default
`gpt-5.4-mini` request has strict `pmh.discovery-output.v1` Structured Output,
no tools, `store:false`, minimal reasoning, at most 800 output tokens, and an
8-second timeout. Only task-scoped venue IDs survive application-side
validation. The API key remains in a native private field in the control-plane
process and is absent from JSON projections, diagnostics, SQLite, and Git.

Completed runs enter a bounded Discovery Ledger. It retains the
question, venue scope, worker identities, diagnostics, and hypotheses so an
HTTP response is not the only copy of subjective work. The ledger accepts
proposal-only, unreviewed, non-executable records and is projected to Studio
over SSE.

The Scout Inbox has no review button. Until an independent reviewer authority
is configured, hypotheses cannot become accepted market links and therefore
cannot enter deterministic candidate compilation.

## Control plane

The control plane is the long-running owner of projections, discovery runs, event streams, and future venue sessions. Studio is a client. This keeps runtime state, credentials, venue transports, and exact verification out of the browser.
