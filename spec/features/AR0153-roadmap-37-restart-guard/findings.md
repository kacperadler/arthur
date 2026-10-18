# AR0153 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `/restart` cannot clear a restart due, since it restarts only the coordinator's agent

- Kind: improvement
- Found by: 2026-10-18-ar0153-0044a3b1 (worker), 2026-10-19
- Where: `packages/session/src/restart.ts` (`restart`), `packages/orchestration/src/orchestration.ts` (`coordinator.restart`)
- What: the code a merge changes runs in `arthur run` (every plugin, loaded once at its start); `/restart`, `/restart fresh` and the fresh start kill only the coordinator's tmux session, and `arthur run` starts the agent again with the same plugins loaded. So the restart guard of entry 37 is cleared only by a restart of `arthur run` itself (`systemctl --user restart arthur`), which the owner does over SSH; the phone command the config example once promised ("the phone commands below clear it") cannot. Entry 37's "a restart clears it" holds for a restart of `arthur run` (`packages/session/test/restart-guard.test.ts`, "a restart clears it").
- Suggestion: while a restart is due, `/restart` ends `arthur run` after the handoff, so the service manager (`Restart=always`, `docs/setup.md`) starts it again on the new code, and says so; refused, or the coordinator only, when `arthur run` runs without a service manager. Out: restarting a by-hand `arthur run`.
- Status: open

## F2. `host.code` finds a plugin's package by its name, not by the module the config imported

- Kind: risk
- Found by: 2026-10-18-ar0153-0044a3b1 (worker), 2026-10-19
- Where: `packages/core/src/host.ts` (`loadPlugins`, the `code` list)
- What: the host takes a plugin's package folder as the folder beside the core's named after the plugin (`packages/<name>`, or `node_modules/@arthur/<name>`), when it holds a `package.json`. A plugin the config writes itself under a package's name (the core's tests do this with `orchestration`) gets that package's folder, so the restart guard watches code that is not loaded; a plugin from a package of another name, or installed elsewhere, gets no folder, so its code is not watched. With the workspace's own plugins, each named as its folder, both lists match.
- Suggestion: when entry 51 freezes the plugin API, let a plugin name its own module (`import.meta.url`) and take the folder from that.
- Status: open
