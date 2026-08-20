# Operations

This guide covers a local research deployment. It does not configure trading
credentials or live execution because neither is supported.

## Requirements

- Node.js 22.19 or newer
- pnpm 11 (the repository pins `pnpm@11.13.1`)
- a local Codex OAuth session for the default Agent route, or an optional
  DeepSeek API key for explicitly selected DeepSeek workloads

## Install and run

```bash
corepack enable
pnpm install
pnpm check
pnpm test
pnpm studio
```

`pnpm studio` runs the Node control plane and the Vite dashboard together. The
control plane binds `127.0.0.1:4100`. Vite starts at `127.0.0.1:5173` and
increments the port when it is already occupied.

Useful health checks:

```bash
curl --fail http://127.0.0.1:4100/health
pnpm pmh system status
pnpm pmh venue list
pnpm pmh venue inspect polymarket-global
```

## Local state

The default operational store is `.data/control-plane.sqlite` with SQLite WAL.
It retains bounded Agent runs, exact corpus inputs, tool effects, catalog
observations, configuration, usage lineage, and operational projections. It is
ignored by Git and must not be treated as immutable campaign evidence.

Set `PMH_STATE_DB` before startup to use another path. Do not point multiple
active control-plane processes at a copied or partially synchronized database.
The server binds its listener before starting mutable background work so a dev
watcher that loses the port race cannot consume campaign budget.

## AI runtime configuration

The durable Studio setting is authoritative after the first startup. The
environment only seeds a new database.

Default configuration:

- provider: `CODEX`
- runtime: Codex app-server for the selected long-loop workloads
- credential: local Codex OAuth cache
- model: `gpt-5.6-terra`
- reasoning effort: `high`
- DeepSeek automation: disabled

Studio can switch the provider between Codex and DeepSeek and can select Luna
or Terra plus a model-supported reasoning effort. Runtime, credential binding,
model profile, and workload route are represented separately; the model's
reasoning effort remains part of that model profile.

To seed a new store explicitly:

```dotenv
PMH_DISCOVERY_PROVIDER=codex
PMH_CODEX_MODEL=gpt-5.6-terra
PMH_CODEX_REASONING_EFFORT=high
PMH_DEEPSEEK_AUTOMATION_ENABLED=0
```

For DeepSeek-backed profiles, copy `.env.example` to the Git-ignored
`.env.local` and set only the secret value there:

```dotenv
DEEPSEEK_API_KEY=your-key-here
```

Never place a credential inline in a command or commit `.env.local`.

## Background work and cost control

Fresh startup does not imply unlimited provider spend. Relevant schedulers are
configured independently, and most default to `0` (off). The checked-in
`.env.example` documents every accepted bound.

Common controls:

| Setting | Purpose | Safe default |
| --- | --- | --- |
| `PMH_CATALOG_REFRESH_INTERVAL_MS` | anonymous catalog refresh cadence | `0` (manual) |
| `PMH_AGENT_CAMPAIGN_TICK_MS` | poll explicitly activated campaigns | `1000` |
| `PMH_SEARCH_ISSUE_TICK_MS` | dispatch durable search issues | `0` |
| `PMH_SEMANTIC_REVIEW_TICK_MS` | dispatch independent review jobs | `0` |
| `PMH_EVIDENCE_ACQUISITION_TICK_MS` | fetch admitted official evidence | `0` |
| `PMH_EVIDENCE_CLAIM_TICK_MS` | interpret retained rule documents | `0` |
| `PMH_DISCOVERY_TIMEOUT_MS` | complete fast Agent loop budget | `300000` |
| `PMH_PI_TIMEOUT_MS` | complete Pi process budget | `300000` |

The control plane exposes request, tool, token, reasoning, and wall-clock usage
when the provider supplies it. A campaign budget is a hard operational bound,
not an inference about the quality of a truncated model result.

## Qualification commands

```bash
pnpm --silent discovery:smoke
pnpm --silent investigation:smoke
pnpm --silent semantic-constraint:smoke
pnpm --silent evidence-document:smoke
pnpm --silent rule-evidence-claim:smoke
pnpm studio:build
```

Each smoke command is separately bounded and should report content identities,
effects, and authority posture without printing credentials or hidden model
reasoning. Some commands require the corresponding provider credential or
anonymous network access.

When Clash intentionally maps public hosts into `198.18.0.0/15`, set
`PMH_EVIDENCE_TRUST_CLASH_FAKE_IP=1` only for the trusted local configuration.
Without that explicit posture, reserved addresses fail before network I/O.

## Before a small release

Run at least:

```bash
pnpm check
pnpm test
pnpm studio:build
git diff --check
```

Then verify in Studio:

1. readiness and storage posture are truthful;
2. a catalog refresh cannot start a model call by itself;
3. the selected runtime/model/effort survives restart;
4. active campaigns and token usage are visible;
5. no screen exposes live order, signing, approval, or fund-movement controls.

## Troubleshooting

- **Studio moved to 5174/5175:** expected Vite port increment; use the URL
  printed by the process.
- **Studio says offline:** check `http://127.0.0.1:4100/health` and the control
  plane terminal output.
- **Model unavailable:** inspect the runtime/credential posture in **Agent
  operations**. The Discover sidebar reports **System ready** source health, not
  a Readiness panel. The system should fail visibly; do not assume a hidden
  fallback.
- **DeepSeek setting appears ignored:** the SQLite configuration saved after
  first startup overrides environment seed values. Change it in Studio or use
  a fresh operational store intentionally.
- **Catalog is degraded:** refresh again and inspect per-venue diagnostics.
  Stale or empty sources cannot enter a current Agent context.
- **A run stops at its deadline:** preserve the run as evidence, then adjust
  the relevant complete-loop timeout or campaign budget deliberately.

See [Auto Prediction Studio](STUDIO.md) for the operator surfaces and
[Architecture](ARCHITECTURE.md) for authority boundaries.
