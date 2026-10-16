# AR0007 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur config check` passes a plugin list the host refuses

- Kind: improvement
- Found by: 2026-10-16-ar0007-ar0007-roadmap-4-53516d96 (worker), 2026-10-16
- Where: `packages/core/src/config-check.ts:6`
- What: `config check` runs only the env check, not the host's checks of `packages/core/src/host.ts` (`orchestration` required, `requires`, cycles, duplicate names, each plugin's own `check`). Reproduced: a config whose only plugin is `{ name: "telegram", options: {} }` prints `no enabled plugin names an env variable` and exits 0, while `loadPlugins` refuses it for the missing `orchestration`.
- Suggestion: once `arthur run` (entry 8) loads plugins, have `config check` also report the host's refusals without running any `setup` (split the checking part of `loadPlugins` from the setup loop); the env lines stay as they are.
- Status: ticket AR0031
