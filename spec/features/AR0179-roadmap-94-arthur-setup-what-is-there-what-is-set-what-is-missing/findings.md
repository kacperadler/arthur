# AR0179 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. While an env variable is missing, neither `arthur doctor` nor `arthur setup` checks the plugins' requirements

- Kind: improvement
- Found by: 2026-10-19-ar0179-arthur-setup-9194f26c (worker), 2026-10-19
- Where: `packages/core/src/host.ts:37` (`resolveEnv` throws before any plugin's `setup`, so no plugin provides `doctor`)
- What: roadmap entry 94's example run shows `telegram ffmpeg: missing: ...` under Requirements while `ARTHUR_TELEGRAM_CHAT_ID` is missing. A plugin's requirements come through `collect("doctor")`, which a plugin provides in its `setup`; the load refuses a missing variable before any `setup`, so `arthur doctor` prints only the core's lines and says the plugins' are not checked, and `arthur setup`, which prints the same lines from the same function, shows the core's lines and `the plugins' requirements are not checked until what Config refuses is fixed`. Reproduce: `packages/core/test/setup.test.ts`, the test "a missing variable is a step that refuses the start ...". On a new machine the owner sees the plugins' missing tools only after `.env` is complete.
- Suggestion: let a plugin's requirements be read without its env values, for example a `doctor` the plugin's package exports beside its options file (taking the options, not the host), which `arthur doctor` and `arthur setup` call for every enabled plugin before or without `setup`. Out: running a plugin's `setup` with a variable missing.
- Status: ticket AR0180
