# SQLite AI Spend Policy

Status: implemented and live-qualified

## Problem

Studio already persisted the primary discovery provider, Codex model, and
reasoning effort in SQLite. That choice controlled the fast discovery pool but
did not govern DeepSeek-only background paths. A `CODEX / terra` selection
could therefore coexist with automatic Pi investigations, semantic review,
probability estimation, premise analysis/routing, and evidence interpretation
using `DEEPSEEK_API_KEY`.

The presence of a credential is capability, not consent to recurring spend.

## Decision

AI runtime configuration v2 adds one durable boolean:
`deepseekAutomationEnabled`. It is stored beside provider/model/effort in the
existing revision-safe SQLite singleton and defaults to false. Retained v1
records migrate in memory with the gate closed; the next operator update writes
v2 without changing or retaining any credential.

The gate controls automatic DeepSeek effects:

- search-lease Pi escalation;
- semantic-review scheduling;
- probability-estimation scheduling;
- premise analysis and evidence routing;
- traded-state route expansion through Pi;
- captured-rule interpretation.

Explicit manual DeepSeek/Pi requests remain available when configured. The
gate is a spending policy, not credential deletion and not a provider alias.
Codex Terra remains the primary discovery runtime independently.

## Product surface

The Discover runtime panel shows and edits the SQLite-backed gate next to the
provider, model, and effort controls. Its status language distinguishes
`DeepSeek automation enabled` from `DeepSeek automatic spend blocked`.

## Compatibility and qualification

- Existing v1 SQLite records retain provider/model/effort and migrate with
  automatic DeepSeek disabled.
- Configuration updates remain revision-safe and contain no credential text.
- The search deep lane reports `PI_DISABLED` and makes zero Pi calls while the
  live gate is closed, then reflects an enabled gate without reconstructing the
  scheduler.
- Background deterministic/anonymous work, Codex discovery, and explicit
  manual Pi authority are unchanged.
- The live desk is persisted as revision 20: `CODEX`, `gpt-5.6-terra`, `high`,
  `deepseekAutomationEnabled=false`.
- All 618 workspace tests, type checks, and the production build pass. Desktop
  and 390 px System overview checks show the persisted choice and blocked-spend
  language with a 12 px visible type floor, no horizontal overflow, and no
  browser errors.

## Authority

This setting can reduce or enable model requests only. It grants no semantic
decision, certificate, execution, credential, order, signing, or value-moving
authority.
