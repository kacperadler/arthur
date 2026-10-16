# AR0009 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A phone command name with a dash cannot go into Telegram's command menu

- Kind: risk
- Found by: 2026-10-16-ar0009-command-registry-daf148e5 (worker), 2026-10-16
- Where: `packages/core/src/commands.ts` (`NAME`, `phone()`)
- What: the registry accepts command names of lowercase letters, digits and dashes (`review-needed`, `retro-due`), and any phone command's `about`. Telegram's `setMyCommands` takes only `[a-z0-9_]{1,32}` names and a description of 3 to 256 characters, so a phone command named with a dash, or with a short or long `about`, would make the menu call fail when entry 50 builds it.
- Suggestion: in entry 50, decide whether the registry refuses such phone commands at registration (all channels then share Telegram's limits) or telegram maps or skips them in its menu; the CLI names stay as they are.
- Status: open

## F2. An unknown `--project` name reaches the command unchecked

- Kind: improvement
- Found by: 2026-10-16-ar0009-command-registry-daf148e5 (worker), 2026-10-16
- Where: `packages/core/src/cli.ts` (`main`)
- What: `arthur <cmd> --project <name>` hands the name to the command as `project`; nothing yet knows the project list (entry 41 adds `host.projects()`), so `--project typo` is not refused by the binary and each command would have to check it.
- Suggestion: with entry 41, the binary refuses a `--project` name that `host.projects()` does not list, naming the known projects, before the command runs.
- Status: open
