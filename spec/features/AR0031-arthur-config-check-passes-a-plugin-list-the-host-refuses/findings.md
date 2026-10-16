# AR0031 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `arthur config check` says ok when a plugin's `setup` refuses the start

- Kind: improvement
- Found by: 2026-10-16-ar0031-config-check-host-63e14b42 (worker), 2026-10-16
- Where: `packages/core/src/cli.ts:49` (`load`) and `packages/core/src/cli.ts:73`
- What: `configCheck` runs the host's checks before `setup` only, as AR0031 asks, so a refusal raised in `setup` (a plugin registering a command name the core or another plugin holds, or a plugin's own `setup` throwing) is not in its lines, and the check exits 0 while `arthur run` refuses to start. The binary already ran every `setup` in `load()` before the `config` command runs (`cli.ts:54`), so the refusal is known as `problem` but `config check` does not print it; `arthur help` does. Reproduced: a config whose only plugin is `orchestration` with a `setup` that registers a command named `config`; `arthur config check` prints `no enabled plugin names an env variable` and exits 0, `arthur help` prints `plugin orchestration: setup failed: command config: registered by core and by orchestration; a command belongs to one plugin`.
- Suggestion: decide whether `config check` may report what the binary's own load found (the `problem` passed to `core()`), which means `setup` side effects (each plugin's folder under `home`) already happen on every `arthur` command; or keep `config check` setup-free and say in `docs/commands/config.md` that setup refusals show at start only (as it says now).
- Status: ticket AR0039
